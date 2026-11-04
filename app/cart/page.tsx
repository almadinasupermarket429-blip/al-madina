// app/cart/page.tsx
import { cookies } from "next/headers";
import { getCustomerSession } from "@/lib/customer-auth";
import { getCart, type CartIdentity } from "@/lib/cart";
import { getStoreSettings } from "@/lib/settings";
import { CartPageHeader, CartView } from "@/app/components/CartView";

const GUEST_COOKIE_NAME = "almadina_guest_cart";

export default async function CartPage() {
  const session = await getCustomerSession();
  const store = await cookies();
  const guestToken = store.get(GUEST_COOKIE_NAME)?.value;

  // Same identity resolution as /api/cart: logged-in customer, or their
  // existing guest token. If neither exists yet, there's nothing to show —
  // the empty state below covers that (no cookie gets minted just from
  // viewing this page; that only happens on an actual add-to-cart).
  const identity: CartIdentity | null = session?.userId
    ? { userId: session.userId }
    : guestToken
      ? { guestToken }
      : null;

  const [cart, cartMinimum] = await Promise.all([
    identity ? getCart(identity) : Promise.resolve({ cartId: "", items: [], subtotal: 0 }),
    getStoreSettings().then((s) => s.minimumOrder),
  ]);

  return (
    <main id="main" tabIndex={-1} className="min-h-screen bg-[#f8f7f3] text-[#18201b] flex flex-col items-center py-12 px-4 md:px-8">
      <div className="w-full max-w-2xl bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5">
        <CartPageHeader />
        <CartView initialCart={cart} cartMinimum={cartMinimum} />
      </div>
    </main>
  );
}

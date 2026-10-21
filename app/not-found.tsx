import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm border border-black/5">
        <div className="icon-btn mx-auto mb-5" style={{ width: 56, height: 56 }}>
          <SearchX size={26} />
        </div>
        <span className="eyebrow block mb-1">404</span>
        <h1 style={{ fontSize: 26, margin: "8px 0 8px" }}>Seite nicht gefunden</h1>
        <p style={{ color: "rgba(24,32,27,.7)", fontSize: 14, marginBottom: 24 }}>
          Die gesuchte Seite existiert nicht oder wurde verschoben.
        </p>
        <Link href="/" className="primary-btn full" style={{ justifyContent: "center" }}>
          <ArrowLeft size={16} /> Zurück zum Shop
        </Link>
      </div>
    </main>
  );
}

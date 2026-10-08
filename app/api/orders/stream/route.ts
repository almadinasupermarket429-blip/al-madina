import { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { subscribeOrderEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

// Admin only: Server-Sent Events stream. The admin dashboard keeps this
// connection open; the moment a new order is placed, an event is pushed
// down the wire and the dashboard plays the notification sound + refreshes.
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return new Response("Nicht autorisiert", { status: 401 });
  }

  const encoder = new TextEncoder();

  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval>;
  const stop = () => {
    unsubscribe();
    clearInterval(heartbeat);
  };

  const stream = new ReadableStream({
    start(controller) {
      // A tab that just went away makes enqueue throw; stop instead of breaking the other tabs.
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          stop();
        }
      };
      send(`event: ready\ndata: {}\n\n`);
      unsubscribe = subscribeOrderEvents((event) => send(`event: order\ndata: ${JSON.stringify(event)}\n\n`));

      // Keep the connection alive through proxies/load balancers.
      heartbeat = setInterval(() => send(`: heartbeat\n\n`), 25000);
    },
    cancel: stop,
  });

  req.signal.addEventListener("abort", stop);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

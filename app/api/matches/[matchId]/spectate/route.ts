import { prisma } from "@/lib/prisma";

const MATCH_INCLUDE = {
  participants: { include: { agent: true } },
  moves: { orderBy: { createdAt: "asc" as const } },
} as const;

export async function GET(req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const params = await ctx.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let polling = false;

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        req.signal.removeEventListener("abort", onAbort);
        controller.close();
      };

      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const poll = async () => {
        if (closed || polling) return;
        polling = true;

        try {
          const match = await prisma.match.findUnique({
            where: { id: params.matchId },
            include: MATCH_INCLUDE,
          });

          if (!match) {
            send({ type: "error", error: "MATCH_NOT_FOUND" });
            close();
            return;
          }

          send({ type: "state", match });

          if (match.status === "COMPLETED") {
            send({ type: "complete", match });
            close();
          }
        } catch {
          send({ type: "error", error: "SPECTATE_POLL_FAILED" });
          close();
        } finally {
          polling = false;
        }
      };

      const onAbort = () => {
        close();
      };

      req.signal.addEventListener("abort", onAbort);

      const interval = setInterval(() => {
        void poll();
      }, 1500);

      void poll();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

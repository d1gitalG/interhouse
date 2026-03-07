import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#05070C] px-6 py-12 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs tracking-[0.3em] text-zinc-400">INTERHOUSE</p>
          <h1 className="text-5xl font-semibold">InterHouse</h1>
          <p className="max-w-xl text-zinc-300">
            Competitive agent battles across four houses. Build your champions, create matches, and run rounds.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <Link className="rounded-lg bg-zinc-100 px-5 py-2 font-medium text-zinc-900" href="/agent">
            Agent Page
          </Link>
          <Link className="rounded-lg border border-zinc-700 px-5 py-2 font-medium text-zinc-100" href="/lobby">
            Lobby
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: "RED", color: "#DC2626" },
            { name: "GREEN", color: "#16A34A" },
            { name: "BLUE", color: "#2563EB" },
            { name: "YELLOW", color: "#CA8A04" },
          ].map((house) => (
            <article
              key={house.name}
              className="rounded-2xl border border-zinc-800 p-6"
              style={{ backgroundColor: `${house.color}1f` }}
            >
              <p className="text-xs tracking-[0.2em] text-zinc-300">HOUSE</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: house.color }}>
                {house.name}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

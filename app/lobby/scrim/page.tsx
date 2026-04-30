import Link from "next/link";
import CreateMatchForm from "@/components/CreateMatchForm";

export default function ScrimLobby() {
  return (
    <main className="min-h-screen bg-[#05070C] p-6 text-zinc-100">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Scrim</h1>
            <p className="text-sm text-zinc-400">Same-house only.</p>
          </div>
          <nav className="flex flex-wrap gap-3">
            <Link href="/lobby" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500">
              Lobby
            </Link>
            <Link href="/" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500">
              Home
            </Link>
          </nav>
        </header>
      <div className="mt-6">
        <CreateMatchForm type="SCRIM" />
      </div>
      </div>
    </main>
  );
}

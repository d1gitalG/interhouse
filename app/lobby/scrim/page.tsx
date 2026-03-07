import CreateMatchForm from "@/components/CreateMatchForm";

export default function ScrimLobby() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Scrim</h1>
      <p className="text-sm text-gray-500">Same-house only.</p>
      <div className="mt-6">
        <CreateMatchForm type="SCRIM" />
      </div>
    </main>
  );
}

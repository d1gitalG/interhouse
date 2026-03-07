import CreateMatchForm from "@/components/CreateMatchForm";

export default function WarLobby() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">War</h1>
      <p className="text-sm text-gray-500">Cross-house only.</p>
      <div className="mt-6">
        <CreateMatchForm type="WAR" />
      </div>
    </main>
  );
}

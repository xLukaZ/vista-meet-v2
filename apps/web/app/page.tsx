export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Vista Meet</h1>
        <p className="text-slate-400 mb-8">3D Meeting Platform — coming in Sprint 6</p>
        <a
          href="/rooms"
          className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors"
        >
          Enter Rooms
        </a>
      </div>
    </main>
  );
}

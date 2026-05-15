type Props = {
  params: { roomId: string };
};

export default function RoomPage({ params }: Props) {
  return (
    <main className="h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-400 text-sm mb-2">Room</p>
        <h1 className="text-xl font-bold font-mono">{params.roomId}</h1>
        <p className="text-slate-500 text-sm mt-4">
          Full meeting canvas — implemented in Sprint 6
        </p>
      </div>
    </main>
  );
}

import { RoomEntry } from "./RoomEntry";

type Props = { params: { roomId: string } };

export default function RoomPage({ params }: Props) {
  return <RoomEntry roomId={params.roomId} />;
}

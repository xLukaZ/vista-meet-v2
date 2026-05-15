import { useEffect, type RefObject } from "react";

export function useVideoTrack(
  track: MediaStreamTrack | undefined,
  ref: RefObject<HTMLVideoElement | null>,
) {
  useEffect(() => {
    const v = ref.current;
    if (!v || !track) return;
    v.srcObject = new MediaStream([track]);
    void v.play().catch(() => undefined);
    return () => { v.srcObject = null; };
  }, [track, ref]);
}

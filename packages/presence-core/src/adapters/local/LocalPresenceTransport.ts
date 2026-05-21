import type { AvatarState, PresenceTransport } from "../../types.js";

type RemoteStateListener = (states: Map<string, AvatarState>) => void;

/**
 * In-process PresenceTransport for standalone testing (no LiveKit required).
 *
 * Usage pattern:
 *   const transport = new LocalPresenceTransport("alice");
 *   transport.simulateRemote({ userId: "bob", position: {...}, ... });
 *
 * Sprint 6 swaps this for LiveKitDataChannelTransport in apps/web.
 */
export class LocalPresenceTransport implements PresenceTransport {
  private remoteStates: Map<string, AvatarState> = new Map();
  private listeners: Set<RemoteStateListener> = new Set();
  private ownUserId: string;
  private updateIntervalMs = 50; // 20 Hz default

  constructor(ownUserId: string) {
    this.ownUserId = ownUserId;
  }

  /** Called with our own camera state — stored locally, not sent anywhere. */
  broadcast(state: AvatarState): void {
    // In local mode, our own state is only stored for inspection, never looped back.
    void state;
  }

  /**
   * Inject a fake remote participant state — triggers all onRemoteState listeners.
   * Useful for simulating another user walking around the model.
   */
  simulateRemote(state: AvatarState): void {
    if (state.userId === this.ownUserId) return; // never inject self
    this.remoteStates.set(state.userId, state);
    this.notify();
  }

  /** Remove a simulated remote participant. */
  removeSimulated(userId: string): void {
    if (this.remoteStates.delete(userId)) this.notify();
  }

  /** Remove all simulated remote participants. */
  clearSimulated(): void {
    if (this.remoteStates.size > 0) {
      this.remoteStates.clear();
      this.notify();
    }
  }

  onRemoteState(cb: RemoteStateListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  setUpdateRate(hz: number): void {
    this.updateIntervalMs = Math.round(1000 / hz);
  }

  dispose(): void {
    this.listeners.clear();
    this.remoteStates.clear();
  }

  private notify(): void {
    const snapshot = new Map(this.remoteStates);
    for (const cb of this.listeners) cb(snapshot);
  }
}

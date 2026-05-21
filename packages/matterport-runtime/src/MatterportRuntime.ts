import { createError } from "@meet-vista/core";
import { setupSdk } from "@matterport/sdk";
import type { MpSdk } from "@matterport/sdk";
import type {
  MatterportRuntime as IMatterportRuntime,
  MatterportConfig,
  CameraPose,
  MatterportObjectLayer,
} from "./types.js";
import { TagObjectLayer } from "./TagObjectLayer.js";

// ─── Runtime implementation ───────────────────────────────────────────────────

type CameraListener = (pose: CameraPose) => void;
type ReadyListener = () => void;

export class MatterportRuntimeImpl implements IMatterportRuntime {
  private mpSdk: MpSdk | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private ready = false;
  private readyListeners: Set<ReadyListener> = new Set();
  private cameraListeners: Set<CameraListener> = new Set();
  private cameraSub: { cancel(): void } | null = null;
  private objectLayer: MatterportObjectLayer | null = null;
  private lastPose: CameraPose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    fov: 90,
  };

  async mount(container: HTMLElement, config: MatterportConfig): Promise<void> {
    // Connect via the official @matterport/sdk package.
    //
    // IMPORTANT: do NOT pre-create the iframe and pass it via `iframe:`.
    // When setupSdk receives an existing iframe it skips setting the src, so
    // the handshake never completes. Instead pass `container:` and let setupSdk
    // create the iframe — afterwards we grab the reference from the DOM.
    //
    // bundleUrl / domain: when set, points to a self-hosted Matterport bundle.
    // Self-hosting is REQUIRED for Sprint 4+ Scene API access (3D avatars/objects).
    // Without it the SDK loads from my.matterport.com which blocks scene-graph access.
    // To self-host: download the bundle from the Matterport developer portal, host it
    // at a public URL, then set VITE_MATTERPORT_BUNDLE_URL=https://your-domain.com/bundle/
    const domain = config.bundleUrl
      ? new URL(config.bundleUrl).hostname
      : undefined; // undefined → defaults to my.matterport.com

    try {
      this.mpSdk = await setupSdk(config.sdkKey, {
        space: config.modelId,
        container,                        // setupSdk creates the iframe inside container
        iframeQueryParams: { play: 1 },
        iframeAttributes: {
          style: "width:100%;height:100%;border:none;display:block;",
          allow: "xr-spatial-tracking; fullscreen",
          allowfullscreen: "true",
        },
        ...(domain ? { domain } : {}),
      });
    } catch (err) {
      throw createError("MP_LOAD_FAILED", "Failed to connect to Matterport SDK", err);
    }

    // Grab the iframe setupSdk created so we can remove it on dispose()
    this.iframe = container.querySelector("iframe");

    // Step 3: Initialise the Tag-based object layer for 3D avatar placeholders
    this.objectLayer = new TagObjectLayer(this.mpSdk);

    // Step 4: Subscribe to camera events and mark as ready
    this.bindCameraEvents();
    this.ready = true;
    for (const cb of this.readyListeners) cb();
    this.readyListeners.clear();
  }

  private bindCameraEvents(): void {
    if (!this.mpSdk) return;

    // Camera.Pose in the new SDK has:
    //   position: Vector3  (x, y, z)
    //   rotation: Vector2  (x=pitch, y=yaw)
    // We store pitch/yaw in rotation.x/y (z=0, w=1 unused).
    const sub = this.mpSdk.Camera.pose.subscribe((pose) => {
      this.lastPose = {
        position: { x: pose.position.x, y: pose.position.y, z: pose.position.z },
        rotation: { x: pose.rotation.x, y: pose.rotation.y, z: 0, w: 1 },
        fov: 90, // new SDK does not expose fov directly in pose
      };
      for (const cb of this.cameraListeners) cb(this.lastPose);
    });

    this.cameraSub = sub;
  }

  async dispose(): Promise<void> {
    this.cameraSub?.cancel();
    this.cameraSub = null;
    this.ready = false;
    this.readyListeners.clear();
    this.cameraListeners.clear();
    this.iframe?.remove();
    this.iframe = null;
    this.mpSdk = null;
  }

  async getCameraPose(): Promise<CameraPose> {
    if (!this.ready) throw createError("MP_LOAD_FAILED", "Matterport not ready");
    return this.lastPose;
  }

  async teleport(pose: CameraPose): Promise<void> {
    if (!this.ready || !this.mpSdk) {
      throw createError("MP_LOAD_FAILED", "Matterport not ready");
    }
    // Mode.moveTo with INSIDE mode moves the camera to the given position/rotation
    await this.mpSdk.Mode.moveTo(this.mpSdk.Mode.Mode.INSIDE, {
      position: { x: pose.position.x, y: pose.position.y, z: pose.position.z },
      rotation: { x: pose.rotation.x, y: pose.rotation.y },
      transition: this.mpSdk.Mode.TransitionType.FLY,
    });
  }

  onCameraChanged(cb: CameraListener): () => void {
    this.cameraListeners.add(cb);
    return () => this.cameraListeners.delete(cb);
  }

  getObjectLayer(): MatterportObjectLayer {
    if (!this.objectLayer) {
      throw createError("MP_LOAD_FAILED", "Matterport not ready — call mount() first");
    }
    return this.objectLayer;
  }

  isReady(): boolean {
    return this.ready;
  }

  onReady(cb: ReadyListener): void {
    if (this.ready) cb();
    else this.readyListeners.add(cb);
  }
}

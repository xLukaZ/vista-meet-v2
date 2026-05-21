import { createError } from "@meet-vista/core";
import { loadMatterportBundle, DEFAULT_BUNDLE_URL } from "./bundle-loader.js";
import type {
  MatterportRuntime as IMatterportRuntime,
  MatterportConfig,
  CameraPose,
  MatterportObjectLayer,
} from "./types.js";

// ─── Matterport SDK internal types (minimal subset) ───────────────────────────

type MpVec3 = { x: number; y: number; z: number };

/** Matterport camera pose as returned by Camera.pose.subscribe */
type MpCameraPose = {
  position: MpVec3;
  /** Euler angles in degrees */
  rotation: MpVec3;
  projection?: { fov?: number };
};

type MpSdkSubscription = { cancel(): void };

type MpSdkInstance = {
  Camera: {
    pose: {
      subscribe(cb: (pose: MpCameraPose) => void): MpSdkSubscription;
    };
    tweenTo(
      dest: { position?: MpVec3; rotation?: MpVec3 },
      opts?: { transition?: unknown; transitionTime?: number }
    ): Promise<void>;
  };
  Transition: {
    FLY: unknown;
    INSTANT: unknown;
  };
};

declare global {
  interface Window {
    MP_SDK?: {
      connect(
        iframe: HTMLIFrameElement,
        apiKey: string,
        sdkVersion: string
      ): Promise<MpSdkInstance>;
    };
    MATTERPORT_SDK_LOADED?: boolean;
  }
}

// ─── Runtime implementation ───────────────────────────────────────────────────

type CameraListener = (pose: CameraPose) => void;
type ReadyListener = () => void;

export class MatterportRuntimeImpl implements IMatterportRuntime {
  private mpSdk: MpSdkInstance | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private ready = false;
  private readyListeners: Set<ReadyListener> = new Set();
  private cameraListeners: Set<CameraListener> = new Set();
  private cameraSub: MpSdkSubscription | null = null;
  private objectLayer: MatterportObjectLayer | null = null;
  private lastPose: CameraPose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    fov: 90,
  };

  async mount(container: HTMLElement, config: MatterportConfig): Promise<void> {
    const bundleUrl = config.bundleUrl ?? DEFAULT_BUNDLE_URL;

    // Step 1: Load the SDK script — exposes window.MP_SDK in the parent frame
    try {
      await loadMatterportBundle(bundleUrl);
    } catch (err) {
      throw createError("MP_LOAD_FAILED", "Failed to load Matterport SDK bundle", err);
    }

    if (!window.MP_SDK) {
      throw createError("MP_LOAD_FAILED", "MP_SDK not found on window after bundle load");
    }

    // Step 2: Create iframe pointing at the Matterport showcase
    this.iframe = document.createElement("iframe");
    this.iframe.style.cssText = "width:100%;height:100%;border:none;display:block;";
    this.iframe.allow = "xr-spatial-tracking; fullscreen";
    this.iframe.allowFullscreen = true;

    const params = new URLSearchParams({
      m: config.modelId,
      play: "1",
      applicationKey: config.sdkKey,
      ...(config.options?.hideUI ? { help: "0", qs: "1", gt: "0", hr: "0" } : {}),
    });
    this.iframe.src = `https://my.matterport.com/show/?${params.toString()}`;
    container.appendChild(this.iframe);

    // Step 3: Connect SDK to iframe — this promise resolves when the showcase
    // inside the iframe is fully loaded and the SDK handshake is complete.
    try {
      this.mpSdk = await window.MP_SDK.connect(this.iframe, config.sdkKey, "3.5");
    } catch (err) {
      throw createError("MP_LOAD_FAILED", "Failed to connect to Matterport SDK", err);
    }

    // Step 4: Subscribe to camera events and mark as ready
    this.bindCameraEvents();
    this.ready = true;
    for (const cb of this.readyListeners) cb();
    this.readyListeners.clear();
  }

  private bindCameraEvents(): void {
    if (!this.mpSdk) return;

    const sub = this.mpSdk.Camera.pose.subscribe((pose) => {
      // Matterport gives Euler angles in degrees.
      // We store them in the Quat fields (x=pitch, y=yaw, z=roll, w unused).
      // Proper Euler→Quat conversion happens in Sprint 4 when avatars need real quats.
      this.lastPose = {
        position: { x: pose.position.x, y: pose.position.y, z: pose.position.z },
        rotation: { x: pose.rotation.x, y: pose.rotation.y, z: pose.rotation.z, w: 1 },
        fov: pose.projection?.fov ?? 90,
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
    await this.mpSdk.Camera.tweenTo(
      {
        position: { x: pose.position.x, y: pose.position.y, z: pose.position.z },
        rotation: { x: pose.rotation.x, y: pose.rotation.y, z: pose.rotation.z },
      },
      { transition: this.mpSdk.Transition.FLY, transitionTime: 1500 }
    );
  }

  onCameraChanged(cb: CameraListener): () => void {
    this.cameraListeners.add(cb);
    return () => this.cameraListeners.delete(cb);
  }

  /** Object layer — fully implemented in Sprint 4. */
  getObjectLayer(): MatterportObjectLayer {
    if (!this.objectLayer) {
      throw createError("MP_LOAD_FAILED", "Object layer not initialized — implemented in Sprint 4");
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

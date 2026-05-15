import { createError } from "@meet-vista/core";
import { loadMatterportBundle } from "./bundle-loader.js";
import type {
  MatterportRuntime as IMatterportRuntime,
  MatterportConfig,
  CameraPose,
  MatterportObjectLayer,
} from "./types.js";

type CameraListener = (pose: CameraPose) => void;
type ReadyListener = () => void;

export class MatterportRuntimeImpl implements IMatterportRuntime {
  private sdk: unknown = null;
  private iframe: HTMLIFrameElement | null = null;
  private ready = false;
  private readyListeners: Set<ReadyListener> = new Set();
  private cameraListeners: Set<CameraListener> = new Set();
  private objectLayer: MatterportObjectLayer | null = null;

  async mount(container: HTMLElement, config: MatterportConfig): Promise<void> {
    try {
      await loadMatterportBundle(config.bundleUrl);
    } catch (err) {
      throw createError("MP_LOAD_FAILED", "Failed to load Matterport SDK bundle", err);
    }

    this.iframe = document.createElement("iframe");
    this.iframe.style.width = "100%";
    this.iframe.style.height = "100%";
    this.iframe.style.border = "none";
    this.iframe.allow = "xr-spatial-tracking";
    this.iframe.allowFullscreen = true;

    const params = new URLSearchParams({
      m: config.modelId,
      ...(config.options?.hideUI ? { help: "0", qs: "1", gt: "0", hr: "0" } : {}),
      ...(config.options?.autoplay ? { play: "1" } : {}),
    });

    this.iframe.src = `https://my.matterport.com/show/?${params.toString()}`;
    container.appendChild(this.iframe);

    await this.waitForSdk();
    this.ready = true;
    for (const cb of this.readyListeners) cb();
    this.bindCameraEvents();
  }

  private waitForSdk(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.iframe?.contentWindow && "MP_SDK" in (this.iframe.contentWindow as Window)) {
          this.sdk = (this.iframe.contentWindow as Window & { MP_SDK: unknown }).MP_SDK;
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      this.iframe?.addEventListener("load", check);
    });
  }

  private bindCameraEvents(): void {
    // SDK camera event subscription — implemented in Sprint 3 once SDK types are confirmed
    // The interface is stable regardless of internal SDK version
  }

  async dispose(): Promise<void> {
    this.ready = false;
    this.readyListeners.clear();
    this.cameraListeners.clear();
    this.iframe?.remove();
    this.iframe = null;
    this.sdk = null;
  }

  async getCameraPose(): Promise<CameraPose> {
    if (!this.ready) throw createError("MP_LOAD_FAILED", "Matterport not ready");
    // Implemented in Sprint 3 with actual SDK calls
    return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, fov: 90 };
  }

  async teleport(pose: CameraPose): Promise<void> {
    if (!this.ready) throw createError("MP_LOAD_FAILED", "Matterport not ready");
    // Implemented in Sprint 3
    void pose;
  }

  onCameraChanged(cb: CameraListener): () => void {
    this.cameraListeners.add(cb);
    return () => this.cameraListeners.delete(cb);
  }

  getObjectLayer(): MatterportObjectLayer {
    if (!this.objectLayer) {
      throw createError("MP_LOAD_FAILED", "Object layer not initialized");
    }
    return this.objectLayer;
  }

  isReady(): boolean {
    return this.ready;
  }

  onReady(cb: ReadyListener): void {
    if (this.ready) {
      cb();
    } else {
      this.readyListeners.add(cb);
    }
  }
}

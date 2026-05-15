import type { Vec3, Quat } from "@meet-vista/core";

export type { Vec3, Quat };

export type CameraPose = {
  position: Vec3;
  rotation: Quat;
  fov: number;
};

export type MatterportConfig = {
  modelId: string;
  bundleUrl: string;
  options?: {
    hideUI?: boolean;
    startScene?: string;
    autoplay?: boolean;
  };
};

export type Transform = {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
};

export type SceneObject = {
  id?: string;
  type: "avatar" | "marker" | "label";
  transform: Transform;
  metadata?: Record<string, unknown>;
};

export interface MatterportObjectLayer {
  addObject(object: SceneObject): Promise<string>;
  updateObject(id: string, transform: Partial<Transform>): Promise<void>;
  removeObject(id: string): Promise<void>;
  getObject(id: string): SceneObject | null;
  getAllObjects(): SceneObject[];
  clear(): Promise<void>;
}

export interface MatterportRuntime {
  mount(container: HTMLElement, config: MatterportConfig): Promise<void>;
  dispose(): Promise<void>;

  getCameraPose(): Promise<CameraPose>;
  teleport(pose: CameraPose): Promise<void>;
  onCameraChanged(cb: (pose: CameraPose) => void): () => void;

  getObjectLayer(): MatterportObjectLayer;

  isReady(): boolean;
  onReady(cb: () => void): void;
}

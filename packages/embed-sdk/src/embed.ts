import type { AppError } from "@meet-vista/core";

export type VistaEmbedConfig = {
  modelId: string;
  roomId: string;
  apiKey?: string;
  displayName?: string;
  theme?: "light" | "dark";
  onReady?: () => void;
  onError?: (error: AppError) => void;
};

export interface VistaMeetEmbed {
  mount(selector: string, config: VistaEmbedConfig): Promise<void>;
  unmount(): void;
  updateConfig(config: Partial<VistaEmbedConfig>): void;
}

export interface HostIntegration {
  getModelId(): string;
  getSdkContext?(): unknown;
  mountVistaMeet(config: VistaEmbedConfig): Promise<void>;
}

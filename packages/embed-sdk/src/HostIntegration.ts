import type { HostIntegration, VistaEmbedConfig } from "./embed.js";

export class StandaloneAdapter implements HostIntegration {
  private modelId: string;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  getModelId(): string {
    return this.modelId;
  }

  async mountVistaMeet(config: VistaEmbedConfig): Promise<void> {
    // Standalone mounting — implemented in Sprint 7
    void config;
    throw new Error("StandaloneAdapter.mountVistaMeet not yet implemented");
  }
}

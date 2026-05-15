import { generateId } from "@meet-vista/core";
import type { MatterportObjectLayer, SceneObject, Transform } from "@meet-vista/matterport-runtime";

export class InMemoryObjectLayer implements MatterportObjectLayer {
  private objects: Map<string, SceneObject> = new Map();

  async addObject(object: SceneObject): Promise<string> {
    const id = object.id ?? generateId("obj");
    this.objects.set(id, { ...object, id });
    return id;
  }

  async updateObject(id: string, transform: Partial<Transform>): Promise<void> {
    const obj = this.objects.get(id);
    if (!obj) return;
    this.objects.set(id, {
      ...obj,
      transform: { ...obj.transform, ...transform },
    });
  }

  async removeObject(id: string): Promise<void> {
    this.objects.delete(id);
  }

  getObject(id: string): SceneObject | null {
    return this.objects.get(id) ?? null;
  }

  getAllObjects(): SceneObject[] {
    return Array.from(this.objects.values());
  }

  async clear(): Promise<void> {
    this.objects.clear();
  }
}

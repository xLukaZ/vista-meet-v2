import type { MpSdk } from "@matterport/sdk";
import type { MatterportObjectLayer, SceneObject, Transform } from "./types.js";

// ─── Tag-based MatterportObjectLayer ─────────────────────────────────────────
// Uses mpSdk.Tag API (available in both CDN and self-hosted modes) to place
// coloured label pins in the 3D scene.  For Sprint 4 these act as avatar
// placeholders; Sprint 5 wires in real presence positions.
//
// Dependency direction: matterport-runtime only (no circular dep with matterport-objects).

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export class TagObjectLayer implements MatterportObjectLayer {
  /** Maps our stable objectId → Matterport's internal tagId */
  private tagIds = new Map<string, string>();
  /** In-memory object store (source of truth for getObject / getAllObjects) */
  private objects = new Map<string, SceneObject>();

  constructor(private mpSdk: MpSdk) {}

  async addObject(object: SceneObject): Promise<string> {
    const id = object.id ?? generateId("obj");
    const descriptor = this.toDescriptor({ ...object, id });

    const [tagId] = await this.mpSdk.Tag.add(descriptor);
    if (!tagId) throw new Error("Matterport Tag.add returned no id");

    this.tagIds.set(id, tagId);
    this.objects.set(id, { ...object, id });
    return id;
  }

  async updateObject(id: string, transform: Partial<Transform>): Promise<void> {
    const tagId = this.tagIds.get(id);
    const obj = this.objects.get(id);
    if (!tagId || !obj) return;

    const updated: SceneObject = {
      ...obj,
      transform: { ...obj.transform, ...transform },
    };
    this.objects.set(id, updated);

    await this.mpSdk.Tag.editPositions({
      id: tagId,
      options: {
        anchorPosition: updated.transform.position,
        stemVector: stemFor(updated),
      },
    });
  }

  async removeObject(id: string): Promise<void> {
    const tagId = this.tagIds.get(id);
    if (!tagId) return;
    await this.mpSdk.Tag.remove(tagId);
    this.tagIds.delete(id);
    this.objects.delete(id);
  }

  getObject(id: string): SceneObject | null {
    return this.objects.get(id) ?? null;
  }

  getAllObjects(): SceneObject[] {
    return Array.from(this.objects.values());
  }

  async clear(): Promise<void> {
    const ids = Array.from(this.tagIds.values());
    if (ids.length > 0) await this.mpSdk.Tag.remove(...ids);
    this.tagIds.clear();
    this.objects.clear();
  }

  // ─── private helpers ────────────────────────────────────────────────────────

  private toDescriptor(object: SceneObject): Parameters<MpSdk["Tag"]["add"]>[0] {
    const pos = object.transform.position;
    const label =
      (object.metadata?.["displayName"] as string | undefined) ??
      (object.type === "avatar" ? "Teilnehmer" : object.type);

    // brand purple for avatars, teal for markers, yellow for labels
    const color =
      object.type === "avatar"
        ? { r: 0.678, g: 0.22, b: 0.71 }  // #AD38B5
        : object.type === "marker"
        ? { r: 0.2,   g: 0.8,  b: 0.9  }  // teal
        : { r: 1.0,   g: 0.85, b: 0.2  };  // yellow

    return {
      anchorPosition: { x: pos.x, y: pos.y, z: pos.z },
      stemVector: stemFor(object),
      label,
      color,
      stemVisible: true,
    };
  }
}

/** Short upward stem so the disc floats slightly above the anchor point. */
function stemFor(obj: SceneObject) {
  // Avatars float 0.3 m above their position; markers sit on the surface (0.1 m)
  const h = obj.type === "avatar" ? 0.3 : 0.1;
  return { x: 0, y: h, z: 0 };
}

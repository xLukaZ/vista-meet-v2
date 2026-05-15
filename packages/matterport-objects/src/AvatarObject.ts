import type { Transform, SceneObject } from "@meet-vista/matterport-runtime";

export type AvatarObjectConfig = {
  userId: string;
  displayName: string;
  speaking?: boolean;
  transform: Transform;
};

export function createAvatarObject(config: AvatarObjectConfig): SceneObject {
  return {
    id: `avatar_${config.userId}`,
    type: "avatar",
    transform: config.transform,
    metadata: {
      userId: config.userId,
      displayName: config.displayName,
      speaking: config.speaking ?? false,
    },
  };
}

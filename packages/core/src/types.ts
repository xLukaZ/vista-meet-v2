export type Vec3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };

export type Room = {
  id: string;
  name: string;
  slug: string;
  matterportModelId?: string;
  ownerId: string;
  settings: RoomSettings;
  createdAt: string;
};

export type RoomSettings = {
  maxParticipants: number;
  allowGuests: boolean;
  requireApproval: boolean;
  recordingEnabled: boolean;
};

export type RoomParticipant = {
  userId: string;
  roomId: string;
  role: "host" | "guest" | "viewer";
  displayName: string;
  avatarUrl?: string;
  joinedAt: string;
};

export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "TOKEN_EXPIRED"
  | "UNAUTHORIZED"
  | "NETWORK_ERROR"
  | "MP_LOAD_FAILED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type AppError = {
  code: ErrorCode;
  message: string;
  details?: unknown;
};

export type TokenRequest = {
  roomId: string;
  participantId: string;
  displayName: string;
  role: "host" | "guest";
};

export type TokenResponse = {
  token: string;
  livekitToken: string;
  participantId: string;
};

export class LiveKitTokenService {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getJoinToken(roomId: string, displayName: string): Promise<TokenResponse> {
    const res = await fetch(`${this.baseUrl}/rooms/${roomId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ displayName }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Request failed" })) as { message?: string };
      throw new Error(error.message ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<TokenResponse>;
  }

  async refreshToken(roomId: string, participantId: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/rooms/${roomId}/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ participantId }),
    });

    if (!res.ok) throw new Error(`Token refresh failed: HTTP ${res.status}`);

    const data = await res.json() as { token: string };
    return data.token;
  }
}

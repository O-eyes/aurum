const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aurum_ops_token");
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem("aurum_ops_token", access);
  localStorage.setItem("aurum_ops_refresh", refresh);
  localStorage.removeItem("aurum_ops_session_expired");
}

function clearTokens() {
  localStorage.removeItem("aurum_ops_token");
  localStorage.removeItem("aurum_ops_refresh");
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem("aurum_ops_refresh");
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE_URL}${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      localStorage.setItem("aurum_ops_session_expired", "1");
      clearTokens();
      return null;
    }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, ...init } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${BASE_URL}${API_PREFIX}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${API_PREFIX}${path}`, {
        ...init,
        headers,
      });
    }
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw new ApiError(
      res.status,
      body,
      (body as any)?.message ?? `HTTP ${res.status}`,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  kycStatus: string;
  createdAt: string;
}

export interface KycProfile {
  id: string;
  userId: string;
  status: string;
  reviewNote: string | null;
  externalId: string | null;
  updatedAt: string;
  user: { email: string; firstName: string | null; lastName: string | null };
}

export interface Order {
  id: string;
  userId: string;
  type: "BUY" | "SELL";
  status: string;
  amountUsd: string;
  goldOunces: string;
  tokenAmount: string;
  goldPriceUsd: string;
  walletAddress: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  actorId: string;
  resource: string;
  resourceId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface ReserveSnapshot {
  id: string;
  goldHeldOz: string;
  tokenSupply: string;
  backingRatio: string;
  goldPriceUsd: string;
  snapshotedAt: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  login: async (body: { email: string; password: string }) => {
    const data = await request<{
      accessToken: string;
      refreshToken: string;
      user: UserProfile;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
      skipAuth: true,
    });
    const allowedRoles = ["ADMIN", "COMPLIANCE", "TREASURY"];
    const hasAccess = data.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasAccess)
      throw new ApiError(403, null, "Insufficient permissions for ops console");
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },
  logout: async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {}
    clearTokens();
  },
  me: () => request<UserProfile>("/users/me"),
  getAccessToken,
  clearTokens,
};

// ── KYC (compliance) ─────────────────────────────────────────────────────────

export const kyc = {
  reviewQueue: () => request<KycProfile[]>("/kyc/review"),
  approve: (id: string, body: { note?: string }) =>
    request<void>(`/kyc/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ reason: body.note }),
    }),
  reject: (id: string, body: { note: string }) =>
    request<void>(`/kyc/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: body.note }),
    }),
};

// ── Orders ───────────────────────────────────────────────────────────────────

export const orders = {
  list: () => request<Order[]>("/orders"),
};

// ── Reserve ───────────────────────────────────────────────────────────────────

export const reserve = {
  latest: () => request<ReserveSnapshot>("/reserve/snapshot/latest"),
  history: () => request<ReserveSnapshot[]>("/reserve/snapshot/history"),
  manualSnapshot: (body: { goldHeldOz: string; vaultReference?: string }) =>
    request<ReserveSnapshot>("/reserve/snapshot", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aurum_inst_token");
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem("aurum_inst_token", access);
  localStorage.setItem("aurum_inst_refresh", refresh);
  localStorage.removeItem("aurum_inst_session_expired");
}

function clearTokens() {
  localStorage.removeItem("aurum_inst_token");
  localStorage.removeItem("aurum_inst_refresh");
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem("aurum_inst_refresh");
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE_URL}${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      localStorage.setItem("aurum_inst_session_expired", "1");
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

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  kycStatus: string;
  createdAt: string;
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
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceResponse {
  balance: string;
  balanceUsd: string;
  goldPriceUsd: string;
}

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
  walletChallenge: (address: string, chainId = 1) =>
    request<{ message: string }>("/auth/wallet/challenge", {
      method: "POST",
      body: JSON.stringify({ address, chainId }),
    }),
  walletLink: (body: { signature: string; message: string }) =>
    request<{ linked: boolean; address: string }>("/auth/wallet/verify", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const users = {
  me: () => request<UserProfile>("/users/me"),
  balance: () => request<BalanceResponse>("/users/me/balance"),
  wallets: () =>
    request<
      { id: string; address: string; isPrimary: boolean; createdAt: string }[]
    >("/users/me/wallets"),
  removeWallet: (walletId: string) =>
    request<void>(`/users/me/wallets/${walletId}`, { method: "DELETE" }),
};

export const orders = {
  list: () => request<Order[]>("/orders/me"),
  create: (body: {
    type: "BUY" | "SELL";
    amountUsd: string;
    walletAddress: string;
    idempotencyKey: string;
  }) =>
    request<Order>("/orders", { method: "POST", body: JSON.stringify(body) }),
};

export const kyc = {
  status: () =>
    request<{
      status: string;
      reviewNote: string | null;
      sdkToken: string | null;
      externalId: string | null;
      updatedAt: string | null;
    }>("/kyc/status"),
  submit: (body: { idDocumentType?: string }) =>
    request<{ sdkToken: string; externalId: string }>("/kyc/submit", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aurum_access_token");
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem("aurum_access_token", access);
  localStorage.setItem("aurum_refresh_token", refresh);
  localStorage.removeItem("aurum_session_expired");
}

function clearTokens() {
  localStorage.removeItem("aurum_access_token");
  localStorage.removeItem("aurum_refresh_token");
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem("aurum_refresh_token");
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE_URL}${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      localStorage.setItem("aurum_session_expired", "1");
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
    const message = (body as any)?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, body, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  kycStatus: string;
  createdAt: string;
}

export interface OtpLoginResponse extends LoginResponse {
  isNewUser: boolean;
}

export const auth = {
  register: (body: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) =>
    request<{ message: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
      skipAuth: true,
    }),

  login: async (body: {
    email: string;
    password: string;
  }): Promise<LoginResponse> => {
    const data = await request<LoginResponse>("/auth/login", {
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

  requestOtp: (phone: string) =>
    request<{ message: string; expiresInSeconds: number }>(
      "/auth/otp/request",
      {
        method: "POST",
        body: JSON.stringify({ phone }),
        skipAuth: true,
      },
    ),

  verifyOtp: async (phone: string, code: string): Promise<OtpLoginResponse> => {
    const data = await request<OtpLoginResponse>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
      skipAuth: true,
    });
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  walletChallenge: (address: string, chainId = 1) =>
    request<{ nonce: string; message: string }>("/auth/wallet/challenge", {
      method: "POST",
      body: JSON.stringify({ address, chainId }),
    }),

  walletVerify: (body: { signature: string; message: string }) =>
    request<LoginResponse>("/auth/wallet/verify", {
      method: "POST",
      body: JSON.stringify(body),
      skipAuth: true,
    }),

  walletLink: (body: { signature: string; message: string }) =>
    request<{ linked: boolean; address: string }>("/auth/wallet/verify", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  setTokens,
  clearTokens,
  getAccessToken,
};

// ── Users ────────────────────────────────────────────────────────────────────

export interface BalanceResponse {
  balance: string;
  balanceUsd: string;
  goldPriceUsd: string;
}

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

// ── KYC ──────────────────────────────────────────────────────────────────────

export interface KycStatus {
  status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
  reviewNote: string | null;
  sdkToken: string | null;
  externalId: string | null;
  updatedAt: string | null;
}

export const kyc = {
  status: () => request<KycStatus>("/kyc/status"),
  submit: (body: { idDocumentType?: string }) =>
    request<{ sdkToken: string; externalId: string }>("/kyc/submit", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ── Orders ───────────────────────────────────────────────────────────────────

export interface RedemptionMetadata {
  denomination: { weightG: number; label: string };
  quantity: number;
  totalWeightG: number;
  collectionMethod: "pickup" | "delivery";
  preferredPickupDate?: string;
  idType?: string;
  idNumber?: string;
  deliveryAddress?: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    country: string;
    postalCode?: string;
  };
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface Order {
  id: string;
  type: "BUY" | "SELL" | "REDEEM";
  status: string;
  amountUsd: string;
  goldOunces: string;
  tokenAmount: string;
  goldPriceUsd: string;
  walletAddress: string;
  idempotencyKey: string;
  payoutMetadata: unknown;
  redemptionMetadata?: RedemptionMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderBody {
  type: "BUY" | "SELL";
  amountUsd: string;
  walletAddress: string;
  idempotencyKey: string;
}

export interface CreateRedemptionBody {
  denomination: { weightG: number; label: string };
  quantity: number;
  walletAddress: string;
  collectionMethod: "pickup" | "delivery";
  preferredPickupDate?: string;
  idType: string;
  idNumber: string;
  deliveryAddress?: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    country: string;
    postalCode?: string;
  };
  idempotencyKey: string;
}

export const orders = {
  list: () => request<Order[]>("/orders/me"),
  get: (id: string) => request<Order>(`/orders/me/${id}`),
  create: (body: CreateOrderBody) =>
    request<Order>("/orders", { method: "POST", body: JSON.stringify(body) }),
  createRedemption: (body: CreateRedemptionBody) =>
    request<Order>("/orders/redeem", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancel: (id: string) =>
    request<void>(`/orders/me/${id}`, { method: "DELETE" }),
};

// ── Payments ─────────────────────────────────────────────────────────────────

export const payments = {
  initiateCard: (
    orderId: string,
    body: { email: string; callbackUrl?: string },
  ) =>
    request<{
      authorizationUrl: string;
      accessCode: string;
      reference: string;
    }>(`/orders/${orderId}/pay/card`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  initiateMobileMoney: (
    orderId: string,
    body: { phone: string; provider: "mtn" | "telecel" | "at" },
  ) =>
    request<{ reference: string; status: string; displayText: string }>(
      `/orders/${orderId}/pay/mobile-money`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  setPayoutMethod: (
    orderId: string,
    body: {
      method: "bank" | "mobile_money";
      currency: string;
      accountNumber?: string;
      bankCode?: string;
      phone?: string;
      network?: string;
      accountName: string;
    },
  ) =>
    request<{ message: string }>(`/orders/${orderId}/payout/method`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  initiatePayout: (orderId: string) =>
    request<{ transferCode: string; status: string }>(
      `/orders/${orderId}/payout/initiate`,
      {
        method: "POST",
      },
    ),
};

// ── Mint / Burn ───────────────────────────────────────────────────────────────

export const mint = {
  createBurnRequest: (orderId: string) =>
    request<{ to: string; data: string; value: string }>(
      `/mint/burn/request/${orderId}`,
      {
        method: "POST",
      },
    ),
  confirmBurn: (body: { orderId: string; txHash: string }) =>
    request<{ message: string }>("/mint/burn/confirm", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ── Reserve ───────────────────────────────────────────────────────────────────

export interface ReserveSnapshot {
  id: string;
  goldHeldOz: string;
  tokenSupply: string;
  backingRatio: string;
  goldPriceUsd: string;
  snapshotedAt: string;
}

export const reserve = {
  latest: () =>
    request<ReserveSnapshot>("/reserve/snapshot/public", { skipAuth: true }),
};

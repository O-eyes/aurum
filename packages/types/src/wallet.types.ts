export interface Wallet {
  id: string;
  userId: string;
  address: string;
  chainId: number;
  verified: boolean;
  createdAt: Date;
}

export interface WalletChallenge {
  nonce: string;
  message: string;
  expiresAt: Date;
}

export interface WalletVerifyResult {
  address: string;
  userId: string;
  isNewLink: boolean;
}

export interface ReserveSnapshot {
  id: string;
  goldHeldOz: string;
  tokenSupply: string;
  backingRatio: string;
  goldPriceUsd: string;
  vaultReference: string | null;
  source: string;
  createdAt: Date;
}

export interface ReserveStatus {
  goldHeldOz: string;
  tokenSupply: string;
  backingRatio: string;
  goldPriceUsd: string;
  lastAuditDate: Date;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

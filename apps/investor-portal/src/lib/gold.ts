// 1 troy oz = 31.1034768 grams exactly
export const GRAMS_PER_TROY_OZ = 31.1034768;

export interface GoldDenomination {
  weightG: number;
  ozEquiv: number;
  label: string;
}

// World-standard gold bar denominations
export const GOLD_DENOMINATIONS: GoldDenomination[] = [
  { weightG: 1,        ozEquiv: 0.0321507, label: '1g bar' },
  { weightG: 2.5,      ozEquiv: 0.0803769, label: '2.5g bar' },
  { weightG: 5,        ozEquiv: 0.160754,  label: '5g bar' },
  { weightG: 10,       ozEquiv: 0.321507,  label: '10g bar' },
  { weightG: 20,       ozEquiv: 0.643015,  label: '20g bar' },
  { weightG: 31.1035,  ozEquiv: 1.0,       label: '1 troy oz' },
  { weightG: 50,       ozEquiv: 1.60754,   label: '50g bar' },
  { weightG: 100,      ozEquiv: 3.21507,   label: '100g bar' },
  { weightG: 250,      ozEquiv: 8.03769,   label: '250g bar' },
  { weightG: 500,      ozEquiv: 16.0754,   label: '500g bar' },
  { weightG: 1000,     ozEquiv: 32.1507,   label: '1kg bar' },
];

import { TENANT } from './tenant.config';

export const CUSTODIAN = {
  name: TENANT.custodian.name,
  vaultAddress: TENANT.custodian.vaultAddress,
  pickupHours: TENANT.custodian.pickupHours,
  processingDays: TENANT.custodian.processingDays,
  deliveryRegions: TENANT.custodian.deliveryRegions,
  insuranceIncluded: true,
  minimumBars: 1,
} as const;

export const ID_TYPES = [
  { value: 'passport',         label: 'International Passport' },
  { value: 'national_id',      label: 'National ID Card' },
  { value: 'drivers_licence',  label: "Driver's Licence" },
] as const;

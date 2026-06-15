// Brand/product config for the institutional portal.
// To white-label: update these values.

export const TENANT = {
  name: 'Aurum',
  ticker: 'AUR',
  tagline: 'Institutional gold exposure, on-chain.',

  custodian: {
    name: 'Goldbod',
    jurisdiction: 'Ghana',
  },

  minimumUsd: 100,
  minimumGhs: 1500,

  supportEmail: 'institutional@aurum.gold',
} as const;

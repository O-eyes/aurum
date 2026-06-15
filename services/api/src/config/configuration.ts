export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:3002,http://localhost:3003').split(','),
  metricsToken: process.env.METRICS_TOKEN ?? '',

  jwt: {
    secret: process.env.JWT_SECRET!,
    expiry: process.env.JWT_EXPIRY ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
  },

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:29092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID ?? 'aurum-api',
    groupId: process.env.KAFKA_GROUP_ID ?? 'aurum-api-group',
  },

  kyc: {
    provider: process.env.KYC_PROVIDER ?? 'stub',
    apiUrl: process.env.KYC_PROVIDER_API_URL ?? '',
    apiKey: process.env.KYC_PROVIDER_API_KEY ?? '',
    secret: process.env.KYC_PROVIDER_SECRET ?? '',
    webhookSecret: process.env.KYC_WEBHOOK_SECRET ?? '',
  },

  blockchain: {
    rpcUrl: process.env.RPC_URL ?? '',
    chainId: parseInt(process.env.CHAIN_ID ?? '1', 10),
    aurumTokenAddress: process.env.AURUM_TOKEN_ADDRESS ?? '',
    minterPrivateKey: process.env.MINTER_PRIVATE_KEY ?? '',
  },

  fx: {
    apiUrl: process.env.FX_API_URL ?? 'https://open.er-api.com/v6/latest/USD',
  },

  // Aurum's commission + tax on each order. Fee-inclusive: the amount the buyer
  // pays is the gross; platform fee + tax come out of it, the remainder buys gold.
  fees: {
    // Percentage of the gross order value retained by Aurum.
    platformPercent: parseFloat(process.env.PLATFORM_FEE_PERCENT ?? '1.5'),
    // Optional flat fee (USD) added on top of the percentage.
    platformFlatUsd: parseFloat(process.env.PLATFORM_FEE_FLAT_USD ?? '0'),
    // Tax applied to the platform fee (e.g. VAT on the service fee). 0 until
    // a GRA-registered advisor confirms the rate/exemptions for Ghana.
    taxPercent: parseFloat(process.env.TAX_PERCENT ?? '0'),
  },

  goldbod: {
    apiUrl: process.env.GOLDBOD_API_URL ?? '',
    apiKey: process.env.GOLDBOD_API_KEY ?? '',
    webhookSecret: process.env.GOLDBOD_WEBHOOK_SECRET ?? '',
    // Paystack subaccount that receives the gold-cost portion of each charge.
    // Placeholder until GoldBod provides their real subaccount code.
    paystackSubaccount: process.env.GOLDBOD_PAYSTACK_SUBACCOUNT ?? '',
  },

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? '',
    baseUrl: process.env.PAYSTACK_BASE_URL ?? 'https://api.paystack.co',
  },

  sumsub: {
    appToken: process.env.SUMSUB_APP_TOKEN ?? '',
    secretKey: process.env.SUMSUB_SECRET_KEY ?? '',
    baseUrl: process.env.SUMSUB_BASE_URL ?? 'https://api.sumsub.com',
    levelName: process.env.SUMSUB_LEVEL_NAME ?? 'basic-kyc-level',
  },

  sms: {
    provider: process.env.SMS_PROVIDER ?? 'stub',
    apiKey: process.env.ARKESEL_API_KEY ?? '',
    senderId: process.env.SMS_SENDER_ID ?? 'Aurum',
  },

  email: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.EMAIL_FROM ?? 'noreply@aurum.finance',
  },

  logging: {
    level: process.env.LOG_LEVEL ?? 'debug',
  },
});

import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KycController } from "./kyc.controller";
import { KycService } from "./kyc.service";
import { KYC_PROVIDER } from "./kyc.provider.interface";
import { StubKycProvider } from "./providers/stub.provider";
import { SumsubProvider } from "./providers/sumsub.provider";

@Module({
  controllers: [KycController],
  providers: [
    KycService,
    {
      provide: KYC_PROVIDER,
      useFactory: (config: ConfigService) => {
        const providerName = config.get<string>("kyc.provider") ?? "stub";

        if (providerName === "sumsub") {
          const appToken = config.get<string>("sumsub.appToken") ?? "";
          const secretKey = config.get<string>("sumsub.secretKey") ?? "";
          const baseUrl =
            config.get<string>("sumsub.baseUrl") ?? "https://api.sumsub.com";
          const levelName =
            config.get<string>("sumsub.levelName") ?? "basic-kyc-level";

          if (!appToken || !secretKey) {
            throw new Error(
              "SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY must be set when KYC_PROVIDER=sumsub.",
            );
          }

          return new SumsubProvider(appToken, secretKey, baseUrl, levelName);
        }

        if (providerName !== "stub") {
          throw new Error(
            `KYC provider "${providerName}" is not supported. Valid options: stub, sumsub.`,
          );
        }

        // The stub auto-approves everyone and accepts any webhook signature.
        // Refusing to boot beats silently shipping an open KYC-approval endpoint.
        if (config.get<string>("nodeEnv") === "production") {
          throw new Error(
            "KYC_PROVIDER=stub is not allowed in production. Configure a real provider (e.g. sumsub).",
          );
        }

        return new StubKycProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [KycService],
})
export class KycModule {}

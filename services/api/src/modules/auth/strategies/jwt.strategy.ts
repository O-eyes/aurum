import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { JwtPayload, AuthenticatedUser } from "@aurum/types";
import { DatabaseService } from "../../../infrastructure/database/database.service";
import { RedisService } from "../../../infrastructure/redis/redis.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("jwt.secret")!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Check if token has been blacklisted (logout)
    const blacklisted = await this.redis.exists(`jwt:blacklist:${payload.jti}`);
    if (blacklisted) throw new UnauthorizedException("Token revoked");

    // Verify session still exists (covers force-logout scenarios)
    const session = await this.db.session.findUnique({
      where: { jti: payload.jti },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException("Session expired or revoked");
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    };
  }
}

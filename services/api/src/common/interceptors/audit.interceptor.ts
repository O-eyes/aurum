import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, tap } from "rxjs";
import { FastifyRequest } from "fastify";
import { AuthenticatedUser } from "@aurum/types";
import { AUDIT_KEY, AuditMeta } from "../decorators/audit.decorator";
import { REQUEST_ID_HEADER } from "../middleware/request-id.middleware";
import { AuditService } from "../../modules/audit/audit.service";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.get<AuditMeta | undefined>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!auditMeta) return next.handle();

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthenticatedUser }>();

    const actorId = request.user?.id ?? "anonymous";
    const requestId =
      (request.headers[REQUEST_ID_HEADER] as string) ?? "unknown";
    const ipAddress = request.ip;
    const userAgent = request.headers["user-agent"];

    return next.handle().pipe(
      tap({
        next: () => {
          this.auditService
            .emit({
              actorId,
              action: auditMeta.action,
              resource: auditMeta.resource,
              requestId,
              ipAddress,
              userAgent,
            })
            .catch((err: unknown) => {
              this.logger.error("Failed to write audit event", err);
            });
        },
      }),
    );
  }
}

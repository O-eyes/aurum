import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { REQUEST_ID_HEADER } from "../middleware/request-id.middleware";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestId = request.headers[REQUEST_ID_HEADER] as string | undefined;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
        { requestId },
      );
    }

    const response =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof response === "string"
        ? response
        : typeof response === "object" &&
            response !== null &&
            "message" in response
          ? (response as { message: string }).message
          : "Internal server error";

    reply.status(status).send({
      statusCode: status,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}

import { Injectable, NestMiddleware } from "@nestjs/common";
import { FastifyRequest, FastifyReply } from "fastify";
import { v4 as uuid } from "uuid";

export const REQUEST_ID_HEADER = "x-request-id";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: FastifyRequest["raw"], res: FastifyReply["raw"], next: () => void) {
    const existing = req.headers[REQUEST_ID_HEADER];
    const requestId = typeof existing === "string" ? existing : uuid();
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}

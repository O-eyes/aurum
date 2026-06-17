import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { AuditService } from "./audit.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@aurum/types";

@ApiTags("audit")
@ApiBearerAuth()
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COMPLIANCE, Role.TREASURY)
  @ApiOperation({ summary: "[Ops] Query audit log" })
  @ApiQuery({ name: "actorId", required: false })
  @ApiQuery({ name: "resource", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  async query(
    @Query("actorId") actorId?: string,
    @Query("resource") resource?: string,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.auditService.query({ actorId, resource, limit, offset });
  }
}

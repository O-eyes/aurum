import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { ReserveService } from "./reserve.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Public } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthenticatedUser, Role } from "@aurum/types";
import {
  ManualSnapshotSchema,
  type ManualSnapshotDto,
} from "./dto/reserve-snapshot.dto";
import { REQUEST_ID_HEADER } from "../../common/middleware/request-id.middleware";

@ApiTags("reserve")
@ApiBearerAuth()
@Controller("reserve")
export class ReserveController {
  constructor(private readonly reserveService: ReserveService) {}

  @Public()
  @Get("snapshot/public")
  @ApiOperation({
    summary:
      "[Public] Latest reserve snapshot — for investor portals and landing page",
  })
  async getPublicLatest() {
    return this.reserveService.getLatest();
  }

  @Get("snapshot/latest")
  @Roles(Role.ADMIN, Role.TREASURY, Role.COMPLIANCE)
  @ApiOperation({ summary: "[Ops] Get the most recent reserve snapshot" })
  async getLatest() {
    return this.reserveService.getLatest();
  }

  @Get("snapshot/history")
  @Roles(Role.ADMIN, Role.TREASURY, Role.COMPLIANCE)
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  @ApiOperation({ summary: "[Ops] Get paginated reserve snapshot history" })
  async getHistory(
    @Query("limit", new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.reserveService.getHistory(limit, offset);
  }

  @Post("snapshot")
  @Roles(Role.ADMIN, Role.TREASURY)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "[Ops] Take a manual reserve snapshot" })
  async manualSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Body(ZodValidationPipe.for(ManualSnapshotSchema)) dto: ManualSnapshotDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.reserveService.manualSnapshot(dto, user.id, requestId);
  }
}

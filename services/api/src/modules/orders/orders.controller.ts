import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
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
import { OrdersService } from "./orders.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthenticatedUser, Role } from "@aurum/types";
import { CreateOrderSchema, type CreateOrderDto } from "./dto/create-order.dto";
import {
  CreateRedeemSchema,
  type CreateRedeemDto,
} from "./dto/create-redeem.dto";
import { REQUEST_ID_HEADER } from "../../common/middleware/request-id.middleware";

@ApiTags("orders")
@ApiBearerAuth()
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── User-facing ────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: "Create a buy or sell order" })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(ZodValidationPipe.for(CreateOrderSchema)) dto: CreateOrderDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.ordersService.create(user.id, dto, requestId);
  }

  @Get("me")
  @ApiOperation({ summary: "List authenticated user orders" })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.ordersService.listByUser(user.id, limit, offset);
  }

  @Get("me/:orderId")
  @ApiOperation({
    summary: "Get a specific order belonging to the authenticated user",
  })
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
  ) {
    return this.ordersService.findOne(orderId, user.id);
  }

  @Post("redeem")
  @ApiOperation({ summary: "Create a physical gold redemption order" })
  async createRedemption(
    @CurrentUser() user: AuthenticatedUser,
    @Body(ZodValidationPipe.for(CreateRedeemSchema)) dto: CreateRedeemDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.ordersService.createRedemption(user.id, dto, requestId);
  }

  @Delete("me/:orderId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel a pending order" })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.ordersService.cancel(orderId, user.id, requestId);
  }

  // ── Ops / Admin ────────────────────────────────────────────────────────────

  @Get()
  @Roles(Role.ADMIN, Role.TREASURY, Role.COMPLIANCE)
  @ApiOperation({
    summary: "[Ops] List all orders, optionally filtered by status",
  })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  async listAll(
    @Query("status") status?: string,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.ordersService.listAll(status as any, limit, offset);
  }
}

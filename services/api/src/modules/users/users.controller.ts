import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
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
import { UsersService } from "./users.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthenticatedUser, Role } from "@aurum/types";
import { REQUEST_ID_HEADER } from "../../common/middleware/request-id.middleware";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COMPLIANCE, Role.TREASURY)
  @ApiOperation({ summary: "[Ops] List all users" })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  async listAll(
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.usersService.listAll(limit, offset);
  }

  @Get("me")
  @ApiOperation({ summary: "Get current user profile" })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.id);
  }

  @Patch("me")
  @ApiOperation({
    summary: "Update current user profile (firstName, lastName)",
  })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { firstName?: string; lastName?: string },
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.usersService.updateProfile(user.id, body, requestId);
  }

  @Get("me/balance")
  @ApiOperation({ summary: "Get current AURUM token balance (from ledger)" })
  async getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getBalance(user.id);
  }

  @Get("me/wallets")
  @ApiOperation({ summary: "List wallets linked to the current user" })
  async listWallets(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listWallets(user.id);
  }

  @Delete("me/wallets/:walletId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove a linked wallet" })
  async removeWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param("walletId") walletId: string,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.usersService.removeWallet(user.id, walletId, requestId, req.ip);
  }
}

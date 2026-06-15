import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { MintService } from './mint.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, Role } from '@aurum/types';
import { REQUEST_ID_HEADER } from '../../common/middleware/request-id.middleware';

const ConfirmMintSchema = z.object({
  mintRequestId: z.string().uuid(),
});

const ConfirmBurnSchema = z.object({
  burnRequestId: z.string().uuid(),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid tx hash'),
});

@ApiTags('mint')
@ApiBearerAuth()
@Controller('mint')
export class MintController {
  constructor(private readonly mintService: MintService) {}

  // Called by Treasury/Admin after payment confirmed — triggers on-chain mint
  @Post('request/:orderId')
  @Roles(Role.TREASURY, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Ops] Submit mint transaction for a confirmed order' })
  async requestMint(
    @Param('orderId') orderId: string,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.mintService.requestMint(orderId, requestId);
  }

  // Called when the mint tx is confirmed on-chain
  @Post('confirm')
  @Roles(Role.TREASURY, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Ops] Confirm an on-chain mint transaction' })
  async confirmMint(
    @Body(ZodValidationPipe.for(ConfirmMintSchema)) body: { mintRequestId: string },
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.mintService.confirmMint(body.mintRequestId, requestId);
  }

  // ── Burn/Sell ──────────────────────────────────────────────────────────────

  // Creates a burn request for a SELL order, returns the contract call the user must sign
  @Post('burn/request/:orderId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a burn request for a SELL order and get the on-chain call details' })
  async requestBurn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.mintService.createBurnRequest(orderId, requestId);
  }

  // Called by user after they have submitted the burn tx from their wallet
  @Post('burn/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a submitted burn transaction' })
  async confirmBurn(
    @Body(ZodValidationPipe.for(ConfirmBurnSchema)) body: { burnRequestId: string; txHash: string },
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.mintService.confirmBurn(body.burnRequestId, body.txHash, requestId);
  }
}

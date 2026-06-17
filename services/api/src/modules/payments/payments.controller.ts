import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
  RawBodyRequest,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { PaymentsService } from "./payments.service";
import { PayoutsService } from "./payouts.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Public } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "@aurum/types";
import {
  InitiateCardPaymentSchema,
  InitiateMobileMoneySchema,
  type InitiateCardPaymentDto,
  type InitiateMobileMoneyDto,
} from "./dto/initiate-payment.dto";
import {
  SetPayoutMethodSchema,
  type SetPayoutMethodDto,
} from "./dto/set-payout-method.dto";
import { REQUEST_ID_HEADER } from "../../common/middleware/request-id.middleware";

@ApiTags("payments")
@Controller("orders/:orderId/pay")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("card")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Initiate a card payment for an order via Paystack",
  })
  async initiateCard(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body(ZodValidationPipe.for(InitiateCardPaymentSchema))
    dto: InitiateCardPaymentDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.paymentsService.initiateCard(orderId, user.id, dto, requestId);
  }

  @Post("mobile-money")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Initiate a mobile money payment for an order via Paystack",
  })
  async initiateMobileMoney(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body(ZodValidationPipe.for(InitiateMobileMoneySchema))
    dto: InitiateMobileMoneyDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.paymentsService.initiateMobileMoney(
      orderId,
      user.id,
      dto,
      requestId,
    );
  }
}

// Payout method + trigger (nested under /orders/:orderId/payout)
@ApiTags("payments")
@Controller("orders/:orderId/payout")
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post("method")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Set payout method (bank or mobile money) for a SELL order",
  })
  async setPayoutMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body(ZodValidationPipe.for(SetPayoutMethodSchema)) dto: SetPayoutMethodDto,
  ) {
    return this.payoutsService.setPayoutMethod(orderId, user.id, dto);
  }

  @Post("initiate")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Initiate payout transfer after burn is confirmed" })
  async initiatePayout(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.payoutsService.initiatePayout(orderId, user.id, requestId);
  }
}

// Webhook controllers — both charge events and transfer events come to Paystack's webhook
@ApiTags("payments")
@Controller("payments")
export class PaymentsWebhookController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly payoutsService: PayoutsService,
  ) {}

  @Public()
  @Post("webhook/paystack")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Paystack unified webhook — handles charge + transfer events",
  })
  async paystackWebhook(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers("x-paystack-signature") signature: string,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(req.body);
    const event = ((req.body as any)?.event ?? "") as string;

    if (event.startsWith("transfer.")) {
      return this.payoutsService.handleTransferWebhook(
        rawBody,
        signature,
        requestId,
      );
    }
    return this.paymentsService.handleWebhook(rawBody, signature, requestId);
  }
}

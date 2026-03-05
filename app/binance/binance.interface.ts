export type Kline = [
  openTime: string,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  closeTime: string,
  quoteAssetVolume: string,
  numberOfTrades: string,
  takerBuyBaseAssetVolume: string,
  takerBuyQuoteAssetVolume: string,
  ignore: string
];

export interface KlinesResponse {
  erro: boolean;
  data?: Kline[];
  message?: string;
}

export interface RateLimit {
  rateLimitType: string;
  interval: string;
  intervalNum: number;
  limit: number;
  count: number;
}

export enum OrderStatus {
  "NEW" = "NEW",
  "PENDING_NEW" = "PENDING_NEW",
  "PARTIALLY_FILLED" = "PARTIALLY_FILLED",
  "FILLED" = "FILLED",
  "CANCELED" = "CANCELED",
  "PENDING_CANCEL" = "PENDING_CANCEL",
  "REJECTED" = "REJECTED",
  "EXPIRED" = "EXPIRED",
  "EXPIRED_IN_MATCH" = "EXPIRED_IN_MATCH",
}

export interface OrderResult {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  origClientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: OrderStatus;
  timeInForce: string;
  type: string;
  side: string;
  stopPrice: string;
  trailingDelta?: number;
  trailingTime?: number;
  icebergQty: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  workingTime: number;
  origQuoteOrderQty: string;
  strategyId?: number;
  strategyType?: number;
  selfTradePreventionMode: string;
  preventedMatchId?: number;
  preventedQuantity?: string;
}

export interface BinanceOrderResponse {
  id: string;
  status: number;
  result: OrderResult;
  rateLimits: RateLimit[];
}

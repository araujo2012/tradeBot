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

export interface StartBinanceSocketParams {
  listenKey: string;
  userId: string;
  apiKey?: string;
  apiSecret?: string;
}

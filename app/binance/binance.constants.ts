const configuredBaseUrl =
  process.env.BINANCE_REST_URL || "https://api.binance.com/api/v3/";

export const BASE_URL = configuredBaseUrl.endsWith("/")
  ? configuredBaseUrl
  : `${configuredBaseUrl}/`;

export const VALID_INTERVALS = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
];

export const VALID_SYMBOLS = [
  "BTCBRL",
  "ETHBRL",
  "USDTBRL",
  "XRPBRL",
  "SOLBRL",
  "BNBBRL",
];

export const MAX_LIMIT = 500;
export const FIXED_FETCH_LIMIT = 40;

// A Binance usa o código -2010 para várias recusas de ordem nova; a mensagem diz qual foi.
export const NEW_ORDER_REJECTED_CODE = -2010;
export const INSUFFICIENT_BALANCE_MESSAGE = "insufficient balance";

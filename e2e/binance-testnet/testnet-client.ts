import axios, { Method } from "axios";
import { KeyObject, createPrivateKey, sign } from "crypto";
import { readFileSync } from "fs";
import path from "path";

export const TESTNET_REST_URL = "https://testnet.binance.vision/api/v3";
export const TESTNET_WS_URL = "wss://ws-api.testnet.binance.vision/ws-api/v3";

const ROOT_DIR = path.resolve(__dirname, "../..");
const DEFAULT_PRIVATE_KEY_PATH = "scripts/testnet_private_key.pem";
// Ordem inexistente; no DELETE openOrders, significa que não havia ordem aberta.
const UNKNOWN_ORDER_CODE = -2011;

export interface TestnetCredentials {
  apiKey: string;
  privateKeyPath: string;
}

// Regras do símbolo no formato do SymbolConfig da aplicação.
export interface SymbolRules {
  priceDecimal: number;
  qtdDecimal: number;
  minNotional: number;
}

export interface BookTicker {
  bid: number;
  ask: number;
}

export type OrderSide = "BUY" | "SELL";

// Ordem como a Binance devolve em POST /order (com transactTime) e GET /allOrders.
export interface TestnetOrder {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  side: OrderSide;
  transactTime?: number;
}

export interface LimitOrderInput {
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  clientOrderId: string;
}

type QueryParams = Record<string, string | number>;

// Resposta de erro da Binance, com o corpo para quem precisa do código.
export class TestnetRequestError extends Error {
  constructor(readonly endpoint: string, readonly status?: number, readonly body?: any) {
    super(`Binance testnet /${endpoint} respondeu ${status}: ${JSON.stringify(body)}`);
  }
}

// Sem a chave do testnet o teste não tem como rodar: falha dizendo o que configurar.
export function readTestnetCredentials(): TestnetCredentials {
  const apiKey = process.env.BINANCE_TESTNET_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Defina BINANCE_TESTNET_API_KEY no .env.e2e com a API key Ed25519 criada em https://testnet.binance.vision (veja o README)."
    );
  }
  const privateKeyPath = path.resolve(
    ROOT_DIR,
    process.env.BINANCE_TESTNET_PRIVATE_KEY_PATH || DEFAULT_PRIVATE_KEY_PATH
  );
  return { apiKey, privateKeyPath };
}

// Casas decimais de um passo da Binance: "1.00000000" -> 0, "0.00001000" -> 5.
function decimalsOf(step: string) {
  const [, fraction = ""] = step.split(".");
  return fraction.replace(/0+$/, "").length;
}

function findFilter(filters: any[], filterType: string) {
  return filters.find((filter) => filter.filterType === filterType);
}

function toQuery(params: QueryParams) {
  return new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  );
}

// Cliente REST do Spot Testnet usado pelo teste para preparar e conferir o cenário.
// As requests da aplicação continuam saindo pela WebSocket API dela.
export class TestnetClient {
  private readonly privateKey: KeyObject;
  private clockOffset?: number;

  constructor(private readonly credentials: TestnetCredentials) {
    this.privateKey = createPrivateKey(
      readFileSync(credentials.privateKeyPath, "utf8")
    );
  }

  async getSymbolRules(symbol: string): Promise<SymbolRules> {
    const { symbols } = await this.request("GET", "exchangeInfo", toQuery({ symbol }));
    const { filters } = symbols[0];
    return {
      priceDecimal: decimalsOf(findFilter(filters, "PRICE_FILTER").tickSize),
      qtdDecimal: decimalsOf(findFilter(filters, "LOT_SIZE").stepSize),
      minNotional: Number(findFilter(filters, "NOTIONAL").minNotional),
    };
  }

  async getBookTicker(symbol: string): Promise<BookTicker> {
    const { bidPrice, askPrice } = await this.request(
      "GET",
      "ticker/bookTicker",
      toQuery({ symbol })
    );
    return { bid: Number(bidPrice), ask: Number(askPrice) };
  }

  placeLimitOrder(order: LimitOrderInput): Promise<TestnetOrder> {
    return this.signedRequest("POST", "order", {
      symbol: order.symbol,
      side: order.side,
      type: "LIMIT",
      timeInForce: "GTC",
      price: order.price,
      quantity: order.quantity,
      newClientOrderId: order.clientOrderId,
    });
  }

  // Ordens do símbolo criadas a partir de startTime (horário da Binance).
  getOrdersSince(symbol: string, startTime: number): Promise<TestnetOrder[]> {
    return this.signedRequest("GET", "allOrders", { symbol, startTime });
  }

  async cancelOpenOrders(symbol: string) {
    try {
      await this.signedRequest("DELETE", "openOrders", { symbol });
    } catch (error) {
      const isNothingOpen =
        error instanceof TestnetRequestError &&
        error.body?.code === UNKNOWN_ORDER_CODE;
      if (!isNothingOpen) throw error;
    }
  }

  // Horário da Binance; o offset é buscado uma vez para o relógio local não invalidar a assinatura.
  private async serverTimestamp() {
    if (this.clockOffset === undefined) {
      const { serverTime } = await this.request("GET", "time", toQuery({}));
      this.clockOffset = Date.now() - serverTime;
    }
    return Date.now() - this.clockOffset;
  }

  private async signedRequest(method: Method, endpoint: string, params: QueryParams) {
    const query = toQuery({ ...params, timestamp: await this.serverTimestamp() });
    const signature = sign(null, Buffer.from(query.toString()), this.privateKey);
    query.append("signature", signature.toString("base64"));
    return this.request(method, endpoint, query, {
      "X-MBX-APIKEY": this.credentials.apiKey,
    });
  }

  private async request(
    method: Method,
    endpoint: string,
    query: URLSearchParams,
    headers: Record<string, string> = {}
  ) {
    try {
      const { data } = await axios.request({
        method,
        url: `${TESTNET_REST_URL}/${endpoint}?${query}`,
        headers,
        timeout: 10_000,
      });
      return data;
    } catch (error) {
      if (!axios.isAxiosError(error)) throw error;
      throw new TestnetRequestError(endpoint, error.response?.status, error.response?.data);
    }
  }
}

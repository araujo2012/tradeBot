import axios from "axios";
import { redis } from "../lib/redis";
import {
  BASE_URL,
  MAX_LIMIT,
  VALID_INTERVALS,
  VALID_SYMBOLS,
} from "./binance.constants";
import { KlinesResponse } from "./binance.interface";

export interface PriceResponse {
  erro: boolean;
  message?: string;
  price: number;
}

export async function getCurrentPrice(symbol: string): Promise<PriceResponse> {
  if (!VALID_SYMBOLS.includes(symbol.toUpperCase())) {
    return {
      erro: true,
      message: `Symbol inválido: ${symbol}`,
      price: 0,
    };
  }

  // Verificar se o preço está em cache no Redis
  const redisKey = `price-${symbol}`;
  const cachedPrice = await redis.get(redisKey);

  if (cachedPrice) {
    return {
      erro: false,
      price: parseFloat(cachedPrice),
    };
  }

  try {
    const response = await axios.get(`${BASE_URL}ticker/price`, {
      params: { symbol },
    });

    const price = parseFloat(response.data.price);

    // Salvar o preço no Redis por 1 minuto
    await redis.set(redisKey, price.toString(), "EX", 10);

    return {
      erro: false,
      price: price,
    };
  } catch (error: any) {
    return {
      erro: true,
      message: `Erro: ${error.response?.status}, ${JSON.stringify(
        error.response?.data
      )}`,
      price: 0,
    };
  }
}

export async function getKlines(
  symbol: string,
  interval: string,
  limit: number
): Promise<KlinesResponse> {
  if (!VALID_INTERVALS.includes(interval)) {
    return {
      erro: true,
      message: `Intervalo inválido: ${interval}`,
    };
  }

  if (!VALID_SYMBOLS.includes(symbol.toUpperCase())) {
    return {
      erro: true,
      message: `Symbol inválido: ${symbol}`,
    };
  }

  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  try {
    const response = await axios.get(`${BASE_URL}klines`, {
      params: { symbol, interval, limit },
    });

    return {
      erro: false,
      data: response.data,
    };
  } catch (error: any) {
    return {
      erro: true,
      message: `Erro: ${error.response?.status}, ${JSON.stringify(
        error.response?.data
      )}`,
    };
  }
}

import axios from "axios";
import { redis } from "../lib/redis";
import {
  BASE_URL,
  MAX_LIMIT,
  VALID_INTERVALS,
  VALID_SYMBOLS,
  FIXED_FETCH_LIMIT,
} from "./binance.constants";
import { KlinesResponse } from "./binance.interface";

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

  const cacheKey = `klines:${symbol}:${interval}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    const fullData = JSON.parse(cached);
    return {
      erro: false,
      data: fullData.reverse().slice(0, limit),
    };
  }

  try {
    const response = await axios.get(`${BASE_URL}klines`, {
      params: { symbol, interval, limit: FIXED_FETCH_LIMIT },
      timeout: 10_000,
    });

    await redis.set(cacheKey, JSON.stringify(response.data), "EX", 60);

    return {
      erro: false,
      data: response.data.reverse().slice(0, limit),
    };
  } catch (error: any) {
    console.log("getKlines: ", error);
    return {
      erro: true,
      message: `Erro: ${JSON.stringify(error)}`,
    };
  }
}

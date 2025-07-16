import axios from "axios";
import {
  BASE_URL,
  MAX_LIMIT,
  VALID_INTERVALS,
  VALID_SYMBOLS,
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

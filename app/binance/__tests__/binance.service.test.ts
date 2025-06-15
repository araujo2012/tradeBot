import { BinanceService } from "../binance.service";

describe("binance.service", () => {
  const service = new BinanceService();
  describe("getKlines", () => {
    it("deve retornar erro para intervalo inválido", async () => {
      const response = await service.getKlines("BTCBRL", "10m", 10);

      expect(response.erro).toBe(true);
      expect(response.message).toMatch(/Intervalo inválido/);
    });

    it("deve retornar erro para símbolo inválido", async () => {
      const response = await service.getKlines("BTCUSD", "1m", 10);

      expect(response.erro).toBe(true);
      expect(response.message).toMatch(/Symbol inválido/);
    });

    it("deve limitar o número de candles ao MAX_LIMIT", async () => {
      const response = await service.getKlines("BTCBRL", "1m", 50000);

      expect(response.erro).toBe(false);
      expect(response.data).toBeDefined();
    });

    it("deve retornar dados corretos para entrada válida", async () => {
      const response = await service.getKlines("ETHBRL", "1m", 5);

      expect(response.erro).toBe(false);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });
});

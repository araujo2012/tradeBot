import { Request, Response } from "express";
import { UserModel } from "../../models/user";
import { BinanceService } from "./binance.service";
import { startBinanceSocket } from "./binance.socket";

export const startBinanceConnection = async (req: Request, res: Response) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username is required." });
  }

  try {
    const user = await UserModel.findOne({ username });

    if (!user || !user.apiKey || !user.apiSecret) {
      return res
        .status(404)
        .json({ error: "User or API credentials not found." });
    }

    const service = new BinanceService({
      apiKey: user.apiKey,
      apiSecret: user.apiSecret,
    });

    const listenKeyResult = await service.getBinanceListenKey();

    if (listenKeyResult.error) {
      return res.status(500).json({ error: listenKeyResult.message });
    }

    const listenKey = listenKeyResult.data.listenKey;

    try {
      await startBinanceSocket({
        listenKey,
        username,
        apiKey: user.apiKey,
        apiSecret: user.apiSecret,
      });

      return res.status(200).json({ message: "Socket started.", listenKey });
    } catch (socketError: any) {
      return res
        .status(500)
        .json({ error: socketError.message || "WebSocket failed to connect." });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

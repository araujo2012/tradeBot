import { Request, Response } from "express";
import { UserModel } from "../../models/user";
import { getBinanceListenKey } from "./binance.service";
import { startBinanceSocket } from "./binance.socket";
import { SessionModel } from "../../models/session";

export const startBinanceConnection = async (req: Request, res: Response) => {
  const { _id } = req.body;

  if (!_id) {
    return res.status(400).json({ error: "Username is required." });
  }

  try {
    const user = await UserModel.findOne({ _id });

    if (!user || !user.apiKey || !user.apiSecret) {
      return res
        .status(404)
        .json({ error: "User or API credentials not found." });
    }

    const listenKeyResult = await getBinanceListenKey(
      user.apiKey,
      user.apiSecret
    );

    if (listenKeyResult.error) {
      return res.status(500).json({ error: listenKeyResult.message });
    }

    const listenKey = listenKeyResult.data.listenKey;

    // Criar sessão primeiro para obter o sessionId
    const session = await SessionModel.create({
      userId: user._id,
      listenKey,
      apiKey: user.apiKey,
      apiSecret: user.apiSecret,
    });

    const sessionId = (session._id as any).toString();

    await startBinanceSocket({
      listenKey,
      sessionId,
      apiKey: user.apiKey,
      apiSecret: user.apiSecret,
    });

    return res.status(200).json({
      message: "Socket started and session saved.",
      listenKey,
      sessionId,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

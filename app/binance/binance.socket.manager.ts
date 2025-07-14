import { getBinanceSocket } from "./binance.socket";

export function sendToBinance(message: object) {
  const socket = getBinanceSocket();
  if (!socket || socket.readyState !== socket.OPEN) {
    throw new Error("WebSocket não conectado");
  }

  const payload = JSON.stringify(message);
  socket.send(payload);
}

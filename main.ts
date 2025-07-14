import app from "./app";
import { connectToDatabase } from "./app/lib/database";
import { connectToRabbitMQ } from "./app/lib/rabbit";
import { initializeBinanceSocket } from "./app/binance/binance.socket";

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await connectToRabbitMQ();
    await connectToDatabase();
    await initializeBinanceSocket();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start application:", err);
    process.exit(1);
  }
})();

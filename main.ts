import app from "./app";
import { connectToDatabase } from "./app/lib/database";
import { connectToRabbitMQ } from "./app/lib/rabbit";
import { startSocketConsumer } from "./app/socket/socket.consumer";
import { createServer } from "http";
import { initializeWebSocketServer } from "./websocket";
import { bootstrap } from "./app/lib/bootstrap";
import { startPingMonitor } from "./app/socket/socket.main";
import { startAgenda } from "./app/jobs";

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await connectToRabbitMQ();
    await connectToDatabase();
    startSocketConsumer();
    startPingMonitor();
    await bootstrap().catch((err) => {
      console.error("[BOOTSTRAP] Falha ao inicializar sessões ativas:", err);
    });
    startAgenda();
    const server = createServer(app);
    initializeWebSocketServer(server);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start application:", err);
    process.exit(1);
  }
})();

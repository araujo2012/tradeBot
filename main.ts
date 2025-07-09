import app from "./app";
import { connectToDatabase } from "./app/lib/database";
import { connectToRabbitMQ } from "./app/lib/rabbit";
import { bootstrapSessions } from "./app/lib/bootstrap"; // se separou a lógica de sessões

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await connectToRabbitMQ();
    await connectToDatabase();
    await bootstrapSessions();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start application:", err);
    process.exit(1);
  }
})();

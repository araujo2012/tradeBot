import path from "path";
import { config } from "dotenv";

// Valores locais da suíte, como a chave do testnet da Binance; o arquivo fica fora do git.
config({ path: path.resolve(__dirname, "../.env.e2e") });

process.env.MONGO_URI ??=
  "mongodb://araujo:araujo@127.0.0.1:37017/tradebot_e2e?authSource=admin";
process.env.RABBITMQ_URI ??= "amqp://guest:guest@127.0.0.1:37672";
process.env.REDIS_URI ??= "redis://127.0.0.1:37379/15";
process.env.PARTIAL_FILL_GRACE_MS ??= "15000";

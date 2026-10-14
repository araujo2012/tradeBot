process.env.MONGO_URI ??=
  "mongodb://araujo:araujo@127.0.0.1:27018/tradebot_e2e?authSource=admin";
process.env.RABBITMQ_URI ??= "amqp://guest:guest@127.0.0.1:5673";
process.env.REDIS_URI ??= "redis://127.0.0.1:6380/15";
process.env.PARTIAL_FILL_GRACE_MS ??= "15000";

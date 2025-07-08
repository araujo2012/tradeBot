import amqp from "amqplib";
import dotenv from "dotenv";

dotenv.config();

let channel: amqp.Channel;

export async function connectToRabbitMQ() {
  const uri = process.env.RABBITMQ_URI!;
  const conn = await amqp.connect(uri);
  channel = await conn.createChannel();
  console.log("✅ Connected to RabbitMQ");

  return channel;
}

export function getRabbitChannel() {
  if (!channel) throw new Error("RabbitMQ channel not initialized.");
  return channel;
}

import amqp from "amqplib";
import dotenv from "dotenv";
import { RabbitDataModel } from "../../models/rabbitData";

dotenv.config();

let channel: amqp.Channel;

export async function connectToRabbitMQ() {
  const uri = process.env.RABBITMQ_URI!;
  const connection = await amqp.connect(uri);
  channel = await connection.createChannel();

  // Cria a fila 'messages' assim que conectar
  await channel.assertQueue("messages", { durable: true });
  // Cria a fila 'socket' para requisições de socket
  await channel.assertQueue("socket", { durable: true });

  console.log("✅ Connected to RabbitMQ and queue 'messages' is ready");

  return channel;
}

export function getRabbitChannel() {
  if (!channel) throw new Error("RabbitMQ channel not initialized.");
  return channel;
}

export function logAndSendToQueue(queue: string, payload: any) {
  const channel = getRabbitChannel();
  const buffer = Buffer.from(JSON.stringify(payload));
  channel.sendToQueue(queue, buffer, { persistent: true });

  RabbitDataModel.create({
    queue,
    payload,
  });
}

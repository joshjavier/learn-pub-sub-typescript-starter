import type { Channel, ChannelModel, Replies } from "amqplib";
import { assertUnreachable } from "../utils.js";

export type SimpleQueueType = "durable" | "transient";

export type AckType = "Ack" | "NackRequeue" | "NackDiscard";

export async function declareAndBind(
  conn: ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, Replies.AssertQueue]> {
  const channel = await conn.createChannel();
  const queue = await channel.assertQueue(queueName, {
    durable: queueType === "durable",
    autoDelete: queueType === "transient",
    exclusive: queueType === "transient",
  });
  await channel.bindQueue(queue.queue, exchange, key);
  return [channel, queue];
}

export async function subscribeJSON<T>(
  conn: ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => AckType,
): Promise<void> {
  const [channel, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType,
  );
  await channel.consume(queue.queue, (msg) => {
    if (!msg) {
      return;
    }

    let data;
    try {
      data = JSON.parse(msg.content.toString());
    } catch {
      console.error("Error parsing JSON");
      return;
    }

    const ackType = handler(data);
    switch (ackType) {
      case "Ack":
        channel.ack(msg);
        console.log("Acknowledged message delivery.");
        break;
      case "NackRequeue":
        channel.nack(msg, false, true);
        console.log("Rejected message for requeueing.");
        break;
      case "NackDiscard":
        channel.nack(msg, false, false);
        console.log("Rejected message for discarding.");
        break;
      default:
        assertUnreachable(ackType);
    }
  });
}

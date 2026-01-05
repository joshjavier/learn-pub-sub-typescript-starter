import { decode } from "@msgpack/msgpack";
import type { Channel, ChannelModel, Replies } from "amqplib";

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
    deadLetterExchange: "peril_dlx",
  });
  await channel.bindQueue(queue.queue, exchange, key);
  return [channel, queue];
}

export async function subscribe<T>(
  conn: ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  simpleQueueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
  unmarshaller: (data: Buffer) => T,
): Promise<void> {
  const [channel, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    routingKey,
    simpleQueueType,
  );

  await channel.prefetch(10);

  await channel.consume(queue.queue, async (msg) => {
    if (!msg) {
      return;
    }

    let data: T;
    try {
      data = unmarshaller(msg.content);
    } catch (err) {
      console.error("Could not decode message:", err);
      return;
    }

    try {
      const ackType = await handler(data);
      switch (ackType) {
        case "Ack":
          channel.ack(msg);
          console.log("Ack");
          break;
        case "NackRequeue":
          channel.nack(msg, false, true);
          console.log("NackRequeue");
          break;
        case "NackDiscard":
          channel.nack(msg, false, false);
          console.log("NackDiscard");
          break;
        default: {
          const unreachable: never = ackType;
          console.log("Unexpected ack type:", unreachable);
        }
      }
    } catch (err) {
      console.error("Error in handler:", err);
      channel.nack(msg, false, false);
    }
  });
}

export async function subscribeJSON<T>(
  conn: ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  return subscribe(conn, exchange, queueName, key, queueType, handler, (data) =>
    JSON.parse(data.toString()),
  );
}

export async function subscribeMsgPack<T>(
  conn: ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  return subscribe(
    conn,
    exchange,
    queueName,
    key,
    queueType,
    handler,
    (data) => decode(data) as T,
  );
}

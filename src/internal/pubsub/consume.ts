import type { Channel, ChannelModel, Replies } from "amqplib";

export type SimpleQueueType = "durable" | "transient";

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
  handler: (data: T) => void,
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

    handler(data);
    channel.ack(msg);
  });
}

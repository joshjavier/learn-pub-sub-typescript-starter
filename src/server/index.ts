import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";
import { printServerHelp } from "../internal/gamelogic/gamelogic.js";

async function main() {
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  console.log("Peril game server connected to RabbitMQ!");

  ["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, async () => {
      try {
        await conn.close();
        console.log("RabbitMQ connection closed.");
      } catch (err) {
        console.error("Error closing RabbitMQ connection:", err);
      } finally {
        process.exit(0);
      }
    });
  });

  const channel = await conn.createConfirmChannel();

  try {
    const pausedState: PlayingState = { isPaused: true };
    await publishJSON(channel, ExchangePerilDirect, PauseKey, pausedState);
  } catch (err) {
    console.error("Error publishing message:", err);
  }

  printServerHelp();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

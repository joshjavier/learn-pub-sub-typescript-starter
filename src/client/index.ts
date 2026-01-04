import amqp from "amqplib";
import { clientWelcome, getInput } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind } from "../internal/pubsub/consume.js";
import { publishJSON } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";

async function main() {
  const rabbinConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbinConnString);
  console.log("Peril game client connected to RabbitMQ!");

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

  const username = await clientWelcome();
  await declareAndBind(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    "transient",
  );

  const publishChannel = await conn.createConfirmChannel();
  while (true) {
    const words = await getInput();
    if (words.length === 0) {
      continue;
    }

    const command = words[0];
    if (command === "pause") {
      console.log("Sending a pause message...");
      await publishJSON(publishChannel, ExchangePerilDirect, PauseKey, {
        isPaused: true,
      });
    } else if (command === "resume") {
      console.log("Sending a resume message...");
      await publishJSON(publishChannel, ExchangePerilDirect, PauseKey, {
        isPaused: false,
      });
    } else if (command === "quit") {
      console.log("Quitting...");
      break;
    } else {
      console.log("Unknown command:", command);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

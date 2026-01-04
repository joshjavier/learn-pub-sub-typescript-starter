import amqp from "amqplib";
import {
  clientWelcome,
  commandStatus,
  getInput,
  printClientHelp,
  printQuit,
} from "../internal/gamelogic/gamelogic.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { declareAndBind } from "../internal/pubsub/consume.js";
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

  const gs = new GameState(username);

  while (true) {
    const words = await getInput();
    if (words.length === 0) {
      continue;
    }

    const command = words[0];
    switch (command) {
      case "spawn":
        commandSpawn(gs, words);
        break;
      case "move":
        commandMove(gs, words);
        break;
      case "status":
        await commandStatus(gs);
        break;
      case "help":
        printClientHelp();
        break;
      case "spam":
        console.log("Spamming not allowed yet!");
        break;
      case "quit":
        printQuit();
        process.exit(0);
      default:
        console.error("Unknown command:", command);
        continue;
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

import amqp, { type ConfirmChannel } from "amqplib";
import {
  clientWelcome,
  commandStatus,
  getInput,
  getMaliciousLog,
  printClientHelp,
  printQuit,
} from "../internal/gamelogic/gamelogic.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import type { GameLog } from "../internal/gamelogic/logs.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { subscribeJSON } from "../internal/pubsub/consume.js";
import { publishJSON, publishMsgPack } from "../internal/pubsub/publish.js";
import {
  ArmyMovesPrefix,
  ExchangePerilDirect,
  ExchangePerilTopic,
  GameLogSlug,
  PauseKey,
  WarRecognitionsPrefix,
} from "../internal/routing/routing.js";
import { handlerMove, handlerPause, handlerWar } from "./handlers.js";

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
  const gs = new GameState(username);
  const publishChannel = await conn.createConfirmChannel();

  await subscribeJSON(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    "transient",
    handlerPause(gs),
  );

  await subscribeJSON(
    conn,
    ExchangePerilTopic,
    `${ArmyMovesPrefix}.${username}`,
    `${ArmyMovesPrefix}.*`,
    "transient",
    handlerMove(gs, publishChannel),
  );

  await subscribeJSON(
    conn,
    ExchangePerilTopic,
    WarRecognitionsPrefix,
    `${WarRecognitionsPrefix}.*`,
    "durable",
    handlerWar(gs, publishChannel),
  );

  while (true) {
    const words = await getInput();
    if (words.length === 0) {
      continue;
    }

    const command = words[0];
    switch (command) {
      case "spawn":
        try {
          commandSpawn(gs, words);
        } catch (err) {
          console.log((err as Error).message);
        }
        break;
      case "move":
        try {
          await publishJSON(
            publishChannel,
            ExchangePerilTopic,
            `${ArmyMovesPrefix}.${username}`,
            commandMove(gs, words),
          );
          console.log("Move published successfully");
        } catch (err) {
          console.log((err as Error).message);
        }
        break;
      case "status":
        await commandStatus(gs);
        break;
      case "help":
        printClientHelp();
        break;
      case "spam":
        const n = words[1];
        if (!n) {
          console.error("usage: spam <n>");
          continue;
        }

        const loop = parseInt(n, 10);
        for (let i = 0; i < loop; i++) {
          const log = getMaliciousLog();

          try {
            await publishGameLog(publishChannel, username, log);
          } catch (err) {
            console.error("Error publishiing log message:", err);
          }
        }
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

export async function publishGameLog(
  ch: ConfirmChannel,
  username: string,
  message: string,
) {
  const gameLog: GameLog = {
    username,
    message,
    currentTime: new Date(),
  };

  await publishMsgPack(
    ch,
    ExchangePerilTopic,
    `${GameLogSlug}.${username}`,
    gameLog,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

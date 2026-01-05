import { type GameLog, writeLog } from "../internal/gamelogic/logs.js";
import type { AckType } from "../internal/pubsub/consume.js";

export function handlerGameLog(): (gameLog: GameLog) => Promise<AckType> {
  return async (gameLog) => {
    try {
      await writeLog(gameLog);
      return "Ack";
    } catch (err) {
      console.error("Error writing game log to disk:", err);
      return "NackRequeue";
    } finally {
      process.stdout.write("> ");
    }
  };
}

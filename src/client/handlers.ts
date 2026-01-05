import type { ConfirmChannel } from "amqplib";
import type {
  ArmyMove,
  RecognitionOfWar,
} from "../internal/gamelogic/gamedata.js";
import {
  GameState,
  type PlayingState,
} from "../internal/gamelogic/gamestate.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";
import type { AckType } from "../internal/pubsub/consume.js";
import { publishJSON } from "../internal/pubsub/publish.js";
import {
  ExchangePerilTopic,
  WarRecognitionsPrefix,
} from "../internal/routing/routing.js";
import { publishGameLog } from "./index.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  return (ps) => {
    handlePause(gs, ps);
    process.stdout.write("> ");
    return "Ack";
  };
}

export function handlerMove(
  gs: GameState,
  ch: ConfirmChannel,
): (move: ArmyMove) => Promise<AckType> {
  return async (move) => {
    try {
      const moveOutcome = handleMove(gs, move);

      switch (moveOutcome) {
        case MoveOutcome.Safe:
        case MoveOutcome.SamePlayer:
          return "Ack";
        case MoveOutcome.MakeWar: {
          const rw: RecognitionOfWar = {
            attacker: move.player,
            defender: gs.getPlayerSnap(),
          };

          try {
            await publishJSON(
              ch,
              ExchangePerilTopic,
              `${WarRecognitionsPrefix}.${gs.getUsername()}`,
              rw,
            );
            return "Ack";
          } catch (err) {
            console.error("Error publishing war recognition:", err);
            return "NackRequeue";
          }
        }
        default:
          return "NackDiscard";
      }
    } finally {
      process.stdout.write("> ");
    }
  };
}

export function handlerWar(
  gs: GameState,
  ch: ConfirmChannel,
): (rw: RecognitionOfWar) => Promise<AckType> {
  return async (rw) => {
    try {
      const warOutcome = handleWar(gs, rw);

      switch (warOutcome.result) {
        case WarOutcome.NotInvolved:
          return "NackRequeue";
        case WarOutcome.NoUnits:
          return "NackDiscard";
        case WarOutcome.OpponentWon:
        case WarOutcome.YouWon:
          try {
            await publishGameLog(
              ch,
              gs.getUsername(),
              `${warOutcome.winner} won a war against ${warOutcome.loser}`,
            );
            return "Ack";
          } catch (err) {
            console.error("Error publishing game log:", err);
            return "NackRequeue";
          }
        case WarOutcome.Draw:
          try {
            await publishGameLog(
              ch,
              gs.getUsername(),
              `A war between ${warOutcome.attacker} and ${warOutcome.defender} resulted in a draw`,
            );
            return "Ack";
          } catch (err) {
            console.error("Error publishing game log:", err);
            return "NackRequeue";
          }
        default: {
          const unreachable: never = warOutcome;
          console.error("Invalid war outcome:", unreachable);
          return "NackDiscard";
        }
      }
    } finally {
      process.stdout.write("> ");
    }
  };
}

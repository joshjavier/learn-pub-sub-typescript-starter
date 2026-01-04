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
            return "NackRequeue";
          } catch (err) {
            console.error("Error publishing war recognition:", err);
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
        case WarOutcome.Draw:
          return "Ack";
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

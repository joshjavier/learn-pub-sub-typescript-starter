import type { ArmyMove } from "../internal/gamelogic/gamedata.js";
import {
  GameState,
  type PlayingState,
} from "../internal/gamelogic/gamestate.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import type { AckType } from "../internal/pubsub/consume.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  return (ps) => {
    handlePause(gs, ps);
    process.stdout.write("> ");
    return "Ack";
  };
}

export function handlerMove(gs: GameState): (move: ArmyMove) => AckType {
  return (move) => {
    const moveOutcome = handleMove(gs, move);
    process.stdout.write("> ");

    if (
      moveOutcome === MoveOutcome.Safe ||
      moveOutcome === MoveOutcome.MakeWar
    ) {
      return "Ack";
    }

    return "NackDiscard";
  };
}

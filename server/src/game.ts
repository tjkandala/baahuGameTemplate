import { Machine, send } from "xstate";
import WebSocket from "ws";
import { v4 } from "uuid";

export type GameStateSchema = {
  states: {
    lobby: {};
    game: {
      states: {
        playing: {};
        waiting_for_reconnect: {};
      };
    };
  };
};

export interface GameContext {
  /** key is uuid/playerId, value is player object */
  players: Map<string, Player>;
  /** includes sockets of both spectators and players */
  sockets: Set<WebSocket>;
  /** set of playerIds of players that have disconnected during
   * a game. clear it if players decide to move on without them */
  disconnectedPlayers: Set<string>;
}

interface Player {
  hand: string[];
  playedCards: string[];
  playedThisTurn: boolean;
  name: string;
  connected: boolean;
  /** reference the socket here too for targeted events */
  socket: WebSocket;
}

/** game event (before adding socket) */
export type RawGameEvent =
  /** table infrastructure events */
  | { type: "NEW_CONNECTION"; playerId?: string }
  | {
      /** for when a non-player socket closes */
      type: "SPECTATOR_LEFT";
    }
  | {
      type: "ADD_PLAYER";
      /** [id, name] */
      newPlayer: [string, string];
    }
  | {
      /** handle this event differently depending on if populating or playing  */
      type: "PLAYER_LEFT";
      playerId: string;
    }
  | {
      /** somebody clicked "start game" on the client */
      type: "START_GAME";
    }
  | {
      /** somebody clicked "keep playing" on the client */
      type: "RESUME_GAME";
    }
  /** game logic events */
  | { type: "PLAYED_CARD" };

export type GameEvent = RawGameEvent & { socket: WebSocket };

export const gameMachine = Machine<GameContext, GameStateSchema, GameEvent>(
  {
    id: "game",
    initial: "lobby",
    context: {
      players: new Map(),
      sockets: new Set(),
      disconnectedPlayers: new Set(),
    },
    states: {
      lobby: {
        on: {
          NEW_CONNECTION: {
            actions: "handleNewLobbyConnection",
          },
          START_GAME: {
            target: "game",
            actions: "emitGameStarted",
          },
          ADD_PLAYER: {
            actions: "handleNewPlayer",
          },
          PLAYER_LEFT: {
            actions: [],
          },
        },
      },
      game: {
        initial: "playing",
        on: {
          NEW_CONNECTION: {
            actions: "handleNewGameConnection",
          },
        },
        states: {
          playing: {
            on: {
              PLAYER_LEFT: {
                target: "waiting_for_reconnect",
                actions: [],
              },
            },
          },
          waiting_for_reconnect: {
            on: {
              RESUME_GAME: {
                target: "playing",
              },
            },
          },
        },
      },
    },
  },
  {
    actions: {
      handleNewLobbyConnection,
      handleNewGameConnection,
      handleNewPlayer,
      emitGameStarted,
    },
  }
);

function handleNewLobbyConnection(ctx: GameContext, e: GameEvent) {
  /**
   * we know that the state is "lobby"
   *
   * just send list of players in lobby
   */
  if (e.type === "NEW_CONNECTION") {
    const ws = e.socket;
    ctx.sockets.add(ws);

    console.log("connlobb");

    const players = [];

    for (const [id, player] of ctx.players) {
      players.push([id, player.name]);
    }

    emitToWS(
      {
        type: "CONNECTED_LOBBY",
        players,
        playerId: e.playerId ? e.playerId : v4(),
      },
      ws
    );
  }
}

function handleNewGameConnection(ctx: GameContext, e: GameEvent) {
  /**
   * we know that the state is "game"
   *
   * check if they are a missing player or a spectator, then
   * send them the relevant game state
   * */

  if (e.type === "NEW_CONNECTION") {
    const ws = e.socket;
    ctx.sockets.add(ws);

    if (e.playerId && ctx.disconnectedPlayers.has(e.playerId)) {
      // send CONNECTED_PLAYER_SYNC
      emitToWS({ type: "CONNECTED_PLAYER_SYNC" }, ws);
    } else {
      // send CONNECTED_SPEC_SYNC
      emitToWS({ type: "CONNECTED_SPEC_SYNC" }, ws);
    }
  }
}

function handleNewPlayer(ctx: GameContext, e: GameEvent) {
  if (e.type === "ADD_PLAYER") {
    const [id, name] = e.newPlayer;

    ctx.players.set(id, {
      name,
      socket: e.socket,
      hand: [],
      playedCards: [],
      playedThisTurn: false,
      connected: true,
    });

    emitToMultipleWS(
      { type: "PLAYER_ADDED", newPlayer: e.newPlayer },
      ctx.sockets
    );
  }
}

function emitGameStarted(ctx: GameContext) {
  // initialize hand?

  const initialState: {
    players: string[];
  } = {
    players: [],
  };

  emitToMultipleWS(
    { type: "GAME_STARTED", initialState: "initState" },
    ctx.sockets
  );
}

/**
 * UTILS
 */

function emitToMultipleWS(
  event: { type: string; [key: string]: any },
  sockets: Set<WebSocket>
) {
  for (const socket of sockets) {
    emitToWS(event, socket);
  }
}

function emitToWS(
  event: { type: string; [key: string]: any },
  ws: WebSocket
): void {
  ws.send(JSON.stringify(event));
}

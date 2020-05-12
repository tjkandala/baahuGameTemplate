import { b, createMachine, emit, linkTo } from "baahu";
import { http } from "./utils";
import { PlayerView } from "./game/PlayerView";
import { SpectatorView } from "./game/SpectatorView";

/**
 *
 * lifecycle of a room:
 *
 * - validate if the room exists (by HTTP). redirect to home if it doesn't
 * - if it exists, establish a websocket connection. create a simple interface
 * to emit events to the server, similar to the baahu emitter.
 *
 * - on connection, the server will send an event with the current status of
 * the game. if the game has not started yet, render the lobby. if the game has
 * started, the server will send the current state of the game (slightly different
 * object depending on whether the user is a player or spectator)
 *
 *
 */

export const Room = createMachine<
  { gameid: string },
  RoomState,
  any,
  RoomContext
>({
  /** id can be static bc there's no way
   * the room can change from here */
  id: () => `room`,
  initialState: "validating",
  initialContext: ({ gameid }) => ({
    gameid: gameid,
    /** on mount, there is no connection to the ws server.
     * to prevent lots of null/undefined checks once the room
     * is in lobby/playing state, i have provided a mock emitter
     * which will be replaced with the real emitter on connection */
    wsEmitter: () => {},
    ws: null,
    /** default role is player */
    role: "player",
    playerId: "",
    name: "",
    confirmedName: false,
    /** players for preview in lobby. array of tuples [id, name] */
    players: [],
  }),
  // catch-all events (react on all states)
  on: {
    ERROR: {
      target: "error",
    },
  },
  states: {
    validating: {
      onEntry: validateRoomExists,
      on: {
        ROOM_EXISTS: {
          target: "connecting",
        },
      },
    },
    connecting: {
      onEntry: connectToWS,
      on: {
        // server will emit this if the game hasn't started yet
        CONNECTED_LOBBY: {
          target: "lobby",
          effects: handleLobbyConnection,
        },
        // server will emit this if the game has started
        // and the client is a reconnecting player
        CONNECTED_PLAYER_SYNC: {
          target: "playing",
        },
        // server will emit this if the game has started
        // and the client is not a player
        CONNECTED_SPEC_SYNC: {
          target: "playing",
        },
      },
    },
    lobby: {
      on: {
        CHOSE_SPECTATOR: {
          effects: (ctx) => (ctx.role = "spectator"),
        },
        CHOSE_PLAYER: {
          effects: (ctx) => (ctx.role = "player"),
        },
        SET_NAME: {
          effects: (ctx, e) => (ctx.name = e.name),
        },
        SUBMIT_NAME: {
          effects: (ctx) => {
            ctx.wsEmitter({ type: "ADD_PLAYER", newPlayer: ["id", ctx.name] });
            ctx.confirmedName = true;
          },
        },
        PLAYER_ADDED: {
          effects: (ctx, e) => ctx.players.push(e.newPlayer),
        },
        START_GAME: {
          target: "starting_game",
          effects: startGame,
        },
        GAME_STARTED: {
          target: "playing",
          // effects: (ctx, e) => {
          //   if (e.playerSet.has(ctx.name)) {
          //     ctx.role = "player";
          //   } else {
          //     ctx.role = "spectator";
          //   }
          // },
        },
      },
    },
    // this state is only for the client that clicked "start game"
    starting_game: {
      on: {
        GAME_STARTED: {
          target: "playing",
        },
      },
    },
    playing: {},
    error: {},
  },
  render: (state, ctx) => {
    switch (state) {
      case "validating":
      case "connecting":
        return (
          <div>
            <p>connecting to server</p>
          </div>
        );

      case "lobby":
      case "starting_game":
        return (
          <div>
            <h2>{ctx.gameid} lobby</h2>

            <div>
              <h3 key="header">players:</h3>
              {ctx.players.map(([id, name]) => (
                <p key={id}>{name}</p>
              ))}
            </div>

            {ctx.confirmedName ? (
              <p>name confirmed: {ctx.name}</p>
            ) : (
              <div>
                <h3>choose your role</h3>
                <button
                  disabled={ctx.role === "player"}
                  onClick={handleClickPlayer}
                >
                  player
                </button>
                <button
                  disabled={ctx.role === "spectator"}
                  onClick={handleClickSpectator}
                >
                  spectator
                </button>

                {ctx.role === "player" && (
                  <form onSubmit={handleSubmitName}>
                    <input
                      onInput={handleSetName}
                      value={ctx.name}
                      name="nameInput"
                      type="text"
                    />
                    <button type="submit">submit name</button>
                  </form>
                )}
              </div>
            )}

            <button
              disabled={state === "starting_game"}
              onClick={handleClickStartGame}
            >
              start game
            </button>
          </div>
        );

      case "playing":
        switch (ctx.role) {
          case "player":
            return <PlayerView initialState={"hi"} />;

          case "spectator":
            return <SpectatorView />;
        }

      case "error":
        return (
          <div>
            <p>error</p>
          </div>
        );
    }
  },
});

/**
 *
 * ROOM MACHINE FUNCTIONS
 *
 */

/** validates if room exists, redirects to home if it does not */
function validateRoomExists(ctx: RoomContext): void {
  // possibly alert if room is invalid?
  http(`10.0.0.18:3000/${ctx.gameid}`)
    .then((exists) => (exists ? emit({ type: "ROOM_EXISTS" }) : linkTo("/")))
    .catch(() => linkTo("/"));
}

function connectToWS(ctx: RoomContext) {
  const [ws, wsEmitter] = createWSEmitter(ctx.gameid);
  ctx.wsEmitter = wsEmitter;
  ctx.ws = ws;
}

function handleLobbyConnection(ctx: RoomContext, e: any) {
  ctx.players = e.players;
  ctx.playerId = e.playerId;
  // if this player already had an id, it will be the same as before
  localStorage.setItem("playerId", e.playerId);
}

/** tell server to start the game */
function startGame(ctx: RoomContext) {
  ctx.wsEmitter({ type: "START_GAME" });
}

/**
 * BROWSER EVENT HANDLERS
 */

function handleClickPlayer() {
  emit({ type: "CHOSE_PLAYER" }, "room");
}

function handleClickSpectator() {
  emit({ type: "CHOSE_SPECTATOR" }, "room");
}

function handleClickStartGame() {
  emit({ type: "START_GAME" }, "room");
}

function handleSetName(e: JSX.TargetedEvent<HTMLInputElement>) {
  emit({ type: "SET_NAME", name: e.currentTarget.value }, "room");
}

function handleSubmitName(e: JSX.TargetedEvent<HTMLFormElement>) {
  e.preventDefault();
  emit({ type: "SUBMIT_NAME" }, "room");
}

/**
 *
 * TYPES
 *
 */

type RoomState =
  | "validating"
  | "connecting"
  | "lobby"
  | "starting_game"
  | "playing"
  | "error";

interface RoomContext {
  gameid: string;
  /** used to emit events to ws server */
  wsEmitter: WSEmitter;
  ws: WebSocket | null;
  role: "player" | "spectator";
  name: string;
  /** uuid */
  playerId: string;
  confirmedName: boolean;
  /** [id, name][] */
  players: [string, string][];
}

type WSEmitter = (event: { type: string; [key: string]: any }) => void;

/**
 *
 * WEBSOCKET LOGIC
 *
 */

/**
 * establishes a 2-way connection with websocket server
 *
 * after connection is established, emits "ENTER_TABLE" event
 * to server. the server will emit "CONNECTION" to the client.
 *
 * if the user didn't have a playerId before, the "CONNECTION" event
 * will include a uuid generated on the server
 */
function createWSEmitter(roomid: string): [WebSocket, WSEmitter] {
  const socket = new WebSocket("ws://10.0.0.18:8080");
  socket.onmessage = wsEventHandler;

  socket.onerror = (e) => emit({ type: "ERROR", errorEvent: e });

  socket.onopen = () => {
    const playerId = localStorage.getItem("playerId");

    wsEmitter({ type: "NEW_CONNECTION", playerId });
    // send uuid to ws (to prevent generating a new one) if client
    // has one in localstorage already

    // the server should emit the "CONNECTED" event after
    // placing the websocket in a room
  };

  function wsEmitter(event: { type: string; [key: string]: any }): void {
    socket.send(JSON.stringify({ ...event, roomid }));
  }
  return [socket, wsEmitter];
}

/**
 * handles incoming websocket messages as baahu events
 */
function wsEventHandler(e: MessageEvent): void {
  try {
    const event: { type: string } = JSON.parse(e.data);

    if (event.type) {
      console.log(event);
      emit(event);
    }
  } catch (err) {
    console.log(err);
  }
}

import express from "express";
import cors from "cors";
import WebSocket from "ws";
import { v4 } from "uuid";

import {
  gameMachine,
  GameContext,
  GameStateSchema,
  GameEvent,
  RawGameEvent,
} from "./game";
import { interpret, Interpreter } from "xstate";

/** map of active games by roomid */
const rooms = new Map<
  string,
  Interpreter<GameContext, GameStateSchema, GameEvent, any>
>();

const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const event: RawGameEvent & { roomid: string } = JSON.parse(
      message.toString()
    );

    console.log(event);

    const gameService = rooms.get(event.roomid);

    if (gameService) {
      console.log("this game service exists");
      gameService.send({ ...event, socket: ws });
    } else {
      console.log("this game service exists, NOT");
    }
  });
});

const app = express();
const port = 3000;

app.use(cors());

app.get("/", (req, res) => {
  res.send("vaamo" + v4());
});

app.get("/rooms", (req, res) => {
  const roomPreviews = [];
  for (const [roomid, game] of rooms) {
    roomPreviews.push({
      roomid,
      playerCount: game.state.context.players.size,
      // TODO: send current state
    });
  }

  res.json(roomPreviews);
});

app.get("/create/:roomid", (req, res) => {
  if (rooms.has(req.params.roomid)) {
    res.json(false);
  } else {
    const gameService = interpret(gameMachine);
    gameService.start();

    rooms.set(req.params.roomid, gameService);
    res.json(req.params.roomid);
  }
});

/** for client validating existence of table */
app.get("/:roomid", (req, res) => {
  //   const gameService = rooms.get(req.params.roomid);

  //   res.send(gameService ? true : false);

  res.send(rooms.has(req.params.roomid));
});

app.listen(port, () => {
  console.log(`game server (HTTP) listening at http://localhost:${port}`);
});

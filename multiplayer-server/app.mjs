import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { MAX_PLAYERS, PROTOCOL_VERSION, RealmServer } from "./core.mjs";

export function createAshenholdServer(options = {}) {
  const app = express();
  const server = createServer(app);
  const realmServer = options.realmServer || new RealmServer(options);
  const wss = new WebSocketServer({ server, path: options.path || "/ws", maxPayload: 256 * 1024, perMessageDeflate: false });
  app.disable("x-powered-by");
  app.use((_, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/health", (_, response) => response.json({ ok: true, service: "ashenhold-multiplayer", protocol: PROTOCOL_VERSION, rooms: realmServer.rooms.size, maxPlayers: MAX_PLAYERS, now: Date.now() }));
  app.get("/", (_, response) => response.json({ service: "Ashenhold Multiplayer", websocket: "/ws", protocol: PROTOCOL_VERSION }));
  wss.on("connection", (socket) => {
    realmServer.attach(socket);
    socket.on("message", (data) => realmServer.receive(socket, data));
    socket.on("close", () => realmServer.disconnect(socket));
    socket.on("error", () => realmServer.disconnect(socket));
  });
  const interval = setInterval(() => realmServer.tick(), 50);
  interval.unref?.();
  server.on("close", () => clearInterval(interval));
  return { app, server, wss, realmServer };
}

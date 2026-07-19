import { MAX_PLAYERS, PROTOCOL_VERSION } from "../core.mjs";

export default function health(_request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    ok: true,
    service: "ashenhold-multiplayer",
    protocol: PROTOCOL_VERSION,
    maxPlayers: MAX_PLAYERS,
    transport: "websocket",
    now: Date.now()
  });
}

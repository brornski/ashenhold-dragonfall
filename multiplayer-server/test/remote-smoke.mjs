import assert from "node:assert/strict";
import WebSocket from "ws";

const url = process.argv[2] || process.env.ASHENHOLD_WS_URL;
if (!url) throw new Error("Pass a wss:// endpoint as the first argument or ASHENHOLD_WS_URL.");

function createClient() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { handshakeTimeout: 10000 });
    const messages = [];
    const waiters = new Set();
    const client = {
      socket,
      send: (message) => socket.send(JSON.stringify(message)),
      close: () => socket.close(1000, "Remote smoke complete"),
      waitFor(predicate, timeout = 10000) {
        const existing = messages.find(predicate);
        if (existing) return Promise.resolve(existing);
        return new Promise((waitResolve, waitReject) => {
          const waiter = { predicate, resolve: waitResolve, timer: null };
          waiter.timer = setTimeout(() => { waiters.delete(waiter); waitReject(new Error(`Timed out waiting for remote event. Last: ${JSON.stringify(messages.slice(-3))}`)); }, timeout);
          waiters.add(waiter);
        });
      }
    };
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      messages.push(message);
      for (const waiter of [...waiters]) {
        if (!waiter.predicate(message)) continue;
        waiters.delete(waiter); clearTimeout(waiter.timer); waiter.resolve(message);
      }
    });
    socket.once("open", async () => {
      try { await client.waitFor((message) => message.type === "server_ready"); resolve(client); }
      catch (error) { reject(error); }
    });
    socket.once("error", reject);
  });
}

const host = await createClient();
host.send({ type: "hello", protocol: 2, clientId: `remote-host-${Date.now()}`, name: "Remote Host", create: true, biome: "jungle", seed: 555019 });
const hostWelcome = await host.waitFor((message) => message.type === "welcome");
assert.match(hostWelcome.roomCode, /^[A-Z2-9]{6}$/);

const guest = await createClient();
guest.send({ type: "hello", protocol: 2, clientId: `remote-guest-${Date.now()}`, name: "Remote Guest", roomCode: hostWelcome.roomCode });
const guestWelcome = await guest.waitFor((message) => message.type === "welcome");
assert.equal(guestWelcome.roomCode, hostWelcome.roomCode);

host.send({ type: "register_world", world: { strongholds: [], enemies: [], chests: [] } });
await guest.waitFor((message) => message.type === "world_registered" && message.accepted);
host.send({ type: "start_realm" });
const start = await guest.waitFor((message) => message.type === "event" && message.event?.type === "realm_started");
assert.equal(start.event.playerId, hostWelcome.playerId);

host.close();
guest.close();
console.log(JSON.stringify({ ok: true, url, roomCode: hostWelcome.roomCode, players: 2, protocol: hostWelcome.protocol }));

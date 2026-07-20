import assert from "node:assert/strict";
import WebSocket from "ws";

const WORLD_ID = "ashenhold-continent-v1";

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
      terminate: () => socket.terminate(),
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

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const clients = [];
let hostWelcome;
let guestWelcome;

try {
  const host = await createClient(); clients.push(host);
  host.send({ type: "hello", protocol: 2, clientId: `remote-host-${Date.now()}`, name: "Remote Host", create: true, worldId: WORLD_ID });
  hostWelcome = await host.waitFor((message) => message.type === "welcome");
  assert.match(hostWelcome.roomCode, /^[A-Z2-9]{6}$/);
  assert.ok(hostWelcome.reconnectToken?.length >= 40);
  assert.equal(hostWelcome.worldId, WORLD_ID);
  assert.equal("realm" in hostWelcome, false);

  const guest = await createClient(); clients.push(guest);
  guest.send({ type: "hello", protocol: 2, clientId: `remote-guest-${Date.now()}`, name: "Remote Guest", roomCode: hostWelcome.roomCode, worldId: WORLD_ID });
  guestWelcome = await guest.waitFor((message) => message.type === "welcome");
  assert.equal(guestWelcome.roomCode, hostWelcome.roomCode);
  assert.ok(guestWelcome.reconnectToken?.length >= 40);
  assert.equal(guestWelcome.worldId, WORLD_ID);

  host.send({
    type: "register_world",
    world: {
      worldId: WORLD_ID,
      navigation: { cellSize: 5, width: 24, height: 24, originX: -60, originZ: 160, blocked: [] },
      strongholds: [{ id: "remote-shrine", name: "Remote Shrine", kind: "shrine", x: 0, z: 207 }],
      enemies: [{
        id: "remote-guard", name: "Remote Guard", kind: "biomeLight", x: 0, y: 0, z: 207,
        rotation: Math.PI, health: 50, maxHealth: 50, damage: 1, sight: 12,
        strongholdId: "remote-shrine", role: "guard"
      }],
      chests: [{ id: "remote-chest", x: 0, y: 0, z: 210, powerUp: { type: "sprint", amount: 2 } }]
    }
  });
  await guest.waitFor((message) => message.type === "world_registered" && message.accepted);
  host.send({ type: "start_realm" });
  const start = await guest.waitFor((message) => message.type === "event" && message.event?.type === "realm_started");
  assert.equal(start.event.playerId, hostWelcome.playerId);

  const playerState = (x, y, z) => ({
    x, y, z, rotation: 0, health: 100, maxHealth: 100, stamina: 100, weapon: "blade",
    moving: false, sprinting: false, superSprinting: false, sliding: false,
    airborne: false, attacking: false, companionCount: 0, noise: 0
  });
  host.send({ type: "player_state", state: playerState(1.25, 0, 209) });
  guest.send({ type: "player_state", state: playerState(-1.5, 0, 209.5) });
  await host.waitFor((message) => message.type === "state" && message.snapshot.players.some((player) => player.id === guestWelcome.playerId && player.healthInitialized));

  host.send({ type: "attack", targetId: "remote-guard", weapon: "blade", damage: 20, actionId: "remote-hit-1" });
  const damaged = await guest.waitFor((message) => message.type === "event" && message.event?.type === "enemy_damage" && message.event.enemyId === "remote-guard" && message.event.health === 30);
  assert.equal(damaged.event.dead, false);
  await delay(330);
  host.send({ type: "attack", targetId: "remote-guard", weapon: "blade", damage: 100, actionId: "remote-hit-2" });
  const defeated = await guest.waitFor((message) => message.type === "event" && message.event?.type === "enemy_damage" && message.event.enemyId === "remote-guard" && message.event.dead);
  assert.equal(defeated.event.health, 0);
  const secured = await guest.waitFor((message) => message.type === "event" && message.event?.type === "stronghold_cleared" && message.event.strongholdId === "remote-shrine");
  assert.equal(secured.event.flagRaised, true);

  await delay(50);
  guest.send({ type: "player_state", state: playerState(0, -3.5, 210) });
  guest.send({ type: "open_chest", chestId: "remote-chest" });
  const underfloor = await guest.waitFor((message) => message.type === "error" && message.code === "CHEST_RANGE");
  assert.match(underfloor.message, /same level/i);
  await delay(50);
  guest.send({ type: "player_state", state: playerState(0, 0, 210) });
  guest.send({ type: "open_chest", chestId: "remote-chest" });
  const claimed = await guest.waitFor((message) => message.type === "event" && message.event?.type === "chest_opened" && message.event.chestId === "remote-chest");
  assert.equal(claimed.event.playerId, guestWelcome.playerId);

  guest.terminate();
  await host.waitFor((message) => message.type === "presence" && message.player?.id === guestWelcome.playerId && !message.player.connected);
  const replacement = await createClient(); clients.push(replacement);
  replacement.send({
    type: "hello", protocol: 2, clientId: `remote-guest-return-${Date.now()}`, name: "Remote Guest",
    roomCode: hostWelcome.roomCode, playerId: guestWelcome.playerId, reconnectToken: guestWelcome.reconnectToken
  });
  const restored = await replacement.waitFor((message) => message.type === "welcome");
  assert.equal(restored.playerId, guestWelcome.playerId);
  assert.equal(restored.snapshot.players.filter((player) => player.connected).length, 2);

  console.log(JSON.stringify({
    ok: true, url, roomCode: hostWelcome.roomCode, players: 2, protocol: hostWelcome.protocol,
    combat: true, stronghold: true, underfloorChest: true, personalChest: true, reconnect: true
  }));
} finally {
  for (const client of clients) {
    try { client.close(); } catch { /* best-effort cleanup */ }
  }
}

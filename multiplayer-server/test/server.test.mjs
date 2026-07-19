import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import WebSocket from "ws";
import { createAshenholdServer } from "../app.mjs";

let instance;
let websocketUrl;
const openClients = new Set();

class TestClient {
  constructor(socket) {
    this.socket = socket;
    this.messages = [];
    this.waiters = new Set();
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      this.messages.push(message);
      for (const waiter of [...this.waiters]) {
        if (!waiter.predicate(message)) continue;
        this.waiters.delete(waiter);
        clearTimeout(waiter.timer);
        waiter.resolve(message);
      }
    });
  }

  send(message) {
    this.socket.send(JSON.stringify(message));
  }

  waitFor(predicate, timeout = 2500) {
    const existing = this.messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timer: null };
      waiter.timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new Error(`Timed out waiting for message. Last messages: ${JSON.stringify(this.messages.slice(-4))}`));
      }, timeout);
      this.waiters.add(waiter);
    });
  }

  close() {
    openClients.delete(this);
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) this.socket.close();
  }
}

async function connect() {
  const socket = new WebSocket(websocketUrl);
  const client = new TestClient(socket);
  openClients.add(client);
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  await client.waitFor((message) => message.type === "server_ready");
  return client;
}

function hello(client, options = {}) {
  client.send({
    type: "hello",
    protocol: 1,
    clientId: options.clientId || crypto.randomUUID(),
    name: options.name || "Test Warden",
    create: Boolean(options.create),
    roomCode: options.roomCode,
    biome: options.biome || "jungle",
    seed: options.seed || 55119
  });
  return client.waitFor((message) => message.type === "welcome" || message.type === "error");
}

function eventNamed(name) {
  return (message) => message.type === "event" && message.event?.type === name;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

before(async () => {
  instance = createAshenholdServer();
  await new Promise((resolve, reject) => {
    instance.server.once("error", reject);
    instance.server.listen(0, "127.0.0.1", resolve);
  });
  const address = instance.server.address();
  websocketUrl = `ws://127.0.0.1:${address.port}/ws`;
});

after(async () => {
  for (const client of openClients) client.close();
  for (const socket of instance.wss.clients) socket.terminate();
  await new Promise((resolve) => instance.server.close(resolve));
});

test("health endpoint advertises the room service", async () => {
  const httpUrl = websocketUrl.replace("ws://", "http://").replace(/\/ws$/, "/health");
  const response = await fetch(httpUrl);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual({ ok: body.ok, service: body.service, protocol: body.protocol, maxPlayers: body.maxPlayers }, {
    ok: true,
    service: "ashenhold-multiplayer",
    protocol: 1,
    maxPlayers: 4
  });
});

test("two Wardens share an authoritative realm, garrison, chest, and reconnect state", async () => {
  const host = await connect();
  const hostWelcome = await hello(host, { create: true, clientId: "host-browser-tab", name: "Host Warden", biome: "volcanic", seed: 90210 });
  assert.equal(hostWelcome.type, "welcome");
  assert.match(hostWelcome.roomCode, /^[A-Z2-9]{6}$/);
  assert.deepEqual(hostWelcome.realm, { biome: "volcanic", seed: 90210 });

  const guest = await connect();
  const guestWelcome = await hello(guest, { roomCode: hostWelcome.roomCode, clientId: "guest-browser-tab", name: "Guest Warden" });
  assert.equal(guestWelcome.type, "welcome");
  await host.waitFor((message) => message.type === "presence" && message.player?.id === "guest-browser-tab");

  host.send({
    type: "register_world",
    world: {
      navigation: { cellSize: 5, width: 24, height: 24, originX: -60, originZ: 160, blocked: [] },
      strongholds: [{ id: "shrine-ember", name: "Ember Shrine", kind: "shrine", x: 0, z: 207 }],
      enemies: [
        { id: "shrine-guard", name: "Shrine Guard", kind: "biomeLight", x: 0, y: 0, z: 207, rotation: Math.PI, health: 20, maxHealth: 20, damage: 3, strongholdId: "shrine-ember", role: "guard" },
        { id: "outer-sentry", name: "Outer Sentry", kind: "biomeHeavy", x: 8, y: 0, z: 215, rotation: 1.02, health: 90, maxHealth: 90, damage: 2, role: "sentry", patrol: [{ x: 8, z: 215 }, { x: 12, z: 218 }] }
      ],
      chests: [{ id: "shrine-chest", x: 0, y: 0, z: 210, powerUp: { type: "sprint", amount: 3 } }]
    }
  });
  const registered = await guest.waitFor((message) => message.type === "world_registered" && message.accepted);
  assert.equal(registered.snapshot.enemies.length, 2);
  assert.equal(registered.snapshot.strongholds[0].cleared, false);

  guest.send({ type: "start_realm" });
  await guest.waitFor((message) => message.type === "error" && message.code === "HOST_ONLY");
  host.send({ type: "start_realm" });
  const realmStarted = await guest.waitFor(eventNamed("realm_started"));
  assert.equal(realmStarted.event.playerId, "host-browser-tab");

  host.send({ type: "attack", targetId: "shrine-guard", weapon: "blade", damage: 40, critical: false });
  const damageEvent = await guest.waitFor(eventNamed("enemy_damage"));
  assert.equal(damageEvent.event.dead, true);
  const clearEvent = await guest.waitFor(eventNamed("stronghold_cleared"));
  assert.deepEqual({ id: clearEvent.event.strongholdId, flagRaised: clearEvent.event.flagRaised }, { id: "shrine-ember", flagRaised: true });

  guest.send({ type: "player_state", state: { x: 0, y: -3.5, z: 215, rotation: 0, health: 100, maxHealth: 100, stamina: 100, weapon: "blade" } });
  await delay(45);
  guest.send({ type: "open_chest", chestId: "shrine-chest" });
  const rejectedChest = await guest.waitFor((message) => message.type === "error" && message.code === "CHEST_RANGE");
  assert.match(rejectedChest.message, /same level/i);

  guest.send({ type: "player_state", state: { x: 0, y: 0, z: 210, rotation: 0, health: 100, maxHealth: 100, stamina: 100, weapon: "blade" } });
  await delay(45);
  guest.send({ type: "open_chest", chestId: "shrine-chest" });
  const guestReward = await guest.waitFor((message) => eventNamed("chest_opened")(message) && message.event.playerId === "guest-browser-tab");
  assert.deepEqual(guestReward.event.powerUp, { type: "sprint", amount: 3 });

  host.send({ type: "open_chest", chestId: "shrine-chest" });
  const hostReward = await host.waitFor((message) => eventNamed("chest_opened")(message) && message.event.playerId === "host-browser-tab");
  assert.equal(hostReward.event.powerUp.amount, 3, "each Warden receives a personal permanent reward");
  host.send({ type: "open_chest", chestId: "shrine-chest" });
  await host.waitFor((message) => message.type === "error" && message.code === "CHEST_CLAIMED");

  const alertedState = await host.waitFor((message) => message.type === "state" && message.snapshot.enemies.some((enemy) => enemy.id === "outer-sentry" && ["suspicious", "combat"].includes(enemy.state)), 3000);
  assert.ok(alertedState.snapshot.enemies.find((enemy) => enemy.id === "outer-sentry").alert >= 0);

  guest.close();
  await delay(30);
  const replacement = await connect();
  const reconnectWelcome = await hello(replacement, { roomCode: hostWelcome.roomCode, clientId: "guest-browser-tab", name: "Guest Returned" });
  assert.equal(reconnectWelcome.playerId, "guest-browser-tab");
  assert.equal(reconnectWelcome.started, true);
  const restored = reconnectWelcome.snapshot.players.find((player) => player.id === "guest-browser-tab");
  assert.equal(restored.name, "Guest Returned");
  assert.equal(restored.connected, true);
  replacement.close();
  host.close();
});

test("rooms enforce the four-Warden ceiling", async () => {
  const clients = [];
  try {
    const host = await connect();
    clients.push(host);
    const welcome = await hello(host, { create: true, clientId: "capacity-1" });
    for (let index = 2; index <= 4; index += 1) {
      const client = await connect();
      clients.push(client);
      const joined = await hello(client, { roomCode: welcome.roomCode, clientId: `capacity-${index}` });
      assert.equal(joined.type, "welcome");
    }
    const overflow = await connect();
    clients.push(overflow);
    const rejected = await hello(overflow, { roomCode: welcome.roomCode, clientId: "capacity-5" });
    assert.deepEqual({ type: rejected.type, code: rejected.code }, { type: "error", code: "ROOM_FULL" });
  } finally {
    for (const client of clients) client.close();
  }
});

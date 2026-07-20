import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import WebSocket from "ws";
import { createAshenholdServer } from "../create-server.mjs";
import { RealmServer, WORLD_ID } from "../core.mjs";

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

  close(code, reason) {
    openClients.delete(this);
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) this.socket.close(code, reason);
  }

  terminate() {
    openClients.delete(this);
    this.socket.terminate();
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
    protocol: 2,
    playerId: options.playerId,
    reconnectToken: options.reconnectToken,
    name: options.name || "Test Warden",
    create: Boolean(options.create),
    roomCode: options.roomCode,
    worldId: options.worldId || WORLD_ID,
    ...(options.biome ? { biome: options.biome } : {}),
    ...(options.seed ? { seed: options.seed } : {})
  });
  return client.waitFor((message) => message.type === "welcome" || message.type === "error");
}

function eventNamed(name) {
  return (message) => message.type === "event" && message.event?.type === name;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

class MemorySocket {
  constructor() {
    this.readyState = 1;
    this.messages = [];
  }

  send(raw) {
    this.messages.push(JSON.parse(raw));
  }

  close() {
    this.readyState = 3;
  }

  find(predicate) {
    return [...this.messages].reverse().find(predicate);
  }
}

function memoryHello(realm, socket, options = {}) {
  realm.attach(socket);
  realm.receive(socket, JSON.stringify({
    type: "hello", protocol: 2, create: Boolean(options.create), roomCode: options.roomCode,
    playerId: options.playerId, reconnectToken: options.reconnectToken,
    name: options.name || "Memory Warden", worldId: WORLD_ID
  }));
  return socket.find((message) => message.type === "welcome" || message.type === "error");
}

function memorySend(realm, socket, event) {
  return realm.receive(socket, JSON.stringify(event));
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
    protocol: 2,
    maxPlayers: 4
  });
});

test("world registration enforces the fixed identity while accepting legacy envelopes", () => {
  const realm = new RealmServer({ randomCode: () => "WORLDX" });
  const host = new MemorySocket();
  const welcome = memoryHello(realm, host, { create: true, name: "World Host" });
  memorySend(realm, host, { type: "register_world", world: { worldId: "another-continent" } });
  assert.equal(host.find((message) => message.type === "error")?.code, "WORLD_MISMATCH");
  assert.equal(realm.rooms.get(welcome.roomCode).worldReady, false);

  memorySend(realm, host, { type: "register_world", world: { strongholds: [], enemies: [], chests: [] } });
  assert.equal(host.find((message) => message.type === "world_registered")?.accepted, true,
    "protocol-2 clients without a worldId remain compatible with the one fixed continent");
  assert.equal(realm.rooms.get(welcome.roomCode).worldId, WORLD_ID);
});

test("two Wardens share the fixed authoritative world, garrison, chest, and reconnect state", async () => {
  const host = await connect();
  const hostWelcome = await hello(host, {
    create: true, name: "Host Warden", worldId: "client-requested-world", biome: "volcanic", seed: 90210
  });
  assert.equal(hostWelcome.type, "welcome");
  assert.match(hostWelcome.playerId, /^[0-9a-f-]{36}$/i);
  assert.ok(hostWelcome.reconnectToken.length >= 40);
  assert.match(hostWelcome.roomCode, /^[A-Z2-9]{6}$/);
  assert.equal(hostWelcome.worldId, WORLD_ID);
  assert.equal("realm" in hostWelcome, false, "fixed-world handshakes do not publish legacy realm metadata");
  assert.equal("seed" in hostWelcome, false, "fixed-world handshakes never publish a generated seed");
  const hostColor = hostWelcome.snapshot.players.find((player) => player.id === hostWelcome.playerId).color;
  host.send({ type: "hello", protocol: 2, create: true, name: "Duplicate Host" });
  await host.waitFor((message) => message.type === "error" && message.code === "ALREADY_JOINED");

  const guest = await connect();
  const guestWelcome = await hello(guest, { roomCode: hostWelcome.roomCode, name: "Guest Warden" });
  assert.equal(guestWelcome.type, "welcome");
  assert.equal(guestWelcome.worldId, WORLD_ID);
  assert.equal(guestWelcome.snapshot.worldId, WORLD_ID);
  const guestColor = guestWelcome.snapshot.players.find((player) => player.id === guestWelcome.playerId).color;
  assert.notEqual(guestColor, hostColor, "each concurrent Warden receives a distinct accent color");
  await host.waitFor((message) => message.type === "presence" && message.player?.id === guestWelcome.playerId);

  host.send({
    type: "register_world",
    world: {
      worldId: WORLD_ID,
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
  assert.equal(JSON.stringify(registered.snapshot).includes(hostWelcome.reconnectToken), false);
  assert.equal(JSON.stringify(registered.snapshot).includes(guestWelcome.reconnectToken), false);

  guest.send({ type: "start_realm" });
  await guest.waitFor((message) => message.type === "error" && message.code === "HOST_ONLY");
  host.send({ type: "start_realm" });
  const realmStarted = await guest.waitFor(eventNamed("realm_started"));
  assert.equal(realmStarted.event.playerId, hostWelcome.playerId);

  host.send({
    type: "register_enemy",
    enemy: { id: "dragon-boss-vharok", name: "Vharok", kind: "dragon", boss: true, x: 48, y: 42, z: 248, health: 520, maxHealth: 520, speed: 15, range: 45, damage: 30, sight: 100 }
  });
  const lateBoss = await guest.waitFor((message) => message.type === "enemy_registered" && message.accepted && message.enemyId === "dragon-boss-vharok");
  const registeredBoss = lateBoss.snapshot.enemies.find((enemy) => enemy.id === "dragon-boss-vharok");
  assert.deepEqual({ boss: registeredBoss.boss, health: registeredBoss.health, damage: registeredBoss.damage }, { boss: true, health: 520, damage: 30 });
  host.send({ type: "register_enemy", enemy: { id: "dragon-boss-vharok", kind: "dragon", boss: true, x: 0, z: 0, health: 1 } });
  const duplicateBoss = await host.waitFor((message) => message.type === "enemy_registered" && !message.accepted && message.enemyId === "dragon-boss-vharok");
  assert.equal(duplicateBoss.reason, "already_registered");
  host.send({ type: "attack", targetId: "dragon-boss-vharok", weapon: "bow", damage: 1, critical: false });
  const aerialDamage = await host.waitFor((message) => eventNamed("enemy_damage")(message) && message.event.enemyId === "dragon-boss-vharok");
  assert.equal(aerialDamage.event.health, 519, "ranged attacks can reach an airborne co-op dragon");

  host.send({ type: "attack", targetId: "shrine-guard", weapon: "blade", damage: 40, critical: false });
  const damageEvent = await guest.waitFor((message) => eventNamed("enemy_damage")(message) && message.event.enemyId === "shrine-guard");
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
  const guestReward = await guest.waitFor((message) => eventNamed("chest_opened")(message) && message.event.playerId === guestWelcome.playerId);
  assert.deepEqual(guestReward.event.powerUp, { type: "sprint", amount: 3 });

  host.send({ type: "open_chest", chestId: "shrine-chest" });
  const hostReward = await host.waitFor((message) => eventNamed("chest_opened")(message) && message.event.playerId === hostWelcome.playerId);
  assert.equal(hostReward.event.powerUp.amount, 3, "each Warden receives a personal permanent reward");
  host.send({ type: "open_chest", chestId: "shrine-chest" });
  await host.waitFor((message) => message.type === "error" && message.code === "CHEST_CLAIMED");

  const alertedState = await host.waitFor((message) => message.type === "state" && message.snapshot.enemies.some((enemy) => enemy.id === "outer-sentry" && ["suspicious", "combat"].includes(enemy.state)), 3000);
  assert.ok(alertedState.snapshot.enemies.find((enemy) => enemy.id === "outer-sentry").alert >= 0);

  guest.close();
  await delay(30);
  const replacement = await connect();
  const reconnectWelcome = await hello(replacement, {
    roomCode: hostWelcome.roomCode, playerId: guestWelcome.playerId,
    reconnectToken: guestWelcome.reconnectToken, name: "Guest Returned"
  });
  assert.equal(reconnectWelcome.playerId, guestWelcome.playerId);
  assert.equal(reconnectWelcome.started, true);
  const restored = reconnectWelcome.snapshot.players.find((player) => player.id === guestWelcome.playerId);
  assert.equal(restored.name, "Guest Returned");
  assert.equal(restored.connected, true);
  assert.equal(restored.color, guestColor, "a reconnect preserves the Warden's accent color");
  replacement.close();
  host.close();
});

test("rooms enforce the four-Warden ceiling", async () => {
  const clients = [];
  try {
    const host = await connect();
    clients.push(host);
    const welcome = await hello(host, { create: true });
    const colors = [welcome.snapshot.players.find((player) => player.id === welcome.playerId).color];
    for (let index = 2; index <= 4; index += 1) {
      const client = await connect();
      clients.push(client);
      const joined = await hello(client, { roomCode: welcome.roomCode });
      assert.equal(joined.type, "welcome");
      colors.push(joined.snapshot.players.find((player) => player.id === joined.playerId).color);
    }
    assert.equal(new Set(colors).size, 4, "all four concurrent Wardens receive distinct accent colors");
    const overflow = await connect();
    clients.push(overflow);
    const rejected = await hello(overflow, { roomCode: welcome.roomCode });
    assert.deepEqual({ type: rejected.type, code: rejected.code }, { type: "error", code: "ROOM_FULL" });
  } finally {
    for (const client of clients) client.close();
  }
});

test("private reconnect credentials resist takeover and preserve host succession", async () => {
  const clients = [];
  try {
    const host = await connect(); clients.push(host);
    const hostWelcome = await hello(host, { create: true, name: "Credential Host" });
    const guest = await connect(); clients.push(guest);
    const guestWelcome = await hello(guest, { roomCode: hostWelcome.roomCode, name: "Successor" });

    const missing = await connect(); clients.push(missing);
    const missingResult = await hello(missing, { roomCode: hostWelcome.roomCode, playerId: hostWelcome.playerId });
    assert.deepEqual({ type: missingResult.type, code: missingResult.code }, { type: "error", code: "IDENTITY_REJECTED" });

    const wrong = await connect(); clients.push(wrong);
    const wrongResult = await hello(wrong, { roomCode: hostWelcome.roomCode, playerId: hostWelcome.playerId, reconnectToken: "wrong-token" });
    assert.deepEqual({ type: wrongResult.type, code: wrongResult.code }, { type: "error", code: "IDENTITY_REJECTED" });
    host.send({ type: "ping", sentAt: 7734 });
    assert.equal((await host.waitFor((message) => message.type === "pong" && message.sentAt === 7734)).sentAt, 7734,
      "failed takeover attempts leave the victim connected");

    host.terminate();
    await guest.waitFor((message) => eventNamed("host_changed")(message) && message.event.playerId === guestWelcome.playerId);
    const replacement = await connect(); clients.push(replacement);
    const restored = await hello(replacement, {
      roomCode: hostWelcome.roomCode, playerId: hostWelcome.playerId,
      reconnectToken: hostWelcome.reconnectToken, name: "Credential Host Returned"
    });
    assert.equal(restored.type, "welcome");
    assert.equal(restored.playerId, hostWelcome.playerId);
    assert.equal(restored.isHost, false, "the connected successor retains host authority");
    assert.equal(restored.snapshot.hostId, guestWelcome.playerId);
    assert.equal(JSON.stringify(restored.snapshot).includes(hostWelcome.reconnectToken), false);
    assert.equal(JSON.stringify(restored.snapshot).includes(guestWelcome.reconnectToken), false);
  } finally {
    for (const client of clients) client.close();
  }
});

test("disconnected identities reserve a room slot during reconnect grace", async () => {
  const clients = [];
  try {
    const host = await connect(); clients.push(host);
    const hostWelcome = await hello(host, { create: true });
    const joined = [];
    for (let index = 0; index < 3; index += 1) {
      const client = await connect(); clients.push(client);
      joined.push({ client, welcome: await hello(client, { roomCode: hostWelcome.roomCode }) });
    }
    const departing = joined[2];
    departing.client.terminate();
    await host.waitFor((message) => message.type === "presence" && message.player?.id === departing.welcome.playerId && !message.player.connected);

    const newcomer = await connect(); clients.push(newcomer);
    const rejected = await hello(newcomer, { roomCode: hostWelcome.roomCode });
    assert.deepEqual({ type: rejected.type, code: rejected.code }, { type: "error", code: "ROOM_FULL" });

    const replacement = await connect(); clients.push(replacement);
    const restored = await hello(replacement, {
      roomCode: hostWelcome.roomCode, playerId: departing.welcome.playerId,
      reconnectToken: departing.welcome.reconnectToken
    });
    assert.equal(restored.type, "welcome");
    assert.equal(restored.playerId, departing.welcome.playerId);
    assert.equal(restored.snapshot.players.filter((player) => player.connected).length, 4);
  } finally {
    for (const client of clients) client.close();
  }
});

test("max health growth is allowance-bound and a fallen host yields boss authority", () => {
  let now = 1000;
  const realm = new RealmServer({ now: () => now, randomCode: () => "HEALTH" });
  const host = new MemorySocket();
  const hostWelcome = memoryHello(realm, host, { create: true, name: "Health Host" });
  const guest = new MemorySocket();
  const guestWelcome = memoryHello(realm, guest, { roomCode: hostWelcome.roomCode, name: "Living Guest" });
  memorySend(realm, host, {
    type: "register_world",
    world: {
      navigation: { cellSize: 5, width: 8, height: 8, originX: -20, originZ: 190, blockedRuns: [6, 2] },
      strongholds: [], enemies: [],
      chests: [{ id: "health-chest", x: 0, y: 0, z: 210, powerUp: { type: "health", amount: 3 } }]
    }
  });
  memorySend(realm, host, { type: "start_realm" });
  now += 40;
  memorySend(realm, host, { type: "player_state", state: { x: 0, y: 0, z: 210, health: 100, maxHealth: 100 } });
  memorySend(realm, guest, { type: "player_state", state: { x: 0, y: 0, z: 210, health: 100, maxHealth: 100 } });
  const room = realm.rooms.get(hostWelcome.roomCode);
  assert.equal(room.navigation.blocked.size, 2, "RLE navigation cells are decoded server-side");
  memorySend(realm, host, { type: "open_chest", chestId: "health-chest" });
  now += 40;
  memorySend(realm, host, { type: "player_state", state: { x: 0, y: 0, z: 210, health: 5000, maxHealth: 5000 } });
  const hostPlayer = room.players.get(hostWelcome.playerId);
  assert.equal(hostPlayer.maxHealth, 105, "the health relic grants only its bounded maximum-growth allowance");
  for (let index = 0; index < 20; index += 1) {
    now += 40;
    memorySend(realm, host, { type: "player_state", state: { x: 0, y: 0, z: 210, health: 5000, maxHealth: 5000 } });
  }
  assert.equal(hostPlayer.maxHealth, 105, "rapid max-health reports cannot ratchet the cap upward");

  for (const [source, amount] of [["level", 4], ["vitality", 12], ["bastion", 10], ["run_vigor", 15]]) {
    memorySend(realm, host, { type: "max_health_upgrade", source });
    now += 40;
    memorySend(realm, host, {
      type: "player_state",
      state: { x: 0, y: 0, z: 210, health: hostPlayer.maxHealth + amount, maxHealth: hostPlayer.maxHealth + amount }
    });
  }
  assert.equal(hostPlayer.maxHealth, 146, "level and all three health nodes receive bounded progression growth");
  memorySend(realm, host, { type: "max_health_upgrade", source: "level", amount: 24 });
  now += 40;
  memorySend(realm, host, { type: "player_state", state: { x: 0, y: 0, z: 210, health: 170, maxHealth: 170 } });
  assert.equal(hostPlayer.maxHealth, 170, "health progression preserves the supported relic multiplier");

  now += 40;
  memorySend(realm, host, { type: "player_state", state: { x: 0, y: 0, z: 210, health: 0, maxHealth: 5000 } });
  assert.equal(room.hostId, guestWelcome.playerId, "an alive connected Warden succeeds a fallen host");
  now += 40;
  memorySend(realm, host, { type: "player_state", state: { x: 0, y: 0, z: 210, health: 105, maxHealth: 105 } });
  assert.equal(hostPlayer.health, 0, "player-state reports cannot self-revive a fallen Warden");
  memorySend(realm, guest, {
    type: "register_enemy",
    enemy: { id: "dragon-boss-vharok", name: "Vharok", kind: "dragon", boss: true, x: 20, y: 40, z: 220, health: 520, maxHealth: 520 }
  });
  assert.equal(room.enemies.get("dragon-boss-vharok")?.boss, true, "the successor can register the late boss");
});

test("authoritative status effects are bounded, tick, slow movement, and expire", () => {
  let now = 1000;
  const realm = new RealmServer({ now: () => now, randomCode: () => "STATUS" });
  const host = new MemorySocket();
  const welcome = memoryHello(realm, host, { create: true });
  memorySend(realm, host, {
    type: "register_world",
    world: {
      navigation: { cellSize: 5, width: 20, height: 20, originX: -40, originZ: 170, blockedRuns: [] },
      strongholds: [], chests: [],
      enemies: [{ id: "status-guard", kind: "biomeLight", name: "Status Guard", x: 0, y: 0, z: 210,
        health: 100, maxHealth: 100, speed: 10, range: 1, damage: 2, sight: 100, state: "combat", tameable: true, tameProgress: 70 }]
    }
  });
  memorySend(realm, host, { type: "start_realm" });
  now += 40;
  memorySend(realm, host, { type: "player_state", state: { x: 6, y: 0, z: 210, health: 100, maxHealth: 100, weapon: "staff" } });
  const room = realm.rooms.get(welcome.roomCode);
  const enemy = room.enemies.get("status-guard");
  memorySend(realm, host, {
    type: "attack", actionId: "staff-one", targetId: enemy.id, weapon: "staff", damage: 1,
    critical: false, effects: { tameProgress: 9999, slowMs: 999999 }
  });
  assert.equal(enemy.tameProgress, 100);
  assert.equal(enemy.slowUntil, now + 2050);
  const beforeSlowMove = enemy.x;
  now += 100;
  realm.tick(now);
  const slowMove = enemy.x - beforeSlowMove;
  assert.ok(slowMove > .8 && slowMove < .9, `expected a 62% movement step, received ${slowMove}`);

  memorySend(realm, host, {
    type: "attack", actionId: "blade-one", targetId: enemy.id, weapon: "blade", damage: 10,
    effects: { bleedDamage: 999999 }
  });
  assert.equal(enemy.bleedDamage, 2, "bleed is capped from the accepted hit amount");
  const afterBlade = enemy.health;
  now += 1000;
  realm.tick(now);
  assert.equal(enemy.health, afterBlade - 2, "server time applies the bounded bleed tick");
  const beforeFastMove = enemy.x;
  now = enemy.slowUntil + 50;
  realm.tick(now);
  assert.ok(enemy.x - beforeFastMove > slowMove * 2, "movement returns to full speed after slow expiry");
  const beforeReusedAction = enemy.health;
  memorySend(realm, host, {
    type: "attack", actionId: "staff-one", targetId: enemy.id, weapon: "staff", damage: 1,
    effects: { tameProgress: 0, slowMs: 0 }
  });
  assert.equal(enemy.health, beforeReusedAction - 1, "an expired pre-reconnect action id cannot poison a new page session");
  memorySend(realm, host, { type: "tame", enemyId: enemy.id });
  assert.equal(enemy.tamedBy, welcome.playerId);
  assert.deepEqual({ slowUntil: enemy.slowUntil, bleedUntil: enemy.bleedUntil, bleedDamage: enemy.bleedDamage },
    { slowUntil: 0, bleedUntil: 0, bleedDamage: 0 }, "bonding clears hostile status effects before the next tick");
});

test("player hit acknowledgements preserve avoidance and timeout unacknowledged damage", () => {
  let now = 1000;
  const realm = new RealmServer({ now: () => now, randomCode: () => "HITACK" });
  const host = new MemorySocket();
  const welcome = memoryHello(realm, host, { create: true });
  memorySend(realm, host, {
    type: "register_world",
    world: { navigation: null, strongholds: [], chests: [], enemies: [
      { id: "hit-guard", kind: "biomeHeavy", name: "Hit Guard", x: 0, y: 0, z: 210,
        health: 100, maxHealth: 100, speed: 1, range: 2, damage: 10, sight: 50, state: "combat" }
    ] }
  });
  memorySend(realm, host, { type: "start_realm" });
  now += 40;
  memorySend(realm, host, { type: "player_state", state: { x: 0, y: 0, z: 210, health: 100, maxHealth: 100 } });
  now += 100;
  realm.tick(now);
  const firstHit = host.find((message) => eventNamed("player_hit")(message));
  assert.ok(firstHit?.event.hitId);
  memorySend(realm, host, { type: "player_health_ack", hitId: firstHit.event.hitId, health: 100, maxHealth: 100 });
  const avoided = host.find((message) => eventNamed("player_damage")(message) && message.event.hitId === firstHit.event.hitId);
  assert.equal(avoided.event.avoided, true);
  assert.equal(realm.rooms.get(welcome.roomCode).players.get(welcome.playerId).health, 100);

  now += 1100;
  realm.tick(now);
  const hits = host.messages.filter(eventNamed("player_hit"));
  const secondHit = hits[hits.length - 1];
  assert.notEqual(secondHit.event.hitId, firstHit.event.hitId);
  now += 751;
  realm.tick(now);
  const timedOut = host.find((message) => eventNamed("player_damage")(message) && message.event.hitId === secondHit.event.hitId);
  assert.equal(timedOut.event.timedOut, true);
  assert.equal(realm.rooms.get(welcome.roomCode).players.get(welcome.playerId).health, 90);
});

test("weapon cadence and projectile envelopes accept legitimate capstone attacks", () => {
  let now = 1000;
  const realm = new RealmServer({ now: () => now, randomCode: () => "CADENCE" });
  const host = new MemorySocket();
  const welcome = memoryHello(realm, host, { create: true });
  const weapons = [["blade", 220], ["bow", 295], ["axe", 405], ["staff", 155]];
  memorySend(realm, host, {
    type: "register_world",
    world: {
      navigation: null, strongholds: [], chests: [],
      enemies: [
        ...weapons.map(([weapon], index) => ({ id: `cadence-${weapon}`, kind: "biomeHeavy", x: 1 + index, y: 0, z: 210, health: 1000, maxHealth: 1000 })),
        { id: "staff-range-valid", kind: "biomeHeavy", x: 160, y: 0, z: 210, health: 100, maxHealth: 100 },
        { id: "staff-range-invalid", kind: "biomeHeavy", x: 165, y: 0, z: 210, health: 100, maxHealth: 100 }
      ]
    }
  });
  memorySend(realm, host, { type: "start_realm" });
  now += 40;
  memorySend(realm, host, { type: "player_state", state: { x: 0, y: 0, z: 210, health: 100, maxHealth: 100 } });
  const room = realm.rooms.get(welcome.roomCode);
  for (const [weapon, cooldown] of weapons) {
    const enemy = room.enemies.get(`cadence-${weapon}`);
    memorySend(realm, host, { type: "attack", actionId: `${weapon}-a`, targetId: enemy.id, weapon, damage: 1 });
    now += cooldown;
    memorySend(realm, host, { type: "attack", actionId: `${weapon}-b`, targetId: enemy.id, weapon, damage: 1 });
    assert.equal(enemy.health, 998, `${weapon} accepts its earned minimum cadence`);
  }
  now += 155;
  const valid = room.enemies.get("staff-range-valid");
  memorySend(realm, host, { type: "attack", actionId: "staff-range-a", targetId: valid.id, weapon: "staff", damage: 1 });
  assert.equal(valid.health, 99, "staff accepts a visible impact at 160 metres");
  now += 155;
  const invalid = room.enemies.get("staff-range-invalid");
  memorySend(realm, host, { type: "attack", actionId: "staff-range-b", targetId: invalid.id, weapon: "staff", damage: 1 });
  assert.equal(invalid.health, 100, "staff rejects an impact beyond its projectile envelope");
  assert.equal(host.find((message) => message.type === "error" && message.code === "ATTACK_RANGE")?.code, "ATTACK_RANGE");
});

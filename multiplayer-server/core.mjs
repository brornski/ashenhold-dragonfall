import crypto from "node:crypto";

export const PROTOCOL_VERSION = 1;
export const MAX_PLAYERS = 4;
export const WORLD_LIMIT = 920;
const ROOM_TTL_MS = 30 * 60 * 1000;
const RECONNECT_GRACE_MS = 60 * 1000;
const SNAPSHOT_INTERVAL_MS = 50;
const AI_STEP_MS = 100;
const WEAPON_RULES = {
  blade: { cooldown: 260, range: 7.5, maxDamage: 180 },
  bow: { cooldown: 380, range: 155, maxDamage: 190 },
  axe: { cooldown: 520, range: 10, maxDamage: 260 },
  staff: { cooldown: 300, range: 125, maxDamage: 210 },
  shout: { cooldown: 1800, range: 32, maxDamage: 180 },
  companion: { cooldown: 520, range: 6, maxDamage: 90 }
};

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function distance2D(a, b) {
  return Math.hypot((a.x || 0) - (b.x || 0), (a.z || 0) - (b.z || 0));
}

function cleanId(value, fallback) {
  const result = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return result || fallback;
}

function cleanName(value) {
  return String(value || "WARDEN").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 24) || "WARDEN";
}

function safeSend(socket, payload) {
  if (!socket || socket.readyState !== 1) return false;
  try { socket.send(JSON.stringify(payload)); return true; }
  catch { return false; }
}

function makeRoomCode(existing) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let code = "";
    const bytes = crypto.randomBytes(6);
    for (let index = 0; index < 6; index += 1) code += alphabet[bytes[index] % alphabet.length];
    if (!existing.has(code)) return code;
  }
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

function serializablePlayer(player) {
  return {
    id: player.id, name: player.name, x: player.x, y: player.y, z: player.z,
    rotation: player.rotation, health: player.health, maxHealth: player.maxHealth,
    stamina: player.stamina, weapon: player.weapon, moving: player.moving,
    sprinting: player.sprinting, superSprinting: player.superSprinting,
    sliding: player.sliding, airborne: player.airborne, attacking: player.attacking,
    companionCount: player.companionCount, connected: player.connected,
    color: player.color, lastSeenAt: player.lastSeenAt
  };
}

function serializableEnemy(enemy) {
  return {
    id: enemy.id, name: enemy.name, kind: enemy.kind, x: enemy.x, y: enemy.y, z: enemy.z,
    rotation: enemy.rotation, health: enemy.health, maxHealth: enemy.maxHealth,
    state: enemy.state, role: enemy.role, strongholdId: enemy.strongholdId,
    dead: enemy.dead, tamedBy: enemy.tamedBy, tameProgress: enemy.tameProgress,
    targetId: enemy.targetId, alert: enemy.alert
  };
}

function serializableStronghold(stronghold) {
  return { id: stronghold.id, name: stronghold.name, kind: stronghold.kind, x: stronghold.x, z: stronghold.z, cleared: stronghold.cleared, flagRaised: stronghold.flagRaised };
}

function serializableChest(chest, playerId) {
  return { id: chest.id, x: chest.x, y: chest.y, z: chest.z, opened: chest.opened, claimed: chest.claimedBy.has(playerId), powerUp: chest.powerUp };
}

function normalizeNavigation(input) {
  if (!input || typeof input !== "object") return null;
  const cellSize = clamp(input.cellSize, 2, 16) || 6;
  const width = Math.floor(clamp(input.width, 1, 512));
  const height = Math.floor(clamp(input.height, 1, 512));
  if (!width || !height) return null;
  const blocked = new Set((Array.isArray(input.blocked) ? input.blocked : []).slice(0, width * height).map((value) => Math.floor(Number(value))).filter((value) => value >= 0 && value < width * height));
  return { cellSize, width, height, originX: clamp(input.originX, -WORLD_LIMIT, WORLD_LIMIT), originZ: clamp(input.originZ, -WORLD_LIMIT, WORLD_LIMIT), blocked };
}

function navCell(nav, x, z) {
  if (!nav) return null;
  const ix = Math.floor((x - nav.originX) / nav.cellSize);
  const iz = Math.floor((z - nav.originZ) / nav.cellSize);
  if (ix < 0 || iz < 0 || ix >= nav.width || iz >= nav.height) return null;
  return { ix, iz, index: iz * nav.width + ix };
}

function navWorld(nav, cell) {
  return { x: nav.originX + (cell.ix + .5) * nav.cellSize, z: nav.originZ + (cell.iz + .5) * nav.cellSize };
}

function lineClear(nav, from, to) {
  if (!nav) return true;
  const start = navCell(nav, from.x, from.z);
  const end = navCell(nav, to.x, to.z);
  if (!start || !end) return false;
  let x = start.ix; let z = start.iz;
  const dx = Math.abs(end.ix - x); const sx = x < end.ix ? 1 : -1;
  const dz = -Math.abs(end.iz - z); const sz = z < end.iz ? 1 : -1;
  let error = dx + dz;
  while (true) {
    if (nav.blocked.has(z * nav.width + x)) return false;
    if (x === end.ix && z === end.iz) return true;
    const twice = error * 2;
    if (twice >= dz) { error += dz; x += sx; }
    if (twice <= dx) { error += dx; z += sz; }
  }
}

function findPath(nav, from, to) {
  if (!nav) return [to];
  const start = navCell(nav, from.x, from.z);
  const goal = navCell(nav, to.x, to.z);
  if (!start || !goal || nav.blocked.has(goal.index)) return [];
  if (lineClear(nav, from, to)) return [to];
  const open = [{ ...start, score: 0 }];
  const cameFrom = new Map();
  const cost = new Map([[start.index, 0]]);
  const visited = new Set();
  const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let expansions = 0;
  while (open.length && expansions < 2400) {
    open.sort((a, b) => a.score - b.score);
    const current = open.shift();
    if (visited.has(current.index)) continue;
    visited.add(current.index); expansions += 1;
    if (current.index === goal.index) {
      const cells = [current];
      let cursor = current.index;
      while (cameFrom.has(cursor)) {
        const previous = cameFrom.get(cursor);
        cells.push({ ix: previous % nav.width, iz: Math.floor(previous / nav.width), index: previous });
        cursor = previous;
      }
      cells.reverse();
      return cells.slice(1).filter((_, index) => index % 2 === 0 || index === cells.length - 2).map((cell) => navWorld(nav, cell));
    }
    for (const [offsetX, offsetZ] of directions) {
      const ix = current.ix + offsetX; const iz = current.iz + offsetZ;
      if (ix < 0 || iz < 0 || ix >= nav.width || iz >= nav.height) continue;
      const index = iz * nav.width + ix;
      if (nav.blocked.has(index) || visited.has(index)) continue;
      if (offsetX && offsetZ && (nav.blocked.has(current.iz * nav.width + ix) || nav.blocked.has(iz * nav.width + current.ix))) continue;
      const nextCost = (cost.get(current.index) || 0) + (offsetX && offsetZ ? 1.414 : 1);
      if (nextCost >= (cost.get(index) ?? Infinity)) continue;
      cost.set(index, nextCost); cameFrom.set(index, current.index);
      const heuristic = Math.hypot(goal.ix - ix, goal.iz - iz);
      open.push({ ix, iz, index, score: nextCost + heuristic });
    }
  }
  return [];
}

function buildRoom(code, event, now) {
  return {
    code, biome: cleanId(event.biome, "jungle").toLowerCase(), seed: Math.max(1, Math.floor(Number(event.seed) || 424242)),
    createdAt: now, updatedAt: now, revision: 0, sockets: new Set(), players: new Map(), enemies: new Map(),
    strongholds: new Map(), chests: new Map(), navigation: null, worldReady: false, started: false, hostId: null,
    lastSnapshotAt: 0, lastAiAt: now, eventSequence: 0, pendingEvents: []
  };
}

export class RealmServer {
  constructor(options = {}) {
    this.rooms = new Map();
    this.now = typeof options.now === "function" ? options.now : () => Date.now();
    this.randomCode = typeof options.randomCode === "function" ? options.randomCode : () => makeRoomCode(this.rooms);
  }

  attach(socket) {
    socket.ashenhold = { roomCode: null, playerId: null, lastFrameAt: 0 };
    safeSend(socket, { type: "server_ready", protocol: PROTOCOL_VERSION, maxPlayers: MAX_PLAYERS });
  }

  receive(socket, raw) {
    let event;
    try { event = typeof raw === "string" ? JSON.parse(raw) : JSON.parse(raw.toString()); }
    catch { return this.reject(socket, "BAD_JSON", "Messages must be valid JSON."); }
    if (!event || typeof event.type !== "string") return this.reject(socket, "BAD_EVENT", "Missing event type.");
    if (event.type === "hello") return this.hello(socket, event);
    const room = this.roomFor(socket);
    const player = room && room.players.get(socket.ashenhold.playerId);
    if (!room || !player) return this.reject(socket, "NOT_JOINED", "Join a room before sending gameplay events.");
    room.updatedAt = this.now();
    if (event.type === "player_state") return this.playerState(room, player, event);
    if (event.type === "register_world") return this.registerWorld(room, player, event);
    if (event.type === "start_realm") return this.startRealm(room, player);
    if (event.type === "host_enemy_state") return this.hostEnemyState(room, player, event);
    if (event.type === "attack") return this.attack(room, player, event);
    if (event.type === "open_chest") return this.openChest(room, player, event);
    if (event.type === "tame") return this.tame(room, player, event);
    if (event.type === "ping") return safeSend(socket, { type: "pong", sentAt: event.sentAt, serverAt: this.now() });
    return this.reject(socket, "UNKNOWN_EVENT", "Unsupported event type.");
  }

  hello(socket, event) {
    if (Math.floor(Number(event.protocol)) !== PROTOCOL_VERSION) return this.reject(socket, "PROTOCOL", "Client/server protocol mismatch.");
    const now = this.now();
    const requested = cleanId(event.roomCode, "").toUpperCase();
    const creating = Boolean(event.create) || !requested;
    const code = creating ? this.randomCode() : requested;
    let room = this.rooms.get(code);
    if (!room && creating) { room = buildRoom(code, event, now); this.rooms.set(code, room); }
    if (!room) return this.reject(socket, "ROOM_NOT_FOUND", "That room does not exist.");
    const playerId = cleanId(event.clientId, crypto.randomUUID());
    let player = room.players.get(playerId);
    const connectedCount = [...room.players.values()].filter((item) => item.connected && item.id !== playerId).length;
    if (!player && connectedCount >= MAX_PLAYERS) return this.reject(socket, "ROOM_FULL", "This party already has four Wardens.");
    if (!player) {
      const palette = ["#69d5e6", "#e79a62", "#8bd58c", "#c695ef"];
      player = {
        id: playerId, name: cleanName(event.name), x: 0, y: 0, z: 210, rotation: 0,
        health: 100, maxHealth: 100, stamina: 100, weapon: "blade", moving: false,
        sprinting: false, superSprinting: false, sliding: false, airborne: false, attacking: false,
        companionCount: 0, connected: true, color: palette[room.players.size % palette.length],
        joinedAt: now, lastSeenAt: now, lastStateAt: 0, healthInitialized: false,
        lastAttackAt: Object.create(null), socket
      };
      room.players.set(playerId, player);
      if (!room.hostId) room.hostId = playerId;
    } else {
      if (player.socket && player.socket !== socket) {
        try { player.socket.close(4001, "Reconnected elsewhere"); } catch {}
      }
      player.name = cleanName(event.name || player.name); player.connected = true; player.socket = socket; player.lastSeenAt = now;
    }
    socket.ashenhold = { roomCode: room.code, playerId, lastFrameAt: 0 };
    room.sockets.add(socket); room.revision += 1;
    safeSend(socket, {
      type: "welcome", protocol: PROTOCOL_VERSION, playerId, roomCode: room.code,
      realm: { biome: room.biome, seed: room.seed }, maxPlayers: MAX_PLAYERS,
      isHost: room.hostId === playerId, worldReady: room.worldReady, started: room.started,
      snapshot: this.snapshot(room, playerId)
    });
    this.queueEvent(room, "presence", { playerId, name: player.name, connected: true });
    this.broadcast(room, { type: "presence", player: serializablePlayer(player), playerCount: connectedCount + 1 }, socket);
    return room.code;
  }

  disconnect(socket) {
    const room = this.roomFor(socket);
    if (!room) return;
    room.sockets.delete(socket);
    const player = room.players.get(socket.ashenhold.playerId);
    if (player && player.socket === socket) {
      player.connected = false; player.socket = null; player.lastSeenAt = this.now();
      this.queueEvent(room, "presence", { playerId: player.id, connected: false });
      this.broadcast(room, { type: "presence", player: serializablePlayer(player), playerCount: [...room.players.values()].filter((item) => item.connected).length });
    }
    room.updatedAt = this.now();
  }

  roomFor(socket) {
    return socket && socket.ashenhold ? this.rooms.get(socket.ashenhold.roomCode) : null;
  }

  reject(socket, code, message) {
    safeSend(socket, { type: "error", code, message });
    return false;
  }

  playerState(room, player, event) {
    const now = this.now();
    if (now - player.lastStateAt < 35) return false;
    const incoming = event.state || {};
    const next = {
      x: clamp(incoming.x, -WORLD_LIMIT, WORLD_LIMIT), y: clamp(incoming.y, -80, 240), z: clamp(incoming.z, -WORLD_LIMIT, WORLD_LIMIT)
    };
    if (player.lastStateAt) {
      const elapsed = clamp((now - player.lastStateAt) / 1000, .035, 1);
      const allowed = 7 + elapsed * 105;
      if (distance2D(player, next) > allowed || Math.abs(next.y - player.y) > 35 + elapsed * 50) return this.reject(player.socket, "MOVEMENT_REJECTED", "Movement exceeded the server envelope.");
    }
    player.x = next.x; player.y = next.y; player.z = next.z;
    player.rotation = clamp(incoming.rotation, -Math.PI * 8, Math.PI * 8);
    const previousMaximum = player.maxHealth;
    player.maxHealth = clamp(incoming.maxHealth || player.maxHealth, 1, 5000);
    const reportedHealth = clamp(incoming.health ?? player.health, 0, player.maxHealth);
    if (!player.healthInitialized) {
      player.health = reportedHealth;
      player.healthInitialized = true;
    } else if (reportedHealth < player.health) {
      player.health = reportedHealth;
    } else if (player.maxHealth > previousMaximum) {
      player.health = Math.min(player.maxHealth, player.health + (player.maxHealth - previousMaximum));
    }
    player.stamina = clamp(incoming.stamina ?? player.stamina, 0, 5000);
    player.weapon = WEAPON_RULES[incoming.weapon] ? incoming.weapon : player.weapon;
    player.moving = Boolean(incoming.moving); player.sprinting = Boolean(incoming.sprinting);
    player.superSprinting = Boolean(incoming.superSprinting); player.sliding = Boolean(incoming.sliding);
    player.airborne = Boolean(incoming.airborne); player.attacking = Boolean(incoming.attacking);
    const bondedCount = [...room.enemies.values()].filter((enemy) => enemy.tamedBy === player.id && !enemy.dead).length;
    player.companionCount = Math.floor(clamp(Math.max(incoming.companionCount || 0, bondedCount), 0, 2));
    player.noise = clamp(incoming.noise, 0, 1); player.lastStateAt = now; player.lastSeenAt = now;
    return true;
  }

  registerWorld(room, player, event) {
    if (room.hostId !== player.id) return this.reject(player.socket, "HOST_ONLY", "Only the party host may initialize the realm.");
    if (room.worldReady) {
      safeSend(player.socket, { type: "world_registered", accepted: false, reason: "already_ready", snapshot: this.snapshot(room, player.id) });
      return false;
    }
    const world = event.world || {};
    room.navigation = normalizeNavigation(world.navigation);
    for (const source of (Array.isArray(world.strongholds) ? world.strongholds : []).slice(0, 64)) {
      const id = cleanId(source.id, "stronghold-" + room.strongholds.size);
      room.strongholds.set(id, { id, name: cleanName(source.name), kind: cleanId(source.kind, "fort"), x: clamp(source.x, -WORLD_LIMIT, WORLD_LIMIT), z: clamp(source.z, -WORLD_LIMIT, WORLD_LIMIT), cleared: Boolean(source.cleared), flagRaised: Boolean(source.flagRaised) });
    }
    for (const source of (Array.isArray(world.enemies) ? world.enemies : []).slice(0, 320)) {
      const id = cleanId(source.id, "enemy-" + room.enemies.size);
      const x = clamp(source.x, -WORLD_LIMIT, WORLD_LIMIT); const z = clamp(source.z, -WORLD_LIMIT, WORLD_LIMIT);
      room.enemies.set(id, {
        id, name: cleanName(source.name), kind: cleanId(source.kind, "biomeLight"), x, y: clamp(source.y, -40, 180), z,
        homeX: clamp(source.homeX ?? x, -WORLD_LIMIT, WORLD_LIMIT), homeZ: clamp(source.homeZ ?? z, -WORLD_LIMIT, WORLD_LIMIT),
        rotation: Number(source.rotation) || 0, health: clamp(source.health, 1, 10000), maxHealth: clamp(source.maxHealth || source.health, 1, 10000),
        speed: clamp(source.speed || 7, 1, 18), range: clamp(source.range || 2.8, 1, 45), damage: clamp(source.damage || 8, 1, 120),
        sight: clamp(source.sight || (source.role === "sentry" ? 62 : 42), 12, 100), role: cleanId(source.role, "guard"),
        patrol: (Array.isArray(source.patrol) ? source.patrol : []).slice(0, 8).map((point) => ({ x: clamp(point.x, -WORLD_LIMIT, WORLD_LIMIT), z: clamp(point.z, -WORLD_LIMIT, WORLD_LIMIT) })),
        patrolIndex: 0, strongholdId: source.strongholdId ? cleanId(source.strongholdId, "") : null,
        state: source.state === "patrol" ? "patrol" : "guard", dead: Boolean(source.dead), tamedBy: source.tamedBy || null,
        tameable: Boolean(source.tameable), tameProgress: clamp(source.tameProgress, 0, 100), targetId: null, alert: 0,
        detection: 0, lastSeenAt: 0, lastKnown: null, searchUntil: 0, path: [], pathIndex: 0, nextPathAt: 0,
        attackAt: 0, handled: Boolean(source.dead || source.tamedBy)
      });
    }
    for (const source of (Array.isArray(world.chests) ? world.chests : []).slice(0, 128)) {
      const id = cleanId(source.id, "chest-" + room.chests.size);
      room.chests.set(id, {
        id, x: clamp(source.x, -WORLD_LIMIT, WORLD_LIMIT), y: clamp(source.y, -60, 200), z: clamp(source.z, -WORLD_LIMIT, WORLD_LIMIT),
        opened: Boolean(source.opened), powerUp: source.powerUp && typeof source.powerUp === "object" ? { type: cleanId(source.powerUp.type, "damage"), amount: Math.floor(clamp(source.powerUp.amount, 1, 3)) } : { type: "damage", amount: 1 },
        claimedBy: new Set(Array.isArray(source.claimedBy) ? source.claimedBy.map((idValue) => cleanId(idValue, "")) : [])
      });
    }
    room.worldReady = true; room.revision += 1;
    this.broadcast(room, { type: "world_registered", accepted: true, by: player.id, snapshot: this.snapshot(room, null) });
    return true;
  }

  startRealm(room, player) {
    if (room.hostId !== player.id) return this.reject(player.socket, "HOST_ONLY", "Only the party host may start the realm.");
    if (!room.worldReady) return this.reject(player.socket, "WORLD_NOT_READY", "Initialize the shared realm before starting.");
    if (room.started) return true;
    room.started = true; room.revision += 1;
    this.queueEvent(room, "realm_started", { playerId: player.id });
    return true;
  }

  hostEnemyState(room, player, event) {
    if (room.hostId !== player.id) return this.reject(player.socket, "HOST_ONLY", "Only the party host may drive roaming dragon movement.");
    const now = this.now();
    let changed = false;
    for (const incoming of (Array.isArray(event.enemies) ? event.enemies : []).slice(0, 24)) {
      const enemy = room.enemies.get(cleanId(incoming.id, ""));
      if (!enemy || enemy.kind !== "dragon" || enemy.dead || enemy.tamedBy) continue;
      const next = { x: clamp(incoming.x, -WORLD_LIMIT, WORLD_LIMIT), z: clamp(incoming.z, -WORLD_LIMIT, WORLD_LIMIT) };
      const elapsed = enemy.lastHostStateAt ? clamp((now - enemy.lastHostStateAt) / 1000, .035, 1) : 1;
      if (distance2D(enemy, next) > 18 + elapsed * 125) continue;
      enemy.x = next.x; enemy.y = clamp(incoming.y, -40, 240); enemy.z = next.z;
      enemy.rotation = clamp(incoming.rotation, -Math.PI * 8, Math.PI * 8);
      enemy.state = cleanId(incoming.state, enemy.state).slice(0, 20);
      enemy.targetId = incoming.targetId ? cleanId(incoming.targetId, "") : null;
      enemy.lastHostStateAt = now; changed = true;
    }
    if (changed) room.revision += 1;
    return changed;
  }

  attack(room, player, event) {
    const weapon = WEAPON_RULES[event.weapon] ? event.weapon : player.weapon;
    const rule = WEAPON_RULES[weapon]; const now = this.now();
    if (now - (player.lastAttackAt[weapon] || 0) < rule.cooldown) return this.reject(player.socket, "ATTACK_RATE", "Attack rate exceeded weapon rules.");
    const enemy = room.enemies.get(cleanId(event.targetId, ""));
    if (!enemy || enemy.dead || enemy.tamedBy) return this.reject(player.socket, "BAD_TARGET", "Target is not hostile.");
    if (distance2D(player, enemy) > rule.range + 2 || Math.abs(player.y - enemy.y) > 12) return this.reject(player.socket, "ATTACK_RANGE", "Target is out of range.");
    const amount = Math.floor(clamp(event.damage, 1, rule.maxDamage));
    player.lastAttackAt[weapon] = now;
    enemy.health = Math.max(0, enemy.health - amount);
    if (weapon === "staff") enemy.tameProgress = clamp(enemy.tameProgress + 30, 0, 100);
    if (event.critical) enemy.tameProgress = clamp(enemy.tameProgress + 55, 0, 100);
    if (enemy.health <= 0) { enemy.dead = true; enemy.handled = true; enemy.state = "dead"; enemy.targetId = null; }
    room.revision += 1;
    this.queueEvent(room, "enemy_damage", { enemyId: enemy.id, playerId: player.id, weapon, amount, critical: Boolean(event.critical), health: enemy.health, dead: enemy.dead, tameProgress: enemy.tameProgress });
    if (enemy.strongholdId) this.checkStronghold(room, enemy.strongholdId);
    return true;
  }

  openChest(room, player, event) {
    const chest = room.chests.get(cleanId(event.chestId, ""));
    if (!chest) return this.reject(player.socket, "CHEST_NOT_FOUND", "Chest does not exist.");
    if (chest.claimedBy.has(player.id)) return this.reject(player.socket, "CHEST_CLAIMED", "You already claimed this chest.");
    if (distance2D(player, chest) > 3.5 || Math.abs(player.y - chest.y) > 1.8) return this.reject(player.socket, "CHEST_RANGE", "Stand in front of the chest on the same level.");
    if (!lineClear(room.navigation, player, chest)) return this.reject(player.socket, "CHEST_OCCLUDED", "The chest is obstructed.");
    chest.claimedBy.add(player.id); chest.opened = true; room.revision += 1;
    this.queueEvent(room, "chest_opened", { chestId: chest.id, playerId: player.id, powerUp: chest.powerUp });
    return true;
  }

  tame(room, player, event) {
    if (player.companionCount >= 2) return this.reject(player.socket, "COMPANION_LIMIT", "A Warden may bond only two companions.");
    const enemy = room.enemies.get(cleanId(event.enemyId, ""));
    if (!enemy || enemy.dead || enemy.tamedBy || !enemy.tameable) return this.reject(player.socket, "TAME_TARGET", "Creature cannot be tamed.");
    if (distance2D(player, enemy) > 4.2 || Math.abs(player.y - enemy.y) > 4) return this.reject(player.socket, "TAME_RANGE", "Move closer to the creature.");
    if (enemy.tameProgress < 100 && enemy.health > enemy.maxHealth * .5) return this.reject(player.socket, "TAME_NOT_READY", "The creature's will is not broken.");
    enemy.tamedBy = player.id; enemy.handled = true; enemy.state = "bonded"; enemy.targetId = null;
    player.companionCount += 1; room.revision += 1;
    this.queueEvent(room, "enemy_tamed", { enemyId: enemy.id, playerId: player.id });
    if (enemy.strongholdId) this.checkStronghold(room, enemy.strongholdId);
    return true;
  }

  checkStronghold(room, strongholdId) {
    const stronghold = room.strongholds.get(strongholdId);
    if (!stronghold || stronghold.cleared) return false;
    const members = [...room.enemies.values()].filter((enemy) => enemy.strongholdId === strongholdId);
    if (!members.length || members.some((enemy) => !enemy.handled && !enemy.dead && !enemy.tamedBy)) return false;
    stronghold.cleared = true;
    stronghold.flagRaised = stronghold.kind === "shrine" || stronghold.kind === "graveyard";
    room.revision += 1;
    this.queueEvent(room, "stronghold_cleared", { strongholdId, flagRaised: stronghold.flagRaised });
    return true;
  }

  queueEvent(room, type, payload) {
    const event = { id: ++room.eventSequence, type, serverAt: this.now(), ...payload };
    room.pendingEvents.push(event);
    if (room.pendingEvents.length > 160) room.pendingEvents.splice(0, room.pendingEvents.length - 160);
    this.broadcast(room, { type: "event", event });
    return event;
  }

  broadcast(room, payload, except) {
    room.sockets.forEach((socket) => { if (socket !== except) safeSend(socket, payload); });
  }

  snapshot(room, playerId) {
    return {
      revision: room.revision, serverAt: this.now(), roomCode: room.code,
      realm: { biome: room.biome, seed: room.seed }, worldReady: room.worldReady,
      started: room.started, hostId: room.hostId,
      players: [...room.players.values()].map(serializablePlayer),
      enemies: [...room.enemies.values()].map(serializableEnemy),
      strongholds: [...room.strongholds.values()].map(serializableStronghold),
      chests: [...room.chests.values()].map((chest) => serializableChest(chest, playerId)),
      recentEvents: room.pendingEvents.slice(-30)
    };
  }

  tick(now = this.now()) {
    for (const [code, room] of this.rooms) {
      for (const [id, player] of room.players) {
        if (player.connected || now - player.lastSeenAt <= RECONNECT_GRACE_MS) continue;
        room.players.delete(id);
        if (room.hostId === id) {
          const successor = [...room.players.values()].filter((candidate) => candidate.connected).sort((a, b) => a.joinedAt - b.joinedAt)[0];
          room.hostId = successor?.id || null;
          if (successor) this.queueEvent(room, "host_changed", { playerId: successor.id });
        }
      }
      if (!room.sockets.size && now - room.updatedAt > ROOM_TTL_MS) { this.rooms.delete(code); continue; }
      const aiElapsed = now - room.lastAiAt;
      if (room.worldReady && aiElapsed >= AI_STEP_MS) {
        this.updateEnemies(room, Math.min(.25, aiElapsed / 1000), now);
        room.lastAiAt = now;
      }
      if (now - room.lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
        room.sockets.forEach((socket) => safeSend(socket, { type: "state", snapshot: this.snapshot(room, socket.ashenhold.playerId) }));
        room.lastSnapshotAt = now;
      }
    }
  }

  updateEnemies(room, dt, now) {
    const players = [...room.players.values()].filter((player) => player.connected && player.health > 0);
    for (const enemy of room.enemies.values()) {
      if (enemy.dead) continue;
      if (enemy.tamedBy) {
        const owner = room.players.get(enemy.tamedBy);
        if (!owner || !owner.connected || owner.health <= 0) continue;
        enemy.state = "bonded"; enemy.targetId = null; enemy.alert = 0;
        const side = [...room.enemies.values()].filter((candidate) => candidate.tamedBy === owner.id && !candidate.dead).findIndex((candidate) => candidate.id === enemy.id) % 2 ? 1 : -1;
        const follow = {
          x: owner.x + Math.cos(owner.rotation) * side * 2.2 + Math.sin(owner.rotation) * 3.2,
          z: owner.z - Math.sin(owner.rotation) * side * 2.2 + Math.cos(owner.rotation) * 3.2
        };
        const followDistance = distance2D(enemy, follow);
        if (followDistance > 2.3) {
          const path = findPath(room.navigation, enemy, follow);
          const waypoint = path[0] || follow;
          const dx = waypoint.x - enemy.x; const dz = waypoint.z - enemy.z; const length = Math.hypot(dx, dz) || 1;
          const step = Math.min(length, enemy.speed * 1.08 * dt);
          enemy.x += dx / length * step; enemy.z += dz / length * step;
          enemy.rotation = Math.atan2(-dx, -dz);
        }
        continue;
      }
      let target = enemy.targetId ? room.players.get(enemy.targetId) : null;
      if (!target || !target.connected || target.health <= 0) { target = null; enemy.targetId = null; }
      const visible = players.map((player) => {
        const distance = distance2D(enemy, player);
        const direction = Math.atan2(-(player.x - enemy.x), -(player.z - enemy.z));
        const angle = Math.abs(Math.atan2(Math.sin(direction - enemy.rotation), Math.cos(direction - enemy.rotation)));
        const canSee = distance <= enemy.sight && (enemy.state === "combat" || angle <= Math.PI * .38) && Math.abs(player.y - enemy.y) < 18 && lineClear(room.navigation, enemy, player);
        const heard = distance <= 14 + (player.noise || 0) * 28;
        return { player, distance, canSee, heard };
      }).filter((candidate) => candidate.canSee || candidate.heard).sort((a, b) => a.distance - b.distance)[0];
      if (visible) {
        enemy.detection = clamp(enemy.detection + dt * (visible.canSee ? 1.5 : .65), 0, 1);
        enemy.lastKnown = { x: visible.player.x, z: visible.player.z };
        if (enemy.detection >= .45 || enemy.state === "combat") {
          target = visible.player; enemy.targetId = target.id; enemy.state = "combat"; enemy.alert = 1; enemy.lastSeenAt = now;
          for (const ally of room.enemies.values()) {
            if (ally === enemy || ally.dead || ally.tamedBy || distance2D(ally, enemy) > 24 || !lineClear(room.navigation, ally, enemy)) continue;
            ally.alert = Math.max(ally.alert, .65); ally.lastKnown = { x: target.x, z: target.z };
          }
        } else if (enemy.state === "guard" || enemy.state === "patrol") enemy.state = "suspicious";
      } else {
        enemy.detection = Math.max(0, enemy.detection - dt * .3);
        if (enemy.state === "combat" && now - enemy.lastSeenAt > 1600) { enemy.state = "search"; enemy.searchUntil = now + 4200; enemy.targetId = null; }
        if (enemy.state === "search" && now >= enemy.searchUntil) { enemy.state = "return"; enemy.lastKnown = null; }
      }
      let goal = null; let moveSpeed = enemy.speed;
      if (target) goal = target;
      else if (enemy.state === "search" && enemy.lastKnown) { goal = enemy.lastKnown; moveSpeed *= .72; }
      else if (enemy.state === "return") { goal = { x: enemy.homeX, z: enemy.homeZ }; moveSpeed *= .65; }
      else if (enemy.state === "patrol" && enemy.patrol.length) { goal = enemy.patrol[enemy.patrolIndex % enemy.patrol.length]; moveSpeed *= .45; }
      else if (enemy.state === "suspicious" && enemy.lastKnown) { goal = enemy.lastKnown; moveSpeed *= .5; }
      if (goal) {
        const goalDistance = distance2D(enemy, goal);
        const stop = target ? enemy.range * .8 : 1.2;
        if (goalDistance > stop) {
          if (now >= enemy.nextPathAt || !enemy.path.length || enemy.pathIndex >= enemy.path.length) {
            enemy.path = findPath(room.navigation, enemy, goal); enemy.pathIndex = 0; enemy.nextPathAt = now + 700;
          }
          const waypoint = enemy.path[enemy.pathIndex] || goal;
          const dx = waypoint.x - enemy.x; const dz = waypoint.z - enemy.z; const length = Math.hypot(dx, dz) || 1;
          const step = Math.min(length, moveSpeed * dt);
          enemy.x += dx / length * step; enemy.z += dz / length * step;
          enemy.rotation = Math.atan2(-dx, -dz);
          if (length < Math.max(.65, moveSpeed * dt * 1.5)) enemy.pathIndex += 1;
        } else if (!target) {
          if (enemy.state === "return") { enemy.state = enemy.patrol.length ? "patrol" : "guard"; enemy.rotation = 0; }
          else if (enemy.state === "patrol") enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrol.length;
        }
      }
      if (target && distance2D(enemy, target) <= enemy.range && now >= enemy.attackAt) {
        enemy.attackAt = now + 850 + enemy.range * 80;
        target.health = Math.max(0, target.health - enemy.damage);
        this.queueEvent(room, "player_damage", { playerId: target.id, enemyId: enemy.id, amount: enemy.damage, health: target.health });
      }
    }
    room.revision += 1;
  }
}

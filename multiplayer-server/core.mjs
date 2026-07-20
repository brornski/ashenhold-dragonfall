import crypto from "node:crypto";

export const PROTOCOL_VERSION = 2;
export const MAX_PLAYERS = 4;
export const WORLD_LIMIT = 920;
const ROOM_TTL_MS = 30 * 60 * 1000;
const RECONNECT_GRACE_MS = 60 * 1000;
const SNAPSHOT_INTERVAL_MS = 50;
const AI_STEP_MS = 100;
const WEAPON_RULES = {
  blade: { cooldown: 260, range: 7.5, maxDamage: 180, maxHits: 6 },
  bow: { cooldown: 380, range: 155, maxDamage: 190, maxHits: 4 },
  axe: { cooldown: 520, range: 72, maxDamage: 260, maxHits: 10 },
  staff: { cooldown: 300, range: 125, maxDamage: 210, maxHits: 12 },
  shout: { cooldown: 1800, range: 56, maxDamage: 180, maxHits: 24 },
  companion: { cooldown: 520, range: 6, maxDamage: 90, maxHits: 1 }
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

function reconnectToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function validReconnectToken(actual, supplied) {
  if (typeof actual !== "string" || typeof supplied !== "string") return false;
  const expectedBuffer = Buffer.from(actual);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
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
    color: player.color, lastSeenAt: player.lastSeenAt, healthInitialized: player.healthInitialized
  };
}

function serializableEnemy(enemy) {
  return {
    id: enemy.id, name: enemy.name, kind: enemy.kind, x: enemy.x, y: enemy.y, z: enemy.z,
    rotation: enemy.rotation, health: enemy.health, maxHealth: enemy.maxHealth,
    state: enemy.state, role: enemy.role, strongholdId: enemy.strongholdId,
    dead: enemy.dead, tamedBy: enemy.tamedBy, tameProgress: enemy.tameProgress,
    slowUntil: enemy.slowUntil || 0, bleedUntil: enemy.bleedUntil || 0,
    targetId: enemy.targetId, alert: enemy.alert, boss: enemy.boss,
    speed: enemy.speed, range: enemy.range, damage: enemy.damage, sight: enemy.sight, healthReward: enemy.healthReward,
    tameable: enemy.tameable, homeX: enemy.homeX, homeZ: enemy.homeZ
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
  const runs = Array.isArray(input.blockedRuns) ? input.blockedRuns.slice(0, width * height * 2) : [];
  let decodedCells = blocked.size;
  for (let index = 0; index + 1 < runs.length; index += 2) {
    if (decodedCells >= width * height) break;
    const first = Math.floor(clamp(runs[index], 0, width * height - 1));
    const length = Math.floor(clamp(runs[index + 1], 0, Math.min(width * height - first, width * height - decodedCells)));
    for (let offset = 0; offset < length; offset += 1) { blocked.add(first + offset); decodedCells += 1; }
  }
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
    lastSnapshotAt: 0, lastAiAt: now, eventSequence: 0, hitSequence: 0, pendingEvents: []
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
    if (event.type === "hello") {
      if (socket.ashenhold?.roomCode) return this.reject(socket, "ALREADY_JOINED", "This connection has already joined a room.");
      return this.hello(socket, event);
    }
    const room = this.roomFor(socket);
    const player = room && room.players.get(socket.ashenhold.playerId);
    if (!room || !player) return this.reject(socket, "NOT_JOINED", "Join a room before sending gameplay events.");
    room.updatedAt = this.now();
    if (event.type === "player_state") return this.playerState(room, player, event);
    if (event.type === "register_world") return this.registerWorld(room, player, event);
    if (event.type === "start_realm") return this.startRealm(room, player);
    if (event.type === "ping") return safeSend(socket, { type: "pong", sentAt: event.sentAt, serverAt: this.now() });
    if (!room.started) return this.reject(socket, "REALM_NOT_STARTED", "Wait for the party host to start the shared realm.");
    if (event.type === "register_enemy") return this.registerEnemy(room, player, event);
    if (event.type === "player_health_ack") return this.playerHealthAck(room, player, event);
    if (player.health <= 0) return this.reject(socket, "PLAYER_DEAD", "A fallen Warden cannot change the shared realm.");
    if (event.type === "host_enemy_state") return this.hostEnemyState(room, player, event);
    if (event.type === "attack") return this.attack(room, player, event);
    if (event.type === "open_chest") return this.openChest(room, player, event);
    if (event.type === "tame") return this.tame(room, player, event);
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
    const claimedPlayerId = cleanId(event.playerId, "");
    let player = claimedPlayerId ? room.players.get(claimedPlayerId) : null;
    if (player && !validReconnectToken(player.reconnectToken, event.reconnectToken)) {
      return this.reject(socket, "IDENTITY_REJECTED", "The private reconnect credential is missing or invalid.");
    }
    const playerId = player ? player.id : crypto.randomUUID();
    const occupiedCount = [...room.players.values()].filter((item) => item.id !== playerId
      && (item.connected || now - item.lastSeenAt <= RECONNECT_GRACE_MS)).length;
    if (occupiedCount >= MAX_PLAYERS) return this.reject(socket, "ROOM_FULL", "This party already has four Wardens.");
    if (!player) {
      const palette = ["#69d5e6", "#e79a62", "#8bd58c", "#c695ef"];
      player = {
        id: playerId, name: cleanName(event.name), x: 0, y: 0, z: 210, rotation: 0,
        health: 100, maxHealth: 100, stamina: 100, weapon: "blade", moving: false,
        sprinting: false, superSprinting: false, sliding: false, airborne: false, attacking: false,
        companionCount: 0, connected: true, color: palette[room.players.size % palette.length],
        joinedAt: now, lastSeenAt: now, lastStateAt: 0, healthInitialized: false,
        lastAttackAt: Object.create(null), attackBatches: new Map(), pendingHits: new Map(),
        healthTokens: 25, lastHealthTokenAt: now, maxHealthAllowance: 0,
        reconnectToken: reconnectToken(), socket
      };
      room.players.set(playerId, player);
    } else {
      if (player.socket && player.socket !== socket) {
        try { player.socket.close(4001, "Reconnected elsewhere"); } catch {}
      }
      player.name = cleanName(event.name || player.name); player.connected = true; player.socket = socket; player.lastSeenAt = now;
    }
    const currentHost = room.hostId ? room.players.get(room.hostId) : null;
    if (!currentHost || !currentHost.connected || currentHost.health <= 0) room.hostId = playerId;
    socket.ashenhold = { roomCode: room.code, playerId, lastFrameAt: 0 };
    room.sockets.add(socket); room.revision += 1;
    safeSend(socket, {
      type: "welcome", protocol: PROTOCOL_VERSION, playerId, roomCode: room.code,
      reconnectToken: player.reconnectToken,
      realm: { biome: room.biome, seed: room.seed }, maxPlayers: MAX_PLAYERS,
      isHost: room.hostId === playerId, worldReady: room.worldReady, started: room.started,
      snapshot: this.snapshot(room, playerId)
    });
    this.queueEvent(room, "presence", { playerId, name: player.name, connected: true });
    this.broadcast(room, { type: "presence", player: serializablePlayer(player), playerCount: occupiedCount + 1 }, socket);
    return room.code;
  }

  disconnect(socket, detail = {}) {
    const room = this.roomFor(socket);
    if (!room) return;
    room.sockets.delete(socket);
    const player = room.players.get(socket.ashenhold.playerId);
    if (player && player.socket === socket) {
      const intentionalLeave = Number(detail.code) === 1000 && String(detail.reason || "") === "Warden left the party";
      player.connected = false; player.socket = null; player.lastSeenAt = this.now();
      this.queueEvent(room, "presence", { playerId: player.id, connected: false });
      this.broadcast(room, { type: "presence", player: serializablePlayer(player), playerCount: [...room.players.values()].filter((item) => item.connected).length });
      if (intentionalLeave) {
        this.releasePlayerBonds(room, player.id);
        room.players.delete(player.id);
      }
      if (room.hostId === player.id) {
        const successor = [...room.players.values()].filter((candidate) => candidate.connected && candidate.health > 0 && candidate.id !== player.id).sort((a, b) => a.joinedAt - b.joinedAt)[0];
        if (successor) {
          room.hostId = successor.id;
          this.queueEvent(room, "host_changed", { playerId: successor.id });
        } else if (intentionalLeave) room.hostId = null;
      }
      room.revision += 1;
    }
    room.updatedAt = this.now();
  }

  releasePlayerBonds(room, playerId) {
    let changed = false;
    for (const enemy of room.enemies.values()) {
      if (enemy.tamedBy !== playerId || enemy.dead) continue;
      enemy.tamedBy = null; enemy.handled = true; enemy.dead = true; enemy.health = 0;
      enemy.state = "dead"; enemy.targetId = null; enemy.tameProgress = 0;
      enemy.bleedUntil = 0; enemy.bleedDamage = 0; enemy.bleedOwnerId = null;
      changed = true;
    }
    if (changed) room.revision += 1;
    return changed;
  }

  promoteLivingHost(room, fallenPlayerId) {
    if (room.hostId !== fallenPlayerId) return false;
    const successor = [...room.players.values()].filter((candidate) => candidate.connected
      && candidate.health > 0 && candidate.id !== fallenPlayerId).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (!successor) return false;
    room.hostId = successor.id; room.revision += 1;
    this.queueEvent(room, "host_changed", { playerId: successor.id });
    return true;
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
    const reportedMaximum = clamp(incoming.maxHealth || player.maxHealth, 1, 5000);
    const previousMaximum = player.maxHealth;
    if (!player.healthInitialized) player.maxHealth = reportedMaximum;
    else if (reportedMaximum > player.maxHealth && player.maxHealthAllowance > 0) {
      const acceptedMaximum = Math.min(reportedMaximum, player.maxHealth + player.maxHealthAllowance);
      player.maxHealthAllowance = Math.max(0, player.maxHealthAllowance - (acceptedMaximum - player.maxHealth));
      player.maxHealth = acceptedMaximum;
    }
    const reportedHealth = clamp(incoming.health ?? player.health, 0, player.maxHealth);
    if (!player.healthInitialized) {
      player.health = reportedHealth;
      player.healthInitialized = true;
    } else {
      if (player.maxHealth > previousMaximum && player.health > 0) player.health = Math.min(player.maxHealth, player.health + (player.maxHealth - previousMaximum));
      if (reportedHealth < player.health) player.health = reportedHealth;
      else if (reportedHealth > player.health && player.health > 0) {
        const tokenElapsed = clamp((now - (player.lastHealthTokenAt || now)) / 1000, 0, .3);
        player.healthTokens = Math.min(25, (player.healthTokens || 0) + tokenElapsed * 25);
        const acceptedHealing = Math.min(reportedHealth - player.health, player.healthTokens);
        player.health += acceptedHealing;
        player.healthTokens -= acceptedHealing;
      }
    }
    player.lastHealthTokenAt = now;
    player.stamina = clamp(incoming.stamina ?? player.stamina, 0, 5000);
    player.weapon = WEAPON_RULES[incoming.weapon] ? incoming.weapon : player.weapon;
    player.moving = Boolean(incoming.moving); player.sprinting = Boolean(incoming.sprinting);
    player.superSprinting = Boolean(incoming.superSprinting); player.sliding = Boolean(incoming.sliding);
    player.airborne = Boolean(incoming.airborne); player.attacking = Boolean(incoming.attacking);
    const bondedCount = [...room.enemies.values()].filter((enemy) => enemy.tamedBy === player.id && !enemy.dead).length;
    player.companionCount = Math.floor(clamp(Math.max(incoming.companionCount || 0, bondedCount), 0, 2));
    player.noise = clamp(incoming.noise, 0, 1); player.lastStateAt = now; player.lastSeenAt = now;
    if (player.health <= 0) this.promoteLivingHost(room, player.id);
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
        speed: clamp(source.speed || 7, 1, 18), range: clamp(source.range || 2.8, 1, 45), damage: clamp(source.damage || 8, 1, 120), healthReward: clamp(source.healthReward || 6, 0, 100),
        sight: clamp(source.sight || (source.role === "sentry" ? 62 : 42), 12, 100), role: cleanId(source.role, "guard"),
        patrol: (Array.isArray(source.patrol) ? source.patrol : []).slice(0, 8).map((point) => ({ x: clamp(point.x, -WORLD_LIMIT, WORLD_LIMIT), z: clamp(point.z, -WORLD_LIMIT, WORLD_LIMIT) })),
        patrolIndex: 0, strongholdId: source.strongholdId ? cleanId(source.strongholdId, "") : null,
        state: source.state === "patrol" || source.state === "combat" ? source.state : "guard", dead: Boolean(source.dead), tamedBy: source.tamedBy || null,
        boss: Boolean(source.boss),
        tameable: Boolean(source.tameable), tameProgress: clamp(source.tameProgress, 0, 100), targetId: null, alert: 0,
        detection: 0, lastSeenAt: 0, lastKnown: null, searchUntil: 0, path: [], pathIndex: 0, nextPathAt: 0,
        attackAt: 0, handled: Boolean(source.dead || source.tamedBy),
        slowUntil: 0, bleedUntil: 0, bleedDamage: 0, bleedOwnerId: null, nextBleedAt: 0
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

  playerHealthAck(room, player, event) {
    const hitId = Math.floor(Number(event.hitId));
    const pending = player.pendingHits?.get(hitId);
    if (!pending) return this.reject(player.socket, "HIT_ACK_UNKNOWN", "That player hit is no longer pending.");
    player.pendingHits.delete(hitId);
    const resolvedHealth = clamp(event.health, 0, Math.min(player.maxHealth, pending.healthBefore));
    player.health = Math.min(player.health, resolvedHealth);
    player.lastSeenAt = this.now(); room.revision += 1;
    if (player.health <= 0) this.promoteLivingHost(room, player.id);
    this.queueEvent(room, "player_damage", {
      hitId, playerId: player.id, enemyId: pending.enemyId,
      rawDamage: pending.rawDamage, amount: Math.max(0, pending.healthBefore - resolvedHealth),
      avoided: resolvedHealth >= pending.healthBefore, health: player.health
    });
    return true;
  }

  registerEnemy(room, player, event) {
    if (room.hostId !== player.id) return this.reject(player.socket, "HOST_ONLY", "Only the party host may register a late realm enemy.");
    if (!room.worldReady) return this.reject(player.socket, "WORLD_NOT_READY", "Initialize the shared realm before registering enemies.");
    const source = event.enemy || {};
    const id = cleanId(source.id, "");
    if (!id) return this.reject(player.socket, "BAD_ENEMY", "A stable enemy id is required.");
    if (room.enemies.has(id)) {
      safeSend(player.socket, { type: "enemy_registered", accepted: false, reason: "already_registered", enemyId: id, snapshot: this.snapshot(room, player.id) });
      return true;
    }
    if (room.enemies.size >= 320) return this.reject(player.socket, "ENEMY_LIMIT", "The shared realm enemy limit has been reached.");
    const x = clamp(source.x, -WORLD_LIMIT, WORLD_LIMIT); const z = clamp(source.z, -WORLD_LIMIT, WORLD_LIMIT);
    const enemy = {
      id, name: cleanName(source.name), kind: cleanId(source.kind, "biomeLight"), x, y: clamp(source.y, -40, 180), z,
      homeX: clamp(source.homeX ?? x, -WORLD_LIMIT, WORLD_LIMIT), homeZ: clamp(source.homeZ ?? z, -WORLD_LIMIT, WORLD_LIMIT),
      rotation: Number(source.rotation) || 0, health: clamp(source.health, 1, 10000), maxHealth: clamp(source.maxHealth || source.health, 1, 10000),
      speed: clamp(source.speed || 7, 1, 18), range: clamp(source.range || 2.8, 1, 45), damage: clamp(source.damage || 8, 1, 120), healthReward: clamp(source.healthReward || 6, 0, 100),
      sight: clamp(source.sight || (source.role === "sentry" ? 62 : 42), 12, 100), role: cleanId(source.role, "guard"),
      patrol: (Array.isArray(source.patrol) ? source.patrol : []).slice(0, 8).map((point) => ({ x: clamp(point.x, -WORLD_LIMIT, WORLD_LIMIT), z: clamp(point.z, -WORLD_LIMIT, WORLD_LIMIT) })),
      patrolIndex: 0, strongholdId: source.strongholdId ? cleanId(source.strongholdId, "") : null,
      state: source.state === "patrol" || source.state === "combat" ? source.state : "guard", dead: Boolean(source.dead), tamedBy: source.tamedBy || null,
      boss: Boolean(source.boss), tameable: Boolean(source.tameable), tameProgress: clamp(source.tameProgress, 0, 100), targetId: null, alert: 0,
      detection: 0, lastSeenAt: 0, lastKnown: null, searchUntil: 0, path: [], pathIndex: 0, nextPathAt: 0,
      attackAt: 0, handled: Boolean(source.dead || source.tamedBy),
      slowUntil: 0, bleedUntil: 0, bleedDamage: 0, bleedOwnerId: null, nextBleedAt: 0
    };
    room.enemies.set(id, enemy); room.revision += 1;
    room.sockets.forEach((socket) => safeSend(socket, {
      type: "enemy_registered", accepted: true, enemyId: id,
      snapshot: this.snapshot(room, socket.ashenhold.playerId)
    }));
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
    const actionId = cleanId(event.actionId, "");
    let batch = actionId ? player.attackBatches.get(actionId) : null;
    if (batch && now - batch.startedAt > 2500) { player.attackBatches.delete(actionId); batch = null; }
    if (batch && batch.weapon !== weapon) return this.reject(player.socket, "ATTACK_BATCH", "That attack action is no longer valid.");
    if (!batch) {
      if (now - (player.lastAttackAt[weapon] || 0) < rule.cooldown) return this.reject(player.socket, "ATTACK_RATE", "Attack rate exceeded weapon rules.");
      batch = { weapon, startedAt: now, hits: 0, targets: new Map() };
      if (actionId) {
        player.attackBatches.set(actionId, batch);
        while (player.attackBatches.size > 24) player.attackBatches.delete(player.attackBatches.keys().next().value);
      }
      player.lastAttackAt[weapon] = now;
    }
    if (batch.hits >= rule.maxHits) return this.reject(player.socket, "ATTACK_BATCH", "That attack already reached its target limit.");
    const enemy = room.enemies.get(cleanId(event.targetId, ""));
    if (!enemy || enemy.dead || enemy.tamedBy) return this.reject(player.socket, "BAD_TARGET", "Target is not hostile.");
    const targetHits = batch.targets.get(enemy.id) || 0;
    if (targetHits >= 2) return this.reject(player.socket, "ATTACK_BATCH", "That target was already hit by this action.");
    const verticalTolerance = enemy.kind === "dragon" ? 70 : 35;
    if (distance2D(player, enemy) > rule.range + 2 || Math.abs(player.y - enemy.y) > verticalTolerance || !lineClear(room.navigation, player, enemy)) return this.reject(player.socket, "ATTACK_RANGE", "Target is out of range.");
    const amount = Math.floor(clamp(event.damage, 1, rule.maxDamage));
    batch.hits += 1; batch.targets.set(enemy.id, targetHits + 1);
    enemy.health = Math.max(0, enemy.health - amount);
    const effects = event.effects && typeof event.effects === "object" ? event.effects : {};
    if (enemy.health > 0 && enemy.tameable) {
      const maximumTameProgress = (weapon === "staff" ? 30 : 0) + (event.critical ? 55 : 0);
      enemy.tameProgress = clamp(enemy.tameProgress + Math.floor(clamp(effects.tameProgress, 0, maximumTameProgress)), 0, 100);
    }
    if (enemy.health > 0 && enemy.kind !== "dragon" && weapon === "staff") {
      const slowMs = Math.floor(clamp(effects.slowMs, 0, 2050));
      if (slowMs > 0) enemy.slowUntil = Math.max(enemy.slowUntil || 0, now + slowMs);
    }
    if (enemy.health > 0 && enemy.kind !== "dragon" && weapon === "blade") {
      const maximumBleed = Math.min(36, Math.max(0, Math.ceil(amount * .12)));
      const bleedDamage = Math.floor(clamp(effects.bleedDamage, 0, maximumBleed));
      if (bleedDamage > 0) {
        const extendingOwnBleed = enemy.bleedOwnerId === player.id && enemy.bleedUntil > now;
        enemy.bleedDamage = extendingOwnBleed ? Math.min(36, (enemy.bleedDamage || 0) + bleedDamage) : bleedDamage;
        enemy.bleedOwnerId = player.id;
        enemy.bleedUntil = now + 4000;
        if (!extendingOwnBleed || !enemy.nextBleedAt) enemy.nextBleedAt = now + 1000;
      }
    }
    if (enemy.health <= 0) {
      enemy.dead = true; enemy.handled = true; enemy.state = "dead"; enemy.targetId = null;
      const baseHeal = Math.max(3, Math.round((enemy.healthReward || 6) * .65));
      player.health = Math.min(player.maxHealth, player.health + baseHeal);
      player.healthTokens = Math.min(45, (player.healthTokens || 0) + 20);
    }
    room.revision += 1;
    this.queueEvent(room, "enemy_damage", {
      enemyId: enemy.id, playerId: player.id, weapon, amount, critical: Boolean(event.critical),
      health: enemy.health, dead: enemy.dead, tameProgress: enemy.tameProgress,
      slowUntil: enemy.slowUntil || 0, bleedUntil: enemy.bleedUntil || 0, playerHealth: player.health
    });
    if (enemy.strongholdId) this.checkStronghold(room, enemy.strongholdId);
    return true;
  }

  openChest(room, player, event) {
    const chest = room.chests.get(cleanId(event.chestId, ""));
    if (!chest) return this.reject(player.socket, "CHEST_NOT_FOUND", "Chest does not exist.");
    if (chest.claimedBy.has(player.id)) return this.reject(player.socket, "CHEST_CLAIMED", "You already claimed this chest.");
    if (distance2D(player, chest) > 3.5 || Math.abs(player.y - chest.y) > 1.8) return this.reject(player.socket, "CHEST_RANGE", "Stand in front of the chest on the same level.");
    if (!lineClear(room.navigation, player, chest)) return this.reject(player.socket, "CHEST_OCCLUDED", "The chest is obstructed.");
    chest.claimedBy.add(player.id); chest.opened = true;
    if (chest.powerUp.type === "health") {
      const growth = Math.ceil(player.maxHealth * clamp(chest.powerUp.amount, 1, 3) / 100) + 2;
      player.maxHealthAllowance = Math.min(100, (player.maxHealthAllowance || 0) + growth);
    }
    player.health = Math.min(player.maxHealth, player.health + 25);
    room.revision += 1;
    this.queueEvent(room, "chest_opened", { chestId: chest.id, playerId: player.id, powerUp: chest.powerUp, health: player.health });
    return true;
  }

  tame(room, player, event) {
    if (player.companionCount >= 2) return this.reject(player.socket, "COMPANION_LIMIT", "A Warden may bond only two companions.");
    const enemy = room.enemies.get(cleanId(event.enemyId, ""));
    if (!enemy || enemy.dead || enemy.tamedBy || !enemy.tameable) return this.reject(player.socket, "TAME_TARGET", "Creature cannot be tamed.");
    if (distance2D(player, enemy) > 4.2 || Math.abs(player.y - enemy.y) > 14 || !lineClear(room.navigation, player, enemy)) return this.reject(player.socket, "TAME_RANGE", "Move closer to the creature.");
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
    const healRatio = stronghold.kind === "fort" || stronghold.kind === "keep" ? .3 : .2;
    for (const player of room.players.values()) if (player.health > 0) player.health = Math.min(player.maxHealth, player.health + Math.round(player.maxHealth * healRatio));
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
        for (const [hitId, pending] of player.pendingHits || []) {
          if (now - pending.createdAt < 750) continue;
          player.pendingHits.delete(hitId);
          const before = player.health;
          player.health = Math.max(0, player.health - pending.rawDamage);
          room.revision += 1;
          if (player.health <= 0) this.promoteLivingHost(room, player.id);
          this.queueEvent(room, "player_damage", {
            hitId, playerId: player.id, enemyId: pending.enemyId,
            rawDamage: pending.rawDamage, amount: before - player.health,
            avoided: false, health: player.health, timedOut: true
          });
        }
        if (player.connected || now - player.lastSeenAt <= RECONNECT_GRACE_MS) continue;
        this.releasePlayerBonds(room, id);
        room.players.delete(id);
        if (room.hostId === id) {
          const successor = [...room.players.values()].filter((candidate) => candidate.connected && candidate.health > 0).sort((a, b) => a.joinedAt - b.joinedAt)[0];
          room.hostId = successor?.id || null;
          if (successor) this.queueEvent(room, "host_changed", { playerId: successor.id });
        }
      }
      if (!room.sockets.size && now - room.updatedAt > ROOM_TTL_MS) { this.rooms.delete(code); continue; }
      const aiElapsed = now - room.lastAiAt;
      if (room.worldReady && room.started && aiElapsed >= AI_STEP_MS) {
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
    const players = [...room.players.values()].filter((player) => player.connected && player.healthInitialized && player.health > 0);
    for (const enemy of room.enemies.values()) {
      if (enemy.dead) continue;
      if (enemy.bleedDamage > 0 && enemy.nextBleedAt > 0 && enemy.nextBleedAt <= now && enemy.nextBleedAt <= enemy.bleedUntil) {
        const lastEligibleTick = Math.min(now, enemy.bleedUntil);
        const tickCount = Math.min(4, Math.floor((lastEligibleTick - enemy.nextBleedAt) / 1000) + 1);
        const owner = room.players.get(enemy.bleedOwnerId);
        const amount = Math.min(enemy.health, Math.max(1, Math.floor(enemy.bleedDamage)) * tickCount);
        enemy.nextBleedAt += tickCount * 1000;
        enemy.health = Math.max(0, enemy.health - amount);
        if (enemy.health <= 0) {
          enemy.dead = true; enemy.handled = true; enemy.state = "dead"; enemy.targetId = null;
          if (owner && owner.health > 0) {
            const baseHeal = Math.max(3, Math.round((enemy.healthReward || 6) * .65));
            owner.health = Math.min(owner.maxHealth, owner.health + baseHeal);
            owner.healthTokens = Math.min(45, (owner.healthTokens || 0) + 20);
          }
        }
        this.queueEvent(room, "enemy_damage", {
          enemyId: enemy.id, playerId: owner?.id || null, weapon: "blade", source: "bleed",
          amount, critical: false, health: enemy.health, dead: enemy.dead,
          tameProgress: enemy.tameProgress, slowUntil: enemy.slowUntil || 0,
          bleedUntil: enemy.bleedUntil || 0, playerHealth: owner?.health
        });
        if (enemy.strongholdId) this.checkStronghold(room, enemy.strongholdId);
        if (enemy.dead) continue;
      }
      if (enemy.bleedUntil <= now || enemy.nextBleedAt > enemy.bleedUntil) {
        enemy.bleedDamage = 0; enemy.bleedOwnerId = null; enemy.nextBleedAt = 0;
      }
      if (enemy.tamedBy) {
        const owner = room.players.get(enemy.tamedBy);
        if (!owner || !owner.connected || owner.health <= 0) continue;
        enemy.state = "bonded"; enemy.targetId = null; enemy.alert = 0;
        const hostile = [...room.enemies.values()].filter((candidate) => candidate !== enemy && !candidate.dead && !candidate.tamedBy
          && (distance2D(candidate, owner) <= 28 || distance2D(candidate, enemy) <= 22))
          .sort((a, b) => distance2D(a, enemy) - distance2D(b, enemy))[0] || null;
        const side = [...room.enemies.values()].filter((candidate) => candidate.tamedBy === owner.id && !candidate.dead).findIndex((candidate) => candidate.id === enemy.id) % 2 ? 1 : -1;
        const follow = {
          x: owner.x + Math.cos(owner.rotation) * side * 2.2 + Math.sin(owner.rotation) * 3.2,
          z: owner.z - Math.sin(owner.rotation) * side * 2.2 + Math.cos(owner.rotation) * 3.2
        };
        const goal = hostile || follow;
        const goalDistance = distance2D(enemy, goal);
        const stopDistance = hostile ? Math.max(1.1, enemy.range * .8) : 2.3;
        if (goalDistance > stopDistance) {
          const path = findPath(room.navigation, enemy, goal);
          const waypoint = path[0];
          if (waypoint) {
            const dx = waypoint.x - enemy.x; const dz = waypoint.z - enemy.z; const length = Math.hypot(dx, dz) || 1;
            const step = Math.min(length, enemy.speed * 1.08 * (enemy.slowUntil > now ? .62 : 1) * dt);
            enemy.x += dx / length * step; enemy.z += dz / length * step;
            enemy.rotation = Math.atan2(-dx, -dz);
          }
        }
        if (hostile && distance2D(enemy, hostile) <= enemy.range && Math.abs(enemy.y - hostile.y) < 18
          && lineClear(room.navigation, enemy, hostile) && now >= enemy.attackAt) {
          enemy.attackAt = now + 700 + enemy.range * 90;
          const amount = Math.max(1, Math.round(enemy.damage * .72));
          hostile.health = Math.max(0, hostile.health - amount);
          if (hostile.health <= 0) {
            hostile.dead = true; hostile.handled = true; hostile.state = "dead"; hostile.targetId = null;
            const baseHeal = Math.max(3, Math.round((hostile.healthReward || 6) * .65));
            owner.health = Math.min(owner.maxHealth, owner.health + baseHeal);
            owner.healthTokens = Math.min(45, (owner.healthTokens || 0) + 20);
          }
          this.queueEvent(room, "enemy_damage", {
            enemyId: hostile.id, playerId: owner.id, companionId: enemy.id, weapon: "companion",
            amount, critical: false, health: hostile.health, dead: hostile.dead,
            tameProgress: hostile.tameProgress, playerHealth: owner.health
          });
          if (hostile.strongholdId) this.checkStronghold(room, hostile.strongholdId);
        }
        continue;
      }
      let target = enemy.targetId ? room.players.get(enemy.targetId) : null;
      if (!target || !target.connected || target.health <= 0) { target = null; enemy.targetId = null; }
      const home = { x: enemy.homeX, z: enemy.homeZ };
      const leash = enemy.strongholdId ? (enemy.role === "sentry" ? 40 : 30) : Infinity;
      if (target && distance2D(home, target) > leash) { target = null; enemy.targetId = null; }
      if (distance2D(home, enemy) > leash) {
        target = null; enemy.targetId = null; enemy.state = "return"; enemy.lastKnown = null;
        enemy.alert = 0; enemy.detection = 0;
      }
      const visible = players.map((player) => {
        const distance = distance2D(enemy, player);
        const direction = Math.atan2(-(player.x - enemy.x), -(player.z - enemy.z));
        const angle = Math.abs(Math.atan2(Math.sin(direction - enemy.rotation), Math.cos(direction - enemy.rotation)));
        const withinLeash = distance2D(home, player) <= leash;
        const canSee = withinLeash && distance <= enemy.sight && (enemy.state === "combat" || angle <= Math.PI * .38) && Math.abs(player.y - enemy.y) < (enemy.kind === "dragon" ? 80 : 18) && lineClear(room.navigation, enemy, player);
        const heard = withinLeash && distance <= 14 + (player.noise || 0) * 28;
        return { player, distance, canSee, heard };
      }).filter((candidate) => candidate.canSee || candidate.heard).sort((a, b) => a.distance - b.distance)[0];
      if (visible) {
        enemy.detection = clamp(enemy.detection + dt * (visible.canSee ? 1.5 : .65), 0, 1);
        enemy.lastKnown = { x: visible.player.x, z: visible.player.z };
        if (enemy.detection >= .45 || enemy.state === "combat") {
          target = visible.player; enemy.targetId = target.id; enemy.state = "combat"; enemy.alert = 1; enemy.lastSeenAt = now;
          for (const ally of room.enemies.values()) {
            if (ally === enemy || ally.dead || ally.tamedBy || distance2D(ally, enemy) > 24 || !lineClear(room.navigation, ally, enemy)) continue;
            ally.alert = Math.max(ally.alert, .65); ally.detection = Math.max(ally.detection, .2);
            ally.lastKnown = { x: target.x, z: target.z };
            if (["guard", "patrol", "return"].includes(ally.state)) {
              ally.state = "suspicious"; ally.searchUntil = now + 4200;
            }
          }
        } else if (enemy.state === "guard" || enemy.state === "patrol") {
          enemy.state = "suspicious"; enemy.searchUntil = now + 4200;
        }
      } else {
        enemy.detection = Math.max(0, enemy.detection - dt * .3);
        enemy.alert = Math.max(0, enemy.alert - dt * .18);
        if (enemy.state === "combat" && now - enemy.lastSeenAt > 1600) {
          enemy.state = "search"; enemy.searchUntil = now + 4200; enemy.targetId = null; target = null;
        }
        if (enemy.state === "search" && now >= enemy.searchUntil) { enemy.state = "return"; enemy.lastKnown = null; }
        if (enemy.state === "suspicious" && now >= enemy.searchUntil) { enemy.state = "return"; enemy.lastKnown = null; enemy.alert = 0; }
      }
      let goal = null; let moveSpeed = enemy.speed * (enemy.slowUntil > now ? .62 : 1);
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
          const waypoint = enemy.kind === "dragon" ? goal : enemy.path[enemy.pathIndex];
          if (waypoint) {
            const dx = waypoint.x - enemy.x; const dz = waypoint.z - enemy.z; const length = Math.hypot(dx, dz) || 1;
            const step = Math.min(length, moveSpeed * dt);
            enemy.x += dx / length * step; enemy.z += dz / length * step;
            enemy.rotation = Math.atan2(-dx, -dz);
            if (length < Math.max(.65, moveSpeed * dt * 1.5)) enemy.pathIndex += 1;
          }
        } else if (!target) {
          if (enemy.state === "return") { enemy.state = enemy.patrol.length ? "patrol" : "guard"; enemy.rotation = 0; }
          else if (enemy.state === "patrol") enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrol.length;
        }
      }
      const attackVerticalTolerance = enemy.kind === "dragon" ? 80 : 18;
      if (target && distance2D(enemy, target) <= enemy.range && Math.abs(enemy.y - target.y) < attackVerticalTolerance
        && lineClear(room.navigation, enemy, target) && now >= enemy.attackAt) {
        enemy.attackAt = now + 850 + enemy.range * 80;
        if (target.pendingHits.size >= 12) continue;
        const hitId = ++room.hitSequence;
        target.pendingHits.set(hitId, { hitId, enemyId: enemy.id, rawDamage: enemy.damage, healthBefore: target.health, createdAt: now });
        this.queueEvent(room, "player_hit", { hitId, playerId: target.id, enemyId: enemy.id, rawDamage: enemy.damage, source: enemy.name });
      }
    }
    room.revision += 1;
  }
}

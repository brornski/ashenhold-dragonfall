(() => {
  "use strict";

  const PROTOCOL_VERSION = 1;
  const STATE_RATE_MS = 50;
  const INTERPOLATION_MS = 110;
  const CLIENT_ID_KEY = "ashenhold.multiplayer.clientId";
  const SERVER_URL_KEY = "ashenhold.multiplayer.serverUrl";

  function safeStorage(storage, operation, ...args) {
    try { return storage?.[operation](...args); } catch { return null; }
  }

  function makeClientId() {
    const existing = safeStorage(window.sessionStorage, "getItem", CLIENT_ID_KEY);
    if (existing) return existing;
    const id = window.crypto?.randomUUID?.() || `warden-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    safeStorage(window.sessionStorage, "setItem", CLIENT_ID_KEY, id);
    return id;
  }

  function configuredUrl() {
    const explicit = String(window.ASHENHOLD_MULTIPLAYER_URL || "").trim();
    const stored = String(safeStorage(window.localStorage, "getItem", SERVER_URL_KEY) || "").trim();
    const meta = String(document.querySelector('meta[name="ashenhold-multiplayer-url"]')?.content || "").trim();
    const development = ["localhost", "127.0.0.1"].includes(window.location.hostname) ? "ws://127.0.0.1:8787/ws" : "";
    return explicit || stored || meta || development;
  }

  function normalizeUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (/^wss?:\/\//i.test(url)) return url;
    if (/^https?:\/\//i.test(url)) return url.replace(/^http/i, "ws");
    return `${window.location.protocol === "https:" ? "wss" : "ws"}://${url}`;
  }

  function interpolateNumber(from, to, ratio) {
    return Number(from || 0) + (Number(to || 0) - Number(from || 0)) * ratio;
  }

  function interpolateAngle(from, to, ratio) {
    let difference = Number(to || 0) - Number(from || 0);
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    return Number(from || 0) + difference * ratio;
  }

  class AshenholdMultiplayerClient {
    constructor(options = {}) {
      this.url = normalizeUrl(options.url || configuredUrl());
      this.clientId = options.clientId || makeClientId();
      this.socket = null;
      this.status = "offline";
      this.playerId = null;
      this.roomCode = "";
      this.realm = null;
      this.isHost = false;
      this.worldReady = false;
      this.started = false;
      this.snapshot = null;
      this.listeners = new Map();
      this.remoteTracks = new Map();
      this.enemyTracks = new Map();
      this.seenEvents = new Set();
      this.lastStateAt = 0;
      this.lastPingAt = 0;
      this.latency = null;
      this.serverOffset = 0;
      this.connectOptions = null;
      this.intentionalClose = false;
      this.reconnectAttempts = 0;
      this.reconnectTimer = null;
      this.connectPromise = null;
    }

    static get defaultUrl() { return normalizeUrl(configuredUrl()); }
    static get protocolVersion() { return PROTOCOL_VERSION; }

    on(type, listener) {
      if (typeof listener !== "function") return () => {};
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
      return () => this.off(type, listener);
    }

    off(type, listener) {
      this.listeners.get(type)?.delete(listener);
    }

    emit(type, detail) {
      this.listeners.get(type)?.forEach((listener) => {
        try { listener(detail); } catch (error) { console.error("[Ashenhold multiplayer listener]", error); }
      });
    }

    setServerUrl(url, persist = false) {
      if (this.socket) throw new Error("Disconnect before changing the multiplayer server.");
      this.url = normalizeUrl(url);
      if (persist) safeStorage(window.localStorage, "setItem", SERVER_URL_KEY, this.url);
      return this.url;
    }

    connect(options = {}) {
      if (this.connectPromise) return this.connectPromise;
      if (!this.url) return Promise.reject(new Error("No multiplayer server is configured."));
      if (this.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(this.socket.readyState)) return Promise.reject(new Error("Already connected to multiplayer."));
      this.connectOptions = {
        create: Boolean(options.create),
        roomCode: String(options.roomCode || "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6),
        name: String(options.name || "Warden").trim().slice(0, 24),
        biome: String(options.biome || "jungle"),
        seed: Math.max(1, Math.floor(Number(options.seed) || Date.now() % 9999999))
      };
      this.intentionalClose = false;
      this.setStatus(this.reconnectAttempts ? "reconnecting" : "connecting");
      this.connectPromise = new Promise((resolve, reject) => {
        let settled = false;
        const socket = new WebSocket(this.url);
        this.socket = socket;
        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          socket.close();
          reject(new Error("The multiplayer server did not answer in time."));
        }, 9000);
        socket.addEventListener("open", () => {
          this.sendRaw({ type: "hello", protocol: PROTOCOL_VERSION, clientId: this.clientId, ...this.connectOptions });
        });
        socket.addEventListener("message", (messageEvent) => {
          let message;
          try { message = JSON.parse(messageEvent.data); } catch { return; }
          this.handleMessage(message);
          if (!settled && message.type === "welcome") {
            settled = true; clearTimeout(timeout); resolve(message);
          } else if (!settled && message.type === "error") {
            settled = true; clearTimeout(timeout); reject(new Error(message.message || message.code));
          }
        });
        socket.addEventListener("error", () => this.emit("transport_error", { status: this.status }));
        socket.addEventListener("close", (event) => {
          clearTimeout(timeout);
          if (!settled) { settled = true; reject(new Error(event.reason || "The multiplayer connection closed.")); }
          this.connectPromise = null;
          this.socket = null;
          this.handleClose(event);
        });
      }).finally(() => { this.connectPromise = null; });
      return this.connectPromise;
    }

    handleMessage(message) {
      if (!message || typeof message.type !== "string") return;
      if (message.type === "welcome") {
        this.playerId = message.playerId;
        this.roomCode = message.roomCode;
        this.realm = message.realm;
        this.isHost = Boolean(message.isHost);
        this.worldReady = Boolean(message.worldReady);
        this.started = Boolean(message.started);
        this.reconnectAttempts = 0;
        this.setStatus("connected");
        if (message.snapshot) this.ingestSnapshot(message.snapshot);
        this.emit("welcome", message);
      } else if (message.type === "state") {
        this.ingestSnapshot(message.snapshot);
      } else if (message.type === "world_registered") {
        if (message.snapshot) this.ingestSnapshot(message.snapshot);
        if (message.accepted) this.worldReady = true;
        this.emit("world_registered", message);
      } else if (message.type === "event") {
        this.ingestEvent(message.event);
      } else if (message.type === "presence") {
        this.emit("presence", message);
      } else if (message.type === "pong") {
        const now = performance.now();
        this.latency = Math.max(0, Math.round(now - Number(message.sentAt || now)));
        this.emit("latency", this.latency);
      } else if (message.type === "error") {
        this.emit("server_error", message);
      }
      this.emit("message", message);
    }

    ingestSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== "object") return;
      const now = performance.now();
      const measuredOffset = Number(snapshot.serverAt || 0) - Date.now();
      this.serverOffset = this.serverOffset ? this.serverOffset * .9 + measuredOffset * .1 : measuredOffset;
      this.snapshot = snapshot;
      this.realm = snapshot.realm || this.realm;
      this.worldReady = Boolean(snapshot.worldReady);
      this.started = Boolean(snapshot.started);
      this.isHost = snapshot.hostId ? snapshot.hostId === this.playerId : this.isHost;
      this.updateTracks(this.remoteTracks, (snapshot.players || []).filter((player) => player.id !== this.playerId), now);
      this.updateTracks(this.enemyTracks, snapshot.enemies || [], now);
      for (const event of snapshot.recentEvents || []) this.ingestEvent(event);
      this.emit("snapshot", snapshot);
    }

    updateTracks(tracks, entries, now) {
      const active = new Set();
      for (const entry of entries) {
        active.add(entry.id);
        const previous = tracks.get(entry.id);
        const sampled = previous ? this.sampleTrack(previous, now) : entry;
        tracks.set(entry.id, { from: { ...sampled }, to: { ...entry }, startedAt: now, duration: INTERPOLATION_MS });
      }
      for (const id of tracks.keys()) if (!active.has(id)) tracks.delete(id);
    }

    sampleTrack(track, now = performance.now()) {
      const ratio = Math.min(1, Math.max(0, (now - track.startedAt) / track.duration));
      return {
        ...track.to,
        x: interpolateNumber(track.from.x, track.to.x, ratio),
        y: interpolateNumber(track.from.y, track.to.y, ratio),
        z: interpolateNumber(track.from.z, track.to.z, ratio),
        rotation: interpolateAngle(track.from.rotation, track.to.rotation, ratio)
      };
    }

    sampleRemotePlayers(now = performance.now()) {
      return [...this.remoteTracks.values()].map((track) => this.sampleTrack(track, now));
    }

    sampleEnemies(now = performance.now()) {
      return [...this.enemyTracks.values()].map((track) => this.sampleTrack(track, now));
    }

    ingestEvent(event) {
      if (!event || event.id == null || this.seenEvents.has(event.id)) return;
      this.seenEvents.add(event.id);
      if (this.seenEvents.size > 500) this.seenEvents.delete(this.seenEvents.values().next().value);
      this.emit("game_event", event);
      this.emit(`game_event:${event.type}`, event);
    }

    sendRaw(payload) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
      this.socket.send(JSON.stringify(payload));
      return true;
    }

    sendPlayerState(state, force = false) {
      const now = performance.now();
      if (!force && now - this.lastStateAt < STATE_RATE_MS) return false;
      this.lastStateAt = now;
      return this.sendRaw({ type: "player_state", state });
    }

    registerWorld(world) { return this.sendRaw({ type: "register_world", world }); }
    startRealm() { return this.sendRaw({ type: "start_realm" }); }
    sendHostEnemyState(enemies) { return this.sendRaw({ type: "host_enemy_state", enemies }); }
    attack(targetId, weapon, damage, critical = false) { return this.sendRaw({ type: "attack", targetId, weapon, damage, critical }); }
    openChest(chestId) { return this.sendRaw({ type: "open_chest", chestId }); }
    tame(enemyId) { return this.sendRaw({ type: "tame", enemyId }); }

    ping() {
      const now = performance.now();
      if (now - this.lastPingAt < 1000) return false;
      this.lastPingAt = now;
      return this.sendRaw({ type: "ping", sentAt: now });
    }

    getLocalPlayer() {
      return this.snapshot?.players?.find((player) => player.id === this.playerId) || null;
    }

    getChest(chestId) {
      return this.snapshot?.chests?.find((chest) => chest.id === chestId) || null;
    }

    setStatus(status) {
      if (this.status === status) return;
      this.status = status;
      this.emit("status", status);
    }

    handleClose(event) {
      this.setStatus(this.intentionalClose ? "offline" : "disconnected");
      this.emit("disconnect", { code: event.code, reason: event.reason, intentional: this.intentionalClose });
      if (this.intentionalClose || !this.connectOptions || !this.roomCode) return;
      this.reconnectAttempts += 1;
      const wait = Math.min(10000, 600 * (2 ** Math.min(4, this.reconnectAttempts - 1))) + Math.random() * 300;
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = window.setTimeout(() => {
        this.connect({ ...this.connectOptions, create: false, roomCode: this.roomCode }).catch((error) => this.emit("reconnect_error", error));
      }, wait);
    }

    disconnect() {
      this.intentionalClose = true;
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.connectOptions = null;
      if (this.socket) this.socket.close(1000, "Warden left the party");
      this.socket = null;
      this.setStatus("offline");
    }
  }

  window.AshenholdMultiplayer = Object.freeze({
    Client: AshenholdMultiplayerClient,
    PROTOCOL_VERSION,
    get defaultUrl() { return AshenholdMultiplayerClient.defaultUrl; }
  });
})();

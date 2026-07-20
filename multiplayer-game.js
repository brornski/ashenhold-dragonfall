(() => {
  "use strict";

  class AshenholdCoopRuntime {
    constructor(party, adapter) {
      if (!party?.client) throw new Error("AshenholdCoopRuntime requires an active party controller.");
      if (!adapter) throw new Error("AshenholdCoopRuntime requires a game adapter.");
      this.party = party;
      this.client = party.client;
      this.adapter = adapter;
      this.worldStartedLocally = false;
      this.worldRegistrationSent = false;
      this.startSent = false;
      this.lastAppliedRevision = -1;
      this.lastDiscreteSnapshot = null;
      this.disposers = [];
      this.stats = { snapshots: 0, events: 0, playerFrames: 0, worldRegistrations: 0, reconnects: 0 };
      this.bind();
    }

    bind() {
      this.disposers.push(this.client.on("welcome", (message) => {
        if (this.client.lastWelcomeWasReconnect) this.stats.reconnects += 1;
        this.lastAppliedRevision = -1;
        this.worldRegistrationSent = Boolean(message.worldReady);
        this.startSent = Boolean(message.started);
        this.adapter.onConnection?.(message);
        if (message.started && !this.worldStartedLocally) this.adapter.requestLocalStart?.("reconnect");
      }));
      this.disposers.push(this.client.on("world_registered", (message) => {
        if (message.accepted) {
          this.worldRegistrationSent = true;
          this.adapter.onWorldRegistered?.(message);
          if (this.worldStartedLocally && this.client.isHost && !this.client.started && !this.startSent) {
            this.startSent = this.client.startRealm();
          }
        }
      }));
      this.disposers.push(this.client.on("snapshot", (snapshot) => this.applyDiscreteSnapshot(snapshot)));
      this.disposers.push(this.client.on("game_event", (event) => {
        this.stats.events += 1;
        this.adapter.applyNetworkEvent?.(event, this.client.playerId);
        if (event.type === "realm_started") {
          this.startSent = true;
          if (!this.worldStartedLocally) this.adapter.requestLocalStart?.("party");
        } else if (event.type === "host_changed") {
          this.adapter.onHostChanged?.(event.playerId === this.client.playerId, event);
        }
      }));
      this.disposers.push(this.client.on("disconnect", (detail) => this.adapter.onDisconnect?.(detail)));
      this.disposers.push(this.client.on("status", (status) => {
        this.adapter.onNetworkStatus?.(status);
      }));
    }

    startWorld() {
      this.worldStartedLocally = true;
      if (!this.party.multiplayer) return false;
      if (this.client.snapshot) this.applyDiscreteSnapshot(this.client.snapshot, true);
      if (this.client.isHost && !this.client.worldReady && !this.worldRegistrationSent) {
        const world = this.adapter.serializeWorld?.();
        if (!world) throw new Error("The co-op host could not serialize the realm.");
        this.worldRegistrationSent = this.client.registerWorld(world);
        if (this.worldRegistrationSent) this.stats.worldRegistrations += 1;
      } else if (this.client.isHost && this.client.worldReady && !this.client.started && !this.startSent) {
        this.startSent = this.client.startRealm();
      }
      return true;
    }

    applyDiscreteSnapshot(snapshot, force = false) {
      if (!snapshot || (!force && Number(snapshot.revision) <= this.lastAppliedRevision)) return false;
      this.lastAppliedRevision = Number(snapshot.revision) || 0;
      this.lastDiscreteSnapshot = snapshot;
      this.stats.snapshots += 1;
      this.adapter.applyNetworkSnapshot?.(snapshot, this.client.playerId);
      return true;
    }

    update(dt) {
      if (!this.party.multiplayer || !this.worldStartedLocally) return false;
      const state = this.adapter.serializePlayer?.();
      if (state && this.client.sendPlayerState(state)) this.stats.playerFrames += 1;
      this.adapter.renderRemotePlayers?.(this.client.sampleRemotePlayers(), dt);
      this.adapter.renderNetworkEnemies?.(this.client.sampleEnemies(), dt);
      return true;
    }

    attack(targetId, weapon, damage, critical, actionId, effects) {
      return this.party.multiplayer && this.client.attack(targetId, weapon, damage, critical, actionId, effects);
    }

    openChest(chestId) {
      return this.party.multiplayer && this.client.openChest(chestId);
    }

    tame(enemyId) {
      return this.party.multiplayer && this.client.tame(enemyId);
    }

    snapshot() {
      return {
        active: Boolean(this.party.multiplayer),
        status: this.client.status,
        roomCode: this.client.roomCode,
        playerId: this.client.playerId,
        host: this.client.isHost,
        worldReady: this.client.worldReady,
        started: this.client.started,
        latency: this.client.latency,
        revision: this.lastAppliedRevision,
        remotePlayers: this.client.remoteTracks.size,
        networkEnemies: this.client.enemyTracks.size,
        stats: { ...this.stats }
      };
    }

    dispose() {
      this.disposers.splice(0).forEach((dispose) => dispose());
      this.adapter.disposeNetwork?.();
    }
  }

  window.AshenholdCoopRuntime = AshenholdCoopRuntime;
})();

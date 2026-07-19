(() => {
  "use strict";

  const NAME_KEY = "ashenhold.multiplayer.name";

  function storedName() {
    try { return window.localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
  }

  function saveName(name) {
    try { window.localStorage.setItem(NAME_KEY, name); } catch { /* storage is optional */ }
  }

  function currentRealm() {
    const snapshot = window.ashenholdGame?.snapshot?.();
    if (snapshot?.realm) return { biome: snapshot.realm.biome, seed: Number(snapshot.realm.seed) };
    const params = new URLSearchParams(window.location.search);
    return { biome: params.get("biome") || "jungle", seed: Number(params.get("seed")) || Math.floor(Date.now() % 9999999) + 1 };
  }

  function sanitizeRoom(value) {
    return String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
  }

  class PartyController {
    constructor() {
      this.client = window.AshenholdMultiplayer ? new window.AshenholdMultiplayer.Client() : null;
      this.mode = "solo";
      this.elements = {};
      this.initialized = false;
      this.redirecting = false;
      this.boundEnterGuard = false;
      this.init();
    }

    init() {
      const anchor = document.querySelector(".title-actions");
      if (!anchor || this.initialized) return;
      this.initialized = true;
      const party = document.createElement("section");
      party.className = "party-launch";
      party.setAttribute("aria-label", "Play mode and co-op party");
      party.innerHTML = `
        <div class="party-tabs" role="tablist" aria-label="Play mode">
          <button type="button" role="tab" data-party-mode="solo" aria-selected="true">SOLO</button>
          <button type="button" role="tab" data-party-mode="host" aria-selected="false">HOST CO-OP</button>
          <button type="button" role="tab" data-party-mode="join" aria-selected="false">JOIN ROOM</button>
        </div>
        <div class="party-panel" hidden>
          <label class="party-field party-name"><span>WARDEN NAME</span><input id="partyName" maxlength="24" autocomplete="nickname" spellcheck="false" placeholder="Warden"></label>
          <label class="party-field party-code"><span>ROOM CODE</span><input id="partyCode" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234"></label>
          <button id="partyConnect" class="party-connect" type="button">CREATE PARTY</button>
          <div class="party-session" hidden>
            <div><small>PARTY CODE</small><strong id="partyRoom">------</strong></div>
            <button id="partyCopy" type="button">COPY INVITE</button>
            <button id="partyLeave" type="button">LEAVE</button>
          </div>
        </div>
        <div class="party-status" aria-live="polite"><i></i><span id="partyStatus">SOLO REALM</span><b id="partyCount"></b></div>
        <div id="partyRoster" class="party-roster" aria-label="Party members"></div>`;
      anchor.insertAdjacentElement("afterend", party);
      this.elements = {
        root: party,
        tabs: [...party.querySelectorAll("[data-party-mode]")],
        panel: party.querySelector(".party-panel"),
        name: party.querySelector("#partyName"),
        code: party.querySelector("#partyCode"),
        connect: party.querySelector("#partyConnect"),
        session: party.querySelector(".party-session"),
        room: party.querySelector("#partyRoom"),
        copy: party.querySelector("#partyCopy"),
        leave: party.querySelector("#partyLeave"),
        status: party.querySelector("#partyStatus"),
        count: party.querySelector("#partyCount"),
        roster: party.querySelector("#partyRoster")
      };
      this.elements.name.value = storedName();
      this.elements.tabs.forEach((tab) => tab.addEventListener("click", () => this.selectMode(tab.dataset.partyMode)));
      this.elements.code.addEventListener("input", () => { this.elements.code.value = sanitizeRoom(this.elements.code.value); });
      this.elements.name.addEventListener("change", () => saveName(this.playerName()));
      this.elements.connect.addEventListener("click", () => this.connect());
      this.elements.copy.addEventListener("click", () => this.copyInvite());
      this.elements.leave.addEventListener("click", () => this.leave());
      this.bindClient();
      this.guardEnterButton();
      this.handleLaunchParameters();
    }

    bindClient() {
      if (!this.client) {
        this.setStatus("CO-OP CLIENT UNAVAILABLE", "error");
        return;
      }
      this.client.on("status", (status) => {
        const labels = { connecting: "CONTACTING REALM SERVER", reconnecting: "REJOINING PARTY", disconnected: "PARTY CONNECTION LOST", offline: this.mode === "solo" ? "SOLO REALM" : "CO-OP OFFLINE" };
        if (labels[status]) this.setStatus(labels[status], status === "disconnected" ? "error" : status);
      });
      this.client.on("welcome", (message) => this.onWelcome(message));
      this.client.on("snapshot", (snapshot) => this.renderRoster(snapshot.players || []));
      this.client.on("presence", () => this.renderRoster(this.client.snapshot?.players || []));
      this.client.on("world_registered", (message) => this.dispatch("world-registered", message));
      this.client.on("game_event:realm_started", (event) => {
        this.setStatus("PARTY ENTERING THE REALM", "ready");
        this.dispatch("realm-started", event);
      });
      this.client.on("game_event:host_changed", (event) => {
        if (event.playerId === this.client.playerId) this.setStatus("YOU ARE NOW PARTY HOST", "ready");
        this.dispatch("host-changed", event);
      });
      this.client.on("server_error", (error) => this.setStatus(error.message || error.code || "SERVER REJECTED ACTION", "error"));
      this.client.on("reconnect_error", () => this.setStatus("RETRYING PARTY CONNECTION", "error"));
    }

    guardEnterButton() {
      if (this.boundEnterGuard) return;
      const enter = document.getElementById("enterButton");
      if (!enter) return;
      this.boundEnterGuard = true;
      enter.addEventListener("click", (event) => {
        if (this.mode === "solo") return;
        if (!this.connected) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.setStatus("CONNECT TO A PARTY FIRST", "error");
          return;
        }
        if (!this.client.isHost && !this.client.started) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.setStatus("WAITING FOR THE PARTY HOST", "waiting");
          return;
        }
        this.dispatch("start-request", { isHost: this.client.isHost, started: this.client.started });
      }, true);
    }

    handleLaunchParameters() {
      const params = new URLSearchParams(window.location.search);
      const room = sanitizeRoom(params.get("room"));
      if (!room) return;
      this.elements.code.value = room;
      this.selectMode("join");
      if (params.get("name") && !this.elements.name.value) this.elements.name.value = String(params.get("name")).slice(0, 24);
      if (params.get("autojoin") === "1") window.setTimeout(() => this.connect(), 850);
    }

    selectMode(mode) {
      if (!['solo', 'host', 'join'].includes(mode)) return;
      if (this.connected && mode !== this.mode) this.leave(false);
      this.mode = mode;
      this.elements.root.dataset.mode = mode;
      this.elements.tabs.forEach((tab) => {
        const selected = tab.dataset.partyMode === mode;
        tab.setAttribute("aria-selected", String(selected));
        tab.classList.toggle("active", selected);
      });
      this.elements.panel.hidden = mode === "solo";
      this.elements.code.parentElement.hidden = mode !== "join";
      this.elements.connect.textContent = mode === "host" ? "CREATE PARTY" : "JOIN PARTY";
      if (mode === "solo") {
        this.elements.session.hidden = true;
        this.elements.roster.replaceChildren();
        this.setStatus("SOLO REALM", "solo");
      } else if (!this.client?.url) {
        this.setStatus("CO-OP SERVER NOT CONFIGURED", "error");
      } else {
        this.setStatus(mode === "host" ? "CREATE A FOUR-WARDEN PARTY" : "ENTER A SIX-CHARACTER ROOM CODE", "offline");
      }
      this.dispatch("mode", { mode });
    }

    playerName() {
      return String(this.elements.name.value || "Warden").replace(/[<>]/g, "").trim().slice(0, 24) || "Warden";
    }

    async connect() {
      if (!this.client || this.connected || this.client.status === "connecting") return;
      if (!this.client.url) { this.setStatus("CO-OP SERVER NOT CONFIGURED", "error"); return; }
      const roomCode = sanitizeRoom(this.elements.code.value);
      if (this.mode === "join" && roomCode.length !== 6) { this.setStatus("ENTER THE FULL SIX-CHARACTER CODE", "error"); return; }
      saveName(this.playerName());
      this.elements.connect.disabled = true;
      const realm = currentRealm();
      try {
        await this.client.connect({ create: this.mode === "host", roomCode, name: this.playerName(), biome: realm.biome, seed: realm.seed });
      } catch (error) {
        this.setStatus(error.message || "PARTY CONNECTION FAILED", "error");
      } finally {
        this.elements.connect.disabled = false;
      }
    }

    onWelcome(message) {
      const realm = currentRealm();
      if (!this.redirecting && message.realm && (message.realm.biome !== realm.biome || Number(message.realm.seed) !== Number(realm.seed))) {
        this.redirecting = true;
        this.setStatus("ALIGNING SHARED REALM", "connecting");
        try { window.sessionStorage.setItem("ashenhold-realm-v1", JSON.stringify(message.realm)); } catch { /* optional */ }
        const url = new URL(window.location.href);
        url.searchParams.set("biome", message.realm.biome);
        url.searchParams.set("seed", String(message.realm.seed));
        url.searchParams.set("room", message.roomCode);
        url.searchParams.set("autojoin", "1");
        url.searchParams.delete("test");
        window.location.replace(url.toString());
        return;
      }
      this.mode = message.isHost ? "host" : "join";
      this.elements.root.dataset.mode = this.mode;
      this.elements.panel.hidden = false;
      this.elements.session.hidden = false;
      this.elements.room.textContent = message.roomCode;
      this.elements.connect.hidden = true;
      this.elements.code.parentElement.hidden = true;
      this.setStatus(message.isHost ? "PARTY READY · YOU ARE HOST" : message.started ? "REALM IN PROGRESS · READY TO JOIN" : "CONNECTED · WAITING FOR HOST", "ready");
      this.renderRoster(message.snapshot?.players || []);
      this.dispatch("welcome", message);
      if (message.started) window.setTimeout(() => this.dispatch("realm-started", { reconnect: true }), 0);
    }

    renderRoster(players) {
      if (!this.connected) return;
      const connected = players.filter((player) => player.connected);
      this.elements.count.textContent = `${connected.length}/4`;
      this.elements.roster.replaceChildren(...connected.map((player) => {
        const item = document.createElement("span");
        item.style.setProperty("--warden-color", player.color || "#78cfdf");
        item.textContent = player.name + (player.id === this.client.playerId ? " · YOU" : "");
        return item;
      }));
    }

    async copyInvite() {
      if (!this.client?.roomCode) return;
      const url = new URL(window.location.href);
      url.searchParams.set("room", this.client.roomCode);
      url.searchParams.set("autojoin", "1");
      url.searchParams.delete("test");
      try {
        await navigator.clipboard.writeText(url.toString());
        this.elements.copy.textContent = "INVITE COPIED";
        window.setTimeout(() => { this.elements.copy.textContent = "COPY INVITE"; }, 1600);
      } catch {
        window.prompt("Copy this party invite:", url.toString());
      }
    }

    leave(selectSolo = true) {
      this.client?.disconnect();
      this.elements.connect.hidden = false;
      this.elements.session.hidden = true;
      this.elements.count.textContent = "";
      this.elements.roster.replaceChildren();
      if (selectSolo) this.selectMode("solo");
      this.dispatch("leave", {});
    }

    setStatus(label, state) {
      this.elements.status.textContent = label;
      this.elements.root.dataset.status = state || "offline";
    }

    dispatch(type, detail) {
      window.dispatchEvent(new CustomEvent(`ashenhold:party-${type}`, { detail }));
    }

    get connected() { return this.client?.status === "connected"; }
    get multiplayer() { return this.connected && this.mode !== "solo"; }
  }

  window.AshenholdParty = new PartyController();
})();

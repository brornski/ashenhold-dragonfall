(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const game = $("game");
  const viewport = $("viewport");
  const minimap = $("minimap");
  const mapContext = minimap.getContext("2d");
  const ui = {
    loading: $("loadingScreen"), title: $("titleScreen"), pause: $("pauseScreen"), end: $("endScreen"),
    loadingBar: $("loadingBar"), loadingText: $("loadingText"), enter: $("enterButton"), resume: $("resumeButton"),
    restart: $("restartButton"), playAgain: $("playAgainButton"), pauseButton: $("pauseButton"), soundButton: $("soundButton"),
    fullscreenButton: $("fullscreenButton"), health: $("healthBar"), healthText: $("healthText"), stamina: $("staminaBar"),
    shout: $("shoutBar"), shoutMeter: document.querySelector(".bar.shout"), questObjective: $("questObjective"),
    questProgress: $("questProgress"), objectiveNeedle: $("objectiveNeedle"), objectiveDistance: $("objectiveDistance"),
    objectiveName: $("objectiveName"),
    heading: $("heading"), target: $("dragonTarget"), dragonRank: $("dragonRank"), dragonName: $("dragonName"),
    dragonHealth: $("dragonHealthBar"), location: $("locationBanner"), message: $("message"), damage: $("damageFlash"),
    hitMarker: $("hitMarker"), interaction: $("interactionHint"), endKicker: $("endKicker"), endTitle: $("endTitle"),
    endCopy: $("endCopy"), finalKills: $("finalKills"), finalDistance: $("finalDistance"), finalExplored: $("finalExplored"),
    webglError: $("webglError"), joystick: $("joystick"), joystickKnob: $("joystickKnob"), lookPad: $("lookPad"),
    mobileAttack: $("mobileAttack"), mobileShout: $("mobileShout"), mobileJump: $("mobileJump"), mobileWeapon: $("mobileWeapon"),
    mobileDodge: $("mobileDodge"), mobileLock: $("mobileLock"), mobileSlide: $("mobileSlide"), mobileSkills: $("mobileSkills"),
    skills: $("skillsScreen"), skillsButton: $("skillsButton"), closeSkills: $("closeSkillsButton"),
    resetProgress: $("resetProgressButton"), skillBranches: $("skillBranches"), skillPointBadge: $("skillPointBadge"), mobileSkillPointBadge: $("mobileSkillPointBadge"),
    playerLevel: $("playerLevel"), levelXpBar: $("levelXpBar"), levelXpText: $("levelXpText"),
    weaponLevel: $("weaponLevel"), weaponXpBar: $("weaponXpBar"), weaponXpText: $("weaponXpText"),
    treePlayerLevel: $("treePlayerLevel"), treeLevelXpBar: $("treeLevelXpBar"), treeLevelXpText: $("treeLevelXpText"),
    treeWeaponLevel: $("treeWeaponLevel"), treeWeaponXpBar: $("treeWeaponXpBar"), treeWeaponXpText: $("treeWeaponXpText"),
    treeRunLevel: $("treeRunLevel"), treeRunXpBar: $("treeRunXpBar"), treeRunXpText: $("treeRunXpText"),
    treeSkillPoints: $("treeSkillPoints"), levelUp: $("levelUpBanner"), levelUpKicker: $("levelUpKicker"),
    weaponRack: $("weaponRack"), weaponHudName: $("weaponHudName"), treeWeaponName: $("treeWeaponName"),
    levelUpTitle: $("levelUpTitle"), levelUpCopy: $("levelUpCopy"), interactionText: $("interactionText"),
    strongholdHud: $("strongholdHud"), strongholdNumber: $("strongholdNumber"), strongholdProgress: $("strongholdProgressBar"), strongholdStatus: $("strongholdStatus"),
    sideQuestTitle: $("sideQuestTitle"), sideQuestObjective: $("sideQuestObjective"), finalStrongholds: $("finalStrongholds"),
    realmLabel: $("realmLabel"), combatText: $("combatText"), crosshair: $("crosshair"), biomeTag: $("biomeTag"),
    titleRealmName: $("titleRealmName"), titleSeed: $("titleSeed"), titleStrongholds: $("titleStrongholds"), titleWardenLevel: $("titleWardenLevel")
  };

  if (!window.THREE) {
    ui.loading.classList.remove("active");
    ui.webglError.classList.add("active");
    return;
  }

  const WORLD_SIZE = 1800;
  const HALF_WORLD = WORLD_SIZE / 2 - 18;
  const START = new THREE.Vector3(0, 0, 182);
  const RUINS = new THREE.Vector3(0, 0, -92);
  const RUNE_HOLLOW = new THREE.Vector3(68, 0, 126);
  // The title camera looks north toward Ashenhold Keep. Keep enough distance that
  // the 80-metre enclosure frames the menu instead of surrounding the camera.
  const TITLE_VANTAGE = new THREE.Vector3(0, 0, -20);
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const launchParams = new URLSearchParams(window.location.search);
  const testMode = launchParams.has("test");
  const loopbackAdminHost = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(window.location.hostname);
  const adminRequested = launchParams.has("admin");
  const adminMode = adminRequested && loopbackAdminHost;
  const persistenceDisabled = (testMode && !launchParams.has("test-save")) || adminMode;
  if (adminRequested && !adminMode) console.warn("Ashenhold admin mode is available only on a loopback URL.");
  const RUN_SAVE_KEY = "ashenhold-active-run-v1";
  const WORLD_ID = "ashenhold-continent-v1";
  const WORLD_LAYOUT_SIGNATURE = "ashenhold-authored-continent-8";
  const WORLD_LAYOUT_VERSION = 8;
  const LEGACY_WORLD_LAYOUT_VERSION = 7;
  // This number is a fixed art-direction key, not a generated map seed. It only
  // gives repeatable variation to foliage and small props on the one canonical map.
  const AUTHORED_WORLD_VARIATION = 0x41534845;
  const CANONICAL_WORLD_SCALE = Object.freeze({
    unitMeters: 1, wardenHeight: 1.9, doorHeight: 2.8, doorWidth: 2.4,
    houseHeight: [8, 12], castleWallHeight: [9, 15], gateHeight: [7, 10], towerHeight: [18, 32]
  });
  // Imported packs use unrelated source units. These targets are measured in the game's
  // canonical one-unit-per-meter space and converted from each loaded model's bounding box.
  const MODEL_SCALE_TARGETS = Object.freeze({
    tower: { role: "castle tower", targetHeight: 21 }, towerTop: { role: "tower crown", targetSpan: 15.5 },
    wall: { role: "castle wall", targetSpan: 16, targetHeight: 12.5 }, wallCorner: { role: "castle corner", targetSpan: 16, targetHeight: 12.5 },
    gate: { role: "castle gate", targetSpan: 14, targetHeight: 9.5 }, doorway: { role: "castle doorway", targetSpan: 14, targetHeight: 12.5 },
    stairs: { role: "castle stairs", targetSpan: 10 }, bridge: { role: "bridge", targetSpan: 18, targetHeight: 7.5 },
    bridgePillar: { role: "bridge pier", targetHeight: 14 }, siegeTower: { role: "siege tower", targetHeight: 17 },
    tavern: { role: "two-storey tavern", targetHeight: 10.5 }, market: { role: "market hall", targetHeight: 8.5 },
    blacksmith: { role: "blacksmith", targetHeight: 8.5 }, homeA: { role: "dwelling", targetHeight: 8.5 },
    homeB: { role: "dwelling", targetHeight: 9 }, windmill: { role: "windmill", targetHeight: 17 },
    towerA: { role: "watchtower", targetHeight: 19 }, towerB: { role: "watchtower", targetHeight: 22 },
    church: { role: "church", targetHeight: 13 }, ruinedHouse: { role: "ruined dwelling", targetHeight: 9 },
    crypt: { role: "crypt", targetHeight: 9.5 }, cryptA: { role: "crypt", targetHeight: 9 },
    cryptSmall: { role: "small crypt", targetHeight: 7.5 }, tree: { role: "old-growth tree", targetHeight: 32 },
    treePalm: { role: "coastal tree", targetHeight: 22 }, treePalmBend: { role: "jungle tree", targetHeight: 27 },
    treePineA: { role: "conifer", targetHeight: 27 }, treePineB: { role: "conifer", targetHeight: 30 },
    pineCrooked: { role: "crooked pine", targetHeight: 24 },
    ancientTreeA: { role: "ancient broadleaf hero", targetHeight: 58 },
    ancientTreeB: { role: "ancient broadleaf hero", targetHeight: 64 }
  });
  const AUTHORED_CASTLE_MATERIAL_IDS = new Set([
    "bridge", "bridgePillar", "gate", "stairs", "tower", "towerTop",
    "wall", "wallCorner", "doorway", "rock"
  ]);
  const SKY_PROFILES = Object.freeze({
    jungle: { id: "verdant-canopy", features: ["humid-cloud-decks", "sun-shafts", "green-gold-haze"], halo: [520, 230, -420], haloScale: 150 },
    shore: { id: "tempest-coast", features: ["coastal-sky-panorama", "sunbreak-clouds", "sea-horizon"], halo: [650, 145, -330], haloScale: 120 },
    desert: { id: "ember-dust", features: ["sandsky-panorama", "painted-cloud-bands", "ember-horizon"], halo: [720, 195, -210], haloScale: 190 },
    snowy: { id: "frozen-aurora", features: ["snowbound-panorama", "painted-cloud-mass", "violet-frost-horizon"], halo: [610, 205, -370], haloScale: 135 },
    mountains: { id: "high-altitude", features: ["graveyard-storm-panorama", "verdant-cloud-vortex", "sundered-horizon"], halo: [690, 235, -270], haloScale: 145 },
    moon: { id: "celestial-void", features: ["moonsky-panorama", "milky-way-arc", "violet-horizon"], halo: [690, 260, -160], haloScale: 105 }
  });
  const DESERT_SKYBOX_PATH = "assets/textures/skyboxes/ember-dunes-sandsky-2k.png";
  const MOON_SKYBOX_PATH = "assets/textures/skyboxes/moonfall-moonsky-2k.png";
  const SHORE_SKYBOX_PATH = "assets/textures/skyboxes/drowned-coast-skybox-2k.png";
  const SNOWY_SKYBOX_PATH = "assets/textures/skyboxes/frostbound-skyline-2k.png";
  const MOUNTAIN_SKYBOX_PATH = "assets/textures/skyboxes/skysunder-graveyard-skybox.jpg";
  const WARDEN_MODEL_PATH = "assets/models/hooded-shadow-assassin/scene.gltf";
  const WARDEN_MODEL_SCALE = 1.68;
  const WARDEN_MODEL_Y_OFFSET = 1.6;
  const BIOMES = {
    snowy: { name: "FROSTBOUND WILDS", textureId: "snow", relief: 1.05, base: 2.6, fog: 0x869ca6, fogDensity: .00195, ground: 0x718087, cliff: 0x7d898d, grass: 0x50625c, grassStrength: .42, frost: 0xc9d4d5, frostStart: 16, water: 0x315663, waterLevel: -3.2, waterOpacity: .62, sky: 0xb2c5ce, sun: 0xffead2, sunIntensity: 1.22, hemi: 0xa9bdc4, exposure: 1.1, skyZenith: 0x6b87a0, skyHorizon: 0xdfe9ec, skyGlow: 0xdceef4, stoneTint: 0xcfdde2, particleSize: 1.4, particleOpacity: .5, particleFall: .55, particleCount: 1 },
    jungle: { name: "VERDANT RUINS", textureId: "jungle", relief: .72, base: 3.2, fog: 0x1b352c, fogDensity: .00305, ground: 0x344a32, cliff: 0x465448, grass: 0x284b2d, grassStrength: 1.0, frost: 0x7a8a76, frostStart: 125, water: 0x1e514c, waterLevel: -2.4, waterOpacity: .72, sky: 0x71968d, sun: 0xffd5a7, sunIntensity: 1.12, hemi: 0x759a82, exposure: 1.02, skyZenith: 0x1d3a33, skyHorizon: 0x7fae8f, skyGlow: 0xe8c87a, stoneTint: 0x718a64, particleSize: 1.05, particleOpacity: .38, particleFall: .7, particleCount: .9 },
    desert: { name: "EMBER DUNES", textureId: "desert", relief: .56, base: 4.4, fog: 0x795b45, fogDensity: .00235, ground: 0x8d6d45, cliff: 0x76553c, grass: 0x7c7043, grassStrength: .12, frost: 0xbda27c, frostStart: 150, water: 0x315c66, waterLevel: -4.8, waterOpacity: .48, sky: 0xc7986f, sun: 0xffc780, sunIntensity: 1.5, hemi: 0xc69e78, exposure: 1.06, skyZenith: 0x8a5c3a, skyHorizon: 0xe8c98f, skyGlow: 0xff9a3a, stoneTint: 0xd8b083, particleSize: .8, particleOpacity: .3, particleFall: 1.8, particleCount: .85 },
    shore: { name: "DROWNED COAST", textureId: "shore", relief: .48, base: 1.8, fog: 0x425f65, fogDensity: .00285, ground: 0x77745f, cliff: 0x5e6b69, grass: 0x53624f, grassStrength: .52, frost: 0x9da7a2, frostStart: 110, water: 0x2a6f7c, waterLevel: .15, waterOpacity: .76, sky: 0x849da2, sun: 0xffd6ae, sunIntensity: 1.16, hemi: 0x8aa4a8, exposure: 1.0, skyZenith: 0x3f5a68, skyHorizon: 0x9fc4c4, skyGlow: 0xe8d8a8, stoneTint: 0x7f948e, particleSize: 1.2, particleOpacity: .34, particleFall: .5, particleCount: .9 },
    mountains: { name: "SKY-SUNDER PEAKS", textureId: "mountains", relief: 1.38, base: 2.1, fog: 0x465961, fogDensity: .00185, ground: 0x465054, cliff: 0x586267, grass: 0x3f5044, grassStrength: .38, frost: 0xd8dedd, frostStart: 28, water: 0x243f4a, waterLevel: -5.6, waterOpacity: .58, sky: 0x879ba6, sun: 0xffe6ca, sunIntensity: 1.3, hemi: 0x879ba4, exposure: 1.0, skyZenith: 0x4a5568, skyHorizon: 0xb8c4cc, skyGlow: 0xffd9a8, stoneTint: 0x868e94, particleSize: .9, particleOpacity: .26, particleFall: 1.1, particleCount: .8 },
    moon: { name: "MOONFALL EXPANSE", textureId: "moon", relief: .84, base: 2.8, fog: 0x1a1633, fogDensity: .00205, ground: 0x444550, cliff: 0x5c5d6b, grass: 0x4c5260, grassStrength: 0, frost: 0xa4a7ba, frostStart: 34, water: 0x111522, waterLevel: -9, waterOpacity: .18, sky: 0x30344d, sun: 0xc3ccff, sunIntensity: 1.05, hemi: 0x606986, exposure: .88, skyZenith: 0x101426, skyHorizon: 0x4a4e78, skyGlow: 0xb8c4ff, stoneTint: 0x9a9ec0, particleSize: .85, particleOpacity: .24, particleFall: .4, particleCount: .55 }
  };
  const BASE_BIOME_SETTINGS = Object.freeze(Object.keys(BIOMES).reduce((output, id) => {
    const source = BIOMES[id];
    output[id] = Object.freeze({
      ground: source.ground, cliff: source.cliff, grass: source.grass, fog: source.fog,
      frost: source.frost, sky: source.sky, sun: source.sun,
      fogDensity: source.fogDensity, exposure: source.exposure,
      treeDensity: id === "desert" ? 0 : 1, propDensity: 1, grassDensity: 1
    });
    return output;
  }, {}));
  const BIOME_IDS = Object.keys(BIOMES);
  const WORLD_OVERRIDE_SCHEMA_VERSION = 1;
  const EMPTY_WORLD_OVERRIDES = Object.freeze({
    schemaVersion: WORLD_OVERRIDE_SCHEMA_VERSION,
    worldSignature: WORLD_LAYOUT_SIGNATURE,
    entities: Object.freeze({}),
    biomes: Object.freeze({}),
    enemies: Object.freeze({ global: Object.freeze({}), byKind: Object.freeze({}) })
  });

  function overrideRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }

  function overrideNumber(value, minimum, maximum, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
  }

  function overrideColor(value) {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(0xffffff, Math.round(value)));
    if (typeof value !== "string" || !/^#?[0-9a-f]{6}$/i.test(value.trim())) return null;
    return parseInt(value.trim().replace(/^#/, ""), 16);
  }

  function overrideTexturePath(value) {
    if (typeof value !== "string" || value.length > 220 || !/^assets\/[a-z0-9_./-]+$/i.test(value)) return null;
    const segments = value.split("/");
    if (segments[0] !== "assets" || segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
    return /\.(?:png|jpe?g|webp)$/i.test(value) ? value : null;
  }

  function validateAdminDocumentInput(value, depth) {
    const level = depth || 0;
    if (level > 10) throw new Error("Editor document nesting is too deep.");
    if (!value || typeof value !== "object") return;
    Object.keys(value).forEach((key) => {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Editor document contains a forbidden property name.");
      validateAdminDocumentInput(value[key], level + 1);
    });
    if (level === 0) {
      if (value.schemaVersion !== WORLD_OVERRIDE_SCHEMA_VERSION || value.worldSignature !== WORLD_LAYOUT_SIGNATURE) throw new Error("Editor document schema or world signature does not match this build.");
      const entities = overrideRecord(value.entities) || {};
      Object.keys(entities).forEach((id) => {
        const entry = overrideRecord(entities[id]);
        if (entry && entry.texture !== undefined && !overrideTexturePath(entry.texture)) throw new Error("Invalid texture path for " + id + ". Use a PNG, JPEG, or WebP under assets/.");
      });
    }
  }

  function sanitizeWorldOverrides(source) {
    const raw = overrideRecord(source);
    if (!raw || raw.schemaVersion !== WORLD_OVERRIDE_SCHEMA_VERSION || raw.worldSignature !== WORLD_LAYOUT_SIGNATURE) {
      return JSON.parse(JSON.stringify(EMPTY_WORLD_OVERRIDES));
    }
    const output = {
      schemaVersion: WORLD_OVERRIDE_SCHEMA_VERSION,
      worldSignature: WORLD_LAYOUT_SIGNATURE,
      entities: {}, biomes: {}, enemies: { global: {}, byKind: {} }
    };
    const entities = overrideRecord(raw.entities) || {};
    Object.keys(entities).slice(0, 2400).forEach((id) => {
      if (["__proto__", "prototype", "constructor"].includes(id) || !/^[a-z0-9:_-]{1,120}$/i.test(id)) return;
      const entry = overrideRecord(entities[id]);
      if (!entry) return;
      const clean = {};
      if (typeof entry.type === "string" && /^[a-z-]{1,30}$/i.test(entry.type)) clean.type = entry.type;
      if (typeof entry.label === "string") clean.label = entry.label.slice(0, 100);
      if (typeof entry.modelSlot === "string" && /^[a-z0-9_-]{1,64}$/i.test(entry.modelSlot)) clean.modelSlot = entry.modelSlot;
      const position = overrideRecord(entry.position);
      if (position) clean.position = {
        x: overrideNumber(position.x, -HALF_WORLD, HALF_WORLD, 0),
        y: overrideNumber(position.y, -200, 600, 0),
        z: overrideNumber(position.z, -HALF_WORLD, HALF_WORLD, 0)
      };
      if (entry.rotationY !== undefined) clean.rotationY = overrideNumber(entry.rotationY, -Math.PI * 8, Math.PI * 8, 0);
      const scale = overrideRecord(entry.scale);
      if (scale) clean.scale = {
        x: overrideNumber(scale.x, .02, 25, 1),
        y: overrideNumber(scale.y, .02, 25, 1),
        z: overrideNumber(scale.z, .02, 25, 1)
      };
      const color = overrideColor(entry.color);
      if (color != null) clean.color = "#" + color.toString(16).padStart(6, "0");
      const texture = overrideTexturePath(entry.texture);
      if (texture) clean.texture = texture;
      const lifecycleEditable = clean.type === "model" || clean.type === "custom-model";
      if (lifecycleEditable && typeof entry.visible === "boolean") clean.visible = entry.visible;
      if (lifecycleEditable && typeof entry.deleted === "boolean") clean.deleted = entry.deleted;
      if (typeof entry.collision === "boolean") clean.collision = entry.collision;
      const enemy = overrideRecord(entry.enemy);
      if (enemy) clean.enemy = {
        health: overrideNumber(enemy.health, 1, 100000, undefined),
        maxHealth: overrideNumber(enemy.maxHealth, 1, 100000, undefined),
        damage: overrideNumber(enemy.damage, 0, 10000, undefined),
        speed: overrideNumber(enemy.speed, 0, 250, undefined),
        attackRange: overrideNumber(enemy.attackRange, .1, 250, undefined),
        attackInterval: overrideNumber(enemy.attackInterval, .05, 60, undefined),
        sightRange: overrideNumber(enemy.sightRange, .1, 500, undefined),
        tracking: overrideNumber(enemy.tracking, .05, 10, undefined)
      };
      output.entities[id] = clean;
    });
    const biomeFields = ["ground", "cliff", "grass", "fog", "frost", "sky", "sun"];
    const biomes = overrideRecord(raw.biomes) || {};
    BIOME_IDS.forEach((id) => {
      const entry = overrideRecord(biomes[id]);
      if (!entry) return;
      const clean = {};
      biomeFields.forEach((field) => {
        const color = overrideColor(entry[field]);
        if (color != null) clean[field] = "#" + color.toString(16).padStart(6, "0");
      });
      clean.fogDensity = overrideNumber(entry.fogDensity, 0, .025, undefined);
      clean.exposure = overrideNumber(entry.exposure, .15, 4, undefined);
      clean.treeDensity = overrideNumber(entry.treeDensity, 0, 3, undefined);
      clean.propDensity = overrideNumber(entry.propDensity, 0, 3, undefined);
      clean.grassDensity = overrideNumber(entry.grassDensity, 0, 3, undefined);
      Object.keys(clean).forEach((field) => { if (clean[field] === undefined) delete clean[field]; });
      output.biomes[id] = clean;
    });
    const multiplierFields = ["health", "damage", "speed", "attackRange", "sightRange", "tracking", "attackRate"];
    const cleanMultipliers = (entry) => {
      const clean = {};
      const record = overrideRecord(entry) || {};
      multiplierFields.forEach((field) => {
        const value = overrideNumber(record[field], .05, 10, undefined);
        if (value !== undefined) clean[field] = value;
      });
      return clean;
    };
    const enemies = overrideRecord(raw.enemies) || {};
    output.enemies.global = cleanMultipliers(enemies.global);
    const byKind = overrideRecord(enemies.byKind) || {};
    Object.keys(byKind).slice(0, 32).forEach((kind) => {
      if (!["__proto__", "prototype", "constructor"].includes(kind) && /^[a-z0-9_-]{1,40}$/i.test(kind)) output.enemies.byKind[kind] = cleanMultipliers(byKind[kind]);
    });
    return output;
  }

  let editorDocument = sanitizeWorldOverrides(window.AshenholdWorldOverrides || EMPTY_WORLD_OVERRIDES);
  Object.keys(editorDocument.biomes).forEach((id) => {
    const target = BIOMES[id];
    const source = editorDocument.biomes[id];
    if (!target || !source) return;
    ["ground", "cliff", "grass", "fog", "frost", "sky", "sun"].forEach((field) => {
      if (source[field]) target[field] = parseInt(source[field].slice(1), 16);
    });
    if (source.fogDensity !== undefined) target.fogDensity = source.fogDensity;
    if (source.exposure !== undefined) target.exposure = source.exposure;
  });
  const CONTINENT_ZONES = Object.freeze([
    Object.freeze({ id: "shore", name: BIOMES.shore.name, center: Object.freeze({ x: -590, z: 360 }), bounds: Object.freeze({ minX: -900, maxX: -300, minZ: -40, maxZ: 900 }), skybox: SKY_PROFILES.shore.id }),
    Object.freeze({ id: "jungle", name: BIOMES.jungle.name, center: Object.freeze({ x: 0, z: 255 }), bounds: Object.freeze({ minX: -300, maxX: 300, minZ: -120, maxZ: 900 }), skybox: SKY_PROFILES.jungle.id }),
    Object.freeze({ id: "desert", name: BIOMES.desert.name, center: Object.freeze({ x: 590, z: 360 }), bounds: Object.freeze({ minX: 300, maxX: 900, minZ: -40, maxZ: 900 }), skybox: SKY_PROFILES.desert.id }),
    Object.freeze({ id: "snowy", name: BIOMES.snowy.name, center: Object.freeze({ x: -590, z: -410 }), bounds: Object.freeze({ minX: -900, maxX: -300, minZ: -900, maxZ: -40 }), skybox: SKY_PROFILES.snowy.id }),
    Object.freeze({ id: "mountains", name: BIOMES.mountains.name, center: Object.freeze({ x: 0, z: -520 }), bounds: Object.freeze({ minX: -300, maxX: 300, minZ: -900, maxZ: -120 }), skybox: SKY_PROFILES.mountains.id }),
    Object.freeze({ id: "moon", name: BIOMES.moon.name, center: Object.freeze({ x: 590, z: -410 }), bounds: Object.freeze({ minX: 300, maxX: 900, minZ: -900, maxZ: -40 }), skybox: SKY_PROFILES.moon.id })
  ]);
  const CONTINENT_ZONE_BY_ID = new Map(CONTINENT_ZONES.map((zone) => [zone.id, zone]));
  const SHORE_WATER_RADIUS = 520;
  const PLAYER_WADING_DEPTH = .55;
  const WATERLINE_MARGIN = .35;
  const STYLIZED_WATER_SOURCE = "https://github.com/cortiz2894/stylized-components/tree/b182d81bff64531e584f50d71f046ae05fab3c87/src/components/waterFloor";
  const STYLIZED_WATER_STYLE = "cortiz-anime-voronoi";
  const WATER_RIPPLE_CAPACITY = isCoarse ? 0 : 6;
  const TREELESS_BIOME_IDS = new Set(["desert"]);
  const TREE_LOD_FOREST_BIOME_IDS = Object.freeze(["shore", "jungle", "snowy", "mountains"]);
  const TREE_LOD_FOREST_EXCLUDED_BIOME_IDS = new Set(["desert", "moon"]);
  const TREE_LOD_FOREST_ENABLED = true;
  const PROCEDURAL_TREE_GENERATION_ENABLED = false;
  const TREE_LOD_MODEL_IDS = new Set(["treeLod0", "treeLod1", "treeLod2"]);
  const TREE_MODEL_IDS = new Set([
    "tree", "treePalm", "treePalmBend", "treePineA", "treePineB",
    "pineCrooked", "ancientTreeA", "ancientTreeB", "treeLod0", "treeLod1", "treeLod2"
  ]);
  const TREE_PROP_KINDS = new Set(["snowPine", "broadleaf", "palm", "windPine", "darkPine"]);

  function biomeIdAt(x, z) {
    let nearest = CONTINENT_ZONES[0];
    let nearestScore = Infinity;
    CONTINENT_ZONES.forEach((zone) => {
      const dx = Number(x) - zone.center.x;
      const dz = Number(z) - zone.center.z;
      const score = dx * dx + dz * dz;
      if (score < nearestScore) { nearest = zone; nearestScore = score; }
    });
    return nearest.id;
  }

  function biomeAllowsTreesAt(x, z) {
    return !TREELESS_BIOME_IDS.has(biomeIdAt(x, z));
  }

  function biomeAllowsTreeLodForestAt(x, z) {
    return TREE_LOD_FOREST_BIOME_IDS.includes(biomeIdAt(x, z));
  }

  function waterLevelAt(x, z) {
    return BIOMES[biomeIdAt(x, z)].waterLevel;
  }

  function biomeBlendWeights(x, z) {
    let total = 0;
    const weights = CONTINENT_ZONES.map((zone) => {
      const dx = x - zone.center.x;
      const dz = z - zone.center.z;
      const distanceSquared = dx * dx + dz * dz;
      const weight = Math.pow(1 / (1 + distanceSquared / 105000), 3.2);
      total += weight;
      return { id: zone.id, weight };
    });
    weights.forEach((entry) => { entry.weight /= Math.max(.000001, total); });
    return weights;
  }

  let currentBiomeId = biomeIdAt(START.x, START.z);

  const WORLD_PROFILES = {
    snowy: {
      geometry: "glacial", road: { wander: 4.2, frequency: 2.1, width: 6.1, color: 0x64727a },
      forts: [[178,90,-.15,4.25,"RIMEWATCH HOLD"],[-265,-230,.28,4.45,"WHITEFANG BASTION"],[310,238,-.45,4.6,"AURORA GARRISON"]],
      routes: [[-122,112,-5.1,-5.8,10,"ICEFALL ASCENT"],[238,-268,5.2,-5.4,10,"RIME SPIRE"]],
      lightEnemy: ["yeti","RIMEBOUND YETI","GLACIAL STALKER",.98,0xb8d8dd], heavyEnemy: ["birb","FROST ROC","BLIZZARD ELITE",1.32,0xd5edf0],
      dragonNames: ["SKALDR","WINTERMAW","PALEWING","HOARCLAW"]
    },
    jungle: {
      geometry: "karst", road: { wander: 9.5, frequency: 3.7, width: 5.6, color: 0x554a35 },
      forts: [[196,118,.18,4.25,"MOSSWATCH HOLD"],[-218,-248,-.42,4.5,"SUNKEN BASTION"],[326,266,.66,4.65,"CANOPY GARRISON"]],
      routes: [[-96,116,-6.0,-5.1,10,"CANOPY STEPS"],[252,-286,5.6,-4.7,10,"TEMPLE SPINE"]],
      lightEnemy: ["tribal","VERDANT REAVER","THORNBOUND HUNTER",1.0,0x87b879], heavyEnemy: ["orc","MOSSBACK ORC","OVERGROWN ELITE",1.28,0x6f9f62],
      dragonNames: ["VINEWING","MIREMAW","THORNCLAW","SPOREBREATH"]
    },
    desert: {
      geometry: "dunes", road: { wander: 12, frequency: 1.45, width: 6.8, color: 0x8b6744 },
      forts: [[-188,102,-.4,4.2,"CINDER WATCH"],[278,-188,.22,4.55,"SUNSCAR CITADEL"],[-326,-228,-.7,4.7,"DUNEWARD KEEP"]],
      routes: [[-118,88,-5.7,-6.2,11,"MESA ASCENT"],[250,-244,5.7,-5.0,10,"SUNSPIRE" ]],
      lightEnemy: ["cactoro","DUNE CACTORO","BARBED STALKER",1.0,0xd19b59], heavyEnemy: ["demon","EMBER DEMON","SCORCHED ELITE",1.3,0xe77845],
      dragonNames: ["CINDERMAW","DUNEREND","SUNWING","GLASSCLAW"]
    },
    shore: {
      geometry: "archipelago", road: { wander: 15, frequency: 2.8, width: 5.1, color: 0x6d6653 },
      forts: [[184,-42,.52,4.15,"TIDEBREAK WATCH"],[-228,212,-.3,4.4,"SALTWORN BASTION"],[318,258,.92,4.55,"STORMTIDE GARRISON"]],
      routes: [[-104,126,-5.4,-5.7,11,"CLIFFWALK"],[236,-250,5.8,-4.9,11,"LIGHTHOUSE RISE"]],
      lightEnemy: ["fish","TIDEBORN RAIDER","ABYSSAL HUNTER",1.02,0x76b7b3], heavyEnemy: ["frog","REEF STALKER","BRINE ELITE",1.34,0x6aa38e],
      dragonNames: ["TIDEWING","BRINEMAW","REEFCLAW","TEMPEST FIN"]
    },
    mountains: {
      geometry: "alpine", road: { wander: 7.5, frequency: 4.1, width: 5.4, color: 0x5d5550 },
      forts: [[-182,148,.22,4.25,"EAGLE WATCH"],[224,-238,-.5,4.5,"THUNDER BASTION"],[356,68,.32,4.75,"SKYWARD GARRISON"]],
      routes: [[-142,126,-5.5,-5.0,12,"EAGLE SWITCHBACK"],[242,-226,5.0,-5.6,12,"THUNDER SPINE"]],
      lightEnemy: ["monkroose","RIDGEBORN MONK","CLIFF HUNTER",1.0,0x9da79d], heavyEnemy: ["orc-skull","SKULLPEAK ORC","STONE ELITE",1.32,0x8d9290],
      dragonNames: ["SKYREND","THUNDERMAW","CRAGWING","PEAKCLAW"]
    },
    moon: {
      geometry: "craters", road: { wander: 5.8, frequency: 5.2, width: 6.0, color: 0x565568 },
      forts: [[152,192,-.18,4.2,"ECLIPSE WATCH"],[-282,-124,.54,4.45,"DARKSIDE BASTION"],[304,-252,-.36,4.7,"STARFALL GARRISON"]],
      routes: [[-112,114,-5.8,-5.4,11,"CRATER CAUSEWAY"],[230,-246,5.5,-5.2,11,"ECLIPSE SPINE"]],
      lightEnemy: ["alien","VOIDKIN","CRATER STALKER",1.0,0xa6a7d8], heavyEnemy: ["blue-demon","ECLIPSE DEMON","VOID ELITE",1.3,0x7779c9],
      dragonNames: ["VOIDWING","ECLIPSE MAW","STARCLAW","NIGHTFALL"]
    }
  };

  function readActiveRunEnvelope() {
    if (persistenceDisabled) return null;
    try {
      const saved = JSON.parse(window.localStorage.getItem(RUN_SAVE_KEY) || "null");
      if (!saved || saved.status !== "active") return null;
      const legacy = saved.layoutVersion === LEGACY_WORLD_LAYOUT_VERSION && saved.realm && BIOMES[saved.realm.biome];
      if (saved.layoutVersion !== WORLD_LAYOUT_VERSION && !legacy) return null;
      if (saved.worldId && saved.worldId !== WORLD_ID) return null;
      if (legacy) {
        saved.migratedFromRealm = { biome: saved.realm.biome, seedIgnored: Number(saved.realm.seed) || null };
        saved.layoutVersion = WORLD_LAYOUT_VERSION;
      }
      saved.worldId = WORLD_ID;
      delete saved.realm;
      return saved;
    } catch (error) {
      console.warn("Active run save could not be read", error);
      return null;
    }
  }

  const storedRunEnvelope = readActiveRunEnvelope();
  // `realm` remains as a small compatibility alias for older gameplay helpers.
  // It is fixed and is never persisted, rotated, requested, or exposed as a map seed.
  const realm = Object.freeze({ biome: "jungle" });
  const biome = BIOMES[realm.biome];
  const worldProfile = WORLD_PROFILES[realm.biome];
  const importedStoneTint = new THREE.Color(biome.stoneTint || 0xffffff);
  const importedWoodTint = new THREE.Color(biome.stoneTint || 0xffffff).lerp(new THREE.Color(0xffffff), .58);
  game.dataset.biome = currentBiomeId;
  let pendingRunState = storedRunEnvelope;

  let renderer;
  let scene;
  let camera;
  let sun;
  let sunTarget;
  let terrain;
  let sky;
  let waterSurfaces = [];
  let waterRippleCursor = 0;
  let waterRippleTimer = 0;
  let waterWasWading = false;
  let waterRipplesEmitted = 0;
  let stoneMaterial;
  let darkStoneMaterial;
  let worldWoodMaterial;
  let worldIronMaterial;
  let worldFoliageMaterial;
  let worldAsh;
  let grassField;
  let grassBaseCount = 0;
  let grassBaseDensity = 1;
  let state = "loading";
  let lastTime = performance.now();
  let elapsed = 0;
  let cameraYaw = 0;
  let cameraPitch = .12;
  let cameraDistance = 8.2;
  let cameraShoulderSide = 1;
  let cameraShoulderCurrent = 1.55;
  let cameraReady = false;
  let pointerWasLocked = false;
  let suppressPointerPause = false;
  let frameCount = 0;
  let nextLightning = 8.5;
  let stormFlash = 0;
  let nearestTarget = null;
  let runResolving = false;
  let hitStopRemaining = 0;
  let cameraTrauma = 0;
  let lockedTarget = null;
  let targetScanTimer = 0;
  let hudRefreshTimer = 0;
  let minimapRefreshTimer = 0;
  let qualityScale = 1;
  let qualitySeconds = 0;
  let qualityFrames = 0;
  let bossSpawned = false;
  let questStage = 0;
  let discoveredCells = new Set();
  let colliders = [];
  let dragons = [];
  let bolts = [];
  let fireballs = [];
  let effects = [];
  let fires = [];
  let landmarks = [];
  let platforms = [];
  let verticalRouteReports = [];
  let biomePropsReport = { kind: "none", total: 0, byKind: {} };
  let importedModelInstances = 0;
  let modelScaleRegistry = {};
  let skyReport = { id: "unbuilt", signature: "", features: [], featureCount: 0, gradientStops: 0, horizonBlend: false };
  let forestChunks = [];
  let biomePropMeshes = [];
  let forestVisibilityTimer = 0;
  let forestReport = {
    profile: "owner-tree-lods-pending", enabled: false, total: 0, heroes: 0, chunks: 0, visible: 0,
    nearChunks: 0, midChunks: 0, farChunks: 0, culledChunks: 0, nearTrees: 0, midTrees: 0, farTrees: 0,
    instancedMeshes: 0, heroColliders: 0, maxTrunkDiameter: 0,
    assetHeroes: 0, proceduralHeroes: 0, heroVariants: []
  };
  let treePopulationReport = {
    total: 0,
    byBiome: Object.fromEntries(BIOME_IDS.map((id) => [id, 0])),
    bySource: {}
  };
  let infrastructureReport = { total: 0, byKind: {}, colliders: 0, importedModels: 0 };
  let captureFlags = [];
  let groundEnemies = [];
  let experienceRunes = [];
  let chests = [];
  let dragonSouls = [];
  let runesCollected = 0;
  let strongholds = [];
  let worldSpawnFailures = 0;
  let playerNoiseRadius = 0;
  let playerNoiseTime = 0;
  let playerNoiseReason = "quiet";
  let garrisonAIStats = { repaths: 0, stuckRecoveries: 0, alertsShared: 0 };
  let coopRuntime = null;
  let remoteWardenRenderer = null;
  let networkNavigationCache = null;
  let multiplayerBootReady = false;
  let applyingNetworkState = false;
  let networkBossRegistrationPending = false;
  let networkAttackSequence = 0;
  const networkActionNonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  let networkLocalTransformHydratedFor = null;
  let networkLeaveReloading = false;
  const networkStats = {
    worldSerializations: 0, snapshotsApplied: 0, eventsApplied: 0,
    attacksSent: 0, chestRequests: 0, tameRequests: 0,
    enemyFrames: 0, bossRegistrations: 0, disconnects: 0
  };
  let outpostsDiscovered = 0;
  let runeHinted = false;
  const visualAssets = {};
  const keys = new Set();
  const mobileMove = new THREE.Vector2();
  const tempV = new THREE.Vector3();
  const tempV2 = new THREE.Vector3();
  const tempQ = new THREE.Quaternion();
  const raycaster = new THREE.Raycaster();
  const adminEntities = new Map();
  const adminModelCounters = new Map();
  let adminPlacementContext = null;
  const adminHistory = [];
  let adminHistoryIndex = -1;
  let adminSelectedId = null;
  let adminSelectionHelper = null;
  let adminGizmo = null;
  let adminDrag = null;
  let adminRevision = 0;
  let adminUiLoaded = false;
  const adminControls = {
    mode: "freecam", transformMode: "translate", simulationPaused: true,
    input: new Set(), snap: { translate: 1, rotate: 15, scale: .1 },
    freecamYaw: 0, freecamPitch: 0, speed: 34, noclipReturn: null
  };

  const encounterRng = { state: (AUTHORED_WORLD_VARIATION ^ 0x6d2b79f5) >>> 0 };
  const slideTestSurfaceCache = {};

  function recordTreePopulation(biomeId, count, source) {
    const amount = Math.max(0, Math.floor(Number(count) || 0));
    if (!amount) return;
    treePopulationReport.total += amount;
    treePopulationReport.byBiome[biomeId] = (treePopulationReport.byBiome[biomeId] || 0) + amount;
    treePopulationReport.bySource[source] = (treePopulationReport.bySource[source] || 0) + amount;
  }

  function networkIdPart(value) {
    return String(value == null ? "" : value).replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 52) || "actor";
  }

  function nextNetworkActionId(label) {
    networkAttackSequence += 1;
    const playerSuffix = (partyController()?.client?.playerId || "warden").slice(-10);
    return networkIdPart(playerSuffix + "-" + networkActionNonce + "-" + (label || "attack").slice(0, 12) + "-" + networkAttackSequence);
  }

  function ensureStableNetworkIds() {
    dragons.forEach((dragon, index) => {
      if (!dragon.networkId) dragon.networkId = dragon.boss ? "dragon-boss-vharok" : "dragon-" + networkIdPart(dragon.name) + "-" + index;
    });
    groundEnemies.forEach((enemy, index) => {
      if (enemy.networkId) return;
      enemy.networkId = enemy.spawnKey
        ? "garrison-" + networkIdPart(enemy.spawnKey)
        : "ground-" + networkIdPart(enemy.kind) + "-" + Math.round(enemy.root.position.x * 10) + "-" + Math.round(enemy.root.position.z * 10) + "-" + index;
    });
  }

  function buildNetworkNavigation() {
    if (networkNavigationCache) return networkNavigationCache;
    const startedAt = performance.now();
    const cellSize = 8;
    const originX = -WORLD_SIZE / 2;
    const originZ = -WORLD_SIZE / 2;
    const width = Math.ceil(WORLD_SIZE / cellSize);
    const height = Math.ceil(WORLD_SIZE / cellSize);
    const blockedFlags = new Uint8Array(width * height);
    const heights = new Float32Array(width * height);
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const index = row * width + column;
        const x = originX + (column + .5) * cellSize;
        const z = originZ + (row + .5) * cellSize;
        const y = terrainHeight(x, z);
        heights[index] = y;
        const sample = 1.25;
        const slope = Math.max(
          Math.abs(terrainHeight(x + sample, z) - terrainHeight(x - sample, z)),
          Math.abs(terrainHeight(x, z + sample) - terrainHeight(x, z - sample))
        ) / (sample * 2);
        if (y <= waterLevelAt(x, z) + .38 || slope > 1.05) blockedFlags[index] = 1;
      }
    }
    const clearance = cellSize * .35;
    colliders.forEach((box) => {
      const cosine = Math.cos(box.rotation || 0);
      const sine = Math.sin(box.rotation || 0);
      const extentX = Math.abs(cosine) * box.hx + Math.abs(sine) * box.hz + clearance;
      const extentZ = Math.abs(sine) * box.hx + Math.abs(cosine) * box.hz + clearance;
      const firstColumn = clamp(Math.floor((box.x - extentX - originX) / cellSize), 0, width - 1);
      const lastColumn = clamp(Math.floor((box.x + extentX - originX) / cellSize), 0, width - 1);
      const firstRow = clamp(Math.floor((box.z - extentZ - originZ) / cellSize), 0, height - 1);
      const lastRow = clamp(Math.floor((box.z + extentZ - originZ) / cellSize), 0, height - 1);
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const index = row * width + column;
          if (blockedFlags[index]) continue;
          const y = heights[index];
          if (y + .08 >= box.maxY - .025 || y + 3.35 <= box.minY + .025) continue;
          const x = originX + (column + .5) * cellSize;
          const z = originZ + (row + .5) * cellSize;
          const dx = x - box.x;
          const dz = z - box.z;
          const localX = dx * cosine - dz * sine;
          const localZ = dx * sine + dz * cosine;
          const nearestX = clamp(localX, -box.hx, box.hx);
          const nearestZ = clamp(localZ, -box.hz, box.hz);
          if ((localX - nearestX) ** 2 + (localZ - nearestZ) ** 2 < clearance ** 2) blockedFlags[index] = 1;
        }
      }
    });
    const blockedRuns = [];
    let blockedCells = 0;
    for (let index = 0; index < blockedFlags.length;) {
      if (!blockedFlags[index]) { index += 1; continue; }
      const first = index;
      while (index < blockedFlags.length && blockedFlags[index]) { blockedCells += 1; index += 1; }
      blockedRuns.push(first, index - first);
    }
    networkStats.navigationMs = Math.round((performance.now() - startedAt) * 10) / 10;
    networkStats.navigationCells = width * height;
    networkStats.blockedCells = blockedCells;
    networkNavigationCache = { cellSize, width, height, originX, originZ, blockedRuns };
    return networkNavigationCache;
  }

  function serializeNetworkEnemy(enemy) {
    const ai = enemy.ai;
    const home = enemy.kind === "dragon" ? enemy.home : ai ? ai.home : enemy.root.position;
    const role = enemy.kind === "dragon" ? (enemy.boss ? "boss" : "dragon") : ai ? ai.role : "guard";
    return {
      id: enemy.networkId,
      name: enemy.name,
      kind: enemy.kind,
      boss: Boolean(enemy.boss),
      x: enemy.root.position.x, y: enemy.root.position.y, z: enemy.root.position.z,
      homeX: home.x, homeZ: home.z, rotation: enemy.root.rotation.y,
      health: enemy.health, maxHealth: enemy.maxHealth,
      speed: enemy.speed || 7,
      range: enemy.kind === "dragon" ? (enemy.boss ? 45 : 35) : enemy.attackRange,
      damage: enemy.kind === "dragon" ? Math.round((enemy.boss ? 30 : 22) * (enemy.damageScale || 1)) : enemy.damage,
      healthReward: enemy.healthReward || 6,
      sight: enemy.kind === "dragon" ? 100 : roleSightProfile(enemy).range,
      role,
      patrol: enemy.kind === "dragon"
        ? [{ x: home.x, z: home.z }]
        : ai ? ai.patrol.map((point) => ({ x: point.x, z: point.z })) : [],
      strongholdId: enemy.strongholdId || null,
      state: enemy.dead ? "dead" : enemy.tamed ? "bonded" : ai ? ai.state : enemy.engaged ? "combat" : "patrol",
      dead: Boolean(enemy.dead),
      tamedBy: enemy.tamed && window.AshenholdParty?.client?.playerId || null,
      tameable: isTameableEnemy(enemy) || enemy.tamed,
      tameProgress: enemy.tameProgress || 0
    };
  }

  function serializeNetworkWorld() {
    const startedAt = performance.now();
    ensureStableNetworkIds();
    networkStats.worldSerializations += 1;
    const world = {
      layoutVersion: WORLD_LAYOUT_VERSION,
      worldId: WORLD_ID,
      layoutSignature: WORLD_LAYOUT_SIGNATURE,
      navigation: buildNetworkNavigation(),
      strongholds: strongholds.map((stronghold) => ({
        id: stronghold.id, name: stronghold.name, kind: stronghold.kind,
        x: stronghold.x, z: stronghold.z, cleared: stronghold.cleared,
        flagRaised: Boolean(stronghold.captureFlag && stronghold.captureFlag.root.visible)
      })),
      enemies: dragons.concat(groundEnemies).map(serializeNetworkEnemy),
      chests: chests.map((chest) => ({
        id: chest.id,
        x: chest.root.position.x, y: chest.root.position.y, z: chest.root.position.z,
        opened: chest.opened,
        powerUp: Object.assign({}, chest.powerUp),
        claimedBy: chest.opened && window.AshenholdParty?.client?.playerId ? [window.AshenholdParty.client.playerId] : []
      }))
    };
    networkStats.worldSerializeMs = Math.round((performance.now() - startedAt) * 10) / 10;
    networkStats.worldBytes = new TextEncoder().encode(JSON.stringify({ type: "register_world", world })).byteLength;
    return world;
  }

  function partyController() {
    return window.AshenholdParty && window.AshenholdParty.client ? window.AshenholdParty : null;
  }

  function partyModeSelected() {
    const party = partyController();
    return Boolean(party && party.mode !== "solo");
  }

  function multiplayerConnected() {
    const party = partyController();
    return Boolean(party && party.multiplayer && party.client.status === "connected");
  }

  function multiplayerWorldActive() {
    return Boolean(coopRuntime && coopRuntime.worldStartedLocally && partyModeSelected());
  }

  function multiplayerActionReady() {
    const client = partyController()?.client;
    return Boolean(multiplayerWorldActive() && multiplayerConnected() && client?.worldReady && client.started);
  }

  function partyStartAllowed(reason) {
    const party = partyController();
    if (!party || party.mode === "solo") return true;
    if (!party.connected) {
      party.setStatus?.("CONNECT TO A PARTY FIRST", "error");
      showMessage("CONNECT TO A PARTY FIRST", "#e99a73");
      return false;
    }
    const serverApproved = reason === "party" || reason === "reconnect";
    if (!party.client.isHost && !party.client.started && !serverApproved) {
      party.setStatus?.("WAITING FOR THE PARTY HOST", "waiting");
      showMessage("WAITING FOR THE PARTY HOST", "#91a5ad");
      return false;
    }
    return true;
  }

  function serializeNetworkPlayer() {
    if (!player.root) return null;
    return {
      x: player.root.position.x,
      y: player.root.position.y,
      z: player.root.position.z,
      rotation: player.root.rotation.y,
      health: player.health,
      maxHealth: maxHealth(),
      stamina: player.stamina,
      weapon: player.activeWeapon,
      moving: Boolean(player.moving),
      sprinting: Boolean(player.sprinting),
      superSprinting: Boolean(player.superSprinting),
      sliding: Boolean(player.sliding),
      airborne: !player.grounded,
      attacking: player.attackTime > 0,
      companionCount: groundEnemies.filter(isOwnedCompanion).length,
      noise: clamp(playerNoiseRadius / 42, 0, 1)
    };
  }

  function registerNetworkMaxHealthUpgrade(source, count, totalAmount) {
    if (!multiplayerActionReady() || !coopRuntime?.maxHealthUpgrade) return false;
    let remainingAmount = Math.max(1, Math.round(Number(totalAmount) || 1));
    let remainingCount = Math.max(1, Math.floor(Number(count) || 1));
    let sent = false;
    while (remainingCount > 0) {
      const amount = Math.max(1, Math.round(remainingAmount / remainingCount));
      sent = coopRuntime.maxHealthUpgrade(source, amount) || sent;
      remainingAmount -= amount;
      remainingCount -= 1;
    }
    if (sent) partyController()?.client?.sendPlayerState(serializeNetworkPlayer(), true);
    return sent;
  }

  function isOwnedCompanion(enemy) {
    return Boolean(enemy && enemy.tamed && !enemy.dead && !enemy.networkExcluded
      && (!multiplayerWorldActive() || enemy.networkTamedBy === partyController()?.client?.playerId));
  }

  function networkEnemyById(id) {
    if (!id) return null;
    ensureStableNetworkIds();
    return dragons.concat(groundEnemies).find((enemy) => enemy.networkId === id) || null;
  }

  function materializeNetworkEnemy(source) {
    if (!source?.id) return null;
    let enemy = networkEnemyById(source.id);
    const sourceBoss = Boolean(source.boss || source.id === "dragon-boss-vharok");
    if (enemy && source.kind && (enemy.kind !== source.kind || Boolean(enemy.boss) !== sourceBoss)) {
      scene.remove(enemy.root);
      if (enemy.kind === "dragon") dragons = dragons.filter((item) => item !== enemy);
      else {
        groundEnemies = groundEnemies.filter((item) => item !== enemy);
        strongholds.forEach((stronghold) => { stronghold.members = stronghold.members.filter((item) => item !== enemy); });
        disposeGroundEnemy(enemy);
      }
      enemy = null;
    }
    if (enemy) return enemy;
    if (source.kind === "dragon") {
      enemy = createDragon(source.name || "ANCIENT DRAGON", Number(source.x) || 0, Number(source.z) || 0, sourceBoss, source.id);
      if (sourceBoss) {
        bossSpawned = true;
        questStage = Math.max(questStage, 2);
      }
    } else {
      enemy = createGroundEnemy(source.kind || "biomeLight", Number(source.x) || 0, Number(source.z) || 0, 1, source.id);
      enemy.name = source.name || enemy.name;
      enemy.strongholdId = source.strongholdId || null;
      const stronghold = strongholds.find((item) => item.id === enemy.strongholdId);
      if (stronghold && !stronghold.members.includes(enemy)) stronghold.members.push(enemy);
    }
    enemy.networkMaterialized = true;
    return enemy;
  }

  function applyNetworkStatusEffects(enemy, source, serverAt) {
    if (!enemy || !source) return;
    const authoritativeNow = Number(serverAt) || 0;
    if (Object.prototype.hasOwnProperty.call(source, "slowUntil")) {
      enemy.slowTime = Math.max(0, ((Number(source.slowUntil) || 0) - authoritativeNow) / 1000);
    }
    if (Object.prototype.hasOwnProperty.call(source, "bleedUntil")) {
      enemy.bleedTime = Math.max(0, ((Number(source.bleedUntil) || 0) - authoritativeNow) / 1000);
      enemy.bleedStacks = enemy.bleedTime > 0 ? Math.max(1, enemy.bleedStacks || 0) : 0;
    }
  }

  function applyNetworkEnemyState(enemy, source, localPlayerId, rewardDeath, serverAt) {
    if (!enemy || !source) return;
    const wasDead = enemy.dead;
    enemy.networkId = source.id;
    enemy.networkExcluded = false;
    enemy.networkTamedBy = source.tamedBy || null;
    enemy.kind = source.kind || enemy.kind;
    enemy.boss = Boolean(source.boss || source.id === "dragon-boss-vharok");
    enemy.name = source.name || enemy.name;
    enemy.strongholdId = source.strongholdId || enemy.strongholdId || null;
    enemy.maxHealth = Math.max(1, Number(source.maxHealth) || enemy.maxHealth);
    enemy.health = clamp(Number(source.health), 0, enemy.maxHealth);
    if (Number.isFinite(Number(source.speed))) enemy.speed = Number(source.speed);
    if (Number.isFinite(Number(source.range))) enemy.attackRange = Number(source.range);
    if (Number.isFinite(Number(source.damage))) enemy.damage = Number(source.damage);
    if (Number.isFinite(Number(source.healthReward))) enemy.healthReward = Number(source.healthReward);
    enemy.tameProgress = clamp(Number(source.tameProgress) || 0, 0, 100);
    applyNetworkStatusEffects(enemy, source, serverAt);
    enemy.networkState = source.state || "guard";
    enemy.networkRole = source.role || "guard";
    enemy.engaged = source.state === "combat";
    enemy.strongholdHandled = Boolean(source.dead || source.tamedBy);
    const locallyBonded = Boolean(source.tamedBy && source.tamedBy === localPlayerId);
    if (locallyBonded && !enemy.tamed) tameEnemy(enemy, true, true);
    if (!locallyBonded && enemy.tamed) {
      enemy.tamed = false;
      if (enemy.originalName) enemy.name = source.name || enemy.originalName;
    }
    if (!source.dead && !source.tamedBy && isTameableEnemy(enemy) && (enemy.tameProgress >= 100 || enemy.health / enemy.maxHealth <= .5)) setEnemyTameReady(enemy, true);
    if (source.dead && !wasDead) {
      enemy.dead = true;
      enemy.health = 0;
      enemy.deathTime = 0;
      clearDragonFireTelegraph(enemy);
      if (enemy.kind !== "dragon") {
        clearEnemyTelegraph(enemy);
        setEnemyAction(enemy, "death", true);
      }
    }
    else if (!source.dead && wasDead) {
      enemy.dead = false;
      enemy.deathTime = 0;
      if (!enemy.root.parent) scene.add(enemy.root);
    }
    enemy.dead = Boolean(source.dead);
    enemy.root.visible = !enemy.dead;
  }

  function applyChestOpenedVisual(chest) {
    if (!chest) return;
    chest.opened = true;
    chest.openTime = .5;
    chest.lid.rotation.x = -1.9;
    chest.marker.material.opacity = .12;
    chest.lockMaterial.visible = false;
  }

  function applyNetworkSnapshot(snapshot, localPlayerId) {
    if (!snapshot || !multiplayerWorldActive()) return false;
    applyingNetworkState = true;
    try {
      networkStats.snapshotsApplied += 1;
      ensureStableNetworkIds();
      const authoritativeIds = new Set();
      (snapshot.enemies || []).forEach((source) => {
        authoritativeIds.add(source.id);
        const enemy = materializeNetworkEnemy(source);
        applyNetworkEnemyState(enemy, source, localPlayerId, false, snapshot.serverAt);
        if (source.id === "dragon-boss-vharok") networkBossRegistrationPending = false;
      });
      dragons.concat(groundEnemies).forEach((enemy) => {
        const registered = authoritativeIds.has(enemy.networkId);
        const pendingBoss = enemy.boss && enemy.networkId === "dragon-boss-vharok" && networkBossRegistrationPending && partyController()?.client?.isHost;
        enemy.networkExcluded = !registered && !pendingBoss;
        if (enemy.networkExcluded) enemy.root.visible = false;
        else if (!enemy.dead) enemy.root.visible = true;
      });
      (snapshot.strongholds || []).forEach((source) => {
        const stronghold = strongholds.find((item) => item.id === source.id);
        if (!stronghold) return;
        stronghold.cleared = Boolean(source.cleared);
        updateStrongholdMarker(stronghold);
        setCaptureFlag(stronghold, Boolean(source.flagRaised || source.cleared), false);
      });
      (snapshot.chests || []).forEach((source) => {
        const chest = chests.find((item) => item.id === source.id);
        if (!chest) return;
        chest.networkOpened = Boolean(source.opened);
        chest.networkClaimed = Boolean(source.claimed);
        if (source.opened) applyChestOpenedVisual(chest);
      });
      const localState = (snapshot.players || []).find((entry) => entry.id === localPlayerId);
      if (localState?.healthInitialized) {
        const hydrationKey = String(snapshot.roomCode || "") + ":" + String(localPlayerId || "");
        if (networkLocalTransformHydratedFor !== hydrationKey && player.root) {
          player.root.position.set(Number(localState.x) || 0, Number(localState.y) || 0, Number(localState.z) || 0);
          player.root.rotation.y = Number(localState.rotation) || 0;
          player.stamina = clamp(Number(localState.stamina), 0, maxStamina());
          networkLocalTransformHydratedFor = hydrationKey;
        }
        player.health = clamp(Number(localState.health), 0, maxHealth());
        if (player.health <= 0 && state === "playing") endGame(false, "Your Warden fell while defending the shared realm.");
      }
      player.dragonKills = dragons.filter((dragon) => !dragon.boss && dragon.dead && !dragon.networkExcluded).length;
      const serverBoss = (snapshot.enemies || []).find((enemy) => enemy.boss || enemy.id === "dragon-boss-vharok");
      if (serverBoss) {
        bossSpawned = true;
        questStage = serverBoss.dead ? 3 : Math.max(Math.min(questStage, 2), 2);
      } else {
        bossSpawned = false;
        questStage = Math.min(questStage, 1);
        if (player.dragonKills >= 3 && questStage >= 1 && partyController()?.client?.isHost) {
          const localBoss = dragons.find((dragon) => dragon.networkId === "dragon-boss-vharok");
          if (localBoss) {
            localBoss.networkExcluded = false;
            localBoss.root.visible = !localBoss.dead;
            bossSpawned = true;
            questStage = 2;
            registerNetworkBoss(localBoss);
          } else spawnBoss();
        }
      }
      updateStrongholdUI();
      updateQuestUI();
      if (serverBoss?.dead) checkRunCompletion();
      return true;
    } finally {
      applyingNetworkState = false;
    }
  }

  function applyNetworkEvent(event, localPlayerId) {
    if (!event || !multiplayerWorldActive()) return false;
    applyingNetworkState = true;
    try {
      networkStats.eventsApplied += 1;
      if (event.type === "enemy_damage") {
        const source = partyController()?.client?.snapshot?.enemies?.find((enemy) => enemy.id === event.enemyId);
        const enemy = networkEnemyById(event.enemyId) || materializeNetworkEnemy(source);
        if (!enemy) return false;
        enemy.health = clamp(Number(event.health), 0, enemy.maxHealth);
        enemy.tameProgress = clamp(Number(event.tameProgress) || 0, 0, 100);
        applyNetworkStatusEffects(enemy, event, event.serverAt);
        enemy.lastDamageSource = event.playerId === localPlayerId && event.weaponCredit ? "weapon" : "network";
        enemy.lastWeaponId = event.weaponCredit && WEAPONS[event.weapon] ? event.weapon : null;
        if (enemy.health > 0 && isTameableEnemy(enemy) && (enemy.tameProgress >= 100 || enemy.health / enemy.maxHealth <= .5)) setEnemyTameReady(enemy);
        if (event.playerId === localPlayerId) {
          showHit(false);
          audio.hit();
          spawnCombatText(enemy.root.position, String(event.amount), event.critical ? "crit" : "hit");
          if (event.masteryHit && WEAPONS[event.weapon]) {
            grantWeaponXp(Math.min(Number(event.amount) || 0, enemy.maxHealth), event.weapon);
          }
        }
        if (event.dead && !enemy.dead) {
          const rewarded = event.playerId === localPlayerId;
          killDragon(enemy, rewarded, true);
          if (rewarded) partyController()?.client?.sendPlayerState(serializeNetworkPlayer(), true);
        }
        return true;
      }
      if (event.type === "player_hit" && event.playerId === localPlayerId) {
        damagePlayer(Number(event.rawDamage) || 1, event.source || "ENEMY", true);
        partyController()?.client?.acknowledgeHit(event.hitId, player.health, maxHealth());
        return true;
      }
      if (event.type === "player_damage" && event.playerId === localPlayerId) {
        player.health = clamp(Number(event.health), 0, maxHealth());
        if (player.health <= 0 && state === "playing") endGame(false, "Your Warden fell while defending the shared realm.");
        return true;
      }
      if (event.type === "chest_opened") {
        const chest = chests.find((item) => item.id === event.chestId);
        if (!chest) return false;
        chest.networkOpened = true;
        applyChestOpenedVisual(chest);
        if (event.playerId === localPlayerId && !chest.networkRewarded) {
          chest.networkClaimed = true;
          grantChestReward(chest, event.powerUp || chest.powerUp);
          chest.networkRewarded = true;
        }
        return true;
      }
      if (event.type === "enemy_tamed") {
        const enemy = networkEnemyById(event.enemyId);
        if (!enemy) return false;
        enemy.networkTamedBy = event.playerId;
        enemy.strongholdHandled = true;
        if (event.playerId === localPlayerId && !enemy.tamed) tameEnemy(enemy, false, true);
        else if (event.playerId !== localPlayerId) {
          enemy.tamed = false;
          if (lockedTarget === enemy) lockedTarget = null;
          if (nearestTarget === enemy) nearestTarget = null;
        }
        return true;
      }
      if (event.type === "stronghold_cleared") {
        const stronghold = strongholds.find((item) => item.id === event.strongholdId);
        if (stronghold && !stronghold.cleared) clearStronghold(stronghold, true);
        if (stronghold) setCaptureFlag(stronghold, Boolean(event.flagRaised || stronghold.cleared), true);
        return Boolean(stronghold);
      }
      return false;
    } finally {
      applyingNetworkState = false;
    }
  }

  function renderRemoteWardens(players, dt) {
    if (!remoteWardenRenderer && window.AshenholdRemoteWardens && scene) remoteWardenRenderer = new window.AshenholdRemoteWardens(scene);
    return remoteWardenRenderer ? remoteWardenRenderer.sync(players, dt) : 0;
  }

  function renderNetworkEnemies(samples, dt) {
    if (!multiplayerWorldActive()) return 0;
    let rendered = 0;
    (samples || []).forEach((sample) => {
      const enemy = networkEnemyById(sample.id) || materializeNetworkEnemy(sample);
      if (!enemy || enemy.networkExcluded || enemy.dead || sample.dead) {
        if (enemy) enemy.root.visible = false;
        return;
      }
      enemy.root.visible = true;
      const sampleX = Number(sample.x) || 0;
      const sampleZ = Number(sample.z) || 0;
      const sampleY = enemy.kind === "dragon" ? Number(sample.y) || terrainHeight(sampleX, sampleZ) + 16 : terrainHeight(sampleX, sampleZ);
      enemy.root.position.set(sampleX, sampleY, sampleZ);
      enemy.root.rotation.y = Number(sample.rotation) || 0;
      enemy.networkState = sample.state || enemy.networkState;
      if (enemy.kind === "dragon") {
        const flap = Math.sin(elapsed * 4.8 + enemy.phase) * .34;
        enemy.leftWing.rotation.z = -.16 + flap;
        enemy.rightWing.rotation.z = .16 - flap;
      } else if (enemy.mixer) {
        const moving = sample.state === "combat" || sample.state === "return" || sample.state === "search" || sample.state === "bonded";
        setEnemyAction(enemy, moving ? "run" : "idle");
        enemy.mixer.update(dt);
      }
      rendered += 1;
    });
    networkStats.enemyFrames += 1;
    return rendered;
  }

  function restoreLocalNetworkActors() {
    remoteWardenRenderer?.clear();
    if (!networkLeaveReloading && coopRuntime?.worldStartedLocally && state === "playing" && partyController()?.mode === "solo") {
      networkLeaveReloading = true;
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      url.searchParams.delete("autojoin");
      window.location.replace(url.toString());
    }
  }

  function multiplayerSnapshot() {
    const party = partyController();
    const client = party?.client;
    return {
      active: Boolean(party?.multiplayer),
      status: client?.status || "offline",
      roomCode: client?.roomCode || "",
      playerId: client?.playerId || null,
      host: Boolean(client?.isHost),
      worldReady: Boolean(client?.worldReady),
      started: Boolean(client?.started),
      remotePlayers: client?.remoteTracks?.size || 0,
      remoteAvatars: remoteWardenRenderer?.wardens?.size || 0,
      networkEnemies: client?.enemyTracks?.size || 0,
      revision: coopRuntime?.lastAppliedRevision ?? -1,
      stats: Object.assign({}, coopRuntime?.stats || {}, networkStats, { latency: client?.latency ?? null })
    };
  }

  function registerNetworkBoss(boss) {
    const client = partyController()?.client;
    if (!boss || !client?.isHost || !client.worldReady || typeof client.registerEnemy !== "function") return false;
    networkBossRegistrationPending = client.registerEnemy(serializeNetworkEnemy(boss));
    if (networkBossRegistrationPending) networkStats.bossRegistrations += 1;
    return networkBossRegistrationPending;
  }

  function initializeMultiplayerAdapter() {
    if (!multiplayerBootReady) return false;
    if (coopRuntime || !window.AshenholdCoopRuntime || !partyController()) return Boolean(coopRuntime);
    const adapter = {
      serializeWorld: serializeNetworkWorld,
      serializePlayer: serializeNetworkPlayer,
      applyNetworkSnapshot,
      applyNetworkEvent,
      renderRemotePlayers: renderRemoteWardens,
      renderNetworkEnemies,
      requestLocalStart: (reason) => {
        if (state === "playing") return coopRuntime.startWorld();
        return startGame(false, reason || "party");
      },
      onConnection: () => {
        if (state === "playing") window.setTimeout(() => coopRuntime?.startWorld(), 0);
      },
      onHostChanged: (isHost) => {
        if (!isHost || !multiplayerWorldActive()) return;
        coopRuntime.startWorld();
        const boss = dragons.find((dragon) => dragon.boss && !dragon.dead);
        if (boss && !partyController().client.snapshot?.enemies?.some((enemy) => enemy.id === boss.networkId)) registerNetworkBoss(boss);
      },
      onDisconnect: () => {
        networkStats.disconnects += 1;
        networkLocalTransformHydratedFor = null;
        remoteWardenRenderer?.clear();
      },
      onNetworkStatus: () => {},
      disposeNetwork: () => remoteWardenRenderer?.dispose()
    };
    coopRuntime = new window.AshenholdCoopRuntime(partyController(), adapter);
    window.addEventListener("ashenhold:party-leave", restoreLocalNetworkActors);
    window.addEventListener("ashenhold:party-mode", (event) => { if (event.detail?.mode === "solo") restoreLocalNetworkActors(); });
    const client = partyController().client;
    if (client.status === "connected") {
      adapter.onConnection({ snapshot: client.snapshot, started: client.started });
      if (client.started && state !== "playing") window.setTimeout(() => adapter.requestLocalStart("reconnect"), 0);
    }
    return true;
  }

  function encounterRandom() {
    let value = encounterRng.state >>> 0;
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    encounterRng.state = value >>> 0;
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  }

  const WEAPON_IDS = ["blade", "bow", "axe", "staff"];
  const WEAPONS = Object.freeze({
    blade: { name: "ASHEN BLADE", masteryName: "BLADE", role: "CLOSE RANGE", color: 0x8fd8e8, damage: 0, melee: 34, projectile: false, stamina: 13, cooldown: .42, duration: .52, speed: 0, life: 0, radius: .16, range: 7.1, splash: 0, gravity: 0 },
    bow: { name: "FROSTFANG BOW", masteryName: "BOW", role: "LONG RANGE", color: 0x9cccf4, damage: 28, melee: 0, projectile: true, stamina: 11, cooldown: .56, duration: .5, speed: 86, life: 4.2, radius: .085, range: 0, splash: 0, gravity: 1.65 },
    axe: { name: "WYRMCLEAVER AXE", masteryName: "AXE", role: "HEAVY", color: 0xf09a5d, damage: 21, melee: 42, projectile: true, stamina: 19, cooldown: .76, duration: .64, speed: 39, life: 1.75, radius: .25, range: 7.5, splash: 4.8, gravity: 1.1 },
    staff: { name: "STORMCALLER STAFF", masteryName: "STAFF", role: "ARCANE", color: 0xbe91f0, damage: 17, melee: 11, projectile: true, stamina: 9, cooldown: .3, duration: .38, speed: 58, life: 2.7, radius: .22, range: 4.6, splash: 5.5, gravity: 0 }
  });

  function freshMastery() {
    return WEAPON_IDS.reduce((result, id) => { result[id] = { level: 1, xp: 0 }; return result; }, {});
  }

  function freshRelicBonuses() {
    return { damage: 0, health: 0, regen: 0, sprint: 0, stamina: 0, critDamage: 0 };
  }

  const player = {
    root: null,
    body: null,
    leftLeg: null,
    rightLeg: null,
    leftArm: null,
    rightArm: null,
    sword: null,
    weaponModels: {},
    activeWeapon: "blade",
    mastery: freshMastery(),
    attackDuration: .42,
    cape: null,
    health: 100,
    stamina: 100,
    shout: 0,
    vertical: 0,
    velocityY: 0,
    grounded: true,
    attackCooldown: 0,
    attackTime: 0,
    pendingAttack: null,
    dodgeTime: 0,
    dodgeElapsed: 0,
    dodgeCooldown: 0,
    dodgeDirection: new THREE.Vector3(),
    lastDodgeTime: -100,
    secondWindReady: true,
    resonanceTime: 0,
    comboHits: 0,
    comboExpires: 0,
    swapEmpowered: false,
    bladeHits: 0,
    bowShots: 0,
    staffCasts: 0,
    rampageTime: 0,
    walkCycle: 0,
    kills: 0,
    dragonKills: 0,
    distance: 0,
    lastDamage: -100,
    moving: false,
    sprinting: false,
    superSprinting: false,
    sprintLatch: false,
    superSprintLatch: false,
    sprintExhausted: false,
    sliding: false,
    slideSpeed: 0,
    slideDirection: new THREE.Vector3(0, 0, -1),
    slideTime: 0,
    slideSlopeDegrees: 0,
    slideInputPressed: false,
    slideExitBlocked: false,
    slideCollision: false,
    slideFxTimer: 0,
    mobileSlideHeld: false,
    airMomentum: new THREE.Vector3(),
    groundMomentum: new THREE.Vector3(),
    wading: false,
    lastJumpTelemetry: null,
    airbornePhase: "grounded",
    landingTime: 0,
    landingImpact: 0,
    stormstrideTimer: 0,
    jumpTime: 0,
    attackVariant: 0,
    worldSplitterAttack: -1,
    forceNextCritical: false,
    hitReaction: 0,
    level: 1,
    xp: 0,
    skillPoints: 0,
    skills: {},
    prestige: 0,
    realmDepth: 0,
    runLevel: 1,
    runXp: 0,
    runSkillPoints: 0,
    runSkills: {},
    relicBonuses: freshRelicBonuses(),
    modelRoot: null,
    modelMixer: null,
    modelHasClips: false,
    modelRunDeformer: null,
    modelActions: {},
    modelState: "",
    modelSword: null,
    sprintBones: null,
    sprintPoseSnapshot: null,
    sprintPoseApplied: false,
    sprintPoseWeight: 0,
    streakTimer: 0,
    lastSafePosition: new THREE.Vector3(START.x, 0, START.z)
  };

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, amount) { return a + (b - a) * amount; }
  function distance2D(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  function seeded(index) {
    const value = Math.sin(index * 127.1 + 311.7 + AUTHORED_WORLD_VARIATION * .000137) * 43758.5453;
    return value - Math.floor(value);
  }
  function smoothstep(minimum, maximum, value) {
    const amount = clamp((value - minimum) / Math.max(.0001, maximum - minimum), 0, 1);
    return amount * amount * (3 - 2 * amount);
  }

  function nextAdminModelId(modelSlot) {
    const slot = String(modelSlot || "object").replace(/[^a-z0-9_-]/gi, "_");
    const index = adminModelCounters.get(slot) || 0;
    adminModelCounters.set(slot, index + 1);
    return "model:" + slot + ":" + String(index).padStart(3, "0");
  }

  function placedAdminModelId(modelSlot, x, z, rotation, verticalKey, scaleKey) {
    const slot = String(modelSlot || "object").replace(/[^a-z0-9_-]/gi, "_");
    if (adminPlacementContext) {
      const index = adminPlacementContext.indices.get(slot) || 0;
      adminPlacementContext.indices.set(slot, index + 1);
      return ["model", slot, adminPlacementContext.id, String(index).padStart(3, "0")].join(":");
    }
    return [
      "model", slot, Math.round((Number(x) || 0) * 100), Math.round((Number(z) || 0) * 100),
      Math.round((Number(rotation) || 0) * 1000), Math.round((Number(verticalKey) || 0) * 100),
      Math.round((Number(scaleKey) || 0) * 1000)
    ].join(":");
  }

  function beginAdminPlacementContext(id) {
    const previous = adminPlacementContext;
    adminPlacementContext = { id: String(id || "world").replace(/[^a-z0-9_-]/gi, "_"), indices: new Map() };
    return previous;
  }

  function endAdminPlacementContext(previous) {
    adminPlacementContext = previous || null;
  }

  function adminVector(value, fallback) {
    const source = value || fallback || { x: 0, y: 0, z: 0 };
    return {
      x: overrideNumber(source.x, -HALF_WORLD, HALF_WORLD, fallback ? fallback.x : 0),
      y: overrideNumber(source.y, -200, 600, fallback ? fallback.y : 0),
      z: overrideNumber(source.z, -HALF_WORLD, HALF_WORLD, fallback ? fallback.z : 0)
    };
  }

  function adminScale(value, fallback) {
    const source = value || fallback || { x: 1, y: 1, z: 1 };
    return {
      x: overrideNumber(source.x, .02, 25, fallback ? fallback.x : 1),
      y: overrideNumber(source.y, .02, 25, fallback ? fallback.y : 1),
      z: overrideNumber(source.z, .02, 25, fallback ? fallback.z : 1)
    };
  }

  function cloneAdminTransform(transform) {
    return {
      position: adminVector(transform.position),
      rotationY: overrideNumber(transform.rotationY, -Math.PI * 8, Math.PI * 8, 0),
      scale: adminScale(transform.scale)
    };
  }

  function adminDocumentSnapshot() {
    return JSON.parse(JSON.stringify(editorDocument));
  }

  function hasAdminEntityOverride(id) {
    return Boolean(id && Object.prototype.hasOwnProperty.call(editorDocument.entities, id));
  }

  function announceAdminChange(reason, id) {
    adminRevision += 1;
    window.dispatchEvent(new CustomEvent("ashenhold:admin-change", { detail: { reason: reason || "change", id: id || null, revision: adminRevision } }));
  }

  function commitAdminHistory(reason) {
    if (!adminMode) return false;
    const serialized = JSON.stringify(editorDocument);
    if (adminHistoryIndex >= 0 && adminHistory[adminHistoryIndex].serialized === serialized) return false;
    adminHistory.splice(adminHistoryIndex + 1);
    adminHistory.push({ reason: reason || "Edit", serialized });
    if (adminHistory.length > 60) adminHistory.shift();
    adminHistoryIndex = adminHistory.length - 1;
    announceAdminChange(reason || "edit", adminSelectedId);
    return true;
  }

  function tagAdminEntityRoot(record) {
    if (!record || !record.root) return;
    record.root.traverse((object) => {
      object.userData = object.userData || {};
      if (object === record.root || !object.userData.adminEntityId) object.userData.adminEntityId = record.id;
    });
  }

  function adminEntityTransform(record) {
    if (!record) return null;
    if (record.pivot) return cloneAdminTransform(record.transform);
    record.root.updateWorldMatrix(true, false);
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    record.root.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
    const worldRotation = new THREE.Euler().setFromQuaternion(worldQuaternion, "YXZ");
    return {
      position: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z },
      rotationY: worldRotation.y,
      scale: { x: worldScale.x, y: worldScale.y, z: worldScale.z }
    };
  }

  function transformAdminPoint(point, anchor, transform) {
    const dx = (point.x - anchor.x) * transform.scale.x;
    const dy = (point.y - anchor.y) * transform.scale.y;
    const dz = (point.z - anchor.z) * transform.scale.z;
    const cosine = Math.cos(transform.rotationY);
    const sine = Math.sin(transform.rotationY);
    return {
      x: transform.position.x + dx * cosine + dz * sine,
      y: transform.position.y + dy,
      z: transform.position.z - dx * sine + dz * cosine
    };
  }

  function updateAdminLinkedGeometry(record, transform) {
    const baseline = record.defaultTransform || { position: record.baseAnchor, rotationY: 0, scale: { x: 1, y: 1, z: 1 } };
    const relative = {
      position: transform.position,
      rotationY: transform.rotationY - baseline.rotationY,
      scale: {
        x: transform.scale.x / Math.max(.001, Math.abs(baseline.scale.x)),
        y: transform.scale.y / Math.max(.001, Math.abs(baseline.scale.y)),
        z: transform.scale.z / Math.max(.001, Math.abs(baseline.scale.z))
      }
    };
    (record.colliderLinks || []).forEach((link) => {
      const next = transformAdminPoint({ x: link.base.x, y: link.base.minY, z: link.base.z }, baseline.position, relative);
      const nextTop = transformAdminPoint({ x: link.base.x, y: link.base.maxY, z: link.base.z }, baseline.position, relative);
      link.target.x = next.x;
      link.target.z = next.z;
      link.target.hx = Math.max(.05, link.base.hx * Math.abs(relative.scale.x));
      link.target.hz = Math.max(.05, link.base.hz * Math.abs(relative.scale.z));
      link.target.rotation = link.base.rotation + relative.rotationY;
      link.target.minY = Math.min(next.y, nextTop.y);
      link.target.maxY = Math.max(next.y, nextTop.y);
    });
    (record.platformLinks || []).forEach((link) => {
      const next = transformAdminPoint({ x: link.base.x, y: link.base.y, z: link.base.z }, baseline.position, relative);
      link.target.x = next.x;
      link.target.y = next.y;
      link.target.z = next.z;
      link.target.hx = Math.max(.05, link.base.hx * Math.abs(relative.scale.x));
      link.target.hz = Math.max(.05, link.base.hz * Math.abs(relative.scale.z));
      link.target.rotation = (link.base.rotation || 0) + relative.rotationY;
    });
  }

  function rotateAdminXZ(x, z, angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return { x: x * cosine + z * sine, z: -x * sine + z * cosine };
  }

  function mapAdminPointBetweenTransforms(point, from, to) {
    const inverse = rotateAdminXZ(point.x - from.position.x, point.z - from.position.z, -from.rotationY);
    const localX = inverse.x / Math.max(.001, Math.abs(from.scale.x));
    const localZ = inverse.z / Math.max(.001, Math.abs(from.scale.z));
    const mapped = rotateAdminXZ(localX * to.scale.x, localZ * to.scale.z, to.rotationY);
    return {
      x: to.position.x + mapped.x,
      y: to.position.y + (point.y - from.position.y) * (to.scale.y / Math.max(.001, Math.abs(from.scale.y))),
      z: to.position.z + mapped.z
    };
  }

  function updateAdminActorLogic(record, previous, next) {
    const enemy = record && record.enemy;
    if (!enemy) return;
    const deltaRotation = next.rotationY - previous.rotationY;
    const movePoint = (point) => {
      if (!point) return;
      const mapped = mapAdminPointBetweenTransforms(point, {
        position: previous.position, rotationY: previous.rotationY, scale: { x: 1, y: 1, z: 1 }
      }, {
        position: next.position, rotationY: next.rotationY, scale: { x: 1, y: 1, z: 1 }
      });
      if (point.set) point.set(mapped.x, mapped.y, mapped.z);
      else { point.x = mapped.x; point.y = mapped.y; point.z = mapped.z; }
    };
    if (enemy.home) movePoint(enemy.home);
    if (enemy.lastPosition && enemy.lastPosition.copy) enemy.lastPosition.copy(enemy.root.position);
    if (enemy.fireTarget) movePoint(enemy.fireTarget);
    if (enemy.ai) {
      movePoint(enemy.ai.home);
      movePoint(enemy.ai.lastKnown);
      enemy.ai.patrol.forEach(movePoint);
      enemy.ai.path = [];
      enemy.ai.pathIndex = 0;
      enemy.ai.repathTimer = 0;
      enemy.ai.progressX = next.position.x;
      enemy.ai.progressZ = next.position.z;
      enemy.ai.guardYaw += deltaRotation;
    }
    if (enemy.camp) {
      enemy.camp.x += next.position.x - previous.position.x;
      enemy.camp.z += next.position.z - previous.position.z;
    }
    networkNavigationCache = null;
  }

  function updateAdminLocationLogic(record, previous, next) {
    if (!record || record.type !== "location") return;
    const sourceId = record.sourceId || record.id.replace(/^location:/, "");
    const deltaRotation = next.rotationY - previous.rotationY;
    const scaleX = next.scale.x / Math.max(.001, previous.scale.x);
    const scaleZ = next.scale.z / Math.max(.001, previous.scale.z);
    const movePoint = (point) => {
      const relative = rotateAdminXZ((point.x - previous.position.x) * scaleX, (point.z - previous.position.z) * scaleZ, deltaRotation);
      point.x = next.position.x + relative.x;
      point.z = next.position.z + relative.z;
      if (Number.isFinite(point.y)) point.y = next.position.y + (point.y - previous.position.y) * (next.scale.y / Math.max(.001, previous.scale.y));
    };
    const linkedStrongholdId = /^route-\d+$/.test(sourceId) ? "ascent-" + sourceId.slice(6) : sourceId;
    const stronghold = strongholds.find((item) => item.id === linkedStrongholdId);
    if (stronghold) {
      stronghold.spots.forEach(movePoint);
      stronghold.members.forEach((enemy) => {
        movePoint(enemy.root.position);
        if (enemy.ai) {
          movePoint(enemy.ai.home);
          movePoint(enemy.ai.lastKnown);
          enemy.ai.patrol.forEach(movePoint);
          enemy.ai.guardYaw += deltaRotation;
          enemy.ai.path = [];
          enemy.ai.repathTimer = 0;
        }
        if (enemy.camp) { enemy.camp.x = next.position.x; enemy.camp.z = next.position.z; }
      });
      stronghold.x = next.position.x;
      stronghold.z = next.position.z;
      stronghold.biomeId = biomeIdAt(stronghold.x, stronghold.z);
      stronghold.navGrid = null;
      if (stronghold.marker) movePoint(stronghold.marker.position);
      if (stronghold.captureFlag && stronghold.captureFlag.root) {
        movePoint(stronghold.captureFlag.root.position);
        stronghold.captureFlag.baseY = stronghold.captureFlag.root.position.y;
      }
    }
    poiChestSpots.filter((spot) => spot.sourceId === sourceId).forEach((spot) => {
      movePoint(spot);
      spot.rotation = (spot.rotation || 0) + deltaRotation;
    });
    experienceRunes.filter((rune) => rune.sourceId === sourceId).forEach((rune) => movePoint(rune.root.position));
    chests.filter((chest) => chest.sourceId === sourceId).forEach((chest) => {
      movePoint(chest.root.position);
      chest.root.rotation.y += deltaRotation;
    });
    const landmark = landmarks.find((item) => item.id === sourceId);
    if (landmark) movePoint(landmark.position);
    const foundation = foundationZones.find((item) => item.id === sourceId);
    if (foundation) { movePoint(foundation); foundationTargets.delete(foundation.id); }
    let source = null;
    if (sourceId === "keep") movePoint(RUINS);
    else if (/^fort-\d+$/.test(sourceId)) source = worldLayout.forts[Number(sourceId.slice(5))];
    else if (/^route-\d+$/.test(sourceId)) source = worldLayout.routes[Number(sourceId.slice(6))];
    else if (/^poi-\d+$/.test(sourceId)) source = worldLayout.pois[Number(sourceId.slice(4))];
    else source = worldLayout.infrastructure.find((item) => item.id === sourceId);
    if (Array.isArray(source)) { source[0] = next.position.x; source[1] = next.position.z; }
    else if (source) { source.x = next.position.x; source.z = next.position.z; }
    networkNavigationCache = null;
    minimapRefreshTimer = 0;
  }

  function applyAdminTransform(record, transform, persist) {
    if (!record || !record.root) return false;
    const previous = adminEntityTransform(record);
    const next = cloneAdminTransform(transform);
    if (record.pivot) {
      record.transform = next;
      record.root.scale.set(next.scale.x, next.scale.y, next.scale.z);
      record.root.rotation.y = next.rotationY;
      const transformedAnchor = new THREE.Vector3(record.baseAnchor.x, record.baseAnchor.y, record.baseAnchor.z)
        .multiply(new THREE.Vector3(next.scale.x, next.scale.y, next.scale.z))
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), next.rotationY);
      record.root.position.set(
        next.position.x - transformedAnchor.x,
        next.position.y - transformedAnchor.y,
        next.position.z - transformedAnchor.z
      );
    } else {
      const worldPosition = new THREE.Vector3(next.position.x, next.position.y, next.position.z);
      const worldQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), next.rotationY);
      if (record.root.parent) {
        record.root.parent.updateWorldMatrix(true, false);
        const parentPosition = new THREE.Vector3();
        const parentQuaternion = new THREE.Quaternion();
        const parentScale = new THREE.Vector3();
        record.root.parent.matrixWorld.decompose(parentPosition, parentQuaternion, parentScale);
        record.root.position.copy(record.root.parent.worldToLocal(worldPosition.clone()));
        record.root.quaternion.copy(parentQuaternion.clone().invert().multiply(worldQuaternion));
        record.root.scale.set(
          next.scale.x / Math.max(.0001, Math.abs(parentScale.x)),
          next.scale.y / Math.max(.0001, Math.abs(parentScale.y)),
          next.scale.z / Math.max(.0001, Math.abs(parentScale.z))
        );
      } else {
        record.root.position.copy(worldPosition);
        record.root.quaternion.copy(worldQuaternion);
        record.root.scale.set(next.scale.x, next.scale.y, next.scale.z);
      }
    }
    updateAdminLinkedGeometry(record, next);
    updateAdminLocationLogic(record, previous, next);
    updateAdminActorLogic(record, previous, next);
    if (persist !== false) {
      const entry = editorDocument.entities[record.id] || {};
      entry.type = record.type;
      if (record.modelSlot) entry.modelSlot = record.modelSlot;
      entry.position = adminVector(next.position);
      entry.rotationY = next.rotationY;
      entry.scale = adminScale(next.scale);
      editorDocument.entities[record.id] = entry;
    }
    return true;
  }

  function cloneAdminMaterial(material) {
    if (!material || !material.clone) return material;
    if (material.userData && material.userData.adminEditable) return material;
    const cloned = material.clone();
    cloned.userData = Object.assign({}, cloned.userData, { adminEditable: true });
    return cloned;
  }

  function captureAdminAppearance(root) {
    const snapshots = [];
    root.traverse((object) => {
      if (!object.isMesh && !object.isSkinnedMesh && !object.isPoints && !object.isLine) return;
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      snapshots.push(materials.map((material) => ({
        color: material && material.color ? material.color.getHex() : null,
        map: material ? material.map || null : null
      })));
    });
    return snapshots;
  }

  function restoreAdminAppearance(record) {
    if (!record || !record.appearance) return;
    record.textureRequest = (record.textureRequest || 0) + 1;
    let meshIndex = 0;
    record.root.traverse((object) => {
      if (!object.isMesh && !object.isSkinnedMesh && !object.isPoints && !object.isLine) return;
      if (Array.isArray(object.material)) object.material = object.material.map(cloneAdminMaterial);
      else object.material = cloneAdminMaterial(object.material);
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      const snapshots = record.appearance[meshIndex] || [];
      materials.forEach((material, index) => {
        const snapshot = snapshots[index];
        if (!material || !snapshot) return;
        if (material.color && snapshot.color != null) material.color.setHex(snapshot.color);
        material.map = snapshot.map;
        material.needsUpdate = true;
      });
      meshIndex += 1;
    });
    record.color = null;
    record.texture = null;
  }

  function applyAdminColor(record, colorValue, persist) {
    const color = overrideColor(colorValue);
    if (!record || color == null) return false;
    record.root.traverse((object) => {
      if (!object.isMesh && !object.isSkinnedMesh && !object.isPoints && !object.isLine) return;
      if (Array.isArray(object.material)) object.material = object.material.map(cloneAdminMaterial);
      else object.material = cloneAdminMaterial(object.material);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => { if (material && material.color) { material.color.setHex(color); material.needsUpdate = true; } });
    });
    record.color = "#" + color.toString(16).padStart(6, "0");
    if (persist !== false) {
      const entry = editorDocument.entities[record.id] || { type: record.type };
      entry.color = record.color;
      editorDocument.entities[record.id] = entry;
    }
    return true;
  }

  const ADMIN_LIFECYCLE_ENTITY_TYPES = new Set(["model", "custom-model"]);

  function adminEntityLifecycleCapabilities(record) {
    const editable = Boolean(record && !record.protected && ADMIN_LIFECYCLE_ENTITY_TYPES.has(record.type));
    return { canHide: editable, canRemove: editable };
  }

  function applyAdminEntityVisibility(record, visible) {
    if (!record || !record.root) return false;
    record.root.visible = Boolean(visible);
    const stored = editorDocument.entities[record.id];
    const collisionEnabled = record.root.visible && (!stored || stored.collision !== false);
    (record.colliderLinks || []).forEach((link) => { link.target.disabled = !collisionEnabled; });
    (record.platformLinks || []).forEach((link) => { link.target.disabled = !collisionEnabled; });
    return true;
  }

  function setAdminEntityVisibility(record, visible, persist) {
    if (!adminEntityLifecycleCapabilities(record).canHide || !applyAdminEntityVisibility(record, visible)) return false;
    if (persist !== false) {
      const entry = editorDocument.entities[record.id] || { type: record.type };
      entry.visible = record.root.visible;
      if (record.root.visible) delete entry.deleted;
      editorDocument.entities[record.id] = entry;
    }
    return true;
  }

  async function applyAdminTexture(record, path, persist) {
    path = overrideTexturePath(path);
    if (!record || !path) return false;
    const url = new URL(path, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.replace(/^\/+/, "").startsWith("assets/")) return false;
    const requestId = (record.textureRequest || 0) + 1;
    record.textureRequest = requestId;
    const texture = configureTexture(await textureFrom(path), 1, 1);
    if (record.textureRequest !== requestId) { if (texture && texture.dispose) texture.dispose(); return false; }
    record.root.traverse((object) => {
      if (!object.isMesh && !object.isSkinnedMesh) return;
      if (Array.isArray(object.material)) object.material = object.material.map(cloneAdminMaterial);
      else object.material = cloneAdminMaterial(object.material);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => { if (material) { material.map = texture; material.needsUpdate = true; } });
    });
    record.texture = path;
    if (persist !== false) {
      const entry = editorDocument.entities[record.id] || { type: record.type };
      entry.texture = path;
      editorDocument.entities[record.id] = entry;
    }
    return true;
  }

  function applyAdminEnemyValues(record, values, persist) {
    const enemy = record && record.enemy;
    if (!enemy || !values) return false;
    const maxHealth = overrideNumber(values.maxHealth, 1, 100000, enemy.maxHealth);
    enemy.maxHealth = maxHealth;
    enemy.health = overrideNumber(values.health, 0, maxHealth, Math.min(enemy.health, maxHealth));
    if (enemy.kind === "dragon" && Number.isFinite(enemy.damageScale)) {
      const currentDamage = Math.round((enemy.boss ? 30 : 22) * enemy.damageScale);
      const targetDamage = overrideNumber(values.damage, 0, 10000, currentDamage);
      enemy.damageScale = targetDamage / (enemy.boss ? 30 : 22);
    } else enemy.damage = overrideNumber(values.damage, 0, 10000, enemy.damage);
    enemy.speed = overrideNumber(values.speed, 0, 250, enemy.speed);
    enemy.attackRange = overrideNumber(values.attackRange, .1, 250, enemy.attackRange);
    enemy.attackInterval = overrideNumber(values.attackInterval, .05, 60, enemy.attackInterval);
    enemy.adminSightRange = overrideNumber(values.sightRange, .1, 500, enemy.adminSightRange || undefined);
    enemy.adminTracking = overrideNumber(values.tracking, .05, 10, enemy.adminTracking || 1);
    if (persist !== false) {
      const entry = editorDocument.entities[record.id] || { type: record.type };
      entry.enemy = {
        health: enemy.health, maxHealth: enemy.maxHealth,
        damage: enemy.kind === "dragon" ? Math.round((enemy.boss ? 30 : 22) * (enemy.damageScale || 1)) : enemy.damage,
        speed: enemy.speed,
        attackRange: enemy.attackRange, attackInterval: enemy.attackInterval,
        sightRange: enemy.adminSightRange, tracking: enemy.adminTracking
      };
      editorDocument.entities[record.id] = entry;
    }
    return true;
  }

  function applyAdminEntityOverride(record) {
    const entry = editorDocument.entities[record.id];
    if (!entry) return;
    if (record.modelSlot) {
      const targetSlot = entry.modelSlot || record.originalModelSlot;
      if (visualAssets.models && visualAssets.models[targetSlot]) applyAdminModelSlot(record, targetSlot, false);
      else ensureAdminModelAsset(targetSlot).then((asset) => {
        const currentEntry = editorDocument.entities[record.id];
        if (asset && currentEntry && (currentEntry.modelSlot || record.originalModelSlot) === targetSlot) {
          applyAdminModelSlot(record, targetSlot, false);
          if (adminMode) announceAdminChange("model-loaded", record.id);
        }
      });
    }
    const current = adminEntityTransform(record);
    applyAdminTransform(record, {
      position: entry.position || current.position,
      rotationY: entry.rotationY !== undefined ? entry.rotationY : current.rotationY,
      scale: entry.scale || current.scale
    }, false);
    if (entry.color) applyAdminColor(record, entry.color, false);
    if (entry.texture) applyAdminTexture(record, entry.texture, false).catch((error) => console.warn("Admin texture could not be loaded:", entry.texture, error));
    if (entry.enemy) applyAdminEnemyValues(record, entry.enemy, false);
    if (adminEntityLifecycleCapabilities(record).canHide) setAdminEntityVisibility(record, !entry.deleted && entry.visible !== false, false);
    else {
      delete entry.visible;
      delete entry.deleted;
    }
    if (entry.collision !== undefined) setAdminEntityCollision(record.id, entry.collision, false);
  }

  function registerAdminEntity(root, options) {
    if (!root) return null;
    const config = options || {};
    const id = config.id || nextAdminModelId(config.modelSlot || config.type || "object");
    if (!adminMode && !hasAdminEntityOverride(id)) return null;
    const anchorSource = config.anchor || root.position;
    const baseAnchor = { x: Number(anchorSource.x) || 0, y: Number(anchorSource.y) || 0, z: Number(anchorSource.z) || 0 };
    const record = {
      id, root,
      label: String(config.label || root.name || id).slice(0, 100),
      type: config.type || "object",
      category: config.category || config.type || "object",
      sourceId: config.sourceId || null,
      modelSlot: config.modelSlot || null,
      originalModelSlot: config.modelSlot || null,
      pivot: Boolean(config.pivot), baseAnchor,
      colliderLinks: (config.colliders || []).filter(Boolean).map((target) => ({ target, base: Object.assign({}, target) })),
      platformLinks: (config.platforms || []).filter(Boolean).map((target) => ({ target, base: Object.assign({}, target) })),
      enemy: config.enemy || null,
      protected: Boolean(config.protected)
    };
    record.transform = record.pivot ? {
      position: Object.assign({}, baseAnchor), rotationY: 0, scale: { x: 1, y: 1, z: 1 }
    } : adminEntityTransform(record);
    record.defaultTransform = cloneAdminTransform(record.transform);
    const authoredAnchor = record.type === "location" && record.sourceId ? authoredLocationAnchors.get(record.sourceId) : null;
    if (authoredAnchor) {
      record.defaultTransform.position.x = authoredAnchor.x;
      record.defaultTransform.position.z = authoredAnchor.z;
      record.defaultTransform.position.y = terrainHeight(authoredAnchor.x, authoredAnchor.z);
    }
    if (record.enemy && record.enemy.strongholdId) {
      const locationSourceId = /^ascent-\d+$/.test(record.enemy.strongholdId)
        ? "route-" + record.enemy.strongholdId.slice(7)
        : record.enemy.strongholdId;
      const locationRecord = adminEntities.get("location:" + locationSourceId);
      if (locationRecord) {
        const currentLocation = adminEntityTransform(locationRecord);
        const canonicalLocation = locationRecord.defaultTransform;
        record.defaultTransform.position = mapAdminPointBetweenTransforms(record.defaultTransform.position, currentLocation, canonicalLocation);
        record.defaultTransform.rotationY += canonicalLocation.rotationY - currentLocation.rotationY;
      }
    }
    record.defaultVisible = root.visible;
    record.appearance = captureAdminAppearance(root);
    record.defaultEnemy = record.enemy ? {
      health: record.enemy.health, maxHealth: record.enemy.maxHealth,
      damage: record.enemy.kind === "dragon" ? Math.round((record.enemy.boss ? 30 : 22) * (record.enemy.damageScale || 1)) : record.enemy.damage,
      speed: record.enemy.speed, attackRange: record.enemy.attackRange, attackInterval: record.enemy.attackInterval,
      sightRange: record.enemy.adminSightRange, tracking: record.enemy.adminTracking || 1
    } : null;
    if (record.enemy) record.enemy.adminEntityId = id;
    adminEntities.set(id, record);
    tagAdminEntityRoot(record);
    applyAdminEntityOverride(record);
    return record;
  }

  function unregisterAdminEntity(id) {
    const record = adminEntities.get(id);
    if (!record) return false;
    if (adminSelectedId === id) selectAdminEntity(null);
    adminEntities.delete(id);
    return true;
  }

  const ADMIN_ENEMY_TUNING_FIELDS = ["health", "damage", "speed", "attackRange", "sightRange", "tracking", "attackRate"];

  function adminEnemyTuning(kind) {
    const global = editorDocument.enemies.global || {};
    const specific = editorDocument.enemies.byKind[kind] || {};
    return ADMIN_ENEMY_TUNING_FIELDS.reduce((result, field) => {
      result[field] = clamp((global[field] || 1) * (specific[field] || 1), .05, 10);
      return result;
    }, {});
  }

  function captureAdminEnemyBaseline(enemy) {
    const damage = enemy.kind === "dragon" && Number.isFinite(enemy.damageScale)
      ? (enemy.boss ? 30 : 22) * enemy.damageScale
      : enemy.damage;
    return {
      health: enemy.health,
      maxHealth: enemy.maxHealth,
      damage,
      speed: enemy.speed,
      attackRange: enemy.attackRange,
      attackInterval: enemy.attackInterval,
      sightRange: undefined,
      tracking: 1
    };
  }

  function applyAdminEnemyTuning(enemy, resetBaseline) {
    if (!enemy) return false;
    if (resetBaseline || !enemy.adminBaseStats) enemy.adminBaseStats = captureAdminEnemyBaseline(enemy);
    const base = enemy.adminBaseStats;
    const next = adminEnemyTuning(enemy.kind || (enemy.boss ? "dragon" : "enemy"));
    const currentHealthRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1;
    enemy.maxHealth = Math.max(1, Math.round(base.maxHealth * next.health));
    enemy.health = clamp(Math.round(enemy.maxHealth * currentHealthRatio), 0, enemy.maxHealth);
    if (Number.isFinite(enemy.damage)) enemy.damage = Math.max(0, base.damage * next.damage);
    if (Number.isFinite(enemy.damageScale)) enemy.damageScale = base.damage * next.damage / (enemy.boss ? 30 : 22);
    enemy.speed = Math.max(0, base.speed * next.speed);
    if (Number.isFinite(base.attackRange)) enemy.attackRange = Math.max(.1, base.attackRange * next.attackRange);
    if (Number.isFinite(base.attackInterval)) enemy.attackInterval = Math.max(.05, base.attackInterval / next.attackRate);
    enemy.adminSightRange = Number.isFinite(base.sightRange) ? base.sightRange * next.sightRange : undefined;
    enemy.adminSightMultiplier = next.sightRange;
    enemy.adminTracking = base.tracking * next.tracking;
    enemy.adminTuning = next;
    return true;
  }

  function applyAdminEnemyTuningAndSpecific(enemy) {
    if (!applyAdminEnemyTuning(enemy, false)) return false;
    const record = enemy.adminEntityId && adminEntities.get(enemy.adminEntityId);
    const entry = record && editorDocument.entities[record.id];
    if (record && entry && entry.enemy) applyAdminEnemyValues(record, entry.enemy, false);
    return true;
  }

  function refreshAdminActorEntities() {
    const hasActorOverrides = Object.keys(editorDocument.entities).some((id) => id.startsWith("enemy:"));
    if (!adminMode && !hasActorOverrides) return;
    Array.from(adminEntities.values()).forEach((record) => {
      if (record.type === "enemy" || record.type === "dragon") unregisterAdminEntity(record.id);
    });
    ensureStableNetworkIds();
    dragons.forEach((dragon, index) => {
      registerAdminEntity(dragon.root, {
        id: "enemy:" + (dragon.networkId || "dragon-" + index), label: dragon.name,
        type: "dragon", category: "Enemies", enemy: dragon
      });
    });
    groundEnemies.forEach((enemy, index) => {
      registerAdminEntity(enemy.root, {
        id: "enemy:" + (enemy.networkId || enemy.spawnKey || enemy.kind + "-" + index), label: enemy.name,
        type: "enemy", category: "Enemies", enemy
      });
    });
  }

  function adminMaterialDetails(root) {
    let first = null;
    let meshCount = 0;
    const texturePaths = new Set();
    root.traverse((object) => {
      if (!object.isMesh && !object.isSkinnedMesh && !object.isPoints && !object.isLine) return;
      meshCount += 1;
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      materials.forEach((material) => {
        if (!first && material) first = material;
        const source = material && material.map && material.map.image && (material.map.image.currentSrc || material.map.image.src);
        if (source) {
          try { texturePaths.add(new URL(source, window.location.href).pathname.replace(/^\//, "")); }
          catch (_) { texturePaths.add(String(source).slice(0, 180)); }
        }
      });
    });
    return {
      meshCount,
      color: first && first.color ? "#" + first.color.getHexString() : null,
      textures: Array.from(texturePaths).slice(0, 12),
      material: first ? first.type || "Material" : "None"
    };
  }

  function adminEntitySummary(record) {
    if (!record || !record.root) return null;
    const transform = adminEntityTransform(record);
    const material = adminMaterialDetails(record.root);
    const lifecycle = adminEntityLifecycleCapabilities(record);
    let size = { x: 0, y: 0, z: 0 };
    if (record.root.visible) {
      const measured = new THREE.Vector3();
      new THREE.Box3().setFromObject(record.root).getSize(measured);
      size = { x: measured.x, y: measured.y, z: measured.z };
    }
    const output = {
      id: record.id, label: record.label, type: record.type, category: record.category,
      sourceId: record.sourceId, modelSlot: record.modelSlot, transform,
      visible: record.root.visible, protected: record.protected,
      canHide: lifecycle.canHide, canRemove: lifecycle.canRemove, size,
      collision: record.colliderLinks.concat(record.platformLinks).length > 0 && record.colliderLinks.concat(record.platformLinks).some((link) => !link.target.disabled),
      collisionBounds: record.colliderLinks.map((link) => ({
        x: link.target.x, z: link.target.z, hx: link.target.hx, hz: link.target.hz,
        minY: link.target.minY, maxY: link.target.maxY, disabled: Boolean(link.target.disabled)
      })),
      defaultTransform: cloneAdminTransform(record.defaultTransform),
      meshCount: material.meshCount, color: record.color || material.color,
      texture: record.texture || material.textures[0] || "", textures: material.textures,
      material: material.material
    };
    if (record.enemy) output.enemy = {
      kind: record.enemy.kind || (record.enemy.boss ? "dragon" : "enemy"),
      health: record.enemy.health, maxHealth: record.enemy.maxHealth,
      damage: record.enemy.damage, speed: record.enemy.speed,
      attackRange: record.enemy.attackRange, attackInterval: record.enemy.attackInterval,
      sightRange: record.enemy.adminSightRange || (record.enemy.kind === "dragon" ? 100 : roleSightProfile(record.enemy).range),
      tracking: record.enemy.adminTracking || 1,
      state: record.enemy.ai ? record.enemy.ai.state : record.enemy.dead ? "dead" : "active",
      behaviorHome: record.enemy.ai
        ? { x: record.enemy.ai.home.x, y: record.enemy.ai.home.y, z: record.enemy.ai.home.z }
        : record.enemy.home ? { x: record.enemy.home.x, y: record.enemy.home.y, z: record.enemy.home.z } : null
    };
    return output;
  }

  function createAdminGizmo() {
    if (!adminMode || !scene || adminGizmo) return adminGizmo;
    adminGizmo = new THREE.Group();
    adminGizmo.name = "Ashenhold Admin Transform Gizmo";
    const axes = [
      { id: "x", color: 0xff5a66, direction: new THREE.Vector3(1, 0, 0) },
      { id: "y", color: 0x63df87, direction: new THREE.Vector3(0, 1, 0) },
      { id: "z", color: 0x55a9ff, direction: new THREE.Vector3(0, 0, 1) }
    ];
    axes.forEach((axis) => {
      const material = new THREE.MeshBasicMaterial({ color: axis.color, depthTest: false, transparent: true, opacity: .94 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 2.45, 8), material);
      const head = new THREE.Mesh(new THREE.ConeGeometry(.15, .5, 10), material);
      shaft.position.copy(axis.direction).multiplyScalar(1.225);
      head.position.copy(axis.direction).multiplyScalar(2.7);
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.direction);
      head.quaternion.copy(shaft.quaternion);
      shaft.userData.adminAxis = axis.id;
      head.userData.adminAxis = axis.id;
      shaft.renderOrder = 10000;
      head.renderOrder = 10000;
      adminGizmo.add(shaft, head);
    });
    adminGizmo.visible = false;
    scene.add(adminGizmo);
    return adminGizmo;
  }

  function selectAdminEntity(id) {
    const record = id ? adminEntities.get(id) : null;
    adminSelectedId = record ? record.id : null;
    if (adminSelectionHelper) {
      scene.remove(adminSelectionHelper);
      if (adminSelectionHelper.geometry) adminSelectionHelper.geometry.dispose();
      if (adminSelectionHelper.material) adminSelectionHelper.material.dispose();
      adminSelectionHelper = null;
    }
    createAdminGizmo();
    if (record && record.root.visible) {
      adminSelectionHelper = new THREE.BoxHelper(record.root, 0x70e5ff);
      adminSelectionHelper.name = "Ashenhold Admin Selection";
      adminSelectionHelper.material.depthTest = false;
      adminSelectionHelper.material.transparent = true;
      adminSelectionHelper.material.opacity = .86;
      adminSelectionHelper.renderOrder = 9999;
      scene.add(adminSelectionHelper);
      adminGizmo.visible = true;
    } else if (adminGizmo) adminGizmo.visible = false;
    window.dispatchEvent(new CustomEvent("ashenhold:admin-selection", { detail: { id: adminSelectedId } }));
    return record ? adminEntitySummary(record) : null;
  }

  function updateAdminSelectionVisual() {
    const record = adminSelectedId ? adminEntities.get(adminSelectedId) : null;
    if (!record || !record.root.visible) {
      if (adminGizmo) adminGizmo.visible = false;
      return;
    }
    if (adminSelectionHelper) adminSelectionHelper.setFromObject(record.root);
    const transform = adminEntityTransform(record);
    if (adminGizmo && camera) {
      adminGizmo.visible = true;
      adminGizmo.position.set(transform.position.x, transform.position.y, transform.position.z);
      const distance = Math.max(3, camera.position.distanceTo(adminGizmo.position));
      adminGizmo.scale.setScalar(clamp(distance * .018, .65, 5.5));
    }
  }

  function setAdminRay(clientX, clientY) {
    if (!renderer || !camera) return false;
    const bounds = renderer.domElement.getBoundingClientRect();
    const x = ((clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1;
    const y = -((clientY - bounds.top) / Math.max(1, bounds.height)) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    return true;
  }

  function pickAdminGizmo(clientX, clientY) {
    if (!adminGizmo || !adminGizmo.visible || !setAdminRay(clientX, clientY)) return null;
    const hit = raycaster.intersectObjects(adminGizmo.children, true)[0];
    return hit && hit.object.userData.adminAxis || null;
  }

  function adminEntityAt(clientX, clientY) {
    if (!setAdminRay(clientX, clientY)) return null;
    const roots = [];
    adminEntities.forEach((record) => { if (record.root && record.root.visible) roots.push(record.root); });
    const hits = raycaster.intersectObjects(roots, true);
    for (let index = 0; index < hits.length; index += 1) {
      let object = hits[index].object;
      while (object) {
        if (object.userData && adminEntities.has(object.userData.adminEntityId)) return adminEntities.get(object.userData.adminEntityId);
        object = object.parent;
      }
    }
    return null;
  }

  function pickAdminEntity(clientX, clientY) {
    const record = adminEntityAt(clientX, clientY);
    return selectAdminEntity(record && record.id || null);
  }

  function projectAdminPoint(worldPosition) {
    if (!camera || !renderer || !worldPosition) return null;
    camera.updateMatrixWorld();
    const projected = worldPosition.clone().project(camera);
    const bounds = renderer.domElement.getBoundingClientRect();
    return {
      clientX: bounds.left + (projected.x + 1) * bounds.width * .5,
      clientY: bounds.top + (1 - projected.y) * bounds.height * .5,
      inViewport: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z >= -1 && projected.z <= 1
    };
  }

  function projectAdminEntity(id) {
    const record = adminEntities.get(id);
    if (!record || !record.root || !record.root.visible) return null;
    record.root.updateWorldMatrix(true, true);
    const center = new THREE.Vector3();
    new THREE.Box3().setFromObject(record.root).getCenter(center);
    return projectAdminPoint(center);
  }

  function projectAdminGizmo(axis) {
    if (!adminGizmo || !adminGizmo.visible) return null;
    adminGizmo.updateWorldMatrix(true, true);
    const handles = adminGizmo.children.filter((child) => child.userData.adminAxis === axis);
    if (!handles.length) return null;
    handles.sort((a, b) => b.position.lengthSq() - a.position.lengthSq());
    return projectAdminPoint(handles[0].getWorldPosition(new THREE.Vector3()));
  }

  function adminProjectedAxis(record, axis) {
    const transform = adminEntityTransform(record);
    const origin = new THREE.Vector3(transform.position.x, transform.position.y, transform.position.z);
    const direction = axis === "x" ? new THREE.Vector3(1, 0, 0) : axis === "y" ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const projectedOrigin = origin.clone().project(camera);
    const projectedEnd = origin.clone().add(direction).project(camera);
    const bounds = renderer.domElement.getBoundingClientRect();
    const dx = (projectedEnd.x - projectedOrigin.x) * bounds.width * .5;
    const dy = -(projectedEnd.y - projectedOrigin.y) * bounds.height * .5;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length, worldPerPixel: 2 * camera.position.distanceTo(origin) * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, bounds.height) };
  }

  function beginAdminDrag(mode, axis, clientX, clientY) {
    const record = adminSelectedId ? adminEntities.get(adminSelectedId) : null;
    if (!record || !camera || !renderer) return false;
    adminDrag = {
      id: record.id, mode: mode || adminControls.transformMode, axis: axis || "y",
      startX: clientX, startY: clientY, start: adminEntityTransform(record),
      projected: adminProjectedAxis(record, axis || "y")
    };
    return true;
  }

  function beginAdminDirectDrag(id, clientX, clientY) {
    const record = id ? adminEntities.get(id) : adminSelectedId ? adminEntities.get(adminSelectedId) : null;
    if (!record || !camera || !renderer) return false;
    const start = adminEntityTransform(record);
    const origin = new THREE.Vector3(start.position.x, start.position.y, start.position.z);
    const viewForward = new THREE.Vector3();
    camera.getWorldDirection(viewForward);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    if (right.lengthSq() < .0001) right.set(1, 0, 0);
    else right.normalize();
    const forward = new THREE.Vector3(viewForward.x, 0, viewForward.z);
    if (forward.lengthSq() < .0001) forward.set(-right.z, 0, right.x);
    else forward.normalize();
    const bounds = renderer.domElement.getBoundingClientRect();
    adminDrag = {
      id: record.id, mode: "translate-direct", axis: "xz",
      startX: clientX, startY: clientY, start,
      direct: {
        right, forward,
        worldPerPixel: 2 * camera.position.distanceTo(origin) * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, bounds.height)
      }
    };
    return true;
  }

  function snappedAdminValue(value, step) {
    return step > 0 ? Math.round(value / step) * step : value;
  }

  function dragAdminTransform(clientX, clientY, options) {
    if (!adminDrag) return false;
    const record = adminEntities.get(adminDrag.id);
    if (!record) return false;
    const dx = clientX - adminDrag.startX;
    const dy = clientY - adminDrag.startY;
    const next = cloneAdminTransform(adminDrag.start);
    if (adminDrag.mode === "translate-direct") {
      const vertical = Boolean(options && options.vertical);
      if (vertical) {
        const distance = snappedAdminValue(-dy * adminDrag.direct.worldPerPixel, adminControls.snap.translate);
        next.position.y = adminDrag.start.position.y + distance;
      } else {
        const rightDistance = snappedAdminValue(dx * adminDrag.direct.worldPerPixel, adminControls.snap.translate);
        const forwardDistance = snappedAdminValue(-dy * adminDrag.direct.worldPerPixel, adminControls.snap.translate);
        next.position.x = adminDrag.start.position.x + adminDrag.direct.right.x * rightDistance + adminDrag.direct.forward.x * forwardDistance;
        next.position.z = adminDrag.start.position.z + adminDrag.direct.right.z * rightDistance + adminDrag.direct.forward.z * forwardDistance;
      }
    } else if (adminDrag.mode === "translate") {
      const projectedDistance = dx * adminDrag.projected.x + dy * adminDrag.projected.y;
      const distance = snappedAdminValue(projectedDistance * adminDrag.projected.worldPerPixel, adminControls.snap.translate);
      next.position[adminDrag.axis] = adminDrag.start.position[adminDrag.axis] + distance;
    } else if (adminDrag.mode === "rotate") {
      const step = adminControls.snap.rotate * Math.PI / 180;
      next.rotationY = snappedAdminValue(adminDrag.start.rotationY + dx * .01, step);
    } else if (adminDrag.mode === "scale") {
      const delta = snappedAdminValue((dx - dy) * .006, adminControls.snap.scale);
      if (adminDrag.axis === "x" || adminDrag.axis === "y" || adminDrag.axis === "z") next.scale[adminDrag.axis] = clamp(adminDrag.start.scale[adminDrag.axis] + delta, .02, 25);
      else next.scale = adminScale({ x: adminDrag.start.scale.x + delta, y: adminDrag.start.scale.y + delta, z: adminDrag.start.scale.z + delta });
    }
    applyAdminTransform(record, next, true);
    announceAdminChange("transform-preview", record.id);
    return adminEntitySummary(record);
  }

  function endAdminDrag() {
    if (!adminDrag) return false;
    const id = adminDrag.id;
    adminDrag = null;
    commitAdminHistory("Transform " + id);
    return true;
  }

  function handoffAdminFreecamToWarden() {
    if (!camera || !player.root) return false;
    const destination = camera.position.clone();
    player.root.position.copy(destination);
    player.root.rotation.y = adminControls.freecamYaw;
    cameraYaw = adminControls.freecamYaw;
    cameraPitch = clamp(adminControls.freecamPitch, -1.22, 1.22);
    cameraReady = false;
    keys.clear();
    mobileMove.set(0, 0);
    resetTraversalMotion();
    player.vertical = 0;
    player.velocityY = 0;
    player.grounded = false;
    player.moving = false;
    player.sprinting = false;
    player.superSprinting = false;
    player.sprintLatch = false;
    player.superSprintLatch = false;
    player.stormstrideTimer = 0;
    player.streakTimer = 0;
    player.dodgeTime = 0;
    player.dodgeElapsed = 0;
    player.dodgeDirection.set(0, 0, 0);
    player.attackTime = 0;
    player.pendingAttack = null;
    player.queuedWeapon = null;
    player.airbornePhase = "fall";
    player.jumpTime = 0;
    lockedTarget = null;
    nearestTarget = null;
    restoreSprintPoseBones();
    player.sprintPoseWeight = 0;
    if (player.modelRoot) player.modelRoot.position.y = player.modelHasClips ? 0 : WARDEN_MODEL_Y_OFFSET;
    setPlayerModelAction("idle", true);
    cameraTrauma = 0;
    camera.fov = 62;
    camera.updateProjectionMatrix();
    return { x: destination.x, y: destination.y, z: destination.z };
  }

  function setAdminMode(mode) {
    if (!["select", "freecam", "noclip"].includes(mode)) return adminControls.mode;
    const previousMode = adminControls.mode;
    if (previousMode === "noclip" && mode !== "noclip") exitAdminNoclip();
    const handoff = previousMode === "freecam" && mode !== "freecam" ? handoffAdminFreecamToWarden() : false;
    if (mode === "noclip" && previousMode !== "noclip" && player.root) {
      const current = player.root.position;
      const blocked = hitsCollider(current.x, current.z, .68, current.y, current.y + 2.1);
      adminControls.noclipReturn = (blocked ? player.lastSafePosition : current).clone();
    }
    adminControls.mode = mode;
    adminControls.input.clear();
    if (camera) {
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      adminControls.freecamYaw = Math.atan2(-direction.x, -direction.z);
      adminControls.freecamPitch = -Math.asin(clamp(direction.y, -1, 1));
    }
    if (document.pointerLockElement) document.exitPointerLock();
    window.dispatchEvent(new CustomEvent("ashenhold:admin-mode", { detail: { mode, previousMode, handoff } }));
    return mode;
  }

  function exitAdminNoclip() {
    if (!player.root) return false;
    const height = 2.1;
    const current = player.root.position;
    if (hitsCollider(current.x, current.z, .68, current.y, current.y + height)) {
      let recovered = false;
      for (let ring = 1; ring <= 20 && !recovered; ring += 1) {
        const radius = ring * .75;
        for (let index = 0; index < 24; index += 1) {
          const angle = index / 24 * Math.PI * 2;
          const x = clamp(current.x + Math.cos(angle) * radius, -HALF_WORLD, HALF_WORLD);
          const z = clamp(current.z + Math.sin(angle) * radius, -HALF_WORLD, HALF_WORLD);
          if (hitsCollider(x, z, .68, current.y, current.y + height)) continue;
          current.x = x;
          current.z = z;
          recovered = true;
          break;
        }
      }
      if (!recovered && adminControls.noclipReturn) current.copy(adminControls.noclipReturn);
    }
    if (!hitsCollider(current.x, current.z, .68, current.y, current.y + height)) player.lastSafePosition.copy(current);
    player.velocityY = 0;
    player.grounded = false;
    adminControls.noclipReturn = null;
    return true;
  }

  function applyAdminLook(deltaX, deltaY) {
    if (adminControls.mode === "freecam") {
      adminControls.freecamYaw -= deltaX * .0025;
      adminControls.freecamPitch = clamp(adminControls.freecamPitch + deltaY * .0022, -1.48, 1.48);
    } else {
      applyLookDelta(deltaX, deltaY, .0025, .0019);
    }
  }

  function updateAdminControls(dt) {
    if (!adminMode || !camera || !player.root) return;
    const input = adminControls.input;
    const boost = input.has("shift") ? 3.2 : 1;
    if (adminControls.mode === "freecam") {
      const forward = new THREE.Vector3(
        -Math.sin(adminControls.freecamYaw) * Math.cos(adminControls.freecamPitch),
        -Math.sin(adminControls.freecamPitch),
        -Math.cos(adminControls.freecamYaw) * Math.cos(adminControls.freecamPitch)
      ).normalize();
      const right = new THREE.Vector3(Math.cos(adminControls.freecamYaw), 0, -Math.sin(adminControls.freecamYaw));
      const movement = new THREE.Vector3();
      if (input.has("w")) movement.add(forward);
      if (input.has("s")) movement.sub(forward);
      if (input.has("d")) movement.add(right);
      if (input.has("a")) movement.sub(right);
      if (input.has("e")) movement.y += 1;
      if (input.has("q")) movement.y -= 1;
      if (movement.lengthSq()) camera.position.addScaledVector(movement.normalize(), adminControls.speed * boost * dt);
      camera.lookAt(camera.position.clone().addScaledVector(forward, 100));
      if (sky) sky.position.copy(camera.position);
    } else if (adminControls.mode === "noclip") {
      const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
      const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
      const movement = new THREE.Vector3();
      if (input.has("w")) movement.add(forward);
      if (input.has("s")) movement.sub(forward);
      if (input.has("d")) movement.add(right);
      if (input.has("a")) movement.sub(right);
      if (input.has("e")) movement.y += 1;
      if (input.has("q")) movement.y -= 1;
      if (movement.lengthSq()) {
        player.root.position.addScaledVector(movement.normalize(), adminControls.speed * boost * dt);
        player.velocityY = 0;
        player.grounded = false;
      }
    }
    updateAdminSelectionVisual();
  }

  function adminTextureCatalog() {
    const paths = new Set([
      "assets/textures/storm-sky-panorama.jpg", DESERT_SKYBOX_PATH, MOON_SKYBOX_PATH, SHORE_SKYBOX_PATH, SNOWY_SKYBOX_PATH, MOUNTAIN_SKYBOX_PATH, "assets/textures/ashen-ground.jpg",
      "assets/textures/ancient-stone.jpg", "assets/textures/alpine-cliff.jpg", "assets/textures/tundra-grass-v1.jpg"
    ]);
    Object.keys(visualAssets.biomeMaterialCatalog || {}).forEach((id) => {
      const entry = visualAssets.biomeMaterialCatalog[id];
      paths.add(entry.base + "-color" + entry.extension);
      paths.add(entry.base + "-normal" + entry.extension);
      paths.add(entry.base + "-roughness" + entry.extension);
    });
    return Array.from(paths).sort();
  }

  const adminModelAssetPromises = new Map();
  function ensureAdminModelAsset(modelSlot) {
    if (visualAssets.models && visualAssets.models[modelSlot]) return Promise.resolve(visualAssets.models[modelSlot]);
    const path = visualAssets.modelPaths && visualAssets.modelPaths[modelSlot];
    if (!path || !visualAssets.modelLoader) return Promise.resolve(null);
    if (!adminModelAssetPromises.has(modelSlot)) {
      adminModelAssetPromises.set(modelSlot, visualAssets.modelLoader.loadAsync(path).then((asset) => {
        visualAssets.models[modelSlot] = asset;
        measureLoadedModelRegistry();
        return asset;
      }).catch((error) => {
        adminModelAssetPromises.delete(modelSlot);
        console.warn("Editor model failed to load:", modelSlot, error);
        return null;
      }));
    }
    return adminModelAssetPromises.get(modelSlot);
  }

  async function preloadAdminOverrideModels() {
    const slots = Array.from(new Set(Object.keys(editorDocument.entities)
      .map((id) => editorDocument.entities[id] && editorDocument.entities[id].modelSlot)
      .filter(Boolean)));
    await Promise.all(slots.map((slot) => ensureAdminModelAsset(slot)));
  }

  function createAdminCustomModel(id, entry) {
    if (!entry || entry.deleted || adminEntities.has(id)) return adminEntities.get(id) || null;
    const slot = entry.modelSlot;
    const asset = visualAssets.models && visualAssets.models[slot];
    if (!asset || !asset.scene) return null;
    const root = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(asset.scene) : asset.scene.clone(true);
    root.name = entry.label || "Custom " + slot;
    const fallbackPosition = player.root ? player.root.position.clone() : START.clone();
    const position = entry.position || { x: fallbackPosition.x, y: terrainHeight(fallbackPosition.x, fallbackPosition.z), z: fallbackPosition.z };
    const scale = entry.scale || {
      x: canonicalModelScale(slot), y: modelVerticalScale(slot, canonicalModelScale(slot)), z: canonicalModelScale(slot)
    };
    root.position.set(position.x, position.y, position.z);
    root.rotation.y = entry.rotationY || 0;
    root.scale.set(scale.x, scale.y, scale.z);
    root.traverse((object) => {
      if (!object.isMesh && !object.isSkinnedMesh) return;
      object.castShadow = !isCoarse;
      object.receiveShadow = true;
      if (object.material) object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
    });
    scene.add(root);
    let collider = null;
    if (entry.collision !== false) {
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      collider = addCollider(center.x, center.z, Math.max(.15, size.x / 2), Math.max(.15, size.z / 2), root.rotation.y, box.min.y, box.max.y);
    }
    return registerAdminEntity(root, {
      id, label: root.name, type: "custom-model", category: "Custom Objects", modelSlot: slot,
      colliders: collider ? [collider] : []
    });
  }

  async function loadAdminCustomModels() {
    let loaded = 0;
    const entries = Object.keys(editorDocument.entities).map((id) => [id, editorDocument.entities[id]])
      .filter(([, entry]) => entry.type === "custom-model" && !entry.deleted);
    await Promise.all(entries.map(async ([id, entry]) => {
      if (!visualAssets.models[entry.modelSlot]) await ensureAdminModelAsset(entry.modelSlot);
      if (createAdminCustomModel(id, entry)) loaded += 1;
    }));
    return loaded;
  }

  function addAdminCustomModel(modelSlot) {
    if (!adminMode || !visualAssets.models || !visualAssets.models[modelSlot] || !camera) return null;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const position = camera.position.clone().addScaledVector(forward, 12);
    position.x = clamp(position.x, -HALF_WORLD, HALF_WORLD);
    position.z = clamp(position.z, -HALF_WORLD, HALF_WORLD);
    position.y = Math.max(terrainHeight(position.x, position.z), position.y);
    const horizontal = canonicalModelScale(modelSlot);
    const id = "custom:" + Date.now().toString(36) + ":" + Math.random().toString(36).slice(2, 7);
    editorDocument.entities[id] = {
      type: "custom-model", label: "Custom " + modelSlot, modelSlot,
      position: { x: position.x, y: position.y, z: position.z }, rotationY: 0,
      scale: { x: horizontal, y: modelVerticalScale(modelSlot, horizontal), z: horizontal },
      visible: true, collision: true
    };
    const record = createAdminCustomModel(id, editorDocument.entities[id]);
    if (!record) { delete editorDocument.entities[id]; return null; }
    selectAdminEntity(id);
    commitAdminHistory("Add " + modelSlot);
    return adminEntitySummary(record);
  }

  function duplicateAdminEntity(id) {
    const source = adminEntities.get(id);
    if (!source || !source.modelSlot) return null;
    const transform = adminEntityTransform(source);
    const created = addAdminCustomModel(source.modelSlot);
    if (!created) return null;
    const record = adminEntities.get(created.id);
    transform.position.x += 2;
    transform.position.z += 2;
    applyAdminTransform(record, transform, true);
    if (source.color) applyAdminColor(record, source.color, true);
    if (source.texture) applyAdminTexture(record, source.texture, true).catch(() => {});
    commitAdminHistory("Duplicate " + source.label);
    return adminEntitySummary(record);
  }

  function deleteAdminEntity(id) {
    const record = adminEntities.get(id);
    if (!adminEntityLifecycleCapabilities(record).canRemove) return false;
    const entry = editorDocument.entities[id] || { type: record.type };
    entry.deleted = true;
    entry.visible = false;
    editorDocument.entities[id] = entry;
    applyAdminEntityVisibility(record, false);
    if (record.type === "custom-model") {
      if (record.root.parent) record.root.parent.remove(record.root);
      unregisterAdminEntity(id);
    }
    commitAdminHistory("Delete " + record.label);
    return true;
  }

  function resizeAdminLinkedGeometryForModel(record, oldSize, newSize) {
    const baseline = record.defaultTransform || { position: record.baseAnchor };
    const factorX = clamp(newSize.x / Math.max(.01, oldSize.x), .05, 20);
    const factorY = clamp(newSize.y / Math.max(.01, oldSize.y), .05, 20);
    const factorZ = clamp(newSize.z / Math.max(.01, oldSize.z), .05, 20);
    (record.colliderLinks || []).forEach((link) => {
      link.base.x = baseline.position.x + (link.base.x - baseline.position.x) * factorX;
      link.base.z = baseline.position.z + (link.base.z - baseline.position.z) * factorZ;
      link.base.hx = Math.max(.05, link.base.hx * factorX);
      link.base.hz = Math.max(.05, link.base.hz * factorZ);
      link.base.minY = baseline.position.y + (link.base.minY - baseline.position.y) * factorY;
      link.base.maxY = baseline.position.y + (link.base.maxY - baseline.position.y) * factorY;
    });
    (record.platformLinks || []).forEach((link) => {
      link.base.x = baseline.position.x + (link.base.x - baseline.position.x) * factorX;
      link.base.z = baseline.position.z + (link.base.z - baseline.position.z) * factorZ;
      link.base.hx = Math.max(.05, link.base.hx * factorX);
      link.base.hz = Math.max(.05, link.base.hz * factorZ);
      link.base.y = baseline.position.y + (link.base.y - baseline.position.y) * factorY;
    });
    updateAdminLinkedGeometry(record, adminEntityTransform(record));
  }

  function applyAdminModelSlot(record, modelSlot, persist) {
    const asset = visualAssets.models && visualAssets.models[modelSlot];
    if (!record || !record.modelSlot || !asset || !asset.scene) return false;
    if (record.modelSlot === modelSlot) return true;
    const oldSize = new THREE.Vector3();
    new THREE.Box3().setFromObject(record.root).getSize(oldSize);
    const replacement = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(asset.scene) : asset.scene.clone(true);
    replacement.updateMatrixWorld(true);
    const newSize = new THREE.Vector3();
    new THREE.Box3().setFromObject(replacement).getSize(newSize);
    const oldSpan = Math.max(.01, oldSize.x, oldSize.y, oldSize.z);
    const newSpan = Math.max(.01, newSize.x, newSize.y, newSize.z);
    replacement.scale.setScalar(oldSpan / newSpan / Math.max(.001, Math.max(record.root.scale.x, record.root.scale.y, record.root.scale.z)));
    record.root.clear();
    record.root.add(replacement);
    record.root.updateMatrixWorld(true);
    const replacementSize = new THREE.Vector3();
    new THREE.Box3().setFromObject(record.root).getSize(replacementSize);
    resizeAdminLinkedGeometryForModel(record, oldSize, replacementSize);
    record.modelSlot = modelSlot;
    record.label = "Imported " + modelSlot;
    record.appearance = captureAdminAppearance(record.root);
    tagAdminEntityRoot(record);
    if (persist !== false) {
      const entry = editorDocument.entities[record.id] || { type: record.type };
      entry.modelSlot = modelSlot;
      editorDocument.entities[record.id] = entry;
    }
    return true;
  }

  function replaceAdminEntityModel(id, modelSlot) {
    const record = adminEntities.get(id);
    if (!applyAdminModelSlot(record, modelSlot, true)) return false;
    commitAdminHistory("Replace model with " + modelSlot);
    selectAdminEntity(id);
    return true;
  }

  function recolorAdminTerrain() {
    if (!terrain || !terrain.geometry || !terrain.geometry.attributes.position || !terrain.geometry.attributes.color) return false;
    const position = terrain.geometry.attributes.position;
    const colors = terrain.geometry.attributes.color;
    const textured = Boolean(visualAssets.biomeGround || visualAssets.ground);
    const color = new THREE.Color();
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const z = position.getZ(index);
      const y = position.getY(index);
      const definition = BIOMES[biomeIdAt(x, z)];
      const low = new THREE.Color(definition.ground).multiplyScalar(textured ? 1.15 : .72);
      const rock = new THREE.Color(definition.cliff);
      const high = new THREE.Color(definition.frost).lerp(new THREE.Color(definition.cliff), .5);
      const snow = new THREE.Color(definition.frost);
      if (y < 12) color.copy(low).lerp(rock, clamp((y - 1) / 18, 0, 1));
      else if (y < 48) color.copy(rock).lerp(high, (y - 12) / 36);
      else color.copy(high).lerp(snow, clamp((y - 48) / 52, 0, 1));
      const variation = .91 + seeded(index + 91) * .12;
      colors.setXYZ(index, color.r * variation, color.g * variation, color.b * variation);
    }
    colors.needsUpdate = true;
    return true;
  }

  function applyAdminBiomeSettings(id, values, persist) {
    const definition = BIOMES[id];
    if (!definition || !values) return false;
    const stored = Object.assign({}, editorDocument.biomes[id] || {});
    ["ground", "cliff", "grass", "fog", "frost", "sky", "sun"].forEach((field) => {
      const color = overrideColor(values[field]);
      if (color == null) return;
      definition[field] = color;
      stored[field] = "#" + color.toString(16).padStart(6, "0");
    });
    ["fogDensity", "exposure", "treeDensity", "propDensity", "grassDensity"].forEach((field) => {
      if (values[field] === undefined) return;
      const limits = field === "fogDensity" ? [0, .025] : field === "exposure" ? [.15, 4] : [0, 3];
      const value = overrideNumber(values[field], limits[0], limits[1], stored[field] === undefined ? 1 : stored[field]);
      stored[field] = value;
      if (field === "fogDensity" || field === "exposure") definition[field] = value;
    });
    if (TREELESS_BIOME_IDS.has(id)) stored.treeDensity = 0;
    if (persist !== false) editorDocument.biomes[id] = stored;
    forestChunks.filter((chunk) => chunk.biomeId === id).forEach((chunk) => {
      const density = stored.treeDensity === undefined ? 1 : stored.treeDensity;
      const count = Math.min(chunk.baseCount, Math.max(0, Math.round(chunk.baseCount * density / chunk.baseDensity)));
      chunk.count = count;
      (chunk.lodMeshes || []).forEach((meshes) => meshes.forEach((mesh) => { if (mesh.isInstancedMesh) mesh.count = count; }));
    });
    biomePropMeshes.filter((entry) => entry.biomeId === id).forEach((entry) => {
      const density = stored.propDensity === undefined ? 1 : stored.propDensity;
      entry.mesh.count = Math.min(entry.capacity, Math.max(0, Math.round(entry.baseCount * density / entry.baseDensity)));
    });
    if (grassField) {
      const grassAverage = BIOME_IDS.reduce((sum, biomeId) => sum + (editorDocument.biomes[biomeId] && editorDocument.biomes[biomeId].grassDensity !== undefined ? editorDocument.biomes[biomeId].grassDensity : 1), 0) / BIOME_IDS.length;
      grassField.count = Math.min(grassField.instanceMatrix.count, Math.max(0, Math.round(grassBaseCount * grassAverage / grassBaseDensity)));
    }
    if (visualAssets.skyboxes) {
      const previousSkybox = visualAssets.skyboxes[id];
      visualAssets.skyboxes[id] = createBiomeSkyTexture(id);
      if (id === currentBiomeId && sky && sky.material) { sky.material.map = visualAssets.skyboxes[id]; sky.material.needsUpdate = true; }
      if (previousSkybox && previousSkybox.dispose) previousSkybox.dispose();
    }
    recolorAdminTerrain();
    updateActiveBiomePresentation(true);
    if (persist !== false) commitAdminHistory("Tune " + BIOMES[id].name);
    return Object.assign({}, stored);
  }

  function setAdminEnemyProfile(kind, values) {
    if (!kind || kind === "global") editorDocument.enemies.global = Object.assign({}, editorDocument.enemies.global || {}, values || {});
    else editorDocument.enemies.byKind[kind] = Object.assign({}, editorDocument.enemies.byKind[kind] || {}, values || {});
    editorDocument = sanitizeWorldOverrides(editorDocument);
    dragons.forEach(applyAdminEnemyTuningAndSpecific);
    groundEnemies.forEach(applyAdminEnemyTuningAndSpecific);
    commitAdminHistory("Tune " + (kind || "global") + " enemies");
    return adminEnemyTuning(kind && kind !== "global" ? kind : "enemy");
  }

  function adminValidationReport() {
    const issues = [];
    let customObjects = 0;
    Object.keys(editorDocument.entities).forEach((id) => {
      const entry = editorDocument.entities[id];
      if (entry.type === "custom-model") customObjects += 1;
      if (entry.modelSlot && !visualAssets.modelPaths[entry.modelSlot]) issues.push({ severity: "error", id, message: "Unknown model slot: " + entry.modelSlot });
      if (entry.position && (Math.abs(entry.position.x) > HALF_WORLD || Math.abs(entry.position.z) > HALF_WORLD)) issues.push({ severity: "error", id, message: "Position is outside the authored continent." });
      if (entry.position && terrain && entry.position.y < waterLevelAt(entry.position.x, entry.position.z) - 8) issues.push({ severity: "warning", id, message: "Object is far below the biome waterline." });
      if (entry.scale && Math.max(entry.scale.x, entry.scale.y, entry.scale.z) / Math.max(.02, Math.min(entry.scale.x, entry.scale.y, entry.scale.z)) > 12) issues.push({ severity: "warning", id, message: "Extreme non-uniform scale may distort collisions." });
    });
    return {
      valid: !issues.some((issue) => issue.severity === "error"), issues,
      entities: adminEntities.size, overrides: Object.keys(editorDocument.entities).length,
      customObjects, colliders: colliders.filter((item) => !item.disabled).length,
      worldSignature: WORLD_LAYOUT_SIGNATURE, schemaVersion: WORLD_OVERRIDE_SCHEMA_VERSION
    };
  }

  function adminSourceFile(documentValue) {
    const clean = sanitizeWorldOverrides(documentValue || editorDocument);
    return "(function () {\n  \"use strict\";\n  window.AshenholdWorldOverrides = " + JSON.stringify(clean, null, 2) + ";\n})();\n";
  }

  function reapplyRegisteredEntityOverrides() {
    Array.from(adminEntities.values())
      .sort((a, b) => Number(b.type === "location") - Number(a.type === "location"))
      .forEach(applyAdminEntityOverride);
  }

  function applyAdminDocument(value, historyReason) {
    if (historyReason) validateAdminDocumentInput(value);
    const next = sanitizeWorldOverrides(value);
    editorDocument = next;
    BIOME_IDS.forEach((id) => applyAdminBiomeSettings(id, Object.assign({}, BASE_BIOME_SETTINGS[id], next.biomes[id] || {}), false));
    const records = Array.from(adminEntities.values());
    records.forEach((record) => {
      if (record.originalModelSlot) applyAdminModelSlot(record, record.originalModelSlot, false);
      restoreAdminAppearance(record);
      applyAdminTransform(record, record.defaultTransform, false);
      if (adminEntityLifecycleCapabilities(record).canHide) setAdminEntityVisibility(record, record.defaultVisible, false);
    });
    dragons.forEach((enemy) => applyAdminEnemyTuning(enemy, false));
    groundEnemies.forEach((enemy) => applyAdminEnemyTuning(enemy, false));
    records.slice().sort((a, b) => Number(b.type === "location") - Number(a.type === "location")).forEach(applyAdminEntityOverride);
    records.forEach((record) => {
      if (record.type === "custom-model" && !next.entities[record.id]) {
        if (record.root.parent) record.root.parent.remove(record.root);
        unregisterAdminEntity(record.id);
      }
    });
    loadAdminCustomModels().then(() => announceAdminChange("custom-models-loaded", null)).catch(() => {});
    if (historyReason) commitAdminHistory(historyReason);
    announceAdminChange("document-applied", null);
    return adminDocumentSnapshot();
  }

  function stepAdminHistory(direction) {
    const nextIndex = adminHistoryIndex + direction;
    if (nextIndex < 0 || nextIndex >= adminHistory.length) return false;
    adminHistoryIndex = nextIndex;
    applyAdminDocument(JSON.parse(adminHistory[adminHistoryIndex].serialized), null);
    return true;
  }

  function setAdminEntityTransform(id, patch, checkpoint) {
    const record = adminEntities.get(id);
    if (!record) return null;
    const current = adminEntityTransform(record);
    const source = patch || {};
    const next = {
      position: Object.assign({}, current.position, source.position || {}),
      rotationY: source.rotationY !== undefined ? Number(source.rotationY) : current.rotationY,
      scale: Object.assign({}, current.scale, source.scale || {})
    };
    applyAdminTransform(record, next, true);
    if (checkpoint !== false) commitAdminHistory("Transform " + record.label);
    else announceAdminChange("transform-preview", id);
    return adminEntitySummary(record);
  }

  function setAdminEntityCollision(id, enabled, persist) {
    const record = adminEntities.get(id);
    if (!record) return false;
    if (!record.colliderLinks.length && enabled) {
      record.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(record.root);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const collider = addCollider(center.x, center.z, Math.max(.15, size.x / 2), Math.max(.15, size.z / 2), adminEntityTransform(record).rotationY, box.min.y, box.max.y);
      record.colliderLinks.push({ target: collider, base: Object.assign({}, collider) });
    }
    const active = Boolean(enabled) && record.root.visible;
    record.colliderLinks.forEach((link) => { link.target.disabled = !active; });
    record.platformLinks.forEach((link) => { link.target.disabled = !active; });
    if (persist !== false) {
      const entry = editorDocument.entities[id] || { type: record.type };
      entry.collision = Boolean(enabled);
      editorDocument.entities[id] = entry;
      commitAdminHistory((enabled ? "Enable" : "Disable") + " collision for " + record.label);
    }
    return true;
  }

  function focusAdminEntity(id) {
    const record = adminEntities.get(id);
    if (!record || !camera) return false;
    const transform = adminEntityTransform(record);
    const center = new THREE.Vector3(transform.position.x, transform.position.y, transform.position.z);
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(record.root).getSize(size);
    const distance = clamp(Math.max(size.x, size.y, size.z) * 1.45, 7, 120);
    setAdminMode("freecam");
    camera.position.copy(center).add(new THREE.Vector3(distance * .62, distance * .42, distance));
    const direction = center.clone().sub(camera.position).normalize();
    adminControls.freecamYaw = Math.atan2(-direction.x, -direction.z);
    adminControls.freecamPitch = -Math.asin(clamp(direction.y, -1, 1));
    camera.lookAt(center);
    return true;
  }

  function initializeAdminMode() {
    if (!adminMode || window.__ASHENHOLD_ADMIN__) return false;
    const runtime = {
      version: 1,
      isLocal: true,
      info: () => ({
        ready: state !== "loading", mode: adminControls.mode, transformMode: adminControls.transformMode,
        simulationPaused: adminControls.simulationPaused, selectedId: adminSelectedId,
        entities: adminEntities.size, revision: adminRevision,
        history: { index: adminHistoryIndex, length: adminHistory.length },
        camera: camera ? {
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          forward: (() => { const value = new THREE.Vector3(); camera.getWorldDirection(value); return { x: value.x, y: value.y, z: value.z }; })(),
          gameplayYaw: cameraYaw, gameplayPitch: cameraPitch,
          freecamYaw: adminControls.freecamYaw, freecamPitch: adminControls.freecamPitch
        } : null,
        warden: player.root ? {
          position: { x: player.root.position.x, y: player.root.position.y, z: player.root.position.z },
          lastSafePosition: { x: player.lastSafePosition.x, y: player.lastSafePosition.y, z: player.lastSafePosition.z },
          velocityY: player.velocityY, grounded: player.grounded, airbornePhase: player.airbornePhase,
          moving: player.moving, sprinting: player.sprinting, superSprinting: player.superSprinting,
          sprintLatch: player.sprintLatch, superSprintLatch: player.superSprintLatch,
          sliding: player.sliding, slideSpeed: player.slideSpeed, dodgeTime: player.dodgeTime,
          airMomentum: { x: player.airMomentum.x, y: player.airMomentum.y, z: player.airMomentum.z },
          groundMomentum: { x: player.groundMomentum.x, y: player.groundMomentum.y, z: player.groundMomentum.z }
        } : null,
        controls: {
          activeInputs: Array.from(adminControls.input).sort(), dragActive: Boolean(adminDrag),
          dragId: adminDrag && adminDrag.id || null, dragMode: adminDrag && adminDrag.mode || null,
          dragAxis: adminDrag && adminDrag.axis || null
        },
        worldSignature: WORLD_LAYOUT_SIGNATURE
      }),
      listEntities: () => Array.from(adminEntities.values()).map((record) => ({
        id: record.id, label: record.label, type: record.type, category: record.category,
        modelSlot: record.modelSlot, visible: Boolean(record.root && record.root.visible), protected: record.protected,
        canHide: adminEntityLifecycleCapabilities(record).canHide,
        canRemove: adminEntityLifecycleCapabilities(record).canRemove
      })).sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label)),
      getEntity: (id) => adminEntitySummary(adminEntities.get(id)),
      select: selectAdminEntity,
      pick: pickAdminEntity,
      entityAt: (clientX, clientY) => adminEntitySummary(adminEntityAt(clientX, clientY)),
      pickGizmo: pickAdminGizmo,
      projectEntity: projectAdminEntity,
      projectGizmo: projectAdminGizmo,
      focus: focusAdminEntity,
      setTransformMode: (mode) => {
        if (["translate", "rotate", "scale"].includes(mode)) adminControls.transformMode = mode;
        return adminControls.transformMode;
      },
      beginDrag: beginAdminDrag,
      beginDirectDrag: beginAdminDirectDrag,
      drag: dragAdminTransform,
      endDrag: endAdminDrag,
      setTransform: setAdminEntityTransform,
      setColor: (id, color) => {
        const record = adminEntities.get(id);
        if (!applyAdminColor(record, color, true)) return false;
        commitAdminHistory("Color " + record.label);
        return adminEntitySummary(record);
      },
      setTexture: async (id, path) => {
        const record = adminEntities.get(id);
        if (!await applyAdminTexture(record, path, true)) return false;
        commitAdminHistory("Texture " + record.label);
        return adminEntitySummary(record);
      },
      setVisible: (id, visible) => {
        const record = adminEntities.get(id);
        if (!setAdminEntityVisibility(record, visible, true)) return false;
        commitAdminHistory((visible ? "Show " : "Hide ") + record.label);
        return adminEntitySummary(record);
      },
      setCollision: setAdminEntityCollision,
      setEnemy: (id, values) => {
        const record = adminEntities.get(id);
        if (!applyAdminEnemyValues(record, values, true)) return false;
        commitAdminHistory("Tune " + record.label);
        return adminEntitySummary(record);
      },
      ground: (id) => {
        const record = adminEntities.get(id);
        if (!record) return false;
        const transform = adminEntityTransform(record);
        transform.position.y = terrainHeight(transform.position.x, transform.position.z);
        return setAdminEntityTransform(id, transform, true);
      },
      addModel: addAdminCustomModel,
      duplicate: duplicateAdminEntity,
      remove: deleteAdminEntity,
      replaceModel: replaceAdminEntityModel,
      modelCatalog: () => Object.keys(visualAssets.modelPaths || {}).sort().map((id) => ({
        id, path: visualAssets.modelPaths[id], metric: modelScaleRegistry[id] ? Object.assign({}, modelScaleRegistry[id]) : null
      })),
      textureCatalog: adminTextureCatalog,
      biomes: () => BIOME_IDS.map((id) => Object.assign({ id, name: BIOMES[id].name, treeless: TREELESS_BIOME_IDS.has(id) }, editorDocument.biomes[id] || {}, {
        ground: (editorDocument.biomes[id] && editorDocument.biomes[id].ground) || "#" + BIOMES[id].ground.toString(16).padStart(6, "0"),
        cliff: (editorDocument.biomes[id] && editorDocument.biomes[id].cliff) || "#" + BIOMES[id].cliff.toString(16).padStart(6, "0"),
        grass: (editorDocument.biomes[id] && editorDocument.biomes[id].grass) || "#" + BIOMES[id].grass.toString(16).padStart(6, "0"),
        fog: (editorDocument.biomes[id] && editorDocument.biomes[id].fog) || "#" + BIOMES[id].fog.toString(16).padStart(6, "0"),
        fogDensity: editorDocument.biomes[id] && editorDocument.biomes[id].fogDensity !== undefined ? editorDocument.biomes[id].fogDensity : BIOMES[id].fogDensity,
        exposure: editorDocument.biomes[id] && editorDocument.biomes[id].exposure !== undefined ? editorDocument.biomes[id].exposure : BIOMES[id].exposure,
        treeDensity: TREELESS_BIOME_IDS.has(id) ? 0 : editorDocument.biomes[id] && editorDocument.biomes[id].treeDensity !== undefined ? editorDocument.biomes[id].treeDensity : 1,
        propDensity: editorDocument.biomes[id] && editorDocument.biomes[id].propDensity !== undefined ? editorDocument.biomes[id].propDensity : 1,
        grassDensity: editorDocument.biomes[id] && editorDocument.biomes[id].grassDensity !== undefined ? editorDocument.biomes[id].grassDensity : 1
      })),
      setBiome: applyAdminBiomeSettings,
      enemyProfiles: () => ({ document: JSON.parse(JSON.stringify(editorDocument.enemies)), effective: ["biomeLight", "biomeHeavy", "warg", "golem", "dragon"].reduce((output, kind) => { output[kind] = adminEnemyTuning(kind); return output; }, {}) }),
      setEnemyProfile: setAdminEnemyProfile,
      getDocument: adminDocumentSnapshot,
      setDocument: (value) => applyAdminDocument(value, "Import editor document"),
      sourceFile: adminSourceFile,
      validate: adminValidationReport,
      undo: () => stepAdminHistory(-1),
      redo: () => stepAdminHistory(1),
      canUndo: () => adminHistoryIndex > 0,
      canRedo: () => adminHistoryIndex >= 0 && adminHistoryIndex < adminHistory.length - 1,
      controls: {
        setMode: setAdminMode,
        setInput: (key, active) => { const normalized = String(key || "").toLowerCase(); if (active) adminControls.input.add(normalized); else adminControls.input.delete(normalized); },
        clearInput: () => adminControls.input.clear(),
        look: applyAdminLook,
        setPaused: (paused) => { adminControls.simulationPaused = Boolean(paused); return adminControls.simulationPaused; },
        setSpeed: (speed) => { adminControls.speed = clamp(Number(speed) || 34, 2, 250); return adminControls.speed; },
        setSnap: (values) => { adminControls.snap = Object.assign({}, adminControls.snap, values || {}); return Object.assign({}, adminControls.snap); }
      }
    };
    Object.freeze(runtime.controls);
    Object.freeze(runtime);
    Object.defineProperty(window, "__ASHENHOLD_ADMIN__", { value: runtime, configurable: true, enumerable: false, writable: false });
    commitAdminHistory("Open editor");
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "admin-editor.css";
    stylesheet.dataset.ashenholdAdminAsset = "true";
    const script = document.createElement("script");
    script.src = "admin-editor.js";
    script.defer = true;
    script.dataset.ashenholdAdminAsset = "true";
    script.addEventListener("load", () => { adminUiLoaded = true; window.dispatchEvent(new CustomEvent("ashenhold:admin-ready")); });
    script.addEventListener("error", () => console.error("The local Ashenhold admin UI could not be loaded."));
    document.head.appendChild(stylesheet);
    document.body.appendChild(script);
    return true;
  }
  function generateWorldLayout() {
    // These anchors are intentionally authored and immutable. Every player enters
    // the same continent and can walk between its six biomes without a reload.
    const forts = [
      [-590, 355, -.12, 4.4, "TIDEBREAK WATCH", "shore"],
      [82, 390, .2, 4.55, "MOSSWATCH HOLD", "jungle"],
      [590, 350, -.28, 4.5, "SUNSCAR CITADEL", "desert"],
      [-585, -405, .22, 4.45, "WHITEFANG BASTION", "snowy"],
      [4, -560, -.18, 4.65, "THUNDER BASTION", "mountains"],
      [590, -410, .31, 4.55, "ECLIPSE WATCH", "moon"]
    ];
    const routes = [
      [-720, 125, 5.1, -4.7, 10, "CLIFFWALK", "shore"],
      [-115, 535, 5.2, -4.4, 10, "CANOPY STEPS", "jungle"],
      [705, 145, -5.1, -4.5, 10, "MESA ASCENT", "desert"],
      [-705, -655, 5.0, 4.6, 10, "ICEFALL ASCENT", "snowy"],
      [-120, -735, 5.2, 4.5, 11, "EAGLE SWITCHBACK", "mountains"],
      [710, -660, -5.0, 4.6, 10, "CRATER CAUSEWAY", "moon"]
    ];
    return { id: WORLD_ID, signature: WORLD_LAYOUT_SIGNATURE, version: WORLD_LAYOUT_VERSION, forts, routes, roadPhase: -.42, salt: 24000 };
  }

  const authoredLocationAnchors = new Map();

  function applyAuthoredAnchorOverride(id, target, arrayTarget) {
    if (!authoredLocationAnchors.has(id)) {
      authoredLocationAnchors.set(id, arrayTarget
        ? { x: target[0], z: target[1] }
        : { x: target.x, z: target.z });
    }
    const override = editorDocument.entities["location:" + id];
    if (!override || !override.position) return target;
    if (arrayTarget) {
      target[0] = override.position.x;
      target[1] = override.position.z;
    } else {
      target.x = override.position.x;
      target.z = override.position.z;
    }
    return target;
  }
  const POI_NAMES = {
    snowy: { hamlet: ["RIMEFALL HAMLET", "FROSTHEARTH"], watchpost: ["PALEWATCH POST", "GLACIER LOOKOUT"], shrine: ["SHRINE OF THE HOAR", "FROSTBOUND SHRINE"], camp: ["WOLFSDRIFT CAMP", "RAZORICE CAMP"], ruin: ["RUINS OF ICEMERE", "SHATTERED VIGIL"] },
    jungle: { hamlet: ["MOSSGATE HAMLET", "VINEBOROUGH CAMP"], watchpost: ["CANOPY WATCH", "THORNLOOK POST"], shrine: ["SHRINE OF VINES", "OVERGROWN ALTAR"], camp: ["FERNTOOTH CAMP", "THORNRAIDER CAMP"], ruin: ["SUNKEN RUINS", "BROKEN ZIGGURAT"] },
    desert: { hamlet: ["EMBERWELL HAMLET", "DUNESIDE CAMP"], watchpost: ["SUNSCAR WATCH", "CINDER LOOKOUT"], shrine: ["SHRINE OF EMBERS", "GLASS ALTAR"], camp: ["SCORPION CAMP", "DUNEREAVER CAMP"], ruin: ["RUINS OF EMBERFALL", "GLASSFALL RUINS"] },
    shore: { hamlet: ["TIDEHOLLOW HAMLET", "SALTMARSH CAMP"], watchpost: ["STORMSIGN WATCH", "REEF LOOKOUT"], shrine: ["SHRINE OF TIDES", "DROWNED ALTAR"], camp: ["TIDEWOLF CAMP", "WRECKER CAMP"], ruin: ["DROWNED RUINS", "SALTBOUND RUINS"] },
    mountains: { hamlet: ["CRAGFALL HAMLET", "HIGHHEARTH"], watchpost: ["EAGLE LOOKOUT", "THUNDER WATCH"], shrine: ["SHRINE OF PEAKS", "SKY ALTAR"], camp: ["STORMCROW CAMP", "PEAKRAIDER CAMP"], ruin: ["RUINS OF THE SKYTHRONE", "THUNDERSHARD RUINS"] },
    moon: { hamlet: ["UMBRA HAMLET", "DUSKFALL CAMP"], watchpost: ["ECLIPSE WATCH POST", "VOIDGAZE LOOKOUT"], shrine: ["GRAVEYARD OF ECHOES", "MOONLIT CRYPTS"], camp: ["UMBRAL CAMP", "NIGHTTALON CAMP"], ruin: ["RUINS OF THE ECLIPSE", "VOIDSCAR RUINS"] }
  };
  // Runs after worldLayout/terrainFeatures exist (rawTerrainHeight reads both), before foundationZones are built.
  function generatePoiLayout() {
    return [
      { kind: "shrine", x: -735, z: 475, rotation: .2, name: "SHRINE OF TIDES", biomeId: "shore" },
      { kind: "hamlet", x: -430, z: 570, rotation: -.35, name: "TIDEHOLLOW HAMLET", biomeId: "shore" },
      { kind: "shrine", x: -165, z: 430, rotation: -.18, name: "SHRINE OF VINES", biomeId: "jungle" },
      { kind: "ruin", x: 175, z: 600, rotation: .42, name: "BROKEN ZIGGURAT", biomeId: "jungle" },
      { kind: "shrine", x: 735, z: 485, rotation: -.24, name: "SHRINE OF EMBERS", biomeId: "desert" },
      { kind: "camp", x: 420, z: 590, rotation: .3, name: "DUNEREAVER CAMP", biomeId: "desert" },
      { kind: "shrine", x: -735, z: -490, rotation: -.15, name: "SHRINE OF THE HOAR", biomeId: "snowy" },
      { kind: "watchpost", x: -430, z: -655, rotation: .25, name: "GLACIER LOOKOUT", biomeId: "snowy" },
      { kind: "shrine", x: -165, z: -470, rotation: .12, name: "SHRINE OF PEAKS", biomeId: "mountains" },
      { kind: "ruin", x: 175, z: -705, rotation: -.38, name: "RUINS OF THE SKYTHRONE", biomeId: "mountains" },
      { kind: "shrine", x: 735, z: -495, rotation: .32, name: "GRAVEYARD OF ECHOES", biomeId: "moon" },
      { kind: "camp", x: 420, z: -665, rotation: -.22, name: "UMBRAL CAMP", biomeId: "moon" }
    ];
  }
  const worldLayout = generateWorldLayout();
  applyAuthoredAnchorOverride("keep", RUINS, false);
  worldLayout.forts.forEach((fort, index) => applyAuthoredAnchorOverride("fort-" + index, fort, true));
  worldLayout.routes.forEach((route, index) => applyAuthoredAnchorOverride("route-" + index, route, true));
  function buildTerrainFeatures() {
    return [
      { x: -730, z: 180, radius: 128, height: 26, biomeId: "shore" }, { x: -445, z: 665, radius: 95, height: 20, biomeId: "shore" },
      { x: -130, z: 610, radius: 115, height: 42, biomeId: "jungle" }, { x: 165, z: 430, radius: 92, height: 35, biomeId: "jungle" },
      { x: 455, z: 650, radius: 118, height: 32, biomeId: "desert" }, { x: 745, z: 180, radius: 96, height: 29, biomeId: "desert" },
      { x: -720, z: -690, radius: 132, height: 48, biomeId: "snowy" }, { x: -420, z: -270, radius: 102, height: 38, biomeId: "snowy" },
      { x: -155, z: -735, radius: 142, height: 72, biomeId: "mountains" }, { x: 180, z: -350, radius: 115, height: 58, biomeId: "mountains" },
      { x: 435, z: -690, radius: 112, height: 35, biomeId: "moon" }, { x: 735, z: -250, radius: 96, height: 31, biomeId: "moon" }
    ];
  }
  const terrainFeatures = buildTerrainFeatures();
  const terrainFeaturesByBiome = new Map(BIOME_IDS.map((id) => [id, terrainFeatures.filter((feature) => feature.biomeId === id)]));
  worldLayout.pois = generatePoiLayout();
  worldLayout.pois.forEach((poi, index) => applyAuthoredAnchorOverride("poi-" + index, poi, false));
  function generateInfrastructureLayout() {
    const salt = worldLayout.salt + 10400;
    const palettes = {
      jungle: ["collapsed-wall", "road-shrine", "abandoned-farm", "hunter-platform", "broken-cart", "root-vigil"],
      shore: ["collapsed-wall", "road-shrine", "fisher-camp", "broken-cart", "watch-platform", "drowned-pier"],
      desert: ["buried-wall", "road-shrine", "abandoned-farm", "broken-cart", "waystone", "petrified-vigil"],
      snowy: ["collapsed-wall", "road-shrine", "hunter-platform", "broken-cart", "waystone", "frozen-camp"],
      mountains: ["collapsed-wall", "road-shrine", "watch-platform", "broken-cart", "waystone", "fallen-bridge"],
      moon: ["collapsed-wall", "void-shrine", "ruined-habitation", "broken-cart", "waystone", "crystal-vigil"]
    };
    const target = 48;
    const sites = [];
    const anchors = [[START.x, START.z, 52], [TITLE_VANTAGE.x, TITLE_VANTAGE.z, 42], [RUINS.x, RUINS.z - 24, 86], [RUNE_HOLLOW.x, RUNE_HOLLOW.z, 38]];
    for (let slot = 0; slot < target; slot += 1) {
      for (let attempt = 0; attempt < 96; attempt += 1) {
        const roll = salt + slot * 419 + attempt * 17;
        const x = (seeded(roll + 1) - .5) * 1480;
        const z = (seeded(roll + 2) - .5) * 1480;
        if (Math.abs(x) > 740 || Math.abs(z) > 740) continue;
        const y = rawTerrainHeight(x, z);
        if (y <= BIOMES[biomeIdAt(x, z)].waterLevel + .8) continue;
        const slope = Math.abs(rawTerrainHeight(x + 2, z) - y) + Math.abs(rawTerrainHeight(x, z + 2) - y);
        if (slope > 1.25) continue;
        if (z > -195 && z < 245 && Math.abs(x - roadCenterAt(z)) < 25) continue;
        let clear = anchors.every((anchor) => Math.hypot(x - anchor[0], z - anchor[1]) >= anchor[2]);
        for (let index = 0; index < worldLayout.forts.length && clear; index += 1) clear = Math.hypot(x - worldLayout.forts[index][0], z - worldLayout.forts[index][1]) >= 78;
        for (let index = 0; index < worldLayout.routes.length && clear; index += 1) clear = Math.hypot(x - worldLayout.routes[index][0], z - worldLayout.routes[index][1]) >= 58;
        for (let index = 0; index < worldLayout.pois.length && clear; index += 1) clear = Math.hypot(x - worldLayout.pois[index].x, z - worldLayout.pois[index].z) >= 54;
        for (let index = 0; index < sites.length && clear; index += 1) clear = Math.hypot(x - sites[index].x, z - sites[index].z) >= 35;
        if (!clear) continue;
        const biomeId = biomeIdAt(x, z);
        const kinds = palettes[biomeId] || palettes.jungle;
        sites.push({
          id: "micro-" + slot, kind: kinds[Math.floor(seeded(roll + 3) * kinds.length)], biomeId,
          x, z, rotation: seeded(roll + 4) * Math.PI * 2, variant: Math.floor(seeded(roll + 5) * 4)
        });
        break;
      }
    }
    return sites;
  }
  worldLayout.infrastructure = generateInfrastructureLayout();
  worldLayout.infrastructure.forEach((site) => applyAuthoredAnchorOverride(site.id, site, false));
  const foundationZones = [
    { id: "title-vantage", x: TITLE_VANTAGE.x, z: TITLE_VANTAGE.z, inner: 14, outer: 28, lift: 0 },
    { id: "start", x: START.x, z: START.z, inner: 18, outer: 42, lift: .2 },
    { id: "keep", x: RUINS.x, z: RUINS.z - 27, inner: 47, outer: 84, lift: 0 },
    { id: "rune-hollow", x: RUNE_HOLLOW.x, z: RUNE_HOLLOW.z, inner: 10, outer: 24, lift: 0 }
  ].concat(worldLayout.forts.map((fort, index) => ({ id: "fort-" + index, x: fort[0], z: fort[1], inner: 38, outer: 68, lift: .15 })))
    .concat(worldLayout.routes.map((route, index) => ({ id: "route-" + index, x: route[0], z: route[1], inner: 16, outer: 34, lift: .25 })))
    .concat(worldLayout.pois.map((poi, index) => ({ id: "poi-" + index, x: poi.x, z: poi.z, inner: poi.kind === "hamlet" ? 23 : 17, outer: poi.kind === "hamlet" ? 44 : 35, lift: .18 })));
  const foundationTargets = new Map();
  function roadCenterAt(z) {
    const t = clamp((215 - z) / 368, 0, 1);
    return Math.sin(t * Math.PI * worldProfile.road.frequency + worldLayout.roadPhase) * worldProfile.road.wander;
  }
  function delay(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }

  const SAVE_KEY = "ashenhold-progression-v3";
  const MAX_WEAPON_LEVEL = 10;
  const defineSkill = (id, name, description, options) => Object.assign({
    id, name, description, scope: "permanent", cost: 1, maxRank: 1
  }, options || {});
  const skillTree = [
    {
      id: "warden", title: "THE WARDEN", kicker: "BODY & SURVIVAL", rune: "W",
      copy: "Build an unbreakable body for the long war.", nodes: [
        defineSkill("vitality", "DRAGONHEART", "+12 maximum health per rank.", { maxRank: 3 }),
        defineSkill("endurance", "IRON LUNGS", "+10 stamina and faster recovery per rank.", { maxRank: 3, requiresRanks: { vitality: 2 } }),
        defineSkill("survivor", "UNBROKEN", "Take 6% less damage per rank.", { maxRank: 3, requiresRanks: { endurance: 2 }, requiredLevel: 5 }),
        defineSkill("second_wind", "SECOND WIND", "Survive one lethal blow per encounter.", { requiresAll: ["survivor"], requiredLevel: 12, cost: 2 }),
        defineSkill("bastion", "ASHEN BASTION", "+10 health and stagger resistance per rank.", { maxRank: 2, requiresAny: ["second_wind", "survivor"], requiredLevel: 18, cost: 2 }),
        defineSkill("immortal_warden", "WARDEN ETERNAL", "Kills restore more health and low-health recovery doubles.", { requiresRanks: { bastion: 2 }, requiredLevel: 34, cost: 3 })
      ]
    },
    {
      id: "warmaster", title: "WARMASTER", kicker: "ARSENAL MASTERY", rune: "M",
      copy: "Turn mastery of many weapons into one fighting style.", nodes: [
        defineSkill("edge", "TEMPERED EDGE", "+6% damage with every weapon per rank.", { maxRank: 3 }),
        defineSkill("fury", "BLOOD TEMPO", "+6% attack speed and efficiency per rank.", { maxRank: 3, requiresRanks: { edge: 2 }, requiredMastery: { weapon: "any", level: 3 } }),
        defineSkill("executioner", "DRAGONCLEAVER", "+15% damage to bosses and wounded prey per rank.", { maxRank: 2, requiresRanks: { fury: 2 }, requiredMastery: { weapon: "any", level: 5 }, cost: 2 }),
        defineSkill("battle_focus", "BATTLE FOCUS", "Consecutive hits build damage until you are struck.", { maxRank: 3, requiresAny: ["fury", "executioner"], requiredLevel: 16 }),
        defineSkill("swift_change", "SWIFT CHANGE", "Weapon swaps empower the next attack.", { maxRank: 2, requiresAll: ["battle_focus"], requiredLevel: 24, cost: 2 }),
        defineSkill("arsenal_master", "ARSENAL ASCENDANT", "All weapon masteries reinforce the equipped weapon.", { requiresRanks: { swift_change: 2, executioner: 2 }, requiredLevel: 42, requiredMastery: { weapon: "all", level: 5 }, cost: 3 })
      ]
    },
    {
      id: "voice", title: "THE VOICE", kicker: "DRAGON SHOUT", rune: "V",
      copy: "Turn the storm into a weapon.", nodes: [
        defineSkill("echo", "ECHOING SOUL", "Charge Dragon Shout 12% faster per rank.", { maxRank: 3 }),
        defineSkill("force", "FORCE UNBOUND", "+12% shout damage and reach per rank.", { maxRank: 3, requiresRanks: { echo: 2 } }),
        defineSkill("stormborn", "STORMBORN", "Dragon Shout restores health and stamina.", { requiresRanks: { force: 2 }, requiredLevel: 8, cost: 2 }),
        defineSkill("resonance", "RESONANT ARMOR", "Shouting grants brief damage resistance per rank.", { maxRank: 2, requiresAny: ["stormborn", "force"], requiredLevel: 17 }),
        defineSkill("thunderstep", "THUNDERSTEP", "A charged dodge releases a stagger pulse.", { requiresAll: ["resonance"], requiredLevel: 25, cost: 2 }),
        defineSkill("world_voice", "WORLD-VOICE", "A full shout chains lightning between nearby enemies.", { requiresRanks: { resonance: 2 }, requiresAll: ["thunderstep"], requiredLevel: 40, cost: 3 })
      ]
    },
    {
      id: "wayfarer", title: "THE WAYFARER", kicker: "MOBILITY & RUNES", rune: "Y",
      copy: "Cross impossible ground and drink ancient power.", nodes: [
        defineSkill("windstep", "WINDSTEP", "Super Sprint gains speed and efficiency per rank.", { maxRank: 3 }),
        defineSkill("acrobat", "SKYBOUND", "Higher jumps and stronger air control per rank.", { maxRank: 2, requiresRanks: { windstep: 2 }, requiredLevel: 4 }),
        defineSkill("runecraft", "RUNEKEEPER", "Runes grant +12% Warden and run XP per rank.", { maxRank: 3, requiresAll: ["acrobat"], requiredLevel: 8 }),
        defineSkill("pathfinder", "PATHFINDER", "Reveal nearby landmarks and improve discovery rewards.", { maxRank: 2, requiresAny: ["runecraft", "acrobat"], requiredLevel: 15 }),
        defineSkill("mountaineer", "MOUNTAIN SOUL", "Faster fall recovery and superior slope handling.", { requiresRanks: { pathfinder: 2 }, requiredLevel: 23, cost: 2 }),
        defineSkill("realmwalker", "WORLDWALKER", "New campaigns begin with run XP and a route reveal.", { requiresAll: ["mountaineer"], requiresRanks: { runecraft: 3 }, requiredLevel: 38, cost: 3 })
      ]
    },
    {
      id: "duelist", title: "THE DUELIST", kicker: "BLADE DISCIPLINE", rune: "D",
      copy: "Precision, tempo, and lethal close-range control.", nodes: [
        defineSkill("blade_focus", "HONED STEEL", "+7% blade damage per rank.", { maxRank: 3, requiredMastery: { weapon: "blade", level: 2 } }),
        defineSkill("riposte", "RIPOSTE", "Attacks after a dodge deal bonus damage per rank.", { maxRank: 2, requiresRanks: { blade_focus: 2 }, requiredMastery: { weapon: "blade", level: 3 } }),
        defineSkill("bleeding_edge", "BLEEDING EDGE", "Blade hits can inflict stacking bleed.", { maxRank: 3, requiresAny: ["riposte", "blade_focus"], requiredLevel: 14 }),
        defineSkill("blade_dance", "BLADE DANCE", "Blade attacks accelerate through uninterrupted combos.", { maxRank: 2, requiresRanks: { bleeding_edge: 2 }, requiredMastery: { weapon: "blade", level: 6 }, cost: 2 }),
        defineSkill("perfect_cut", "PERFECT CUT", "Critical blade strikes stagger elites.", { requiresAll: ["blade_dance"], requiredLevel: 29, cost: 2 }),
        defineSkill("sword_saint", "SWORD SAINT", "Every fifth blade hit is armor-piercing.", { requiresRanks: { blade_dance: 2, bleeding_edge: 3 }, requiresAll: ["perfect_cut"], requiredMastery: { weapon: "blade", level: 9 }, requiredLevel: 44, cost: 3 })
      ]
    },
    {
      id: "ranger", title: "THE RANGER", kicker: "BOWCRAFT", rune: "R",
      copy: "Own the battlefield before it reaches you.", nodes: [
        defineSkill("marksman", "HAWKEYE", "+7% bow damage per rank.", { maxRank: 3, requiredMastery: { weapon: "bow", level: 2 } }),
        defineSkill("quickdraw", "QUICKDRAW", "Draw faster and spend less stamina per rank.", { maxRank: 3, requiresRanks: { marksman: 2 }, requiredMastery: { weapon: "bow", level: 3 } }),
        defineSkill("piercer", "HEARTSEEKER", "+14% damage to bosses and healthy prey per rank.", { maxRank: 2, requiresRanks: { quickdraw: 2 }, requiredLevel: 10, cost: 2 }),
        defineSkill("eagle_eye", "EAGLE EYE", "Arrows fly faster, flatter, and farther.", { maxRank: 2, requiresAny: ["piercer", "quickdraw"], requiredMastery: { weapon: "bow", level: 5 } }),
        defineSkill("split_arrow", "SPLIT ARROW", "Timed shots loose a spectral side arrow.", { requiresRanks: { eagle_eye: 2 }, requiredLevel: 27, cost: 2 }),
        defineSkill("storm_archer", "STORM ARCHER", "Critical arrows arc lightning to a second target.", { requiresAll: ["split_arrow"], requiresRanks: { piercer: 2 }, requiredMastery: { weapon: "bow", level: 9 }, requiredLevel: 43, cost: 3 })
      ]
    },
    {
      id: "reaver", title: "THE REAVER", kicker: "AXE DISCIPLINE", rune: "A",
      copy: "Break armor, formation, and nerve with crushing force.", nodes: [
        defineSkill("axe_focus", "HEAVY HAND", "+7% axe damage per rank.", { maxRank: 3, requiredMastery: { weapon: "axe", level: 2 } }),
        defineSkill("sundering", "SUNDERING BLOWS", "Gain knockback and armor break per rank.", { maxRank: 3, requiresRanks: { axe_focus: 2 }, requiredMastery: { weapon: "axe", level: 3 } }),
        defineSkill("aftershock", "AFTERSHOCK", "Heavy impacts create wider shockwaves.", { maxRank: 2, requiresRanks: { sundering: 2 }, requiredLevel: 13, cost: 2 }),
        defineSkill("blood_pact", "BLOOD PACT", "Low health raises axe damage but reduces healing.", { requiresAny: ["aftershock", "sundering"], excludes: ["stoneguard"], requiredLevel: 22, cost: 2 }),
        defineSkill("stoneguard", "STONEGUARD", "Axe windups grant armor at a critical-damage cost.", { requiresAny: ["aftershock", "sundering"], excludes: ["blood_pact"], requiredLevel: 22, cost: 2 }),
        defineSkill("world_splitter", "WORLD SPLITTER", "Charged impacts erupt twice and launch normal enemies.", { requiresRanks: { aftershock: 2, sundering: 3 }, requiresAny: ["blood_pact", "stoneguard"], requiredMastery: { weapon: "axe", level: 9 }, requiredLevel: 45, cost: 3 })
      ]
    },
    {
      id: "arcanist", title: "THE ARCANIST", kicker: "STAFF DISCIPLINE", rune: "S",
      copy: "Shape storm energy into control and destruction.", nodes: [
        defineSkill("staff_focus", "STORM CHANNEL", "+7% staff damage per rank.", { maxRank: 3, requiredMastery: { weapon: "staff", level: 2 } }),
        defineSkill("mana_weave", "MANA WEAVE", "Staff attacks cost less stamina per rank.", { maxRank: 3, requiresRanks: { staff_focus: 2 }, requiredMastery: { weapon: "staff", level: 3 } }),
        defineSkill("chain_spark", "CHAIN SPARK", "Staff blasts chain to nearby enemies.", { maxRank: 2, requiresRanks: { mana_weave: 2 }, requiredLevel: 12, cost: 2 }),
        defineSkill("frost_nova", "FROST NOVA", "Close staff hits slow surrounding enemies.", { maxRank: 2, requiresAny: ["chain_spark", "mana_weave"], requiredMastery: { weapon: "staff", level: 6 } }),
        defineSkill("overcharge", "OVERCHARGE", "Full-stamina casts gain damage and radius.", { requiresRanks: { frost_nova: 2 }, requiredLevel: 28, cost: 2 }),
        defineSkill("tempest_crown", "TEMPEST CROWN", "Every sixth staff cast summons a lightning field.", { requiresAll: ["overcharge"], requiresRanks: { chain_spark: 2 }, requiredMastery: { weapon: "staff", level: 9 }, requiredLevel: 44, cost: 3 })
      ]
    },
    {
      id: "stride", title: "THE STRIDE", kicker: "SPRINT & STORM MOTION", rune: ">",
      copy: "Break the horizon with escalating speed, endurance, and lightning.", nodes: [
        defineSkill("gale_pace", "GALE PACE", "+15% sprint speed and +10% super-sprint speed per rank.", { maxRank: 3 }),
        defineSkill("tempest_pace", "TEMPEST PACE", "+25% super-sprint speed per rank.", { maxRank: 3, requiresRanks: { gale_pace: 3 }, requiredLevel: 6 }),
        defineSkill("marathon", "MARATHON", "Reduce sprint and super-sprint stamina drain by 25% per rank.", { maxRank: 2 }),
        defineSkill("second_lungs", "SECOND LUNGS", "+30% stamina regeneration while sprinting per rank.", { maxRank: 2, requiresRanks: { marathon: 1 } }),
        defineSkill("stormlaunch", "STORMLAUNCH", "Engaging super sprint releases a damaging knockback shockwave.", { requiresRanks: { tempest_pace: 2 }, cost: 2 }),
        defineSkill("stormstride", "STORMSTRIDE", "+25% super-sprint speed and leave a damaging lightning trail.", { requiresAll: ["stormlaunch"], requiresRanks: { tempest_pace: 3 }, requiredLevel: 12, cost: 3 })
      ]
    },
    {
      id: "run_offense", title: "RUN: FURY", kicker: "TEMPORARY CONSTELLATION", rune: "+", scope: "run",
      copy: "Power that lasts until victory or death.", nodes: [
        defineSkill("run_damage", "BLOODSHARP", "+6% damage per rank this run.", { scope: "run", maxRank: 3 }),
        defineSkill("run_haste", "QUICKENED", "+5% attack speed per rank this run.", { scope: "run", maxRank: 3, requiresRanks: { run_damage: 2 } }),
        defineSkill("run_crit", "FATED STRIKE", "+4% critical chance per rank this run.", { scope: "run", maxRank: 2, requiresRanks: { run_haste: 2 }, cost: 2 }),
        defineSkill("run_rampage", "RAMPAGE", "Kills briefly amplify movement and damage.", { scope: "run", requiresRanks: { run_crit: 2 }, cost: 3 })
      ]
    },
    {
      id: "run_survival", title: "RUN: RESOLVE", kicker: "TEMPORARY CONSTELLATION", rune: "+", scope: "run",
      copy: "Adapt to the dangers of the continent.", nodes: [
        defineSkill("run_vigor", "BORROWED VIGOR", "+15 maximum health per rank this run.", { scope: "run", maxRank: 3 }),
        defineSkill("run_endurance", "DEEP RESERVE", "+12 maximum stamina per rank this run.", { scope: "run", maxRank: 3, requiresRanks: { run_vigor: 2 } }),
        defineSkill("run_guard", "REALM GUARD", "Take 5% less damage per rank this run.", { scope: "run", maxRank: 2, requiresAny: ["run_vigor", "run_endurance"], cost: 2 }),
        defineSkill("run_rebirth", "PHOENIX OATH", "Second Wind refreshes after clearing a stronghold.", { scope: "run", requiresRanks: { run_guard: 2 }, cost: 3 })
      ]
    },
    {
      id: "run_hunt", title: "RUN: HUNT", kicker: "TEMPORARY CONSTELLATION", rune: "+", scope: "run",
      copy: "Learn the land, then turn it against its guardians.", nodes: [
        defineSkill("run_xp", "LORE HUNGER", "+12% run XP per rank.", { scope: "run", maxRank: 3 }),
        defineSkill("run_slayer", "MONSTER LORE", "+5% damage to biome enemies per rank.", { scope: "run", maxRank: 3, requiresRanks: { run_xp: 2 } }),
        defineSkill("run_scavenger", "WAR SPOILS", "Enemies restore extra health and stamina per rank.", { scope: "run", maxRank: 2, requiresAny: ["run_xp", "run_slayer"], cost: 2 }),
        defineSkill("run_apex", "APEX HUNTER", "+20% boss damage and a larger clear reward.", { scope: "run", requiresRanks: { run_slayer: 3, run_scavenger: 2 }, cost: 3 })
      ]
    }
  ];
  const skillById = new Map();
  skillTree.forEach((branch) => branch.nodes.forEach((node, index) => {
    node.branchId = branch.id;
    node.scope = node.scope || branch.scope || "permanent";
    node.rankLabel = roman(index + 1);
    skillById.set(node.id, node);
  }));

  const MAX_WARDEN_LEVEL = 50;
  function levelXpTarget(level) { return 140 + Math.max(0, level - 1) * 100; }
  function runXpTarget(level) { return 90 + Math.max(0, level - 1) * 55; }
  function weaponXpTarget(level) { return 65 + Math.max(0, level - 1) * 45; }
  function masteryFor(id) { return player.mastery[id || player.activeWeapon] || player.mastery.blade; }
  function highestWeaponLevel() { return Math.max.apply(null, WEAPON_IDS.map((id) => masteryFor(id).level)); }
  function skillRank(id) {
    const node = skillById.get(id);
    const source = node && node.scope === "run" ? player.runSkills : player.skills;
    return Math.max(0, Math.floor(Number(source[id]) || 0));
  }
  function hasSkill(id) { return skillRank(id) > 0; }
  function relicBonus(id) { return Math.max(0, Number(player.relicBonuses && player.relicBonuses[id]) || 0); }
  function maxHealth() {
    const base = 100 + (player.level - 1) * 4 + skillRank("vitality") * 12 + skillRank("bastion") * 10 + skillRank("run_vigor") * 15;
    return Math.round(base * (1 + relicBonus("health") / 100));
  }
  function maxStamina() {
    const base = 100 + (player.level - 1) * 2 + skillRank("endurance") * 10 + skillRank("run_endurance") * 12;
    return Math.round(base * (1 + relicBonus("stamina") / 100));
  }
  function weaponDamageMultiplier(id) {
    const focus = id === "blade" ? skillRank("blade_focus") : id === "bow" ? skillRank("marksman") : id === "axe" ? skillRank("axe_focus") : skillRank("staff_focus");
    const arsenal = hasSkill("arsenal_master") ? WEAPON_IDS.reduce((sum, weaponId) => sum + masteryFor(weaponId).level - 1, 0) * .006 : 0;
    const combo = elapsed < player.comboExpires ? Math.min(player.comboHits, 5) * skillRank("battle_focus") * .012 : 0;
    const rampage = player.rampageTime > 0 && hasSkill("run_rampage") ? .16 : 0;
    const bloodPact = id === "axe" && hasSkill("blood_pact") && player.health < maxHealth() * .4 ? .28 : 0;
    return (1 + (masteryFor(id).level - 1) * .055 + skillRank("edge") * .06 + focus * .07 + skillRank("run_damage") * .06 + skillRank("run_slayer") * .05 + arsenal + combo + rampage + bloodPact) * (1 + relicBonus("damage") / 100);
  }
  function attackSpeedMultiplier(id) {
    const speed = skillRank("fury") * .06 + skillRank("run_haste") * .05 + (id === "bow" ? skillRank("quickdraw") * .06 : 0) + (id === "blade" ? skillRank("blade_dance") * .04 : 0);
    return clamp(1 - speed, .56, 1);
  }
  function attackStaminaCost(id) {
    const weaponId = id || player.activeWeapon;
    const reduction = skillRank("fury") * .07 + (weaponId === "bow" ? skillRank("quickdraw") * .06 : 0) + (weaponId === "staff" ? skillRank("mana_weave") * .08 : 0);
    const efficiency = clamp(1 - reduction, .52, 1);
    return Math.max(5, Math.round(WEAPONS[weaponId].stamina * efficiency));
  }
  function shoutChargeMultiplier() { return 1 + skillRank("echo") * .12; }
  function roman(value) {
    const numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    return numerals[clamp(Math.floor(value), 1, 10) - 1];
  }

  let progressionSaveTimer = 0;
  function loadProgression() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) || "null");
      if (!saved || typeof saved !== "object") return;
      const saveVersion = Math.floor(Number(saved.version) || 0);
      if (saveVersion > 6) {
        console.warn("Progression save uses a newer schema (v" + saveVersion + "); leaving it untouched");
        return;
      }
      player.level = clamp(Math.floor(Number(saved.level) || 1), 1, MAX_WARDEN_LEVEL);
      player.xp = clamp(Math.floor(Number(saved.xp) || 0), 0, levelXpTarget(player.level) - 1);
      player.skillPoints = clamp(Math.floor(Number(saved.skillPoints) || 0), 0, 999);
      player.prestige = clamp(Math.floor(Number(saved.prestige) || 0), 0, 9999);
      player.realmDepth = clamp(Math.floor(Number(saved.realmDepth) || 0), 0, 9999);
      player.mastery = freshMastery();
      if (saved.mastery && typeof saved.mastery === "object") {
        WEAPON_IDS.forEach((id) => {
          const source = saved.mastery[id] || {};
          const level = clamp(Math.floor(Number(source.level) || 1), 1, MAX_WEAPON_LEVEL);
          player.mastery[id].level = level;
          player.mastery[id].xp = level >= MAX_WEAPON_LEVEL ? 0 : clamp(Math.floor(Number(source.xp) || 0), 0, weaponXpTarget(level) - 1);
        });
      } else {
        const legacyLevel = clamp(Math.floor(Number(saved.weaponLevel) || 1), 1, MAX_WEAPON_LEVEL);
        player.mastery.blade.level = legacyLevel;
        player.mastery.blade.xp = legacyLevel >= MAX_WEAPON_LEVEL ? 0 : clamp(Math.floor(Number(saved.weaponXp) || 0), 0, weaponXpTarget(legacyLevel) - 1);
      }
      player.activeWeapon = WEAPONS[saved.activeWeapon] ? saved.activeWeapon : "blade";
      player.skills = {};
      if (saved.skills && typeof saved.skills === "object") {
        Object.keys(saved.skills).forEach((id) => {
          const node = skillById.get(id);
          if (!node || node.scope === "run" || !saved.skills[id]) return;
          const migratedRank = saved.skills[id] === true ? 1 : Math.floor(Number(saved.skills[id]) || 0);
          player.skills[id] = clamp(migratedRank, 0, node.maxRank || 1);
        });
      }
      player.relicBonuses = freshRelicBonuses();
      if (saved.relicBonuses && typeof saved.relicBonuses === "object") {
        Object.keys(player.relicBonuses).forEach((id) => {
          player.relicBonuses[id] = clamp(Number(saved.relicBonuses[id]) || 0, 0, 500);
        });
      }
    } catch (error) {
      console.warn("Progression save could not be loaded", error);
    }
  }

  function saveProgression(immediate) {
    if (persistenceDisabled) return;
    if (!immediate) {
      window.clearTimeout(progressionSaveTimer);
      progressionSaveTimer = window.setTimeout(() => saveProgression(true), 350);
      return;
    }
    try {
      const activeMastery = masteryFor();
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        version: 6,
        level: player.level, xp: player.xp, skillPoints: player.skillPoints,
        prestige: player.prestige, realmDepth: player.realmDepth,
        activeWeapon: player.activeWeapon, mastery: player.mastery,
        weaponLevel: activeMastery.level, weaponXp: activeMastery.xp, skills: player.skills,
        relicBonuses: player.relicBonuses
      }));
    } catch (error) {
      console.warn("Progression save could not be written", error);
    }
  }

  let runSaveTimer = 0;
  let activeRunId = pendingRunState && pendingRunState.runId ? pendingRunState.runId : "continent-" + Date.now().toString(36);

  function serializeActiveRun() {
    if (!player.root) return null;
    return {
      version: 1, status: "active", layoutVersion: WORLD_LAYOUT_VERSION, worldId: WORLD_ID, layoutSignature: WORLD_LAYOUT_SIGNATURE, runId: activeRunId,
      savedAt: Date.now(), depth: player.realmDepth,
      player: {
        x: player.root.position.x, y: player.root.position.y, z: player.root.position.z, rotation: player.root.rotation.y,
        health: player.health, stamina: player.stamina, shout: player.shout, kills: player.kills,
        dragonKills: player.dragonKills, distance: player.distance, activeWeapon: player.activeWeapon,
        runLevel: player.runLevel, runXp: player.runXp, runSkillPoints: player.runSkillPoints, runSkills: player.runSkills
      },
      world: {
        questStage, bossSpawned, outpostsDiscovered, runesCollected,
        discoveredCells: Array.from(discoveredCells).slice(0, 2400),
        landmarks: landmarks.filter((landmark) => landmark.discovered).map((landmark) => landmark.id),
        runes: experienceRunes.filter((rune) => rune.claimed).map((rune) => rune.id),
        chests: chests.filter((chest) => chest.opened).map((chest) => chest.id),
        deadDragons: dragons.filter((dragon) => dragon.dead).map((dragon) => dragon.name),
        strongholds: strongholds.filter((stronghold) => stronghold.cleared).map((stronghold) => stronghold.id),
        handledStrongholdMembers: groundEnemies.filter((enemy) => isOwnedCompanion(enemy) && enemy.spawnKey).map((enemy) => enemy.spawnKey),
        companions: groundEnemies.filter(isOwnedCompanion).slice(0, 2).map((enemy) => ({
          kind: enemy.kind, name: enemy.originalName || enemy.name.replace(/^BONDED\s+/, ""), health: enemy.health
        })),
        rngState: encounterRng.state
      }
    };
  }

  function writeActiveRun() {
    window.clearTimeout(runSaveTimer);
    runSaveTimer = 0;
    if (persistenceDisabled || state === "ended") return;
    const payload = serializeActiveRun();
    if (!payload) return;
    try { window.localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(payload)); }
    catch (error) { console.warn("Active run save could not be written", error); }
  }

  function markRunDirty(immediate) {
    if (persistenceDisabled || state === "ended" || state === "loading" || state === "title") return;
    if (immediate) { writeActiveRun(); return; }
    if (!runSaveTimer) runSaveTimer = window.setTimeout(writeActiveRun, 1200);
  }

  function clearActiveRun() {
    window.clearTimeout(runSaveTimer);
    runSaveTimer = 0;
    pendingRunState = null;
    if (persistenceDisabled) return;
    try { window.localStorage.removeItem(RUN_SAVE_KEY); }
    catch (error) { console.warn("Active run save could not be cleared", error); }
  }

  function applySavedStrongholds(saved) {
    const clearedIds = saved && saved.world && Array.isArray(saved.world.strongholds) ? saved.world.strongholds : [];
    strongholds.forEach((stronghold) => {
      stronghold.cleared = clearedIds.indexOf(stronghold.id) !== -1;
      updateStrongholdMarker(stronghold);
    });
  }

  function restoreActiveRun(saved) {
    if (!saved || !saved.player || !saved.world) return false;
    const runPlayer = saved.player;
    player.runLevel = clamp(Math.floor(Number(runPlayer.runLevel) || 1), 1, 25);
    player.runXp = clamp(Math.floor(Number(runPlayer.runXp) || 0), 0, runXpTarget(player.runLevel) - 1);
    player.runSkillPoints = clamp(Math.floor(Number(runPlayer.runSkillPoints) || 0), 0, 99);
    player.runSkills = {};
    if (runPlayer.runSkills && typeof runPlayer.runSkills === "object") Object.keys(runPlayer.runSkills).forEach((id) => {
      const node = skillById.get(id);
      if (node && node.scope === "run") player.runSkills[id] = clamp(Math.floor(Number(runPlayer.runSkills[id]) || 0), 0, node.maxRank || 1);
    });
    const x = clamp(Number(runPlayer.x) || START.x, -HALF_WORLD + 2, HALF_WORLD - 2);
    const z = clamp(Number(runPlayer.z) || START.z, -HALF_WORLD + 2, HALF_WORLD - 2);
    const terrainY = playerSurfaceHeightAt(x, z, Number(runPlayer.y) || 0);
    const savedY = Number(runPlayer.y);
    const restoredY = Number.isFinite(savedY) ? Math.max(terrainY, Math.min(savedY, terrainY + 90)) : terrainY;
    if (hitsCollider(x, z, .8, restoredY, restoredY + 2.15)) player.root.position.copy(player.lastSafePosition);
    else player.root.position.set(x, restoredY, z);
    player.wading = isPlayerWadingAt(player.root.position.x, player.root.position.z, player.root.position.y);
    player.root.rotation.y = Number(runPlayer.rotation) || 0;
    player.health = clamp(Number(runPlayer.health) || maxHealth(), 1, maxHealth());
    player.stamina = clamp(Number(runPlayer.stamina) || maxStamina(), 0, maxStamina());
    player.shout = clamp(Number(runPlayer.shout) || 0, 0, 100);
    player.kills = Math.max(0, Math.floor(Number(runPlayer.kills) || 0));
    player.dragonKills = Math.max(0, Math.floor(Number(runPlayer.dragonKills) || 0));
    player.distance = Math.max(0, Number(runPlayer.distance) || 0);
    if (WEAPONS[runPlayer.activeWeapon]) equipWeapon(runPlayer.activeWeapon, true);
    questStage = clamp(Math.floor(Number(saved.world.questStage) || 0), 0, 3);
    bossSpawned = Boolean(saved.world.bossSpawned);
    discoveredCells = new Set(Array.isArray(saved.world.discoveredCells) ? saved.world.discoveredCells.filter((cell) => typeof cell === "string").slice(0, 2400) : []);
    const landmarkIds = new Set(Array.isArray(saved.world.landmarks) ? saved.world.landmarks : []);
    landmarks.forEach((landmark) => {
      landmark.discovered = landmarkIds.has(landmark.id);
      landmark.revealed = landmark.discovered;
    });
    outpostsDiscovered = landmarks.filter((landmark) => landmark.outpost && landmark.discovered).length;
    const runeIds = new Set(Array.isArray(saved.world.runes) ? saved.world.runes : []);
    experienceRunes.forEach((rune) => {
      if (!runeIds.has(rune.id)) return;
      rune.claimed = true;
      rune.crystal.visible = false;
      rune.halo.visible = false;
      rune.marker.material.opacity = .12;
    });
    runesCollected = experienceRunes.filter((rune) => rune.claimed).length;
    const chestIds = new Set(Array.isArray(saved.world.chests) ? saved.world.chests : []);
    chests.forEach((chest) => {
      if (!chestIds.has(chest.id)) return;
      chest.opened = true;
      chest.openTime = .5;
      chest.lid.rotation.x = -1.9;
      chest.lockMaterial.visible = false;
      chest.marker.material.opacity = .12;
    });
    const deadNames = new Set(Array.isArray(saved.world.deadDragons) ? saved.world.deadDragons : []);
    dragons.forEach((dragon) => {
      if (!deadNames.has(dragon.name)) return;
      dragon.dead = true;
      dragon.health = 0;
      scene.remove(dragon.root);
    });
    if (bossSpawned && questStage >= 2 && !dragons.some((dragon) => dragon.boss)) spawnBoss(true);
    applySavedStrongholds(saved);
    const savedCompanions = Array.isArray(saved.world.companions) ? saved.world.companions.slice(0, 2) : [];
    savedCompanions.forEach((companion, index) => {
      if (companion.kind !== "warg" && companion.kind !== "biomeLight") return;
      const angle = player.root.rotation.y + (index ? 1.1 : -1.1);
      const x = clamp(player.root.position.x + Math.sin(angle) * 4, -HALF_WORLD, HALF_WORLD);
      const z = clamp(player.root.position.z + Math.cos(angle) * 4, -HALF_WORLD, HALF_WORLD);
      const enemy = createGroundEnemy(companion.kind, x, z, ambientDifficulty());
      enemy.originalName = typeof companion.name === "string" ? companion.name.slice(0, 80) : enemy.name;
      enemy.health = clamp(Number(companion.health) || enemy.maxHealth * .6, 1, enemy.maxHealth);
      tameEnemy(enemy, true, true);
    });
    const savedRngState = Number(saved.world.rngState) || (saved.director ? Number(saved.director.rngState) : 0);
    encounterRng.state = savedRngState ? savedRngState >>> 0 : (AUTHORED_WORLD_VARIATION ^ 0x6d2b79f5) >>> 0;
    activeRunId = saved.runId || activeRunId;
    pendingRunState = null;
    return true;
  }

  function showProgressionBanner(kicker, title, copy) {
    ui.levelUpKicker.textContent = kicker;
    ui.levelUpTitle.textContent = title;
    ui.levelUpCopy.textContent = copy;
    ui.levelUp.classList.remove("show");
    void ui.levelUp.offsetWidth;
    ui.levelUp.classList.add("show");
    audio.discover();
  }

  function grantXp(amount) {
    const oldMaximumHealth = maxHealth();
    player.xp += Math.max(0, Math.round(amount));
    let gained = 0;
    while (player.xp >= levelXpTarget(player.level)) {
      player.xp -= levelXpTarget(player.level);
      if (player.level < MAX_WARDEN_LEVEL) {
        player.level += 1;
        player.skillPoints += 1;
        gained += 1;
      } else {
        player.prestige += 1;
        showProgressionBanner("LEGEND DEEPENED", "PRESTIGE " + player.prestige, "Overflow XP became a prestige mark");
      }
    }
    if (gained) {
      player.health = maxHealth();
      player.stamina = maxStamina();
      registerNetworkMaxHealthUpgrade("level", gained, maxHealth() - oldMaximumHealth);
      showProgressionBanner("WARDEN ASCENDED", "LEVEL " + player.level, "+" + gained + " skill point" + (gained > 1 ? "s" : "") + " earned");
    }
    saveProgression();
    updateProgressionUI();
  }

  function grantRunXp(amount, reason) {
    const multiplier = 1 + skillRank("run_xp") * .12;
    player.runXp += Math.max(0, Math.round(amount * multiplier));
    let gained = 0;
    while (player.runLevel < 25 && player.runXp >= runXpTarget(player.runLevel)) {
      player.runXp -= runXpTarget(player.runLevel);
      player.runLevel += 1;
      player.runSkillPoints += 1;
      gained += 1;
    }
    if (gained) showProgressionBanner("REALM ATTUNEMENT", "RUN LEVEL " + player.runLevel, "+" + gained + " temporary skill point" + (gained > 1 ? "s" : ""));
    if (reason && gained === 0 && player.runLevel === 1) showMessage("RUN XP +" + Math.round(amount) + " - " + reason, "#a9d5c3");
    updateProgressionUI();
    markRunDirty();
  }

  function grantWeaponXp(amount, weaponId) {
    const id = WEAPONS[weaponId] ? weaponId : player.activeWeapon;
    const mastery = masteryFor(id);
    if (mastery.level >= MAX_WEAPON_LEVEL) return;
    mastery.xp += Math.max(0, Math.round(amount));
    let gained = 0;
    while (mastery.level < MAX_WEAPON_LEVEL && mastery.xp >= weaponXpTarget(mastery.level)) {
      mastery.xp -= weaponXpTarget(mastery.level);
      mastery.level += 1;
      gained += 1;
    }
    if (mastery.level >= MAX_WEAPON_LEVEL) mastery.xp = 0;
    if (gained) showProgressionBanner("WEAPON MASTERY", WEAPONS[id].name + " " + roman(mastery.level), "Weapon damage increased");
    saveProgression();
    updateProgressionUI();
  }

  function canPurchaseSkill(node) {
    if (!node || skillRank(node.id) >= (node.maxRank || 1)) return false;
    const points = node.scope === "run" ? player.runSkillPoints : player.skillPoints;
    if (points < (node.cost || 1)) return false;
    if (node.requiredLevel && player.level < node.requiredLevel) return false;
    if (node.requiresAll && !node.requiresAll.every(hasSkill)) return false;
    if (node.requiresAny && !node.requiresAny.some(hasSkill)) return false;
    if (node.requiresRanks && Object.keys(node.requiresRanks).some((id) => skillRank(id) < node.requiresRanks[id])) return false;
    if (node.excludes && node.excludes.some(hasSkill)) return false;
    if (node.requiredMastery) {
      const requirement = node.requiredMastery;
      if (requirement.weapon === "any" && highestWeaponLevel() < requirement.level) return false;
      if (requirement.weapon === "all" && WEAPON_IDS.some((id) => masteryFor(id).level < requirement.level)) return false;
      if (WEAPONS[requirement.weapon] && masteryFor(requirement.weapon).level < requirement.level) return false;
    }
    return true;
  }

  function skillStatus(node) {
    const rank = skillRank(node.id);
    const maxRank = node.maxRank || 1;
    if (rank >= maxRank) return "MASTERED " + rank + "/" + maxRank;
    if (node.excludes && node.excludes.some(hasSkill)) return "PATH EXCLUDED";
    if (node.requiresRanks) {
      const missing = Object.keys(node.requiresRanks).find((id) => skillRank(id) < node.requiresRanks[id]);
      if (missing) return "REQUIRES " + skillById.get(missing).name + " " + node.requiresRanks[missing] + "/" + (skillById.get(missing).maxRank || 1);
    }
    if (node.requiresAll && !node.requiresAll.every(hasSkill)) return "REQUIRES " + node.requiresAll.filter((id) => !hasSkill(id)).map((id) => skillById.get(id).name).join(" + ");
    if (node.requiresAny && !node.requiresAny.some(hasSkill)) return "REQUIRES ONE PRIOR PATH";
    if (node.requiredLevel && player.level < node.requiredLevel) return "WARDEN LEVEL " + node.requiredLevel;
    if (node.requiredMastery) {
      const requirement = node.requiredMastery;
      const ready = requirement.weapon === "any" ? highestWeaponLevel() >= requirement.level : requirement.weapon === "all" ? WEAPON_IDS.every((id) => masteryFor(id).level >= requirement.level) : masteryFor(requirement.weapon).level >= requirement.level;
      if (!ready) return (requirement.weapon === "any" ? "ANY" : requirement.weapon === "all" ? "ALL" : WEAPONS[requirement.weapon].masteryName) + " MASTERY " + roman(requirement.level);
    }
    const points = node.scope === "run" ? player.runSkillPoints : player.skillPoints;
    if (points < (node.cost || 1)) return "NEEDS " + (node.cost || 1) + " " + (node.scope === "run" ? "RUN " : "") + "POINTS";
    return "UPGRADE " + (rank + 1) + "/" + maxRank + " - " + (node.cost || 1) + " POINT" + ((node.cost || 1) > 1 ? "S" : "");
  }

  function buildSkillTree() {
    ui.skillBranches.innerHTML = skillTree.map((branch) => `
      <article class="skill-branch" data-branch="${branch.id}" data-scope="${branch.scope || "permanent"}">
        <header class="branch-head">
          <span class="branch-rune"><i>${branch.rune}</i></span>
          <div><small>${branch.kicker}</small><h3>${branch.title}</h3><p>${branch.copy}</p></div>
        </header>
        <div class="skill-nodes">
          ${branch.nodes.map((node) => `
            <button class="skill-node" type="button" data-skill="${node.id}">
              <span class="node-rank">${node.rankLabel}<b></b></span>
              <span class="node-copy"><strong>${node.name}</strong><span>${node.description}</span></span>
              <span class="node-status"></span>
            </button>`).join("")}
        </div>
      </article>`).join("");
    ui.skillBranches.querySelectorAll("[data-skill]").forEach((button) => {
      button.addEventListener("click", () => purchaseSkill(button.dataset.skill));
    });
  }

  function purchaseSkill(id) {
    const node = skillById.get(id);
    if (!canPurchaseSkill(node)) return;
    const oldMaxHealth = maxHealth();
    const oldMaxStamina = maxStamina();
    const source = node.scope === "run" ? player.runSkills : player.skills;
    source[id] = skillRank(id) + 1;
    if (node.scope === "run") player.runSkillPoints -= node.cost || 1;
    else player.skillPoints -= node.cost || 1;
    player.health = Math.min(maxHealth(), player.health + maxHealth() - oldMaxHealth);
    player.stamina = Math.min(maxStamina(), player.stamina + maxStamina() - oldMaxStamina);
    if (["vitality", "bastion", "run_vigor"].includes(id) && maxHealth() > oldMaxHealth) {
      registerNetworkMaxHealthUpgrade(id, 1, maxHealth() - oldMaxHealth);
    }
    saveProgression();
    markRunDirty();
    updateProgressionUI();
    showProgressionBanner("SKILL AWAKENED", node.name, node.description);
  }

  function updateProgressionUI() {
    const levelTarget = levelXpTarget(player.level);
    const levelPercent = clamp(player.xp / levelTarget * 100, 0, 100);
    const mastery = masteryFor();
    const weapon = WEAPONS[player.activeWeapon];
    const weaponMaxed = mastery.level >= MAX_WEAPON_LEVEL;
    const weaponTarget = weaponMaxed ? 1 : weaponXpTarget(mastery.level);
    const weaponPercent = weaponMaxed ? 100 : clamp(mastery.xp / weaponTarget * 100, 0, 100);
    ui.playerLevel.textContent = "LV. " + player.level;
    ui.levelXpBar.style.width = levelPercent + "%";
    ui.levelXpText.textContent = player.xp + " / " + levelTarget;
    ui.weaponHudName.textContent = weapon.name;
    ui.treeWeaponName.textContent = weapon.name;
    ui.weaponLevel.textContent = roman(mastery.level);
    ui.weaponXpBar.style.width = weaponPercent + "%";
    ui.weaponXpText.textContent = weaponMaxed ? "MASTERED" : mastery.xp + " / " + weaponTarget;
    ui.treePlayerLevel.textContent = player.level;
    ui.treeLevelXpBar.style.width = levelPercent + "%";
    ui.treeLevelXpText.textContent = player.xp + " / " + levelTarget + " XP";
    ui.treeWeaponLevel.textContent = roman(mastery.level);
    ui.treeWeaponXpBar.style.width = weaponPercent + "%";
    ui.treeWeaponXpText.textContent = weaponMaxed ? "MASTERED" : mastery.xp + " / " + weaponTarget + " MASTERY";
    const runTarget = runXpTarget(player.runLevel);
    const runPercent = player.runLevel >= 25 ? 100 : clamp(player.runXp / runTarget * 100, 0, 100);
    ui.treeRunLevel.textContent = player.runLevel;
    ui.treeRunXpBar.style.width = runPercent + "%";
    ui.treeRunXpText.textContent = player.runLevel >= 25 ? "MAX RUN ATTUNEMENT" : player.runXp + " / " + runTarget + " RUN XP";
    if (ui.weaponRack) ui.weaponRack.querySelectorAll("[data-weapon]").forEach((button) => button.classList.toggle("active", button.dataset.weapon === player.activeWeapon));
    if (ui.mobileWeapon) ui.mobileWeapon.querySelector("span").textContent = String(WEAPON_IDS.indexOf(player.activeWeapon) + 1);
    ui.treeSkillPoints.textContent = player.skillPoints + " + " + player.runSkillPoints;
    ui.skillPointBadge.textContent = player.skillPoints + player.runSkillPoints;
    if (ui.mobileSkillPointBadge) ui.mobileSkillPointBadge.textContent = player.skillPoints + player.runSkillPoints;
    ui.skillsButton.classList.toggle("no-points", player.skillPoints + player.runSkillPoints < 1);
    if (ui.mobileSkills) ui.mobileSkills.classList.toggle("no-points", player.skillPoints + player.runSkillPoints < 1);
    if (ui.skillBranches.children.length) {
      ui.skillBranches.querySelectorAll("[data-skill]").forEach((button) => {
        const node = skillById.get(button.dataset.skill);
        const rank = skillRank(node.id);
        button.classList.toggle("purchased", rank > 0);
        button.classList.toggle("mastered", rank >= (node.maxRank || 1));
        button.classList.toggle("available", canPurchaseSkill(node));
        button.classList.toggle("locked", rank <= 0 && !canPurchaseSkill(node));
        button.querySelector(".node-rank b").textContent = rank + "/" + (node.maxRank || 1);
        button.querySelector(".node-status").textContent = skillStatus(node);
        button.disabled = !canPurchaseSkill(node);
      });
    }
  }

  function openSkillTree() {
    if (state !== "playing") return;
    state = "skills";
    game.dataset.state = state;
    updateProgressionUI();
    ui.skills.classList.add("active");
    ui.closeSkills.focus({ preventScroll: true });
    if (document.pointerLockElement) {
      suppressPointerPause = true;
      document.exitPointerLock();
      window.setTimeout(() => { suppressPointerPause = false; }, 150);
    }
  }

  function closeSkillTree() {
    if (state !== "skills") return;
    state = "playing";
    game.dataset.state = state;
    ui.skills.classList.remove("active");
    lastTime = performance.now();
    if (!isCoarse && !testMode && !adminMode) showMessage("CLICK THE REALM TO RECAPTURE THE MOUSE", "#9fcbd4");
  }

  function clearProgressionData() {
    player.level = 1;
    player.xp = 0;
    player.skillPoints = 0;
    player.prestige = 0;
    player.realmDepth = 0;
    player.runLevel = 1;
    player.runXp = 0;
    player.runSkillPoints = 0;
    player.runSkills = {};
    player.activeWeapon = "blade";
    player.mastery = freshMastery();
    player.skills = {};
    player.relicBonuses = freshRelicBonuses();
    equipWeapon("blade", true);
    player.health = maxHealth();
    player.stamina = maxStamina();
    saveProgression(true);
    clearActiveRun();
    updateProgressionUI();
  }

  function resetProgression() {
    if (!window.confirm("Reset all Warden levels, weapon mastery, and purchased skills?")) return;
    clearProgressionData();
  }

  class AudioEngine {
    constructor() { this.context = null; this.muted = false; this.wind = null; this.windGain = null; }
    init() {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.context = new AudioContext();
      }
      if (this.context && this.context.state === "suspended") this.context.resume();
      if (this.context && !this.wind) this.startAmbient();
    }
    startAmbient() {
      const seconds = 3;
      const buffer = this.context.createBuffer(1, this.context.sampleRate * seconds, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      let previous = 0;
      for (let index = 0; index < data.length; index += 1) {
        const white = Math.random() * 2 - 1;
        previous = previous * .985 + white * .015;
        data[index] = previous * .8 + white * .06;
      }
      const source = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = "bandpass";
      filter.frequency.value = realm.biome === "desert" ? 520 : realm.biome === "shore" ? 340 : 240;
      filter.Q.value = .42;
      gain.gain.value = this.muted ? 0 : .018;
      source.connect(filter).connect(gain).connect(this.context.destination);
      source.start();
      this.wind = source;
      this.windGain = gain;
    }
    setMuted(value) {
      this.muted = Boolean(value);
      if (this.windGain && this.context) this.windGain.gain.setTargetAtTime(this.muted ? 0 : .018, this.context.currentTime, .04);
    }
    tone(start, end, duration, type, volume, delayTime) {
      if (this.muted || !this.context) return;
      const now = this.context.currentTime + (delayTime || 0);
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type || "sine";
      oscillator.frequency.setValueAtTime(Math.max(1, start), now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), now + duration);
      gain.gain.setValueAtTime(volume || .025, now);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + .03);
    }
    noise(duration, volume) {
      if (this.muted || !this.context) return;
      const size = Math.floor(this.context.sampleRate * duration);
      const buffer = this.context.createBuffer(1, size, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < size; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain).connect(this.context.destination);
      source.start();
    }
    swing() { this.noise(.12, .025); this.tone(410, 130, .16, "sawtooth", .023); }
    hit() { this.tone(150, 48, .18, "square", .035); }
    hurt() { this.noise(.22, .05); this.tone(78, 39, .34, "sawtooth", .045); }
    dragon() { this.noise(.55, .035); this.tone(74, 31, .72, "sawtooth", .055); }
    fire() { this.tone(190, 72, .28, "sawtooth", .025); }
    discover() { this.tone(220, 440, .45, "triangle", .03); this.tone(330, 660, .45, "sine", .02, .12); }
    shoutSound() { this.noise(.65, .065); this.tone(58, 30, .9, "sawtooth", .075); this.tone(180, 620, .8, "sine", .028, .05); }
    victory() { [220, 277, 330, 440].forEach((f, i) => this.tone(f, f * 1.01, .6, "triangle", .03, i * .14)); }
  }
  const audio = new AudioEngine();

  function updateLoading(percent, text) {
    ui.loadingBar.style.width = percent + "%";
    ui.loadingText.textContent = text;
  }

  function textureFrom(path) {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(path, resolve, undefined, reject);
    });
  }

  function configureTexture(texture, repeatX, repeatY) {
    if (!texture) return null;
    texture.encoding = THREE.sRGBEncoding;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX || 1, repeatY || 1);
    texture.anisotropy = Math.min(isCoarse ? 4 : 16, renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    return texture;
  }

  function configureDataTexture(texture, repeatX, repeatY) {
    if (!texture) return null;
    texture.encoding = THREE.LinearEncoding;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX || 1, repeatY || 1);
    texture.anisotropy = Math.min(isCoarse ? 4 : 12, renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    return texture;
  }

  function cloneTiledTexture(source, repeatX, repeatY) {
    if (!source) return null;
    const texture = source.clone();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.needsUpdate = true;
    return texture;
  }

  async function loadVisualAssets() {
    const biomeMaterialEntries = BIOME_IDS.map((id) => {
      const curated = id !== "snowy";
      return {
        id,
        base: curated ? "assets/textures/freestylized-biomes/" + id : "assets/textures/biomes/" + BIOMES[id].textureId,
        extension: curated ? ".webp" : ".jpg",
        source: curated ? "freestylized" : "ambientcg"
      };
    });
    visualAssets.biomeMaterialCatalog = biomeMaterialEntries.reduce((catalog, entry) => { catalog[entry.id] = entry; return catalog; }, {});
    visualAssets.biomeMaterialSource = "six-biome-authored";
    const paths = [
      "assets/textures/storm-sky-panorama.jpg",
      "assets/textures/ashen-ground.jpg",
      "assets/textures/ancient-stone.jpg",
      "assets/textures/alpine-cliff.jpg",
      "assets/textures/tundra-grass-v1.jpg"
    ].concat((() => {
      const entry = visualAssets.biomeMaterialCatalog[currentBiomeId];
      return [entry.base + "-color" + entry.extension, entry.base + "-normal" + entry.extension, entry.base + "-roughness" + entry.extension];
    })());
    const desertSkyboxIndex = paths.length;
    paths.push(DESERT_SKYBOX_PATH);
    const moonSkyboxIndex = paths.length;
    paths.push(MOON_SKYBOX_PATH);
    const shoreSkyboxIndex = paths.length;
    paths.push(SHORE_SKYBOX_PATH);
    const snowySkyboxIndex = paths.length;
    paths.push(SNOWY_SKYBOX_PATH);
    const mountainSkyboxIndex = paths.length;
    paths.push(MOUNTAIN_SKYBOX_PATH);
    const loaded = await Promise.allSettled(paths.map(textureFrom));
    if (loaded[0].status === "fulfilled") {
      visualAssets.sky = loaded[0].value;
      visualAssets.sky.encoding = THREE.sRGBEncoding;
      visualAssets.sky.wrapS = THREE.ClampToEdgeWrapping;
      visualAssets.sky.wrapT = THREE.ClampToEdgeWrapping;
      visualAssets.sky.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    }
    if (loaded[1].status === "fulfilled") visualAssets.ground = configureTexture(loaded[1].value, 42, 42);
    if (loaded[2].status === "fulfilled") visualAssets.stone = configureTexture(loaded[2].value, 3, 3);
    if (loaded[3].status === "fulfilled") visualAssets.cliff = configureTexture(loaded[3].value, 18, 18);
    if (loaded[4].status === "fulfilled") visualAssets.grass = configureTexture(loaded[4].value, 54, 54);
    visualAssets.biomeMaterials = {};
    const startingEntry = visualAssets.biomeMaterialCatalog[currentBiomeId];
    const startingRegionalMaterial = { source: startingEntry.source };
    if (loaded[5].status === "fulfilled") startingRegionalMaterial.color = configureTexture(loaded[5].value, 64, 64);
    if (loaded[6].status === "fulfilled") startingRegionalMaterial.normal = configureDataTexture(loaded[6].value, 64, 64);
    if (loaded[7].status === "fulfilled") startingRegionalMaterial.roughness = configureDataTexture(loaded[7].value, 64, 64);
    if (loaded[desertSkyboxIndex].status === "fulfilled") {
      visualAssets.desertSky = loaded[desertSkyboxIndex].value;
      visualAssets.desertSky.encoding = THREE.sRGBEncoding;
      visualAssets.desertSky.wrapS = THREE.ClampToEdgeWrapping;
      visualAssets.desertSky.wrapT = THREE.ClampToEdgeWrapping;
      visualAssets.desertSky.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    }
    if (loaded[moonSkyboxIndex].status === "fulfilled") {
      visualAssets.moonSky = loaded[moonSkyboxIndex].value;
      visualAssets.moonSky.encoding = THREE.sRGBEncoding;
      visualAssets.moonSky.wrapS = THREE.ClampToEdgeWrapping;
      visualAssets.moonSky.wrapT = THREE.ClampToEdgeWrapping;
      visualAssets.moonSky.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    }
    if (loaded[shoreSkyboxIndex].status === "fulfilled") {
      visualAssets.shoreSky = loaded[shoreSkyboxIndex].value;
      visualAssets.shoreSky.encoding = THREE.sRGBEncoding;
      visualAssets.shoreSky.wrapS = THREE.ClampToEdgeWrapping;
      visualAssets.shoreSky.wrapT = THREE.ClampToEdgeWrapping;
      visualAssets.shoreSky.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    }
    if (loaded[snowySkyboxIndex].status === "fulfilled") {
      visualAssets.snowySky = loaded[snowySkyboxIndex].value;
      visualAssets.snowySky.encoding = THREE.sRGBEncoding;
      visualAssets.snowySky.wrapS = THREE.ClampToEdgeWrapping;
      visualAssets.snowySky.wrapT = THREE.ClampToEdgeWrapping;
      visualAssets.snowySky.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    }
    if (loaded[mountainSkyboxIndex].status === "fulfilled") {
      visualAssets.mountainSky = loaded[mountainSkyboxIndex].value;
      visualAssets.mountainSky.encoding = THREE.sRGBEncoding;
      visualAssets.mountainSky.wrapS = THREE.ClampToEdgeWrapping;
      visualAssets.mountainSky.wrapT = THREE.ClampToEdgeWrapping;
      visualAssets.mountainSky.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    }
    visualAssets.biomeMaterials[currentBiomeId] = startingRegionalMaterial;
    const startingMaterial = visualAssets.biomeMaterials[currentBiomeId] || visualAssets.biomeMaterials.jungle || {};
    visualAssets.biomeGround = startingMaterial.color || null;
    visualAssets.biomeNormal = startingMaterial.normal || null;
    visualAssets.biomeRoughness = startingMaterial.roughness || null;
    loaded.forEach((result, index) => {
      if (result.status === "rejected") console.warn("Texture failed to load:", paths[index], result.reason);
    });
    stoneMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(biome.stoneTint || biome.cliff).lerp(new THREE.Color(0xf3f1eb), .72), map: visualAssets.stone || null, bumpMap: visualAssets.stone || null,
      bumpScale: .18, roughness: .9, metalness: .025, envMapIntensity: .42
    });
    darkStoneMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(biome.cliff).lerp(new THREE.Color(0xc8cbc4), .58), map: visualAssets.stone || null, bumpMap: visualAssets.stone || null,
      bumpScale: .22, roughness: .95, metalness: .01, envMapIntensity: .32
    });
    worldWoodMaterial = new THREE.MeshStandardMaterial({
      color: realm.biome === "desert" ? 0x4c3322 : 0x332b27, map: visualAssets.ground || null, bumpMap: visualAssets.ground || null,
      bumpScale: .18, roughness: .94, metalness: .015, envMapIntensity: .18
    });
    worldIronMaterial = new THREE.MeshStandardMaterial({
      color: 0x30383b, roughness: .61, metalness: .68, envMapIntensity: .38
    });
    worldFoliageMaterial = new THREE.MeshStandardMaterial({
      color: realm.biome === "snowy" || realm.biome === "mountains" ? biome.frost : biome.grass,
      roughness: .96, metalness: .01, envMapIntensity: .2
    });
  }

  async function loadBiomeVisualAssets(biomeId) {
    const existing = visualAssets.biomeMaterials && visualAssets.biomeMaterials[biomeId];
    if (existing && existing.color && existing.normal && existing.roughness) return existing;
    const entry = visualAssets.biomeMaterialCatalog && visualAssets.biomeMaterialCatalog[biomeId];
    if (!entry) return null;
    visualAssets.biomeMaterials[biomeId] = existing || { source: entry.source };
    const loaded = await Promise.allSettled([
      textureFrom(entry.base + "-color" + entry.extension),
      textureFrom(entry.base + "-normal" + entry.extension),
      textureFrom(entry.base + "-roughness" + entry.extension)
    ]);
    const material = visualAssets.biomeMaterials[biomeId];
    if (loaded[0].status === "fulfilled") material.color = configureTexture(loaded[0].value, 64, 64);
    if (loaded[1].status === "fulfilled") material.normal = configureDataTexture(loaded[1].value, 64, 64);
    if (loaded[2].status === "fulfilled") material.roughness = configureDataTexture(loaded[2].value, 64, 64);
    loaded.forEach((result, index) => {
      if (result.status === "rejected") console.warn("Regional texture failed to load:", biomeId, ["color", "normal", "roughness"][index], result.reason);
    });
    const shader = terrain && terrain.material && terrain.material.userData.terrainShader;
    if (shader && material.color && shader.uniforms["terrainMap_" + biomeId]) shader.uniforms["terrainMap_" + biomeId].value = material.color;
    return material;
  }

  function measureLoadedModelRegistry() {
    modelScaleRegistry = {};
    const assets = visualAssets.models || {};
    Object.keys(assets).forEach((id) => {
      const sceneRoot = assets[id] && assets[id].scene;
      if (!sceneRoot) return;
      sceneRoot.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(sceneRoot);
      const sx = Math.max(.01, box.max.x - box.min.x);
      const sy = Math.max(.01, box.max.y - box.min.y);
      const sz = Math.max(.01, box.max.z - box.min.z);
      const target = MODEL_SCALE_TARGETS[id] || null;
      const canonicalScale = target
        ? target.targetSpan ? target.targetSpan / Math.max(sx, sz) : target.targetHeight / sy
        : 1;
      const canonicalScaleY = target && target.targetHeight ? target.targetHeight / sy : canonicalScale;
      modelScaleRegistry[id] = {
        id, role: target ? target.role : "prop", sx, sy, sz,
        minX: box.min.x, minY: box.min.y, minZ: box.min.z,
        maxX: box.max.x, maxY: box.max.y, maxZ: box.max.z,
        canonicalScale, canonicalScaleY,
        targetHeight: target && target.targetHeight || null,
        targetSpan: target && target.targetSpan || null,
        worldWidth: sx * canonicalScale, worldHeight: sy * canonicalScaleY, worldDepth: sz * canonicalScale
      };
    });
  }

  function canonicalModelScale(id, multiplier) {
    const metric = modelScaleRegistry[id];
    return (metric ? metric.canonicalScale : 1) * (multiplier == null ? 1 : multiplier);
  }

  function modelVerticalScale(id, horizontalScale) {
    const metric = modelScaleRegistry[id];
    if (!metric || !metric.canonicalScale) return horizontalScale;
    return horizontalScale * metric.canonicalScaleY / metric.canonicalScale;
  }

  function scaledModelCollider(id, scale, heightLimit) {
    const metric = modelScaleRegistry[id];
    if (!metric) return null;
    const verticalScale = modelVerticalScale(id, scale);
    return {
      hx: metric.sx * scale * .46, hz: metric.sz * scale * .46,
      minY: 0, maxY: Math.min(metric.sy * verticalScale, heightLimit == null ? Infinity : heightLimit)
    };
  }

  async function loadModelAssets() {
    visualAssets.models = {};
    if (!THREE.GLTFLoader) {
      console.warn("GLTFLoader unavailable; using procedural world models.");
      return;
    }
    const modelPaths = {
      bridge: "assets/models/kenney-castle/bridge-straight.glb",
      bridgePillar: "assets/models/kenney-castle/bridge-straight-pillar.glb",
      gate: "assets/models/kenney-castle/gate.glb",
      stairs: "assets/models/kenney-castle/stairs-stone.glb",
      tower: "assets/models/kenney-castle/tower-square.glb",
      towerTop: "assets/models/kenney-castle/tower-top.glb",
      wall: "assets/models/kenney-castle/wall.glb",
      wallCorner: "assets/models/kenney-castle/wall-corner.glb",
      doorway: "assets/models/kenney-castle/wall-doorway.glb",
      catapult: "assets/models/kenney-castle/siege-catapult.glb",
      siegeTower: "assets/models/kenney-castle/siege-tower.glb",
      tree: "assets/models/kenney-castle/tree-large.glb",
      rock: "assets/models/kenney-castle/rocks-large.glb",
      warg: "assets/models/creatures/frost-warg.glb",
      warden: WARDEN_MODEL_PATH
    };
    BIOME_IDS.forEach((id) => {
      modelPaths["biomeLight_" + id] = "assets/models/quaternius-monsters/" + WORLD_PROFILES[id].lightEnemy[0] + ".gltf";
      modelPaths["biomeHeavy_" + id] = "assets/models/quaternius-monsters/" + WORLD_PROFILES[id].heavyEnemy[0] + ".gltf";
    });
    const medieval = "assets/models/kaykit-medieval/";
    const town = "assets/models/kenney-town/";
    const nature = "assets/models/kenney-nature/";
    const dungeon = "assets/models/kaykit-dungeon/";
    Object.assign(modelPaths, {
      tavern: medieval + "building_tavern_yellow.gltf",
      market: medieval + "building_market_yellow.gltf",
      blacksmith: medieval + "building_blacksmith_yellow.gltf",
      homeA: medieval + "building_home_A_yellow.gltf",
      homeB: medieval + "building_home_B_yellow.gltf",
      windmill: medieval + "building_windmill_yellow.gltf",
      well: medieval + "building_well_yellow.gltf",
      towerA: medieval + "building_tower_A_yellow.gltf",
      towerB: medieval + "building_tower_B_yellow.gltf",
      church: medieval + "building_church_yellow.gltf",
      ruinedHouse: medieval + "building_destroyed.gltf",
      barrel: medieval + "barrel.gltf",
      crateBig: medieval + "crate_A_big.gltf",
      crateOpen: medieval + "crate_open.gltf",
      sack: medieval + "sack.gltf",
      tent: medieval + "tent.gltf",
      weaponrack: medieval + "weaponrack.gltf",
      flagRed: medieval + "flag_red.gltf",
      stall: town + "stall.glb",
      stallGreen: town + "stall-green.glb",
      stallBench: town + "stall-bench.glb",
      fountainRound: town + "fountain-round.glb",
      fountainCenter: town + "fountain-center.glb",
      bannerRed: town + "banner-red.glb",
      bannerGreen: town + "banner-green.glb",
      cart: town + "cart.glb",
      statueColumnDamaged: nature + "statue_columnDamaged.glb",
      statueHead: nature + "statue_head.glb",
      statueObelisk: nature + "statue_obelisk.glb",
      statueColumn: nature + "statue_column.glb",
      campfireStones: nature + "campfire_stones.glb",
      tentDetailed: nature + "tent_detailedOpen.glb",
      treePalm: nature + "tree_palm.glb",
      treePalmBend: nature + "tree_palmBend.glb",
      treePineA: nature + "tree_pineDefaultA.glb",
      treePineB: nature + "tree_pineDefaultB.glb",
      cactusShort: nature + "cactus_short.glb",
      cactusTall: nature + "cactus_tall.glb",
      dngWallBroken: dungeon + "wall_broken.glb",
      dngWallCracked: dungeon + "wall_cracked.glb",
      dngWallArched: dungeon + "wall_arched.glb",
      dngWallArchedWindow: dungeon + "wall_archedwindow_open.glb",
      dngWallGated: dungeon + "wall_gated.glb",
      dngColumn: dungeon + "column.glb"
    });
    // The detailed foliage pack is reserved for a bounded set of old-growth hero
    // trees. The instanced procedural forest remains the scalable fallback.
    Object.assign(modelPaths, {
      ancientTreeA: "assets/models/freestylized-foliage/F1_Tree1.glb",
      ancientTreeB: "assets/models/freestylized-foliage/F1_Tree3.glb",
      treeLod0: "assets/models/tree-lods/tree_LOD0.gltf",
      treeLod1: "assets/models/tree-lods/tree_LOD1.gltf",
      treeLod2: "assets/models/tree-lods/tree_LOD2.gltf"
    });
    const graveyard = "assets/models/kenney-graveyard/";
    Object.assign(modelPaths, {
      crypt: graveyard + "crypt.glb",
      cryptSmall: graveyard + "crypt-small.glb",
      cryptA: graveyard + "crypt-a.glb",
      gravestoneBevel: graveyard + "gravestone-bevel.glb",
      gravestoneBroken: graveyard + "gravestone-broken.glb",
      gravestoneCross: graveyard + "gravestone-cross.glb",
      gravestoneDecorative: graveyard + "gravestone-decorative.glb",
      grave: graveyard + "grave.glb",
      fence: graveyard + "fence.glb",
      fenceGate: graveyard + "fence-gate.glb",
      fenceDamaged: graveyard + "fence-damaged.glb",
      altarStone: graveyard + "altar-stone.glb",
      pineCrooked: graveyard + "pine-crooked.glb",
      lightpost: graveyard + "lightpost-single.glb"
    });
    visualAssets.modelPaths = Object.assign({}, modelPaths);
    const loader = new THREE.GLTFLoader();
    visualAssets.modelLoader = loader;
    const entries = Object.entries(modelPaths).filter(([id]) => !/^biome(?:Light|Heavy)_/.test(id) || id.endsWith("_" + currentBiomeId));
    const loaded = await Promise.allSettled(entries.map((entry) => loader.loadAsync(entry[1])));
    loaded.forEach((result, index) => {
      const id = entries[index][0];
      if (result.status === "fulfilled") visualAssets.models[id] = result.value;
      else console.warn("3D model failed to load:", entries[index][1], result.reason);
    });
    visualAssets.models.biomeLight = visualAssets.models.biomeLight_jungle || null;
    visualAssets.models.biomeHeavy = visualAssets.models.biomeHeavy_jungle || null;
    measureLoadedModelRegistry();
  }

  async function loadBiomeEnemyAssets(biomeId) {
    if (!visualAssets.models || !visualAssets.modelLoader || !WORLD_PROFILES[biomeId]) return null;
    const lightKey = "biomeLight_" + biomeId;
    const heavyKey = "biomeHeavy_" + biomeId;
    if (visualAssets.models[lightKey] && visualAssets.models[heavyKey]) return [visualAssets.models[lightKey], visualAssets.models[heavyKey]];
    const paths = visualAssets.modelPaths || {};
    const loaded = await Promise.allSettled([
      visualAssets.models[lightKey] ? Promise.resolve(visualAssets.models[lightKey]) : visualAssets.modelLoader.loadAsync(paths[lightKey]),
      visualAssets.models[heavyKey] ? Promise.resolve(visualAssets.models[heavyKey]) : visualAssets.modelLoader.loadAsync(paths[heavyKey])
    ]);
    if (loaded[0].status === "fulfilled") visualAssets.models[lightKey] = loaded[0].value;
    if (loaded[1].status === "fulfilled") visualAssets.models[heavyKey] = loaded[1].value;
    loaded.forEach((result, index) => {
      if (result.status === "rejected") console.warn("Regional enemy model failed to load:", biomeId, index ? "heavy" : "light", result.reason);
    });
    measureLoadedModelRegistry();
    hydrateRegionalEnemyModels(biomeId);
    return [visualAssets.models[lightKey] || null, visualAssets.models[heavyKey] || null];
  }

  const regionalAssetPromises = new Map();
  let regionalAssetPrefetchTimer = 0;
  function ensureBiomeAssets(biomeId) {
    if (!BIOMES[biomeId]) return Promise.resolve(null);
    if (!regionalAssetPromises.has(biomeId)) {
      regionalAssetPromises.set(biomeId, Promise.all([loadBiomeVisualAssets(biomeId), loadBiomeEnemyAssets(biomeId)]).catch((error) => {
        regionalAssetPromises.delete(biomeId);
        console.warn("Regional assets could not be streamed:", biomeId, error);
        return null;
      }));
    }
    return regionalAssetPromises.get(biomeId);
  }

  async function boot() {
    try {
      updateLoading(8, "Opening the northern sky...");
      if (ui.realmLabel) ui.realmLabel.textContent = "ONE WORLD · SIX CONNECTED BIOMES";
      if (ui.biomeTag) ui.biomeTag.textContent = BIOMES[currentBiomeId].name + " · ONE CONTINENT";
      loadProgression();
      buildSkillTree();
      await delay(35);
      initRenderer();
      updateLoading(17, "Weaving storm and stone...");
      await Promise.all([loadVisualAssets(), loadModelAssets()]);
      await preloadAdminOverrideModels();
      updateLoading(28, "Raising the mountains...");
      await delay(35);
      createSkyAndLights();
      createTerrain();
      updateLoading(51, "Carving the ruined kingdom...");
      await delay(35);
      createRoad();
      createRuins();
      createWilderness();
      createImportedWorld();
      createInfrastructure();
      createVerticalRoutes();
      createExperienceRunes();
      createSettlements();
      createChests();
      createBiomeProps();
      await loadAdminCustomModels();
      reapplyRegisteredEntityOverrides();
      createAtmosphere();
      updateLoading(73, "Arming the Warden...");
      await delay(35);
      createPlayer();
      player.root.position.set(TITLE_VANTAGE.x, terrainHeight(TITLE_VANTAGE.x, TITLE_VANTAGE.z), TITLE_VANTAGE.z);
      player.lastSafePosition.copy(player.root.position);
      resetActors();
      createLandmarks();
      if (window.AshenholdCoopRuntime) {
        updateLoading(88, "Charting shared paths...");
        buildNetworkNavigation();
      }
      updateProgressionUI();
      updateLoading(94, "Waking the dragon flight...");
      resize();
      updateCamera(1, true);
      await delay(120);
      if (ui.titleRealmName) ui.titleRealmName.textContent = "ASHENHOLD CONTINENT";
      if (ui.titleStrongholds) ui.titleStrongholds.textContent = String(strongholds.length);
      if (ui.titleWardenLevel) ui.titleWardenLevel.textContent = String(player.level);
      state = "title";
      game.dataset.state = state;
      if (pendingRunState && ui.enter) ui.enter.querySelector("span").textContent = "CONTINUE SAVED RUN";
      ui.loading.classList.remove("active");
      ui.title.classList.add("active");
      if (adminMode) {
        startGame(false);
        adminControls.simulationPaused = true;
        setAdminMode("freecam");
        initializeAdminMode();
      } else ui.enter.focus({ preventScroll: true });
      updateLoading(100, "Ashenhold Continent ready");
      multiplayerBootReady = true;
      initializeMultiplayerAdapter();
      requestAnimationFrame(loop);
    } catch (error) {
      console.error(error);
      ui.loading.classList.remove("active");
      ui.webglError.classList.add("active");
    }
  }

  function initRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: !isCoarse, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarse ? 1.2 : 1.85));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = biome.exposure;
    renderer.shadowMap.enabled = !isCoarse;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.tabIndex = 0;
    viewport.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(biome.fog, biome.fogDensity * (isCoarse ? 1.1 : 1));
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, .1, 1500);
  }

  function createBiomeSkyTexture(biomeId) {
    const skyBiomeId = BIOMES[biomeId] ? biomeId : "jungle";
    const skyBiome = BIOMES[skyBiomeId];
    const profile = SKY_PROFILES[skyBiomeId] || SKY_PROFILES.jungle;
    if (skyBiomeId === "desert" && visualAssets.desertSky) {
      const suppliedTexture = visualAssets.desertSky.clone();
      suppliedTexture.encoding = THREE.sRGBEncoding;
      suppliedTexture.wrapS = THREE.ClampToEdgeWrapping;
      suppliedTexture.wrapT = THREE.ClampToEdgeWrapping;
      suppliedTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      suppliedTexture.needsUpdate = true;
      suppliedTexture.userData = suppliedTexture.userData || {};
      suppliedTexture.userData.skyReport = {
        id: profile.id, features: profile.features.slice(), featureCount: 1,
        signature: profile.id + ":sandskybox-2k-v1", gradientStops: 0, horizonBlend: true,
        projection: "equirectangular", source: DESERT_SKYBOX_PATH
      };
      return suppliedTexture;
    }
    if (skyBiomeId === "moon" && visualAssets.moonSky) {
      const suppliedTexture = visualAssets.moonSky.clone();
      suppliedTexture.encoding = THREE.sRGBEncoding;
      suppliedTexture.wrapS = THREE.ClampToEdgeWrapping;
      suppliedTexture.wrapT = THREE.ClampToEdgeWrapping;
      suppliedTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      suppliedTexture.needsUpdate = true;
      suppliedTexture.userData = suppliedTexture.userData || {};
      suppliedTexture.userData.skyReport = {
        id: profile.id, features: profile.features.slice(), featureCount: 1,
        signature: profile.id + ":moonskybox-2k-v1", gradientStops: 0, horizonBlend: true,
        projection: "equirectangular", source: MOON_SKYBOX_PATH
      };
      return suppliedTexture;
    }
    if (skyBiomeId === "shore" && visualAssets.shoreSky) {
      const suppliedTexture = visualAssets.shoreSky.clone();
      suppliedTexture.encoding = THREE.sRGBEncoding;
      suppliedTexture.wrapS = THREE.ClampToEdgeWrapping;
      suppliedTexture.wrapT = THREE.ClampToEdgeWrapping;
      suppliedTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      suppliedTexture.needsUpdate = true;
      suppliedTexture.userData = suppliedTexture.userData || {};
      suppliedTexture.userData.skyReport = {
        id: profile.id, features: profile.features.slice(), featureCount: 1,
        signature: profile.id + ":coastskybox-2k-v1", gradientStops: 0, horizonBlend: true,
        projection: "equirectangular", source: SHORE_SKYBOX_PATH
      };
      return suppliedTexture;
    }
    if (skyBiomeId === "snowy" && visualAssets.snowySky) {
      const suppliedTexture = visualAssets.snowySky.clone();
      suppliedTexture.encoding = THREE.sRGBEncoding;
      suppliedTexture.wrapS = THREE.ClampToEdgeWrapping;
      suppliedTexture.wrapT = THREE.ClampToEdgeWrapping;
      suppliedTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      suppliedTexture.needsUpdate = true;
      suppliedTexture.userData = suppliedTexture.userData || {};
      suppliedTexture.userData.skyReport = {
        id: profile.id, features: profile.features.slice(), featureCount: 1,
        signature: profile.id + ":snowline-2k-v1", gradientStops: 0, horizonBlend: true,
        projection: "equirectangular", source: SNOWY_SKYBOX_PATH
      };
      return suppliedTexture;
    }
    if (skyBiomeId === "mountains" && visualAssets.mountainSky) {
      const suppliedTexture = visualAssets.mountainSky.clone();
      suppliedTexture.encoding = THREE.sRGBEncoding;
      suppliedTexture.wrapS = THREE.ClampToEdgeWrapping;
      suppliedTexture.wrapT = THREE.ClampToEdgeWrapping;
      suppliedTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      suppliedTexture.needsUpdate = true;
      suppliedTexture.userData = suppliedTexture.userData || {};
      suppliedTexture.userData.skyReport = {
        id: profile.id, features: profile.features.slice(), featureCount: 1,
        signature: profile.id + ":graveyard-skybox-v1", gradientStops: 0, horizonBlend: true,
        projection: "equirectangular", source: MOUNTAIN_SKYBOX_PATH
      };
      return suppliedTexture;
    }
    const surface = document.createElement("canvas");
    surface.width = 1024;
    surface.height = 512;
    const context = surface.getContext("2d");
    if (!context) throw new Error("2d canvas unavailable for biome sky");
    const zenith = new THREE.Color(skyBiome.skyZenith || skyBiome.sky);
    const horizon = new THREE.Color(skyBiome.skyHorizon || skyBiome.sky);
    const upper = zenith.clone().lerp(horizon, .55);
    const lower = horizon.clone().multiplyScalar(.68);
    const nadir = horizon.clone().multiplyScalar(.38);
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#" + zenith.getHexString());
    gradient.addColorStop(.42, "#" + upper.getHexString());
    gradient.addColorStop(.5, "#" + horizon.getHexString());
    gradient.addColorStop(.58, "#" + lower.getHexString());
    gradient.addColorStop(1, "#" + nadir.getHexString());
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1024, 512);
    const glow = new THREE.Color(skyBiome.skyGlow || skyBiome.sun);
    const glowRgb = Math.round(glow.r * 255) + "," + Math.round(glow.g * 255) + "," + Math.round(glow.b * 255);
    const glowGradient = context.createRadialGradient(544, 219, 12, 544, 219, 320);
    glowGradient.addColorStop(0, "rgba(" + glowRgb + ",.72)");
    glowGradient.addColorStop(.28, "rgba(" + glowRgb + ",.26)");
    glowGradient.addColorStop(1, "rgba(" + glowRgb + ",0)");
    context.fillStyle = glowGradient;
    context.fillRect(0, 0, 1024, 512);
    const skySalt = 13100 + BIOME_IDS.indexOf(skyBiomeId) * 1000;
    let featureCount = 0;
    const ellipse = (x, y, rx, ry, color, alpha) => {
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.beginPath();
      context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
      featureCount += 1;
    };
    if (skyBiomeId === "jungle") {
      for (let index = 0; index < 28; index += 1) {
        ellipse(seeded(skySalt + index * 5) * 1100 - 38, 165 + seeded(skySalt + index * 5 + 1) * 135,
          42 + seeded(skySalt + index * 5 + 2) * 95, 9 + seeded(skySalt + index * 5 + 3) * 24, "#17392e", .12 + seeded(skySalt + index * 5 + 4) * .14);
      }
      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = .68;
      context.filter = "blur(22px)";
      for (let index = 0; index < 7; index += 1) {
        const x = 410 + index * 45 + seeded(skySalt + 300 + index) * 70;
        const shaft = context.createLinearGradient(x, 112, x + 80, 390);
        shaft.addColorStop(0, "rgba(238,215,135,.14)");
        shaft.addColorStop(.46, "rgba(238,215,135,.065)");
        shaft.addColorStop(1, "rgba(238,215,135,0)");
        context.fillStyle = shaft;
        context.beginPath();
        context.moveTo(x, 94);
        context.lineTo(x + 25, 94);
        context.quadraticCurveTo(x + 84, 255, x + 145, 420);
        context.lineTo(x + 68, 420);
        context.quadraticCurveTo(x + 43, 245, x, 94);
        context.closePath();
        context.fill();
        featureCount += 1;
      }
      context.restore();
    } else if (skyBiomeId === "shore") {
      for (let index = 0; index < 24; index += 1) {
        ellipse(seeded(skySalt + index * 7) * 1120 - 48, 100 + seeded(skySalt + index * 7 + 1) * 170,
          55 + seeded(skySalt + index * 7 + 2) * 120, 13 + seeded(skySalt + index * 7 + 3) * 32, index % 3 ? "#233c46" : "#72898e", .18 + seeded(skySalt + index * 7 + 4) * .22);
      }
      context.save();
      context.strokeStyle = "rgba(168,204,210,.15)";
      context.lineWidth = 3;
      for (let index = 0; index < 15; index += 1) {
        const x = 40 + seeded(skySalt + 500 + index * 3) * 950;
        context.beginPath(); context.moveTo(x, 205); context.lineTo(x - 75, 420); context.stroke();
        featureCount += 1;
      }
      context.restore();
    } else if (skyBiomeId === "desert") {
      for (let index = 0; index < 15; index += 1) {
        ellipse(seeded(skySalt + index * 7) * 1080 - 28, 250 + seeded(skySalt + index * 7 + 1) * 95,
          80 + seeded(skySalt + index * 7 + 2) * 150, 12 + seeded(skySalt + index * 7 + 3) * 25, index % 2 ? "#9d6c43" : "#d7a066", .09 + seeded(skySalt + index * 7 + 4) * .16);
      }
      const heat = context.createLinearGradient(0, 230, 0, 340);
      heat.addColorStop(0, "rgba(255,205,121,0)"); heat.addColorStop(.55, "rgba(255,190,101,.21)"); heat.addColorStop(1, "rgba(111,64,39,0)");
      context.fillStyle = heat; context.fillRect(0, 220, 1024, 140); featureCount += 1;
    } else if (skyBiomeId === "snowy") {
      context.save();
      context.globalCompositeOperation = "screen";
      context.lineCap = "round";
      for (let band = 0; band < 5; band += 1) {
        context.strokeStyle = band % 2 ? "rgba(102,226,195,.2)" : "rgba(126,155,255,.18)";
        context.lineWidth = 16 + band * 5;
        context.beginPath();
        context.moveTo(-40, 95 + band * 18);
        context.bezierCurveTo(230, 28 + band * 11, 470, 205 - band * 9, 760, 82 + band * 13);
        context.bezierCurveTo(870, 45 + band * 12, 960, 100 + band * 16, 1070, 64 + band * 10);
        context.stroke(); featureCount += 1;
      }
      context.restore();
      for (let index = 0; index < 16; index += 1) ellipse(seeded(skySalt + index * 5) * 1100 - 38, 190 + seeded(skySalt + index * 5 + 1) * 105, 46 + seeded(skySalt + index * 5 + 2) * 90, 10 + seeded(skySalt + index * 5 + 3) * 20, "#d5e0e3", .08 + seeded(skySalt + index * 5 + 4) * .12);
    } else if (skyBiomeId === "mountains") {
      for (let index = 0; index < 22; index += 1) ellipse(seeded(skySalt + index * 6) * 1120 - 48, 85 + seeded(skySalt + index * 6 + 1) * 170, 48 + seeded(skySalt + index * 6 + 2) * 115, 12 + seeded(skySalt + index * 6 + 3) * 30, index % 2 ? "#394b5a" : "#c5d0d4", .1 + seeded(skySalt + index * 6 + 4) * .18);
      context.save(); context.fillStyle = "rgba(32,42,51,.35)"; context.beginPath(); context.moveTo(0, 330);
      for (let x = 0; x <= 1024; x += 42) context.lineTo(x, 330 - seeded(skySalt + 700 + x) * 88);
      context.lineTo(1024, 390); context.lineTo(0, 390); context.closePath(); context.fill(); context.restore(); featureCount += 1;
    } else {
      context.save(); context.fillStyle = "rgba(221,231,255,.88)";
      for (let index = 0; index < 190; index += 1) {
        const radius = .45 + seeded(skySalt + index * 5 + 2) * 1.45;
        context.globalAlpha = .25 + seeded(skySalt + index * 5 + 3) * .7;
        context.beginPath(); context.arc(seeded(skySalt + index * 5) * 1024, seeded(skySalt + index * 5 + 1) * 330, radius, 0, Math.PI * 2); context.fill();
      }
      context.restore(); featureCount += 190;
      const nebula = context.createRadialGradient(220, 115, 8, 220, 115, 280);
      nebula.addColorStop(0, "rgba(142,102,210,.24)"); nebula.addColorStop(.5, "rgba(85,64,151,.11)"); nebula.addColorStop(1, "rgba(35,29,77,0)");
      context.fillStyle = nebula; context.fillRect(0, 0, 560, 390); featureCount += 1;
      ellipse(790, 112, 54, 54, "#bac7ff", .62); ellipse(807, 100, 51, 51, "#171a31", .94);
    }
    const generatedSkyReport = {
      id: profile.id, features: profile.features.slice(), featureCount,
      signature: profile.id + ":" + skyBiome.skyZenith.toString(16) + ":" + featureCount,
      gradientStops: 5, horizonBlend: true, projection: "generated-equirectangular", source: "procedural"
    };
    const texture = new THREE.CanvasTexture(surface);
    texture.encoding = THREE.sRGBEncoding;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    texture.userData = texture.userData || {};
    texture.userData.skyReport = generatedSkyReport;
    return texture;
  }

  function createSkyAndLights() {
    const skyGeometry = new THREE.SphereGeometry(880, isCoarse ? 32 : 48, isCoarse ? 18 : 28);
    let skyTexture = null;
    visualAssets.skyboxes = {};
    try {
      BIOME_IDS.forEach((id) => { visualAssets.skyboxes[id] = createBiomeSkyTexture(id); });
      skyTexture = visualAssets.skyboxes[currentBiomeId];
      skyReport = Object.assign({}, skyTexture.userData.skyReport);
    } catch (error) {
      console.warn("Biome sky gradient failed; falling back to storm panorama.", error);
      skyTexture = visualAssets.sky || null;
    }
    const skyMaterial = skyTexture
      ? new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false, depthWrite: false })
      : new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          topColor: { value: new THREE.Color(biome.sky).multiplyScalar(.2) },
          bottomColor: { value: new THREE.Color(biome.sky) },
          offset: { value: 28 },
          exponent: { value: .72 }
        },
        vertexShader: "varying vec3 vWorldPosition; void main(){ vec4 worldPosition=modelMatrix*vec4(position,1.0); vWorldPosition=worldPosition.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader: "uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main(){ float h=normalize(vWorldPosition+offset).y; gl_FragColor=vec4(mix(bottomColor,topColor,max(pow(max(h,0.0),exponent),0.0)),1.0); }"
      });
    skyMaterial.toneMapped = false;
    sky = new THREE.Mesh(skyGeometry, skyMaterial);
    sky.rotation.y = 1.12;
    sky.renderOrder = -100;
    scene.add(sky);
    if (skyTexture && renderer && scene && THREE.PMREMGenerator) {
      const generator = new THREE.PMREMGenerator(renderer);
      generator.compileEquirectangularShader();
      visualAssets.environment = generator.fromEquirectangular(skyTexture).texture;
      scene.environment = visualAssets.environment;
      generator.dispose();
    }

    const haloSurface = document.createElement("canvas");
    haloSurface.width = 256;
    haloSurface.height = 256;
    const haloContext = haloSurface.getContext("2d");
    const haloGradient = haloContext.createRadialGradient(128, 128, 2, 128, 128, 126);
    haloGradient.addColorStop(0, "rgba(255,235,190,.9)");
    haloGradient.addColorStop(.1, "rgba(255,184,105,.42)");
    haloGradient.addColorStop(.42, "rgba(224,117,58,.1)");
    haloGradient.addColorStop(1, "rgba(224,117,58,0)");
    haloContext.fillStyle = haloGradient;
    haloContext.fillRect(0, 0, 256, 256);
    const haloTexture = new THREE.CanvasTexture(haloSurface);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTexture, color: biome.skyGlow || biome.sun, transparent: true, opacity: realm.biome === "moon" ? .72 : .52,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
    }));
    const skyProfile = SKY_PROFILES[currentBiomeId] || SKY_PROFILES.jungle;
    halo.position.set(skyProfile.halo[0], skyProfile.halo[1], skyProfile.halo[2]);
    halo.scale.setScalar(skyProfile.haloScale);
    halo.renderOrder = -90;
    sky.add(halo);

    scene.add(new THREE.HemisphereLight(biome.hemi, realm.biome === "desert" ? 0x2b170d : 0x100d0c, realm.biome === "moon" ? .48 : .68));
    sun = new THREE.DirectionalLight(biome.sun, biome.sunIntensity);
    sun.position.set(-55, 95, 38);
    sun.castShadow = !isCoarse;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -85;
    sun.shadow.camera.right = 85;
    sun.shadow.camera.top = 85;
    sun.shadow.camera.bottom = -85;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 240;
    sun.shadow.bias = -.0003;
    sunTarget = new THREE.Object3D();
    scene.add(sunTarget);
    sun.target = sunTarget;
    scene.add(sun);

    const rim = new THREE.DirectionalLight(realm.biome === "desert" ? 0x9d5a3a : realm.biome === "jungle" ? 0x4d8870 : 0x4b879e, .78);
    rim.position.set(80, 35, -90);
    scene.add(rim);

    if (realm.biome === "moon") {
      const starCount = isCoarse ? 260 : 720;
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i += 1) {
        const theta = seeded(i * 13 + 4) * Math.PI * 2;
        const phi = Math.acos(lerp(-.05, 1, seeded(i * 17 + 9)));
        const radius = 790;
        starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
        starPositions[i * 3 + 1] = Math.cos(phi) * radius;
        starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
      }
      const starsGeometry = new THREE.BufferGeometry();
      starsGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
      scene.add(new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: 0xdce6ff, size: 1.35, transparent: true, opacity: .84, depthWrite: false, fog: false })));
    }
  }

  function updateActiveBiomePresentation(force) {
    if (!player.root) return currentBiomeId;
    const nextBiomeId = biomeIdAt(player.root.position.x, player.root.position.z);
    ensureBiomeAssets(nextBiomeId);
    if (!force && nextBiomeId === currentBiomeId) return currentBiomeId;
    const previousBiomeId = currentBiomeId;
    currentBiomeId = nextBiomeId;
    const activeBiome = BIOMES[currentBiomeId];
    game.dataset.biome = currentBiomeId;
    if (scene && scene.fog) {
      scene.fog.color.set(activeBiome.fog);
      scene.fog.density = activeBiome.fogDensity * (isCoarse ? 1.1 : 1);
    }
    if (sky && sky.material && visualAssets.skyboxes && visualAssets.skyboxes[currentBiomeId]) {
      sky.material.map = visualAssets.skyboxes[currentBiomeId];
      sky.material.needsUpdate = true;
      skyReport = Object.assign({}, visualAssets.skyboxes[currentBiomeId].userData.skyReport || skyReport);
    }
    if (sun) {
      sun.color.set(activeBiome.sun);
      sun.intensity = activeBiome.sunIntensity;
    }
    if (renderer) renderer.toneMappingExposure = activeBiome.exposure;
    if (ui.biomeTag) ui.biomeTag.textContent = activeBiome.name + " · ONE CONTINENT";
    if (ui.realmLabel) ui.realmLabel.textContent = activeBiome.name + " · ASHENHOLD CONTINENT";
    if (!force && previousBiomeId !== currentBiomeId && state === "playing") showLocation(activeBiome.name, "ENTERING BIOME");
    return currentBiomeId;
  }

  function biomeTerrainBase(biomeId, x, z) {
    const zone = CONTINENT_ZONE_BY_ID.get(biomeId);
    const definition = BIOMES[biomeId];
    const localX = x - zone.center.x;
    const localZ = z - zone.center.z;
    const phase = (BIOME_IDS.indexOf(biomeId) + 1) * 37.4;
    const waveA = Math.sin((localX + phase) * .018) * 2.8 + Math.cos((localZ - phase) * .015) * 2.4;
    const waveB = Math.sin((localX + localZ + phase) * .033) * 1.25 + Math.cos((localX - localZ - phase) * .041) * .8;
    let heightValue = definition.base;
    if (biomeId === "snowy") {
      heightValue += waveA * 1.1 + waveB * .7;
      heightValue += Math.pow(Math.abs(Math.sin(localX * .0075 + Math.cos(localZ * .004) * 1.8)), 2.4) * 11;
    } else if (biomeId === "jungle") {
      heightValue += waveA * .78 + waveB * .55;
      const riverCenter = Math.sin(localZ * .0105) * 34 + Math.sin(localZ * .0032) * 15;
      heightValue -= Math.exp(-Math.pow(localX - riverCenter, 2) / 620) * 6.8;
    } else if (biomeId === "desert") {
      heightValue += Math.sin(localX * .041 + Math.sin(localZ * .012)) * 3.7;
      heightValue += Math.sin((localX + localZ) * .022) * 2.2 + waveB * .38;
      const canyon = localX * .72 + localZ * .34 - Math.sin(localZ * .007) * 48;
      heightValue -= Math.exp(-(canyon * canyon) / 900) * 8;
    } else if (biomeId === "shore") {
      heightValue = definition.waterLevel - 1.8 + waveA * .62 + waveB * .38;
      const causeway = localX + Math.sin(localZ * .009) * 42;
      heightValue += Math.exp(-(causeway * causeway) / 980) * 7.2;
    } else if (biomeId === "mountains") {
      const ridgeA = Math.pow(Math.abs(Math.sin(localX * .0085 + localZ * .003)), 2.5);
      const ridgeB = Math.pow(Math.abs(Math.cos(localZ * .0072 - localX * .0024)), 3.1);
      heightValue += waveA * 1.18 + waveB * .76 + ridgeA * 19 + ridgeB * 13;
    } else {
      heightValue += waveA * .7 + waveB * .52;
      const craterDistance = Math.hypot(localX + 32, localZ - 45);
      heightValue += Math.exp(-Math.pow(craterDistance - 118, 2) / 620) * 8 - Math.exp(-(craterDistance * craterDistance) / 6200) * 7;
      heightValue += Math.pow(Math.abs(Math.sin((localX - localZ) * .011)), 3.2) * 7;
    }
    (terrainFeaturesByBiome.get(biomeId) || []).forEach((feature) => {
      const distanceSquared = Math.pow(x - feature.x, 2) + Math.pow(z - feature.z, 2);
      heightValue += Math.exp(-distanceSquared / Math.pow(feature.radius, 2)) * feature.height * (biomeId === "shore" ? .34 : biomeId === "mountains" ? .66 : .48);
    });
    return heightValue;
  }

  function rawTerrainHeight(x, z) {
    let heightValue = 0;
    biomeBlendWeights(x, z).forEach((entry) => { heightValue += biomeTerrainBase(entry.id, x, z) * entry.weight; });
    const squareEdge = Math.max(Math.abs(x), Math.abs(z));
    const edge = Math.max(0, (squareEdge - 790) / 95);
    heightValue += edge * edge * 46;
    if (Math.abs(x) < 120 && z > -190 && z < 280) {
      const roadDistance = x - roadCenterAt(z);
      heightValue -= Math.exp(-(roadDistance * roadDistance) / 760) * 2.6;
    }
    heightValue -= Math.exp(-(Math.pow(x - RUINS.x, 2) + Math.pow(z - RUINS.z, 2)) / 2400) * 2.2;
    return heightValue;
  }

  function foundationTarget(zone) {
    if (!foundationTargets.has(zone.id)) foundationTargets.set(zone.id, Math.max(rawTerrainHeight(zone.x, zone.z) + zone.lift, BIOMES[biomeIdAt(zone.x, zone.z)].waterLevel + 2.4));
    return foundationTargets.get(zone.id);
  }

  function terrainHeight(x, z) {
    let heightValue = rawTerrainHeight(x, z);
    foundationZones.forEach((zone) => {
      const distance = Math.hypot(x - zone.x, z - zone.z);
      if (distance >= zone.outer) return;
      const weight = 1 - smoothstep(zone.inner, zone.outer, distance);
      heightValue = lerp(heightValue, foundationTarget(zone), weight);
    });
    return heightValue;
  }

  // Adapted from Christian Ortiz's MIT-licensed WaterFloor at the pinned source
  // above. Ashenhold keeps the texture-free Voronoi F1/smooth-F1 cel pattern and
  // world-space ripple rings, but uses one dependency-free Three.js r128 material
  // instead of React/R3F, render targets, or the demo's infinite camera-follow plane.
  const STYLIZED_WATER_VERTEX_SHADER = `
    varying vec3 vWaterWorldPosition;
    varying float vWaterFogDepth;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vec4 viewPosition = viewMatrix * worldPosition;
      vWaterWorldPosition = worldPosition.xyz;
      vWaterFogDepth = -viewPosition.z;
      gl_Position = projectionMatrix * viewPosition;
    }
  `;

  const STYLIZED_WATER_FRAGMENT_SHADER = `
    uniform float uTime;
    uniform float uScale;
    uniform float uSmoothness;
    uniform float uEdgeThreshold;
    uniform float uEdgeSoftness;
    uniform vec2 uFlow;
    uniform float uNoiseScale;
    uniform float uNoiseFlowSpeed;
    uniform float uDistortAmount;
    uniform vec3 uDeepColor;
    uniform vec3 uMidColor;
    uniform vec3 uHighlightColor;
    uniform float uOpacity;
    uniform float uDeepOpacity;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform vec2 uRippleCenters[6];
    uniform float uRippleStarts[6];
    uniform float uRippleEnabled[6];
    varying vec3 vWaterWorldPosition;
    varying float vWaterFogDepth;

    vec2 waterHash2(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.xx + p3.yz) * p3.zy);
    }

    float waterSmoothMin(float a, float b, float k) {
      float h = max(k - abs(a - b), 0.0) / max(k, 0.0001);
      return min(a, b) - h * h * h * k / 6.0;
    }

    vec2 waterCellPoint(vec2 seed) {
      return 0.18 + seed * 0.64;
    }

    void waterVoronoi(vec2 p, out float nearest, out float smoothNearest) {
      vec2 cell = floor(p - 0.5);
      vec2 local = p - cell;
      nearest = 8.0;
      smoothNearest = 8.0;
      for (int y = 0; y <= 1; y++) {
        for (int x = 0; x <= 1; x++) {
          vec2 neighbor = vec2(float(x), float(y));
          vec2 point = waterCellPoint(waterHash2(cell + neighbor));
          vec2 pointOffset = neighbor + point - local;
          float distanceToPoint = dot(pointOffset, pointOffset);
          nearest = min(nearest, distanceToPoint);
          smoothNearest = waterSmoothMin(smoothNearest, distanceToPoint, uSmoothness);
        }
      }
    }

    float waterNoiseHash(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float waterValueNoise(vec2 p) {
      vec2 cell = floor(p);
      vec2 local = fract(p);
      local = local * local * (3.0 - 2.0 * local);
      return mix(
        mix(waterNoiseHash(cell), waterNoiseHash(cell + vec2(1.0, 0.0)), local.x),
        mix(waterNoiseHash(cell + vec2(0.0, 1.0)), waterNoiseHash(cell + vec2(1.0, 1.0)), local.x),
        local.y
      );
    }

    float waterFbm(vec2 p) {
      #ifndef ASHENHOLD_COARSE_WATER
        return 0.68 * waterValueNoise(p);
      #else
        return 0.375;
      #endif
    }

    void main() {
      vec2 worldXZ = vWaterWorldPosition.xz;
      vec2 noiseUv = worldXZ * uNoiseScale + vec2(uTime * uNoiseFlowSpeed, 0.0);
      vec2 distortion = vec2(waterFbm(noiseUv) - 0.375) * uDistortAmount;
      vec2 cellUv = worldXZ * uScale + uFlow * uTime + distortion;
      float nearest;
      float smoothNearest;
      waterVoronoi(cellUv, nearest, smoothNearest);
      float edge = nearest - smoothNearest;
      float cel = smoothstep(uEdgeThreshold - uEdgeSoftness, uEdgeThreshold + uEdgeSoftness, edge);
      float midBand = smoothstep(0.04, 0.58, cel);
      float foamBand = smoothstep(0.68, 0.96, cel);
      vec3 color = mix(uDeepColor, uMidColor, midBand);
      color = mix(color, uHighlightColor, foamBand);

      float ripple = 0.0;
      #ifndef ASHENHOLD_COARSE_WATER
        for (int i = 0; i < 6; i++) {
          if (uRippleEnabled[i] > 0.5) {
            float age = max(uTime - uRippleStarts[i], 0.0);
            float radius = age * 3.1;
            float distanceToRipple = length(worldXZ - uRippleCenters[i]);
            float primary = 1.0 - smoothstep(0.08, 0.24, abs(distanceToRipple - radius));
            float secondaryRadius = max(radius - 0.85, 0.0);
            float secondary = (1.0 - smoothstep(0.07, 0.2, abs(distanceToRipple - secondaryRadius))) * step(0.3, radius);
            ripple += (primary + secondary * 0.58) * exp(-age * 1.45);
          }
        }
      #endif
      ripple = clamp(ripple, 0.0, 1.0);
      color = mix(color, uHighlightColor, ripple);

      vec3 viewDirection = normalize(cameraPosition - vWaterWorldPosition);
      float fresnel = pow(1.0 - clamp(viewDirection.y, 0.0, 1.0), 2.1);
      color = mix(color, uMidColor, fresnel * 0.24);
      float alpha = mix(uDeepOpacity, 1.0, max(foamBand, ripple)) * uOpacity;
      float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vWaterFogDepth * vWaterFogDepth);
      color = mix(color, uFogColor, clamp(fogFactor, 0.0, 1.0));
      gl_FragColor = vec4(color, alpha);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }
  `;

  function createStylizedWaterMaterial(definition) {
    const waterColor = new THREE.Color(definition.water);
    const deepColor = waterColor.clone().multiplyScalar(.48);
    const midColor = waterColor.clone().lerp(new THREE.Color(0x62c8df), .52);
    const highlightColor = new THREE.Color(0xe9fbff);
    const rippleCenters = Array.from({ length: 6 }, () => new THREE.Vector2(100000, 100000));
    const material = new THREE.ShaderMaterial({
      vertexShader: STYLIZED_WATER_VERTEX_SHADER,
      fragmentShader: (isCoarse ? "#define ASHENHOLD_COARSE_WATER\n" : "") + STYLIZED_WATER_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: isCoarse ? .19 : .23 },
        uSmoothness: { value: .46 },
        uEdgeThreshold: { value: .09 },
        uEdgeSoftness: { value: isCoarse ? .075 : .055 },
        uFlow: { value: new THREE.Vector2(.07, -.23) },
        uNoiseScale: { value: .87 },
        uNoiseFlowSpeed: { value: reducedMotion ? 0 : .11 },
        uDistortAmount: { value: .26 },
        uDeepColor: { value: deepColor },
        uMidColor: { value: midColor },
        uHighlightColor: { value: highlightColor },
        uOpacity: { value: definition.waterOpacity },
        uDeepOpacity: { value: .62 },
        uFogColor: { value: new THREE.Color(definition.fog) },
        uFogDensity: { value: definition.fogDensity * (isCoarse ? 1.1 : 1) },
        uRippleCenters: { value: rippleCenters },
        uRippleStarts: { value: new Array(6).fill(0) },
        uRippleEnabled: { value: new Array(6).fill(0) }
      }
    });
    material.userData.stylizedWater = {
      style: STYLIZED_WATER_STYLE,
      source: STYLIZED_WATER_SOURCE,
      animated: !reducedMotion,
      tier: isCoarse ? "coarse" : "full"
    };
    return material;
  }

  function createStylizedWaterSurface(options) {
    const definition = BIOMES[options.biomeId];
    const mesh = new THREE.Mesh(options.geometry, createStylizedWaterMaterial(definition));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(options.x, options.level, options.z);
    mesh.renderOrder = 2;
    mesh.userData.waterSurface = {
      id: options.id,
      biomeId: options.biomeId,
      level: options.level,
      radius: options.radius || null
    };
    scene.add(mesh);
    waterSurfaces.push(mesh);
    return mesh;
  }

  function emitStylizedWaterRipple(x, z) {
    if (reducedMotion || isCoarse || !waterSurfaces.length) return false;
    const index = waterRippleCursor % WATER_RIPPLE_CAPACITY;
    waterRippleCursor = (waterRippleCursor + 1) % WATER_RIPPLE_CAPACITY;
    waterSurfaces.forEach((surface) => {
      const uniforms = surface.material.uniforms;
      uniforms.uRippleCenters.value[index].set(x, z);
      uniforms.uRippleStarts.value[index] = elapsed;
      uniforms.uRippleEnabled.value[index] = 1;
    });
    waterRipplesEmitted += 1;
    return true;
  }

  function resetStylizedWaterRipples() {
    waterRippleCursor = 0;
    waterRippleTimer = 0;
    waterWasWading = false;
    waterRipplesEmitted = 0;
    waterSurfaces.forEach((surface) => {
      const uniforms = surface.material.uniforms;
      uniforms.uRippleStarts.value.fill(0);
      uniforms.uRippleEnabled.value.fill(0);
      uniforms.uRippleCenters.value.forEach((center) => center.set(100000, 100000));
    });
  }

  function updateStylizedWater(dt) {
    if (!waterSurfaces.length) return;
    const time = reducedMotion ? 0 : elapsed;
    waterSurfaces.forEach((surface) => {
      const uniforms = surface.material.uniforms;
      uniforms.uTime.value = time;
      uniforms.uFogColor.value.copy(scene.fog.color);
      uniforms.uFogDensity.value = scene.fog.density;
      for (let index = 0; index < 6; index += 1) {
        if (uniforms.uRippleEnabled.value[index] && time - uniforms.uRippleStarts.value[index] > 3.2) uniforms.uRippleEnabled.value[index] = 0;
      }
    });
    waterRippleTimer = Math.max(0, waterRippleTimer - dt);
    const enteredWater = player && player.wading && !waterWasWading;
    if ((enteredWater || (player && player.wading && player.moving && waterRippleTimer <= 0)) && player.root) {
      if (emitStylizedWaterRipple(player.root.position.x, player.root.position.z)) waterRippleTimer = enteredWater ? .32 : .52;
    }
    waterWasWading = Boolean(player && player.wading);
  }

  function stylizedWaterDebug() {
    let activeRipples = 0;
    if (waterSurfaces[0]) activeRipples = waterSurfaces[0].material.uniforms.uRippleEnabled.value.filter(Boolean).length;
    return {
      style: STYLIZED_WATER_STYLE,
      source: STYLIZED_WATER_SOURCE,
      textureFree: true,
      sameOriginRequests: 0,
      animated: !reducedMotion,
      reducedMotion,
      tier: isCoarse ? "coarse" : "full",
      rippleCapacity: WATER_RIPPLE_CAPACITY,
      ripplesEmitted: waterRipplesEmitted,
      activeRipples,
      surfaces: waterSurfaces.map((surface) => Object.assign({}, surface.userData.waterSurface))
    };
  }

  function createTerrain() {
    const segments = isCoarse ? 130 : 240;
    const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const colors = [];
    const textured = Boolean(visualAssets.biomeGround || visualAssets.ground);
    const color = new THREE.Color();
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const y = terrainHeight(x, z);
      position.setY(i, y);
      const vertexBiome = BIOMES[biomeIdAt(x, z)];
      const low = new THREE.Color(vertexBiome.ground).multiplyScalar(textured ? 1.15 : .72);
      const rock = new THREE.Color(vertexBiome.cliff);
      const high = new THREE.Color(vertexBiome.frost).lerp(new THREE.Color(vertexBiome.cliff), .5);
      const snow = new THREE.Color(vertexBiome.frost);
      if (y < 12) color.copy(low).lerp(rock, clamp((y - 1) / 18, 0, 1));
      else if (y < 48) color.copy(rock).lerp(high, (y - 12) / 36);
      else color.copy(high).lerp(snow, clamp((y - 48) / 52, 0, 1));
      const variation = .91 + seeded(i + 91) * .12;
      colors.push(color.r * variation, color.g * variation, color.b * variation);
    }
    position.needsUpdate = true;
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const groundDetail = visualAssets.biomeGround || visualAssets.ground || createTerrainTexture();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, map: groundDetail,
      roughness: .94, metalness: .018, envMapIntensity: .24
    });
    if (visualAssets.cliff) {
      material.onBeforeCompile = (shader) => {
        material.userData.terrainShader = shader;
        shader.uniforms.cliffMap = { value: visualAssets.cliff };
        BIOME_IDS.filter((id) => id !== "jungle").forEach((id) => {
          const entry = visualAssets.biomeMaterials && visualAssets.biomeMaterials[id];
          shader.uniforms["terrainMap_" + id] = { value: entry && entry.color || groundDetail };
        });
        shader.vertexShader = "varying vec3 vTerrainWorldPosition; varying vec3 vTerrainWorldNormal;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n vTerrainWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;\n vTerrainWorldNormal=normalize(mat3(modelMatrix)*objectNormal);"
        );
        shader.fragmentShader = "uniform sampler2D cliffMap; uniform sampler2D terrainMap_shore; uniform sampler2D terrainMap_desert; uniform sampler2D terrainMap_snowy; uniform sampler2D terrainMap_mountains; uniform sampler2D terrainMap_moon; varying vec3 vTerrainWorldPosition; varying vec3 vTerrainWorldNormal;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#ifdef USE_MAP
            vec3 terrainNormal=abs(normalize(vTerrainWorldNormal));
            terrainNormal=pow(terrainNormal,vec3(5.0));
            terrainNormal/=max(terrainNormal.x+terrainNormal.y+terrainNormal.z,0.0001);
            vec2 terrainUv=vTerrainWorldPosition.xz*0.058;
            float wShore=pow(1.0/(1.0+dot(vTerrainWorldPosition.xz-vec2(-590.0,360.0),vTerrainWorldPosition.xz-vec2(-590.0,360.0))/105000.0),3.2);
            float wJungle=pow(1.0/(1.0+dot(vTerrainWorldPosition.xz-vec2(0.0,255.0),vTerrainWorldPosition.xz-vec2(0.0,255.0))/105000.0),3.2);
            float wDesert=pow(1.0/(1.0+dot(vTerrainWorldPosition.xz-vec2(590.0,360.0),vTerrainWorldPosition.xz-vec2(590.0,360.0))/105000.0),3.2);
            float wSnowy=pow(1.0/(1.0+dot(vTerrainWorldPosition.xz-vec2(-590.0,-410.0),vTerrainWorldPosition.xz-vec2(-590.0,-410.0))/105000.0),3.2);
            float wMountains=pow(1.0/(1.0+dot(vTerrainWorldPosition.xz-vec2(0.0,-520.0),vTerrainWorldPosition.xz-vec2(0.0,-520.0))/105000.0),3.2);
            float wMoon=pow(1.0/(1.0+dot(vTerrainWorldPosition.xz-vec2(590.0,-410.0),vTerrainWorldPosition.xz-vec2(590.0,-410.0))/105000.0),3.2);
            float weightTotal=max(0.0001,wShore+wJungle+wDesert+wSnowy+wMountains+wMoon);
            vec3 groundSample=(texture2D(terrainMap_shore,terrainUv).rgb*wShore+texture2D(map,terrainUv).rgb*wJungle+texture2D(terrainMap_desert,terrainUv).rgb*wDesert+texture2D(terrainMap_snowy,terrainUv).rgb*wSnowy+texture2D(terrainMap_mountains,terrainUv).rgb*wMountains+texture2D(terrainMap_moon,terrainUv).rgb*wMoon)/weightTotal;
            groundSample=pow(groundSample,vec3(1.04));
            vec3 cliffX=pow(texture2D(cliffMap,vTerrainWorldPosition.zy*0.047).rgb,vec3(1.06));
            vec3 cliffY=pow(texture2D(cliffMap,vTerrainWorldPosition.xz*0.047).rgb,vec3(1.06));
            vec3 cliffZ=pow(texture2D(cliffMap,vTerrainWorldPosition.xy*0.047).rgb,vec3(1.06));
            vec3 cliffSample=cliffX*terrainNormal.x+cliffY*terrainNormal.y+cliffZ*terrainNormal.z;
            float slope=smoothstep(0.15,0.62,1.0-abs(normalize(vTerrainWorldNormal).y));
            vec3 terrainColor=mix(groundSample,cliffSample,slope);
            diffuseColor*=vec4(terrainColor*0.96,1.0);
          #endif`
        );
      };
      material.customProgramCacheKey = () => "ashenhold-continent-six-biome-v1";
    }
    terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    scene.add(terrain);

    const shoreZone = CONTINENT_ZONE_BY_ID.get("shore");
    const shoreBiome = BIOMES.shore;
    createStylizedWaterSurface({
      id: "drowned-coast-water",
      biomeId: "shore",
      geometry: new THREE.CircleGeometry(SHORE_WATER_RADIUS, isCoarse ? 48 : 96),
      x: shoreZone.center.x,
      z: shoreZone.center.z,
      level: shoreBiome.waterLevel,
      radius: SHORE_WATER_RADIUS
    });
  }

  function createTerrainTexture() {
    const size = 256;
    const surface = document.createElement("canvas");
    surface.width = size;
    surface.height = size;
    const surfaceContext = surface.getContext("2d");
    const image = surfaceContext.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = (y * size + x) * 4;
        const grain = seeded(x * 17 + y * 131) * 44;
        const ridge = Math.sin(x * .31 + Math.sin(y * .17) * 2) * 10;
        const value = clamp(170 + grain + ridge, 125, 225);
        image.data[index] = value * .92;
        image.data[index + 1] = value * .96;
        image.data[index + 2] = value;
        image.data[index + 3] = 255;
      }
    }
    surfaceContext.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(surface);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(34, 34);
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function createRoad() {
    const sections = 74;
    const vertices = [];
    const indices = [];
    const uvs = [];
    for (let i = 0; i <= sections; i += 1) {
      const t = i / sections;
      const z = lerp(215, -153, t);
      const x = roadCenterAt(z);
      const half = worldProfile.road.width + Math.sin(t * 9) * .65;
      vertices.push(x - half, terrainHeight(x - half, z) + .12, z, x + half, terrainHeight(x + half, z) + .12, z);
      uvs.push(0, t * 18, 1, t * 18);
      if (i < sections) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const roadTexture = cloneTiledTexture(visualAssets.ground, 1, 1);
    const road = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: worldProfile.road.color, map: roadTexture, bumpMap: roadTexture, bumpScale: .17, roughness: 1
    }));
    road.receiveShadow = true;
    scene.add(road);
  }

  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x2d211b, roughness: 1 });

  const boxStoneMaterialCache = new Map();
  function boxStoneMaterial(width, height, depth) {
    if (!visualAssets.stone) return stoneMaterial;
    const repeatX = Math.max(1, Math.max(width, depth) / 5);
    const repeatY = Math.max(1, height / 3);
    const key = repeatX.toFixed(1) + "x" + repeatY.toFixed(1);
    if (!boxStoneMaterialCache.has(key)) {
      const material = stoneMaterial.clone();
      material.color.lerp(new THREE.Color(0xffffff), .06);
      const map = cloneTiledTexture(visualAssets.stone, repeatX, repeatY);
      material.map = map;
      material.bumpMap = map;
      material.bumpScale = .14;
      material.envMapIntensity = .44;
      boxStoneMaterialCache.set(key, material);
    }
    return boxStoneMaterialCache.get(key);
  }

  function addCollider(x, z, hx, hz, rotation, minY, maxY) {
    const collider = {
      x, z, hx: Math.max(.05, hx), hz: Math.max(.05, hz), rotation: rotation || 0,
      minY: Number.isFinite(minY) ? minY : -Infinity,
      maxY: Number.isFinite(maxY) ? maxY : Infinity
    };
    colliders.push(collider);
    return collider;
  }

  function addStoneBox(group, x, z, w, h, d, rotation, collider) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxStoneMaterial(w, h, d));
    mesh.position.set(x, terrainHeight(x, z) + h / 2, z);
    mesh.rotation.y = rotation || 0;
    mesh.castShadow = !isCoarse;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collider) addCollider(x, z, w / 2, d / 2, rotation || 0, mesh.position.y - h / 2, mesh.position.y + h / 2);
    return mesh;
  }

  function createRuins() {
    const previousPlacementContext = beginAdminPlacementContext("keep");
    const sceneChildrenBefore = new Set(scene.children);
    const colliderStart = colliders.length;
    const ruins = new THREE.Group();
    ruins.name = "Ashenhold Keep";
    scene.add(ruins);
    const cx = RUINS.x;
    const z = RUINS.z;
    // Canonical keep: a roughly 80 x 82 metre defensible enclosure, with a nine-metre gate.
    addStoneBox(ruins, cx - 38, z - 27, 6, 15, 82, 0, true);
    addStoneBox(ruins, cx + 38, z - 27, 6, 15, 82, 0, true);
    addStoneBox(ruins, cx - 20, z - 68, 34, 14, 6, 0, true);
    addStoneBox(ruins, cx + 20, z - 68, 34, 17, 6, 0, true);
    addStoneBox(ruins, cx - 21, z + 14, 31, 13, 6, 0, true);
    addStoneBox(ruins, cx + 21, z + 14, 31, 11, 6, 0, true);

    const towerGeometry = new THREE.CylinderGeometry(9.2, 10.2, 26, 10);
    [[cx - 38, z - 68], [cx + 38, z - 68], [cx - 38, z + 14], [cx + 38, z + 14]].forEach((point, index) => {
      const tower = new THREE.Mesh(towerGeometry, index % 2 ? darkStoneMaterial : stoneMaterial);
      const towerBase = terrainHeight(point[0], point[1]);
      tower.position.set(point[0], towerBase + 13, point[1]);
      tower.rotation.y = index * .38;
      tower.castShadow = !isCoarse;
      tower.receiveShadow = true;
      ruins.add(tower);
      addCollider(point[0], point[1], 8.8, 8.8, 0, towerBase, towerBase + 27);
      for (let b = 0; b < 8; b += 1) {
        if ((b + index) % 3 === 0) continue;
        const angle = b / 8 * Math.PI * 2;
        const battlement = new THREE.Mesh(new THREE.BoxGeometry(3.1, 3, 3.1), stoneMaterial);
        battlement.position.set(point[0] + Math.cos(angle) * 8.2, tower.position.y + 14, point[1] + Math.sin(angle) * 8.2);
        battlement.castShadow = !isCoarse;
        ruins.add(battlement);
      }
    });

    [-5.6, 5.6].forEach((x) => addStoneBox(ruins, cx + x, z + 14, 3.4, 14, 5.8, 0, true));
    addStoneBox(ruins, cx, z + 14, 14.6, 3.2, 5.8, 0, false).position.y += 10.3;

    const obelisk = new THREE.Mesh(new THREE.ConeGeometry(3.2, 17, 4), darkStoneMaterial);
    obelisk.position.set(cx, terrainHeight(cx, z - 27) + 8.5, z - 27);
    obelisk.rotation.y = Math.PI / 4;
    obelisk.castShadow = !isCoarse;
    ruins.add(obelisk);

    createFire(cx - 16, z - 12, true);
    createFire(cx + 18, z - 43, false);
    createFire(cx, z + 24, false);
    scene.children.slice().forEach((child) => {
      if (child !== ruins && !sceneChildrenBefore.has(child) && child !== adminGizmo && child !== adminSelectionHelper) ruins.attach(child);
    });
    registerAdminEntity(ruins, {
      id: "location:keep", label: "ASHENHOLD KEEP", type: "location", category: "Locations", sourceId: "keep",
      pivot: true, anchor: { x: RUINS.x, y: terrainHeight(RUINS.x, RUINS.z), z: RUINS.z }, colliders: colliders.slice(colliderStart)
    });
    endAdminPlacementContext(previousPlacementContext);
  }

  function createFire(x, z, withLight) {
    const group = new THREE.Group();
    group.position.set(x, terrainHeight(x, z) + .2, z);
    const logGeometry = new THREE.CylinderGeometry(.16, .18, 2.2, 6);
    for (let i = 0; i < 3; i += 1) {
      const log = new THREE.Mesh(logGeometry, woodMaterial);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = i * Math.PI / 3;
      log.position.y = .15;
      group.add(log);
    }
    const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xf27632, transparent: true, opacity: .82, depthWrite: false });
    const innerMaterial = new THREE.MeshBasicMaterial({ color: 0xffcf6b, transparent: true, opacity: .9, depthWrite: false });
    const outer = new THREE.Mesh(new THREE.ConeGeometry(.72, 2.4, 7), flameMaterial);
    outer.position.y = 1.25;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(.38, 1.55, 7), innerMaterial);
    inner.position.y = .92;
    group.add(outer, inner);
    if (withLight && !isCoarse) {
      const light = new THREE.PointLight(0xff6b2c, 2.1, 22, 2);
      light.position.y = 2.3;
      group.add(light);
    }
    scene.add(group);
    fires.push({ group, outer, inner, phase: Math.random() * 10 });
  }

  function createDeadTree(x, z, scale, rotation) {
    if (!PROCEDURAL_TREE_GENERATION_ENABLED) return null;
    if (!biomeAllowsTreesAt(x, z)) return null;
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.23 * scale, .48 * scale, 5.8 * scale, 6), woodMaterial);
    trunk.position.y = 2.9 * scale;
    trunk.rotation.z = (seeded(x + z) - .5) * .13;
    trunk.castShadow = !isCoarse;
    group.add(trunk);
    for (let i = 0; i < 3; i += 1) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(.08 * scale, .18 * scale, (2.3 + i * .3) * scale, 5), woodMaterial);
      branch.position.set((i % 2 ? -1 : 1) * .55 * scale, (3.5 + i * .7) * scale, 0);
      branch.rotation.z = (i % 2 ? 1 : -1) * (.75 + i * .08);
      branch.rotation.y = i * 1.7;
      branch.castShadow = !isCoarse;
      group.add(branch);
    }
    group.position.set(x, terrainHeight(x, z), z);
    group.rotation.y = rotation;
    scene.add(group);
    recordTreePopulation(biomeIdAt(x, z), 1, "procedural-model");
    return group;
  }

  const FOREST_PROFILES = Object.freeze({
    shore: { id: "storm-coast-tree-lods", desktop: 430, coarse: 190, minHeight: 20, maxHeight: 34, giantHeight: 42, giantChance: .035, width: .88, spacing: 11, slope: 1.45, leafTint: 0x8cae93, barkTint: 0x9b8978 },
    jungle: { id: "verdant-old-growth-tree-lods", desktop: 800, coarse: 360, minHeight: 27, maxHeight: 48, giantHeight: 62, giantChance: .055, width: 1.08, spacing: 9, slope: 1.55, leafTint: 0x74a36f, barkTint: 0x8e806b },
    snowy: { id: "frostbound-tree-lods", desktop: 570, coarse: 260, minHeight: 23, maxHeight: 39, giantHeight: 49, giantChance: .035, width: .92, spacing: 10, slope: 1.7, leafTint: 0xb4c9bf, barkTint: 0xaba9a2 },
    mountains: { id: "skysunder-tree-lods", desktop: 400, coarse: 180, minHeight: 18, maxHeight: 32, giantHeight: 40, giantChance: .025, width: .82, spacing: 12, slope: 2.1, leafTint: 0x829b86, barkTint: 0x91867a },
    desert: { id: "ember-dunes-tree-exclusion", desktop: 0, coarse: 0, minHeight: 0, maxHeight: 0, giantHeight: 0, giantChance: 0, width: 0, slope: 0, leafTint: 0xffffff, barkTint: 0xffffff },
    moon: { id: "moonfall-tree-exclusion", desktop: 0, coarse: 0, minHeight: 0, maxHeight: 0, giantHeight: 0, giantChance: 0, width: 0, slope: 0, leafTint: 0xffffff, barkTint: 0xffffff }
  });

  function forestPlacementClear(x, z, padding) {
    const clearance = padding || 0;
    if (!biomeAllowsTreesAt(x, z)) return false;
    if (z > -205 && z < 255 && Math.abs(x - roadCenterAt(z)) < 18 + clearance) return false;
    if (Math.hypot(x - START.x, z - START.z) < 48 + clearance) return false;
    if (Math.hypot(x - TITLE_VANTAGE.x, z - TITLE_VANTAGE.z) < 34 + clearance) return false;
    if (Math.hypot(x - RUINS.x, z - (RUINS.z - 27)) < 88 + clearance) return false;
    if (Math.hypot(x - RUNE_HOLLOW.x, z - RUNE_HOLLOW.z) < 28 + clearance) return false;
    for (let index = 0; index < worldLayout.forts.length; index += 1) if (Math.hypot(x - worldLayout.forts[index][0], z - worldLayout.forts[index][1]) < 66 + clearance) return false;
    for (let index = 0; index < worldLayout.routes.length; index += 1) if (Math.hypot(x - worldLayout.routes[index][0], z - worldLayout.routes[index][1]) < 44 + clearance) return false;
    for (let index = 0; index < worldLayout.pois.length; index += 1) if (Math.hypot(x - worldLayout.pois[index].x, z - worldLayout.pois[index].z) < 38 + clearance) return false;
    for (let index = 0; index < worldLayout.infrastructure.length; index += 1) if (Math.hypot(x - worldLayout.infrastructure[index].x, z - worldLayout.infrastructure[index].z) < 12 + clearance) return false;
    return true;
  }

  function createForestHeroModel(tree, assetId, trunkMaterial, crownMaterial) {
    const asset = visualAssets.models && visualAssets.models[assetId];
    const metric = modelScaleRegistry[assetId];
    if (!asset || !asset.scene || !metric) return null;
    const root = asset.scene.clone(true);
    const sourceSpan = Math.max(.01, metric.sx, metric.sz);
    const targetSpan = Math.max(tree.trunkRadius * 4.8, tree.crownRadius * 2);
    const scaleY = tree.height / metric.sy;
    const scaleXZ = targetSpan / sourceSpan;
    root.name = "Forest hero " + assetId;
    root.scale.set(scaleXZ * tree.widthX, scaleY, scaleXZ * tree.widthZ);
    root.position.set(tree.x, tree.y - metric.minY * scaleY, tree.z);
    root.rotation.order = "YXZ";
    root.rotation.set(tree.leanX * .45, tree.rotation, tree.leanZ * .45);
    root.visible = false;
    root.traverse((object) => {
      if (!object.isMesh) return;
      const foliage = /^F1_L/i.test(object.name);
      object.material = foliage ? crownMaterial : trunkMaterial;
      object.castShadow = !isCoarse && !foliage;
      object.receiveShadow = true;
    });
    scene.add(root);
    importedModelInstances += 1;
    return root;
  }

  function createLegacyProceduralForest() {
    if (!PROCEDURAL_TREE_GENERATION_ENABLED) {
      forestChunks = [];
      forestReport = {
        profile: "procedural-forest-disabled", enabled: false, total: 0,
        byBiome: Object.fromEntries(BIOME_IDS.map((id) => [id, 0])),
        heroes: 0, assetHeroes: 0, proceduralHeroes: 0, heroVariants: [],
        chunks: 0, visible: 0, nearChunks: 0, farChunks: 0, culledChunks: 0,
        nearTrees: 0, farTrees: 0, instancedMeshes: 0, heroColliders: 0,
        maxTrunkDiameter: 0, potentialDrawCalls: 0
      };
      updateAncientForestVisibility(true);
      return;
    }
    const profile = FOREST_PROFILES[realm.biome] || FOREST_PROFILES.jungle;
    const forestBiomes = BIOME_IDS.filter((id) => !TREELESS_BIOME_IDS.has(id));
    const densityAverage = forestBiomes.reduce((sum, id) => sum + (editorDocument.biomes[id] && editorDocument.biomes[id].treeDensity !== undefined ? editorDocument.biomes[id].treeDensity : 1), 0) / Math.max(1, forestBiomes.length);
    const target = Math.round((isCoarse ? profile.coarse : profile.desktop) * clamp(densityAverage, 0, 3));
    const placements = [];
    const salt = worldLayout.salt + 15200;
    for (let attempt = 0; placements.length < target && attempt < target * 16; attempt += 1) {
      const roll = salt + attempt * 19;
      const x = (seeded(roll + 1) - .5) * 1660;
      const z = (seeded(roll + 2) - .5) * 1660;
      if (!forestPlacementClear(x, z, 1.5)) continue;
      const y = terrainHeight(x, z);
      if (y <= waterLevelAt(x, z) + .45) continue;
      const slope = Math.abs(terrainHeight(x + 1.5, z) - y) + Math.abs(terrainHeight(x, z + 1.5) - y);
      if (slope > 1.35) continue;
      const treeBiomeId = biomeIdAt(x, z);
      const treeProfile = FOREST_PROFILES[treeBiomeId] || profile;
      const hero = seeded(roll + 3) < treeProfile.heroChance;
      const height = hero
        ? lerp(treeProfile.heroMin, treeProfile.heroMax, seeded(roll + 4))
        : lerp(treeProfile.minHeight, treeProfile.maxHeight, seeded(roll + 4));
      const trunkRadius = hero
        ? lerp(2.3, treeBiomeId === "jungle" ? 6.7 : 5.2, seeded(roll + 5))
        : (.38 + seeded(roll + 5) * .78) * treeProfile.trunk;
      const crownRadius = hero ? height * (.18 + seeded(roll + 6) * .08) : height * (.14 + seeded(roll + 6) * .065);
      placements.push({
        x, y, z, height, trunkRadius, crownRadius, hero, biomeId: treeBiomeId,
        barkColor: treeProfile.bark, leafColor: treeProfile.leaf,
        rotation: seeded(roll + 7) * Math.PI * 2,
        widthX: .84 + seeded(roll + 8) * .32,
        widthZ: .84 + seeded(roll + 9) * .32,
        leanX: (seeded(roll + 10) - .5) * .09,
        leanZ: (seeded(roll + 11) - .5) * .09,
        trunkTone: .88 + seeded(roll + 12) * .2,
        crownTone: .88 + seeded(roll + 13) * .18,
        assetId: null
      });
    }
    placements.forEach((tree) => recordTreePopulation(tree.biomeId, 1, "ancient-forest"));
    const heroAssetIds = profile.crown === "broad"
      ? ["ancientTreeA", "ancientTreeB"].filter((id) => visualAssets.models && visualAssets.models[id] && modelScaleRegistry[id])
      : [];
    let assignedAssetHeroes = 0;
    const assetHeroBudget = isCoarse ? 14 : 36;
    placements.forEach((tree) => {
      if (!tree.hero || !heroAssetIds.length || assignedAssetHeroes >= assetHeroBudget) return;
      tree.assetId = heroAssetIds[assignedAssetHeroes % heroAssetIds.length];
      assignedAssetHeroes += 1;
    });
    const chunkSize = 180;
    const buckets = new Map();
    placements.forEach((tree) => {
      const gx = Math.floor((tree.x + HALF_WORLD) / chunkSize);
      const gz = Math.floor((tree.z + HALF_WORLD) / chunkSize);
      const key = gx + ":" + gz;
      if (!buckets.has(key)) buckets.set(key, { gx, gz, trees: [] });
      buckets.get(key).trees.push(tree);
    });
    const trunkGeometry = new THREE.CylinderGeometry(.45, .65, 1, isCoarse ? 5 : 7);
    const crownGeometry = profile.crown === "conifer" ? new THREE.ConeGeometry(1, 1, isCoarse ? 5 : 7)
      : profile.crown === "crystal" ? new THREE.OctahedronGeometry(1, 0)
      : profile.crown === "dead" ? new THREE.ConeGeometry(.45, 1, 5)
      : new THREE.SphereGeometry(1, isCoarse ? 5 : 7, isCoarse ? 4 : 6);
    const farGeometry = profile.crown === "conifer" ? new THREE.ConeGeometry(.8, 1, 5)
      : profile.crown === "crystal" ? new THREE.OctahedronGeometry(1, 0)
      : profile.crown === "dead" ? new THREE.ConeGeometry(.48, 1, 5)
      : new THREE.SphereGeometry(1, 5, 4);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
    const crownMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: .96, metalness: profile.crown === "crystal" ? .2 : 0,
      emissive: profile.crown === "crystal" ? 0x26264d : 0x000000,
      emissiveIntensity: profile.crown === "crystal" ? .35 : 0
    });
    const heroTrunkMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(profile.bark).lerp(new THREE.Color(0xffffff), .44),
      roughness: .96, metalness: 0, vertexColors: false
    });
    const heroCrownMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(profile.leaf).lerp(new THREE.Color(0xb8c5ad), .26),
      emissive: new THREE.Color(profile.leaf).multiplyScalar(.12), emissiveIntensity: .22,
      roughness: .92, metalness: 0, vertexColors: false, side: THREE.DoubleSide
    });
    const farMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    const instanceTone = new THREE.Color();
    forestChunks = [];
    let heroColliderBudget = isCoarse ? 12 : 28;
    let assetHeroCount = 0;
    const assetHeroVariants = new Set();
    const colliderCountBefore = colliders.length;
    buckets.forEach((bucket) => {
      const centerX = -HALF_WORLD + (bucket.gx + .5) * chunkSize;
      const centerZ = -HALF_WORLD + (bucket.gz + .5) * chunkSize;
      const trunkMesh = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, bucket.trees.length);
      const crownMesh = new THREE.InstancedMesh(crownGeometry, crownMaterial, bucket.trees.length);
      const farMesh = new THREE.InstancedMesh(farGeometry, farMaterial, bucket.trees.length);
      const heroModels = [];
      bucket.trees.forEach((tree) => {
        if (!tree.assetId) return;
        const heroModel = createForestHeroModel(tree, tree.assetId, heroTrunkMaterial, heroCrownMaterial);
        if (!heroModel) {
          tree.assetId = null;
          return;
        }
        heroModels.push(heroModel);
        assetHeroCount += 1;
        assetHeroVariants.add(tree.assetId);
      });
      bucket.trees.forEach((tree, index) => {
        euler.set(tree.leanX, tree.rotation, tree.leanZ, "YXZ");
        quaternion.setFromEuler(euler);
        const proceduralScale = tree.assetId ? .0001 : 1;
        matrix.compose(
          new THREE.Vector3(tree.x - centerX, tree.y + tree.height * .5, tree.z - centerZ), quaternion,
          new THREE.Vector3(
            tree.trunkRadius / .65 * tree.widthX * proceduralScale,
            tree.height * proceduralScale,
            tree.trunkRadius / .65 * tree.widthZ * proceduralScale
          )
        );
        trunkMesh.setMatrixAt(index, matrix);
        instanceTone.set(tree.barkColor).multiplyScalar(tree.trunkTone);
        trunkMesh.setColorAt(index, instanceTone);
        const crownHeight = profile.crown === "dead" ? tree.height * .42 : tree.height * (tree.hero ? .52 : .46);
        const crownY = tree.y + tree.height * (profile.crown === "conifer" ? .7 : .78);
        matrix.compose(
          new THREE.Vector3(tree.x - centerX, crownY, tree.z - centerZ), quaternion,
          new THREE.Vector3(
            tree.crownRadius * tree.widthX * proceduralScale,
            crownHeight * proceduralScale,
            tree.crownRadius * tree.widthZ * proceduralScale
          )
        );
        crownMesh.setMatrixAt(index, matrix);
        instanceTone.set(tree.leafColor).multiplyScalar(tree.crownTone);
        crownMesh.setColorAt(index, instanceTone);
        matrix.compose(
          new THREE.Vector3(tree.x - centerX, crownY, tree.z - centerZ), quaternion,
          new THREE.Vector3(tree.crownRadius * tree.widthX, crownHeight, tree.crownRadius * tree.widthZ)
        );
        farMesh.setMatrixAt(index, matrix);
        instanceTone.set(tree.leafColor).multiplyScalar(tree.crownTone * .72);
        farMesh.setColorAt(index, instanceTone);
        if (tree.hero && heroColliderBudget > 0) {
          addCollider(tree.x, tree.z, tree.trunkRadius * .72, tree.trunkRadius * .72, 0, tree.y, tree.y + tree.height);
          heroColliderBudget -= 1;
        }
      });
      [trunkMesh, crownMesh, farMesh].forEach((mesh) => {
        mesh.position.set(centerX, 0, centerZ);
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = false;
        mesh.receiveShadow = true;
        scene.add(mesh);
      });
      if (trunkMesh.instanceColor) trunkMesh.instanceColor.needsUpdate = true;
      if (crownMesh.instanceColor) crownMesh.instanceColor.needsUpdate = true;
      if (farMesh.instanceColor) farMesh.instanceColor.needsUpdate = true;
      trunkMesh.castShadow = !isCoarse;
      crownMesh.castShadow = false;
      farMesh.castShadow = false;
      const chunkBiomeId = biomeIdAt(centerX, centerZ);
      forestChunks.push({
        centerX, centerZ, biomeId: chunkBiomeId,
        baseDensity: Math.max(.001, editorDocument.biomes[chunkBiomeId] && editorDocument.biomes[chunkBiomeId].treeDensity !== undefined ? editorDocument.biomes[chunkBiomeId].treeDensity : 1),
        radius: chunkSize * Math.SQRT1_2,
        count: bucket.trees.length, baseCount: bucket.trees.length,
        nearMeshes: [trunkMesh, crownMesh].concat(heroModels), farMesh
      });
    });
    const totalHeroes = placements.filter((tree) => tree.hero).length;
    forestReport = {
      profile: "six-biome-old-growth", total: placements.length,
      byBiome: BIOME_IDS.reduce((result, id) => { result[id] = placements.filter((tree) => tree.biomeId === id).length; return result; }, {}),
      heroes: totalHeroes,
      assetHeroes: assetHeroCount,
      proceduralHeroes: Math.max(0, totalHeroes - assetHeroCount),
      heroVariants: Array.from(assetHeroVariants),
      chunks: forestChunks.length, visible: 0,
      nearChunks: 0, farChunks: 0, culledChunks: forestChunks.length,
      nearTrees: 0, farTrees: 0,
      instancedMeshes: forestChunks.length * 3,
      heroColliders: colliders.length - colliderCountBefore,
      maxTrunkDiameter: placements.reduce((maximum, tree) => Math.max(maximum, tree.trunkRadius * 2), 0),
      potentialDrawCalls: forestChunks.length * 3 + assetHeroCount * 2
    };
    updateAncientForestVisibility(true);
  }

  function treeLodSourceMeshes(assetId) {
    const asset = visualAssets.models && visualAssets.models[assetId];
    if (!asset || !asset.scene) return [];
    asset.scene.updateMatrixWorld(true);
    const inverseRoot = asset.scene.matrixWorld.clone().invert();
    const sources = [];
    asset.scene.traverse((object) => {
      if (!object.isMesh || !object.geometry || !object.material) return;
      sources.push({
        name: object.name || assetId,
        geometry: object.geometry,
        material: Array.isArray(object.material) ? object.material[0] : object.material,
        matrix: inverseRoot.clone().multiply(object.matrixWorld)
      });
    });
    return sources;
  }

  function shareTreeLodTextures() {
    const textureFields = ["map", "normalMap", "roughnessMap", "metalnessMap", "alphaMap", "aoMap", "emissiveMap"];
    const shared = new Map();
    ["treeLod0", "treeLod1", "treeLod2"].forEach((assetId, lodIndex) => {
      const asset = visualAssets.models && visualAssets.models[assetId];
      if (!asset || !asset.scene) return;
      asset.scene.traverse((object) => {
        if (!object.isMesh || !object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          const key = (material.name || object.name || "tree").toLowerCase();
          if (lodIndex === 0) {
            shared.set(key, Object.fromEntries(textureFields.map((field) => [field, material[field] || null])));
            return;
          }
          const source = shared.get(key);
          if (!source) return;
          textureFields.forEach((field) => { if (source[field]) material[field] = source[field]; });
          material.needsUpdate = true;
        });
      });
    });
  }

  function treeLodMaterial(source, profile) {
    const material = source.material.clone();
    const foliage = /leav|foliage|crown/i.test(source.name + " " + (material.name || ""));
    if (material.color) material.color.multiply(new THREE.Color(foliage ? profile.leafTint : profile.barkTint));
    material.roughness = foliage ? .94 : .98;
    material.metalness = 0;
    material.envMapIntensity = foliage ? .24 : .18;
    if (foliage) {
      material.side = THREE.DoubleSide;
      material.alphaTest = Math.max(.45, Number(material.alphaTest) || 0);
      material.transparent = false;
      material.depthWrite = true;
    }
    material.needsUpdate = true;
    return material;
  }

  function fixedTreeRoll(biomeIndex, attempt, channel) {
    return seeded(62000 + biomeIndex * 17003 + attempt * 37 + channel * 1009);
  }

  function createAncientForest() {
    const lodIds = ["treeLod0", "treeLod1", "treeLod2"];
    const lodSources = lodIds.map(treeLodSourceMeshes);
    const missingAssets = lodIds.filter((id, index) => !lodSources[index].length);
    if (!TREE_LOD_FOREST_ENABLED || missingAssets.length) {
      forestChunks = [];
      forestReport = {
        profile: missingAssets.length ? "owner-tree-lods-unavailable" : "owner-tree-lods-disabled",
        enabled: false, missingAssets, total: 0,
        byBiome: Object.fromEntries(BIOME_IDS.map((id) => [id, 0])),
        excludedBiomes: Array.from(TREE_LOD_FOREST_EXCLUDED_BIOME_IDS),
        heroes: 0, assetHeroes: 0, proceduralHeroes: 0, heroVariants: [],
        chunks: 0, visible: 0, nearChunks: 0, midChunks: 0, farChunks: 0, culledChunks: 0,
        nearTrees: 0, midTrees: 0, farTrees: 0, instancedMeshes: 0, heroColliders: 0,
        maxTrunkDiameter: 0, potentialDrawCalls: 0
      };
      updateAncientForestVisibility(true);
      return;
    }

    shareTreeLodTextures();
    const placements = [];
    const byBiome = Object.fromEntries(BIOME_IDS.map((id) => [id, 0]));
    const occupancy = new Map();
    TREE_LOD_FOREST_BIOME_IDS.forEach((biomeId, biomeIndex) => {
      const zone = CONTINENT_ZONE_BY_ID.get(biomeId);
      const profile = FOREST_PROFILES[biomeId];
      const density = clamp(editorDocument.biomes[biomeId] && editorDocument.biomes[biomeId].treeDensity !== undefined
        ? editorDocument.biomes[biomeId].treeDensity : 1, 0, 3);
      const target = Math.round((isCoarse ? profile.coarse : profile.desktop) * density);
      const margin = 28;
      for (let attempt = 0; byBiome[biomeId] < target && attempt < target * 24 + 200; attempt += 1) {
        const x = lerp(zone.bounds.minX + margin, zone.bounds.maxX - margin, fixedTreeRoll(biomeIndex, attempt, 1));
        const z = lerp(zone.bounds.minZ + margin, zone.bounds.maxZ - margin, fixedTreeRoll(biomeIndex, attempt, 2));
        if (biomeIdAt(x, z) !== biomeId || !biomeAllowsTreeLodForestAt(x, z) || !forestPlacementClear(x, z, 4)) continue;
        const y = terrainHeight(x, z);
        if (y <= waterLevelAt(x, z) + .9) continue;
        const sample = 2.4;
        const slope = Math.max(
          Math.abs(terrainHeight(x + sample, z) - y), Math.abs(terrainHeight(x - sample, z) - y),
          Math.abs(terrainHeight(x, z + sample) - y), Math.abs(terrainHeight(x, z - sample) - y)
        );
        if (slope > profile.slope) continue;
        const cellSize = profile.spacing;
        const gx = Math.floor(x / cellSize);
        const gz = Math.floor(z / cellSize);
        let crowded = false;
        for (let ox = -1; ox <= 1 && !crowded; ox += 1) for (let oz = -1; oz <= 1 && !crowded; oz += 1) {
          const neighbors = occupancy.get(biomeId + ":" + (gx + ox) + ":" + (gz + oz)) || [];
          crowded = neighbors.some((tree) => Math.hypot(tree.x - x, tree.z - z) < profile.spacing);
        }
        if (crowded) continue;
        const giant = fixedTreeRoll(biomeIndex, attempt, 3) < profile.giantChance;
        const height = giant
          ? lerp(profile.maxHeight * 1.02, profile.giantHeight, fixedTreeRoll(biomeIndex, attempt, 4))
          : lerp(profile.minHeight, profile.maxHeight, fixedTreeRoll(biomeIndex, attempt, 4));
        const tree = {
          x, y, z, height, giant, biomeId,
          rotation: fixedTreeRoll(biomeIndex, attempt, 5) * Math.PI * 2,
          widthX: profile.width * lerp(.86, 1.14, fixedTreeRoll(biomeIndex, attempt, 6)),
          widthZ: profile.width * lerp(.86, 1.14, fixedTreeRoll(biomeIndex, attempt, 7)),
          leanX: (fixedTreeRoll(biomeIndex, attempt, 8) - .5) * .055,
          leanZ: (fixedTreeRoll(biomeIndex, attempt, 9) - .5) * .055,
          tone: lerp(.82, 1.12, fixedTreeRoll(biomeIndex, attempt, 10)),
          trunkDiameter: height * (giant ? .095 : .058) * profile.width
        };
        placements.push(tree);
        byBiome[biomeId] += 1;
        const cellKey = biomeId + ":" + gx + ":" + gz;
        if (!occupancy.has(cellKey)) occupancy.set(cellKey, []);
        occupancy.get(cellKey).push(tree);
      }
      recordTreePopulation(biomeId, byBiome[biomeId], "owner-tree-lod-pack");
    });

    const chunkSize = 180;
    const buckets = new Map();
    placements.forEach((tree) => {
      const gx = Math.floor((tree.x + HALF_WORLD) / chunkSize);
      const gz = Math.floor((tree.z + HALF_WORLD) / chunkSize);
      const key = tree.biomeId + ":" + gx + ":" + gz;
      if (!buckets.has(key)) buckets.set(key, { gx, gz, biomeId: tree.biomeId, trees: [] });
      buckets.get(key).trees.push(tree);
    });

    forestChunks = [];
    const materialCache = new Map();
    const matrix = new THREE.Matrix4();
    const treeMatrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    const instanceTone = new THREE.Color();
    const colliderCountBefore = colliders.length;
    let colliderBudget = isCoarse ? 18 : 48;
    placements.filter((tree) => tree.giant).sort((a, b) => b.height - a.height).forEach((tree) => {
      if (colliderBudget <= 0) return;
      const radius = clamp(tree.trunkDiameter * .42, .75, 3.2);
      addCollider(tree.x, tree.z, radius, radius, 0, tree.y, tree.y + tree.height);
      colliderBudget -= 1;
    });

    buckets.forEach((bucket) => {
      const centerX = -HALF_WORLD + (bucket.gx + .5) * chunkSize;
      const centerZ = -HALF_WORLD + (bucket.gz + .5) * chunkSize;
      const profile = FOREST_PROFILES[bucket.biomeId];
      const metric = modelScaleRegistry.treeLod0;
      const lodMeshes = lodSources.map((sources, lodIndex) => sources.map((source, sourceIndex) => {
        const materialKey = bucket.biomeId + ":" + lodIndex + ":" + sourceIndex;
        if (!materialCache.has(materialKey)) materialCache.set(materialKey, treeLodMaterial(source, profile));
        const mesh = new THREE.InstancedMesh(source.geometry, materialCache.get(materialKey), bucket.trees.length);
        mesh.name = "Tree LOD" + lodIndex + " " + bucket.biomeId + " " + source.name;
        bucket.trees.forEach((tree, index) => {
          const scaleY = tree.height / Math.max(.01, metric.sy);
          euler.set(tree.leanX, tree.rotation, tree.leanZ, "YXZ");
          quaternion.setFromEuler(euler);
          treeMatrix.compose(
            new THREE.Vector3(tree.x - centerX, tree.y - metric.minY * scaleY, tree.z - centerZ),
            quaternion,
            new THREE.Vector3(scaleY * tree.widthX, scaleY, scaleY * tree.widthZ)
          );
          matrix.multiplyMatrices(treeMatrix, source.matrix);
          mesh.setMatrixAt(index, matrix);
          instanceTone.setRGB(tree.tone, tree.tone, tree.tone);
          mesh.setColorAt(index, instanceTone);
        });
        mesh.position.set(centerX, 0, centerZ);
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.receiveShadow = lodIndex < 2;
        mesh.castShadow = lodIndex === 0 && !isCoarse && !/leav|foliage|crown/i.test(source.name + " " + (source.material.name || ""));
        scene.add(mesh);
        return mesh;
      }));
      const baseDensity = Math.max(.001, editorDocument.biomes[bucket.biomeId] && editorDocument.biomes[bucket.biomeId].treeDensity !== undefined
        ? editorDocument.biomes[bucket.biomeId].treeDensity : 1);
      forestChunks.push({
        centerX, centerZ, biomeId: bucket.biomeId,
        baseDensity, radius: chunkSize * Math.SQRT1_2,
        count: bucket.trees.length, baseCount: bucket.trees.length,
        lodMeshes, activeLod: -1
      });
    });

    const giantCount = placements.filter((tree) => tree.giant).length;
    forestReport = {
      profile: "owner-tree-lod-forest-v1", enabled: true, source: "tree_lods.zip",
      fixedContinent: true, generatedSeed: false, total: placements.length, byBiome,
      includedBiomes: TREE_LOD_FOREST_BIOME_IDS.slice(),
      excludedBiomes: Array.from(TREE_LOD_FOREST_EXCLUDED_BIOME_IDS),
      heroes: giantCount, assetHeroes: placements.length, proceduralHeroes: 0,
      heroVariants: lodIds.slice(), lodTriangles: [21512, 8968, 4346],
      chunks: forestChunks.length, visible: 0,
      nearChunks: 0, midChunks: 0, farChunks: 0, culledChunks: forestChunks.length,
      nearTrees: 0, midTrees: 0, farTrees: 0,
      instancedMeshes: forestChunks.reduce((sum, chunk) => sum + chunk.lodMeshes.reduce((lodSum, meshes) => lodSum + meshes.length, 0), 0),
      heroColliders: colliders.length - colliderCountBefore,
      maxTrunkDiameter: placements.reduce((maximum, tree) => Math.max(maximum, tree.trunkDiameter), 0),
      potentialDrawCalls: forestChunks.length * Math.max.apply(null, lodSources.map((sources) => sources.length))
    };
    updateAncientForestVisibility(true);
  }

  function updateAncientForestVisibility(force) {
    if (!force) {
      forestVisibilityTimer -= .016;
      if (forestVisibilityTimer > 0) return;
    }
    forestVisibilityTimer = .35;
    const focus = player.root ? player.root.position : TITLE_VANTAGE;
    const nearDistance = isCoarse ? 22 : 34;
    const midDistance = (isCoarse ? 105 : 145) * Math.max(.78, qualityScale);
    const farDistance = (isCoarse ? 300 : 410) * Math.max(.72, qualityScale);
    let visible = 0;
    let nearChunks = 0;
    let midChunks = 0;
    let farChunks = 0;
    let nearTrees = 0;
    let midTrees = 0;
    let farTrees = 0;
    forestChunks.forEach((chunk) => {
      const centerDistance = Math.hypot(chunk.centerX - focus.x, chunk.centerZ - focus.z);
      const distance = Math.max(0, centerDistance - (chunk.radius || 0));
      const lod = distance < nearDistance ? 0 : distance < midDistance ? 1 : distance < farDistance ? 2 : -1;
      (chunk.lodMeshes || []).forEach((meshes, lodIndex) => meshes.forEach((mesh) => { mesh.visible = lod === lodIndex && chunk.count > 0; }));
      chunk.activeLod = lod;
      if (lod === 0) { nearChunks += 1; nearTrees += chunk.count; }
      else if (lod === 1) { midChunks += 1; midTrees += chunk.count; }
      else if (lod === 2) { farChunks += 1; farTrees += chunk.count; }
      if (lod >= 0) visible += chunk.count;
    });
    forestReport.visible = visible;
    forestReport.nearChunks = nearChunks;
    forestReport.midChunks = midChunks;
    forestReport.farChunks = farChunks;
    forestReport.culledChunks = Math.max(0, forestChunks.length - nearChunks - midChunks - farChunks);
    forestReport.nearTrees = nearTrees;
    forestReport.midTrees = midTrees;
    forestReport.farTrees = farTrees;
  }

  function createWilderness() {
    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: biome.cliff, roughness: .98 });
    const count = isCoarse ? 75 : 145;
    const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, count);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    for (let i = 0; i < count; i += 1) {
      const x = (seeded(i * 5 + 2) - .5) * 1050;
      const z = (seeded(i * 7 + 11) - .5) * 1050;
      const size = .7 + seeded(i * 13 + 4) * 3.1;
      quaternion.setFromEuler(new THREE.Euler(seeded(i) * 2, seeded(i + 1) * 6, seeded(i + 2) * 2));
      matrix.compose(new THREE.Vector3(x, terrainHeight(x, z) + size * .35, z), quaternion, new THREE.Vector3(size * 1.4, size * .72, size));
      rocks.setMatrixAt(i, matrix);
    }
    rocks.castShadow = !isCoarse;
    rocks.receiveShadow = true;
    scene.add(rocks);

    createAncientForest();

    if (!visualAssets.models || !visualAssets.models.tower) {
      createWatchtower(154, 74);
      createWatchtower(-205, -220);
    }
    createObelisk(-288, 125);
    createObelisk(275, -65);
  }

  function createWatchtower(x, z) {
    const group = new THREE.Group();
    const baseY = terrainHeight(x, z);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 6.2, 19, 8), darkStoneMaterial);
    tower.position.y = 9.5;
    tower.castShadow = !isCoarse;
    tower.receiveShadow = true;
    group.add(tower);
    for (let i = 0; i < 5; i += 1) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 2.6), stoneMaterial);
      const angle = i / 5 * Math.PI * 2;
      block.position.set(Math.cos(angle) * 4.5, 20.2, Math.sin(angle) * 4.5);
      group.add(block);
    }
    group.position.set(x, baseY, z);
    scene.add(group);
    colliders.push({ x, z, hx: 5, hz: 5 });
  }

  function createObelisk(x, z) {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(2, 11, 4), darkStoneMaterial);
    mesh.position.set(x, terrainHeight(x, z) + 5.5, z);
    mesh.rotation.y = Math.PI / 4;
    mesh.castShadow = !isCoarse;
    scene.add(mesh);
  }

  function tunedAuthoredCastleMaterial(material) {
    const tuned = material && material.clone ? material.clone() : stoneMaterial.clone();
    if (tuned.color) tuned.color.lerp(importedStoneTint, .16);
    if ("roughness" in tuned) tuned.roughness = Math.max(.72, Number(tuned.roughness) || 0);
    if ("metalness" in tuned) tuned.metalness = Math.min(.18, Number(tuned.metalness) || 0);
    if ("envMapIntensity" in tuned) tuned.envMapIntensity = .42;
    tuned.needsUpdate = true;
    return tuned;
  }

  function importedModel(id, x, z, scale, rotation, yOffset, collider, baseY) {
    const adminId = placedAdminModelId(id, x, z, rotation, yOffset, scale);
    if (TREE_MODEL_IDS.has(id) && !biomeAllowsTreesAt(x, z)) return null;
    if (TREE_LOD_MODEL_IDS.has(id) && !biomeAllowsTreeLodForestAt(x, z)) return null;
    const asset = visualAssets.models && visualAssets.models[id];
    if (!asset) return null;
    const root = asset.scene.clone(true);
    root.name = "Imported " + id;
    const horizontalScale = scale || 1;
    const verticalScale = modelVerticalScale(id, horizontalScale);
    root.scale.set(horizontalScale, verticalScale, horizontalScale);
    root.rotation.y = rotation || 0;
    const groundY = Number.isFinite(baseY) ? baseY : terrainHeight(x, z);
    const metric = modelScaleRegistry[id];
    root.position.set(x, groundY + (yOffset || 0) - (metric ? metric.minY * verticalScale : 0), z);
    const wooden = id === "catapult" || id === "siegeTower";
    const ironwork = id === "gate";
    const palette = id === "tree" ? worldFoliageMaterial : wooden ? worldWoodMaterial : ironwork ? worldIronMaterial : darkStoneMaterial;
    const preserveAuthoredCastleMaterial = AUTHORED_CASTLE_MATERIAL_IDS.has(id);
    let meshIndex = 0;
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = !isCoarse;
      object.receiveShadow = true;
      if (preserveAuthoredCastleMaterial) {
        object.material = Array.isArray(object.material)
          ? object.material.map(tunedAuthoredCastleMaterial)
          : tunedAuthoredCastleMaterial(object.material);
      } else {
        object.material = palette.clone();
        if (object.material.color) {
          if (palette === darkStoneMaterial) object.material.color.multiply(importedStoneTint);
          else if (palette === worldWoodMaterial) object.material.color.multiply(importedWoodTint);
          object.material.color.multiplyScalar(.88 + (meshIndex % 4) * .035);
        }
      }
      meshIndex += 1;
    });
    scene.add(root);
    importedModelInstances += 1;
    if (TREE_MODEL_IDS.has(id)) recordTreePopulation(biomeIdAt(x, z), 1, "imported-model");
    const colliderLink = collider ? addCollider(
      x, z, collider.hx, collider.hz, rotation || 0,
      groundY + (collider.minY || 0), groundY + (collider.maxY || collider.height || 12)
    ) : null;
    registerAdminEntity(root, {
      id: adminId, label: root.name, type: "model", category: "Models",
      modelSlot: id, colliders: colliderLink ? [colliderLink] : []
    });
    return root;
  }

  // --- POI pack placement (keeps original atlas materials; importedModel would override them) ---
  function packModelSize(key) {
    const metric = modelScaleRegistry[key];
    if (!metric) return null;
    return Object.assign({
      cx: (metric.minX + metric.maxX) / 2,
      cz: (metric.minZ + metric.maxZ) / 2
    }, metric);
  }

  function placePackModel(key, x, z, scale, rotation, opts) {
    const options = opts || {};
    const adminId = placedAdminModelId(key, x, z, rotation, options.yOffset, scale);
    if (TREE_MODEL_IDS.has(key) && !biomeAllowsTreesAt(x, z)) return null;
    if (TREE_LOD_MODEL_IDS.has(key) && !biomeAllowsTreeLodForestAt(x, z)) return null;
    const asset = visualAssets.models && visualAssets.models[key];
    if (!asset) return null;
    const root = asset.scene.clone(true);
    root.name = "Pack " + key;
    const horizontalScale = scale || 1;
    const verticalScale = modelVerticalScale(key, horizontalScale);
    root.scale.set(horizontalScale, verticalScale, horizontalScale);
    root.rotation.y = rotation || 0;
    const baseY = Number.isFinite(options.baseY) ? options.baseY : terrainHeight(x, z);
    const metric = modelScaleRegistry[key];
    root.position.set(x, baseY + (options.yOffset || 0) - (metric ? metric.minY * verticalScale : 0), z);
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = !isCoarse;
      object.receiveShadow = true;
    });
    scene.add(root);
    importedModelInstances += 1;
    if (TREE_MODEL_IDS.has(key)) recordTreePopulation(biomeIdAt(x, z), 1, "pack-model");
    registerAdminEntity(root, {
      id: adminId, label: root.name, type: "model", category: "Models", modelSlot: key
    });
    return { root, baseY };
  }

  // Local (pre-rotation) offset to world, matching a mesh's rotation.y.
  function poiLocalToWorld(x, z, rotation, localX, localZ) {
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    return { x: x + localX * cosine + localZ * sine, z: z - localX * sine + localZ * cosine };
  }

  // Five wall segments around a bbox footprint, leaving a door gap on the front (local +z) side.
  function addBuildingColliders(x, z, rotation, halfX, halfZ, baseY, height, doorGap, offsetX, offsetZ) {
    const thickness = .5;
    const minY = baseY - 1;
    const maxY = baseY + Math.min(height, 6);
    const center = poiLocalToWorld(x, z, rotation, offsetX || 0, offsetZ || 0);
    const gap = clamp(Math.max(2.4, doorGap || 2.6), 0, Math.max(0, halfX * 2 - 1.2));
    const segments = [
      { lx: 0, lz: -halfZ + thickness / 2, hx: halfX, hz: thickness / 2 },
      { lx: -halfX + thickness / 2, lz: 0, hx: thickness / 2, hz: halfZ },
      { lx: halfX - thickness / 2, lz: 0, hx: thickness / 2, hz: halfZ }
    ];
    if (gap > .6) {
      const sideHalf = Math.max(.08, (halfX - gap / 2) / 2);
      segments.push({ lx: -(gap / 2 + sideHalf), lz: halfZ - thickness / 2, hx: sideHalf, hz: thickness / 2 });
      segments.push({ lx: gap / 2 + sideHalf, lz: halfZ - thickness / 2, hx: sideHalf, hz: thickness / 2 });
    } else segments.push({ lx: 0, lz: halfZ - thickness / 2, hx: halfX, hz: thickness / 2 });
    segments.forEach((segment) => {
      const point = poiLocalToWorld(center.x, center.z, rotation, segment.lx, segment.lz);
      addCollider(point.x, point.z, segment.hx, segment.hz, rotation, minY, maxY);
    });
  }

  function addGatewayColliders(x, z, rotation, width, depth, baseY, height, doorGap) {
    const gap = clamp(Math.max(CANONICAL_WORLD_SCALE.doorWidth, doorGap || 4.8), 2.4, width - 1.2);
    const postWidth = Math.max(.5, (width - gap) / 2);
    [-1, 1].forEach((side) => {
      const localX = side * (gap / 2 + postWidth / 2);
      const point = poiLocalToWorld(x, z, rotation, localX, 0);
      addCollider(point.x, point.z, postWidth / 2, depth / 2, rotation, baseY, baseY + height);
    });
  }

  // Align a model's long horizontal axis (measured from its bbox) tangent to a placement angle.
  function poiTangentRotation(angle, size) {
    return -angle - (size.sx >= size.sz ? Math.PI / 2 : 0);
  }

  function createImportedFort(x, z, rotation, scale, name) {
    const colliderStart = colliders.length;
    const fort = new THREE.Group();
    fort.name = name;
    scene.add(fort);
    const fortMultiplier = clamp(scale / 4.45, .9, 1.12);
    const spacing = 29 * fortMultiplier;
    const towerScale = canonicalModelScale("tower", fortMultiplier);
    const towerTopScale = canonicalModelScale("towerTop", fortMultiplier);
    const wallScale = canonicalModelScale("wall", fortMultiplier);
    const gateScale = canonicalModelScale("gate", fortMultiplier);
    const doorwayScale = canonicalModelScale("doorway", fortMultiplier);
    const fortBaseY = terrainHeight(x, z);
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const worldPoint = (localX, localZ) => ({
      x: x + localX * cosine - localZ * sine,
      z: z + localX * sine + localZ * cosine
    });
    const place = (id, localX, localZ, modelScale, localRotation, yOffset, collider) => {
      const point = worldPoint(localX, localZ);
      const model = importedModel(id, point.x, point.z, modelScale, rotation + (localRotation || 0), yOffset || 0, collider, fortBaseY);
      if (model) fort.add(model);
      return model;
    };
    [[-spacing,-spacing],[spacing,-spacing],[-spacing,spacing],[spacing,spacing]].forEach((offset, index) => {
      place("tower", offset[0], offset[1], towerScale, index * Math.PI / 2, 0, scaledModelCollider("tower", towerScale, 24 * fortMultiplier));
      const towerHeight = modelScaleRegistry.tower ? modelScaleRegistry.tower.sy * towerScale : 21 * fortMultiplier;
      place("towerTop", offset[0], offset[1], towerTopScale, index * Math.PI / 2, towerHeight - .35 * fortMultiplier);
    });
    [-.5,.5].forEach((side) => {
      const wallCollider = scaledModelCollider("wall", wallScale, 13 * fortMultiplier);
      place("wall", side * spacing, -spacing, wallScale, 0, 0, wallCollider);
      place("wall", side * spacing, spacing, wallScale, 0, 0, wallCollider);
      place("wall", -spacing, side * spacing, wallScale, Math.PI / 2, 0, wallCollider);
      place("wall", spacing, side * spacing, wallScale, Math.PI / 2, 0, wallCollider);
    });
    // Kenney's gate and doorway run along their source Z axis. Turn that long axis
    // onto the fort wall plane so the visible opening matches the traversal gap.
    place("gate", 0, spacing, gateScale, Math.PI / 2, 0, null);
    place("doorway", 0, -spacing, doorwayScale, Math.PI / 2, 0, null);
    const gateMetric = modelScaleRegistry.gate;
    const doorwayMetric = modelScaleRegistry.doorway;
    addGatewayColliders(x - Math.sin(rotation) * spacing, z + Math.cos(rotation) * spacing, rotation,
      gateMetric ? Math.max(gateMetric.sx, gateMetric.sz) * gateScale : 14, gateMetric ? Math.min(gateMetric.sx, gateMetric.sz) * gateScale : 2.2, fortBaseY, 9.5 * fortMultiplier, 5.4 * fortMultiplier);
    addGatewayColliders(x + Math.sin(rotation) * spacing, z - Math.cos(rotation) * spacing, rotation,
      doorwayMetric ? Math.max(doorwayMetric.sx, doorwayMetric.sz) * doorwayScale : 14, doorwayMetric ? Math.min(doorwayMetric.sx, doorwayMetric.sz) * doorwayScale : 2.2, fortBaseY, 12.5 * fortMultiplier, 4.8 * fortMultiplier);
    place("stairs", 0, -spacing * .52, canonicalModelScale("stairs", fortMultiplier), Math.PI, 0, null);
    place("catapult", spacing * .25, -spacing * .18, 3.4 * fortMultiplier, .55, 0, null);
    place("rock", -spacing * .3, spacing * .15, 3.2 * fortMultiplier, 0, 0, null);
    const fireA = worldPoint(-10, 5);
    const fireB = worldPoint(12, -9);
    createFire(fireA.x, fireA.z, !isCoarse);
    createFire(fireB.x, fireB.z, false);
    registerAdminEntity(fort, {
      id: "location:fort-" + worldLayout.forts.findIndex((entry) => entry[4] === name),
      label: name, type: "location", category: "Locations", sourceId: "fort-" + worldLayout.forts.findIndex((entry) => entry[4] === name),
      pivot: true, anchor: { x, y: fortBaseY, z }, colliders: colliders.slice(colliderStart)
    });
    return fort;
  }

  function createImportedWorld() {
    if (!visualAssets.models || !visualAssets.models.tower) return;
    worldLayout.forts.forEach((fort, index) => {
      const previousPlacementContext = beginAdminPlacementContext("fort-" + index);
      createImportedFort(fort[0], fort[1], fort[2], fort[3], fort[4]);
      endAdminPlacementContext(previousPlacementContext);
      registerStronghold("fort-" + index, fort[4], "fort", fort[0], fort[1]);
    });
    const siegeScale = canonicalModelScale("siegeTower");
    const pierScale = canonicalModelScale("bridgePillar");
    importedModel("siegeTower", 34, -178, siegeScale, -.45, 0, scaledModelCollider("siegeTower", siegeScale, 17));
    importedModel("bridgePillar", -356, 55, pierScale, Math.PI / 2, 0, scaledModelCollider("bridgePillar", pierScale, 14));
    importedModel("tree", -330, 242, canonicalModelScale("tree", 1.35), .2, 0, null);
    importedModel("tree", 295, -310, canonicalModelScale("tree", 1.2), -1.1, 0, null);
    importedModel("rock", 410, -165, 6.4, .7, 0, null);
    for (let i = 0; i < 4; i += 1) {
      const angle = seeded(7200 + i * 5) * Math.PI * 2;
      const radius = 285 + seeded(7201 + i * 5) * 245;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const rotation = seeded(7202 + i * 5) * Math.PI * 2;
      const multiplier = .86 + seeded(7203 + i * 5) * .18;
      const towerScale = canonicalModelScale("tower", multiplier);
      const topScale = canonicalModelScale("towerTop", multiplier);
      const wallScale = canonicalModelScale("wall", multiplier);
      importedModel("tower", x, z, towerScale, rotation, 0, scaledModelCollider("tower", towerScale, 22));
      importedModel("towerTop", x, z, topScale, rotation, (modelScaleRegistry.tower ? modelScaleRegistry.tower.sy * towerScale : 21) - .3, null);
      importedModel("wall", x + Math.cos(rotation) * 10, z + Math.sin(rotation) * 10, wallScale, rotation + Math.PI / 2, 0, scaledModelCollider("wall", wallScale, 11));
    }
    const dressingCount = realm.biome === "jungle" ? 15 : realm.biome === "moon" ? 10 : realm.biome === "desert" ? 7 : 9;
    for (let i = 0; i < dressingCount; i += 1) {
      const x = (seeded(7600 + i * 9) - .5) * 930;
      const z = (seeded(7601 + i * 9) - .5) * 930;
      if (Math.abs(x) < 28 && z > -185 && z < 235) continue;
      const id = biomeIdAt(x, z) === "jungle" ? "tree" : "rock";
      importedModel(id, x, z, id === "tree" ? canonicalModelScale("tree", .8 + seeded(7602 + i * 9) * .7) : 3.2 + seeded(7602 + i * 9) * 3.4, seeded(7603 + i * 9) * Math.PI * 2, 0, null);
    }
  }

  function createInfrastructure() {
    const beforeColliders = colliders.length;
    const beforeImported = importedModelInstances;
    const byKind = {};
    const addWoodBox = (group, x, z, width, height, depth, rotation, collider) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), worldWoodMaterial);
      const baseY = terrainHeight(x, z);
      mesh.position.set(x, baseY + height / 2, z);
      mesh.rotation.y = rotation || 0;
      mesh.castShadow = !isCoarse;
      mesh.receiveShadow = true;
      group.add(mesh);
      if (collider) addCollider(x, z, width / 2, depth / 2, rotation || 0, baseY, baseY + height);
      return mesh;
    };
    (worldLayout.infrastructure || []).forEach((site, index) => {
      const previousPlacementContext = beginAdminPlacementContext("infrastructure-" + site.id);
      const sceneChildrenBefore = new Set(scene.children);
      const siteColliderStart = colliders.length;
      byKind[site.kind] = (byKind[site.kind] || 0) + 1;
      const group = new THREE.Group();
      group.name = "Micro landmark " + site.id + " " + site.kind;
      scene.add(group);
      const point = (localX, localZ) => poiLocalToWorld(site.x, site.z, site.rotation, localX, localZ);
      const baseY = terrainHeight(site.x, site.z);
      if (/wall|bridge/.test(site.kind)) {
        const lengths = [5.8, 4.6, 3.5];
        lengths.forEach((length, segment) => {
          const local = point((segment - 1) * 4.1, (segment % 2) * 1.2);
          addStoneBox(group, local.x, local.z, length, 2.8 + segment * .8, 1.25, site.rotation + (segment - 1) * .16, segment === 1);
        });
        if (site.kind === "fallen-bridge" || site.kind === "drowned-pier") {
          [-1, 1].forEach((side) => {
            const local = point(side * 4.8, -3.2);
            addWoodBox(group, local.x, local.z, 4.8, .42, 1.8, site.rotation + .28 * side, false);
          });
        }
      } else if (/farm|habitation/.test(site.kind)) {
        if (visualAssets.models && visualAssets.models.ruinedHouse) {
          const scale = canonicalModelScale("ruinedHouse", .9 + site.variant * .035);
          placePackModel("ruinedHouse", site.x, site.z, scale, site.rotation, { baseY });
          const size = packModelSize("ruinedHouse");
          addBuildingColliders(site.x, site.z, site.rotation, size.sx * scale / 2, size.sz * scale / 2, baseY, size.sy * scale, 3, size.cx * scale, size.cz * scale);
        } else addStoneBox(group, site.x, site.z, 8, 5.5, 6.5, site.rotation, true);
        const field = point(8, 1);
        for (let row = -1; row <= 1; row += 1) addWoodBox(group, field.x + Math.cos(site.rotation) * row * 1.8, field.z - Math.sin(site.rotation) * row * 1.8, 5.5, .18, .22, site.rotation, false);
      } else if (/platform/.test(site.kind)) {
        const deckY = baseY + 4.5;
        [[-2.4,-2.4],[2.4,-2.4],[-2.4,2.4],[2.4,2.4]].forEach((offset) => {
          const local = point(offset[0], offset[1]);
          const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, 4.5, 6), worldWoodMaterial);
          mesh.position.set(local.x, baseY + 2.25, local.z);
          mesh.castShadow = !isCoarse;
          group.add(mesh);
        });
        const deck = new THREE.Mesh(new THREE.BoxGeometry(6, .35, 6), worldWoodMaterial);
        deck.position.set(site.x, deckY, site.z); deck.rotation.y = site.rotation; deck.castShadow = !isCoarse; deck.receiveShadow = true; group.add(deck);
      } else if (/camp/.test(site.kind)) {
        const tentKey = visualAssets.models && visualAssets.models.tentDetailed ? "tentDetailed" : visualAssets.models && visualAssets.models.tent ? "tent" : null;
        if (tentKey) placePackModel(tentKey, site.x, site.z, tentKey === "tent" ? 3.4 : 3.6, site.rotation, { baseY });
        createFire(site.x + Math.cos(site.rotation) * 3.5, site.z + Math.sin(site.rotation) * 3.5, false);
      } else if (site.kind === "broken-cart") {
        if (visualAssets.models && visualAssets.models.cart) placePackModel("cart", site.x, site.z, 3.5, site.rotation, { baseY });
        const crate = point(2.8, 1.2);
        if (visualAssets.models && visualAssets.models.crateBig) placePackModel("crateBig", crate.x, crate.z, 3.1, site.rotation + .4, { baseY });
      } else {
        const height = /crystal|void/.test(site.kind) ? 9.5 : /root|petrified/.test(site.kind) ? 8 : 6.5;
        const material = /crystal|void/.test(site.kind) ? new THREE.MeshStandardMaterial({ color: 0x7776bd, emissive: 0x2f2b69, emissiveIntensity: .7, roughness: .36, metalness: .22 }) : darkStoneMaterial;
        const marker = new THREE.Mesh(new THREE.ConeGeometry(1.05, height, /crystal/.test(site.kind) ? 5 : 4), material);
        marker.position.set(site.x, baseY + height / 2, site.z); marker.rotation.y = site.rotation; marker.castShadow = !isCoarse; group.add(marker);
        addCollider(site.x, site.z, .72, .72, site.rotation, baseY, baseY + height);
        for (let stone = 0; stone < 3; stone += 1) {
          const angle = site.rotation + stone / 3 * Math.PI * 2;
          const local = { x: site.x + Math.cos(angle) * 2.2, z: site.z + Math.sin(angle) * 2.2 };
          addStoneBox(group, local.x, local.z, 1.1, .65 + stone * .14, .8, angle, false);
        }
      }
      group.userData.infrastructure = { id: site.id, kind: site.kind, index };
      scene.children.slice().forEach((child) => {
        if (child !== group && !sceneChildrenBefore.has(child) && child !== adminGizmo && child !== adminSelectionHelper) group.attach(child);
      });
      registerAdminEntity(group, {
        id: "location:" + site.id, label: site.kind.replace(/-/g, " ").toUpperCase(),
        type: "location", category: "Infrastructure", sourceId: site.id,
        pivot: true, anchor: { x: site.x, y: baseY, z: site.z }, colliders: colliders.slice(siteColliderStart)
      });
      endAdminPlacementContext(previousPlacementContext);
    });
    infrastructureReport = {
      total: (worldLayout.infrastructure || []).length,
      byKind,
      colliders: colliders.length - beforeColliders,
      importedModels: importedModelInstances - beforeImported
    };
  }

  function addPlatform(x, z, width, depth, topY, rotation, metadata) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 1.1, depth), boxStoneMaterial(width, 1.1, depth));
    mesh.position.set(x, topY - .55, z);
    mesh.rotation.y = rotation || 0;
    mesh.castShadow = !isCoarse;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const platform = Object.assign({ x, z, hx: width / 2, hz: depth / 2, y: topY, rotation: rotation || 0 }, metadata || {});
    platforms.push(platform);
    addCollider(x, z, width / 2, depth / 2, rotation || 0, topY - 1.1, topY - .12);
    return mesh;
  }

  function addRoutePlatform(x, z, width, depth, topY, thickness, material, metadata) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), material);
    mesh.position.set(x, topY - thickness / 2, z);
    mesh.castShadow = !isCoarse;
    mesh.receiveShadow = true;
    scene.add(mesh);
    platforms.push(Object.assign({ x, z, hx: width / 2, hz: depth / 2, y: topY, rotation: 0 }, metadata || {}));
    addCollider(x, z, width / 2, depth / 2, 0, topY - Math.max(1.05, thickness), topY - .72);
    return mesh;
  }

  function addRouteParapet(x, z, width, depth, topY) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, .9, depth), boxStoneMaterial(width, .9, depth));
    mesh.position.set(x, topY + .45, z);
    mesh.castShadow = !isCoarse;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addCollider(x, z, width / 2, depth / 2, 0, topY, topY + 1);
    return mesh;
  }

  function addMasonryPillar(x, z, width, bottomY, topY) {
    const height = Math.max(.6, topY - bottomY);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), boxStoneMaterial(width, height, width));
    mesh.position.set(x, bottomY + height / 2, z);
    mesh.castShadow = !isCoarse;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addCollider(x, z, width / 2, width / 2, 0, bottomY, topY);
    return mesh;
  }

  function buildSpireRoute(route, routeIndex) {
    const routeName = route[5];
    const cx = route[0];
    const cz = route[1];
    const baseY = terrainHeight(cx, cz);
    const rise = .75;
    const flights = 4;
    const stepsPerFlight = 8;
    const arm = 6.6;
    const tread = 1.4;
    const stepTread = 1.5;
    const stepWidth = 3.7;
    const summitY = baseY + flights * stepsPerFlight * rise;
    // Core tower: the kit tower wraps the anchored base and a masonry shaft carries the summit deck.
    importedModel("tower", cx, cz, 5, 0, 0, null, baseY);
    const shaftHeight = summitY - 1.1 - (baseY - 1.5);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(9.2, shaftHeight, 9.2), boxStoneMaterial(9.2, shaftHeight, 9.2));
    shaft.position.set(cx, baseY - 1.5 + shaftHeight / 2, cz);
    shaft.castShadow = !isCoarse;
    shaft.receiveShadow = true;
    scene.add(shaft);
    addCollider(cx, cz, 4.75, 4.75, 0, baseY - 1.5, summitY - 1.1);
    // The summit deck registers first so platforms[0] stays a flat slab with a classic walk collider.
    addPlatform(cx, cz, 9, 9, summitY, 0, { routeId: routeName, routeIndex, stepIndex: flights * (stepsPerFlight + 1), groundY: baseY });
    // Low parapets ring the deck; the north-west corner stays open where the top landing meets it.
    addRouteParapet(cx + 1.15, cz - 4.35, 6.7, .3, summitY);
    addRouteParapet(cx - 4.35, cz + 1.15, .3, 6.7, summitY);
    addRouteParapet(cx, cz + 4.35, 9, .3, summitY);
    addRouteParapet(cx + 4.35, cz, .3, 9, summitY);
    const crown = importedModel("towerTop", cx + 2.6, cz + 2.6, 1.8, Math.PI / 2, 0, null, summitY);
    if (crown) addCollider(cx + 2.6, cz + 2.6, 1.7, 1.7, 0, summitY, summitY + 2.6);
    // Switchback stairs wrap the core: one flight per side, pillar-supported landings at each corner.
    const dirX = [1, 0, -1, 0];
    const dirZ = [0, 1, 0, -1];
    const sideX = [0, 1, 0, -1];
    const sideZ = [-1, 0, 1, 0];
    let stepIndex = 0;
    for (let flight = 0; flight < flights; flight += 1) {
      for (let step = 0; step < stepsPerFlight; step += 1) {
        const along = -4.9 + step * tread;
        const x = cx + dirX[flight] * along + sideX[flight] * arm;
        const z = cz + dirZ[flight] * along + sideZ[flight] * arm;
        const topY = baseY + rise * (flight * stepsPerFlight + step + 1);
        const width = dirX[flight] ? stepTread : stepWidth;
        const depth = dirX[flight] ? stepWidth : stepTread;
        addRoutePlatform(x, z, width, depth, topY, 1.1, boxStoneMaterial(width, 1.1, depth), { routeId: routeName, routeIndex, stepIndex, groundY: baseY });
        stepIndex += 1;
      }
      const last = flight === flights - 1;
      const landingTop = baseY + rise * (flight + 1) * stepsPerFlight;
      const landingX = last ? cx - 5.4 : cx + (sideX[flight] + dirX[flight]) * arm;
      const landingZ = last ? cz - 5.05 : cz + (sideZ[flight] + dirZ[flight]) * arm;
      const sizeX = last ? 5.4 : 3.6;
      const sizeZ = last ? 2.7 : 3.6;
      addRoutePlatform(landingX, landingZ, sizeX, sizeZ, landingTop, 1.1, boxStoneMaterial(sizeX, 1.1, sizeZ), { routeId: routeName, routeIndex, stepIndex, groundY: baseY });
      stepIndex += 1;
      if (last) {
        // Corbel stack under the top landing's free corner; keeps every corridor clear of pillars.
        addMasonryPillar(cx - 5.3, cz - 5.3, 1.6, baseY + 20.9, landingTop - 1.1);
        addMasonryPillar(cx - 6.3, cz - 6.0, 1.4, baseY + 21.6, landingTop - 1.1);
        addMasonryPillar(cx - 7.0, cz - 6.6, 1.3, baseY + 22.1, landingTop - 1.1);
      } else addMasonryPillar(landingX, landingZ, 1.9, baseY - 1, landingTop - 1.1);
    }
    // Ground-level entrance dressing flanking the north-face approach to the first step.
    createFire(cx - 6.7, cz - 9.4, !isCoarse);
    createFire(cx - 4.1, cz - 9.4, false);
    importedModel("doorway", cx - 5.4, cz - 10.6, 3, 0, 0, null, baseY);
  }

  function addScaffoldDeck(deck, routeName, routeIndex, stepIndex, baseY) {
    addRoutePlatform(deck.x, deck.z, deck.w, deck.d, deck.top, .28, worldWoodMaterial, { routeId: routeName, routeIndex, stepIndex, groundY: baseY });
    const insetX = deck.w / 2 - .45;
    const insetZ = deck.d / 2 - .45;
    [[-insetX, -insetZ], [insetX, -insetZ], [-insetX, insetZ], [insetX, insetZ]].forEach((offset) => {
      const x = deck.x + offset[0];
      const z = deck.z + offset[1];
      const groundY = terrainHeight(x, z);
      const height = Math.max(.6, deck.top - .28 - groundY);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, height, 6), worldWoodMaterial);
      post.position.set(x, groundY + height / 2, z);
      post.castShadow = !isCoarse;
      scene.add(post);
    });
    const railZ = deck.z - deck.d / 2 + .1;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(deck.w, .75, .16), worldWoodMaterial);
    rail.position.set(deck.x, deck.top + .375, railZ);
    rail.castShadow = !isCoarse;
    rail.receiveShadow = true;
    scene.add(rail);
    addCollider(deck.x, railZ, deck.w / 2, .08, 0, deck.top, deck.top + .8);
  }

  function buildScaffoldRoute(route, routeIndex) {
    const routeName = route[5];
    const cx = route[0];
    const cz = route[1];
    const baseY = terrainHeight(cx, cz);
    const rise = .75;
    const tread = 1.4;
    // Broken ruin wall face behind the scaffold; the skipped bay leaves the ruin gap.
    [[-11, "wallCorner", 0, { hx: 3.675, hz: 1.14, maxY: 4.6 }], [-3.7, "wall", -.4, { hx: 3.675, hz: 1.14, maxY: 4.6 }], [11, "wall", -.15, { hx: 3.675, hz: 1.14, maxY: 4.6 }]].forEach((segment) => {
      importedModel(segment[1], cx + segment[0], cz, 3.5, 0, segment[2], segment[3], baseY);
    });
    importedModel("rock", cx - 12.5, cz - 1.8, 2.4, .7, 0, null, baseY);
    importedModel("rock", cx + 6.5, cz - 1.9, 2.1, 2.3, 0, null, baseY);
    importedModel("rock", cx + 13.2, cz - 2.6, 2.6, 1.2, 0, null, baseY);
    createFire(cx + 7.5, cz - 5.6, !isCoarse);
    // Plank runs zig-zag up the wall face in two depth rows, so every run leaves its deck into open air.
    const rowNear = cz - 2.6;
    const rowFar = cz - 6.4;
    const decks = [
      { x: cx + 1.9, z: cz - 4.5, w: 5, d: 6.4, top: baseY + 4.5 },
      { x: cx - 10.35, z: cz - 4.5, w: 5, d: 6.4, top: baseY + 9 },
      { x: cx + 2.45, z: cz - 4.05, w: 6.4, d: 4.5, top: baseY + 13.5 }
    ];
    const runs = [
      { from: cx - 7.3, dir: 1, count: 6, top0: baseY + rise, z: rowNear },
      { from: cx - .85, dir: -1, count: 6, top0: baseY + 4.5 + rise, z: rowFar },
      { from: cx - 7.5, dir: 1, count: 5, top0: baseY + 9 + rise, z: rowNear, lastWide: 2.3 }
    ];
    let stepIndex = 0;
    runs.forEach((run, runIndex) => {
      for (let i = 0; i < run.count; i += 1) {
        const wide = run.lastWide && i === run.count - 1;
        const x = run.from + run.dir * i * tread + (wide ? run.dir * (run.lastWide - 1.5) / 2 : 0);
        const topY = run.top0 + i * rise;
        addRoutePlatform(x, run.z, wide ? run.lastWide : 1.5, 2.6, topY, .28, worldWoodMaterial, { routeId: routeName, routeIndex, stepIndex, groundY: baseY });
        stepIndex += 1;
      }
      addScaffoldDeck(decks[runIndex], routeName, routeIndex, stepIndex, baseY);
      stepIndex += 1;
    });
    importedModel("bridge", cx + 7.65, cz - 4.05, 1.4, 0, 0, null, decks[2].top);
  }

  function measureVerticalRoute(routeName) {
    const routePlatforms = platforms.filter((platform) => platform.routeId === routeName).sort((a, b) => a.stepIndex - b.stepIndex);
    let minimumClearance = Infinity;
    let maximumRise = 0;
    let maximumGap = 0;
    routePlatforms.forEach((platform, index) => {
      // The anchor step (stepIndex 0) intentionally starts at ankle height; later surfaces must stand clear of the terrain.
      if (platform.stepIndex > 0) minimumClearance = Math.min(minimumClearance, platform.y - terrainHeight(platform.x, platform.z));
      if (!index) return;
      const previous = routePlatforms[index - 1];
      maximumRise = Math.max(maximumRise, Math.abs(platform.y - previous.y));
      const gapX = Math.max(0, Math.abs(platform.x - previous.x) - platform.hx - previous.hx);
      const gapZ = Math.max(0, Math.abs(platform.z - previous.z) - platform.hz - previous.hz);
      maximumGap = Math.max(maximumGap, Math.hypot(gapX, gapZ));
    });
    return {
      id: routeName, steps: routePlatforms.length, minimumClearance, maximumRise, maximumGap,
      start: routePlatforms.length ? { x: Math.round(routePlatforms[0].x), z: Math.round(routePlatforms[0].z) } : null,
      valid: minimumClearance >= 1.2 && maximumRise <= .85 && maximumGap <= 3.5
    };
  }

  function createVerticalRoutes() {
    verticalRouteReports = [];
    worldLayout.routes.forEach((route, routeIndex) => {
      const previousPlacementContext = beginAdminPlacementContext("route-" + routeIndex);
      const sceneChildrenBefore = new Set(scene.children);
      const colliderStart = colliders.length;
      const platformStart = platforms.length;
      if (routeIndex === 0) buildSpireRoute(route, routeIndex);
      else buildScaffoldRoute(route, routeIndex);
      verticalRouteReports.push(measureVerticalRoute(route[5]));
      const summit = platforms.filter((platform) => platform.routeId === route[5]).sort((a, b) => b.stepIndex - a.stepIndex)[0];
      const pivot = new THREE.Group();
      pivot.name = route[5] + " route editor pivot";
      scene.add(pivot);
      scene.children.slice().forEach((child) => {
        if (child !== pivot && !sceneChildrenBefore.has(child) && child !== adminGizmo && child !== adminSelectionHelper) pivot.attach(child);
      });
      registerAdminEntity(pivot, {
        id: "location:route-" + routeIndex, label: route[5], type: "location", category: "Routes", sourceId: "route-" + routeIndex,
        pivot: true, anchor: { x: route[0], y: terrainHeight(route[0], route[1]), z: route[1] },
        colliders: colliders.slice(colliderStart), platforms: platforms.slice(platformStart)
      });
      endAdminPlacementContext(previousPlacementContext);
      registerStronghold("ascent-" + routeIndex, route[5], "ascent", summit ? summit.x : route[0], summit ? summit.z : route[1]);
    });
  }

  function locationAttachmentOverride(sourceId, point, anchor) {
    const entry = editorDocument.entities["location:" + sourceId];
    if (!entry || (!entry.rotationY && !entry.scale)) return point;
    const scale = adminScale(entry.scale, { x: 1, y: 1, z: 1 });
    const offset = rotateAdminXZ((point.x - anchor.x) * scale.x, (point.z - anchor.z) * scale.z, entry.rotationY || 0);
    point.x = anchor.x + offset.x;
    point.z = anchor.z + offset.z;
    if (Number.isFinite(point.rotation)) point.rotation += entry.rotationY || 0;
    return point;
  }

  function createExperienceRunes() {
    const routeSummits = worldLayout.routes.map((route) => platforms.filter((platform) => platform.routeId === route[5]).sort((a, b) => b.stepIndex - a.stepIndex)[0]);
    const fortDefinitions = worldLayout.forts.map((fort, index) => locationAttachmentOverride("fort-" + index, {
      id: "fort-" + index, sourceId: "fort-" + index, name: fort[4] + " RUNE",
      x: fort[0] + Math.cos(fort[2]) * 9, z: fort[1] + Math.sin(fort[2]) * 9, xp: 90 + index * 20
    }, { x: fort[0], z: fort[1] }));
    const routeDefinitions = routeSummits.filter(Boolean).map((summit, index) => ({
      id: "route-" + index, sourceId: "route-" + index, name: worldLayout.routes[index][5] + " RUNE",
      x: summit.x - (index ? 1.5 : 2.4), z: summit.z, xp: 135 + index * 25
    }));
    const definitions = [
      { id: "hollow", name: "RUNE OF THE HOLLOW", x: RUNE_HOLLOW.x, z: RUNE_HOLLOW.z, xp: 80 },
      locationAttachmentOverride("keep", { id: "keep", sourceId: "keep", name: "KEEPER'S RUNE", x: RUINS.x + 12, z: RUINS.z - 26, xp: 100 }, RUINS)
    ].concat(fortDefinitions, routeDefinitions);
    const runeStone = new THREE.MeshStandardMaterial({
      color: 0x34444a, map: visualAssets.stone || null, bumpMap: visualAssets.stone || null,
      bumpScale: .2, roughness: .82, metalness: .16, envMapIntensity: .34
    });
    definitions.forEach((definition, index) => {
      const root = new THREE.Group();
      root.name = definition.name;
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.35, .62, 8), darkStoneMaterial);
      pedestal.position.y = .31;
      const crystalMaterial = new THREE.MeshStandardMaterial({
        color: 0x8bd8e7, emissive: 0x246f82, emissiveIntensity: 1.35,
        roughness: .2, metalness: .32, transparent: true, opacity: .94
      });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.58, 0), crystalMaterial);
      crystal.position.y = 1.72;
      crystal.rotation.z = .18;
      const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x8ddbea, transparent: true, opacity: .54, side: THREE.DoubleSide, depthWrite: false });
      const halo = new THREE.Mesh(new THREE.TorusGeometry(.94, .035, 7, 32), haloMaterial);
      halo.position.y = 1.72;
      halo.rotation.x = Math.PI / 2;
      const marker = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.62, 36), haloMaterial.clone());
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = .04;
      root.add(pedestal, crystal, halo, marker);
      root.position.set(definition.x, surfaceHeightAt(definition.x, definition.z, 999), definition.z);
      root.traverse((object) => { if (object.isMesh) { object.castShadow = !isCoarse; object.receiveShadow = true; } });
      scene.add(root);
      experienceRunes.push({
        id: definition.id, sourceId: definition.sourceId || null, name: definition.name, xp: definition.xp, root, crystal, halo, marker,
        crystalMaterial, claimed: false, phase: index * 1.37, baseY: crystal.position.y
      });
    });
  }

  function resetExperienceRunes() {
    runesCollected = 0;
    experienceRunes.forEach((rune) => {
      rune.claimed = false;
      rune.crystal.visible = true;
      rune.halo.visible = true;
      rune.marker.material.opacity = .54;
      rune.crystalMaterial.emissiveIntensity = 1.35;
    });
  }

  function nearestExperienceRune(maxDistance) {
    if (!player.root) return null;
    const maximum = maxDistance == null ? 11 : maxDistance;
    return experienceRunes
      .filter((rune) => !rune.claimed && distance2D(player.root.position, rune.root.position) <= maximum)
      .sort((a, b) => distance2D(player.root.position, a.root.position) - distance2D(player.root.position, b.root.position))[0] || null;
  }

  function collectExperienceRune(rune) {
    if (!rune || rune.claimed || state !== "playing") return false;
    rune.claimed = true;
    runesCollected += 1;
    rune.crystal.visible = false;
    rune.halo.visible = false;
    rune.marker.material.opacity = .12;
    const runeXp = Math.round(rune.xp * (1 + skillRank("runecraft") * .12));
    grantXp(runeXp);
    grantRunXp(Math.round(rune.xp * .72), "RUNE");
    player.health = Math.min(maxHealth(), player.health + 8);
    player.shout = Math.min(100, player.shout + 18);
    createShockwave(rune.root.position.clone().add(new THREE.Vector3(0, .15, 0)), 13, .9, 0x87d9e9);
    audio.discover();
    showProgressionBanner("ANCIENT RUNE ABSORBED", rune.name, "+" + runeXp + " WARDEN XP");
    spawnCombatText(rune.root.position, "+" + runeXp + " XP", "xp");
    updateQuestUI();
    markRunDirty(true);
    return true;
  }

  function updateExperienceRunes(dt) {
    experienceRunes.forEach((rune) => {
      if (rune.claimed) return;
      rune.crystal.rotation.y += dt * .9;
      rune.halo.rotation.z += dt * .42;
      rune.crystal.position.y = rune.baseY + Math.sin(elapsed * 1.7 + rune.phase) * .14;
      rune.crystalMaterial.emissiveIntensity = 1.2 + Math.sin(elapsed * 2.4 + rune.phase) * .25;
    });
  }

  // --- Settlements / POIs (hamlets, watchposts, shrines from the vendored packs) ---
  const poiChestSpots = [];
  const poiDebugInfo = [];
  // Scales tuned from measured bboxes (kaykit-medieval sources are ~1/3 the assumed size).
  const POI_SCALES = { medieval: 3.2, town: 3.1, nature: 3.5, natureTree: 2.2, dungeon: 1.25, graveyard: 2.6, crypt: 4.6 };

  // Base garrison composition per stronghold kind; resetActors adds level-scaled light spots
  // and promotions on top. Clear bonuses are granted once, when the last member falls.
  const STRONGHOLD_GARRISONS = {
    fort: { light: 3, heavy: 2, warg: 0, golem: 0 },
    hamlet: { light: 3, heavy: 0, warg: 1, golem: 0 },
    watchpost: { light: 3, heavy: 0, warg: 1, golem: 0 },
    shrine: { light: 2, heavy: 1, warg: 0, golem: 0 },
    graveyard: { light: 4, heavy: 1, warg: 0, golem: 0 },
    camp: { light: 3, heavy: 0, warg: 1, golem: 0 },
    ruin: { light: 2, heavy: 1, warg: 0, golem: 0 },
    ascent: { light: 2, heavy: 0, warg: 1, golem: 0 },
    keep: { light: 4, heavy: 0, warg: 0, golem: 1 }
  };
  const STRONGHOLD_BONUSES = {
    fort: { xp: 150, heal: .3, shout: 25, weaponXp: 50 },
    hamlet: { xp: 100, heal: .2, shout: 25 },
    watchpost: { xp: 110, heal: .2, shout: 25, weaponXp: 35 },
    shrine: { xp: 120, heal: .2, shout: 25, runXp: 40 },
    graveyard: { xp: 130, heal: .2, shout: 25, runXp: 40 },
    camp: { xp: 90, heal: .2, shout: 25 },
    ruin: { xp: 110, heal: .2, shout: 25 },
    ascent: { xp: 80, heal: .2, shout: 25, stamina: true },
    keep: { xp: 200, heal: .3, shout: 100 }
  };
  const STRONGHOLD_RINGS = {
    fort: [8, 15], hamlet: [5, 10], watchpost: [5, 10], shrine: [4.5, 9], graveyard: [5, 11],
    camp: [4.5, 9], ruin: [4.5, 9], ascent: [5, 11], keep: [9, 17]
  };

  function addPoiChestSpot(poi, x, z, xp, rotation) {
    const radialRotation = Math.atan2(x - poi.x, z - poi.z);
    poiChestSpots.push({
      idSuffix: poiChestSpots.length,
      sourceId: poi._adminSourceId || null,
      name: poi.name + " CACHE",
      x,
      z,
      xp: Math.round(xp),
      rotation: Number.isFinite(rotation) ? rotation : radialRotation
    });
  }

  // addRoutePlatform with a yaw: keeps watchpost decks aligned to their (rotated) tower shell so
  // axis-aligned deck corners never pierce the walls. Same collider band semantics as addRoutePlatform.
  function addPoiPlatform(x, z, width, depth, topY, rotation) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, .28, depth), worldWoodMaterial);
    mesh.position.set(x, topY - .14, z);
    mesh.rotation.y = rotation || 0;
    mesh.castShadow = !isCoarse;
    mesh.receiveShadow = true;
    scene.add(mesh);
    platforms.push({ x, z, hx: width / 2, hz: depth / 2, y: topY, rotation: rotation || 0 });
    addCollider(x, z, width / 2, depth / 2, rotation || 0, topY - 1.05, topY - .72);
    return mesh;
  }

  function createStrongholdMarker(stronghold) {
    const material = new THREE.MeshBasicMaterial({ color: 0xe26b3f, transparent: true, opacity: .42, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.15, 2.28, 36), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(stronghold.x, surfaceHeightAt(stronghold.x, stronghold.z, 999) + .06, stronghold.z);
    scene.add(ring);
    stronghold.marker = ring;
    stronghold.markerMaterial = material;
  }

  function createCaptureFlag(stronghold) {
    if (!stronghold || (stronghold.kind !== "shrine" && stronghold.kind !== "graveyard")) return null;
    const salt = worldLayout.salt + 17400 + strongholds.length * 61;
    const angle = seeded(salt + 1) * Math.PI * 2;
    const radius = stronghold.kind === "graveyard" ? 8.2 : 6.8;
    const x = stronghold.x + Math.cos(angle) * radius;
    const z = stronghold.z + Math.sin(angle) * radius;
    const baseY = surfaceHeightAt(x, z, 999);
    const height = stronghold.kind === "graveyard" ? 22 : 20;
    const root = new THREE.Group();
    root.name = "Warden capture flag " + stronghold.id;
    root.position.set(x, baseY, z);
    root.rotation.y = seeded(salt + 2) * Math.PI * 2;
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x283b45, roughness: .42, metalness: .62 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, height, 8), poleMaterial);
    pole.position.y = height / 2;
    pole.castShadow = !isCoarse;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.72, .9, .34, 10), darkStoneMaterial);
    foot.position.y = .17;
    foot.receiveShadow = true;
    const finial = new THREE.Mesh(new THREE.ConeGeometry(.25, .72, 5), poleMaterial);
    finial.position.y = height + .34;
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 4.9, 6), poleMaterial);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(2.25, height - 1.05, 0);
    const clothGeometry = new THREE.PlaneGeometry(4.7, 2.8, 8, 4);
    const clothMaterial = new THREE.MeshStandardMaterial({
      color: 0x367fd3, emissive: 0x12365f, emissiveIntensity: .42,
      roughness: .74, metalness: .03, side: THREE.DoubleSide
    });
    const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
    cloth.position.set(2.42, height - 2.52, 0);
    cloth.castShadow = !isCoarse;
    const sigilMaterial = new THREE.MeshBasicMaterial({ color: 0xc7efff, transparent: true, opacity: .88, side: THREE.DoubleSide, depthWrite: false });
    const sigil = new THREE.Mesh(new THREE.RingGeometry(.36, .49, 4), sigilMaterial);
    sigil.position.set(2.12, height - 2.48, .025);
    sigil.rotation.z = Math.PI / 4;
    root.add(foot, pole, finial, crossbar, cloth, sigil);
    scene.add(root);
    const flag = {
      strongholdId: stronghold.id, root, cloth, baseY, height, raise: 0, target: 0,
      phase: seeded(salt + 3) * Math.PI * 2,
      basePositions: new Float32Array(clothGeometry.attributes.position.array)
    };
    root.visible = false;
    stronghold.captureFlag = flag;
    captureFlags.push(flag);
    return flag;
  }

  function setCaptureFlag(stronghold, captured, animate) {
    const flag = stronghold && stronghold.captureFlag;
    if (!flag) return;
    flag.target = captured ? 1 : 0;
    if (!captured) {
      flag.raise = 0;
      flag.root.visible = false;
      return;
    }
    flag.root.visible = true;
    flag.raise = animate ? 0 : 1;
    flag.root.position.y = flag.baseY - flag.height * (1 - flag.raise);
  }

  function updateCaptureFlags(dt) {
    captureFlags.forEach((flag) => {
      if (!flag.root.visible) return;
      if (flag.raise < flag.target) flag.raise = Math.min(flag.target, flag.raise + dt / 1.65);
      const eased = 1 - Math.pow(1 - flag.raise, 3);
      flag.root.position.y = flag.baseY - flag.height * (1 - eased);
      const positions = flag.cloth.geometry.attributes.position;
      for (let index = 0; index < positions.count; index += 1) {
        const baseX = flag.basePositions[index * 3];
        const tether = clamp((baseX + 2.35) / 4.7, 0, 1);
        positions.setZ(index, Math.sin(elapsed * 3.2 + flag.phase + baseX * 1.35) * .18 * tether + Math.sin(elapsed * 5.1 + index) * .035 * tether);
      }
      positions.needsUpdate = true;
    });
  }

  function decorateStrongholdSite(stronghold, salt) {
    const previousPlacementContext = beginAdminPlacementContext("stronghold-" + stronghold.id);
    const models = visualAssets.models || {};
    const choices = stronghold.kind === "camp" ? ["crateBig", "weaponrack", "tent"]
      : stronghold.kind === "ruin" || stronghold.kind === "shrine" || stronghold.kind === "graveyard" ? ["dngColumn", "statueColumnDamaged", "crateOpen"]
      : ["flagRed", "bannerRed", "crateBig", "weaponrack"];
    const available = choices.filter((key) => models[key]);
    if (!available.length) { endAdminPlacementContext(previousPlacementContext); return; }
    const count = stronghold.kind === "keep" || stronghold.kind === "fort" ? 4 : 2;
    for (let index = 0; index < count; index += 1) {
      const key = available[Math.floor(seeded(salt + 90 + index * 5) * available.length)];
      const angle = seeded(salt + 91 + index * 5) * Math.PI * 2;
      const radius = 3.8 + seeded(salt + 92 + index * 5) * 3.4;
      const scale = key.indexOf("dng") === 0 ? POI_SCALES.dungeon : key.indexOf("statue") === 0 ? POI_SCALES.nature : key.indexOf("banner") === 0 ? POI_SCALES.town : POI_SCALES.medieval;
      placePackModel(key, stronghold.x + Math.cos(angle) * radius, stronghold.z + Math.sin(angle) * radius, scale, seeded(salt + 93 + index * 5) * Math.PI * 2, {});
    }
    endAdminPlacementContext(previousPlacementContext);
  }

  // Strongholds are world gen: every fort, settlement, ascent summit and the keep registers once,
  // with seeded garrison spots ringed around its center (extra light/golem slots cover level scaling).
  function registerStronghold(id, name, kind, x, z) {
    const locationSourceId = kind === "ascent" && /^ascent-\d+$/.test(id) ? "route-" + id.slice(7) : id;
    const authoredOverride = editorDocument.entities["location:" + locationSourceId];
    if (kind !== "ascent" && authoredOverride && authoredOverride.position) {
      x = authoredOverride.position.x;
      z = authoredOverride.position.z;
    }
    const locationRotation = authoredOverride && authoredOverride.rotationY || 0;
    const locationScale = adminScale(authoredOverride && authoredOverride.scale, { x: 1, y: 1, z: 1 });
    const base = STRONGHOLD_GARRISONS[kind] || STRONGHOLD_GARRISONS.hamlet;
    const stronghold = { id, name, kind, biomeId: biomeIdAt(x, z), x, z, members: [], cleared: false, spots: [], baseCount: base.light + base.heavy + base.warg + base.golem };
    const salt = worldLayout.salt + 8100 + strongholds.length * 137;
    const golemSlots = base.golem + (kind === "fort" || kind === "keep" ? 1 : 0);
    const plan = [];
    for (let i = 0; i < base.heavy; i += 1) plan.push("biomeHeavy");
    for (let i = 0; i < base.warg; i += 1) plan.push("warg");
    for (let i = 0; i < golemSlots; i += 1) plan.push("golem");
    for (let i = 0; i < base.light + 4; i += 1) plan.push("biomeLight");
    const ring = STRONGHOLD_RINGS[kind] || STRONGHOLD_RINGS.hamlet;
    plan.forEach((type, index) => {
      let placed = false;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const angle = seeded(salt + index * 7 + attempt * 37 + 1) * Math.PI * 2;
        const distance = ring[0] + seeded(salt + index * 7 + attempt * 37 + 2) * (ring[1] - ring[0]);
        const offset = rotateAdminXZ(Math.cos(angle) * distance * locationScale.x, Math.sin(angle) * distance * locationScale.z, locationRotation);
        const gx = x + offset.x;
        const gz = z + offset.z;
        const gy = terrainHeight(gx, gz);
        if (gy <= waterLevelAt(gx, gz) + .35) continue;
        if (Math.abs(terrainHeight(gx + 1.5, gz) - gy) + Math.abs(terrainHeight(gx, gz + 1.5) - gy) > .9) continue;
        if (hitsCollider(gx, gz, .9, gy, gy + 3.4)) continue;
        stronghold.spots.push({ type, baseType: type, slotIndex: index, x: gx, z: gz, roll: seeded(salt + index * 7 + attempt * 37 + 3) });
        placed = true;
        break;
      }
      if (!placed) worldSpawnFailures += 1;
    });
    strongholds.push(stronghold);
    createStrongholdMarker(stronghold);
    createCaptureFlag(stronghold);
    decorateStrongholdSite(stronghold, salt);
    return stronghold;
  }

  function buildPoiFallback(poi, baseY) {
    createFire(poi.x, poi.z, !isCoarse);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: biome.cliff, roughness: .98 });
    for (let i = 0; i < 3; i += 1) {
      const angle = poi.rotation + i * 2.1;
      const size = 1 + seeded(poi.x * .7 + i * 13) * 1.6;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockMaterial);
      rock.position.set(poi.x + Math.cos(angle) * (2.4 + i * 1.1), baseY + size * .32, poi.z + Math.sin(angle) * (2.4 + i * 1.1));
      rock.scale.set(size * 1.35, size * .72, size);
      rock.rotation.y = angle;
      rock.castShadow = !isCoarse;
      rock.receiveShadow = true;
      scene.add(rock);
    }
    addCollider(poi.x, poi.z, 1.5, 1.5, 0, baseY - 1, baseY + 1.7);
  }

  function buildHamlet(poi, poiIndex, debug) {
    const models = visualAssets.models || {};
    const baseY = terrainHeight(poi.x, poi.z);
    if (!models.tavern && !models.homeA) { buildPoiFallback(poi, baseY); return; }
    const salt = worldLayout.salt + 6100 + poiIndex * 101;
    const centerKey = models.well ? "well" : models.stall ? "stall" : null;
    if (centerKey) {
      const centerScale = centerKey === "well" ? POI_SCALES.medieval : POI_SCALES.town;
      placePackModel(centerKey, poi.x, poi.z, centerScale, poi.rotation, { baseY });
      const size = packModelSize(centerKey);
      addCollider(poi.x, poi.z, Math.max(.3, size.sx * centerScale * .42), Math.max(.3, size.sz * centerScale * .42), poi.rotation, baseY - 1, baseY + Math.min(size.sy * centerScale, 3.2));
    }
    const buildingCount = 3 + Math.floor(seeded(salt + 2) * 3);
    const picks = ["tavern", "homeA", "homeB"];
    if (buildingCount >= 4) picks.push(seeded(salt + 5) > .5 ? "blacksmith" : "church");
    if (buildingCount >= 5) picks.push("homeA");
    const buildings = picks.filter((key) => models[key]);
    buildings.forEach((key, index) => {
      const angle = poi.rotation + index / buildings.length * Math.PI * 2 + (seeded(salt + 10 + index * 3) - .5) * .45;
      const radius = 16 + seeded(salt + 11 + index * 3) * 7;
      const bx = poi.x + Math.cos(angle) * radius;
      const bz = poi.z + Math.sin(angle) * radius;
      const facing = Math.atan2(poi.x - bx, poi.z - bz);
      const buildingScale = canonicalModelScale(key);
      if (!placePackModel(key, bx, bz, buildingScale, facing, { baseY })) return;
      const size = packModelSize(key);
      addBuildingColliders(bx, bz, facing, size.sx * buildingScale / 2, size.sz * buildingScale / 2, baseY, size.sy * buildingScale, 3.1, size.cx * buildingScale, size.cz * buildingScale);
    });
    const dressingKeys = ["barrel", "crateBig", "crateOpen", "sack", "tent", "weaponrack", "flagRed", "bannerRed", "bannerGreen", "cart", "stallBench"];
    const dressingColliders = { barrel: true, crateBig: true, crateOpen: true, tent: true, weaponrack: true, cart: true, stallBench: true };
    const fireAngle = seeded(salt + 30) * Math.PI * 2;
    const fx = poi.x + Math.cos(fireAngle) * 4.6;
    const fz = poi.z + Math.sin(fireAngle) * 4.6;
    let chestX = poi.x + 3.4;
    let chestZ = poi.z;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const chestAngle = seeded(salt + 31 + attempt * 3) * Math.PI * 2;
      const candidateX = poi.x + Math.cos(chestAngle) * 3.4;
      const candidateZ = poi.z + Math.sin(chestAngle) * 3.4;
      if (Math.hypot(candidateX - fx, candidateZ - fz) < 2.5) continue;
      chestX = candidateX;
      chestZ = candidateZ;
      break;
    }
    const dressingCount = 3 + Math.floor(seeded(salt + 20) * 4);
    for (let i = 0; i < dressingCount; i += 1) {
      if (isCoarse && i % 2 === 1) continue;
      const key = dressingKeys[Math.floor(seeded(salt + 21 + i * 5) * dressingKeys.length)];
      if (!models[key]) continue;
      const angle = seeded(salt + 22 + i * 5) * Math.PI * 2;
      const radius = 2.6 + seeded(salt + 23 + i * 5) * 6.2;
      const dx = poi.x + Math.cos(angle) * radius;
      const dz = poi.z + Math.sin(angle) * radius;
      if (Math.hypot(dx - chestX, dz - chestZ) < 2.2 || Math.hypot(dx - fx, dz - fz) < 1.8) continue;
      const scale = key === "bannerRed" || key === "bannerGreen" || key === "cart" || key === "stallBench" ? POI_SCALES.town : POI_SCALES.medieval;
      const rotation = seeded(salt + 24 + i * 5) * Math.PI * 2;
      if (!placePackModel(key, dx, dz, scale, rotation, { baseY })) continue;
      if (dressingColliders[key]) {
        const size = packModelSize(key);
        addCollider(dx, dz, Math.max(.2, size.sx * scale * .45), Math.max(.2, size.sz * scale * .45), rotation, baseY - 1, baseY + Math.min(size.sy * scale, 2.8));
      }
    }
    const treeKey = { snowy: "treePineA", jungle: "treePalmBend", desert: "cactusTall", shore: "treePalm", mountains: "treePineB", moon: "pineCrooked" }[poi.biomeId || biomeIdAt(poi.x, poi.z)];
    if (treeKey && models[treeKey]) {
      const angle = seeded(salt + 26) * Math.PI * 2;
      placePackModel(treeKey, poi.x + Math.cos(angle) * 24, poi.z + Math.sin(angle) * 24, canonicalModelScale(treeKey, .9), seeded(salt + 27) * Math.PI * 2, {});
    }
    if (models.campfireStones) placePackModel("campfireStones", fx, fz, POI_SCALES.nature, fireAngle, { baseY });
    createFire(fx, fz, !isCoarse);
    addPoiChestSpot(poi, chestX, chestZ, 60 + Math.floor(seeded(salt + 32) * 31));
    debug.chests += 1;
  }

  function buildWatchpost(poi, poiIndex, debug) {
    const models = visualAssets.models || {};
    const baseY = terrainHeight(poi.x, poi.z);
    const salt = worldLayout.salt + 6200 + poiIndex * 103;
    let towerKey = null;
    if (models.towerA && models.towerB) towerKey = seeded(salt + 1) > .5 ? "towerB" : "towerA";
    else towerKey = models.towerA ? "towerA" : models.towerB ? "towerB" : null;
    if (!towerKey) { buildPoiFallback(poi, baseY); return; }
    const facing = poi.rotation;
    const size = packModelSize(towerKey);
    let towerScale = canonicalModelScale(towerKey);
    const footprint = Math.min(size.sx, size.sz) * towerScale;
    if (footprint < 8.5) towerScale *= 8.5 / Math.max(.5, footprint);
    placePackModel(towerKey, poi.x, poi.z, towerScale, facing, { baseY });
    const halfX = size.sx * towerScale / 2;
    const halfZ = size.sz * towerScale / 2;
    // Gameplay-critical door: 2.4 gap so the r.8 capsule clears the front quarters with margin.
    addBuildingColliders(poi.x, poi.z, facing, halfX, halfZ, baseY, size.sy * towerScale, 3.1, size.cx * towerScale, size.cz * towerScale);
    // Interior wood steps to an upper floor; plain platforms so surfaceHeightAt just works.
    // Full-width strips (threshold +.75, mid +1.5, deck +2.25) so an r.8 capsule can climb
    // without clipping the next tier's collider band; decks align with the rotated shell.
    const innerX = halfX - .7;
    const innerZ = halfZ - .7;
    const floorTop = baseY + 3;
    const strip = Math.min(1.2, innerZ - .6);
    const stepAt = (localX, localZ, width, depth, topY) => {
      const point = poiLocalToWorld(poi.x, poi.z, facing, localX, localZ);
      addPoiPlatform(point.x, point.z, width, depth, topY, facing);
    };
    stepAt(0, innerZ - strip / 2, innerX * 2, strip, baseY + .75);
    stepAt(0, innerZ - strip * 1.5, innerX * 2, strip, baseY + 1.5);
    stepAt(0, innerZ - strip * 2.5, innerX * 2, strip, baseY + 2.25);
    stepAt(0, -strip * 1.5, innerX * 2, Math.max(1.4, innerZ * 2 - strip * 3), floorTop);
    const chestPoint = poiLocalToWorld(poi.x, poi.z, facing, 0, -strip);
    addPoiChestSpot(poi, chestPoint.x, chestPoint.z, 100 + Math.floor(seeded(salt + 8) * 41), facing);
    debug.chests += 1;
    const doorDir = { x: Math.sin(facing), z: Math.cos(facing) };
    const sideDir = { x: Math.cos(facing), z: -Math.sin(facing) };
    // Dressing flanks the door so the approach lane into the tower stays clear.
    const tentX = poi.x + doorDir.x * (halfZ + 3.2) + sideDir.x * 5.2;
    const tentZ = poi.z + doorDir.z * (halfZ + 3.2) + sideDir.z * 5.2;
    if (models.tent) {
      const tentFacing = Math.atan2(poi.x - tentX, poi.z - tentZ);
      placePackModel("tent", tentX, tentZ, POI_SCALES.medieval, tentFacing, { baseY });
      const tentSize = packModelSize("tent");
      addCollider(tentX, tentZ, Math.max(.3, tentSize.sx * POI_SCALES.medieval * .45), Math.max(.3, tentSize.sz * POI_SCALES.medieval * .45), tentFacing, baseY - 1, baseY + Math.min(tentSize.sy * POI_SCALES.medieval, 3));
    }
    const rackX = poi.x + doorDir.x * (halfZ + 2.2) - sideDir.x * 4.6;
    const rackZ = poi.z + doorDir.z * (halfZ + 2.2) - sideDir.z * 4.6;
    if (models.weaponrack) {
      if (placePackModel("weaponrack", rackX, rackZ, POI_SCALES.medieval, facing + Math.PI / 2, { baseY })) {
        const rackSize = packModelSize("weaponrack");
        addCollider(rackX, rackZ, Math.max(.25, rackSize.sx * POI_SCALES.medieval * .45), Math.max(.25, rackSize.sz * POI_SCALES.medieval * .45), facing + Math.PI / 2, baseY - 1, baseY + 2);
      }
    }
    if (models.flagRed) placePackModel("flagRed", poi.x + doorDir.x * (halfZ + 1.5) + sideDir.x * 1.9, poi.z + doorDir.z * (halfZ + 1.5) + sideDir.z * 1.9, POI_SCALES.medieval, facing, { baseY });
    createFire(tentX + sideDir.x * 1.7, tentZ + sideDir.z * 1.7, !isCoarse);
  }

  function buildShrine(poi, poiIndex, debug) {
    const models = visualAssets.models || {};
    const baseY = terrainHeight(poi.x, poi.z);
    const salt = worldLayout.salt + 6300 + poiIndex * 107;
    const statueKeys = ["statueObelisk", "statueColumnDamaged", "statueHead", "statueColumn"].filter((key) => models[key]);
    if (!statueKeys.length) { buildPoiFallback(poi, baseY); return; }
    const statueCount = 1 + Math.floor(seeded(salt + 1) * 2);
    for (let i = 0; i < statueCount; i += 1) {
      const key = statueKeys[Math.floor(seeded(salt + 2 + i * 3) * statueKeys.length)];
      const angle = poi.rotation + (i ? 2.3 : 0);
      const sx = poi.x + Math.cos(angle) * (i ? 4.4 : 0);
      const sz = poi.z + Math.sin(angle) * (i ? 4.4 : 0);
      const statueFacing = i ? Math.atan2(poi.x - sx, poi.z - sz) : poi.rotation;
      if (!placePackModel(key, sx, sz, POI_SCALES.nature, statueFacing, { baseY })) continue;
      const size = packModelSize(key);
      addCollider(sx, sz, Math.max(.3, size.sx * POI_SCALES.nature * .45), Math.max(.3, size.sz * POI_SCALES.nature * .45), statueFacing, baseY - 1, baseY + Math.min(size.sy * POI_SCALES.nature, 6));
    }
    const ruinKeys = ["dngWallBroken", "dngWallCracked", "dngColumn", "dngWallBroken"].filter((key) => models[key]);
    const arcCount = 2 + Math.floor(seeded(salt + 8) * 3);
    for (let i = 0; i < arcCount && ruinKeys.length; i += 1) {
      const key = ruinKeys[Math.floor(seeded(salt + 9 + i * 3) * ruinKeys.length)];
      const angle = poi.rotation + Math.PI * .68 + (arcCount > 1 ? i / (arcCount - 1) : 0) * Math.PI * .95;
      const radius = 6.5 + seeded(salt + 10 + i * 3) * 2.5;
      const wx = poi.x + Math.cos(angle) * radius;
      const wz = poi.z + Math.sin(angle) * radius;
      const size = packModelSize(key);
      const wallFacing = poiTangentRotation(angle, size);
      if (!placePackModel(key, wx, wz, POI_SCALES.dungeon, wallFacing, { baseY })) continue;
      addCollider(wx, wz, size.sx * POI_SCALES.dungeon * .5, size.sz * POI_SCALES.dungeon * .5, wallFacing, baseY - 1, baseY + Math.min(size.sy * POI_SCALES.dungeon, 5));
    }
    // Altar slab (the altar-stone model ships with the moon-only graveyard pack).
    const altarPoint = poiLocalToWorld(poi.x, poi.z, poi.rotation, 0, 3.1);
    const altar = new THREE.Mesh(new THREE.BoxGeometry(1.6, .95, 1.05), boxStoneMaterial(1.6, .95, 1.05));
    altar.position.set(altarPoint.x, baseY + .475, altarPoint.z);
    altar.rotation.y = poi.rotation;
    altar.castShadow = !isCoarse;
    altar.receiveShadow = true;
    scene.add(altar);
    addCollider(altarPoint.x, altarPoint.z, .8, .53, poi.rotation, baseY - 1, baseY + .95);
    const chestPoint = poiLocalToWorld(poi.x, poi.z, poi.rotation, 0, 5.1);
    addPoiChestSpot(poi, chestPoint.x, chestPoint.z, 90 + Math.floor(seeded(salt + 12) * 31), poi.rotation);
    debug.chests += 1;
  }

  function buildGraveyard(poi, poiIndex, debug) {
    const models = visualAssets.models || {};
    if (!models.crypt) { buildShrine(poi, poiIndex, debug); return; }
    const baseY = terrainHeight(poi.x, poi.z);
    const salt = worldLayout.salt + 6400 + poiIndex * 109;
    const cryptKeys = ["crypt", "cryptA", "cryptSmall"].filter((key) => models[key]);
    const cryptKey = cryptKeys[Math.floor(seeded(salt + 1) * cryptKeys.length)];
    const cryptSize = packModelSize(cryptKey);
    const cryptScale = canonicalModelScale(cryptKey);
    const cryptHalf = cryptSize.sz * cryptScale / 2;
    const cryptZ = -6.4;
    const altarZ = cryptZ + cryptHalf + 1.2;
    const chestZ = altarZ + 1.7;
    const rowStart = Math.max(-.6, chestZ + 1.3);
    const cryptPoint = poiLocalToWorld(poi.x, poi.z, poi.rotation, 0, cryptZ);
    placePackModel(cryptKey, cryptPoint.x, cryptPoint.z, cryptScale, poi.rotation, { baseY });
    addBuildingColliders(cryptPoint.x, cryptPoint.z, poi.rotation, cryptSize.sx * cryptScale * .5, cryptSize.sz * cryptScale * .5, baseY, cryptSize.sy * cryptScale, 3, cryptSize.cx * cryptScale, cryptSize.cz * cryptScale);
    if (models.altarStone) {
      const altarPoint = poiLocalToWorld(poi.x, poi.z, poi.rotation, 0, altarZ);
      placePackModel("altarStone", altarPoint.x, altarPoint.z, POI_SCALES.graveyard, poi.rotation, { baseY });
      const altarSize = packModelSize("altarStone");
      addCollider(altarPoint.x, altarPoint.z, Math.max(.3, altarSize.sx * POI_SCALES.graveyard * .48), Math.max(.3, altarSize.sz * POI_SCALES.graveyard * .48), poi.rotation, baseY - 1, baseY + Math.min(altarSize.sy * POI_SCALES.graveyard, 3));
    }
    const graveKeys = ["gravestoneBevel", "gravestoneBroken", "gravestoneCross", "gravestoneDecorative", "grave"].filter((key) => models[key]);
    const graveCount = 5 + Math.floor(seeded(salt + 2) * 4);
    for (let i = 0; i < graveCount && graveKeys.length; i += 1) {
      const row = i % 2;
      const column = Math.floor(i / 2);
      const point = poiLocalToWorld(poi.x, poi.z, poi.rotation,
        (row ? 1 : -1) * (2.1 + seeded(salt + 3 + i) * .5),
        rowStart + column * 2.3 + (seeded(salt + 4 + i) - .5) * .6);
      const key = graveKeys[Math.floor(seeded(salt + 5 + i * 3) * graveKeys.length)];
      const graveFacing = poi.rotation + (seeded(salt + 6 + i * 3) - .5) * .3;
      if (!placePackModel(key, point.x, point.z, POI_SCALES.graveyard, graveFacing, { baseY })) continue;
      if (key === "grave") continue;
      const size = packModelSize(key);
      addCollider(point.x, point.z, Math.max(.18, size.sx * POI_SCALES.graveyard * .45), Math.max(.18, size.sz * POI_SCALES.graveyard * .45), graveFacing, baseY - 1, baseY + Math.min(size.sy * POI_SCALES.graveyard, 3));
    }
    if (models.fence) {
      const fenceSize = packModelSize("fence");
      const segmentLength = Math.max(1.2, Math.max(fenceSize.sx, fenceSize.sz) * POI_SCALES.graveyard);
      const radius = 10.5;
      const segments = Math.max(7, Math.round(Math.PI * 2 * radius / segmentLength));
      const gateAngle = Math.PI / 2 - poi.rotation;
      for (let i = 0; i < segments; i += 1) {
        const angle = gateAngle + i / segments * Math.PI * 2;
        const isGate = i === 0;
        const key = isGate ? (models.fenceGate ? "fenceGate" : null) : (models.fenceDamaged && i % 4 === 3 ? "fenceDamaged" : "fence");
        if (!key) continue;
        const fx = poi.x + Math.cos(angle) * radius;
        const fz = poi.z + Math.sin(angle) * radius;
        const fenceFacing = poiTangentRotation(angle, fenceSize);
        if (!placePackModel(key, fx, fz, POI_SCALES.graveyard, fenceFacing, { baseY })) continue;
        if (isGate) continue;
        const size = packModelSize(key);
        addCollider(fx, fz, size.sx * POI_SCALES.graveyard * .5, size.sz * POI_SCALES.graveyard * .5, fenceFacing, baseY - 1, baseY + Math.min(size.sy * POI_SCALES.graveyard, 3));
      }
    }
    if (models.lightpost) {
      const lampPoint = poiLocalToWorld(poi.x, poi.z, poi.rotation, 2.2, 9);
      placePackModel("lightpost", lampPoint.x, lampPoint.z, POI_SCALES.graveyard, poi.rotation, { baseY });
      const lampSize = packModelSize("lightpost");
      addCollider(lampPoint.x, lampPoint.z, Math.max(.15, lampSize.sx * POI_SCALES.graveyard * .4), Math.max(.15, lampSize.sz * POI_SCALES.graveyard * .4), poi.rotation, baseY - 1, baseY + Math.min(lampSize.sy * POI_SCALES.graveyard, 4));
    }
    if (models.pineCrooked) {
      const pinePoint = poiLocalToWorld(poi.x, poi.z, poi.rotation, -7.2, 4.6);
      if (placePackModel("pineCrooked", pinePoint.x, pinePoint.z, POI_SCALES.graveyard, seeded(salt + 14) * Math.PI * 2, { baseY })) addCollider(pinePoint.x, pinePoint.z, .5, .5, 0, baseY - 1, baseY + 3);
    }
    const chestPoint = poiLocalToWorld(poi.x, poi.z, poi.rotation, 0, chestZ);
    addPoiChestSpot(poi, chestPoint.x, chestPoint.z, 90 + Math.floor(seeded(salt + 12) * 31), poi.rotation);
    debug.chests += 1;
  }

  function buildRaiderCamp(poi, poiIndex, debug) {
    const models = visualAssets.models || {};
    const baseY = terrainHeight(poi.x, poi.z);
    if (!models.tent && !models.tentDetailed) { buildPoiFallback(poi, baseY); return; }
    const salt = worldLayout.salt + 6500 + poiIndex * 113;
    const fireAngle = seeded(salt + 1) * Math.PI * 2;
    const fx = poi.x + Math.cos(fireAngle) * 1.6;
    const fz = poi.z + Math.sin(fireAngle) * 1.6;
    if (models.campfireStones) placePackModel("campfireStones", fx, fz, POI_SCALES.nature, fireAngle, { baseY });
    createFire(fx, fz, !isCoarse);
    ["tent", "tentDetailed"].filter((key) => models[key]).forEach((key, index) => {
      const angle = poi.rotation + index * Math.PI * .82 + (seeded(salt + 2 + index * 3) - .5) * .4;
      const radius = 4.6 + seeded(salt + 3 + index * 3) * 1.6;
      const tx = poi.x + Math.cos(angle) * radius;
      const tz = poi.z + Math.sin(angle) * radius;
      const facing = Math.atan2(fx - tx, fz - tz);
      const scale = key === "tent" ? POI_SCALES.medieval : POI_SCALES.nature;
      if (!placePackModel(key, tx, tz, scale, facing, { baseY })) return;
      const size = packModelSize(key);
      addCollider(tx, tz, Math.max(.3, size.sx * scale * .45), Math.max(.3, size.sz * scale * .45), facing, baseY - 1, baseY + Math.min(size.sy * scale, 3));
    });
    const dressingKeys = ["crateBig", "crateOpen", "sack", "weaponrack", "barrel"].filter((key) => models[key]);
    const dressingCount = 3 + Math.floor(seeded(salt + 8) * 3);
    for (let i = 0; i < dressingCount && dressingKeys.length; i += 1) {
      const key = dressingKeys[Math.floor(seeded(salt + 9 + i * 5) * dressingKeys.length)];
      const angle = seeded(salt + 10 + i * 5) * Math.PI * 2;
      const radius = 2.8 + seeded(salt + 11 + i * 5) * 4.4;
      const dx = poi.x + Math.cos(angle) * radius;
      const dz = poi.z + Math.sin(angle) * radius;
      if (Math.hypot(dx - fx, dz - fz) < 1.8) continue;
      const rotation = seeded(salt + 12 + i * 5) * Math.PI * 2;
      if (!placePackModel(key, dx, dz, POI_SCALES.medieval, rotation, { baseY })) continue;
      const size = packModelSize(key);
      addCollider(dx, dz, Math.max(.2, size.sx * POI_SCALES.medieval * .45), Math.max(.2, size.sz * POI_SCALES.medieval * .45), rotation, baseY - 1, baseY + Math.min(size.sy * POI_SCALES.medieval, 2.8));
    }
    const chestAngle = seeded(salt + 20) * Math.PI * 2;
    addPoiChestSpot(poi, poi.x + Math.cos(chestAngle) * 3.2, poi.z + Math.sin(chestAngle) * 3.2, 70 + Math.floor(seeded(salt + 21) * 31));
    debug.chests += 1;
  }

  function buildRuinCluster(poi, poiIndex, debug) {
    const models = visualAssets.models || {};
    const baseY = terrainHeight(poi.x, poi.z);
    const salt = worldLayout.salt + 6600 + poiIndex * 127;
    const ruinKeys = ["dngWallBroken", "dngWallCracked", "dngColumn", "dngWallArched"].filter((key) => models[key]);
    if (!ruinKeys.length) { buildPoiFallback(poi, baseY); return; }
    const wallCount = 2 + Math.floor(seeded(salt + 1) * 3);
    const gapAngle = seeded(salt + 2) * Math.PI * 2;
    for (let i = 0; i < wallCount; i += 1) {
      const key = ruinKeys[Math.floor(seeded(salt + 3 + i * 3) * ruinKeys.length)];
      const angle = gapAngle + .7 + (wallCount > 1 ? i / (wallCount - 1) : 0) * (Math.PI * 2 - 1.4);
      const radius = 6 + seeded(salt + 4 + i * 3) * 2.6;
      const wx = poi.x + Math.cos(angle) * radius;
      const wz = poi.z + Math.sin(angle) * radius;
      const size = packModelSize(key);
      const wallFacing = poiTangentRotation(angle, size);
      if (!placePackModel(key, wx, wz, POI_SCALES.dungeon, wallFacing, { baseY })) continue;
      addCollider(wx, wz, size.sx * POI_SCALES.dungeon * .5, size.sz * POI_SCALES.dungeon * .5, wallFacing, baseY - 1, baseY + Math.min(size.sy * POI_SCALES.dungeon, 5));
    }
    const statueKeys = ["statueObelisk", "statueColumnDamaged", "statueHead", "statueColumn"].filter((key) => models[key]);
    if (statueKeys.length) {
      const key = statueKeys[Math.floor(seeded(salt + 14) * statueKeys.length)];
      const statuePoint = poiLocalToWorld(poi.x, poi.z, poi.rotation, 2.6, -2.2);
      if (placePackModel(key, statuePoint.x, statuePoint.z, POI_SCALES.nature, poi.rotation, { baseY })) {
        const size = packModelSize(key);
        addCollider(statuePoint.x, statuePoint.z, Math.max(.3, size.sx * POI_SCALES.nature * .45), Math.max(.3, size.sz * POI_SCALES.nature * .45), poi.rotation, baseY - 1, baseY + Math.min(size.sy * POI_SCALES.nature, 6));
      }
    }
    // Altar slab matches the shrine's procedural one; the ruin predates the graveyard pack.
    const altarPoint = poiLocalToWorld(poi.x, poi.z, poi.rotation, 0, 2.4);
    const altar = new THREE.Mesh(new THREE.BoxGeometry(1.6, .95, 1.05), boxStoneMaterial(1.6, .95, 1.05));
    altar.position.set(altarPoint.x, baseY + .475, altarPoint.z);
    altar.rotation.y = poi.rotation;
    altar.castShadow = !isCoarse;
    altar.receiveShadow = true;
    scene.add(altar);
    addCollider(altarPoint.x, altarPoint.z, .8, .53, poi.rotation, baseY - 1, baseY + .95);
    const chestPoint = poiLocalToWorld(poi.x, poi.z, poi.rotation, 0, 4.6);
    addPoiChestSpot(poi, chestPoint.x, chestPoint.z, 90 + Math.floor(seeded(salt + 16) * 21), poi.rotation);
    debug.chests += 1;
  }

  function createSettlements() {
    poiChestSpots.length = 0;
    poiDebugInfo.length = 0;
    (worldLayout.pois || []).forEach((poi, poiIndex) => {
      poi._adminSourceId = "poi-" + poiIndex;
      const previousPlacementContext = beginAdminPlacementContext("poi-" + poiIndex);
      const sceneChildrenBefore = new Set(scene.children);
      const debug = { kind: poi.kind, name: poi.name, chests: 0, guards: 0, collidersAdded: 0 };
      const collidersBefore = colliders.length;
      if (poi.kind === "hamlet") buildHamlet(poi, poiIndex, debug);
      else if (poi.kind === "watchpost") buildWatchpost(poi, poiIndex, debug);
      else if (poi.kind === "camp") buildRaiderCamp(poi, poiIndex, debug);
      else if (poi.kind === "ruin") buildRuinCluster(poi, poiIndex, debug);
      else if ((poi.biomeId || biomeIdAt(poi.x, poi.z)) === "moon") buildGraveyard(poi, poiIndex, debug);
      else buildShrine(poi, poiIndex, debug);
      debug.collidersAdded = colliders.length - collidersBefore;
      const pivot = new THREE.Group();
      pivot.name = poi.name + " editor pivot";
      scene.add(pivot);
      scene.children.slice().forEach((child) => {
        if (child !== pivot && !sceneChildrenBefore.has(child) && child !== adminGizmo && child !== adminSelectionHelper) pivot.attach(child);
      });
      registerAdminEntity(pivot, {
        id: "location:poi-" + poiIndex, label: poi.name, type: "location", category: "Points of Interest", sourceId: "poi-" + poiIndex,
        pivot: true, anchor: { x: poi.x, y: terrainHeight(poi.x, poi.z), z: poi.z }, colliders: colliders.slice(collidersBefore)
      });
      endAdminPlacementContext(previousPlacementContext);
      poiDebugInfo.push(debug);
      const stronghold = registerStronghold("poi-" + poiIndex, poi.name, poi.kind === "shrine" && (poi.biomeId || biomeIdAt(poi.x, poi.z)) === "moon" ? "graveyard" : poi.kind, poi.x, poi.z);
      debug.guards = stronghold.baseCount;
    });
    registerStronghold("keep", "ASHENHOLD KEEP", "keep", RUINS.x, RUINS.z);
  }

  function createChests() {
    const routeSummits = worldLayout.routes.map((route) => platforms.filter((platform) => platform.routeId === route[5]).sort((a, b) => b.stepIndex - a.stepIndex)[0]);
    const fortChests = worldLayout.forts.map((fort, index) => locationAttachmentOverride("fort-" + index, {
      id: "chest-fort-" + index, name: fort[4] + " CHEST", xp: 70 + index * 20,
      sourceId: "fort-" + index,
      x: fort[0] + Math.cos(fort[2]) * 4 - Math.sin(fort[2]) * 6,
      z: fort[1] + Math.sin(fort[2]) * 4 + Math.cos(fort[2]) * 6,
      rotation: fort[2]
    }, { x: fort[0], z: fort[1] }));
    const routeChests = routeSummits.filter(Boolean).map((summit, index) => ({
      id: "chest-route-" + index, name: worldLayout.routes[index][5] + " TROVE", xp: 130 + index * 30,
      sourceId: "route-" + index,
      x: summit.x + (index ? 1.5 : 2.4), z: summit.z, rotation: -Math.PI / 2
    }));
    const poiChests = poiChestSpots.map((spot, index) => ({
      id: "chest-poi-" + index, sourceId: spot.sourceId, name: spot.name, xp: spot.xp, x: spot.x, z: spot.z, rotation: spot.rotation
    }));
    const definitions = fortChests.concat(routeChests, poiChests);
    const bandMaterial = new THREE.MeshStandardMaterial({ color: 0x2e3436, roughness: .58, metalness: .7, envMapIntensity: .35 });
    const powerTypes = ["damage", "health", "regen", "sprint", "stamina", "critDamage"];
    definitions.forEach((definition, index) => {
      const powerType = powerTypes[Math.floor(seeded(worldLayout.salt + 9300 + index * 17) * powerTypes.length)];
      const powerAmount = 1 + Math.floor(seeded(worldLayout.salt + 9301 + index * 17) * 3);
      const root = new THREE.Group();
      root.name = definition.name;
      const bodyMaterial = woodMaterial.clone();
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, .9, 1.05), bodyMaterial);
      base.position.y = .45;
      const lid = new THREE.Group();
      lid.position.set(0, .9, -.525);
      const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, .5, 1.05), bodyMaterial);
      lidMesh.position.set(0, .25, .525);
      lid.add(lidMesh);
      const bandA = new THREE.Mesh(new THREE.BoxGeometry(1.54, .12, 1.09), bandMaterial);
      bandA.position.y = .22;
      const bandB = bandA.clone();
      bandB.position.y = .68;
      const lockMaterial = new THREE.MeshStandardMaterial({ color: 0xe8b45a, emissive: 0xe8b45a, emissiveIntensity: 1.2, roughness: .35, metalness: .55 });
      const lock = new THREE.Mesh(new THREE.BoxGeometry(.22, .26, .12), lockMaterial);
      lock.position.set(0, .82, .56);
      const interactionAnchor = new THREE.Object3D();
      interactionAnchor.name = "Chest front latch interaction anchor";
      interactionAnchor.position.set(0, .86, .72);
      const marker = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.22, 30), new THREE.MeshBasicMaterial({ color: 0xe8b45a, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = .04;
      root.add(base, lid, bandA, bandB, lock, marker, interactionAnchor);
      root.position.set(definition.x, surfaceHeightAt(definition.x, definition.z, 999), definition.z);
      root.rotation.y = definition.rotation || 0;
      root.traverse((object) => { if (object.isMesh) { object.castShadow = !isCoarse; object.receiveShadow = true; } });
      scene.add(root);
      chests.push({
        id: definition.id, sourceId: definition.sourceId || null, name: definition.name, xp: definition.xp,
        root, lid, lockMaterial, marker, interactionAnchor, opened: false, openTime: 0, phase: index * 1.71,
        powerUp: { type: powerType, amount: powerAmount }
      });
      registerAdminEntity(root, {
        id: "chest:" + definition.id, label: definition.name, type: "chest", category: "Chests"
      });
    });
  }

  function resetChests() {
    chests.forEach((chest) => {
      chest.opened = false;
      chest.networkOpened = false;
      chest.networkClaimed = false;
      chest.networkRewarded = false;
      chest.openTime = 0;
      chest.lid.rotation.x = 0;
      chest.lockMaterial.visible = true;
      chest.marker.material.opacity = .5;
    });
  }

  function segmentIntersectsChestCollider(start, end, box) {
    const cosine = Math.cos(box.rotation || 0);
    const sine = Math.sin(box.rotation || 0);
    const startDx = start.x - box.x;
    const startDz = start.z - box.z;
    const localStart = {
      x: startDx * cosine - startDz * sine,
      y: start.y,
      z: startDx * sine + startDz * cosine
    };
    const endDx = end.x - box.x;
    const endDz = end.z - box.z;
    const localEnd = {
      x: endDx * cosine - endDz * sine,
      y: end.y,
      z: endDx * sine + endDz * cosine
    };
    let near = 0;
    let far = 1;
    const clipAxis = (origin, delta, minimum, maximum) => {
      if (!Number.isFinite(minimum) && !Number.isFinite(maximum)) return true;
      if (Math.abs(delta) < .00001) return origin >= minimum && origin <= maximum;
      let first = (minimum - origin) / delta;
      let second = (maximum - origin) / delta;
      if (first > second) { const swap = first; first = second; second = swap; }
      near = Math.max(near, first);
      far = Math.min(far, second);
      return near <= far;
    };
    return clipAxis(localStart.x, localEnd.x - localStart.x, -box.hx, box.hx)
      && clipAxis(localStart.z, localEnd.z - localStart.z, -box.hz, box.hz)
      && clipAxis(localStart.y, localEnd.y - localStart.y, box.minY, box.maxY)
      && far >= .025 && near <= .975;
  }

  const CHEST_INTERACTION_RANGE = 3.5;
  const CHEST_LEVEL_TOLERANCE = 1.65;
  const CHEST_FRONT_DOT = .35;
  const CHEST_FACING_DOT = .15;

  function chestFrontVector(chest) {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(chest.root.quaternion).setY(0).normalize();
  }

  function chestInteractionStance(chest, distance) {
    const front = chestFrontVector(chest);
    const foot = chest.root.position.clone().addScaledVector(front, distance == null ? 2.15 : distance);
    foot.y = surfaceHeightAt(foot.x, foot.z, chest.root.position.y + .95);
    const latch = chest.interactionAnchor.getWorldPosition(new THREE.Vector3());
    const facing = latch.clone().sub(foot).setY(0).normalize();
    return { foot, front, facing, latch };
  }

  function chestInteractionDetails(chest, footOverride, facingOverride, groundedOverride) {
    if (!chest || !chestAvailableForLocal(chest) || !player.root) return { allowed: false, reason: "unavailable" };
    const foot = footOverride ? footOverride.clone() : player.root.position.clone();
    const origin = foot.clone().add(new THREE.Vector3(0, 1.28, 0));
    const latch = chest.interactionAnchor.getWorldPosition(new THREE.Vector3());
    const distance = origin.distanceTo(latch);
    const verticalDifference = Math.abs(foot.y - chest.root.position.y);
    const front = chestFrontVector(chest);
    const approach = foot.clone().sub(chest.root.position).setY(0);
    const approachDot = approach.lengthSq() < .001 ? -1 : approach.normalize().dot(front);
    const toLatch = latch.clone().sub(origin).setY(0);
    const facing = facingOverride
      ? facingOverride.clone().setY(0).normalize()
      : new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const facingDot = toLatch.lengthSq() < .001 ? -1 : facing.dot(toLatch.normalize());
    const ownSurface = surfaceHeightAt(foot.x, foot.z, foot.y + .95);
    const onOwnSurface = Math.abs(ownSurface - foot.y) <= .55;
    const colliderBlocked = colliders.some((box) => !box.disabled && segmentIntersectsChestCollider(origin, latch, box));
    let terrainBlocked = false;
    for (let sample = 1; sample < 12 && !terrainBlocked; sample += 1) {
      const amount = sample / 12;
      const point = origin.clone().lerp(latch, amount);
      if (terrainHeight(point.x, point.z) > point.y - .08) terrainBlocked = true;
    }
    const grounded = groundedOverride == null ? (footOverride ? onOwnSurface : player.grounded) : Boolean(groundedOverride);
    const allowed = grounded && onOwnSurface && distance <= CHEST_INTERACTION_RANGE && verticalDifference <= CHEST_LEVEL_TOLERANCE
      && approachDot >= CHEST_FRONT_DOT && facingDot >= CHEST_FACING_DOT && !colliderBlocked && !terrainBlocked;
    let reason = "ready";
    if (!grounded || !onOwnSurface) reason = "not-grounded";
    else if (distance > CHEST_INTERACTION_RANGE) reason = "too-far";
    else if (verticalDifference > CHEST_LEVEL_TOLERANCE) reason = "wrong-level";
    else if (approachDot < CHEST_FRONT_DOT) reason = "wrong-side";
    else if (facingDot < CHEST_FACING_DOT) reason = "not-facing";
    else if (colliderBlocked || terrainBlocked) reason = "blocked-line-of-sight";
    return { allowed, reason, distance, verticalDifference, approachDot, facingDot, colliderBlocked, terrainBlocked, origin, latch };
  }

  function nearestChest(maxDistance) {
    if (!player.root) return null;
    const maximum = Math.min(CHEST_INTERACTION_RANGE, maxDistance == null ? CHEST_INTERACTION_RANGE : Math.max(0, maxDistance));
    return chests
      .map((chest) => ({ chest, access: chestInteractionDetails(chest) }))
      .filter((entry) => chestAvailableForLocal(entry.chest) && entry.access.allowed && entry.access.distance <= maximum)
      .sort((a, b) => a.access.distance - b.access.distance)[0]?.chest || null;
  }

  function chestAvailableForLocal(chest) {
    return Boolean(chest && (!chest.opened || multiplayerWorldActive() && !chest.networkClaimed));
  }

  function openChest(chest) {
    if (!chest || !chestAvailableForLocal(chest) || state !== "playing" || !chestInteractionDetails(chest).allowed) return false;
    if (multiplayerWorldActive() && !applyingNetworkState) {
      if (!multiplayerActionReady()) {
        showMessage("RECONNECTING TO THE SHARED REALM", "#91a5ad");
        return false;
      }
      const sent = coopRuntime.openChest(chest.id);
      if (sent) networkStats.chestRequests += 1;
      return sent;
    }
    return grantChestReward(chest, chest.powerUp);
  }

  function grantChestReward(chest, powerOverride) {
    if (!chest) return false;
    applyChestOpenedVisual(chest);
    const oldMaximumHealth = maxHealth();
    const oldMaximumStamina = maxStamina();
    const power = powerOverride || chest.powerUp || { type: "damage", amount: 1 };
    player.relicBonuses[power.type] = clamp(relicBonus(power.type) + power.amount, 0, 500);
    grantXp(chest.xp);
    grantRunXp(Math.round(chest.xp * .72), "RELIC CHEST");
    player.health = Math.min(maxHealth(), player.health + 25 + Math.max(0, maxHealth() - oldMaximumHealth));
    player.stamina = Math.min(maxStamina(), player.stamina + Math.max(0, maxStamina() - oldMaximumStamina));
    player.shout = Math.min(100, player.shout + 20);
    spawnChestPowerDrop(chest, power);
    createShockwave(chest.root.position.clone().add(new THREE.Vector3(0, .15, 0)), 9, .8, 0xe8b45a);
    audio.discover();
    spawnCombatText(chest.root.position, "+" + chest.xp + " XP", "xp");
    spawnCombatText(player.root.position, "+25", "heal");
    const powerNames = { damage: "DAMAGE", health: "MAX HEALTH", regen: "REGENERATION", sprint: "SPRINT SPEED", stamina: "MAX STAMINA", critDamage: "CRITICAL DAMAGE" };
    showProgressionBanner("PERMANENT POWER ABSORBED", chest.name, "+" + power.amount + "% " + powerNames[power.type] + " · +" + chest.xp + " XP");
    showMessage("PERMANENT +" + power.amount + "% " + powerNames[power.type], "#f6cf72");
    saveProgression(true);
    markRunDirty(true);
    return true;
  }

  function updateChests(dt) {
    chests.forEach((chest) => {
      if (chest.openTime > 0) {
        chest.openTime = Math.min(.5, chest.openTime + dt);
        chest.lid.rotation.x = -1.9 * (chest.openTime / .5);
        return;
      }
      if (chest.opened) return;
      chest.lockMaterial.emissiveIntensity = 1.15 + Math.sin(elapsed * 2.6 + chest.phase) * .45;
    });
  }

  function spawnDragonSouls(dragon) {
    const count = dragon.boss ? 5 : 3;
    const origin = dragon.root.position.clone();
    for (let index = 0; index < count; index += 1) {
      const angle = encounterRandom() * Math.PI * 2;
      const distance = (dragon.boss ? 4 : 3) + encounterRandom() * (dragon.boss ? 5 : 6);
      const x = clamp(origin.x + Math.cos(angle) * distance, -HALF_WORLD, HALF_WORLD);
      const z = clamp(origin.z + Math.sin(angle) * distance, -HALF_WORLD, HALF_WORLD);
      const root = new THREE.Group();
      const crystalMaterial = new THREE.MeshStandardMaterial({ color: 0xf2a65e, emissive: 0xb34d1c, emissiveIntensity: 1.5, roughness: .25, metalness: .3, transparent: true, opacity: .95 });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.42, 0), crystalMaterial);
      crystal.position.y = .9;
      const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false });
      const halo = new THREE.Mesh(new THREE.TorusGeometry(.68, .028, 7, 26), haloMaterial);
      halo.position.y = .9;
      halo.rotation.x = Math.PI / 2;
      root.add(crystal, halo);
      root.position.copy(origin);
      scene.add(root);
      dragonSouls.push({
        root, crystal, halo, crystalMaterial, haloMaterial,
        from: origin.clone(), to: new THREE.Vector3(x, surfaceHeightAt(x, z, 999), z),
        fallTime: 0, fallDuration: .85 + index * .12,
        xp: Math.round(dragon.boss ? 85 + dragon.threat * 3.5 : 38 + dragon.threat * 2.2),
        claimed: false, grounded: false, phase: encounterRandom() * Math.PI * 2, life: 50
      });
    }
  }

  function removeDragonSoul(soul) {
    scene.remove(soul.root);
    soul.root.traverse((object) => { if (object.geometry) object.geometry.dispose(); if (object.material) object.material.dispose(); });
  }

  function updateDragonSouls(dt) {
    dragonSouls.forEach((soul) => {
      if (soul.claimed) return;
      soul.life -= dt;
      if (soul.life <= 0) {
        soul.claimed = true;
        removeDragonSoul(soul);
        return;
      }
      if (!soul.grounded) {
        soul.fallTime += dt;
        const t = clamp(soul.fallTime / soul.fallDuration, 0, 1);
        soul.root.position.lerpVectors(soul.from, soul.to, t);
        soul.root.position.y += Math.sin(t * Math.PI) * 3.2;
        if (t >= 1) soul.grounded = true;
      } else {
        soul.crystal.rotation.y += dt * 1.4;
        soul.halo.rotation.z += dt * .6;
        soul.crystal.position.y = .9 + Math.sin(elapsed * 2.1 + soul.phase) * .16;
        const fading = soul.life < 8 ? Math.max(.35, soul.life / 8) : 1;
        soul.crystalMaterial.emissiveIntensity = (1.35 + Math.sin(elapsed * 2.8 + soul.phase) * .3) * fading;
        soul.haloMaterial.opacity = .5 * fading;
      }
    });
    dragonSouls = dragonSouls.filter((soul) => !soul.claimed);
  }

  function nearestDragonSoul(maxDistance) {
    if (!player.root) return null;
    const maximum = maxDistance == null ? 11 : maxDistance;
    return dragonSouls
      .filter((soul) => !soul.claimed && soul.grounded && distance2D(player.root.position, soul.root.position) <= maximum)
      .sort((a, b) => distance2D(player.root.position, a.root.position) - distance2D(player.root.position, b.root.position))[0] || null;
  }

  function collectDragonSoul(soul) {
    if (!soul || soul.claimed || state !== "playing") return false;
    soul.claimed = true;
    grantXp(soul.xp);
    grantRunXp(Math.round(soul.xp * .72), "DRAGON SOUL");
    player.shout = Math.min(100, player.shout + 6);
    createShockwave(soul.root.position.clone().add(new THREE.Vector3(0, .15, 0)), 8, .6, 0xf2a65e);
    spawnCombatText(soul.root.position, "+" + soul.xp + " XP", "xp");
    audio.discover();
    showMessage("DRAGON SOUL ABSORBED  +" + soul.xp + " XP", "#edbd80");
    removeDragonSoul(soul);
    return true;
  }

  function createAtmosphere() {
    const count = Math.round((isCoarse ? 320 : 720) * (biome.particleCount || 1));
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (seeded(i * 3) - .5) * 300;
      positions[i * 3 + 1] = seeded(i * 7 + 5) * 85;
      positions[i * 3 + 2] = (seeded(i * 11 + 2) - .5) * 300;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: biome.frost, size: (isCoarse ? .25 : .18) * (biome.particleSize || 1), transparent: true, opacity: biome.particleOpacity != null ? biome.particleOpacity : .38, depthWrite: false });
    worldAsh = new THREE.Points(geometry, material);
    scene.add(worldAsh);

    const detailCount = isCoarse ? 120 : 360;
    const detailGeometry = new THREE.DodecahedronGeometry(.62, 0);
    detailGeometry.translate(0, .46, 0);
    const detailMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(biome.cliff).multiplyScalar(.72), roughness: .98, metalness: .01, envMapIntensity: .18 });
    const details = new THREE.InstancedMesh(detailGeometry, detailMaterial, detailCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < detailCount; i += 1) {
      let x = (seeded(i * 31 + 17) - .5) * 560;
      let z = (seeded(i * 47 + 9) - .5) * 560;
      if (Math.abs(x) < 10 && z > -170 && z < 230) x += x < 0 ? -13 : 13;
      const scale = .28 + seeded(i * 13 + 4) * 1.05;
      dummy.position.set(x, terrainHeight(x, z) + .02, z);
      dummy.rotation.set((seeded(i * 19) - .5) * .25, seeded(i * 23) * Math.PI * 2, (seeded(i * 29) - .5) * .22);
      dummy.scale.set(scale * (.7 + seeded(i * 7) * .8), scale, scale * (.7 + seeded(i * 11) * .75));
      dummy.updateMatrix();
      details.setMatrixAt(i, dummy.matrix);
    }
    details.receiveShadow = true;
    details.castShadow = !isCoarse;
    details.instanceMatrix.needsUpdate = true;
    scene.add(details);
    createGrassFields();
  }

  function createGrassFields() {
    if (biome.grassStrength <= .02) {
      grassField = null;
      return;
    }
    const grassDensity = BIOME_IDS.reduce((sum, id) => sum + (editorDocument.biomes[id] && editorDocument.biomes[id].grassDensity !== undefined ? editorDocument.biomes[id].grassDensity : 1), 0) / BIOME_IDS.length;
    const wanted = Math.round((isCoarse ? 1800 : 9500) * (.18 + biome.grassStrength * .82) * clamp(grassDensity, 0, 3));
    const geometry = new THREE.BufferGeometry();
    const width = .085;
    const height = .72;
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      -width,0,0, width,0,0, -width*.48,height*.58,0, 0,height,0,
      0,0,-width, 0,0,width, 0,height*.58,-width*.48, 0,height,0
    ], 3));
    geometry.setIndex([0,1,2,1,3,2,4,5,6,5,7,6]);
    geometry.computeVertexNormals();
    const foliageGlow = new THREE.Color(biome.grass).lerp(new THREE.Color(biome.frost), realm.biome === "jungle" ? .42 : .24);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 0, side: THREE.DoubleSide, vertexColors: true,
      emissive: foliageGlow, emissiveIntensity: realm.biome === "jungle" ? .58 : .36
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.windTime = { value: 0 };
      material.userData.shader = shader;
      shader.vertexShader = "uniform float windTime;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n float bladeHeight=max(position.y,0.0);\n float windPhase=windTime*1.9+instanceMatrix[3].x*0.07+instanceMatrix[3].z*0.09;\n transformed.x+=sin(windPhase)*0.13*bladeHeight;\n transformed.z+=cos(windPhase*0.83)*0.06*bladeHeight;"
      );
    };
    material.customProgramCacheKey = () => "ashenhold-wind-grass-v1";
    grassField = new THREE.InstancedMesh(geometry, material, wanted);
    const dummy = new THREE.Object3D();
    const shade = new THREE.Color();
    const grassBaseColor = new THREE.Color(biome.grass).lerp(new THREE.Color(biome.frost), realm.biome === "jungle" ? .48 : .25);
    let placed = 0;
    let attempt = 0;
    while (placed < wanted && attempt < wanted * 8) {
      const x = (seeded(attempt * 41 + 8) - .5) * 1050;
      const z = (seeded(attempt * 53 + 19) - .5) * 1050;
      const y = terrainHeight(x, z);
      const slope = Math.abs(terrainHeight(x + 1.5, z) - y) + Math.abs(terrainHeight(x, z + 1.5) - y);
      const onRoad = Math.abs(x - roadCenterAt(z)) < worldProfile.road.width + 4.5 && z > -165 && z < 225;
      attempt += 1;
      if (y > Math.min(58, biome.frostStart + 12) || slope > 1.05 || onRoad || distance2D({ x, z }, RUINS) < 48) continue;
      const scale = .62 + seeded(attempt * 17) * .78;
      dummy.position.set(x, y + .035, z);
      dummy.rotation.set(0, seeded(attempt * 29) * Math.PI * 2, 0);
      dummy.scale.set(.7 + seeded(attempt * 7) * .8, scale, 1);
      dummy.updateMatrix();
      grassField.setMatrixAt(placed, dummy.matrix);
      shade.copy(grassBaseColor).offsetHSL((seeded(attempt * 11) - .5) * .045, (seeded(attempt * 13) - .5) * .12, (seeded(attempt * 5) - .5) * .11);
      grassField.setColorAt(placed, shade);
      placed += 1;
    }
    grassField.count = placed;
    grassBaseCount = placed;
    grassBaseDensity = Math.max(.001, grassDensity);
    grassField.instanceMatrix.needsUpdate = true;
    if (grassField.instanceColor) grassField.instanceColor.needsUpdate = true;
    grassField.frustumCulled = false;
    scene.add(grassField);
  }

  function mergePropGeometry(parts) {
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];
    let offset = 0;
    const matrix = new THREE.Matrix4();
    const normalMatrix = new THREE.Matrix3();
    const vertex = new THREE.Vector3();
    const color = new THREE.Color();
    parts.forEach((part) => {
      const geometry = part.geometry;
      matrix.makeRotationFromEuler(new THREE.Euler(part.rx || 0, part.ry || 0, part.rz || 0));
      matrix.scale(new THREE.Vector3(part.sx != null ? part.sx : part.s, part.sy != null ? part.sy : part.s, part.sz != null ? part.sz : part.s));
      matrix.setPosition(part.x || 0, part.y || 0, part.z || 0);
      normalMatrix.getNormalMatrix(matrix);
      color.set(part.color);
      const positionAttribute = geometry.attributes.position;
      const normalAttribute = geometry.attributes.normal;
      for (let i = 0; i < positionAttribute.count; i += 1) {
        vertex.fromBufferAttribute(positionAttribute, i).applyMatrix4(matrix);
        positions.push(vertex.x, vertex.y, vertex.z);
        vertex.fromBufferAttribute(normalAttribute, i).applyMatrix3(normalMatrix).normalize();
        normals.push(vertex.x, vertex.y, vertex.z);
        colors.push(color.r, color.g, color.b);
      }
      if (geometry.index) for (let i = 0; i < geometry.index.count; i += 1) indices.push(geometry.index.getX(i) + offset);
      else for (let i = 0; i < positionAttribute.count; i += 1) indices.push(i + offset);
      offset += positionAttribute.count;
    });
    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    merged.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    merged.setIndex(indices);
    return merged;
  }

  function biomePropGround(x, z) {
    const y = terrainHeight(x, z);
    if (y < waterLevelAt(x, z) + .6) return null;
    const slope = Math.abs(terrainHeight(x + 1.5, z) - y) + Math.abs(terrainHeight(x, z + 1.5) - y);
    if (slope > 1.05) return null;
    if (Math.abs(x - roadCenterAt(z)) < worldProfile.road.width + 4.5 && z > -165 && z < 225) return null;
    if (distance2D({ x, z }, RUINS) < 48) return null;
    for (let i = 0; i < worldLayout.forts.length; i += 1) if (Math.hypot(x - worldLayout.forts[i][0], z - worldLayout.forts[i][1]) < 30) return null;
    for (let i = 0; i < worldLayout.routes.length; i += 1) if (Math.hypot(x - worldLayout.routes[i][0], z - worldLayout.routes[i][1]) < 30) return null;
    return y;
  }

  function biomePropMaterial(options) {
    return new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, color: 0xffffff, roughness: .92, metalness: .02, envMapIntensity: .3 }, options || {}));
  }

  function biomePropDefinitions(biomeId) {
    const cone = new THREE.ConeGeometry(1, 1, 7);
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 7);
    const sphere = new THREE.SphereGeometry(1, 7, 6);
    const dodeca = new THREE.DodecahedronGeometry(1, 0);
    const octa = new THREE.OctahedronGeometry(1, 0);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const jitterTint = (shade, roll) => shade.setRGB(1, 1, 1).offsetHSL(0, (roll - .5) * .06, (roll - .5) * .14);
    if (biomeId === "snowy") return [
      { kind: "snowPine", count: 64, geometry: mergePropGeometry([
        { geometry: cylinder, sx: .16, sy: 1.3, sz: .16, y: .6, color: 0x34291f },
        { geometry: cone, sx: 1.5, sy: 2.4, sz: 1.5, y: 2, color: 0x24402e },
        { geometry: cone, sx: 1.12, sy: 2, sz: 1.12, y: 3.4, color: 0x2c4a38 },
        { geometry: cone, sx: .74, sy: 1.7, sz: .74, y: 4.6, color: 0x9db8b2 }
      ]), material: biomePropMaterial(), tint: jitterTint },
      { kind: "iceShard", count: 36, tilt: .14, geometry: mergePropGeometry([
        { geometry: octa, sx: .55, sy: 2.6, sz: .55, y: 1.15, color: 0xd6f0f6 },
        { geometry: octa, sx: .36, sy: 1.5, sz: .36, x: .58, z: .22, y: .62, rz: -.34, color: 0xaadce9 },
        { geometry: octa, sx: .28, sy: 1.05, sz: .28, x: -.46, z: -.26, y: .45, rz: .3, color: 0xbfe8f2 }
      ]), material: biomePropMaterial({ emissive: 0xbfe8f2, emissiveIntensity: .55, roughness: .35 }), tint: jitterTint }
    ];
    if (biomeId === "jungle") return [
      { kind: "broadleaf", count: 60, geometry: mergePropGeometry([
        { geometry: cylinder, sx: .2, sy: 2.8, sz: .2, y: 1.35, color: 0x4a3826 },
        { geometry: sphere, sx: 1.75, sy: 1.35, sz: 1.75, y: 3.6, color: 0x2f6b34 },
        { geometry: sphere, sx: 1.3, sy: 1.05, sz: 1.3, x: 1.15, y: 2.9, z: .4, color: 0x3d7f3a },
        { geometry: sphere, sx: 1.1, sy: .9, sz: 1.1, x: -.95, y: 3.15, z: -.5, color: 0x275c2c }
      ]), material: biomePropMaterial({ roughness: .95 }), tint: jitterTint },
      { kind: "mossyBoulder", count: 40, tilt: .3, sink: -.12, geometry: mergePropGeometry([
        { geometry: dodeca, sx: 1.45, sy: 1, sz: 1.25, y: .5, color: 0x5a6b4c },
        { geometry: dodeca, sx: .8, sy: .58, sz: .72, x: .95, y: .32, ry: .8, color: 0x4c5f43 }
      ]), material: biomePropMaterial(), tint: (shade, roll) => shade.setRGB(1, 1, 1).offsetHSL((roll - .5) * .03, (roll - .5) * .1, (roll - .5) * .12) }
    ];
    if (biomeId === "desert") return [
      { kind: "cactus", count: 56, geometry: mergePropGeometry([
        { geometry: cylinder, sx: .4, sy: 1.25, sz: .4, y: .62, color: 0x74905c },
        { geometry: cylinder, sx: .34, sy: 1.05, sz: .34, y: 1.75, color: 0x7d9965 },
        { geometry: cylinder, sx: .28, sy: .85, sz: .28, y: 2.65, color: 0x86a26d },
        { geometry: sphere, s: .28, y: 3.08, color: 0x86a26d },
        { geometry: cylinder, sx: .16, sy: .8, sz: .16, x: .52, y: 1.9, rz: -1.15, color: 0x74905c },
        { geometry: cylinder, sx: .14, sy: .6, sz: .14, x: -.44, y: 1.35, rz: 1.2, color: 0x7d9965 }
      ]), material: biomePropMaterial(), tint: jitterTint },
      { kind: "obelisk", count: 32, tilt: .05, geometry: mergePropGeometry([
        { geometry: box, sx: 1.15, sy: .55, sz: 1.15, y: .27, color: 0xb9925e },
        { geometry: new THREE.ConeGeometry(1, 1, 4), sx: .52, sy: 4.4, sz: .52, y: 2.75, ry: Math.PI / 4, color: 0xd8b083 }
      ]), material: biomePropMaterial(), tint: jitterTint }
    ];
    if (biomeId === "shore") {
      const frond = new THREE.PlaneGeometry(1.7, .5);
      frond.translate(.85, 0, 0);
      frond.rotateX(-.55);
      frond.rotateZ(-.42);
      const frondParts = [];
      for (let i = 0; i < 6; i += 1) frondParts.push({ geometry: frond, ry: i * Math.PI / 3 + (i % 2) * .28, x: .56, y: 2.6 + (i % 2) * .14, color: i % 2 ? 0x3f7d44 : 0x35713c });
      return [
        { kind: "palm", count: 52, geometry: mergePropGeometry([
          { geometry: cylinder, sx: .13, sy: 2.7, sz: .13, x: .28, y: 1.32, rz: -.21, color: 0x6f6049 }
        ].concat(frondParts)), material: biomePropMaterial({ side: THREE.DoubleSide, roughness: .9 }), tint: jitterTint },
        { kind: "driftwood", count: 44, tilt: .55, geometry: mergePropGeometry([
          { geometry: cylinder, sx: .15, sy: 1.2, sz: .15, y: .45, color: 0x8a8078 },
          { geometry: cylinder, sx: .1, sy: .7, sz: .1, x: .18, y: .9, rz: -.5, color: 0x7b726b }
        ]), material: biomePropMaterial(), tint: jitterTint }
      ];
    }
    if (biomeId === "mountains") return [
      { kind: "darkPine", count: 68, geometry: mergePropGeometry([
        { geometry: cylinder, sx: .16, sy: 1.3, sz: .16, y: .6, color: 0x2c231c },
        { geometry: cone, sx: 1.5, sy: 2.4, sz: 1.5, y: 2, color: 0x1d2f24 },
        { geometry: cone, sx: 1.12, sy: 2, sz: 1.12, y: 3.4, color: 0x24382b },
        { geometry: cone, sx: .74, sy: 1.7, sz: .74, y: 4.6, color: 0x2a4030 }
      ]), material: biomePropMaterial(), tint: jitterTint },
      { kind: "cairn", count: 32, tilt: .12, geometry: mergePropGeometry([
        { geometry: dodeca, sx: 1, sy: .55, sz: .9, y: .3, color: 0x6b7378 },
        { geometry: dodeca, sx: .74, sy: .42, sz: .68, y: .8, ry: .6, color: 0x7d858a },
        { geometry: dodeca, sx: .5, sy: .3, sz: .46, y: 1.16, ry: 1.2, color: 0x5d6469 },
        { geometry: dodeca, sx: .3, sy: .2, sz: .28, y: 1.42, ry: .3, color: 0x8a9296 }
      ]), material: biomePropMaterial(), tint: jitterTint }
    ];
    return [
      { kind: "glowCrystal", count: 52, tilt: .12, geometry: mergePropGeometry([
        { geometry: octa, sx: .5, sy: 1.9, sz: .5, y: .85, color: 0xffffff },
        { geometry: octa, sx: .34, sy: 1.15, sz: .34, x: .52, z: .24, y: .48, rz: -.32, color: 0xdcd8ff },
        { geometry: octa, sx: .26, sy: .8, sz: .26, x: -.42, z: -.3, y: .36, rz: .28, color: 0xd8fff6 }
      ]), material: new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }), tint: (shade, roll) => shade.set(roll > .42 ? 0x9a8cff : 0x6ce0d8).offsetHSL(0, 0, (roll - .5) * .16) },
      { kind: "rimRock", count: 44, tilt: .4, sink: -.1, geometry: mergePropGeometry([
        { geometry: dodeca, sx: 1.5, sy: .8, sz: 1.1, y: .35, color: 0x3a3d52 },
        { geometry: octa, sx: .9, sy: .62, sz: .8, x: 1.05, y: .3, ry: .7, color: 0x2e3044 }
      ]), material: biomePropMaterial({ roughness: 1 }), tint: jitterTint }
    ];
  }

  function placePropSet(definition, setIndex, biomeId) {
    const density = editorDocument.biomes[biomeId] && editorDocument.biomes[biomeId].propDensity !== undefined ? editorDocument.biomes[biomeId].propDensity : 1;
    const wanted = Math.round((isCoarse ? definition.count / 2 : definition.count) * clamp(density, 0, 3));
    const mesh = new THREE.InstancedMesh(definition.geometry, definition.material, wanted);
    const dummy = new THREE.Object3D();
    const shade = new THREE.Color();
    const zone = CONTINENT_ZONE_BY_ID.get(biomeId);
    const salt = 97000 + BIOME_IDS.indexOf(biomeId) * 4000 + setIndex * 500;
    let placed = 0;
    let attempt = 0;
    while (placed < wanted && attempt < wanted * 9) {
      const x = lerp(zone.bounds.minX + 28, zone.bounds.maxX - 28, seeded(salt + attempt * 3 + 1));
      const z = lerp(zone.bounds.minZ + 28, zone.bounds.maxZ - 28, seeded(salt + attempt * 3 + 2));
      if (biomeIdAt(x, z) !== biomeId) { attempt += 1; continue; }
      if (TREE_PROP_KINDS.has(definition.kind) && !biomeAllowsTreesAt(x, z)) { attempt += 1; continue; }
      const y = biomePropGround(x, z);
      attempt += 1;
      if (y === null) continue;
      const scale = .8 + seeded(salt + attempt * 5 + 3) * .65;
      dummy.position.set(x, y + (definition.sink || 0), z);
      dummy.rotation.set(
        (seeded(salt + attempt * 7 + 4) - .5) * (definition.tilt || .08),
        seeded(salt + attempt * 11 + 5) * Math.PI * 2,
        (seeded(salt + attempt * 13 + 6) - .5) * (definition.tilt || .08)
      );
      dummy.scale.set(scale * (.88 + seeded(salt + attempt * 17 + 7) * .3), scale * (.85 + seeded(salt + attempt * 19 + 8) * .45), scale * (.88 + seeded(salt + attempt * 23 + 9) * .3));
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      if (definition.tint) {
        definition.tint(shade, seeded(salt + attempt * 29 + 10), placed);
        mesh.setColorAt(placed, shade);
      }
      placed += 1;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = !isCoarse;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    biomePropMeshes.push({ biomeId, kind: definition.kind, mesh, baseCount: placed, baseDensity: Math.max(.001, density), capacity: mesh.instanceMatrix.count });
    if (TREE_PROP_KINDS.has(definition.kind)) recordTreePopulation(biomeId, placed, "biome-props");
    return placed;
  }

  function createBiomeProps() {
    biomePropMeshes = [];
    const byKind = {};
    const byBiome = {};
    let total = 0;
    BIOME_IDS.forEach((biomeId) => {
      const definitions = biomePropDefinitions(biomeId);
      byBiome[biomeId] = 0;
      definitions.forEach((definition, index) => {
        if (!PROCEDURAL_TREE_GENERATION_ENABLED && TREE_PROP_KINDS.has(definition.kind)) return;
        const placed = placePropSet(definition, index, biomeId);
        byKind[definition.kind] = placed;
        byBiome[biomeId] += placed;
        total += placed;
      });
    });
    biomePropsReport = { kind: "six-biome-continent", total, byKind, byBiome };
  }

  function createWardenRunDeformer(modelRoot) {
    if (!modelRoot) return null;
    const uniforms = {
      phase: { value: 0 },
      weight: { value: 0 },
      sprint: { value: 0 }
    };
    const materials = new Set();
    modelRoot.traverse((object) => {
      if (!object.isMesh && !object.isSkinnedMesh) return;
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.filter(Boolean).forEach((material) => materials.add(material));
    });
    materials.forEach((material) => {
      const previousCompile = material.onBeforeCompile;
      material.onBeforeCompile = (shader, activeRenderer) => {
        if (previousCompile) previousCompile.call(material, shader, activeRenderer);
        shader.uniforms.uWardenRunPhase = uniforms.phase;
        shader.uniforms.uWardenRunWeight = uniforms.weight;
        shader.uniforms.uWardenSprintWeight = uniforms.sprint;
        shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
uniform float uWardenRunPhase;
uniform float uWardenRunWeight;
uniform float uWardenSprintWeight;`);
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
float wardenSide = position.x < 0.0 ? -1.0 : 1.0;
float wardenStride = sin(uWardenRunPhase) * wardenSide;
float wardenAmplitude = mix(0.42, 0.72, uWardenSprintWeight) * uWardenRunWeight;
float wardenLegMask = (1.0 - smoothstep(-0.12, 0.12, position.y)) * smoothstep(0.055, 0.24, abs(position.x));
float wardenLegAngle = wardenStride * wardenAmplitude;
float wardenLegCos = cos(wardenLegAngle);
float wardenLegSin = sin(wardenLegAngle);
vec3 wardenLegPosition = transformed;
float wardenLegY = wardenLegPosition.y + 0.08;
float wardenLegZ = wardenLegPosition.z;
wardenLegPosition.y = -0.08 + wardenLegY * wardenLegCos - wardenLegZ * wardenLegSin;
wardenLegPosition.z = wardenLegY * wardenLegSin + wardenLegZ * wardenLegCos;
transformed = mix(transformed, wardenLegPosition, wardenLegMask);
float wardenKneeMask = (1.0 - smoothstep(-0.62, -0.42, position.y)) * smoothstep(0.055, 0.22, abs(position.x));
float wardenKneeAngle = -wardenStride * mix(0.14, 0.3, uWardenSprintWeight) * uWardenRunWeight;
float wardenKneeCos = cos(wardenKneeAngle);
float wardenKneeSin = sin(wardenKneeAngle);
vec3 wardenKneePosition = transformed;
float wardenKneeY = wardenKneePosition.y + 0.52;
float wardenKneeZ = wardenKneePosition.z;
wardenKneePosition.y = -0.52 + wardenKneeY * wardenKneeCos - wardenKneeZ * wardenKneeSin;
wardenKneePosition.z = wardenKneeY * wardenKneeSin + wardenKneeZ * wardenKneeCos;
transformed = mix(transformed, wardenKneePosition, wardenKneeMask);
float wardenArmMask = smoothstep(0.08, 0.28, position.y) * smoothstep(0.22, 0.46, abs(position.x));
float wardenArmAngle = -wardenStride * mix(0.5, 0.82, uWardenSprintWeight) * uWardenRunWeight;
float wardenArmCos = cos(wardenArmAngle);
float wardenArmSin = sin(wardenArmAngle);
vec3 wardenArmPosition = transformed;
float wardenArmY = wardenArmPosition.y - 0.38;
float wardenArmZ = wardenArmPosition.z;
wardenArmPosition.y = 0.38 + wardenArmY * wardenArmCos - wardenArmZ * wardenArmSin;
wardenArmPosition.z = wardenArmY * wardenArmSin + wardenArmZ * wardenArmCos;
transformed = mix(transformed, wardenArmPosition, wardenArmMask);`);
      };
      material.customProgramCacheKey = () => "ashenhold-hooded-assassin-run-v1";
      material.needsUpdate = true;
    });
    return { uniforms, blend: 0, materials: materials.size };
  }

  function createPlayer() {
    const root = new THREE.Group();
    const armor = new THREE.MeshStandardMaterial({ color: 0x232b30, metalness: .72, roughness: .42 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x2d211c, roughness: .9 });
    const fur = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 1 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8c2c3, metalness: .92, roughness: .25 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(.56, .72, 1.5, 8), armor);
    body.position.y = 1.62;
    body.castShadow = true;
    root.add(body);
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(.82, .7, .38, 8), fur);
    shoulder.position.y = 2.22;
    shoulder.castShadow = true;
    root.add(shoulder);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.39, 12, 10), armor);
    head.position.y = 2.63;
    head.castShadow = true;
    root.add(head);
    const helmet = new THREE.Mesh(new THREE.ConeGeometry(.46, .62, 8), armor);
    helmet.position.y = 2.98;
    helmet.castShadow = true;
    root.add(helmet);

    function limb(x, y, material, length, radius) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * .82, radius, length, 7), material);
      mesh.position.y = -length / 2;
      mesh.castShadow = true;
      pivot.add(mesh);
      root.add(pivot);
      return pivot;
    }
    const leftLeg = limb(-.32, 1.03, leather, 1.1, .18);
    const rightLeg = limb(.32, 1.03, leather, 1.1, .18);
    const leftArm = limb(-.74, 2.18, armor, 1.15, .16);
    const rightArm = limb(.74, 2.18, armor, 1.15, .16);

    const weaponMount = new THREE.Group();
    rightArm.add(weaponMount);
    const weaponModels = {};
    const sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.65, .07), steel);
    blade.position.y = -1.25;
    blade.castShadow = true;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(.62, .08, .12), steel);
    guard.position.y = -.42;
    sword.add(blade, guard);
    sword.rotation.z = -.12;
    weaponModels.blade = sword;

    function weaponSegment(start, end, radius, material) {
      const direction = end.clone().sub(start);
      const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 7), material);
      segment.position.copy(start).add(end).multiplyScalar(.5);
      segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      return segment;
    }

    const bow = new THREE.Group();
    const bowWood = new THREE.MeshStandardMaterial({ color: 0x6e402a, roughness: .72, metalness: .08 });
    const bowPoints = [
      new THREE.Vector3(-.03, -.35, 0), new THREE.Vector3(.25, -.66, 0), new THREE.Vector3(.34, -1.08, 0),
      new THREE.Vector3(.25, -1.52, 0), new THREE.Vector3(-.03, -1.84, 0)
    ];
    for (let i = 0; i < bowPoints.length - 1; i += 1) bow.add(weaponSegment(bowPoints[i], bowPoints[i + 1], .035, bowWood));
    const bowStringGeometry = new THREE.BufferGeometry().setFromPoints([bowPoints[0], new THREE.Vector3(.1, -1.08, .18), bowPoints[4]]);
    bow.add(new THREE.Line(bowStringGeometry, new THREE.LineBasicMaterial({ color: 0xd8e2df, transparent: true, opacity: .8 })));
    const arrow = weaponSegment(new THREE.Vector3(.1, -.35, .18), new THREE.Vector3(.1, -1.85, .18), .018, steel);
    bow.add(arrow);
    bow.rotation.z = -.2;
    weaponModels.bow = bow;

    const axe = new THREE.Group();
    const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(.065, .09, 1.85, 8), leather);
    axeHandle.position.y = -1.25;
    const axeHead = new THREE.Mesh(new THREE.ConeGeometry(.46, .92, 4), steel);
    axeHead.position.set(-.03, -2.08, 0);
    axeHead.rotation.z = Math.PI / 2;
    axeHead.scale.z = .42;
    const axePommel = new THREE.Mesh(new THREE.DodecahedronGeometry(.12, 0), steel);
    axePommel.position.y = -.3;
    axe.add(axeHandle, axeHead, axePommel);
    axe.rotation.z = -.1;
    weaponModels.axe = axe;

    const staff = new THREE.Group();
    const staffWood = new THREE.MeshStandardMaterial({ color: 0x302432, roughness: .68, metalness: .18 });
    const arcane = new THREE.MeshStandardMaterial({ color: 0xc6a2f0, emissive: 0x5e258b, emissiveIntensity: 1.25, roughness: .22, metalness: .24 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.055, .075, 2.15, 8), staffWood);
    shaft.position.y = -1.34;
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.28, 0), arcane);
    crystal.position.y = -.18;
    const crown = new THREE.Mesh(new THREE.TorusGeometry(.27, .025, 7, 22), arcane);
    crown.position.y = -.2;
    staff.add(shaft, crystal, crown);
    weaponModels.staff = staff;

    WEAPON_IDS.forEach((id) => { weaponModels[id].visible = id === player.activeWeapon; weaponMount.add(weaponModels[id]); });

    const capeGeometry = new THREE.BufferGeometry();
    capeGeometry.setAttribute("position", new THREE.Float32BufferAttribute([-.58,2.18,.48,.58,2.18,.48,.46,.55,.61,-.46,.55,.61],3));
    capeGeometry.setIndex([0,2,1,0,3,2]);
    capeGeometry.computeVertexNormals();
    const cape = new THREE.Mesh(capeGeometry, new THREE.MeshStandardMaterial({ color: 0x151719, roughness: 1, side: THREE.DoubleSide }));
    root.add(cape);

    let modelRoot = null;
    let modelMixer = null;
    const modelActions = {};
    let modelSword = null;
    const source = visualAssets.models && visualAssets.models.warden;
    if (source) {
      modelRoot = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(source.scene) : source.scene.clone(true);
      modelRoot.name = "Hooded Shadow Assassin Warden";
      modelRoot.scale.setScalar(WARDEN_MODEL_SCALE);
      modelRoot.position.y = source.animations && source.animations.length ? 0 : WARDEN_MODEL_Y_OFFSET;
      modelRoot.rotation.y = Math.PI;
      modelSword = modelRoot.getObjectByName("Warrior_Sword");
      if (modelSword) modelSword.visible = false;
      modelRoot.traverse((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        object.castShadow = !isCoarse;
        object.receiveShadow = true;
        if (object.material) {
          object.material = object.material.clone();
          object.material.roughness = Math.max(.48, object.material.roughness == null ? .72 : object.material.roughness);
          object.material.metalness = Math.max(.12, object.material.metalness || 0);
          object.material.envMapIntensity = .42;
        }
      });
      root.add(modelRoot);
      modelMixer = new THREE.AnimationMixer(modelRoot);
      const clip = (pattern, fallback) => source.animations.find((item) => pattern.test(item.name)) || fallback;
      const idleClip = clip(/^Idle_Weapon$/i, clip(/^Idle$/i));
      const clips = {
        idle: idleClip,
        walk: clip(/^Walk$/i, idleClip),
        run: clip(/^Run_Weapon$/i, clip(/^Run$/i, idleClip)),
        attack1: clip(/^Sword_Attack$/i, clip(/Attack/i, idleClip)),
        attack2: clip(/^Sword_Attack2$/i, clip(/Attack/i, idleClip)),
        hit: clip(/RecieveHit|ReceiveHit/i, idleClip),
        roll: clip(/^Roll$/i, clip(/^Run$/i, idleClip)),
        death: clip(/^Death$/i, idleClip)
      };
      Object.keys(clips).forEach((id) => { if (clips[id]) modelActions[id] = modelMixer.clipAction(clips[id]); });
      body.visible = false;
      shoulder.visible = false;
      head.visible = false;
      helmet.visible = false;
      cape.visible = false;
      [leftLeg, rightLeg, leftArm, rightArm].forEach((part) => { if (part.children[0]) part.children[0].visible = false; });
    }

    root.traverse((object) => { if (object.isMesh) { object.castShadow = !isCoarse; object.receiveShadow = true; } });
    scene.add(root);
    player.root = root;
    player.body = body;
    player.shoulder = shoulder;
    player.leftLeg = leftLeg;
    player.rightLeg = rightLeg;
    player.leftArm = leftArm;
    player.rightArm = rightArm;
    player.sword = sword;
    player.weaponModels = weaponModels;
    player.weaponMount = weaponMount;
    player.cape = cape;
    player.modelRoot = modelRoot;
    player.modelMixer = modelMixer;
    player.modelHasClips = Boolean(source && source.animations && source.animations.length);
    player.modelRunDeformer = modelRoot && !player.modelHasClips ? createWardenRunDeformer(modelRoot) : null;
    player.modelActions = modelActions;
    player.modelState = "";
    player.modelSword = modelSword;
    // GLTFLoader sanitizes node names (dots stripped: "UpperArm.L" -> "UpperArmL"), so try both.
    const bone = (name) => modelRoot && (modelRoot.getObjectByName(name) || modelRoot.getObjectByName(name.replace(/\./g, "")));
    player.sprintBones = modelRoot ? {
      torso: bone("Torso"),
      abdomen: bone("Abdomen"),
      neck: bone("Neck"),
      head: bone("Head"),
      shoulderL: bone("Shoulder.L"),
      shoulderR: bone("Shoulder.R"),
      upperArmL: bone("UpperArm.L"),
      upperArmR: bone("UpperArm.R"),
      lowerArmL: bone("LowerArm.L"),
      lowerArmR: bone("LowerArm.R"),
      hips: bone("Hips"),
      upperLegL: bone("UpperLeg.L"),
      upperLegR: bone("UpperLeg.R"),
      lowerLegL: bone("LowerLeg.L"),
      lowerLegR: bone("LowerLeg.R"),
      footL: bone("Foot.L"),
      footR: bone("Foot.R")
    } : null;
    player.sprintPoseSnapshot = null;
    player.sprintPoseApplied = false;
    player.sprintPoseWeight = 0;
    setPlayerModelAction("idle", true);
    equipWeapon(player.activeWeapon, true);
  }

  function setPlayerModelAction(nextState, force) {
    if (!player.modelMixer) return;
    if (!player.modelActions[nextState]) {
      player.modelState = nextState;
      return;
    }
    if (!force && player.modelState === nextState) return;
    const previous = player.modelActions[player.modelState];
    const next = player.modelActions[nextState];
    if (previous && previous !== next) previous.fadeOut(nextState === "death" ? .08 : .14);
    next.reset().setEffectiveWeight(1);
    if (/^attack|hit|roll|death/.test(nextState)) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      if (/^attack/.test(nextState)) next.setDuration(Math.max(.28, player.attackDuration));
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
      next.setEffectiveTimeScale(nextState === "run" ? (player.superSprinting ? 1.25 : 1.15) : 1);
    }
    next.fadeIn(nextState === "death" ? .04 : .14).play();
    player.modelState = nextState;
  }

  function equipWeapon(id, silent) {
    if (!WEAPONS[id]) return false;
    if (!silent && state === "playing" && player.attackTime > 0) {
      player.queuedWeapon = id;
      return false;
    }
    const changed = player.activeWeapon !== id;
    player.activeWeapon = id;
    if (!silent && changed && hasSkill("swift_change")) player.swapEmpowered = true;
    if (player.weaponModels) WEAPON_IDS.forEach((weaponId) => {
      if (player.weaponModels[weaponId]) player.weaponModels[weaponId].visible = weaponId === id;
    });
    const weapon = WEAPONS[id];
    const color = "#" + weapon.color.toString(16).padStart(6, "0");
    if (ui.weaponHudName) ui.weaponHudName.style.color = color;
    if (!silent) {
      audio.tone(210, 390, .13, "triangle", .018);
      showMessage(weapon.name + " EQUIPPED", color);
    }
    saveProgression();
    updateProgressionUI();
    return true;
  }

  function cycleWeapon() {
    const index = WEAPON_IDS.indexOf(player.activeWeapon);
    return equipWeapon(WEAPON_IDS[(index + 1) % WEAPON_IDS.length]);
  }

  const dragonMaterial = new THREE.MeshStandardMaterial({ color: 0x182126, roughness: .5, metalness: .45 });
  const dragonDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x0d1215, roughness: .58, metalness: .35 });
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0x421713, emissive: 0x160302, emissiveIntensity: .3,
    roughness: .78, metalness: .04, side: THREE.DoubleSide, transparent: true, opacity: .92
  });
  const wingBoneMaterial = new THREE.MeshStandardMaterial({ color: 0x11191d, roughness: .6, metalness: .38 });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a24 });

  function createWingGeometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      0,0,0,
      2.55,.72,-.62,
      7.15,.2,-1.5,
      5.65,-.18,.34,
      6.3,-.34,2.55,
      2.28,-.12,2.08
    ], 3));
    geometry.setIndex([0,1,5,1,2,3,1,3,5,3,4,5]);
    geometry.computeVertexNormals();
    return geometry;
  }

  function boneBetween(start, end, radius, material) {
    const direction = end.clone().sub(start);
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * .78, direction.length(), 7), material);
    bone.position.copy(start).add(end).multiplyScalar(.5);
    bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    bone.castShadow = !isCoarse;
    return bone;
  }

  function addWingBones(wing, mirror) {
    const m = mirror ? -1 : 1;
    const root = new THREE.Vector3(0, 0, 0);
    const elbow = new THREE.Vector3(2.55 * m, .72, -.62);
    const tip = new THREE.Vector3(7.15 * m, .2, -1.5);
    const rear = new THREE.Vector3(6.3 * m, -.34, 2.55);
    const inner = new THREE.Vector3(2.28 * m, -.12, 2.08);
    wing.add(
      boneBetween(root, elbow, .13, wingBoneMaterial),
      boneBetween(elbow, tip, .095, wingBoneMaterial),
      boneBetween(elbow, rear, .075, wingBoneMaterial),
      boneBetween(root, inner, .09, wingBoneMaterial)
    );
    const thumb = new THREE.Mesh(new THREE.ConeGeometry(.1, .72, 7), dragonDarkMaterial);
    thumb.position.set(1.15 * m, .48, -.48);
    thumb.rotation.z = m * -1.02;
    thumb.rotation.x = -.38;
    wing.add(thumb);
  }

  function createDragon(name, x, z, boss, networkId) {
    const root = new THREE.Group();
    root.name = name;
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), boss ? dragonDarkMaterial : dragonMaterial);
    body.scale.set(1.05, .72, 2.35);
    body.castShadow = !isCoarse;
    root.add(body);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), dragonMaterial);
    chest.scale.set(1.28, .88, 1.15);
    chest.position.z = -1.25;
    chest.castShadow = !isCoarse;
    root.add(chest);

    for (let i = 0; i < 3; i += 1) {
      const neck = new THREE.Mesh(new THREE.SphereGeometry(.66 - i * .08, 10, 8), dragonMaterial);
      neck.scale.z = 1.35;
      neck.position.set(0, .1 + i * .08, -2.15 - i * .72);
      neck.castShadow = !isCoarse;
      root.add(neck);
    }
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(.72, 0), dragonDarkMaterial);
    head.scale.set(1, .72, 1.38);
    head.position.set(0, .26, -4.17);
    head.castShadow = !isCoarse;
    root.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(.78, .42, 1.15), dragonMaterial);
    snout.position.set(0, .08, -4.95);
    snout.castShadow = !isCoarse;
    root.add(snout);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(.72, .2, 1.02), dragonDarkMaterial);
    jaw.position.set(0, -.25, -4.9);
    jaw.rotation.x = -.08;
    jaw.castShadow = !isCoarse;
    root.add(jaw);
    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.07, 7, 6), eyeMaterial);
      eye.position.set(side * .46, .4, -4.62);
      root.add(eye);
      const brow = new THREE.Mesh(new THREE.ConeGeometry(.13, .62, 6), dragonDarkMaterial);
      brow.position.set(side * .43, .5, -4.57);
      brow.rotation.z = side * 1.25;
      brow.rotation.x = -.18;
      root.add(brow);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(.13, 1.2, 7), dragonDarkMaterial);
      horn.position.set(side * .43, .72, -3.92);
      horn.rotation.x = Math.PI / 2.55;
      horn.rotation.z = side * .15;
      root.add(horn);
      for (let toothIndex = 0; toothIndex < 3; toothIndex += 1) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(.035, .19, 5), new THREE.MeshStandardMaterial({ color: 0xb9aea0, roughness: .9 }));
        tooth.position.set(side * (.16 + toothIndex * .1), -.27, -4.58 - toothIndex * .25);
        tooth.rotation.z = Math.PI;
        root.add(tooth);
      }
    });

    const wingGeometry = createWingGeometry();
    const leftWing = new THREE.Group();
    leftWing.position.set(.55, .35, -.5);
    const leftMembrane = new THREE.Mesh(wingGeometry, wingMaterial);
    leftMembrane.castShadow = !isCoarse;
    leftWing.add(leftMembrane);
    addWingBones(leftWing, false);
    root.add(leftWing);
    const rightWing = new THREE.Group();
    rightWing.position.set(-.55, .35, -.5);
    const rightMembrane = new THREE.Mesh(wingGeometry, wingMaterial);
    rightMembrane.scale.x = -1;
    rightMembrane.castShadow = !isCoarse;
    rightWing.add(rightMembrane);
    addWingBones(rightWing, true);
    root.add(rightWing);

    for (let i = 0; i < 6; i += 1) {
      const tail = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 6), dragonDarkMaterial);
      tail.scale.set(.55 - i * .07, .42 - i * .052, 1.05);
      tail.position.set(Math.sin(i * .42) * .28, -.05 - i * .045, 2.35 + i * 1.15);
      tail.castShadow = !isCoarse;
      root.add(tail);
    }

    for (let i = 0; i < 6; i += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(.16 + (i < 3 ? .07 : 0), .72, 6), dragonDarkMaterial);
      spike.position.set(0, .85, -1.9 + i * .78);
      spike.rotation.x = -.12;
      root.add(spike);
    }

    [-1, 1].forEach((side) => {
      const thighStart = new THREE.Vector3(side * .64, -.38, .35);
      const knee = new THREE.Vector3(side * 1.05, -1.14, .72);
      const ankle = new THREE.Vector3(side * .92, -1.82, .1);
      root.add(
        boneBetween(thighStart, knee, .23, dragonMaterial),
        boneBetween(knee, ankle, .15, dragonDarkMaterial)
      );
      for (let clawIndex = -1; clawIndex <= 1; clawIndex += 1) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(.055, .48, 6), dragonDarkMaterial);
        claw.position.set(side * (.9 + clawIndex * .09), -1.9, -.12 - Math.abs(clawIndex) * .08);
        claw.rotation.x = -1.18;
        root.add(claw);
      }
    });

    const scale = boss ? 1.72 : .95 + seeded(x + z) * .18;
    root.scale.setScalar(scale);
    const altitude = boss ? 42 : 15 + seeded(x * .1) * 8;
    root.position.set(x, terrainHeight(x, z) + altitude, z);
    scene.add(root);
    const dragonThreat = clamp(ambientDifficulty() + (boss ? 2.5 : 0), 1, 32);
    const dragonBaseHealth = boss ? 520 : 150;
    const dragonHealth = Math.round(dragonBaseHealth * Math.pow(1.075, dragonThreat - 1));
    const dragon = {
      networkId: networkId || null,
      name, root, leftWing, rightWing, home: new THREE.Vector3(x, 0, z),
      health: dragonHealth, maxHealth: dragonHealth, boss, threat: dragonThreat,
      damageScale: Math.pow(1.045, dragonThreat - 1),
      angle: seeded(z + x) * Math.PI * 2, radius: boss ? 36 : 34 + seeded(x) * 24,
      speed: boss ? 15 : 10 + seeded(z) * 4, phase: seeded(x * z) * Math.PI * 2,
      engaged: boss, fireCooldown: 2 + seeded(x) * 3, roarCooldown: 6 + seeded(z) * 5,
      fireWindup: 0, fireTarget: null, fireTelegraph: null,
      dead: false, deathTime: 0, lastPosition: root.position.clone(), velocity: new THREE.Vector3(),
      playerVelocity: new THREE.Vector3(), lastPlayerPos: player.root ? player.root.position.clone() : new THREE.Vector3(),
      hitRadius: boss ? 7.4 : 4.7, lastDamageSource: null, lastWeaponId: null,
      kind: "dragon", rank: boss ? "THE WORLD-BURNER" : "ANCIENT DRAGON",
      xpReward: boss ? 950 : 320, healthReward: boss ? 35 : 12
    };
    applyAdminEnemyTuning(dragon, true);
    root.traverse((object) => { if (object.isMesh) object.userData.dragon = dragon; });
    dragons.push(dragon);
    return dragon;
  }

  function createEnemyLimb(root, x, y, length, radius, material) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * .82, radius, length, 7), material);
    mesh.position.y = -length / 2;
    mesh.castShadow = !isCoarse;
    pivot.add(mesh);
    root.add(pivot);
    return pivot;
  }

  function setEnemyAction(enemy, nextState, force) {
    if (!enemy) return;
    if (!enemy.mixer || !enemy.actions || !enemy.actions[nextState]) {
      enemy.animationState = nextState;
      return;
    }
    if (!force && enemy.animationState === nextState) return;
    const previous = enemy.actions[enemy.animationState];
    const next = enemy.actions[nextState];
    if (previous && previous !== next) previous.fadeOut(nextState === "death" ? .08 : .12);
    next.reset().setEffectiveWeight(1);
    if (nextState === "attack" || nextState === "hit" || nextState === "death") {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      if (nextState === "attack") next.setDuration(.72);
    } else next.setLoop(THREE.LoopRepeat, Infinity);
    next.fadeIn(.1).play();
    enemy.animationState = nextState;
  }

  function createGroundEnemy(type, x, z, difficulty, networkId) {
    const root = new THREE.Group();
    const enemyBiomeId = biomeIdAt(x, z);
    const enemyWorldProfile = WORLD_PROFILES[enemyBiomeId] || WORLD_PROFILES.jungle;
    let modelRoot = root;
    let mixer = null;
    const parts = {};
    const threat = Math.max(1, Number(difficulty) || 1);
    const tier = clamp(Math.floor(threat), 1, 8);
    const healthScale = Math.pow(1.075, threat - 1);
    const damageScale = Math.pow(1.035, threat - 1);
    const iron = new THREE.MeshStandardMaterial({ color: 0x313a3d, roughness: .58, metalness: .5, envMapIntensity: .45 });
    const bone = new THREE.MeshStandardMaterial({ color: 0x7d8178, roughness: .92, metalness: .02 });
    const ember = new THREE.MeshStandardMaterial({ color: 0x8e3d25, emissive: 0x3e0c05, emissiveIntensity: .72, roughness: .7 });
    let stats;

    let actions = {};
    let animationState = "";
    const enemyModelKey = (type === "biomeHeavy" || type === "golem" ? "biomeHeavy_" : "biomeLight_") + enemyBiomeId;
    if ((type === "biomeLight" || type === "biomeHeavy" || type === "golem") && visualAssets.models && visualAssets.models[enemyModelKey]) {
      const source = visualAssets.models[enemyModelKey];
      const profile = type === "biomeHeavy" || type === "golem" ? enemyWorldProfile.heavyEnemy : enemyWorldProfile.lightEnemy;
      const model = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(source.scene) : source.scene.clone(true);
      model.name = profile[1];
      model.scale.setScalar(profile[3] * (type === "golem" ? 1.38 : 1));
      model.rotation.y = Math.PI;
      const tint = type === "golem" ? importedStoneTint.clone().multiplyScalar(.72) : new THREE.Color(profile[4]);
      model.traverse((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        object.castShadow = !isCoarse;
        object.receiveShadow = true;
        if (object.material) {
          object.material = object.material.clone();
          if (object.material.color) object.material.color.lerp(tint, .25);
          object.material.roughness = Math.max(.58, object.material.roughness == null ? .7 : object.material.roughness);
          object.material.envMapIntensity = .38;
        }
      });
      root.add(model);
      modelRoot = model;
      mixer = new THREE.AnimationMixer(model);
      const findClip = (pattern) => source.animations.find((clip) => pattern.test(clip.name));
      const idleClip = findClip(/^Idle$/i) || source.animations[0];
      const runClip = findClip(/^Run$/i) || findClip(/^Walk$/i) || idleClip;
      const clips = {
        idle: idleClip, walk: findClip(/^Walk$/i) || runClip, run: runClip,
        attack: findClip(/Punch|Weapon/i) || idleClip, hit: findClip(/HitReact/i) || idleClip,
        death: findClip(/^Death$/i) || idleClip
      };
      Object.keys(clips).forEach((id) => { if (clips[id]) actions[id] = mixer.clipAction(clips[id]); });
      stats = type === "golem"
        ? { name: enemyBiomeId.toUpperCase() + " GUARDIAN", rank: "STRONGHOLD COLOSSUS", health: 125, damage: 16, speed: 4.4, range: 3.2, cooldown: 2.05, hitRadius: 2.3, xp: 105, heal: 14 }
        : type === "biomeHeavy"
        ? { name: profile[1], rank: profile[2], health: 118, damage: 15, speed: 5.3, range: 2.9, cooldown: 1.9, hitRadius: 1.85, xp: 108, heal: 12 }
        : { name: profile[1], rank: profile[2], health: 62, damage: 9, speed: 7.7, range: 2.5, cooldown: 1.35, hitRadius: 1.35, xp: 66, heal: 8 };
    } else if (type === "warg" && visualAssets.models && visualAssets.models.warg) {
      const source = visualAssets.models.warg;
      const model = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(source.scene) : source.scene.clone(true);
      model.scale.setScalar(.032);
      model.rotation.y = Math.PI;
      model.traverse((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        object.castShadow = !isCoarse;
        object.receiveShadow = true;
        if (object.material) {
          object.material = object.material.clone();
          if (object.material.color) object.material.color.lerp(new THREE.Color(0x8aa2a6), .38);
          object.material.roughness = .78;
          object.material.envMapIntensity = .32;
        }
      });
      root.add(model);
      modelRoot = model;
      mixer = new THREE.AnimationMixer(model);
      const findClip = (pattern) => source.animations.find((clip) => pattern.test(clip.name));
      const idleClip = findClip(/survey|idle/i) || source.animations[0];
      const walkClip = findClip(/^walk$/i) || findClip(/walk/i) || findClip(/run/i) || idleClip;
      const runClip = findClip(/^run$/i) || findClip(/run/i) || walkClip;
      const clips = { idle: idleClip, walk: walkClip, run: runClip, attack: runClip, hit: idleClip, death: idleClip };
      Object.keys(clips).forEach((id) => { if (clips[id]) actions[id] = mixer.clipAction(clips[id]); });
      stats = { name: "FROST WARG", rank: "FERAL HUNTER", health: 45, damage: 7, speed: 10.8, range: 2.35, cooldown: 1.15, hitRadius: 1.65, xp: 52, heal: 7 };
    } else if (type === "golem") {
      const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 0), darkStoneMaterial.clone());
      torso.scale.set(1.05, 1.25, .78);
      torso.position.y = 2.25;
      root.add(torso);
      const head = new THREE.Mesh(new THREE.DodecahedronGeometry(.62, 0), stoneMaterial.clone());
      head.position.y = 3.55;
      root.add(head);
      parts.leftArm = createEnemyLimb(root, -1.18, 2.9, 1.9, .36, darkStoneMaterial);
      parts.rightArm = createEnemyLimb(root, 1.18, 2.9, 1.9, .36, darkStoneMaterial);
      parts.leftLeg = createEnemyLimb(root, -.52, 1.25, 1.5, .34, stoneMaterial);
      parts.rightLeg = createEnemyLimb(root, .52, 1.25, 1.5, .34, stoneMaterial);
      [-.22,.22].forEach((side) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(.08, 7, 6), new THREE.MeshBasicMaterial({ color: 0x6fd5e6 }));
        eye.position.set(side, 3.63, -.56);
        root.add(eye);
      });
      stats = { name: "RIME GOLEM", rank: "STONEBOUND ELITE", health: 125, damage: 16, speed: 4.4, range: 3.2, cooldown: 2.05, hitRadius: 2.3, xp: 105, heal: 14 };
    } else {
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(.48, .67, 1.45, 8), iron);
      torso.position.y = 1.65;
      root.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.38, 10, 8), bone);
      head.position.y = 2.65;
      root.add(head);
      const helm = new THREE.Mesh(new THREE.ConeGeometry(.43, .55, 8), iron);
      helm.position.y = 2.99;
      root.add(helm);
      parts.leftArm = createEnemyLimb(root, -.68, 2.2, 1.16, .15, iron);
      parts.rightArm = createEnemyLimb(root, .68, 2.2, 1.16, .15, iron);
      parts.leftLeg = createEnemyLimb(root, -.3, 1.04, 1.1, .17, bone);
      parts.rightLeg = createEnemyLimb(root, .3, 1.04, 1.1, .17, bone);
      const sword = new THREE.Mesh(new THREE.BoxGeometry(.09, 1.55, .08), iron);
      sword.position.y = -1.25;
      parts.rightArm.add(sword);
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .11, 8), ember);
      shield.rotation.x = Math.PI / 2;
      shield.position.set(0, -.72, -.22);
      parts.leftArm.add(shield);
      stats = { name: "ASH DRAUGR", rank: "FALLEN WARDEN", health: 68, damage: 10, speed: 7, range: 2.5, cooldown: 1.45, hitRadius: 1.45, xp: 68, heal: 9 };
    }

    root.position.set(x, terrainHeight(x, z), z);
    root.rotation.y = encounterRandom() * Math.PI * 2;
    scene.add(root);
    const enemy = {
      networkId: networkId || null,
      name: stats.name, rank: stats.rank, kind: type, biomeId: enemyBiomeId, root, modelRoot, mixer, parts,
      health: Math.round(stats.health * healthScale), maxHealth: Math.round(stats.health * healthScale),
      damage: Math.max(1, Math.round(stats.damage * damageScale)), speed: stats.speed * (1 + Math.min(.18, threat * .012)),
      attackRange: stats.range, attackInterval: Math.max(.72, stats.cooldown - tier * .025), attackCooldown: .4 + encounterRandom(),
      attackTimer: 0, attackDelivered: false, walkCycle: encounterRandom() * 10, hitRadius: stats.hitRadius,
      xpReward: Math.round(stats.xp * (1 + tier * .08)), healthReward: stats.heal,
      boss: false, elite: type === "golem" || type === "biomeHeavy", dead: false, deathTime: 0, engaged: true,
      tier, threat, strongholdId: null, strongholdHandled: false,
      actions, animationState, lastDamageSource: null, lastWeaponId: null, hitStun: 0, phase: encounterRandom() * Math.PI * 2,
      impulse: new THREE.Vector3(), telegraph: null, bleedStacks: 0, bleedTime: 0, slowTime: 0,
      tamed: false, tameReady: false, tameProgress: 0, tameMarker: null, ai: null,
      regionalModelLoaded: modelRoot !== root && (type === "biomeLight" || type === "biomeHeavy" || type === "golem")
    };
    applyAdminEnemyTuning(enemy, true);
    setEnemyAction(enemy, "idle", true);
    root.traverse((object) => { if (object.isMesh || object.isSkinnedMesh) object.userData.dragon = enemy; });
    groundEnemies.push(enemy);
    return enemy;
  }

  function hydrateRegionalEnemyModels(biomeId) {
    const profileSet = WORLD_PROFILES[biomeId];
    if (!profileSet || !visualAssets.models) return 0;
    let hydrated = 0;
    groundEnemies.forEach((enemy) => {
      if (!enemy || enemy.dead || enemy.tamed || enemy.biomeId !== biomeId || enemy.regionalModelLoaded) return;
      if (enemy.kind !== "biomeLight" && enemy.kind !== "biomeHeavy" && enemy.kind !== "golem") return;
      const heavy = enemy.kind === "biomeHeavy" || enemy.kind === "golem";
      const source = visualAssets.models[(heavy ? "biomeHeavy_" : "biomeLight_") + biomeId];
      if (!source || !source.scene) return;
      const profile = heavy ? profileSet.heavyEnemy : profileSet.lightEnemy;
      const previousHealthRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1;
      const previousState = enemy.animationState || "idle";
      enemy.root.children.slice().forEach((child) => { if (child !== enemy.tameMarker) enemy.root.remove(child); });
      const model = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(source.scene) : source.scene.clone(true);
      model.name = profile[1];
      model.scale.setScalar(profile[3] * (enemy.kind === "golem" ? 1.38 : 1));
      model.rotation.y = Math.PI;
      const tint = enemy.kind === "golem" ? new THREE.Color(BIOMES[biomeId].stoneTint).multiplyScalar(.72) : new THREE.Color(profile[4]);
      model.traverse((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        object.castShadow = !isCoarse;
        object.receiveShadow = true;
        if (object.material) {
          object.material = object.material.clone();
          if (object.material.color) object.material.color.lerp(tint, .25);
          object.material.roughness = Math.max(.58, object.material.roughness == null ? .7 : object.material.roughness);
          object.material.envMapIntensity = .38;
        }
      });
      enemy.root.add(model);
      const mixer = new THREE.AnimationMixer(model);
      const findClip = (pattern) => source.animations.find((clip) => pattern.test(clip.name));
      const idleClip = findClip(/^Idle$/i) || source.animations[0];
      const runClip = findClip(/^Run$/i) || findClip(/^Walk$/i) || idleClip;
      const clips = {
        idle: idleClip, walk: findClip(/^Walk$/i) || runClip, run: runClip,
        attack: findClip(/Punch|Weapon/i) || idleClip, hit: findClip(/HitReact/i) || idleClip,
        death: findClip(/^Death$/i) || idleClip
      };
      const actions = {};
      Object.keys(clips).forEach((id) => { if (clips[id]) actions[id] = mixer.clipAction(clips[id]); });
      const baseStats = enemy.kind === "golem"
        ? { name: biomeId.toUpperCase() + " GUARDIAN", rank: "STRONGHOLD COLOSSUS", health: 125, damage: 16, speed: 4.4, range: 3.2, cooldown: 2.05, hitRadius: 2.3, xp: 105, heal: 14 }
        : enemy.kind === "biomeHeavy"
        ? { name: profile[1], rank: profile[2], health: 118, damage: 15, speed: 5.3, range: 2.9, cooldown: 1.9, hitRadius: 1.85, xp: 108, heal: 12 }
        : { name: profile[1], rank: profile[2], health: 62, damage: 9, speed: 7.7, range: 2.5, cooldown: 1.35, hitRadius: 1.35, xp: 66, heal: 8 };
      const healthScale = Math.pow(1.075, enemy.threat - 1);
      const damageScale = Math.pow(1.035, enemy.threat - 1);
      const stronghold = enemy.strongholdId ? strongholds.find((item) => item.id === enemy.strongholdId) : null;
      enemy.name = (stronghold ? stronghold.name + " " : "") + baseStats.name;
      enemy.rank = baseStats.rank;
      enemy.maxHealth = Math.round(baseStats.health * healthScale);
      enemy.health = clamp(Math.round(enemy.maxHealth * previousHealthRatio), 1, enemy.maxHealth);
      enemy.damage = Math.max(1, Math.round(baseStats.damage * damageScale));
      enemy.speed = baseStats.speed * (1 + Math.min(.18, enemy.threat * .012));
      enemy.attackRange = baseStats.range;
      enemy.attackInterval = Math.max(.72, baseStats.cooldown - enemy.tier * .025);
      enemy.hitRadius = baseStats.hitRadius;
      enemy.xpReward = Math.round(baseStats.xp * (1 + enemy.tier * .08));
      enemy.healthReward = baseStats.heal;
      applyAdminEnemyTuning(enemy, true);
      enemy.modelRoot = model;
      enemy.mixer = mixer;
      enemy.actions = actions;
      enemy.parts = {};
      enemy.animationState = "";
      enemy.regionalModelLoaded = true;
      enemy.root.traverse((object) => { if (object.isMesh || object.isSkinnedMesh) object.userData.dragon = enemy; });
      setEnemyAction(enemy, actions[previousState] ? previousState : "idle", true);
      hydrated += 1;
    });
    return hydrated;
  }

  function ambientDifficulty() {
    const permanentRanks = Object.keys(player.skills).reduce((sum, id) => sum + skillRank(id), 0);
    const masteryPower = WEAPON_IDS.reduce((sum, id) => sum + masteryFor(id).level - 1, 0) / 4;
    return clamp(1 + (player.level - 1) * .42 + masteryPower * .32 + permanentRanks * .055 + player.realmDepth * 1.35, 1, 32);
  }

  function nearestUnclearedStronghold() {
    if (!player.root) return null;
    let best = null;
    let bestDistance = Infinity;
    strongholds.forEach((stronghold) => {
      if (stronghold.cleared) return;
      const distance = Math.hypot(stronghold.x - player.root.position.x, stronghold.z - player.root.position.z);
      if (distance < bestDistance) { best = stronghold; bestDistance = distance; }
    });
    return best;
  }

  function updateStrongholdUI() {
    if (!ui.strongholdHud) return;
    const total = strongholds.length;
    const cleared = strongholds.filter((stronghold) => stronghold.cleared).length;
    const nearest = nearestUnclearedStronghold();
    ui.strongholdHud.classList.toggle("active", state === "playing");
    ui.strongholdNumber.textContent = cleared + " / " + total;
    ui.strongholdProgress.style.width = (total ? clamp(cleared / total * 100, 0, 100) : 0) + "%";
    ui.strongholdStatus.textContent = nearest ? "CLEAR " + nearest.name : cleared >= total ? "THE WORLD-BURNER AWAITS" : "CLEAR ALL TO FACE VHAROK";
  }

  function strongholdAliveCount(stronghold) {
    return stronghold.members.filter((enemy) => !enemy.networkExcluded && !enemy.dead && !enemy.tamed && !enemy.networkTamedBy && !enemy.strongholdHandled).length;
  }

  function allStrongholdsCleared() {
    return strongholds.length > 0 && strongholds.every((stronghold) => stronghold.cleared);
  }

  function updateStrongholdMarker(stronghold) {
    if (!stronghold || !stronghold.markerMaterial) return;
    stronghold.markerMaterial.color.setHex(stronghold.cleared ? 0x67d6b1 : 0xe26b3f);
    stronghold.markerMaterial.opacity = stronghold.cleared ? .16 : .42;
    if (stronghold.marker) stronghold.marker.scale.setScalar(stronghold.cleared ? .82 : 1);
    setCaptureFlag(stronghold, stronghold.cleared, false);
  }

  function clearStronghold(stronghold, grantRewards) {
    if (!stronghold || stronghold.cleared) return false;
    stronghold.cleared = true;
    updateStrongholdMarker(stronghold);
    setCaptureFlag(stronghold, true, grantRewards !== false);
    const reward = STRONGHOLD_BONUSES[stronghold.kind] || STRONGHOLD_BONUSES.hamlet;
    if (grantRewards !== false) {
      grantXp(reward.xp);
      if (reward.runXp) grantRunXp(reward.runXp, "STRONGHOLD");
      if (reward.weaponXp) grantWeaponXp(reward.weaponXp, player.activeWeapon);
      player.health = Math.min(maxHealth(), player.health + Math.round(maxHealth() * reward.heal));
      player.shout = Math.min(100, player.shout + reward.shout);
      if (reward.stamina) player.stamina = maxStamina();
      if (hasSkill("run_rebirth") && !player.secondWindReady) {
        player.secondWindReady = true;
        showMessage("PHOENIX OATH RESTORED", "#e7b17a");
      }
      showLocation(stronghold.name, "STRONGHOLD CLEARED");
      showProgressionBanner("STRONGHOLD CLEARED", stronghold.name, "+" + reward.xp + " WARDEN XP · " + Math.round(reward.heal * 100) + "% HEALTH RESTORED");
      spawnCombatText(new THREE.Vector3(stronghold.x, surfaceHeightAt(stronghold.x, stronghold.z, 999), stronghold.z), "+" + reward.xp + " XP", "xp");
      audio.discover();
    }
    updateStrongholdUI();
    minimapRefreshTimer = 0;
    markRunDirty(true);
    if (allStrongholdsCleared() && questStage < 3) showMessage("ALL STRONGHOLDS CLEARED · VHAROK STILL LIVES", "#9fe4cb");
    checkRunCompletion();
    return true;
  }

  function spawnChestPowerDrop(chest, power) {
    const colors = { damage: 0xef6d45, health: 0xe54f67, regen: 0x70d7ad, sprint: 0x69cde0, stamina: 0xe6c05e, critDamage: 0xc68cf0 };
    const material = new THREE.MeshStandardMaterial({ color: colors[power.type] || 0xe8b45a, emissive: colors[power.type] || 0xe8b45a, emissiveIntensity: 1.8, transparent: true, opacity: 1, roughness: .2, metalness: .3 });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(.42 + power.amount * .06, 0), material);
    mesh.position.copy(chest.root.position).add(new THREE.Vector3(0, 1.4, 0));
    scene.add(mesh);
    effects.push({ mesh, life: 1.15, maxLife: 1.15, grow: 1.9, type: "powerup", peakOpacity: 1 });
  }

  function handleStrongholdMember(enemy) {
    if (!enemy || !enemy.strongholdId || enemy.strongholdHandled) return;
    enemy.strongholdHandled = true;
    const stronghold = strongholds.find((item) => item.id === enemy.strongholdId);
    if (stronghold && strongholdAliveCount(stronghold) === 0) clearStronghold(stronghold, true);
  }

  function clearStrongholdById(id) {
    const stronghold = strongholds.find((item) => item.id === id);
    if (!stronghold || stronghold.cleared) return false;
    const living = stronghold.members.filter((enemy) => !enemy.dead && !enemy.tamed);
    living.forEach((enemy) => {
      enemy.lastDamageSource = "weapon";
      enemy.lastWeaponId = player.activeWeapon;
      killDragon(enemy);
    });
    if (!living.length) clearStronghold(stronghold, true);
    return stronghold.cleared;
  }

  function isTameableEnemy(enemy) {
    return Boolean(enemy && !enemy.networkExcluded && !enemy.dead && !enemy.tamed && !enemy.networkTamedBy && (enemy.kind === "warg" || enemy.kind === "biomeLight"));
  }

  function setEnemyTameReady(enemy, silent) {
    if (!isTameableEnemy(enemy) || enemy.tameReady) return;
    enemy.tameReady = true;
    const material = new THREE.MeshBasicMaterial({ color: 0x79e7d0, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false });
    const marker = new THREE.Mesh(new THREE.RingGeometry(Math.max(.85, enemy.hitRadius * .62), Math.max(.95, enemy.hitRadius * .72), 30), material);
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = .08;
    enemy.root.add(marker);
    enemy.tameMarker = marker;
    if (!silent) showMessage(enemy.name + "'S WILL IS BROKEN · PRESS E TO TAME", "#80ead5");
  }

  function nearestTameCandidate(maxDistance) {
    if (!player.root) return null;
    const maximum = maxDistance == null ? 11 : maxDistance;
    return groundEnemies.filter((enemy) => isTameableEnemy(enemy)
      && (enemy.tameReady || (enemy.slowTime > 0 && enemy.health / enemy.maxHealth <= .5))
      && distance2D(player.root.position, enemy.root.position) <= maximum)
      .sort((a, b) => distance2D(player.root.position, a.root.position) - distance2D(player.root.position, b.root.position))[0] || null;
  }

  function tameEnemy(enemy, silent, skipStrongholdHandling) {
    if (!enemy || enemy.dead || enemy.tamed) return false;
    if (!silent && groundEnemies.filter(isOwnedCompanion).length >= 2) {
      showMessage("YOUR BOND CAN HOLD ONLY TWO COMPANIONS", "#91a5ad");
      return false;
    }
    if (multiplayerWorldActive() && !applyingNetworkState) {
      if (!multiplayerActionReady()) {
        showMessage("RECONNECTING TO THE SHARED REALM", "#91a5ad");
        return false;
      }
      ensureStableNetworkIds();
      const sent = coopRuntime.tame(enemy.networkId);
      if (sent) networkStats.tameRequests += 1;
      return sent;
    }
    enemy.tamed = true;
    enemy.tameReady = false;
    enemy.engaged = false;
    enemy.camp = null;
    enemy.attackTimer = 0;
    enemy.attackCooldown = .4;
    enemy.bleedTime = 0;
    enemy.bleedStacks = 0;
    enemy.slowTime = 0;
    enemy.health = Math.max(enemy.health, Math.round(enemy.maxHealth * .6));
    clearEnemyTelegraph(enemy);
    if (!enemy.tameMarker) {
      const material = new THREE.MeshBasicMaterial({ color: 0x79e7d0, transparent: true, opacity: .48, side: THREE.DoubleSide, depthWrite: false });
      enemy.tameMarker = new THREE.Mesh(new THREE.RingGeometry(Math.max(.85, enemy.hitRadius * .62), Math.max(.95, enemy.hitRadius * .72), 30), material);
      enemy.tameMarker.rotation.x = -Math.PI / 2;
      enemy.tameMarker.position.y = .08;
      enemy.root.add(enemy.tameMarker);
    } else {
      enemy.tameMarker.material.color.setHex(0x79e7d0);
      enemy.tameMarker.material.opacity = .48;
    }
    enemy.originalName = enemy.originalName || enemy.name;
    enemy.name = "BONDED " + enemy.originalName;
    if (!skipStrongholdHandling) handleStrongholdMember(enemy);
    if (lockedTarget === enemy) lockedTarget = null;
    if (nearestTarget === enemy) nearestTarget = null;
    if (!silent) {
      grantRunXp(35, "BEAST BOND");
      showProgressionBanner("ENEMY TAMED", enemy.name, "Bonded companions fight beside you and empower your sprint");
      audio.discover();
      markRunDirty(true);
    }
    return true;
  }

  function bondedPaceBonus() {
    return Math.min(.45, groundEnemies.filter(isOwnedCompanion)
      .reduce((sum, enemy) => sum + (enemy.kind === "warg" ? .3 : .16), 0));
  }

  function updateTamedEnemy(enemy, dt) {
    clearEnemyTelegraph(enemy);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
    const hostiles = allEnemies().filter((target) => !target.dead && distance2D(target.root.position, enemy.root.position) < 28)
      .sort((a, b) => distance2D(a.root.position, enemy.root.position) - distance2D(b.root.position, enemy.root.position));
    const target = hostiles[0] || null;
    const playerDistance = distance2D(enemy.root.position, player.root.position);
    if (!target && playerDistance > 55) {
      const yaw = player.root.rotation.y;
      const x = player.root.position.x + Math.sin(yaw) * 3;
      const z = player.root.position.z + Math.cos(yaw) * 3;
      if (canPlayerOccupy(x, z, enemy.hitRadius * .4, player.root.position.y)) enemy.root.position.set(x, surfaceHeightAt(x, z, player.root.position.y + 1), z);
    }
    const goal = target ? target.root.position : player.root.position.clone().add(new THREE.Vector3(Math.sin(player.root.rotation.y) * 3.5, 0, Math.cos(player.root.rotation.y) * 3.5));
    const dx = goal.x - enemy.root.position.x;
    const dz = goal.z - enemy.root.position.z;
    const distance = Math.hypot(dx, dz);
    const stopDistance = target ? enemy.attackRange : 3.2;
    let moving = false;
    if (distance > stopDistance && distance > .01) {
      const direction = new THREE.Vector3(dx / distance, 0, dz / distance);
      const speed = enemy.speed * (target ? .95 : 1.08);
      const nextX = enemy.root.position.x + direction.x * speed * dt;
      const nextZ = enemy.root.position.z + direction.z * speed * dt;
      if (!hitsCollider(nextX, nextZ, enemy.hitRadius * .4, enemy.root.position.y, enemy.root.position.y + 3.6)) {
        enemy.root.position.x = nextX;
        enemy.root.position.z = nextZ;
      }
      enemy.root.rotation.y = rotateToward(enemy.root.rotation.y, Math.atan2(-direction.x, -direction.z), dt * 9);
      enemy.walkCycle += dt * enemy.speed * 1.8;
      moving = true;
    } else if (target && enemy.attackCooldown <= 0) {
      enemy.attackCooldown = enemy.attackInterval;
      enemy.attackTimer = .5;
      enemy.root.rotation.y = Math.atan2(-(target.root.position.x - enemy.root.position.x), -(target.root.position.z - enemy.root.position.z));
      damageDragon(target, Math.max(4, Math.round(enemy.damage * .72)), false, "companion", enemy.kind === "warg" ? "blade" : "staff");
      createShockwave(target.root.position.clone(), 2.2, .16, 0x79e7d0);
    }
    enemy.root.position.y = surfaceHeightAt(enemy.root.position.x, enemy.root.position.z, enemy.root.position.y + 1);
    animateGroundEnemy(enemy, dt, moving);
  }

  function disposeGroundEnemy(enemy) {
    clearEnemyTelegraph(enemy);
    if (enemy.tameMarker) {
      if (enemy.tameMarker.parent) enemy.tameMarker.parent.remove(enemy.tameMarker);
      enemy.tameMarker.geometry.dispose();
      enemy.tameMarker.material.dispose();
      enemy.tameMarker = null;
    }
    if (enemy.mixer) {
      enemy.mixer.stopAllAction();
      enemy.mixer.uncacheRoot(enemy.modelRoot);
    }
    enemy.root.traverse((object) => {
      if (!enemy.mixer && object.geometry && object.geometry.dispose) object.geometry.dispose();
      if (enemy.mixer) {
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        materials.forEach((material) => { if (material && material.dispose) material.dispose(); });
      }
    });
  }

  function pruneGroundEnemies() {
    const retained = [];
    groundEnemies.forEach((enemy) => {
      if (enemy.dead && enemy.deathTime > 6.5) {
        scene.remove(enemy.root);
        disposeGroundEnemy(enemy);
      }
      else retained.push(enemy);
    });
    groundEnemies = retained;
  }

  function animateGroundEnemy(enemy, dt, moving) {
    if (enemy.mixer) {
      const walking = moving && !enemy.tamed && enemy.ai && enemy.ai.moveMode === "walk" && enemy.actions && enemy.actions.walk;
      const nextState = enemy.dead ? "death" : enemy.hitStun > 0 ? "hit" : enemy.attackTimer > 0 ? "attack" : moving ? (walking ? "walk" : "run") : "idle";
      setEnemyAction(enemy, nextState);
      enemy.mixer.timeScale = nextState === "run" ? 1.15 : nextState === "walk" ? .82 : 1;
      enemy.mixer.update(dt);
      return;
    }
    const parts = enemy.parts;
    const walkScale = enemy.ai && enemy.ai.moveMode === "walk" ? .62 : 1;
    const stride = Math.sin(enemy.walkCycle) * (enemy.kind === "golem" ? .38 : .72) * walkScale;
    if (parts.leftLeg) parts.leftLeg.rotation.x = lerp(parts.leftLeg.rotation.x, moving ? stride : 0, Math.min(1, dt * 10));
    if (parts.rightLeg) parts.rightLeg.rotation.x = lerp(parts.rightLeg.rotation.x, moving ? -stride : 0, Math.min(1, dt * 10));
    if (parts.leftArm) parts.leftArm.rotation.x = lerp(parts.leftArm.rotation.x, moving ? -stride * .7 : 0, Math.min(1, dt * 10));
    if (parts.rightArm) {
      let target = moving ? stride * .7 : 0;
      if (enemy.attackTimer > 0) {
        const progress = 1 - enemy.attackTimer / .72;
        target = -1.45 + Math.sin(clamp(progress, 0, 1) * Math.PI) * 2.45;
      }
      parts.rightArm.rotation.x = lerp(parts.rightArm.rotation.x, target, Math.min(1, dt * 14));
    }
  }

  function beginEnemyTelegraph(enemy) {
    if (enemy.telegraph) return;
    const material = new THREE.MeshBasicMaterial({ color: enemy.elite ? 0xff743f : 0xe7a062, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(Math.max(.8, enemy.attackRange * .72), enemy.attackRange, 40), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(enemy.root.position.x, terrainHeight(enemy.root.position.x, enemy.root.position.z) + .12, enemy.root.position.z);
    scene.add(mesh);
    enemy.telegraph = mesh;
  }

  function clearEnemyTelegraph(enemy) {
    if (!enemy.telegraph) return;
    scene.remove(enemy.telegraph);
    enemy.telegraph.geometry.dispose();
    enemy.telegraph.material.dispose();
    enemy.telegraph = null;
  }

  const GARRISON_PATROL_ROLES = new Set(["patrol_guard", "beast_patrol"]);

  function emitPlayerNoise(radius, duration, reason) {
    const nextRadius = Math.max(0, Number(radius) || 0);
    if (playerNoiseTime <= 0 || nextRadius >= playerNoiseRadius) playerNoiseReason = reason || "disturbance";
    playerNoiseRadius = Math.max(playerNoiseRadius, nextRadius);
    playerNoiseTime = Math.max(playerNoiseTime, Math.max(.05, Number(duration) || .3));
  }

  function currentPlayerNoise() {
    const pulseRadius = playerNoiseTime > 0 ? playerNoiseRadius : 0;
    const movementRadius = player.superSprinting ? 36 : player.sprinting ? 23 : player.moving ? 8 : 0;
    if (pulseRadius >= movementRadius && pulseRadius > 0) return { radius: pulseRadius, reason: playerNoiseReason };
    if (player.superSprinting) return { radius: movementRadius, reason: "super-sprint" };
    if (player.sprinting) return { radius: movementRadius, reason: "sprint" };
    if (player.moving) return { radius: movementRadius, reason: "footsteps" };
    return { radius: 0, reason: "quiet" };
  }

  function segmentIntersectsCollider(from, to, box, padding) {
    const cosine = Math.cos(box.rotation || 0);
    const sine = Math.sin(box.rotation || 0);
    const transform = (point) => {
      const dx = point.x - box.x;
      const dz = point.z - box.z;
      return { x: dx * cosine - dz * sine, y: point.y, z: dx * sine + dz * cosine };
    };
    const start = transform(from);
    const end = transform(to);
    const inset = padding == null ? .04 : padding;
    let enter = 0;
    let exit = 1;
    const clipAxis = (origin, delta, minimum, maximum) => {
      if (Math.abs(delta) < 1e-6) return origin >= minimum && origin <= maximum;
      let first = (minimum - origin) / delta;
      let second = (maximum - origin) / delta;
      if (first > second) { const swap = first; first = second; second = swap; }
      enter = Math.max(enter, first);
      exit = Math.min(exit, second);
      return enter <= exit;
    };
    if (!clipAxis(start.x, end.x - start.x, -box.hx - inset, box.hx + inset)) return false;
    if (!clipAxis(start.z, end.z - start.z, -box.hz - inset, box.hz + inset)) return false;
    if (!clipAxis(start.y, end.y - start.y, box.minY - inset, box.maxY + inset)) return false;
    return exit >= .012 && enter <= .988;
  }

  function segmentOccluded(from, to) {
    const minimumX = Math.min(from.x, to.x);
    const maximumX = Math.max(from.x, to.x);
    const minimumZ = Math.min(from.z, to.z);
    const maximumZ = Math.max(from.z, to.z);
    const minimumY = Math.min(from.y, to.y);
    const maximumY = Math.max(from.y, to.y);
    for (let index = 0; index < colliders.length; index += 1) {
      const box = colliders[index];
      if (box.disabled) continue;
      if (maximumY < box.minY || minimumY > box.maxY) continue;
      const cosine = Math.abs(Math.cos(box.rotation || 0));
      const sine = Math.abs(Math.sin(box.rotation || 0));
      const extentX = cosine * box.hx + sine * box.hz + .08;
      const extentZ = sine * box.hx + cosine * box.hz + .08;
      if (maximumX < box.x - extentX || minimumX > box.x + extentX || maximumZ < box.z - extentZ || minimumZ > box.z + extentZ) continue;
      if (segmentIntersectsCollider(from, to, box, .035)) return true;
    }
    const horizontalDistance = Math.hypot(to.x - from.x, to.z - from.z);
    const samples = Math.min(24, Math.max(2, Math.ceil(horizontalDistance / 3.2)));
    for (let index = 1; index < samples; index += 1) {
      const ratio = index / samples;
      const x = lerp(from.x, to.x, ratio);
      const z = lerp(from.z, to.z, ratio);
      const sightY = lerp(from.y, to.y, ratio);
      if (terrainHeight(x, z) + .48 > sightY) return true;
    }
    return false;
  }

  function enemyEyePosition(enemy) {
    const height = enemy.kind === "golem" ? 3.15 : enemy.kind === "warg" ? 1.35 : enemy.elite ? 2.35 : 1.85;
    return enemy.root.position.clone().add(new THREE.Vector3(0, height, 0));
  }

  function playerSightPosition() {
    return player.root.position.clone().add(new THREE.Vector3(0, 1.38, 0));
  }

  function roleSightProfile(enemy) {
    const role = enemy.ai ? enemy.ai.role : "patrol_guard";
    let profile;
    if (role === "tower_lookout") profile = { range: 48, halfAngle: 72, buildup: 1.28 };
    else if (role === "gate_sentry") profile = { range: 41, halfAngle: 64, buildup: 1.12 };
    else if (role === "beast_patrol") profile = { range: 34, halfAngle: 76, buildup: 1.18 };
    else if (role === "reserve") profile = { range: 29, halfAngle: 56, buildup: .9 };
    else profile = { range: 36, halfAngle: 60, buildup: 1 };
    profile.range = enemy.adminSightRange || profile.range * (enemy.adminSightMultiplier || 1);
    profile.buildup *= enemy.adminTracking || 1;
    return profile;
  }

  function enemyVisionSample(enemy) {
    if (!enemy.ai || !player.root) return { visible: false, occluded: false, distance: Infinity, facing: -1 };
    const eye = enemyEyePosition(enemy);
    const target = playerSightPosition();
    const dx = target.x - eye.x;
    const dz = target.z - eye.z;
    const horizontalDistance = Math.hypot(dx, dz);
    const verticalDistance = Math.abs(target.y - eye.y);
    const profile = roleSightProfile(enemy);
    const forwardX = -Math.sin(enemy.root.rotation.y);
    const forwardZ = -Math.cos(enemy.root.rotation.y);
    const facing = horizontalDistance > .001 ? (forwardX * dx + forwardZ * dz) / horizontalDistance : 1;
    const awarenessState = enemy.ai.state === "combat" || enemy.ai.state === "alert" || enemy.ai.state === "search" || enemy.ai.state === "suspicious";
    const coneThreshold = Math.cos((profile.halfAngle + (awarenessState ? 24 : 0)) * Math.PI / 180);
    const inCone = facing >= coneThreshold || horizontalDistance <= 4.5;
    const inRange = horizontalDistance <= profile.range && verticalDistance <= Math.max(9, profile.range * .55);
    const forcedBlind = enemy.ai.testBlindTime > 0;
    const occluded = inRange && inCone ? segmentOccluded(eye, target) : false;
    return { visible: !forcedBlind && inRange && inCone && !occluded, occluded, distance: horizontalDistance, facing, profile };
  }

  function setGroundEnemyAIState(enemy, nextState, reason) {
    const ai = enemy && enemy.ai;
    if (!ai || ai.state === nextState) return false;
    ai.previousState = ai.state;
    ai.state = nextState;
    ai.stateTime = 0;
    ai.transitionReason = reason || "state";
    ai.path = [];
    ai.pathIndex = 0;
    ai.repathTimer = 0;
    ai.blockedTime = 0;
    ai.progressTime = 0;
    ai.progressExpected = 0;
    ai.progressX = enemy.root.position.x;
    ai.progressZ = enemy.root.position.z;
    ai.moveMode = nextState === "combat" || nextState === "alert" ? "run" : "walk";
    enemy.engaged = nextState === "alert" || nextState === "combat" || nextState === "search";
    if (nextState !== "combat") {
      enemy.attackTimer = 0;
      enemy.attackDelivered = false;
      clearEnemyTelegraph(enemy);
    }
    if (nextState === "search") ai.searchRemaining = 4.5 + seeded(ai.seed + 71) * 2.5;
    if (nextState === "guard") {
      ai.detection = 0;
      ai.lostSight = 0;
      ai.guardDwell = 2.4 + seeded(ai.seed + ai.patrolIndex * 19 + 5) * 3.2;
    }
    return true;
  }

  function shareGarrisonAlert(source, position, reason) {
    if (!source || !source.ai) return;
    groundEnemies.forEach((other) => {
      if (other === source || other.dead || other.tamed || !other.ai || other.strongholdId !== source.strongholdId) return;
      if (other.ai.state === "combat" || other.ai.state === "alert") return;
      const distance = distance2D(source.root.position, other.root.position);
      const radius = source.ai.role === "tower_lookout" ? 24 : 19;
      if (distance > radius) return;
      const sourcePoint = enemyEyePosition(source);
      const listenerPoint = enemyEyePosition(other);
      if (distance > 8 && segmentOccluded(sourcePoint, listenerPoint)) return;
      other.ai.lastKnown.copy(position);
      other.ai.detection = Math.max(other.ai.detection, .58);
      setGroundEnemyAIState(other, "suspicious", "shared-" + (reason || "alert"));
      garrisonAIStats.alertsShared += 1;
    });
  }

  function raiseGroundEnemyAlert(enemy, position, reason) {
    if (!enemy || !enemy.ai) return;
    enemy.ai.lastKnown.copy(position || player.root.position);
    enemy.ai.detection = 1;
    enemy.ai.lostSight = 0;
    const changed = setGroundEnemyAIState(enemy, "alert", reason || "confirmed");
    if (changed) shareGarrisonAlert(enemy, enemy.ai.lastKnown, reason || "confirmed");
  }

  function alertGroundEnemyFromDamage(enemy) {
    if (!enemy || !enemy.ai || enemy.dead || enemy.tamed) return;
    raiseGroundEnemyAlert(enemy, player.root.position, "damaged");
  }

  function enemyNavPointWalkable(x, z, radius) {
    if (x < -HALF_WORLD || x > HALF_WORLD || z < -HALF_WORLD || z > HALF_WORLD) return false;
    const y = terrainHeight(x, z);
    if (y <= waterLevelAt(x, z) + .38) return false;
    const sample = 1.25;
    const slope = Math.max(
      Math.abs(terrainHeight(x + sample, z) - terrainHeight(x - sample, z)),
      Math.abs(terrainHeight(x, z + sample) - terrainHeight(x, z - sample))
    ) / (sample * 2);
    if (slope > 1.05) return false;
    return !hitsCollider(x, z, radius == null ? .58 : radius, y, y + 3.35);
  }

  function buildStrongholdNavGrid(stronghold) {
    if (!stronghold || stronghold.navGrid) return stronghold ? stronghold.navGrid : null;
    const cell = 3.6;
    const radius = (stronghold.kind === "keep" ? 47 : 37);
    const halfCells = Math.ceil(radius / cell);
    const size = halfCells * 2 + 1;
    const originX = stronghold.x - halfCells * cell;
    const originZ = stronghold.z - halfCells * cell;
    const walkable = new Uint8Array(size * size);
    let walkableCount = 0;
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        const x = originX + column * cell;
        const z = originZ + row * cell;
        const inside = Math.hypot(x - stronghold.x, z - stronghold.z) <= radius + cell;
        const open = inside && enemyNavPointWalkable(x, z, .54);
        walkable[row * size + column] = open ? 1 : 0;
        if (open) walkableCount += 1;
      }
    }
    stronghold.navGrid = { cell, radius, halfCells, size, originX, originZ, walkable, walkableCount };
    return stronghold.navGrid;
  }

  function navCellIndex(grid, column, row) {
    return row >= 0 && row < grid.size && column >= 0 && column < grid.size ? row * grid.size + column : -1;
  }

  function nearestWalkableNavCell(grid, x, z) {
    const baseColumn = clamp(Math.round((x - grid.originX) / grid.cell), 0, grid.size - 1);
    const baseRow = clamp(Math.round((z - grid.originZ) / grid.cell), 0, grid.size - 1);
    for (let ring = 0; ring <= 4; ring += 1) {
      let best = -1;
      let bestDistance = Infinity;
      for (let row = baseRow - ring; row <= baseRow + ring; row += 1) {
        for (let column = baseColumn - ring; column <= baseColumn + ring; column += 1) {
          if (ring && Math.abs(column - baseColumn) !== ring && Math.abs(row - baseRow) !== ring) continue;
          const index = navCellIndex(grid, column, row);
          if (index < 0 || !grid.walkable[index]) continue;
          const cx = grid.originX + column * grid.cell;
          const cz = grid.originZ + row * grid.cell;
          const distance = Math.hypot(cx - x, cz - z);
          if (distance < bestDistance) { best = index; bestDistance = distance; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  function findStrongholdNavPath(enemy, target) {
    if (!enemy.ai || !enemy.strongholdId) return [];
    const stronghold = strongholds.find((item) => item.id === enemy.strongholdId);
    const grid = buildStrongholdNavGrid(stronghold);
    if (!grid || grid.walkableCount < 2) return [];
    const start = nearestWalkableNavCell(grid, enemy.root.position.x, enemy.root.position.z);
    const goal = nearestWalkableNavCell(grid, target.x, target.z);
    if (start < 0 || goal < 0 || start === goal) return [];
    const count = grid.size * grid.size;
    const scores = new Float64Array(count);
    const estimates = new Float64Array(count);
    const previous = new Int32Array(count);
    const closed = new Uint8Array(count);
    scores.fill(Infinity);
    estimates.fill(Infinity);
    previous.fill(-1);
    scores[start] = 0;
    const goalColumn = goal % grid.size;
    const goalRow = Math.floor(goal / grid.size);
    estimates[start] = Math.hypot(start % grid.size - goalColumn, Math.floor(start / grid.size) - goalRow);
    const open = [start];
    const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let iterations = 0;
    while (open.length && iterations < count * 3) {
      iterations += 1;
      let bestOpen = 0;
      for (let index = 1; index < open.length; index += 1) if (estimates[open[index]] < estimates[open[bestOpen]]) bestOpen = index;
      const current = open.splice(bestOpen, 1)[0];
      if (closed[current]) continue;
      if (current === goal) break;
      closed[current] = 1;
      const currentColumn = current % grid.size;
      const currentRow = Math.floor(current / grid.size);
      directions.forEach((direction) => {
        const column = currentColumn + direction[0];
        const row = currentRow + direction[1];
        const neighbor = navCellIndex(grid, column, row);
        if (neighbor < 0 || !grid.walkable[neighbor] || closed[neighbor]) return;
        if (direction[0] && direction[1]) {
          const sideA = navCellIndex(grid, currentColumn + direction[0], currentRow);
          const sideB = navCellIndex(grid, currentColumn, currentRow + direction[1]);
          if (sideA < 0 || sideB < 0 || !grid.walkable[sideA] || !grid.walkable[sideB]) return;
        }
        const x = grid.originX + column * grid.cell;
        const z = grid.originZ + row * grid.cell;
        const currentX = grid.originX + currentColumn * grid.cell;
        const currentZ = grid.originZ + currentRow * grid.cell;
        const slopeCost = Math.abs(terrainHeight(x, z) - terrainHeight(currentX, currentZ)) * .22;
        const tentative = scores[current] + (direction[0] && direction[1] ? 1.414 : 1) + slopeCost;
        if (tentative >= scores[neighbor]) return;
        previous[neighbor] = current;
        scores[neighbor] = tentative;
        estimates[neighbor] = tentative + Math.hypot(column - goalColumn, row - goalRow);
        open.push(neighbor);
      });
    }
    if (previous[goal] < 0) return [];
    const cells = [];
    let cursor = goal;
    while (cursor !== start && cursor >= 0 && cells.length < count) {
      cells.push(cursor);
      cursor = previous[cursor];
    }
    cells.reverse();
    const path = cells.map((index) => {
      const column = index % grid.size;
      const row = Math.floor(index / grid.size);
      const x = grid.originX + column * grid.cell;
      const z = grid.originZ + row * grid.cell;
      return new THREE.Vector3(x, terrainHeight(x, z), z);
    });
    return path.filter((point, index) => index === path.length - 1 || index % 2 === 0);
  }

  function roleForGarrisonMember(stronghold, spot, index) {
    const base = STRONGHOLD_GARRISONS[stronghold.kind] || STRONGHOLD_GARRISONS.hamlet;
    const golemSlots = base.golem + (stronghold.kind === "fort" || stronghold.kind === "keep" ? 1 : 0);
    const firstLightSlot = base.heavy + base.warg + golemSlots;
    const slotIndex = Number.isInteger(spot.slotIndex) ? spot.slotIndex : index;
    const baseType = spot.baseType || spot.type;
    const lightIndex = Math.max(0, slotIndex - firstLightSlot);
    if (baseType === "golem") return "heavy_defender";
    if (baseType === "warg") return "beast_patrol";
    if ((stronghold.kind === "watchpost" || stronghold.kind === "fort") && baseType === "biomeLight" && lightIndex === 0) return "tower_lookout";
    if (baseType === "biomeHeavy") return slotIndex % 2 ? "heavy_defender" : "gate_sentry";
    const rotation = ["gate_sentry", "courtyard_guard", "patrol_guard", "reserve"];
    return rotation[lightIndex % rotation.length];
  }

  function assignGarrisonAI(enemy, stronghold, spot, index) {
    const seed = worldLayout.salt + index * 97 + Math.round(Math.abs(spot.x * 17 + spot.z * 31));
    const role = roleForGarrisonMember(stronghold, spot, index);
    const outwardX = spot.x - stronghold.x;
    const outwardZ = spot.z - stronghold.z;
    const outwardLength = Math.hypot(outwardX, outwardZ) || 1;
    let guardYaw = Math.atan2(-(outwardX / outwardLength), -(outwardZ / outwardLength));
    if (role === "courtyard_guard" || role === "reserve") guardYaw += Math.PI;
    const patrol = [new THREE.Vector3(spot.x, terrainHeight(spot.x, spot.z), spot.z)];
    if (GARRISON_PATROL_ROLES.has(role)) {
      const baseAngle = Math.atan2(spot.z - stronghold.z, spot.x - stronghold.x);
      const baseRadius = clamp(Math.hypot(outwardX, outwardZ), 5, stronghold.kind === "keep" ? 30 : 23);
      [-.42, .36, .74, -.82, 1.08, -1.18, 1.46, -1.52].forEach((offset, patrolIndex) => {
        if (patrol.length >= 4) return;
        const radius = clamp(baseRadius + (seeded(seed + 20 + patrolIndex) - .5) * 5, 5, stronghold.kind === "keep" ? 34 : 27);
        const angle = baseAngle + offset;
        const x = stronghold.x + Math.cos(angle) * radius;
        const z = stronghold.z + Math.sin(angle) * radius;
        if (enemyNavPointWalkable(x, z, enemy.hitRadius * .42)) patrol.push(new THREE.Vector3(x, terrainHeight(x, z), z));
      });
    }
    enemy.ai = {
      seed, role, state: "guard", previousState: null, stateTime: 0, transitionReason: "spawned-at-post",
      home: new THREE.Vector3(spot.x, terrainHeight(spot.x, spot.z), spot.z), guardYaw,
      patrol, patrolIndex: 0, guardDwell: 3.2 + seeded(seed + 5) * 3.8,
      detection: 0, lostSight: 0, lastKnown: new THREE.Vector3(spot.x, terrainHeight(spot.x, spot.z), spot.z),
      searchRemaining: 0, path: [], pathIndex: 0, repathTimer: 0, blockedTime: 0,
      progressTime: 0, progressExpected: 0, progressX: spot.x, progressZ: spot.z, stuckCount: 0, recoveries: 0,
      moveMode: "walk", sidestepSign: seeded(seed + 9) < .5 ? -1 : 1, lastSight: null, testBlindTime: 0,
      senseTimer: seeded(seed + 12) * .16, senseElapsed: 0
    };
    enemy.engaged = false;
    enemy.root.rotation.y = guardYaw;
    setEnemyAction(enemy, "idle", true);
  }

  function updateEnemyPerception(enemy, dt, noiseRadius, noiseReason) {
    const ai = enemy.ai;
    if (!ai) return;
    ai.testBlindTime = Math.max(0, ai.testBlindTime - dt);
    const sight = enemyVisionSample(enemy);
    ai.lastSight = { visible: sight.visible, occluded: sight.occluded, distance: sight.distance, facing: sight.facing };
    if (sight.visible) {
      ai.lastKnown.copy(player.root.position);
      ai.lostSight = 0;
      const proximity = clamp(1 - sight.distance / Math.max(1, sight.profile.range), .12, 1);
      const awareMultiplier = ai.state === "suspicious" || ai.state === "search" ? 1.9 : 1;
      ai.detection = clamp(ai.detection + dt * sight.profile.buildup * (.55 + proximity * 1.7) * awareMultiplier, 0, 1);
      if (ai.state === "combat") ai.detection = 1;
      if (ai.detection >= 1 && ai.state !== "combat" && ai.state !== "alert") raiseGroundEnemyAlert(enemy, player.root.position, "line-of-sight");
      else if (ai.detection >= .2 && (ai.state === "guard" || ai.state === "patrol" || ai.state === "return")) setGroundEnemyAIState(enemy, "suspicious", "partial-sighting");
    } else {
      ai.lostSight += dt;
      if (ai.state === "guard" || ai.state === "patrol" || ai.state === "return") ai.detection = Math.max(0, ai.detection - dt * .24);
      else if (ai.state === "suspicious") ai.detection = Math.max(.15, ai.detection - dt * .08);
      if (ai.state === "combat" && ai.lostSight > 1.35) setGroundEnemyAIState(enemy, "search", "lost-line-of-sight");
    }
    if (!sight.visible && noiseRadius > 0) {
      const hearingDistance = distance2D(enemy.root.position, player.root.position);
      if (hearingDistance <= noiseRadius) {
        const blocked = segmentOccluded(enemyEyePosition(enemy), playerSightPosition());
        const effectiveRadius = blocked ? noiseRadius * .42 : noiseRadius;
        if (hearingDistance <= effectiveRadius) {
          ai.lastKnown.copy(player.root.position);
          ai.detection = Math.max(ai.detection, blocked ? .22 : .4);
          if (ai.state === "guard" || ai.state === "patrol" || ai.state === "return") setGroundEnemyAIState(enemy, "suspicious", "heard-" + (noiseReason || "disturbance"));
        }
      }
    }
  }

  function canEnemyOccupy(enemy, x, z) {
    if (!enemyNavPointWalkable(x, z, enemy.hitRadius * .42)) return false;
    const currentY = terrainHeight(enemy.root.position.x, enemy.root.position.z);
    return Math.abs(terrainHeight(x, z) - currentY) <= 1.05;
  }

  function recoverGroundEnemy(enemy) {
    const ai = enemy.ai;
    const blocked = hitsCollider(enemy.root.position.x, enemy.root.position.z, enemy.hitRadius * .42, enemy.root.position.y, enemy.root.position.y + 3.35);
    const originX = enemy.root.position.x;
    const originZ = enemy.root.position.z;
    for (let ring = 1; ring <= 6; ring += 1) {
      const radius = ring * .55;
      for (let index = 0; index < 16; index += 1) {
        const angle = index / 16 * Math.PI * 2;
        const x = originX + Math.cos(angle) * radius;
        const z = originZ + Math.sin(angle) * radius;
        if (!canEnemyOccupy(enemy, x, z)) continue;
        enemy.root.position.set(x, terrainHeight(x, z), z);
        if (ai) { ai.recoveries += 1; ai.repathTimer = 0; }
        garrisonAIStats.stuckRecoveries += 1;
        return true;
      }
    }
    if (blocked && ai && enemyNavPointWalkable(ai.home.x, ai.home.z, enemy.hitRadius * .42)) {
      enemy.root.position.copy(ai.home);
      ai.recoveries += 1;
      ai.repathTimer = 0;
      garrisonAIStats.stuckRecoveries += 1;
      return true;
    }
    return false;
  }

  function requestEnemyPath(enemy, target) {
    if (!enemy.ai) return [];
    enemy.ai.path = findStrongholdNavPath(enemy, target);
    enemy.ai.pathIndex = 0;
    enemy.ai.repathTimer = .8 + seeded(enemy.ai.seed + enemy.ai.stuckCount * 13 + 33) * .55;
    garrisonAIStats.repaths += 1;
    return enemy.ai.path;
  }

  function steerAroundObstacles(enemy, direction, target) {
    const distance = 2.4 + enemy.hitRadius * .45;
    if (canEnemyOccupy(enemy, enemy.root.position.x + direction.x * distance, enemy.root.position.z + direction.z * distance)) return direction;
    const sign = enemy.ai ? enemy.ai.sidestepSign : 1;
    const angles = [.48 * sign, -.48 * sign, .92 * sign, -.92 * sign, 1.34 * sign, -1.34 * sign];
    let best = null;
    let bestScore = -Infinity;
    angles.forEach((angle) => {
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const x = direction.x * cosine - direction.z * sine;
      const z = direction.x * sine + direction.z * cosine;
      if (!canEnemyOccupy(enemy, enemy.root.position.x + x * distance, enemy.root.position.z + z * distance)) return;
      const remaining = target ? Math.hypot(target.x - (enemy.root.position.x + x * distance), target.z - (enemy.root.position.z + z * distance)) : 0;
      const score = direction.x * x + direction.z * z - remaining * .015;
      if (score > bestScore) { bestScore = score; best = new THREE.Vector3(x, 0, z); }
    });
    return best;
  }

  function applyGroundEnemySeparation(enemy, direction) {
    groundEnemies.forEach((other) => {
      if (other === enemy || other.dead || other.tamed) return;
      const separationX = enemy.root.position.x - other.root.position.x;
      const separationZ = enemy.root.position.z - other.root.position.z;
      const separationDistance = Math.hypot(separationX, separationZ);
      const desired = Math.max(2.1, (enemy.hitRadius + other.hitRadius) * .72);
      if (separationDistance <= .01 || separationDistance >= desired) return;
      const awayX = separationX / separationDistance;
      const awayZ = separationZ / separationDistance;
      const approaching = Math.max(0, -(direction.x * awayX + direction.z * awayZ));
      const strength = (desired - separationDistance) / desired * .9 + approaching * 1.05;
      direction.x += awayX * strength;
      direction.z += awayZ * strength;
    });
    return direction;
  }

  function enemyMovementDirection(enemy, target) {
    const ai = enemy.ai;
    let movementTarget = target;
    const directX = target.x - enemy.root.position.x;
    const directZ = target.z - enemy.root.position.z;
    const directDistance = Math.hypot(directX, directZ);
    const directDirection = directDistance > .001 ? new THREE.Vector3(directX / directDistance, 0, directZ / directDistance) : new THREE.Vector3();
    const probeDistance = Math.min(4.2, Math.max(1.2, directDistance));
    const directOpen = directDistance <= .001 || canEnemyOccupy(enemy, enemy.root.position.x + directDirection.x * probeDistance, enemy.root.position.z + directDirection.z * probeDistance);
    if ((!directOpen || ai.blockedTime > .28) && (!ai.path.length || ai.repathTimer <= 0)) requestEnemyPath(enemy, target);
    if (ai.path.length) {
      while (ai.pathIndex < ai.path.length - 1 && distance2D(enemy.root.position, ai.path[ai.pathIndex]) < 1.45) ai.pathIndex += 1;
      movementTarget = ai.path[ai.pathIndex] || target;
      if (distance2D(enemy.root.position, movementTarget) < 1.2 && ai.pathIndex >= ai.path.length - 1) ai.path = [];
    }
    const dx = movementTarget.x - enemy.root.position.x;
    const dz = movementTarget.z - enemy.root.position.z;
    const length = Math.hypot(dx, dz);
    if (length <= .001) return new THREE.Vector3();
    const direction = new THREE.Vector3(dx / length, 0, dz / length);
    const steered = steerAroundObstacles(enemy, direction, movementTarget);
    if (steered) direction.copy(steered);
    applyGroundEnemySeparation(enemy, direction);
    return direction.normalize();
  }

  function moveGroundEnemyToward(enemy, target, speed, dt) {
    const direction = enemyMovementDirection(enemy, target);
    if (direction.lengthSq() < .01) return 0;
    const startX = enemy.root.position.x;
    const startZ = enemy.root.position.z;
    const distance = Math.max(0, speed * dt);
    const steps = Math.max(1, Math.ceil(distance / .24));
    const stepDistance = distance / steps;
    for (let index = 0; index < steps; index += 1) {
      const nextX = enemy.root.position.x + direction.x * stepDistance;
      const nextZ = enemy.root.position.z + direction.z * stepDistance;
      if (canEnemyOccupy(enemy, nextX, nextZ)) {
        enemy.root.position.x = nextX;
        enemy.root.position.z = nextZ;
      } else {
        const xOpen = canEnemyOccupy(enemy, nextX, enemy.root.position.z);
        const zOpen = canEnemyOccupy(enemy, enemy.root.position.x, nextZ);
        if (xOpen && (!zOpen || Math.abs(direction.x) >= Math.abs(direction.z))) enemy.root.position.x = nextX;
        else if (zOpen) enemy.root.position.z = nextZ;
      }
      enemy.root.position.y = terrainHeight(enemy.root.position.x, enemy.root.position.z);
    }
    const moved = Math.hypot(enemy.root.position.x - startX, enemy.root.position.z - startZ);
    enemy.root.rotation.y = rotateToward(enemy.root.rotation.y, Math.atan2(-direction.x, -direction.z), dt * (enemy.ai.moveMode === "walk" ? 5.5 : 9));
    enemy.walkCycle += moved * (enemy.kind === "golem" ? 1.15 : enemy.ai.moveMode === "walk" ? 1.45 : 2.1);
    if (moved < distance * .18) enemy.ai.blockedTime += dt;
    else enemy.ai.blockedTime = Math.max(0, enemy.ai.blockedTime - dt * 2.5);
    enemy.ai.progressTime += dt;
    enemy.ai.progressExpected += distance;
    if (enemy.ai.progressTime >= .78) {
      const progress = Math.hypot(enemy.root.position.x - enemy.ai.progressX, enemy.root.position.z - enemy.ai.progressZ);
      if (progress < .3 && enemy.ai.progressExpected > .45) {
        enemy.ai.stuckCount += 1;
        enemy.ai.sidestepSign *= -1;
        enemy.ai.repathTimer = 0;
        requestEnemyPath(enemy, target);
        recoverGroundEnemy(enemy);
      }
      enemy.ai.progressX = enemy.root.position.x;
      enemy.ai.progressZ = enemy.root.position.z;
      enemy.ai.progressTime = 0;
      enemy.ai.progressExpected = 0;
    }
    return moved;
  }

  function finishEnemyAttack(enemy, dt) {
    if (enemy.attackTimer <= 0) return;
    const previous = enemy.attackTimer;
    enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
    if (enemy.telegraph) {
      enemy.telegraph.position.set(enemy.root.position.x, terrainHeight(enemy.root.position.x, enemy.root.position.z) + .12, enemy.root.position.z);
      enemy.telegraph.material.opacity = .16 + (1 - enemy.attackTimer / .72) * .48;
      enemy.telegraph.scale.setScalar(.86 + (1 - enemy.attackTimer / .72) * .14);
    }
    if (!enemy.attackDelivered && previous > .38 && enemy.attackTimer <= .38) {
      enemy.attackDelivered = true;
      const freshOffset = player.root.position.clone().sub(enemy.root.position);
      const freshDistance = freshOffset.length();
      const facingDot = freshDistance > .001 ? freshOffset.clone().setY(0).normalize().dot(new THREE.Vector3(-Math.sin(enemy.root.rotation.y), 0, -Math.cos(enemy.root.rotation.y))) : 1;
      const verticalDistance = Math.abs(player.root.position.y - enemy.root.position.y);
      if (freshDistance < enemy.attackRange + .85 && verticalDistance < 3.1 && facingDot > .15 && !segmentOccluded(enemyEyePosition(enemy), playerSightPosition())) damagePlayer(enemy.damage, enemy.name);
      createShockwave(enemy.root.position.clone(), enemy.attackRange, .22, enemy.elite ? 0xff6338 : 0xd18a52);
      emitPlayerNoise(18, .3, "combat");
    }
    if (enemy.attackTimer <= 0) clearEnemyTelegraph(enemy);
  }

  function updateGroundEnemyAI(enemy, dt, noiseRadius, noiseReason) {
    const ai = enemy.ai;
    ai.stateTime += dt;
    ai.repathTimer = Math.max(0, ai.repathTimer - dt);
    ai.senseTimer -= dt;
    ai.senseElapsed += dt;
    if (ai.senseTimer <= 0) {
      updateEnemyPerception(enemy, ai.senseElapsed, noiseRadius, noiseReason);
      ai.senseElapsed = 0;
      ai.senseTimer = ai.state === "combat" || ai.state === "alert" ? .08 : ai.state === "suspicious" || ai.state === "search" ? .12 : .2;
    }
    const homeDistance = distance2D(enemy.root.position, ai.home);
    const playerCampDistance = enemy.camp ? Math.hypot(player.root.position.x - enemy.camp.x, player.root.position.z - enemy.camp.z) : 0;
    if (enemy.camp && homeDistance > enemy.camp.radius + 7 && ai.state !== "return") setGroundEnemyAIState(enemy, "return", "home-leash");
    if (enemy.camp && playerCampDistance > enemy.camp.radius + 14 && (ai.state === "combat" || ai.state === "alert") && ai.lostSight > .35) setGroundEnemyAIState(enemy, "search", "player-left-location");
    let moving = false;
    const stunned = enemy.hitStun > 0;
    if (ai.state === "guard") {
      ai.moveMode = "walk";
      ai.guardDwell -= dt;
      const scan = Math.sin(elapsed * .52 + enemy.phase) * (ai.role === "tower_lookout" ? .58 : .34);
      enemy.root.rotation.y = rotateToward(enemy.root.rotation.y, ai.guardYaw + scan, dt * 1.35);
      if (GARRISON_PATROL_ROLES.has(ai.role) && ai.patrol.length > 1 && ai.guardDwell <= 0) {
        ai.patrolIndex = (ai.patrolIndex + 1) % ai.patrol.length;
        setGroundEnemyAIState(enemy, "patrol", "scheduled-patrol");
      }
    } else if (ai.state === "patrol") {
      ai.moveMode = "walk";
      const target = ai.patrol[ai.patrolIndex] || ai.home;
      if (distance2D(enemy.root.position, target) <= 1.35) setGroundEnemyAIState(enemy, "guard", "patrol-pause");
      else if (!stunned) moving = moveGroundEnemyToward(enemy, target, enemy.speed * .42 * (enemy.slowTime > 0 ? .62 : 1), dt) > .001;
    } else if (ai.state === "suspicious") {
      ai.moveMode = "walk";
      if (distance2D(enemy.root.position, ai.lastKnown) > 2.1 && ai.stateTime < 7.5 && !stunned) moving = moveGroundEnemyToward(enemy, ai.lastKnown, enemy.speed * .56 * (enemy.slowTime > 0 ? .62 : 1), dt) > .001;
      else setGroundEnemyAIState(enemy, "search", "investigate-last-known");
    } else if (ai.state === "alert") {
      ai.moveMode = "run";
      const directionX = ai.lastKnown.x - enemy.root.position.x;
      const directionZ = ai.lastKnown.z - enemy.root.position.z;
      enemy.root.rotation.y = rotateToward(enemy.root.rotation.y, Math.atan2(-directionX, -directionZ), dt * 11);
      if (ai.stateTime >= .24) setGroundEnemyAIState(enemy, "combat", "alert-ready");
    } else if (ai.state === "combat") {
      ai.moveMode = "run";
      const playerOffsetX = player.root.position.x - enemy.root.position.x;
      const playerOffsetZ = player.root.position.z - enemy.root.position.z;
      const playerDistance = Math.hypot(playerOffsetX, playerOffsetZ);
      const verticalDistance = Math.abs(player.root.position.y - enemy.root.position.y);
      const futureRanged = enemy.attackRange >= 6;
      if (stunned) {
        moving = false;
      } else if (futureRanged && playerDistance < enemy.attackRange * .55) {
        const retreat = enemy.root.position.clone().sub(player.root.position).setY(0).normalize().multiplyScalar(enemy.attackRange * .72).add(enemy.root.position);
        moving = moveGroundEnemyToward(enemy, retreat, enemy.speed * .72, dt) > .001;
      } else if (playerDistance > enemy.attackRange * (futureRanged ? .82 : .9) || verticalDistance > 2.8) {
        let combatGoal = player.root.position;
        if (ai.role === "heavy_defender" && enemy.camp) {
          const fromHomeX = player.root.position.x - ai.home.x;
          const fromHomeZ = player.root.position.z - ai.home.z;
          const fromHomeDistance = Math.hypot(fromHomeX, fromHomeZ);
          if (fromHomeDistance > 13) combatGoal = new THREE.Vector3(ai.home.x + fromHomeX / fromHomeDistance * 13, 0, ai.home.z + fromHomeZ / fromHomeDistance * 13);
        } else if (ai.role === "beast_patrol" && playerDistance > enemy.attackRange + 2) {
          const flankAngle = Math.atan2(playerOffsetZ, playerOffsetX) + ai.sidestepSign * .72;
          combatGoal = new THREE.Vector3(player.root.position.x + Math.cos(flankAngle) * 2.8, 0, player.root.position.z + Math.sin(flankAngle) * 2.8);
        }
        moving = moveGroundEnemyToward(enemy, combatGoal, enemy.speed * (enemy.slowTime > 0 ? .62 : 1), dt) > .001;
      } else if (enemy.attackCooldown <= 0 && enemy.attackTimer <= 0) {
        enemy.attackTimer = .72;
        enemy.attackDelivered = false;
        enemy.attackCooldown = enemy.attackInterval;
        enemy.root.rotation.y = Math.atan2(-playerOffsetX, -playerOffsetZ);
        beginEnemyTelegraph(enemy);
      }
    } else if (ai.state === "search") {
      ai.moveMode = "walk";
      ai.searchRemaining -= dt;
      const lastDistance = distance2D(enemy.root.position, ai.lastKnown);
      if (lastDistance > 2.2 && !stunned) moving = moveGroundEnemyToward(enemy, ai.lastKnown, enemy.speed * .55 * (enemy.slowTime > 0 ? .62 : 1), dt) > .001;
      else enemy.root.rotation.y = rotateToward(enemy.root.rotation.y, ai.guardYaw + Math.sin(elapsed * 1.3 + enemy.phase) * 1.15, dt * 2.4);
      if (ai.searchRemaining <= 0) setGroundEnemyAIState(enemy, "return", "search-expired");
    } else if (ai.state === "return") {
      ai.moveMode = "walk";
      if (homeDistance <= 1.25) {
        enemy.root.position.x = ai.home.x;
        enemy.root.position.z = ai.home.z;
        setGroundEnemyAIState(enemy, "guard", "post-restored");
      } else if (!stunned) moving = moveGroundEnemyToward(enemy, ai.home, enemy.speed * .58 * (enemy.slowTime > 0 ? .62 : 1), dt) > .001;
    }
    finishEnemyAttack(enemy, dt);
    enemy.root.position.y = terrainHeight(enemy.root.position.x, enemy.root.position.z);
    animateGroundEnemy(enemy, dt, moving);
  }

  function updateGroundEnemies(dt, idle) {
    playerNoiseTime = Math.max(0, playerNoiseTime - dt);
    if (playerNoiseTime <= 0) { playerNoiseRadius = 0; playerNoiseReason = "quiet"; }
    const noise = currentPlayerNoise();
    groundEnemies.forEach((enemy) => {
      if (enemy.networkExcluded) { enemy.root.visible = false; return; }
      const renderDistance = isCoarse ? 175 : 275;
      const playerDistance = player.root ? distance2D(enemy.root.position, player.root.position) : 0;
      enemy.root.visible = enemy.tamed || playerDistance <= renderDistance;
      if (!enemy.root.visible && !enemy.dead) {
        clearEnemyTelegraph(enemy);
        enemy.attackTimer = 0;
        if (enemy.ai && enemy.ai.state !== "guard" && enemy.ai.state !== "patrol" && enemy.ai.state !== "return") setGroundEnemyAIState(enemy, "return", "far-cull");
        return;
      }
      if (enemy.dead) {
        clearEnemyTelegraph(enemy);
        enemy.deathTime += dt;
        if (enemy.mixer) enemy.mixer.update(dt * .18);
        const fall = Math.min(1, enemy.deathTime / .72);
        const eased = fall * fall * (3 - 2 * fall);
        enemy.root.rotation.z = lerp(enemy.root.rotation.z, enemy.kind === "golem" ? 1.18 : 1.52, eased);
        enemy.root.rotation.x = lerp(enemy.root.rotation.x, enemy.kind === "warg" ? -.35 : .18, eased);
        const floor = terrainHeight(enemy.root.position.x, enemy.root.position.z) + (enemy.kind === "golem" ? .65 : .18);
        enemy.root.position.y = lerp(enemy.root.position.y, floor, Math.min(1, dt * 5));
        if (enemy.deathTime > 1.1) enemy.root.scale.multiplyScalar(Math.max(.992, 1 - dt * .025));
        return;
      }
      if (idle) { if (enemy.mixer) enemy.mixer.update(dt * .2); return; }
      if (enemy.tamed) { updateTamedEnemy(enemy, dt); return; }
      enemy.hitStun = Math.max(0, enemy.hitStun - dt);
      enemy.slowTime = Math.max(0, (enemy.slowTime || 0) - dt);
      if (enemy.bleedTime > 0) {
        enemy.bleedTime = Math.max(0, enemy.bleedTime - dt);
        enemy.health -= enemy.bleedStacks * 1.35 * dt;
        if (enemy.health <= 0) { enemy.lastDamageSource = "weapon"; enemy.lastWeaponId = "blade"; killDragon(enemy); return; }
      } else enemy.bleedStacks = 0;
      enemy.attackCooldown -= dt;
      if (enemy.impulse && enemy.impulse.lengthSq() > .01) {
        const impulseX = enemy.root.position.x + enemy.impulse.x * dt;
        const impulseZ = enemy.root.position.z + enemy.impulse.z * dt;
        if (enemy.ai ? canEnemyOccupy(enemy, impulseX, impulseZ) : !hitsCollider(impulseX, impulseZ, enemy.hitRadius * .45, enemy.root.position.y, enemy.root.position.y + 3.6)) {
          enemy.root.position.x = clamp(impulseX, -HALF_WORLD, HALF_WORLD);
          enemy.root.position.z = clamp(impulseZ, -HALF_WORLD, HALF_WORLD);
        }
        enemy.impulse.multiplyScalar(Math.pow(.035, dt));
      }
      if (enemy.ai) updateGroundEnemyAI(enemy, dt, noise.radius, noise.reason);
      else {
        const offset = player.root.position.clone().sub(enemy.root.position).setY(0);
        const distance = offset.length();
        const moving = distance > enemy.attackRange && enemy.hitStun <= 0;
        if (moving) {
          const direction = offset.normalize();
          const speed = enemy.speed * (enemy.slowTime > 0 ? .62 : 1);
          const nextX = enemy.root.position.x + direction.x * speed * dt;
          const nextZ = enemy.root.position.z + direction.z * speed * dt;
          if (!hitsCollider(nextX, nextZ, enemy.hitRadius * .45, enemy.root.position.y, enemy.root.position.y + 3.6)) {
            enemy.root.position.x = nextX;
            enemy.root.position.z = nextZ;
          }
          enemy.root.rotation.y = rotateToward(enemy.root.rotation.y, Math.atan2(-direction.x, -direction.z), dt * 9);
          enemy.walkCycle += dt * enemy.speed * 2.1;
        } else if (enemy.attackCooldown <= 0 && enemy.attackTimer <= 0) {
          enemy.attackTimer = .72;
          enemy.attackDelivered = false;
          enemy.attackCooldown = enemy.attackInterval;
          beginEnemyTelegraph(enemy);
        }
        finishEnemyAttack(enemy, dt);
        enemy.root.position.y = terrainHeight(enemy.root.position.x, enemy.root.position.z);
        animateGroundEnemy(enemy, dt, moving);
      }
    });
  }

  function garrisonAISummary() {
    const active = groundEnemies.filter((enemy) => !enemy.dead && !enemy.tamed && enemy.ai);
    const states = {};
    const roles = {};
    active.forEach((enemy) => {
      states[enemy.ai.state] = (states[enemy.ai.state] || 0) + 1;
      roles[enemy.ai.role] = (roles[enemy.ai.role] || 0) + 1;
    });
    const noise = currentPlayerNoise();
    return {
      actors: active.length,
      states,
      roles,
      stationed: (states.guard || 0) + (states.patrol || 0),
      aware: (states.suspicious || 0) + (states.alert || 0) + (states.combat || 0) + (states.search || 0),
      navGrids: strongholds.filter((stronghold) => stronghold.navGrid).length,
      navWalkableCells: strongholds.reduce((sum, stronghold) => sum + (stronghold.navGrid ? stronghold.navGrid.walkableCount : 0), 0),
      repaths: garrisonAIStats.repaths,
      stuckRecoveries: garrisonAIStats.stuckRecoveries,
      alertsShared: garrisonAIStats.alertsShared,
      playerNoise: noise
    };
  }

  function captureGarrisonActorState(enemy) {
    const ai = enemy.ai;
    const aiState = {};
    [
      "state", "previousState", "stateTime", "transitionReason", "patrolIndex", "guardDwell",
      "detection", "lostSight", "searchRemaining", "pathIndex", "repathTimer", "blockedTime",
      "progressTime", "progressExpected", "progressX", "progressZ", "stuckCount", "recoveries",
      "moveMode", "sidestepSign", "testBlindTime", "senseTimer", "senseElapsed"
    ].forEach((key) => { aiState[key] = ai[key]; });
    aiState.lastKnown = ai.lastKnown.clone();
    aiState.lastSight = ai.lastSight ? Object.assign({}, ai.lastSight) : null;
    aiState.path = ai.path.slice();
    return {
      enemy,
      position: enemy.root.position.clone(), rotationY: enemy.root.rotation.y,
      engaged: enemy.engaged, attackTimer: enemy.attackTimer, attackDelivered: enemy.attackDelivered,
      attackCooldown: enemy.attackCooldown, ai: aiState
    };
  }

  function restoreGarrisonActorState(saved) {
    const enemy = saved.enemy;
    const ai = enemy.ai;
    enemy.root.position.copy(saved.position);
    enemy.root.rotation.y = saved.rotationY;
    enemy.engaged = saved.engaged;
    enemy.attackTimer = saved.attackTimer;
    enemy.attackDelivered = saved.attackDelivered;
    enemy.attackCooldown = saved.attackCooldown;
    Object.keys(saved.ai).forEach((key) => {
      if (key !== "lastKnown" && key !== "lastSight" && key !== "path") ai[key] = saved.ai[key];
    });
    ai.lastKnown.copy(saved.ai.lastKnown);
    ai.lastSight = saved.ai.lastSight ? Object.assign({}, saved.ai.lastSight) : null;
    ai.path = saved.ai.path.slice();
  }

  function primeGarrisonProbeState(enemy) {
    const ai = enemy.ai;
    ai.state = "guard";
    ai.previousState = null;
    ai.stateTime = 0;
    ai.transitionReason = "probe-ready";
    ai.detection = 0;
    ai.lostSight = 0;
    ai.searchRemaining = 0;
    ai.path = [];
    ai.pathIndex = 0;
    ai.repathTimer = 0;
    ai.blockedTime = 0;
    ai.progressTime = 0;
    ai.progressExpected = 0;
    ai.progressX = enemy.root.position.x;
    ai.progressZ = enemy.root.position.z;
    ai.moveMode = "walk";
    ai.testBlindTime = 0;
    enemy.engaged = false;
    enemy.attackTimer = 0;
    enemy.attackDelivered = false;
  }

  function garrisonAIDebug() {
    return groundEnemies.filter((enemy) => enemy.ai).map((enemy) => ({
      name: enemy.name, spawnKey: enemy.spawnKey || null, strongholdId: enemy.strongholdId,
      role: enemy.ai.role, state: enemy.ai.state, previousState: enemy.ai.previousState,
      reason: enemy.ai.transitionReason, animation: enemy.animationState, detection: enemy.ai.detection,
      lastSight: enemy.ai.lastSight ? Object.assign({}, enemy.ai.lastSight) : null,
      post: { x: enemy.ai.home.x, y: enemy.ai.home.y, z: enemy.ai.home.z },
      postDistance: distance2D(enemy.root.position, enemy.ai.home), patrolPoints: enemy.ai.patrol.length,
      patrolIndex: enemy.ai.patrolIndex, pathLength: Math.max(0, enemy.ai.path.length - enemy.ai.pathIndex),
      blockedSeconds: enemy.ai.blockedTime, repathSeconds: enemy.ai.repathTimer,
      stuckCount: enemy.ai.stuckCount, recoveries: enemy.ai.recoveries,
      lastKnown: { x: enemy.ai.lastKnown.x, y: enemy.ai.lastKnown.y, z: enemy.ai.lastKnown.z },
      x: enemy.root.position.x, y: enemy.root.position.y, z: enemy.root.position.z
    }));
  }

  function garrisonBehaviorProbe() {
    const candidates = groundEnemies.filter((enemy) => !enemy.dead && !enemy.tamed && enemy.ai && !enemy.telegraph);
    const source = candidates.find((enemy) => candidates.some((other) => other !== enemy && other.strongholdId === enemy.strongholdId));
    const listener = source && candidates.find((enemy) => enemy !== source && enemy.strongholdId === source.strongholdId);
    if (!source || !listener) return { available: false, actors: candidates.length };
    const actorStates = candidates.map(captureGarrisonActorState);
    const savedPlayerPosition = player.root.position.clone();
    const savedStats = Object.assign({}, garrisonAIStats);
    try {
      primeGarrisonProbeState(source);
      primeGarrisonProbeState(listener);
      listener.root.position.set(source.root.position.x + .8, terrainHeight(source.root.position.x + .8, source.root.position.z), source.root.position.z);
      listener.ai.progressX = listener.root.position.x;
      listener.ai.progressZ = listener.root.position.z;
      let clearPosition = null;
      let clearSample = null;
      const sightRange = roleSightProfile(source).range;
      const radii = [Math.min(10, sightRange * .3), Math.min(15, sightRange * .45), 6];
      for (let radiusIndex = 0; radiusIndex < radii.length && !clearPosition; radiusIndex += 1) {
        for (let angleIndex = 0; angleIndex < 16 && !clearPosition; angleIndex += 1) {
          const angle = angleIndex / 16 * Math.PI * 2;
          const x = source.root.position.x + Math.cos(angle) * radii[radiusIndex];
          const z = source.root.position.z + Math.sin(angle) * radii[radiusIndex];
          if (!enemyNavPointWalkable(x, z, .5)) continue;
          player.root.position.set(x, terrainHeight(x, z), z);
          source.root.rotation.y = Math.atan2(-(x - source.root.position.x), -(z - source.root.position.z));
          const sample = enemyVisionSample(source);
          if (sample.visible) { clearPosition = player.root.position.clone(); clearSample = sample; }
        }
      }
      if (!clearPosition || !clearSample) return { available: false, reason: "no-clear-sight-sample" };
      player.root.position.copy(clearPosition);
      const alertsBefore = garrisonAIStats.alertsShared;
      updateEnemyPerception(source, 1, 0, "quiet");
      const sight = {
        visible: clearSample.visible, state: source.ai.state, reason: source.ai.transitionReason,
        detection: source.ai.detection, shared: listener.ai.state === "suspicious",
        alertsShared: garrisonAIStats.alertsShared - alertsBefore
      };

      primeGarrisonProbeState(source);
      source.ai.testBlindTime = 1;
      const hearingDistance = distance2D(source.root.position, player.root.position);
      updateEnemyPerception(source, .05, hearingDistance + 1, "test-footstep");
      const hearing = {
        state: source.ai.state, reason: source.ai.transitionReason,
        lastKnownUpdated: distance2D(source.ai.lastKnown, player.root.position) < .01,
        distance: hearingDistance
      };

      listener.root.position.set(source.root.position.x + .8, source.root.position.y, source.root.position.z);
      const separationDirection = new THREE.Vector3(1, 0, 0);
      const away = new THREE.Vector3(-1, 0, 0);
      const beforeAwayDot = separationDirection.dot(away);
      applyGroundEnemySeparation(source, separationDirection);
      if (separationDirection.lengthSq() > .001) separationDirection.normalize();
      const separation = { beforeAwayDot, afterAwayDot: separationDirection.dot(away), steersApart: separationDirection.dot(away) > beforeAwayDot + .2 };
      return { available: true, sight, hearing, separation };
    } finally {
      actorStates.forEach(restoreGarrisonActorState);
      player.root.position.copy(savedPlayerPosition);
      garrisonAIStats = savedStats;
    }
  }

  function garrisonOcclusionProbe() {
    const box = colliders.find((candidate) => Number.isFinite(candidate.minY) && Number.isFinite(candidate.maxY)
      && candidate.maxY - candidate.minY >= 1.4 && candidate.hx >= .18 && candidate.hz >= .18);
    if (!box) return { available: false, colliders: colliders.length };
    const cosine = Math.cos(box.rotation || 0);
    const sine = Math.sin(box.rotation || 0);
    const toWorld = (localX, localZ, y) => new THREE.Vector3(box.x + localX * cosine + localZ * sine, y, box.z - localX * sine + localZ * cosine);
    const y = clamp(terrainHeight(box.x, box.z) + 1.45, box.minY + .18, box.maxY - .18);
    const margin = 2.2;
    const from = toWorld(-box.hx - margin, 0, y);
    const to = toWorld(box.hx + margin, 0, y);
    const clearFrom = toWorld(-box.hx - margin, box.hz + margin, y);
    const clearTo = toWorld(box.hx + margin, box.hz + margin, y);
    return {
      available: true,
      colliderBlocks: segmentIntersectsCollider(from, to, box, .035),
      worldOccluded: segmentOccluded(from, to),
      parallelControlBlocked: segmentIntersectsCollider(clearFrom, clearTo, box, .035),
      height: box.maxY - box.minY
    };
  }

  function garrisonSearchProbe() {
    const enemy = groundEnemies.find((item) => !item.dead && !item.tamed && item.ai && !item.telegraph);
    if (!enemy) return { available: false };
    const ai = enemy.ai;
    const saved = captureGarrisonActorState(enemy);
    try {
      ai.state = "combat";
      ai.detection = 1;
      ai.lostSight = 1.34;
      ai.lastKnown.copy(player.root.position).add(new THREE.Vector3(3, 0, -2));
      ai.testBlindTime = 2;
      updateEnemyPerception(enemy, .03, 0, "quiet");
      return { available: true, state: ai.state, reason: ai.transitionReason, lastKnownPreserved: distance2D(ai.lastKnown, player.root.position) > 1, searchSeconds: ai.searchRemaining };
    } finally {
      restoreGarrisonActorState(saved);
    }
  }

  function garrisonStuckRecoveryProbe() {
    const enemy = groundEnemies.find((item) => !item.dead && !item.tamed && item.ai && !item.telegraph);
    if (!enemy) return { available: false };
    let sample = null;
    for (let index = 0; index < colliders.length && !sample; index += 1) {
      const box = colliders[index];
      if (!Number.isFinite(box.minY) || !Number.isFinite(box.maxY) || box.maxY - box.minY < .8) continue;
      const footY = clamp(terrainHeight(box.x, box.z), box.minY + .04, box.maxY - .2);
      if (hitsCollider(box.x, box.z, enemy.hitRadius * .42, footY, footY + 3.35)) sample = { box, footY };
    }
    if (!sample) return { available: false, colliders: colliders.length };
    const saved = captureGarrisonActorState(enemy);
    const savedStats = Object.assign({}, garrisonAIStats);
    try {
      enemy.root.position.set(sample.box.x, sample.footY, sample.box.z);
      primeGarrisonProbeState(enemy);
      enemy.ai.moveMode = "run";
      const blockedBefore = hitsCollider(enemy.root.position.x, enemy.root.position.z, enemy.hitRadius * .42, enemy.root.position.y, enemy.root.position.y + 3.35);
      const target = distance2D(enemy.root.position, enemy.ai.home) > 5 ? enemy.ai.home : enemy.root.position.clone().add(new THREE.Vector3(12, 0, 0));
      moveGroundEnemyToward(enemy, target, Math.max(1, enemy.speed), .82);
      const blockedAfter = hitsCollider(enemy.root.position.x, enemy.root.position.z, enemy.hitRadius * .42, enemy.root.position.y, enemy.root.position.y + 3.35);
      const displacement = Math.hypot(enemy.root.position.x - sample.box.x, enemy.root.position.z - sample.box.z);
      return {
        available: true, blockedBefore, recovered: enemy.ai.recoveries > saved.ai.recoveries,
        automatic: enemy.ai.stuckCount > saved.ai.stuckCount, blockedAfter, displacement,
        repaths: garrisonAIStats.repaths - savedStats.repaths
      };
    } finally {
      restoreGarrisonActorState(saved);
      garrisonAIStats = savedStats;
    }
  }

  function garrisonPathProbe() {
    const candidates = groundEnemies.filter((enemy) => !enemy.dead && !enemy.tamed && enemy.ai && enemy.strongholdId);
    for (let enemyIndex = 0; enemyIndex < candidates.length; enemyIndex += 1) {
      const enemy = candidates[enemyIndex];
      const stronghold = strongholds.find((item) => item.id === enemy.strongholdId);
      const grid = buildStrongholdNavGrid(stronghold);
      if (!grid) continue;
      const targets = [];
      for (let index = 0; index < grid.walkable.length; index += 1) {
        if (!grid.walkable[index]) continue;
        const column = index % grid.size;
        const row = Math.floor(index / grid.size);
        const x = grid.originX + column * grid.cell;
        const z = grid.originZ + row * grid.cell;
        targets.push({ x, z, distance: Math.hypot(x - enemy.root.position.x, z - enemy.root.position.z) });
      }
      targets.sort((a, b) => b.distance - a.distance);
      for (let targetIndex = 0; targetIndex < Math.min(12, targets.length); targetIndex += 1) {
        const target = new THREE.Vector3(targets[targetIndex].x, 0, targets[targetIndex].z);
        const path = findStrongholdNavPath(enemy, target);
        if (!path.length) continue;
        return {
          available: true, strongholdId: stronghold.id, gridCells: grid.walkableCount,
          waypoints: path.length, distance: targets[targetIndex].distance,
          allWalkable: path.every((point) => enemyNavPointWalkable(point.x, point.z, .5))
        };
      }
    }
    return { available: false, navGrids: strongholds.filter((stronghold) => stronghold.navGrid).length };
  }

  function interact() {
    if (state !== "playing") return false;
    const tameCandidate = nearestTameCandidate(11);
    return (tameCandidate ? tameEnemy(tameCandidate) : false) || collectExperienceRune(nearestExperienceRune(11)) || collectDragonSoul(nearestDragonSoul(11)) || openChest(nearestChest(11));
  }


  function resetActors(savedRun) {
    resetStylizedWaterRipples();
    dragons.forEach((dragon) => { clearDragonFireTelegraph(dragon); scene.remove(dragon.root); dragon.root.traverse((object) => { if (object.geometry && object.geometry.dispose) object.geometry.dispose(); }); });
    groundEnemies.forEach((enemy) => { scene.remove(enemy.root); disposeGroundEnemy(enemy); });
    bolts.forEach((bolt) => { scene.remove(bolt.mesh); bolt.mesh.traverse((object) => { if (object.geometry) object.geometry.dispose(); if (object.material) object.material.dispose(); }); });
    fireballs.forEach((ball) => { scene.remove(ball.mesh); ball.mesh.geometry.dispose(); ball.mesh.material.dispose(); });
    effects.forEach((effect) => { scene.remove(effect.mesh); effect.mesh.geometry.dispose(); effect.mesh.material.dispose(); });
    dragons = [];
    groundEnemies = [];
    bolts = [];
    fireballs = [];
    effects = [];
    dragonSouls.forEach(removeDragonSoul);
    dragonSouls = [];
    bossSpawned = false;
    garrisonAIStats = { repaths: 0, stuckRecoveries: 0, alertsShared: 0 };
    playerNoiseRadius = 0;
    playerNoiseTime = 0;
    playerNoiseReason = "quiet";
    worldLayout.forts.forEach((fort, index) => {
      const angle = Math.atan2(fort[1], fort[0]) + .55;
      const fortProfile = WORLD_PROFILES[fort[5] || biomeIdAt(fort[0], fort[1])] || WORLD_PROFILES.jungle;
      createDragon(fortProfile.dragonNames[index % fortProfile.dragonNames.length], clamp(fort[0] + Math.cos(angle) * 62, -760, 760), clamp(fort[1] + Math.sin(angle) * 62, -760, 760), false, "dragon-fort-" + index);
    });
    const wanderAngle = seeded(worldLayout.salt + 1600) * Math.PI * 2;
    createDragon(worldProfile.dragonNames[3], Math.cos(wanderAngle) * 360, Math.sin(wanderAngle) * 360, false, "dragon-roamer-0");
    // Garrisons are world gen: seeded spots from registerStronghold, spawned with level-scaled
    // count and promotions, with the encounter RNG stream restored so combat stays deterministic.
    const garrisonRngState = encounterRng.state;
    const handledMemberKeys = new Set(savedRun && savedRun.world && Array.isArray(savedRun.world.handledStrongholdMembers) ? savedRun.world.handledStrongholdMembers : []);
    strongholds.forEach((stronghold) => {
      stronghold.members = [];
      buildStrongholdNavGrid(stronghold);
      if (stronghold.cleared) return;
      const base = STRONGHOLD_GARRISONS[stronghold.kind] || STRONGHOLD_GARRISONS.hamlet;
      const countBonus = Math.min(4, Math.floor((player.level - 1) / 6));
      const promoteRoll = Math.min(.45, player.level * .02);
      const golemCount = base.golem + ((stronghold.kind === "fort" && player.level >= 10) || (stronghold.kind === "keep" && player.level >= 14) ? 1 : 0);
      const threat = ambientDifficulty();
      const plan = stronghold.spots.filter((spot) => spot.type === "biomeHeavy" || spot.type === "warg")
        .concat(stronghold.spots.filter((spot) => spot.type === "golem").slice(0, golemCount))
        .concat(stronghold.spots.filter((spot) => spot.type === "biomeLight").slice(0, base.light + countBonus)
          .map((spot) => Object.assign({}, spot, { type: spot.roll < promoteRoll ? "biomeHeavy" : "biomeLight" })));
      plan.forEach((spot, memberIndex) => {
        const spawnKey = stronghold.id + ":slot-" + (Number.isInteger(spot.slotIndex) ? spot.slotIndex : memberIndex);
        const legacySpawnKey = stronghold.id + ":" + Math.round(spot.x * 10) + ":" + Math.round(spot.z * 10);
        if (handledMemberKeys.has(spawnKey) || handledMemberKeys.has(legacySpawnKey)) return;
        const enemy = createGroundEnemy(spot.type, spot.x, spot.z, threat);
        enemy.strongholdId = stronghold.id;
        enemy.spawnKey = spawnKey;
        enemy.networkId = "garrison-" + networkIdPart(spawnKey);
        enemy.camp = { x: stronghold.x, z: stronghold.z, radius: stronghold.kind === "keep" ? 40 : 30 };
        enemy.name = stronghold.name + " " + enemy.name;
        assignGarrisonAI(enemy, stronghold, spot, memberIndex);
        stronghold.members.push(enemy);
      });
    });
    encounterRng.state = garrisonRngState;
    refreshAdminActorEntities();
  }

  function createLandmarks() {
    const routeSummits = worldLayout.routes.map((route) => platforms.filter((platform) => platform.routeId === route[5]).sort((a, b) => b.stepIndex - a.stepIndex)[0]);
    landmarks = [
      { id: "pass", name: "ASHENHOLD CONTINENT GATE", position: new THREE.Vector3(START.x, 0, START.z - 28), radius: 32, discovered: false, revealed: false },
      { id: "keep", name: "ASHENHOLD KEEP", position: RUINS.clone(), radius: 44, discovered: false, revealed: false },
      { id: "hollow", name: "RUNE HOLLOW", position: RUNE_HOLLOW.clone(), radius: 24, discovered: false, revealed: false }
    ].concat(worldLayout.forts.map((fort, index) => ({
      id: "fort-" + index, name: fort[4], position: new THREE.Vector3(fort[0], 0, fort[1]), radius: 48, discovered: false, revealed: false, outpost: true
    }))).concat(routeSummits.filter(Boolean).map((summit, index) => ({
      id: "route-" + index, name: worldLayout.routes[index][5], position: new THREE.Vector3(summit.x, summit.y, summit.z), radius: 38, discovered: false, revealed: false
    }))).concat((worldLayout.pois || []).map((poi, index) => ({
      id: "poi-" + index, name: poi.name, position: new THREE.Vector3(poi.x, 0, poi.z), radius: 30, discovered: false, revealed: false, poi: true
    })));
  }

  function resetTraversalMotion() {
    player.sliding = false;
    player.slideSpeed = 0;
    player.slideDirection.set(0, 0, -1);
    player.slideTime = 0;
    player.slideSlopeDegrees = 0;
    player.slideInputPressed = false;
    player.slideExitBlocked = false;
    player.slideCollision = false;
    player.slideFxTimer = 0;
    player.mobileSlideHeld = false;
    player.airMomentum.set(0, 0, 0);
    player.groundMomentum.set(0, 0, 0);
    player.wading = false;
    player.lastJumpTelemetry = null;
    player.airbornePhase = "grounded";
    player.landingTime = 0;
    player.landingImpact = 0;
    if (player.modelRoot) player.modelRoot.position.y = player.modelHasClips ? 0 : WARDEN_MODEL_Y_OFFSET;
  }

  function startGame(forceFresh, networkReason) {
    if (!partyStartAllowed(networkReason)) return false;
    if (state === "playing") {
      if (partyModeSelected()) coopRuntime?.startWorld();
      return true;
    }
    if (state === "ended" && !testMode) {
      window.location.reload();
      return false;
    }
    const networkGuest = partyModeSelected() && partyController()?.client && !partyController().client.isHost;
    const resumeSave = !networkGuest && !forceFresh && pendingRunState;
    if (forceFresh) clearActiveRun();
    runResolving = false;
    audio.init();
    outpostsDiscovered = 0;
    runeHinted = false;
    encounterRng.state = (AUTHORED_WORLD_VARIATION ^ 0x6d2b79f5) >>> 0;
    strongholds.forEach((stronghold) => { stronghold.cleared = false; stronghold.members = []; updateStrongholdMarker(stronghold); });
    if (resumeSave) applySavedStrongholds(resumeSave);
    resetExperienceRunes();
    resetChests();
    resetActors(resumeSave);
    player.health = maxHealth();
    player.stamina = maxStamina();
    player.shout = 0;
    player.vertical = 0;
    player.velocityY = 0;
    player.grounded = true;
    player.sprintLatch = false;
    player.superSprintLatch = false;
    player.sprintExhausted = false;
    player.sprinting = false;
    player.superSprinting = false;
    resetTraversalMotion();
    player.stormstrideTimer = 0;
    player.attackCooldown = 0;
    player.attackTime = 0;
    player.queuedWeapon = null;
    player.kills = 0;
    player.dragonKills = 0;
    player.distance = 0;
    player.lastDamage = -100;
    player.secondWindReady = true;
    player.root.position.set(START.x, terrainHeight(START.x, START.z), START.z);
    player.lastSafePosition.copy(player.root.position);
    player.root.rotation.y = 0;
    setPlayerModelAction("idle", true);
    cameraYaw = 0;
    cameraPitch = .12;
    cameraDistance = 8.2;
    equipWeapon(player.activeWeapon, true);
    questStage = 0;
    discoveredCells = new Set();
    landmarks.forEach((landmark) => { landmark.discovered = false; landmark.revealed = false; });
    if (hasSkill("realmwalker")) {
      const openingRoute = landmarks.find((landmark) => landmark.id === "route-0");
      if (openingRoute) openingRoute.revealed = true;
    }
    if (!resumeSave) {
      player.runLevel = 1;
      player.runXp = hasSkill("realmwalker") ? 60 : 0;
      player.runSkillPoints = 0;
      player.runSkills = {};
      activeRunId = "continent-" + Date.now().toString(36);
    }
    const resumed = Boolean(resumeSave && restoreActiveRun(resumeSave));
    updateActiveBiomePresentation(true);
    nearestTarget = null;
    state = "playing";
    game.dataset.state = state;
    ui.title.classList.remove("active");
    ui.pause.classList.remove("active");
    ui.skills.classList.remove("active");
    ui.end.classList.remove("active", "victory");
    updateQuestUI();
    updateProgressionUI();
    updateStrongholdUI();
    updateCamera(1, true);
    if (!isCoarse && !testMode && !adminMode) requestPointer();
    showLocation(BIOMES[currentBiomeId].name, resumed ? "CAMPAIGN RESTORED" : "ENTERING ASHENHOLD CONTINENT");
    markRunDirty(true);
    if (partyModeSelected()) coopRuntime?.startWorld();
    return true;
  }

  function requestPointer() {
    if (renderer && renderer.domElement.requestPointerLock) renderer.domElement.requestPointerLock();
  }

  function pauseGame(forcePause) {
    if (state !== "playing" && state !== "paused") return;
    const pause = typeof forcePause === "boolean" ? forcePause : state === "playing";
    if (pause && state === "playing") {
      markRunDirty(true);
      state = "paused";
      game.dataset.state = state;
      ui.pause.classList.add("active");
      ui.resume.focus({ preventScroll: true });
      if (document.pointerLockElement) {
        suppressPointerPause = true;
        document.exitPointerLock();
        window.setTimeout(() => { suppressPointerPause = false; }, 100);
      }
    } else if (!pause && state === "paused") {
      state = "playing";
      game.dataset.state = state;
      ui.pause.classList.remove("active");
      lastTime = performance.now();
      audio.init();
      if (!isCoarse && !testMode && !adminMode) requestPointer();
    }
  }

  function surfaceHeightAt(x, z, footY) {
    let height = terrainHeight(x, z);
    platforms.forEach((platform) => {
      if (platform.disabled) return;
      const dx = x - platform.x;
      const dz = z - platform.z;
      const cosine = Math.cos(platform.rotation || 0);
      const sine = Math.sin(platform.rotation || 0);
      const localX = dx * cosine - dz * sine;
      const localZ = dx * sine + dz * cosine;
      if (Math.abs(localX) <= platform.hx && Math.abs(localZ) <= platform.hz && platform.y <= footY + .85) height = Math.max(height, platform.y);
    });
    return height;
  }

  function shoreWaterSurfaceAt(x, z) {
    const shore = CONTINENT_ZONE_BY_ID.get("shore");
    if (!shore || Math.hypot(x - shore.center.x, z - shore.center.z) > SHORE_WATER_RADIUS) return null;
    return BIOMES.shore.waterLevel;
  }

  function playerSurfaceHeightAt(x, z, footY) {
    const surface = surfaceHeightAt(x, z, footY);
    const waterSurface = shoreWaterSurfaceAt(x, z);
    if (waterSurface === null || surface > waterSurface + WATERLINE_MARGIN) return surface;
    return Math.max(surface, waterSurface - PLAYER_WADING_DEPTH);
  }

  function isPlayerWadingAt(x, z, footY) {
    const waterSurface = shoreWaterSurfaceAt(x, z);
    if (waterSurface === null) return false;
    const surface = surfaceHeightAt(x, z, footY + .9);
    return surface <= waterSurface + WATERLINE_MARGIN && footY <= waterSurface + .12;
  }

  function strideSprintPower() {
    return 1 + skillRank("gale_pace") * .15 + relicBonus("sprint") / 100 + bondedPaceBonus();
  }

  function strideSuperPower() {
    return 1 + skillRank("windstep") * .055 + skillRank("gale_pace") * .1 + skillRank("tempest_pace") * .25 + (hasSkill("stormstride") ? .25 : 0) + relicBonus("sprint") / 100 + bondedPaceBonus();
  }

  function terrainDescentInfo(direction, position) {
    const origin = position || player.root.position;
    const heading = direction.clone().setY(0);
    if (heading.lengthSq() < .0001) heading.set(0, 0, -1);
    heading.normalize();
    const sample = 1.8;
    const current = terrainHeight(origin.x, origin.z);
    const ahead = terrainHeight(origin.x + heading.x * sample, origin.z + heading.z * sample);
    const crossSample = 1.25;
    const gradientX = (terrainHeight(origin.x + crossSample, origin.z) - terrainHeight(origin.x - crossSample, origin.z)) / (crossSample * 2);
    const gradientZ = (terrainHeight(origin.x, origin.z + crossSample) - terrainHeight(origin.x, origin.z - crossSample)) / (crossSample * 2);
    const downhill = new THREE.Vector3(-gradientX, 0, -gradientZ);
    if (downhill.lengthSq() < .0001) downhill.copy(heading);
    else downhill.normalize();
    return {
      angle: Math.atan2(current - ahead, sample) * 180 / Math.PI,
      steepness: Math.atan(Math.hypot(gradientX, gradientZ)) * 180 / Math.PI,
      current,
      ahead,
      downhill,
      onTerrain: Math.abs(origin.y - current) <= .48,
      aboveWater: current > waterLevelAt(origin.x, origin.z) + .35
    };
  }

  function canStandAtPlayer() {
    return !hitsCollider(player.root.position.x, player.root.position.z, .72, player.root.position.y, player.root.position.y + 2.15);
  }

  function beginSlide(direction, slope) {
    if (!player.root || !direction || direction.lengthSq() < .001 || !player.grounded || player.sliding || player.dodgeTime > 0 || player.attackTime > 0 || player.stamina <= 8) return false;
    const descent = slope || terrainDescentInfo(direction);
    if (!descent.onTerrain || !descent.aboveWater || descent.angle < 8) return false;
    player.sliding = true;
    player.slideDirection.copy(direction).setY(0).normalize();
    player.slideSpeed = Math.max(13.5, 17.2 * strideSprintPower());
    player.slideTime = 0;
    player.slideSlopeDegrees = descent.angle;
    player.slideExitBlocked = false;
    player.slideCollision = false;
    player.slideFxTimer = 0;
    player.sprintLatch = false;
    player.superSprintLatch = false;
    player.sprinting = false;
    player.superSprinting = false;
    audio.tone(92, 58, .15, "triangle", .014);
    showMessage("DOWNHILL SLIDE", "#e8c98c");
    return true;
  }

  function finishSlide(forceAirborne) {
    if (!player.sliding) return true;
    if (!forceAirborne && player.grounded && !canStandAtPlayer()) {
      player.slideExitBlocked = true;
      player.slideSpeed = Math.min(player.slideSpeed, 2.5);
      return false;
    }
    player.sliding = false;
    player.slideExitBlocked = false;
    player.slideSpeed = forceAirborne ? player.slideSpeed : 0;
    player.slideSlopeDegrees = 0;
    return true;
  }

  function updateSlide(dt, inputDirection, slideHeld) {
    if (!player.sliding) return false;
    if (!player.grounded) {
      player.airMomentum.copy(player.slideDirection).multiplyScalar(player.slideSpeed);
      finishSlide(true);
      return false;
    }
    const terrain = terrainHeight(player.root.position.x, player.root.position.z);
    if (!slideHeld || player.attackTime > 0 || player.dodgeTime > 0 || terrain <= waterLevelAt(player.root.position.x, player.root.position.z) + .35 || Math.abs(player.root.position.y - terrain) > .48) {
      if (finishSlide(false)) return false;
    }
    if (inputDirection && inputDirection.lengthSq() > .01) {
      const steering = inputDirection.clone().setY(0).normalize();
      if (steering.dot(player.slideDirection) > -.15) player.slideDirection.lerp(steering, clamp(dt * 1.25, 0, .18)).normalize();
    }
    const descent = terrainDescentInfo(player.slideDirection);
    player.slideSlopeDegrees = descent.angle;
    player.slideDirection.lerp(descent.downhill, clamp(dt * .72, 0, .11)).normalize();
    if (descent.angle < -4) {
      if (finishSlide(false)) return false;
    }
    const slopeAcceleration = Math.sin(Math.max(0, descent.angle) * Math.PI / 180) * 30;
    const friction = descent.angle >= 4 ? 2.4 : descent.angle > 0 ? 6.5 : 12.5;
    player.slideSpeed = clamp(player.slideSpeed + (slopeAcceleration - friction) * dt, 0, 43 * Math.min(1.45, strideSprintPower()));
    const marathonEfficiency = clamp(1 - skillRank("marathon") * .25, .35, 1);
    player.stamina = Math.max(0, player.stamina - 5 * marathonEfficiency * dt);
    const intended = player.slideSpeed * dt;
    const startX = player.root.position.x;
    const startZ = player.root.position.z;
    const moved = movePlayer(player.slideDirection.x * intended, player.slideDirection.z * intended);
    const forwardProgress = (player.root.position.x - startX) * player.slideDirection.x + (player.root.position.z - startZ) * player.slideDirection.z;
    player.distance += moved;
    player.slideTime += dt;
    player.moving = moved > .001;
    player.root.rotation.y = rotateToward(player.root.rotation.y, Math.atan2(-player.slideDirection.x, -player.slideDirection.z), dt * 12);
    if (intended > .04 && forwardProgress < intended * .32) {
      player.slideCollision = true;
      player.slideSpeed *= .28;
      cameraTrauma = Math.max(cameraTrauma, .18);
      if (finishSlide(false)) return false;
    }
    if (player.slideSpeed < 4.5 && player.slideTime > .2 && finishSlide(false)) return false;
    player.slideFxTimer -= dt;
    if (!isCoarse && !reducedMotion && player.slideFxTimer <= 0) {
      player.slideFxTimer = .075;
      spawnSlideDust();
    }
    return player.sliding;
  }

  function updatePlayer(dt) {
    const previousAttackTime = player.attackTime;
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    player.attackTime = Math.max(0, player.attackTime - dt);
    player.dodgeCooldown = Math.max(0, player.dodgeCooldown - dt);
    if (player.dodgeTime > 0) {
      player.dodgeTime = Math.max(0, player.dodgeTime - dt);
      player.dodgeElapsed += dt;
    }
    if (player.pendingAttack && !player.pendingAttack.executed && previousAttackTime > player.pendingAttack.releaseAt && player.attackTime <= player.pendingAttack.releaseAt) {
      player.pendingAttack.executed = true;
      releasePlayerAttack(player.pendingAttack.weaponId);
    }
    if (player.attackTime <= 0) player.pendingAttack = null;
    if (player.attackTime <= 0 && player.queuedWeapon) {
      const queuedWeapon = player.queuedWeapon;
      player.queuedWeapon = null;
      equipWeapon(queuedWeapon);
    }
    player.hitReaction = Math.max(0, player.hitReaction - dt);
    player.resonanceTime = Math.max(0, player.resonanceTime - dt);
    player.rampageTime = Math.max(0, player.rampageTime - dt);
    if (elapsed >= player.comboExpires) player.comboHits = 0;
    if (elapsed - player.lastDamage > 10) {
      const healthRecovery = 1.8 * (1 + relicBonus("regen") / 100) * (hasSkill("immortal_warden") && player.health < maxHealth() * .4 ? 2 : 1);
      player.health = Math.min(maxHealth(), player.health + healthRecovery * dt);
    }

    let inputX = 0;
    let inputZ = 0;
    if (keys.has("a") || keys.has("arrowleft")) inputX -= 1;
    if (keys.has("d") || keys.has("arrowright")) inputX += 1;
    if (keys.has("w") || keys.has("arrowup")) inputZ += 1;
    if (keys.has("s") || keys.has("arrowdown")) inputZ -= 1;
    inputX += mobileMove.x;
    inputZ += -mobileMove.y;
    const magnitude = Math.hypot(inputX, inputZ);
    let moving = magnitude > .08;
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const inputDirection = moving ? forward.clone().multiplyScalar(inputZ / Math.max(1, magnitude)).add(right.clone().multiplyScalar(inputX / Math.max(1, magnitude))).normalize() : null;
    player.moving = moving || player.sliding;
    const wasSuperSprinting = player.superSprinting;
    const slideHeld = keys.has("control") || player.mobileSlideHeld;
    const touchSuperSprint = isCoarse && magnitude > .92 && !player.mobileSlideHeld;
    const rawWantsSuperSprint = moving && (keys.has("control") || player.mobileSlideHeld || touchSuperSprint);
    const wantsSprint = moving && (rawWantsSuperSprint || keys.has("shift") || (isCoarse && magnitude > .68) || magnitude > 1.15);
    if (player.slideInputPressed && inputDirection && wantsSprint && !player.sprintExhausted) beginSlide(inputDirection, terrainDescentInfo(inputDirection));
    player.slideInputPressed = false;
    const wantsSuperSprint = rawWantsSuperSprint && !player.sliding;
    if (player.stamina <= 0) player.sprintExhausted = true;
    if (player.sprintExhausted && player.stamina >= 10) player.sprintExhausted = false;
    if (!wantsSprint || player.sprintExhausted) player.sprintLatch = false;
    else if (!player.sprintLatch && player.stamina > 8) player.sprintLatch = true;
    else if (player.sprintLatch && player.stamina <= 2) player.sprintLatch = false;
    if (!wantsSuperSprint || player.sprintExhausted) player.superSprintLatch = false;
    else if (!player.superSprintLatch && player.stamina > 12) player.superSprintLatch = true;
    else if (player.superSprintLatch && player.stamina <= 5) player.superSprintLatch = false;
    if (player.superSprintLatch) player.sprintLatch = true;
    player.superSprinting = moving && player.grounded && !player.sliding && player.dodgeTime <= 0 && player.superSprintLatch;
    player.sprinting = moving && player.grounded && !player.sliding && player.dodgeTime <= 0 && (player.sprintLatch || player.superSprinting);
    const staminaRecovery = (moving ? 16 : 25) * (1 + skillRank("endurance") * .06) * (1 + relicBonus("regen") / 100)
      * (player.sprinting ? 1 + skillRank("second_lungs") * .3 : 1);
    if (!player.sliding) player.stamina = Math.min(maxStamina(), player.stamina + staminaRecovery * dt);
    if (!wasSuperSprinting && player.superSprinting && hasSkill("stormlaunch")) triggerStormlaunch();

    let groundMotionApplied = false;
    if (player.sliding) {
      moving = updateSlide(dt, inputDirection, slideHeld) || moving;
      if (player.sliding) player.groundMomentum.copy(player.slideDirection).multiplyScalar(player.slideSpeed);
    } else if (player.dodgeTime > 0) {
      moving = true;
      const dodgeProgress = clamp(player.dodgeElapsed / .58, 0, 1);
      const dodgeSpeed = lerp(21, 7.5, dodgeProgress);
      const moved = movePlayer(player.dodgeDirection.x * dodgeSpeed * dt, player.dodgeDirection.z * dodgeSpeed * dt);
      player.groundMomentum.copy(player.dodgeDirection).multiplyScalar(dodgeSpeed);
      groundMotionApplied = true;
      player.root.rotation.y = rotateToward(player.root.rotation.y, Math.atan2(-player.dodgeDirection.x, -player.dodgeDirection.z), dt * 18);
      player.distance += moved;
    } else if (moving && player.grounded) {
      inputX /= Math.max(1, magnitude);
      inputZ /= Math.max(1, magnitude);
      const direction = inputDirection;
      const superSprinting = player.superSprinting;
      const sprinting = player.sprinting;
      const sprintPower = strideSprintPower();
      const superPower = strideSuperPower();
      const speed = superSprinting ? 25.5 * superPower : sprinting ? 17.2 * sprintPower : 7.8;
      const marathonEfficiency = clamp(1 - skillRank("marathon") * .25, .35, 1);
      if (superSprinting) player.stamina = Math.max(0, player.stamina - 34 * marathonEfficiency * (1 - skillRank("windstep") * .09) * dt);
      else if (sprinting) player.stamina = Math.max(0, player.stamina - 21 * marathonEfficiency * dt);
      if (player.stamina <= 0) {
        player.sprintExhausted = true;
        player.sprintLatch = false;
        player.superSprintLatch = false;
        player.sprinting = false;
        player.superSprinting = false;
      }
      const dx = direction.x * speed * dt;
      const dz = direction.z * speed * dt;
      player.distance += movePlayer(dx, dz);
      player.groundMomentum.copy(direction).multiplyScalar(speed);
      groundMotionApplied = true;
      const desiredRotation = Math.atan2(-direction.x, -direction.z);
      player.root.rotation.y = rotateToward(player.root.rotation.y, desiredRotation, dt * (superSprinting ? 14 : sprinting ? 11 : 9));
      player.walkCycle += dt * (superSprinting ? 24 : sprinting ? 17.5 : 9.2);
    }

    if (player.grounded && !player.sliding && player.dodgeTime <= 0 && !groundMotionApplied) {
      player.groundMomentum.multiplyScalar(Math.pow(.02, dt));
      if (player.groundMomentum.lengthSq() < .04) player.groundMomentum.set(0, 0, 0);
    }

    if (!player.grounded && player.airMomentum.lengthSq() > .01) {
      if (inputDirection && inputDirection.dot(player.airMomentum) > -player.airMomentum.length() * .25) {
        const steered = inputDirection.clone().multiplyScalar(player.airMomentum.length());
        player.airMomentum.lerp(steered, clamp(dt * .55, 0, .08));
      }
      player.distance += movePlayer(player.airMomentum.x * dt, player.airMomentum.z * dt);
      player.airMomentum.multiplyScalar(Math.pow(.96, dt));
      if (player.airMomentum.lengthSq() < .04) player.airMomentum.set(0, 0, 0);
      if (player.lastJumpTelemetry) player.lastJumpTelemetry.airborneSpeed = player.airMomentum.length();
    }

    updateStormstrideTrail(dt);

    const currentY = player.root.position.y;
    const landingHeight = playerSurfaceHeightAt(player.root.position.x, player.root.position.z, currentY);
    if (player.grounded && currentY - landingHeight > .9) {
      if (player.sliding) {
        player.airMomentum.copy(player.slideDirection).multiplyScalar(player.slideSpeed);
        finishSlide(true);
      } else player.airMomentum.copy(player.groundMomentum);
      player.grounded = false;
      player.velocityY = Math.min(0, player.velocityY);
      player.jumpTime = 0;
      player.airbornePhase = "fall";
    }
    if (!player.grounded) {
      player.jumpTime += dt;
      player.velocityY -= 20.5 * dt;
      player.airbornePhase = player.jumpTime < .1 && player.velocityY > 0 ? "jump" : player.velocityY > 2 ? "rise" : player.velocityY > -2 ? "apex" : "fall";
      const nextY = player.root.position.y + player.velocityY * dt;
      const surface = playerSurfaceHeightAt(player.root.position.x, player.root.position.z, player.root.position.y + .9);
      if (player.velocityY <= 0 && nextY <= surface) {
        const impact = Math.abs(player.velocityY);
        player.root.position.y = surface;
        player.velocityY = 0;
        player.grounded = true;
        player.jumpTime = 0;
        player.airMomentum.multiplyScalar(.35);
        player.airbornePhase = "land";
        player.landingTime = impact > 13 ? .28 : .18;
        player.landingImpact = impact;
        if (impact > 13) {
          cameraTrauma = Math.max(cameraTrauma, .2);
          createShockwave(player.root.position.clone(), 2.2, .2, 0x9a8770);
        }
      } else player.root.position.y = nextY;
    } else {
      player.root.position.y = landingHeight;
      player.landingTime = Math.max(0, player.landingTime - dt);
      if (player.landingTime <= 0) player.airbornePhase = "grounded";
    }
    recoverPlayerFromCollision();
    if (player.grounded && !hitsCollider(player.root.position.x, player.root.position.z, .68, player.root.position.y, player.root.position.y + (player.sliding ? 1.15 : 2.1))) player.lastSafePosition.copy(player.root.position);
    player.wading = player.grounded && isPlayerWadingAt(player.root.position.x, player.root.position.z, player.root.position.y);
    player.vertical = Math.max(0, player.root.position.y - playerSurfaceHeightAt(player.root.position.x, player.root.position.z, player.root.position.y + .9));
    const slideFov = 69 + clamp((player.slideSpeed - 12) * .22, 0, 7);
    camera.fov = lerp(camera.fov, player.sliding ? slideFov : player.superSprinting ? 76 : player.sprinting ? 69 : 62, 1 - Math.pow(.002, dt));
    camera.updateProjectionMatrix();
    player.streakTimer -= dt;
    if (player.superSprinting && player.grounded && !isCoarse && !reducedMotion && player.streakTimer <= 0) {
      player.streakTimer = 1 / 12;
      spawnSpeedStreaks();
    }
    animatePlayer(dt, moving || player.sliding);
    const cellX = Math.floor((player.root.position.x + HALF_WORLD) / 45);
    const cellZ = Math.floor((player.root.position.z + HALF_WORLD) / 45);
    discoveredCells.add(cellX + ":" + cellZ);
    checkLandmarks();
    updateQuest();
  }

  function triggerStormlaunch() {
    const origin = player.root.position.clone();
    const actionId = nextNetworkActionId("stormlaunch");
    createShockwave(origin, 6, .38, 0x8adcf5);
    allEnemies().filter((enemy) => !enemy.dead && distance2D(enemy.root.position, origin) <= 6).forEach((enemy) => {
      damageDragon(enemy, 12, true, "stormlaunch", "staff", actionId);
      if (enemy.impulse) {
        const away = enemy.root.position.clone().sub(origin).setY(0).normalize();
        enemy.impulse.addScaledVector(away, enemy.elite ? 4 : 8);
      }
    });
    audio.tone(92, 240, .14, "sawtooth", .018);
  }

  function updateStormstrideTrail(dt) {
    if (!player.superSprinting || !hasSkill("stormstride")) {
      player.stormstrideTimer = 0;
      return;
    }
    player.stormstrideTimer -= dt;
    if (player.stormstrideTimer > 0) return;
    player.stormstrideTimer = .25;
    const origin = player.root.position.clone();
    const actionId = nextNetworkActionId("stormstride");
    createShockwave(origin, 4, .28, 0x78cfff);
    const targets = allEnemies().filter((enemy) => !enemy.dead && distance2D(enemy.root.position, origin) <= 4);
    targets.forEach((enemy) => damageDragon(enemy, 7, false, "stormstride", "staff", actionId));
    if (targets[0]) createLightningArc(origin.clone().add(new THREE.Vector3(0, .35, 0)), targets[0].root.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x8adcf5);
  }

  function movePlayer(dx, dz) {
    const radius = .72;
    const collisionHeight = player.sliding ? 1.15 : 2.15;
    const startX = player.root.position.x;
    const startZ = player.root.position.z;
    const distance = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(distance / .28));
    const stepX = dx / steps;
    const stepZ = dz / steps;
    for (let index = 0; index < steps; index += 1) {
      const footY = player.root.position.y;
      const candidateX = clamp(player.root.position.x + stepX, -HALF_WORLD, HALF_WORLD);
      const candidateZ = clamp(player.root.position.z + stepZ, -HALF_WORLD, HALF_WORLD);
      if (canPlayerOccupy(candidateX, candidateZ, radius, footY, collisionHeight)) {
        player.root.position.x = candidateX;
        player.root.position.z = candidateZ;
      } else {
        const xOpen = canPlayerOccupy(candidateX, player.root.position.z, radius, footY, collisionHeight);
        const zOpen = canPlayerOccupy(player.root.position.x, candidateZ, radius, footY, collisionHeight);
        if (xOpen && zOpen) {
          if (Math.abs(stepX) >= Math.abs(stepZ)) player.root.position.x = candidateX;
          else player.root.position.z = candidateZ;
        } else if (xOpen) player.root.position.x = candidateX;
        else if (zOpen) player.root.position.z = candidateZ;
      }
      if (player.grounded) {
        const surface = playerSurfaceHeightAt(player.root.position.x, player.root.position.z, player.root.position.y + 1.05);
        if (surface - player.root.position.y <= .92) player.root.position.y = surface;
      }
    }
    return Math.hypot(player.root.position.x - startX, player.root.position.z - startZ);
  }

  function hitsCollider(x, z, radius, footY, topY) {
    const actorBottom = Number.isFinite(footY) ? footY + .08 : -Infinity;
    const actorTop = Number.isFinite(topY) ? topY : Number.isFinite(footY) ? footY + 2.15 : Infinity;
    const collisionRadius = Math.max(.04, radius - .055);
    return colliders.some((box) => {
      if (box.disabled) return false;
      if (actorBottom >= box.maxY - .025 || actorTop <= box.minY + .025) return false;
      const dx = x - box.x;
      const dz = z - box.z;
      const cosine = Math.cos(box.rotation || 0);
      const sine = Math.sin(box.rotation || 0);
      const localX = dx * cosine - dz * sine;
      const localZ = dx * sine + dz * cosine;
      const nearestX = clamp(localX, -box.hx, box.hx);
      const nearestZ = clamp(localZ, -box.hz, box.hz);
      const offsetX = localX - nearestX;
      const offsetZ = localZ - nearestZ;
      return offsetX * offsetX + offsetZ * offsetZ < collisionRadius * collisionRadius;
    });
  }

  function canPlayerOccupy(x, z, radius, footY, height) {
    const collisionHeight = Number.isFinite(height) ? height : player.sliding ? 1.15 : 2.15;
    if (hitsCollider(x, z, radius, footY, footY + collisionHeight)) return false;
    if (!player.grounded) return true;
    const currentSurface = playerSurfaceHeightAt(player.root.position.x, player.root.position.z, footY + .9);
    const nextSurface = playerSurfaceHeightAt(x, z, footY + .9);
    const step = nextSurface - currentSurface;
    if (step > .92) return false;
    const terrain = terrainHeight(x, z);
    const rawNextSurface = surfaceHeightAt(x, z, footY + .9);
    const supportedPlatform = rawNextSurface > terrain + .35;
    const sample = 1.15;
    const slope = Math.max(
      Math.abs(playerSurfaceHeightAt(x + sample, z, footY + .9) - playerSurfaceHeightAt(x - sample, z, footY + .9)),
      Math.abs(playerSurfaceHeightAt(x, z + sample, footY + .9) - playerSurfaceHeightAt(x, z - sample, footY + .9))
    ) / (sample * 2);
    return supportedPlatform || slope <= 1.18;
  }

  function recoverPlayerFromCollision() {
    const collisionHeight = player.sliding ? 1.15 : 2.1;
    if (!player.root || !player.grounded || !hitsCollider(player.root.position.x, player.root.position.z, .68, player.root.position.y, player.root.position.y + collisionHeight)) return false;
    const originX = player.root.position.x;
    const originZ = player.root.position.z;
    for (let ring = 1; ring <= 5; ring += 1) {
      const radius = ring * .38;
      for (let index = 0; index < 16; index += 1) {
        const angle = index / 16 * Math.PI * 2;
        const x = clamp(originX + Math.cos(angle) * radius, -HALF_WORLD, HALF_WORLD);
        const z = clamp(originZ + Math.sin(angle) * radius, -HALF_WORLD, HALF_WORLD);
        if (!canPlayerOccupy(x, z, .68, player.root.position.y, collisionHeight)) continue;
        player.root.position.x = x;
        player.root.position.z = z;
        player.root.position.y = playerSurfaceHeightAt(x, z, player.root.position.y + 1.05);
        return true;
      }
    }
    player.root.position.copy(player.lastSafePosition);
    return true;
  }

  function rotateToward(current, target, amount) {
    let difference = (target - current + Math.PI) % (Math.PI * 2) - Math.PI;
    if (difference < -Math.PI) difference += Math.PI * 2;
    return current + difference * clamp(amount, 0, 1);
  }

  const _sq = new THREE.Quaternion(); const _sq2 = new THREE.Quaternion(); const _sv = new THREE.Vector3();
  const _sprintRight = new THREE.Vector3(); const _sprintUp = new THREE.Vector3(0, 1, 0);
  function addBoneWorldAxisRotation(bone, axisWorld, angle) {
    if (!bone || !angle) return;
    bone.getWorldQuaternion(_sq).invert();
    _sv.copy(axisWorld).applyQuaternion(_sq).normalize();
    bone.quaternion.multiply(_sq2.setFromAxisAngle(_sv, angle));
  }

  // Restore the clean post-mixer pose saved last frame. r128 mixers skip writing
  // constant-value tracks (unchanged-buffer optimization), so without this the
  // overlay accumulates into the bones whenever the current clip holds a bone still.
  function restoreSprintPoseBones() {
    if (!player.sprintPoseApplied) return;
    player.sprintPoseApplied = false;
    if (!player.sprintBones || !player.sprintPoseSnapshot) return;
    Object.keys(player.sprintBones).forEach((key) => {
      if (player.sprintBones[key]) player.sprintBones[key].quaternion.copy(player.sprintPoseSnapshot[key]);
    });
  }

  function capturePlayerPoseBones() {
    if (!player.sprintBones) return false;
    if (player.sprintPoseApplied) return true;
    if (!player.sprintPoseSnapshot) {
      player.sprintPoseSnapshot = {};
      Object.keys(player.sprintBones).forEach((key) => { player.sprintPoseSnapshot[key] = new THREE.Quaternion(); });
    }
    Object.keys(player.sprintBones).forEach((key) => {
      if (player.sprintBones[key]) player.sprintPoseSnapshot[key].copy(player.sprintBones[key].quaternion);
    });
    player.sprintPoseApplied = true;
    return true;
  }

  function updateSprintPose(dt) {
    let target = player.superSprinting ? 1 : player.sprinting ? .65 : 0;
    if (player.dodgeTime > 0 || player.hitReaction > 0 || player.attackTime > 0 || !player.grounded || !player.moving || state !== "playing") target = 0;
    player.sprintPoseWeight = lerp(player.sprintPoseWeight || 0, target, 1 - Math.pow(.001, dt));
    const weight = player.sprintPoseWeight;
    if (weight < .001 || !player.sprintBones) return;
    const bones = player.sprintBones;
    capturePlayerPoseBones();
    _sprintRight.set(1, 0, 0).applyQuaternion(player.root.quaternion);
    // Sign convention (verified via screenshot probe): positive angle about world-right
    // pitches up-pointing bones BACKWARD, so the forward lean uses negative angles.
    // Arms hang down, so the same positive rotation swings the fists FORWARD —
    // swept-back arms therefore also use negative angles.
    addBoneWorldAxisRotation(bones.torso, _sprintRight, -.38 * weight);
    addBoneWorldAxisRotation(bones.abdomen, _sprintRight, -.15 * weight);
    addBoneWorldAxisRotation(bones.neck, _sprintRight, .25 * weight);
    addBoneWorldAxisRotation(bones.head, _sprintRight, .14 * weight);
    addBoneWorldAxisRotation(bones.shoulderL, _sprintRight, .1 * weight);
    addBoneWorldAxisRotation(bones.shoulderR, _sprintRight, .1 * weight);
    addBoneWorldAxisRotation(bones.upperArmL, _sprintRight, -.6 * weight);
    addBoneWorldAxisRotation(bones.upperArmR, _sprintRight, -.6 * weight);
    addBoneWorldAxisRotation(bones.upperArmL, _sprintUp, .18 * weight);
    addBoneWorldAxisRotation(bones.upperArmR, _sprintUp, -.18 * weight);
    addBoneWorldAxisRotation(bones.lowerArmL, _sprintRight, -.2 * weight);
    addBoneWorldAxisRotation(bones.lowerArmR, _sprintRight, -.2 * weight);
  }

  function updateAirborneAndSlideModelPose(dt) {
    if (!player.modelRoot) return;
    const slideWeight = player.sliding ? 1 : 0;
    const airborneWeight = !player.grounded ? 1 : 0;
    const landingWeight = player.grounded && player.landingTime > 0 ? clamp(player.landingTime / .22, 0, 1) : 0;
    const modelBaseY = player.modelHasClips ? 0 : WARDEN_MODEL_Y_OFFSET;
    const targetOffset = modelBaseY + (slideWeight ? -.56 : landingWeight ? -.12 * landingWeight : 0);
    player.modelRoot.position.y = lerp(player.modelRoot.position.y, targetOffset, 1 - Math.pow(.0005, dt));
    if (!player.sprintBones || (!slideWeight && !airborneWeight && !landingWeight)) return;
    capturePlayerPoseBones();
    const bones = player.sprintBones;
    _sprintRight.set(1, 0, 0).applyQuaternion(player.root.quaternion);
    if (slideWeight) {
      addBoneWorldAxisRotation(bones.torso, _sprintRight, -.62);
      addBoneWorldAxisRotation(bones.abdomen, _sprintRight, -.24);
      addBoneWorldAxisRotation(bones.hips, _sprintRight, .32);
      addBoneWorldAxisRotation(bones.upperLegL, _sprintRight, 1.08);
      addBoneWorldAxisRotation(bones.upperLegR, _sprintRight, .72);
      addBoneWorldAxisRotation(bones.lowerLegL, _sprintRight, -1.28);
      addBoneWorldAxisRotation(bones.lowerLegR, _sprintRight, -.94);
      addBoneWorldAxisRotation(bones.upperArmL, _sprintRight, -.64);
      addBoneWorldAxisRotation(bones.upperArmR, _sprintRight, -.48);
    } else if (airborneWeight) {
      const rising = player.airbornePhase === "jump" || player.airbornePhase === "rise";
      const falling = player.airbornePhase === "fall";
      addBoneWorldAxisRotation(bones.torso, _sprintRight, rising ? -.16 : falling ? .12 : -.02);
      addBoneWorldAxisRotation(bones.upperLegL, _sprintRight, rising ? -.58 : .42);
      addBoneWorldAxisRotation(bones.upperLegR, _sprintRight, rising ? .76 : -.28);
      addBoneWorldAxisRotation(bones.lowerLegL, _sprintRight, rising ? .72 : -.52);
      addBoneWorldAxisRotation(bones.lowerLegR, _sprintRight, rising ? -.42 : .66);
      addBoneWorldAxisRotation(bones.upperArmL, _sprintRight, -.38);
      addBoneWorldAxisRotation(bones.upperArmR, _sprintRight, -.22);
    } else if (landingWeight) {
      addBoneWorldAxisRotation(bones.hips, _sprintRight, .16 * landingWeight);
      addBoneWorldAxisRotation(bones.upperLegL, _sprintRight, .34 * landingWeight);
      addBoneWorldAxisRotation(bones.upperLegR, _sprintRight, .34 * landingWeight);
      addBoneWorldAxisRotation(bones.lowerLegL, _sprintRight, -.48 * landingWeight);
      addBoneWorldAxisRotation(bones.lowerLegR, _sprintRight, -.48 * landingWeight);
    }
  }

  function updateStaticWardenPose(dt, groundLocomotion) {
    if (!player.modelRoot || player.modelHasClips) return;
    const settle = 1 - Math.pow(.0008, dt);
    const sprintWeight = player.superSprinting ? 1 : player.sprinting ? .65 : 0;
    const bob = groundLocomotion ? Math.abs(Math.sin(player.walkCycle * 2)) * (.045 + sprintWeight * .07) : 0;
    const landing = player.grounded && player.landingTime > 0 ? clamp(player.landingTime / .22, 0, 1) : 0;
    let targetY = WARDEN_MODEL_Y_OFFSET + (player.sliding ? -.56 : -.12 * landing);
    let targetX = player.sliding ? -.54 : !player.grounded ? (player.velocityY > 0 ? -.12 : .1) : -.18 * sprintWeight;
    let targetZ = groundLocomotion ? Math.sin(player.walkCycle) * (.025 + sprintWeight * .035) : 0;
    let targetYaw = Math.PI;
    if (player.attackTime > 0) {
      const progress = 1 - player.attackTime / player.attackDuration;
      targetYaw += Math.sin(progress * Math.PI) * (player.attackVariant % 2 ? -.36 : .36);
      targetX -= Math.sin(progress * Math.PI) * .12;
    }
    if (player.hitReaction > 0) targetZ += Math.sin(clamp(player.hitReaction / .24, 0, 1) * Math.PI) * .16;
    player.modelRoot.position.y = lerp(player.modelRoot.position.y, targetY + bob, settle);
    player.modelRoot.rotation.x = lerp(player.modelRoot.rotation.x, targetX, settle);
    player.modelRoot.rotation.y = lerp(player.modelRoot.rotation.y, targetYaw, settle);
    player.modelRoot.rotation.z = lerp(player.modelRoot.rotation.z, targetZ, settle);
  }

  function updateWardenRunDeformer(dt, groundLocomotion) {
    const deformer = player.modelRunDeformer;
    if (!deformer) return;
    const canStride = groundLocomotion && player.attackTime <= 0 && player.dodgeTime <= 0 && player.hitReaction <= 0;
    const targetWeight = canStride ? (player.superSprinting ? 1 : player.sprinting ? .88 : .62) : 0;
    const blendRate = targetWeight > deformer.blend ? .00012 : .002;
    deformer.blend = lerp(deformer.blend, targetWeight, 1 - Math.pow(blendRate, dt));
    deformer.uniforms.phase.value = player.walkCycle;
    deformer.uniforms.weight.value = deformer.blend;
    deformer.uniforms.sprint.value = player.superSprinting ? 1 : player.sprinting ? .72 : 0;
  }

  function animatePlayer(dt, moving) {
    const groundLocomotion = moving && player.grounded && !player.sliding;
    const stride = groundLocomotion ? Math.sin(player.walkCycle) : 0;
    const sprint = player.sprinting ? 1 : 0;
    const superSprint = player.superSprinting ? 1 : 0;
    const strideSize = superSprint ? 1.24 : sprint ? 1.02 : .58;
    const settle = Math.min(1, dt * 13);
    const verticalPulse = groundLocomotion ? Math.abs(Math.sin(player.walkCycle * 2)) : 0;
    player.leftLeg.rotation.x = lerp(player.leftLeg.rotation.x, stride * strideSize, settle);
    player.rightLeg.rotation.x = lerp(player.rightLeg.rotation.x, -stride * strideSize, settle);
    player.leftLeg.rotation.z = lerp(player.leftLeg.rotation.z, sprint ? -.07 : 0, settle);
    player.rightLeg.rotation.z = lerp(player.rightLeg.rotation.z, sprint ? .07 : 0, settle);
    player.leftArm.rotation.x = lerp(player.leftArm.rotation.x, -stride * (superSprint ? 1.04 : sprint ? .82 : .38), settle);
    player.body.rotation.x = lerp(player.body.rotation.x, superSprint ? -.25 : sprint ? -.16 : 0, settle);
    player.body.rotation.z = lerp(player.body.rotation.z, moving ? -stride * .035 : 0, settle);
    player.body.rotation.y = lerp(player.body.rotation.y, 0, settle);
    if (player.sliding) {
      player.leftLeg.rotation.x = lerp(player.leftLeg.rotation.x, .96, settle);
      player.rightLeg.rotation.x = lerp(player.rightLeg.rotation.x, .64, settle);
      player.leftArm.rotation.z = lerp(player.leftArm.rotation.z, -.28, settle);
      player.body.rotation.x = lerp(player.body.rotation.x, -.52, settle);
    } else if (!player.grounded) {
      const rising = player.velocityY > 0;
      player.leftLeg.rotation.x = lerp(player.leftLeg.rotation.x, rising ? -.48 : .32, settle * 1.4);
      player.rightLeg.rotation.x = lerp(player.rightLeg.rotation.x, rising ? .68 : -.22, settle * 1.4);
      player.leftArm.rotation.z = lerp(player.leftArm.rotation.z, -.38, settle);
      player.body.rotation.x = lerp(player.body.rotation.x, rising ? -.1 : .12, settle);
    } else player.leftArm.rotation.z = lerp(player.leftArm.rotation.z, 0, settle);
    if (player.attackTime > 0) {
      const progress = 1 - player.attackTime / player.attackDuration;
      const windup = clamp(progress / .28, 0, 1);
      const strike = clamp((progress - .28) / .24, 0, 1);
      const recover = clamp((progress - .52) / .48, 0, 1);
      const strikeEase = strike * strike * (3 - 2 * strike);
      const side = player.attackVariant % 2 ? -1 : 1;
      if (player.activeWeapon === "bow") {
        const draw = Math.sin(Math.min(1, progress / .58) * Math.PI * .5);
        player.rightArm.rotation.x = -1.15 - draw * .35 + recover * .7;
        player.rightArm.rotation.z = -.82 + draw * .28;
        player.leftArm.rotation.x = -1.32 + recover * .7;
        player.leftArm.rotation.z = .22;
        player.body.rotation.y = -.22 * draw;
      } else if (player.activeWeapon === "staff") {
        const cast = Math.sin(progress * Math.PI);
        player.rightArm.rotation.x = -1.12 + cast * 1.5;
        player.rightArm.rotation.z = -.55 + cast * .72;
        player.body.rotation.y = cast * .28;
      } else {
        const weight = player.activeWeapon === "axe" ? 1.32 : 1;
        const startX = -1.55 * weight;
        const endX = 1.5 * weight;
        let pose = lerp(0, startX, windup);
        pose = lerp(pose, endX, strikeEase);
        pose = lerp(pose, 0, recover);
        player.rightArm.rotation.x = pose;
        player.rightArm.rotation.z = side * lerp(-.62, .48, strikeEase) * (1 - recover);
        player.body.rotation.y = side * lerp(-.44, .52, strikeEase) * (1 - recover);
        player.body.rotation.x = lerp(player.body.rotation.x, player.activeWeapon === "axe" ? -.24 : -.1, Math.sin(progress * Math.PI));
      }
    } else {
      player.rightArm.rotation.x = lerp(player.rightArm.rotation.x, stride * .34, settle);
      player.rightArm.rotation.z = lerp(player.rightArm.rotation.z, 0, settle);
    }
    if (player.hitReaction > 0) {
      const impact = player.hitReaction / .24;
      player.body.rotation.z += Math.sin(impact * Math.PI) * .18;
      player.leftArm.rotation.x -= .45 * impact;
    }
    player.body.position.y = lerp(player.body.position.y, player.sliding ? 1.03 : 1.62 + verticalPulse * (superSprint ? .13 : sprint ? .09 : .045) - (!player.grounded ? .05 : 0), settle);
    const capePosition = player.cape.geometry.attributes.position;
    const sway = Math.sin(elapsed * 3.2) * .035 + (player.sliding ? .36 : groundLocomotion ? (sprint ? .31 : .12) : 0);
    capePosition.setZ(2, .61 + sway);
    capePosition.setZ(3, .61 + sway);
    capePosition.needsUpdate = true;
    if (player.weaponModels.staff) player.weaponModels.staff.children.forEach((part, index) => { if (index > 0) part.rotation.y += dt * (1.4 + index * .25); });
    if (player.modelMixer) {
      let modelState = "idle";
      if (player.dodgeTime > 0) modelState = "roll";
      else if (player.hitReaction > 0) modelState = "hit";
      else if (player.attackTime > 0) modelState = player.attackVariant % 2 ? "attack1" : "attack2";
      else if (!player.grounded || player.sliding || player.landingTime > 0) modelState = "idle";
      else if (groundLocomotion) modelState = player.sprinting ? "run" : "walk";
      setPlayerModelAction(modelState);
      if (modelState === "run" && player.modelActions.run) player.modelActions.run.setEffectiveTimeScale(player.superSprinting ? 1.25 : 1.15);
      restoreSprintPoseBones();
      player.modelMixer.update(dt);
      updateSprintPose(dt);
      updateAirborneAndSlideModelPose(dt);
      updateStaticWardenPose(dt, groundLocomotion);
      updateWardenRunDeformer(dt, groundLocomotion);
    }
  }

  function jump() {
    if (state !== "playing" || !player.grounded || player.stamina < 10) return;
    if (player.sliding) {
      player.airMomentum.copy(player.slideDirection).multiplyScalar(player.slideSpeed);
      finishSlide(true);
    } else {
      player.airMomentum.copy(player.groundMomentum);
      if (player.airMomentum.lengthSq() < .04 && player.moving) {
        const fallbackSpeed = player.superSprinting ? 25.5 * strideSuperPower() : player.sprinting ? 17.2 * strideSprintPower() : 7.8;
        player.airMomentum.set(-Math.sin(player.root.rotation.y), 0, -Math.cos(player.root.rotation.y)).multiplyScalar(fallbackSpeed);
      }
    }
    const takeoffDirection = player.airMomentum.lengthSq() > .001 ? player.airMomentum.clone().normalize() : new THREE.Vector3(0, 0, -1);
    player.lastJumpTelemetry = { takeoffSpeed: player.airMomentum.length(), airborneSpeed: player.airMomentum.length(), direction: takeoffDirection };
    player.grounded = false;
    player.velocityY = 15.2 + skillRank("acrobat") * 1.3 + (biomeIdAt(player.root.position.x, player.root.position.z) === "moon" ? 1.6 : 0);
    player.jumpTime = 0;
    player.airbornePhase = "jump";
    player.landingTime = 0;
    player.stamina -= 10;
    emitPlayerNoise(13, .32, "jump");
    audio.tone(120, 185, .12, "triangle", .014);
  }

  function dodge() {
    if (state !== "playing" || !player.grounded || player.dodgeTime > 0 || player.dodgeCooldown > 0 || player.attackTime > .12 || player.stamina < 22) return false;
    if (player.sliding && !finishSlide(false)) return false;
    let inputX = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0) + mobileMove.x;
    let inputZ = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0) - mobileMove.y;
    if (Math.hypot(inputX, inputZ) < .08) inputZ = 1;
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    player.dodgeDirection.copy(forward.multiplyScalar(inputZ).add(right.multiplyScalar(inputX)).normalize());
    player.dodgeTime = .58;
    player.dodgeElapsed = 0;
    player.dodgeCooldown = .72;
    player.lastDodgeTime = elapsed;
    player.attackTime = 0;
    player.pendingAttack = null;
    player.stamina -= 22;
    emitPlayerNoise(17, .42, "dodge");
    setPlayerModelAction("roll", true);
    audio.tone(185, 95, .16, "triangle", .018);
    if (hasSkill("thunderstep") && player.shout >= 100) {
      player.shout = Math.max(0, player.shout - 20);
      createShockwave(player.root.position.clone(), 11, .5, 0x78c9dc);
      groundEnemies.forEach((enemy) => { if (!enemy.dead && distance2D(enemy.root.position, player.root.position) < 8) enemy.hitStun = Math.max(enemy.hitStun, .5); });
    }
    return true;
  }

  function attack() {
    const weaponId = player.activeWeapon;
    const weapon = WEAPONS[weaponId];
    const staminaCost = attackStaminaCost(weaponId);
    if (state !== "playing" || player.dodgeTime > 0 || player.attackCooldown > 0 || player.stamina < staminaCost) return;
    if (player.sliding && !finishSlide(false)) return;
    audio.init();
    const attackSpeed = attackSpeedMultiplier(weaponId);
    player.attackCooldown = weapon.cooldown * attackSpeed;
    player.attackDuration = weapon.duration * attackSpeed;
    player.attackTime = player.attackDuration;
    player.attackVariant += 1;
    player.stamina -= staminaCost;
    player.root.rotation.y = rotateToward(player.root.rotation.y, cameraYaw, .7);
    emitPlayerNoise(weaponId === "bow" ? 28 : weaponId === "staff" ? 32 : weaponId === "axe" ? 30 : 23, .55, weaponId + "-attack");
    audio.swing();
    player.pendingAttack = { weaponId, releaseAt: player.attackDuration * .55, executed: false, actionId: nextNetworkActionId(weaponId) };
  }

  function computeCrosshairAim(maxRange) {
    const range = maxRange || 160;
    const direction = new THREE.Vector3(
      -Math.sin(cameraYaw) * Math.cos(cameraPitch),
      -Math.sin(cameraPitch),
      -Math.cos(cameraYaw) * Math.cos(cameraPitch)
    ).normalize();
    const origin = camera.position.clone();
    let terrainDistance = range;
    for (let d = 4; d < range; d += 2) {
      const sample = origin.clone().addScaledVector(direction, d);
      if (sample.y < terrainHeight(sample.x, sample.z) + .1) {
        terrainDistance = d;
        break;
      }
    }
    let best = null;
    allEnemies().forEach((enemy) => {
      if (enemy.dead) return;
      const center = enemy.root.position.clone().add(new THREE.Vector3(0, enemy.kind === "dragon" ? 1.2 : 1, 0));
      const along = center.clone().sub(origin).dot(direction);
      if (along < 2 || along > terrainDistance) return;
      const closest = origin.clone().addScaledVector(direction, along);
      const radius = Math.max(1.05, (enemy.hitRadius || 1.2) * .8);
      if (closest.distanceTo(center) <= radius && (!best || along < best.along)) best = { along, enemy, point: center };
    });
    if (best) return { point: best.point, enemy: best.enemy, distance: best.along };
    return { point: origin.addScaledVector(direction, terrainDistance), enemy: null, distance: terrainDistance };
  }

  function releasePlayerAttack(weaponId) {
    const weapon = WEAPONS[weaponId];
    if (!weapon || state !== "playing") return;
    const actionId = player.pendingAttack?.actionId || nextNetworkActionId(weaponId);
    if (weaponId !== "bow") createSlash(weapon.color, weaponId === "axe" ? 1.28 : 1);
    const cameraForward = new THREE.Vector3(
      -Math.sin(cameraYaw) * Math.cos(cameraPitch),
      -Math.sin(cameraPitch),
      -Math.cos(cameraYaw) * Math.cos(cameraPitch)
    ).normalize();
    if (weapon.projectile) {
      const origin = player.root.position.clone().add(new THREE.Vector3(0, 1.68, 0));
      const validLock = lockedTarget && !lockedTarget.dead && lockedTarget.root.position.distanceTo(player.root.position) < 170;
      const aimPoint = validLock
        ? lockedTarget.root.position.clone().add(new THREE.Vector3(0, lockedTarget.kind === "dragon" ? 1.4 : 1.1, 0))
        : computeCrosshairAim(160).point;
      if (!validLock && weapon.gravity > 0) {
        const projectileGravity = weapon.gravity * (weaponId === "bow" ? 1 - skillRank("eagle_eye") * .22 : 1);
        const flightTime = aimPoint.distanceTo(origin) / (weapon.speed * (weaponId === "bow" ? 1 + skillRank("eagle_eye") * .12 : 1));
        aimPoint.y += Math.min(4, .5 * projectileGravity * flightTime * flightTime);
      }
      const forward = aimPoint.sub(origin).normalize();
      const speedMultiplier = weaponId === "bow" ? 1 + skillRank("eagle_eye") * .12 : 1;
      const mesh = createWeaponProjectile(weaponId, weapon);
      mesh.position.copy(origin).addScaledVector(forward, 1.2);
      scene.add(mesh);
      bolts.push({
        mesh, weaponId, velocity: forward.multiplyScalar(weapon.speed * speedMultiplier), life: weapon.life + (weaponId === "bow" ? skillRank("eagle_eye") * .45 : 0),
        damage: Math.round(weapon.damage * weaponDamageMultiplier(weaponId)), splash: weapon.splash + (weaponId === "staff" ? skillRank("overcharge") * 1.3 : 0),
        gravity: weapon.gravity * (weaponId === "bow" ? 1 - skillRank("eagle_eye") * .22 : 1), color: weapon.color, actionId,
        spin: weaponId === "axe" ? 11 : weaponId === "staff" ? 3.5 : 0
      });
      if (weaponId === "bow") {
        player.bowShots += 1;
        if (hasSkill("split_arrow") && player.bowShots % 3 === 0) {
          const sideDirection = forward.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.bowShots % 2 ? .055 : -.055);
          const sideMesh = createWeaponProjectile("bow", weapon);
          sideMesh.position.copy(origin).addScaledVector(sideDirection, 1.2);
          scene.add(sideMesh);
          bolts.push({ mesh: sideMesh, weaponId: "bow", velocity: sideDirection.multiplyScalar(weapon.speed * speedMultiplier), life: weapon.life, damage: Math.round(weapon.damage * weaponDamageMultiplier("bow") * .7), splash: 0, gravity: weapon.gravity * .55, color: weapon.color, spin: 0, actionId });
        }
      }
      if (weaponId === "staff") {
        player.staffCasts += 1;
        if (hasSkill("tempest_crown") && player.staffCasts % 6 === 0) {
          createShockwave(player.root.position.clone(), 13, .7, 0xb388f0);
          allEnemies().forEach((enemy) => { if (!enemy.dead && enemy.root.position.distanceTo(player.root.position) < 12) damageDragon(enemy, 24, false, "arc", "staff", actionId); });
        }
      }
    }
    if (weapon.melee <= 0) return;
    const riposteMultiplier = weaponId === "blade" && elapsed - player.lastDodgeTime < 1.15 ? 1 + skillRank("riposte") * .18 : 1;
    allEnemies().forEach((enemy) => {
      if (enemy.dead) return;
      const offset = enemy.root.position.clone().sub(player.root.position);
      const horizontal = new THREE.Vector3(offset.x, 0, offset.z);
      const horizontalDistance = horizontal.length();
      const verticalDistance = Math.abs(offset.y);
      const reach = weapon.range + Math.min(enemy.hitRadius || 1.2, 3) * .5;
      const verticalWindow = enemy.kind === "dragon" ? 5 : 3.4;
      const facing = horizontalDistance ? horizontal.normalize().dot(new THREE.Vector3(-Math.sin(player.root.rotation.y), 0, -Math.cos(player.root.rotation.y))) : 1;
      if (horizontalDistance < reach && verticalDistance < verticalWindow && facing > .08) damageDragon(enemy, Math.round(weapon.melee * weaponDamageMultiplier(weaponId) * riposteMultiplier), weaponId === "axe", "weapon", weaponId, actionId);
    });
  }

  function allEnemies() {
    return dragons.filter((enemy) => !enemy.networkExcluded)
      .concat(groundEnemies.filter((enemy) => !enemy.networkExcluded && !enemy.tamed && !enemy.networkTamedBy));
  }

  function createWeaponProjectile(weaponId, weapon) {
    const material = new THREE.MeshBasicMaterial({ color: weapon.color, transparent: true, opacity: .96 });
    if (weaponId === "bow") {
      const arrow = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 1.3, 5), material);
      shaft.rotation.x = Math.PI / 2;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.07, .22, 5), material);
      tip.position.z = -.72;
      tip.rotation.x = -Math.PI / 2;
      arrow.add(shaft, tip);
      return arrow;
    }
    if (weaponId === "axe") {
      const projectile = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.BoxGeometry(.065, .8, .065), material);
      const head = new THREE.Mesh(new THREE.ConeGeometry(.22, .48, 4), material);
      head.position.y = -.36;
      head.rotation.z = Math.PI / 2;
      projectile.add(handle, head);
      return projectile;
    }
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(weapon.radius, weaponId === "staff" ? 12 : 9, weaponId === "staff" ? 9 : 7), material);
    if (weaponId === "staff") {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(weapon.radius * 1.65, .018, 5, 18), material.clone());
      halo.rotation.x = Math.PI / 2;
      mesh.add(halo);
    }
    return mesh;
  }

  function createSlash(color, scale) {
    const material = new THREE.MeshBasicMaterial({ color: color || 0x8fd4e5, transparent: true, opacity: .72, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.3, 30, 1, -.9, 1.8), material);
    mesh.position.copy(player.root.position).add(new THREE.Vector3(0, 1.25, 0));
    mesh.rotation.y = player.root.rotation.y;
    mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
    mesh.scale.setScalar(scale || 1);
    effects.push({ mesh, life: .28, maxLife: .28, grow: 7, type: "fade" });
  }

  function useShout() {
    if (state !== "playing") return;
    if (player.shout < 100) { showMessage("DRAGON SHOUT NOT READY", "#91a5ad"); return; }
    player.shout = 0;
    if (hasSkill("stormborn")) {
      player.health = Math.min(maxHealth(), player.health + 25);
      player.stamina = Math.min(maxStamina(), player.stamina + 25);
    }
    player.resonanceTime = 1.5 + skillRank("resonance") * .75;
    emitPlayerNoise(70, 1.15, "dragon-shout");
    audio.shoutSound();
    showMessage("FUS RO DAH", "#bceaf4");
    const forceMultiplier = 1 + skillRank("force") * .12;
    const shoutRadius = 48 + skillRank("force") * 4;
    const shoutTargets = allEnemies().filter((enemy) => !enemy.dead && enemy.root.position.distanceTo(player.root.position) < shoutRadius);
    const shoutActionId = nextNetworkActionId("shout");
    createShockwave(player.root.position.clone(), shoutRadius, 1.05, 0x8ed5e8);
    shoutTargets.forEach((dragon) => {
      damageDragon(dragon, Math.round((dragon.boss ? 38 : 62) * forceMultiplier), true, "shout", "shout", shoutActionId);
      const away = dragon.root.position.clone().sub(player.root.position).setY(0).normalize();
      if (dragon.impulse) dragon.impulse.addScaledVector(away, dragon.elite ? 6 : 11);
    });
    if (hasSkill("world_voice")) {
      const chain = shoutTargets.slice().sort((a, b) => distance2D(a.root.position, player.root.position) - distance2D(b.root.position, player.root.position)).slice(0, 7);
      for (let index = 1; index < chain.length; index += 1) {
        const previous = chain[index - 1];
        const target = chain[index];
        if (distance2D(previous.root.position, target.root.position) > 24) continue;
        createLightningArc(previous.root.position, target.root.position, 0x9de8ff);
        if (!target.dead) damageDragon(target, target.boss ? 12 : 24, false, "arc", "staff", shoutActionId);
      }
    }
    fireballs.forEach((ball) => {
      if (ball.mesh.position.distanceTo(player.root.position) < 55) {
        createExplosion(ball.mesh.position, 0x70bed3, 7);
        ball.dead = true;
      }
    });
  }

  function createShockwave(position, maxScale, life, color) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .72, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 48), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y += .3;
    scene.add(mesh);
    effects.push({ mesh, life, maxLife: life, grow: maxScale, type: "ring" });
  }

  function createLightningArc(start, end, color) {
    const from = start.clone().add(new THREE.Vector3(0, 1.25, 0));
    const to = end.clone().add(new THREE.Vector3(0, 1.25, 0));
    const points = [];
    for (let index = 0; index <= 8; index += 1) {
      const amount = index / 8;
      const point = from.clone().lerp(to, amount);
      if (index > 0 && index < 8) {
        point.x += Math.sin(elapsed * 37 + index * 4.7) * .34;
        point.y += Math.sin(index * 2.3) * .42;
        point.z += Math.cos(elapsed * 31 + index * 3.9) * .34;
      }
      points.push(point);
    }
    const material = new THREE.LineBasicMaterial({ color: color || 0xa5e7ff, transparent: true, opacity: .92, depthWrite: false });
    const mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
    scene.add(mesh);
    effects.push({ mesh, life: .2, maxLife: .2, grow: 1, type: "lightning" });
  }

  function beginDragonFireTelegraph(dragon) {
    dragon.fireWindup = dragon.boss ? .55 : .72;
    const windupLead = dragon.playerVelocity ? dragon.playerVelocity.clone().multiplyScalar(dragon.fireWindup) : new THREE.Vector3();
    dragon.fireTarget = player.root.position.clone().add(windupLead).add(new THREE.Vector3(0, 1, 0));
    const material = new THREE.MeshBasicMaterial({ color: dragon.boss ? 0xff3518 : 0xff7a2f, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(dragon.boss ? 2.2 : 1.55, dragon.boss ? 2.65 : 1.95, 48), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(dragon.fireTarget.x, terrainHeight(dragon.fireTarget.x, dragon.fireTarget.z) + .14, dragon.fireTarget.z);
    scene.add(mesh);
    dragon.fireTelegraph = mesh;
    audio.dragon();
  }

  function clearDragonFireTelegraph(dragon) {
    if (!dragon.fireTelegraph) return;
    scene.remove(dragon.fireTelegraph);
    dragon.fireTelegraph.geometry.dispose();
    dragon.fireTelegraph.material.dispose();
    dragon.fireTelegraph = null;
  }

  function updateDragons(dt, idle) {
    const playerPosition = player.root.position;
    dragons.forEach((dragon) => {
      if (dragon.networkExcluded) { dragon.root.visible = false; return; }
      if (dragon.dead) {
        clearDragonFireTelegraph(dragon);
        dragon.deathTime += dt;
        dragon.root.position.y -= dt * (4 + dragon.deathTime * 5);
        dragon.root.rotation.z += dt * .65;
        const ground = terrainHeight(dragon.root.position.x, dragon.root.position.z) + .8;
        if (dragon.root.position.y <= ground) {
          dragon.root.position.y = ground;
          dragon.root.scale.multiplyScalar(Math.max(.98, 1 - dt * .1));
        }
        return;
      }

      const distanceToPlayer = dragon.root.position.distanceTo(playerPosition);
      if (!idle && (distanceToPlayer < (dragon.boss ? 160 : 115) || dragon.engaged)) dragon.engaged = true;
      if (!dragon.boss && distanceToPlayer > 185) dragon.engaged = false;
      let desired;
      if (dragon.engaged && !idle) {
        dragon.playerVelocity.copy(playerPosition).sub(dragon.lastPlayerPos).divideScalar(Math.max(dt, .001));
        dragon.playerVelocity.y = 0;
        dragon.lastPlayerPos.copy(playerPosition);
        dragon.angle += dt * (dragon.boss ? .55 : .72);
        const orbit = dragon.boss ? 27 : 21;
        const swoop = .5 + .5 * Math.sin(elapsed * (dragon.boss ? .52 : .7) + dragon.phase);
        const altitude = (dragon.boss ? 7 : 3) + swoop * (dragon.boss ? 19 : 14);
        const px = playerPosition.x + Math.cos(dragon.angle) * orbit;
        const pz = playerPosition.z + Math.sin(dragon.angle) * orbit;
        desired = new THREE.Vector3(px, terrainHeight(px, pz) + altitude, pz);
        dragon.fireCooldown -= dt;
        dragon.roarCooldown -= dt;
        if (dragon.fireWindup > 0) {
          const previousWindup = dragon.fireWindup;
          dragon.fireWindup = Math.max(0, dragon.fireWindup - dt);
          if (dragon.fireTelegraph) {
            const progress = 1 - dragon.fireWindup / (dragon.boss ? .55 : .72);
            dragon.fireTelegraph.material.opacity = .2 + progress * .58;
            dragon.fireTelegraph.scale.setScalar(.85 + progress * .15);
          }
          if (previousWindup > 0 && dragon.fireWindup <= 0) {
            launchDragonFire(dragon);
            clearDragonFireTelegraph(dragon);
            dragon.fireTarget = null;
          }
        } else if (dragon.fireCooldown <= 0 && distanceToPlayer < 78) {
          beginDragonFireTelegraph(dragon);
          dragon.fireCooldown = dragon.boss ? 1.4 + encounterRandom() * .9 : 2.2 + encounterRandom() * 1.4;
          if (dragon.boss && dragon.health < dragon.maxHealth * .35) dragon.fireCooldown *= .75;
        }
        if (dragon.roarCooldown <= 0 && distanceToPlayer < 65) {
          audio.dragon();
          dragon.roarCooldown = 8 + encounterRandom() * 7;
        }
      } else {
        dragon.playerVelocity.set(0, 0, 0);
        dragon.lastPlayerPos.copy(playerPosition);
        dragon.angle += dt * dragon.speed / dragon.radius * .6;
        const px = dragon.home.x + Math.cos(dragon.angle) * dragon.radius;
        const pz = dragon.home.z + Math.sin(dragon.angle) * dragon.radius;
        desired = new THREE.Vector3(px, terrainHeight(px, pz) + 18 + Math.sin(elapsed * .7 + dragon.phase) * 5, pz);
      }
      const motion = desired.sub(dragon.root.position);
      const maxStep = dragon.speed * dt;
      if (motion.length() > maxStep) motion.setLength(maxStep);
      dragon.root.position.add(motion);
      dragon.velocity.copy(dragon.root.position).sub(dragon.lastPosition).divideScalar(Math.max(dt, .001));
      dragon.lastPosition.copy(dragon.root.position);
      if (motion.x * motion.x + motion.z * motion.z > .0001) {
        const desiredHeading = Math.atan2(-motion.x, -motion.z);
        dragon.root.rotation.y = desiredHeading;
      }
      const flap = Math.sin(elapsed * (dragon.boss ? 5.2 : 6.8) + dragon.phase) * .42;
      dragon.leftWing.rotation.z = .08 + flap;
      dragon.rightWing.rotation.z = -.08 - flap;
      dragon.root.rotation.z = clamp(-motion.x * .015, -.28, .28);
    });
  }

  function launchDragonFire(dragon) {
    const origin = new THREE.Vector3(0, .1, -5.2).applyMatrix4(dragon.root.matrixWorld);
    const speed = dragon.boss ? 33 : 27;
    const baseTarget = player.root.position.clone().add(new THREE.Vector3(0, 1, 0));
    const flightTime = Math.min(origin.distanceTo(baseTarget) / speed, 1.2);
    const flightLead = dragon.playerVelocity ? dragon.playerVelocity.clone().multiplyScalar(flightTime) : new THREE.Vector3();
    const target = baseTarget.add(flightLead);
    const baseDirection = target.sub(origin).normalize();
    const damage = Math.round((dragon.boss ? 30 : 22) * (dragon.damageScale || 1));
    const spreads = dragon.boss ? [-.09, 0, .09] : [0];
    spreads.forEach((spread) => {
      const direction = baseDirection.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(dragon.boss ? .46 : .34, 10, 8), new THREE.MeshBasicMaterial({ color: dragon.boss ? 0xff3a18 : 0xff6a28 }));
      mesh.position.copy(origin);
      scene.add(mesh);
      fireballs.push({ mesh, velocity: direction.multiplyScalar(speed), life: 4.2, damage, dead: false });
    });
    audio.fire();
  }

  function updateProjectiles(dt) {
    bolts.forEach((bolt) => {
      bolt.life -= dt;
      if (bolt.gravity) bolt.velocity.y -= bolt.gravity * dt;
      bolt.mesh.position.addScaledVector(bolt.velocity, dt);
      if (bolt.spin) bolt.mesh.rotation.z += dt * bolt.spin;
      if (bolt.weaponId === "bow") bolt.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), bolt.velocity.clone().normalize());
      if (bolt.weaponId === "blade" || bolt.weaponId === "staff") bolt.mesh.scale.setScalar(1 + Math.sin(elapsed * 20) * .15);
      allEnemies().some((dragon) => {
        if (dragon.dead) return false;
        if (bolt.mesh.position.distanceTo(dragon.root.position) < dragon.hitRadius) {
          damageDragon(dragon, bolt.damage, bolt.weaponId === "axe", "weapon", bolt.weaponId, bolt.actionId);
          if (bolt.splash > 0) {
            allEnemies().forEach((other) => {
              if (other !== dragon && !other.dead && other.root.position.distanceTo(bolt.mesh.position) < bolt.splash) {
                damageDragon(other, Math.max(1, Math.round(bolt.damage * .55)), false, "weapon", bolt.weaponId, bolt.actionId);
              }
            });
          }
          createExplosion(bolt.mesh.position, bolt.color || 0x85d4e7, bolt.weaponId === "axe" ? 5 : bolt.weaponId === "staff" ? 4.5 : 3.5);
          bolt.life = 0;
          return true;
        }
        return false;
      });
      if (bolt.mesh.position.y < terrainHeight(bolt.mesh.position.x, bolt.mesh.position.z)) bolt.life = 0;
    });
    bolts = bolts.filter((bolt) => {
      if (bolt.life <= 0) {
        scene.remove(bolt.mesh);
        bolt.mesh.traverse((object) => { if (object.geometry) object.geometry.dispose(); if (object.material) object.material.dispose(); });
        return false;
      }
      return true;
    });

    fireballs.forEach((ball) => {
      if (ball.dead) return;
      ball.life -= dt;
      ball.mesh.position.addScaledVector(ball.velocity, dt);
      ball.mesh.scale.setScalar(1 + Math.sin(elapsed * 16) * .18);
      if (ball.mesh.position.distanceTo(player.root.position.clone().add(new THREE.Vector3(0,1.1,0))) < 1.35) {
        damagePlayer(ball.damage, "DRAGON FIRE");
        createExplosion(ball.mesh.position, 0xff5522, 7);
        ball.dead = true;
      } else if (ball.mesh.position.y <= terrainHeight(ball.mesh.position.x, ball.mesh.position.z) + .2) {
        createExplosion(ball.mesh.position, 0xff5522, 6);
        ball.dead = true;
      }
      if (ball.life <= 0) ball.dead = true;
    });
    fireballs = fireballs.filter((ball) => {
      if (ball.dead) { scene.remove(ball.mesh); ball.mesh.geometry.dispose(); ball.mesh.material.dispose(); return false; }
      return true;
    });
  }

  function damageDragon(dragon, amount, heavy, source, weaponId, actionId) {
    if (dragon.dead || dragon.tamed) return;
    const damageSource = source || "weapon";
    let finalAmount = amount;
    let criticalHit = false;
    if (damageSource === "weapon" && skillRank("executioner") && (dragon.boss || dragon.health / dragon.maxHealth <= .35)) finalAmount *= 1 + skillRank("executioner") * .15;
    if (damageSource === "weapon" && weaponId === "bow" && skillRank("piercer") && (dragon.boss || dragon.health / dragon.maxHealth >= .7)) finalAmount *= 1 + skillRank("piercer") * .14;
    if (damageSource === "weapon" && dragon.boss && hasSkill("run_apex")) finalAmount *= 1.2;
    const criticalChance = damageSource === "weapon" ? skillRank("run_crit") * .04 + (weaponId === "bow" && hasSkill("storm_archer") ? .12 : 0) : 0;
    const forcedCritical = damageSource === "weapon" && player.forceNextCritical;
    if (forcedCritical) player.forceNextCritical = false;
    if (forcedCritical || (criticalChance > 0 && encounterRandom() < criticalChance)) {
      criticalHit = true;
      finalAmount *= 1.65 * (1 + relicBonus("critDamage") / 100);
    }
    if (damageSource === "weapon" && player.swapEmpowered) {
      finalAmount *= 1 + skillRank("swift_change") * .12;
      player.swapEmpowered = false;
    }
    if (damageSource === "weapon" && weaponId === "blade") {
      player.bladeHits += 1;
      if (hasSkill("sword_saint") && player.bladeHits % 5 === 0) finalAmount *= 1.8;
    }
    finalAmount = Math.max(1, Math.round(finalAmount));
    if (multiplayerWorldActive() && !applyingNetworkState) {
      if (!multiplayerActionReady()) return false;
      ensureStableNetworkIds();
      const networkWeapon = damageSource === "shout" ? "shout"
        : damageSource === "companion" ? "companion"
        : WEAPONS[weaponId] ? weaponId : player.activeWeapon;
      const networkActionId = actionId || nextNetworkActionId(networkWeapon);
      const networkEffects = damageSource === "weapon" ? {
        tameProgress: (weaponId === "staff" ? 30 : 0) + (criticalHit ? 55 : 0),
        slowMs: weaponId === "staff" ? Math.round((.95 + skillRank("frost_nova") * .55) * 1000) : 0,
        bleedDamage: weaponId === "blade" && skillRank("bleeding_edge") ? Math.max(1, Math.round(finalAmount * .04 * skillRank("bleeding_edge"))) : 0
      } : null;
      const sent = coopRuntime.attack(dragon.networkId, networkWeapon, finalAmount, criticalHit, networkActionId, networkEffects, damageSource === "weapon");
      if (sent) {
        networkStats.attacksSent += 1;
        nearestTarget = dragon;
        hitStopRemaining = Math.max(hitStopRemaining, heavy ? .045 : .025);
        cameraTrauma = Math.min(1, cameraTrauma + (heavy ? .18 : .08));
        if (damageSource === "weapon") {
          player.comboHits = Math.min(8, player.comboHits + 1);
          player.comboExpires = elapsed + 2.2;
          player.shout = Math.min(100, player.shout + (heavy ? 10 : 6) * shoutChargeMultiplier());
        }
        if (damageSource === "weapon" && weaponId === "bow" && criticalHit && hasSkill("storm_archer")) {
          const chained = allEnemies().filter((other) => other !== dragon && !other.dead && other.root.position.distanceTo(dragon.root.position) < 15)
            .sort((a, b) => a.root.position.distanceTo(dragon.root.position) - b.root.position.distanceTo(dragon.root.position))[0];
          if (chained) {
            createLightningArc(dragon.root.position, chained.root.position, 0x8adcf5);
            damageDragon(chained, Math.max(1, Math.round(finalAmount * .48)), false, "arc", "bow", networkActionId);
          }
        }
        if (damageSource === "weapon" && weaponId === "staff" && skillRank("chain_spark")) {
          const chained = allEnemies().filter((other) => other !== dragon && !other.dead && other.root.position.distanceTo(dragon.root.position) < 8 + skillRank("chain_spark") * 2)
            .sort((a, b) => a.root.position.distanceTo(dragon.root.position) - b.root.position.distanceTo(dragon.root.position))[0];
          if (chained) damageDragon(chained, Math.max(1, Math.round(finalAmount * (.22 + skillRank("chain_spark") * .08))), false, "arc", "staff", networkActionId);
        }
        if (damageSource === "weapon" && weaponId === "axe" && hasSkill("world_splitter") && player.worldSplitterAttack !== player.attackVariant) {
          player.worldSplitterAttack = player.attackVariant;
          createShockwave(dragon.root.position.clone(), 9, .42, 0xf09a5d);
          createShockwave(dragon.root.position.clone(), 14, .7, 0xffc27a);
          allEnemies().filter((other) => other !== dragon && !other.dead && distance2D(other.root.position, dragon.root.position) < 11)
            .forEach((other) => damageDragon(other, Math.max(1, Math.round(finalAmount * .36)), true, "aftershock", "axe", networkActionId));
        }
      }
      return sent;
    }
    if (damageSource === "weapon" && weaponId === "blade") {
      if (dragon.kind !== "dragon" && skillRank("bleeding_edge")) {
        dragon.bleedStacks = Math.min(skillRank("bleeding_edge"), (dragon.bleedStacks || 0) + 1);
        dragon.bleedTime = 4;
      }
    }
    if (damageSource === "weapon" && weaponId === "staff" && dragon.kind !== "dragon") {
      dragon.slowTime = Math.max(dragon.slowTime || 0, .95 + skillRank("frost_nova") * .55);
      if (skillRank("frost_nova") && distance2D(dragon.root.position, player.root.position) < 9) dragon.slowTime = Math.max(dragon.slowTime, 1.4 + skillRank("frost_nova") * .55);
    }
    const appliedDamage = Math.min(dragon.health, finalAmount);
    dragon.engaged = true;
    if (dragon.kind !== "dragon") alertGroundEnemyFromDamage(dragon);
    dragon.health -= finalAmount;
    if (dragon.health > 0 && isTameableEnemy(dragon) && damageSource === "weapon") {
      if (weaponId === "staff") dragon.tameProgress += 30;
      if (criticalHit) dragon.tameProgress += 55;
      if (dragon.tameProgress >= 100 || dragon.health / dragon.maxHealth <= .5 && (criticalHit || weaponId === "staff" && dragon.slowTime > 0)) setEnemyTameReady(dragon);
    }
    hitStopRemaining = Math.max(hitStopRemaining, heavy ? .085 : .06);
    cameraTrauma = Math.min(1, cameraTrauma + (heavy ? .32 : .18));
    if (dragon.kind !== "dragon") {
      dragon.hitStun = heavy ? .24 : .11;
      setEnemyAction(dragon, "hit", true);
      if (heavy || !dragon.elite) { dragon.attackTimer = 0; clearEnemyTelegraph(dragon); }
      const away = dragon.root.position.clone().sub(player.root.position).setY(0).normalize();
      const baseImpulse = weaponId === "axe" ? 7.5 + skillRank("sundering") * 2.1 : weaponId === "blade" ? 2.4 : 1.2;
      if (dragon.impulse) dragon.impulse.addScaledVector(away, dragon.elite ? baseImpulse * .42 : baseImpulse);
    }
    dragon.lastDamageSource = damageSource;
    if (damageSource === "weapon") dragon.lastWeaponId = WEAPONS[weaponId] ? weaponId : player.activeWeapon;
    if (damageSource === "weapon") {
      player.comboHits = Math.min(8, player.comboHits + 1);
      player.comboExpires = elapsed + 2.2;
      player.shout = Math.min(100, player.shout + (heavy ? 10 : 6) * shoutChargeMultiplier());
      grantWeaponXp(appliedDamage, dragon.lastWeaponId);
    }
    audio.hit();
    showHit(false);
    nearestTarget = dragon;
    if (damageSource === "weapon" && weaponId === "bow" && criticalHit && hasSkill("storm_archer")) {
      const chained = allEnemies().filter((other) => other !== dragon && !other.dead && other.root.position.distanceTo(dragon.root.position) < 15).sort((a, b) => a.root.position.distanceTo(dragon.root.position) - b.root.position.distanceTo(dragon.root.position))[0];
      if (chained) {
        createLightningArc(dragon.root.position, chained.root.position, 0x8adcf5);
        damageDragon(chained, Math.max(1, Math.round(finalAmount * .48)), false, "arc", "bow");
      }
    }
    if (damageSource === "weapon" && weaponId === "staff" && skillRank("chain_spark")) {
      const chained = allEnemies().filter((other) => other !== dragon && !other.dead && other.root.position.distanceTo(dragon.root.position) < 8 + skillRank("chain_spark") * 2).sort((a, b) => a.root.position.distanceTo(dragon.root.position) - b.root.position.distanceTo(dragon.root.position))[0];
      if (chained) damageDragon(chained, Math.max(1, Math.round(finalAmount * (.22 + skillRank("chain_spark") * .08))), false, "arc", "staff");
    }
    if (damageSource === "weapon" && weaponId === "axe" && hasSkill("world_splitter") && player.worldSplitterAttack !== player.attackVariant) {
      player.worldSplitterAttack = player.attackVariant;
      createShockwave(dragon.root.position.clone(), 9, .42, 0xf09a5d);
      createShockwave(dragon.root.position.clone(), 14, .7, 0xffc27a);
      allEnemies().filter((other) => other !== dragon && !other.dead && distance2D(other.root.position, dragon.root.position) < 11).forEach((other) => {
        damageDragon(other, Math.max(1, Math.round(finalAmount * .36)), true, "aftershock", "axe");
        if (other.impulse && !other.elite && other.kind !== "dragon") {
          const launch = other.root.position.clone().sub(dragon.root.position).setY(0).normalize();
          other.impulse.addScaledVector(launch, 14);
        }
      });
      if (dragon.impulse && !dragon.elite && dragon.kind !== "dragon") {
        const launch = dragon.root.position.clone().sub(player.root.position).setY(0).normalize();
        dragon.impulse.addScaledVector(launch, 14);
      }
    }
    spawnCombatText(dragon.root.position, String(finalAmount), criticalHit ? "crit" : heavy ? "heavy" : "hit");
    if (dragon.health <= 0) killDragon(dragon);
  }

  function killDragon(dragon, grantRewards, networkControlled) {
    const rewardKill = grantRewards !== false;
    if (!dragon || dragon.dead) return false;
    const isDragon = dragon.kind === "dragon";
    dragon.dead = true;
    dragon.health = 0;
    if (!isDragon) setEnemyAction(dragon, "death", true);
    const xpGain = dragon.xpReward || (dragon.boss ? 950 : 320);
    const heal = Math.max(3, Math.round((dragon.healthReward || 6) * .65 + skillRank("run_scavenger") * 2 + (hasSkill("immortal_warden") ? 3 : 0)));
    if (rewardKill) {
      player.kills += 1;
      if (hasSkill("run_rampage")) player.rampageTime = 4.5;
      if (isDragon && !networkControlled) player.dragonKills += 1;
      player.shout = Math.min(100, player.shout + (dragon.boss ? 38 : 21) * shoutChargeMultiplier());
      grantXp(xpGain);
      grantRunXp(Math.round((dragon.xpReward || 60) * .58), dragon.elite ? "ELITE SLAIN" : "ENEMY SLAIN");
      player.health = Math.min(maxHealth(), player.health + heal);
      if (dragon.lastDamageSource === "weapon") grantWeaponXp(dragon.boss ? 46 : 16, dragon.lastWeaponId);
    }
    const effectScale = dragon.boss ? (isDragon ? 18 : 11) : isDragon ? 10 : 6;
    createExplosion(dragon.root.position, dragon.boss ? 0x8bc9d8 : isDragon ? 0xe15e31 : 0x75b9c9, effectScale);
    createShockwave(dragon.root.position.clone(), dragon.boss ? 22 : 10, .75, dragon.boss ? 0x8ccfe0 : 0xd46138);
    if (isDragon && rewardKill) spawnDragonSouls(dragon);
    showHit(true);
    showMessage((dragon.boss && isDragon ? "THE WORLD-BURNER IS SLAIN" : dragon.name + " SLAIN") + (rewardKill ? "  +" + heal + " HEALTH · +" + xpGain + " XP" : ""), dragon.boss ? "#a9deea" : "#edbd80");
    if (rewardKill) {
      spawnCombatText(dragon.root.position, "+" + xpGain + " XP", "xp");
      spawnCombatText(player.root.position, "+" + heal, "heal");
    }
    if (isDragon) audio.dragon(); else audio.hit();
    if (!isDragon && !networkControlled) handleStrongholdMember(dragon);
    if (isDragon && networkControlled && !dragon.boss) player.dragonKills = dragons.filter((item) => !item.boss && item.dead && !item.networkExcluded).length;
    if (dragon.boss && isDragon) winGame();
    else if (isDragon && questStage >= 1 && player.dragonKills >= 3 && !bossSpawned && (!networkControlled || partyController()?.client?.isHost)) spawnBoss();
    updateQuestUI();
    markRunDirty();
    return true;
  }

  function spawnBoss(silent) {
    bossSpawned = true;
    questStage = 2;
    const boss = createDragon("VHAROK, " + worldProfile.dragonNames[0] + " ASCENDANT", RUINS.x, RUINS.z - 18, true, "dragon-boss-vharok");
    boss.root.position.y = terrainHeight(RUINS.x, RUINS.z) + 44;
    boss.engaged = true;
    if (multiplayerWorldActive()) registerNetworkBoss(boss);
    if (!silent) {
      showLocation(boss.name, "BOSS AWAKENED");
      audio.dragon();
    }
    updateQuestUI();
    markRunDirty(true);
  }

  function damagePlayer(amount, sourceName, networkForced) {
    if (state !== "playing" && !networkForced) return;
    if (player.dodgeTime > 0 && player.dodgeElapsed >= .1 && player.dodgeElapsed <= .36) {
      showMessage("PERFECT DODGE", "#9de6ef");
      cameraTrauma = Math.max(cameraTrauma, .08);
      return;
    }
    if (elapsed - player.lastDamage < .18) return;
    const reduction = clamp(skillRank("survivor") * .06 + skillRank("run_guard") * .05 + (player.resonanceTime > 0 ? skillRank("resonance") * .08 : 0) + (hasSkill("stoneguard") && player.activeWeapon === "axe" && player.attackTime > 0 ? .18 : 0), 0, .58);
    const finalAmount = Math.max(1, Math.round(amount * (1 - reduction)));
    const lethal = player.health - finalAmount <= 0;
    if (lethal && hasSkill("second_wind") && player.secondWindReady) {
      player.health = 1;
      player.secondWindReady = false;
      player.resonanceTime = 1.1;
      showProgressionBanner("SECOND WIND", "UNBROKEN", "A lethal blow was defied");
    } else player.health = Math.max(0, player.health - finalAmount);
    player.lastDamage = elapsed;
    player.hitReaction = .24;
    cameraTrauma = Math.min(1, cameraTrauma + .4);
    ui.damage.classList.remove("active");
    void ui.damage.offsetWidth;
    ui.damage.classList.add("active");
    audio.hurt();
    showMessage((sourceName ? sourceName + "  " : "BURNED  ") + "−" + finalAmount, "#f07a54");
    spawnCombatText(player.root.position, "−" + finalAmount, "hurt");
    if (player.health <= 0) endGame(false);
    else markRunDirty();
  }

  function createExplosion(position, color, scale) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.65, 10, 8), material);
    mesh.position.copy(position);
    scene.add(mesh);
    effects.push({ mesh, life: .55, maxLife: .55, grow: scale, type: "burst" });
  }

  function spawnSpeedStreaks() {
    const yaw = player.root.rotation.y;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    for (let index = 0; index < 4; index++) {
      const material = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.08, 1.6), material);
      const lateral = (Math.random() - .5) * 2.2;
      const back = .4 + Math.random() * 1.1;
      mesh.position.set(
        player.root.position.x - forwardX * back + rightX * lateral,
        player.root.position.y + .2 + Math.random() * .8,
        player.root.position.z - forwardZ * back + rightZ * lateral
      );
      mesh.rotation.set(-Math.PI / 2 + (Math.random() - .5) * .3, yaw, 0, "YXZ");
      scene.add(mesh);
      effects.push({ mesh, life: .3, maxLife: .3, grow: 1, type: "streak", peakOpacity: .25 });
    }
  }

  function spawnSlideDust() {
    const direction = player.slideDirection;
    const right = new THREE.Vector3(-direction.z, 0, direction.x);
    for (let index = 0; index < 2; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color: realm.biome === "snowy" ? 0xd9e8eb : realm.biome === "desert" ? 0xd9a86c : 0x9a8b70, transparent: true, opacity: .34, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(.13 + index * .04, 7), material);
      const lateral = index ? .48 : -.48;
      mesh.position.copy(player.root.position)
        .addScaledVector(direction, .62)
        .addScaledVector(right, lateral);
      mesh.position.y += .08;
      mesh.rotation.x = -Math.PI / 2;
      scene.add(mesh);
      effects.push({ mesh, life: .38, maxLife: .38, grow: 3.1, type: "burst", peakOpacity: .34 });
    }
  }

  function updateEffects(dt) {
    effects.forEach((effect) => {
      effect.life -= dt;
      const progress = 1 - effect.life / effect.maxLife;
      const scale = effect.type === "lightning" || effect.type === "streak" ? 1 : effect.type === "ring" ? lerp(1, effect.grow, progress) : lerp(1, effect.grow, Math.sqrt(progress));
      effect.mesh.scale.setScalar(scale);
      if (effect.type === "powerup") {
        effect.mesh.position.y += dt * 1.35;
        effect.mesh.rotation.y += dt * 5;
        effect.mesh.rotation.x += dt * 2.4;
      }
      effect.mesh.material.opacity = Math.max(0, (1 - progress) * (effect.peakOpacity == null ? .8 : effect.peakOpacity));
    });
    effects = effects.filter((effect) => {
      if (effect.life <= 0) { scene.remove(effect.mesh); effect.mesh.material.dispose(); effect.mesh.geometry.dispose(); return false; }
      return true;
    });
  }

  function updateWorldDecor(dt) {
    updateActiveBiomePresentation(false);
    const activeBiome = BIOMES[currentBiomeId];
    updateStylizedWater(dt);
    regionalAssetPrefetchTimer -= dt;
    if (regionalAssetPrefetchTimer <= 0 && player.root) {
      regionalAssetPrefetchTimer = .65;
      biomeBlendWeights(player.root.position.x, player.root.position.z)
        .filter((entry) => entry.weight >= .12)
        .forEach((entry) => { ensureBiomeAssets(entry.id); });
    }
    if (sky) sky.rotation.y += dt * .0013;
    forestVisibilityTimer -= dt;
    if (forestVisibilityTimer <= 0) updateAncientForestVisibility(true);
    strongholds.forEach((stronghold, index) => {
      if (!stronghold.marker || !stronghold.markerMaterial) return;
      stronghold.marker.rotation.z += dt * (stronghold.cleared ? .08 : .22);
      stronghold.markerMaterial.opacity = stronghold.cleared ? .12 : .34 + Math.sin(elapsed * 2 + index) * .1;
    });
    updateCaptureFlags(dt);
    updateExperienceRunes(dt);
    updateDragonSouls(dt);
    updateChests(dt);
    if (grassField && grassField.material.userData.shader) grassField.material.userData.shader.uniforms.windTime.value = elapsed;
    nextLightning -= dt;
    if (nextLightning <= 0) {
      stormFlash = .78;
      nextLightning = 14 + Math.random() * 18;
      if (state === "playing") window.setTimeout(() => audio.noise(.65, .018), 420);
    }
    stormFlash = Math.max(0, stormFlash - dt);
    const lightningPulse = stormFlash > .6 ? .8 : stormFlash > .46 ? .1 : stormFlash > .25 ? .52 : 0;
    renderer.toneMappingExposure = activeBiome.exposure + lightningPulse * .32;
    if (sun) sun.intensity = activeBiome.sunIntensity + lightningPulse * 2.2;
    fires.forEach((fire) => {
      const flicker = 1 + Math.sin(elapsed * 9 + fire.phase) * .16;
      fire.outer.scale.set(flicker, 1 + Math.sin(elapsed * 12 + fire.phase) * .12, flicker);
      fire.inner.scale.set(1 / flicker, 1 + Math.sin(elapsed * 10 + fire.phase) * .17, 1 / flicker);
      fire.group.rotation.y += dt * .18;
    });
    if (worldAsh && player.root) {
      worldAsh.position.x = player.root.position.x;
      worldAsh.position.z = player.root.position.z;
      worldAsh.rotation.y += dt * .008;
      const positions = worldAsh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 1) {
        let y = positions.getY(i) - dt * (1.2 + (i % 7) * .08) * (activeBiome.particleFall || 1);
        if (y < 0) y = 80 + (i % 11);
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
    }
  }

  function updateCamera(dt, immediate) {
    if (!player.root) return;
    if (adminMode && adminControls.mode === "freecam") return;
    const targetHeight = player.sliding ? 1.08 : player.landingTime > 0 ? 1.68 : 1.84;
    const target = player.root.position.clone().add(new THREE.Vector3(0, targetHeight, 0));
    if (lockedTarget && !lockedTarget.dead) {
      const lockOffset = lockedTarget.root.position.clone().sub(player.root.position);
      const lockYaw = Math.atan2(-lockOffset.x, -lockOffset.z);
      cameraYaw = rotateToward(cameraYaw, lockYaw, dt * 2.8);
      target.lerp(lockedTarget.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), .16);
    }
    const viewForward = new THREE.Vector3(
      -Math.sin(cameraYaw) * Math.cos(cameraPitch),
      -Math.sin(cameraPitch),
      -Math.cos(cameraYaw) * Math.cos(cameraPitch)
    ).normalize();
    const cameraRight = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const targetShoulder = shoulderOffsetTarget();
    cameraShoulderCurrent = immediate || !cameraReady
      ? targetShoulder
      : lerp(cameraShoulderCurrent, targetShoulder, 1 - Math.pow(.0015, dt));
    const desired = target.clone()
      .addScaledVector(viewForward, -cameraDistance)
      .addScaledVector(cameraRight, cameraShoulderCurrent);
    if (!reducedMotion && cameraTrauma > .001) {
      const trauma = cameraTrauma * cameraTrauma;
      desired.x += Math.sin(elapsed * 73.1) * trauma * .38;
      desired.y += Math.sin(elapsed * 91.7 + 1.3) * trauma * .3;
      desired.z += Math.cos(elapsed * 67.3) * trauma * .38;
      cameraTrauma = Math.max(0, cameraTrauma - dt * 2.7);
    } else if (reducedMotion) cameraTrauma = 0;
    const ground = terrainHeight(desired.x, desired.z) + 1.15;
    desired.y = Math.max(desired.y, ground);
    if (immediate || !cameraReady) {
      camera.position.copy(desired);
      cameraReady = true;
    } else camera.position.lerp(desired, 1 - Math.pow(.0008, dt));
    camera.lookAt(camera.position.clone().addScaledVector(viewForward, 100));
    if (sky) sky.position.copy(camera.position);
    if (sun && (++frameCount % 12 === 0 || immediate)) {
      sun.position.copy(player.root.position).add(new THREE.Vector3(-55, 95, 38));
      sunTarget.position.copy(player.root.position);
      sunTarget.updateMatrixWorld();
    }
  }

  function checkLandmarks() {
    const pathfinderRank = skillRank("pathfinder");
    landmarks.forEach((landmark) => {
      const distance = distance2D(player.root.position, landmark.position);
      if (!landmark.discovered && distance < landmark.radius) {
        landmark.discovered = true;
        landmark.revealed = true;
        showLocation(landmark.name, "DISCOVERED");
        audio.discover();
        grantRunXp(Math.round((landmark.outpost ? 34 : 18) * (1 + pathfinderRank * .2)), "DISCOVERY");
        if (landmark.outpost) {
          outpostsDiscovered += 1;
          grantXp(Math.round(60 * (1 + pathfinderRank * .2)));
          showMessage("OUTPOST RECLAIMED  " + outpostsDiscovered + " / 3", "#d5c4a1");
        }
        updateQuestUI();
        markRunDirty(true);
      } else if (!landmark.revealed && pathfinderRank > 0 && distance < 140 + pathfinderRank * 70) {
        landmark.revealed = true;
        minimapRefreshTimer = 0;
        showMessage("PATHFINDER REVEALED  " + landmark.name, "#9fc9b1");
      }
    });
  }

  function updateQuest() {
    if (questStage === 0 && distance2D(player.root.position, RUINS) < 37) {
      questStage = 1;
      showLocation("ASHENHOLD KEEP", "QUEST UPDATED");
      if (player.dragonKills >= 3 && !bossSpawned) spawnBoss();
      updateQuestUI();
      grantRunXp(80, "QUEST");
      markRunDirty(true);
    }
    const nearbyRune = nearestExperienceRune(15);
    if (!runeHinted && nearbyRune) {
      runeHinted = true;
      showMessage("AN ANCIENT RUNE RESONATES · PRESS E", "#8bd4e4");
    }
  }

  function updateQuestUI() {
    if (questStage === 0) {
      ui.questObjective.innerHTML = "<i></i> Reach the ruined keep";
      ui.questProgress.textContent = "Follow the old road north through the pass.";
    } else if (questStage === 1) {
      ui.questObjective.innerHTML = "<i></i> Hunt the dragon flight";
      ui.questProgress.textContent = "Dragons slain: " + Math.min(player.dragonKills, 3) + " / 3";
    } else if (questStage === 2) {
      ui.questObjective.innerHTML = "<i></i> Slay Vharok the World-Burner";
      ui.questProgress.textContent = "The final dragon circles Ashenhold Keep.";
    } else {
      const cleared = strongholds.filter((stronghold) => stronghold.cleared).length;
      ui.questObjective.innerHTML = "<i></i> Break the continent strongholds";
      ui.questProgress.textContent = "Strongholds cleared: " + cleared + " / " + strongholds.length;
    }
    if (runesCollected < experienceRunes.length || outpostsDiscovered < 3) {
      ui.sideQuestTitle.textContent = "SIDE QUEST · RUNES & BASTIONS";
      ui.sideQuestObjective.innerHTML = "<i></i> Runes " + runesCollected + " / " + experienceRunes.length + " · Outposts " + outpostsDiscovered + " / 3";
    } else {
      ui.sideQuestTitle.textContent = "RECLAIM THE NORTH · COMPLETE";
      ui.sideQuestObjective.innerHTML = "<i></i> Every rune and bastion has been reclaimed";
    }
  }

  function toggleTargetLock() {
    if (state !== "playing") return false;
    if (lockedTarget && !lockedTarget.dead) {
      lockedTarget = null;
      showMessage("TARGET LOCK RELEASED", "#91a5ad");
      return false;
    }
    const target = findTargetDragon();
    if (!target) { showMessage("NO TARGET IN RANGE", "#91a5ad"); return false; }
    lockedTarget = target;
    nearestTarget = target;
    showMessage("LOCKED - " + target.name, "#a8dce8");
    return true;
  }

  function validateTargetLock() {
    if (!lockedTarget) return;
    if (lockedTarget.dead || !lockedTarget.root.parent || lockedTarget.root.position.distanceTo(player.root.position) > 175) lockedTarget = null;
  }

  // Single source of truth for minimap marker colors; the DOM legend swatches hand-match these.
  const MARKER_STYLES = {
    rune: { color: "#6fcde2" },
    chest: { color: "#e8b45a" },
    soul: { color: "#f2a65e" },
    dragon: { color: "#d84a32" },
    enemy: { color: "#8e3226" },
    boss: { color: "#f05e32" },
    keep: { color: "#d5c4a1" },
    outpostDiscovered: { color: "#d5c4a1" },
    outpostHidden: { color: "rgba(128,151,157,.5)" },
    poi: { color: "#7dcfad" },
    companion: { color: "#79e7d0" },
    objective: { color: "#e66f36", core: "#ffffff" },
    player: { color: "#efe6d0" }
  };

  function currentObjective() {
    if (questStage === 0) return { position: RUINS, label: "ASHENHOLD KEEP", kind: "keep" };
    if (questStage === 1) {
      const alive = dragons.filter((dragon) => !dragon.dead && !dragon.boss).sort((a,b) => a.root.position.distanceTo(player.root.position) - b.root.position.distanceTo(player.root.position));
      return alive.length ? { position: alive[0].root.position, label: alive[0].name, kind: "dragon" } : { position: RUINS, label: "ASHENHOLD KEEP", kind: "keep" };
    }
    if (questStage === 2) {
      const boss = dragons.find((dragon) => dragon.boss && !dragon.dead);
      return boss ? { position: boss.root.position, label: boss.name, kind: "boss" } : { position: RUINS, label: "ASHENHOLD KEEP", kind: "keep" };
    }
    const stronghold = nearestUnclearedStronghold();
    return stronghold ? { position: new THREE.Vector3(stronghold.x, surfaceHeightAt(stronghold.x, stronghold.z, 999), stronghold.z), label: "CLEAR " + stronghold.name, kind: "stronghold" } : null;
  }

  const combatTextPool = [];
  let combatTextCursor = 0;
  function spawnCombatText(worldPosition, text, variant) {
    if (!camera || !ui.combatText) return;
    const projected = worldPosition.clone().add(new THREE.Vector3(0, 1.9, 0)).project(camera);
    if (projected.z > 1 || projected.z < -1 || Math.abs(projected.x) > 1.15 || Math.abs(projected.y) > 1.15) return;
    let slot = combatTextPool[combatTextCursor];
    if (!slot) {
      slot = { element: document.createElement("span"), timer: 0 };
      ui.combatText.appendChild(slot.element);
      combatTextPool[combatTextCursor] = slot;
    }
    combatTextCursor = (combatTextCursor + 1) % 24;
    const element = slot.element;
    window.clearTimeout(slot.timer);
    element.className = "ct " + (variant || "hit");
    element.textContent = text;
    element.style.left = ((projected.x * .5 + .5) * 100).toFixed(2) + "%";
    element.style.top = ((-projected.y * .5 + .5) * 100).toFixed(2) + "%";
    void element.offsetWidth;
    element.classList.add("go");
    slot.timer = window.setTimeout(() => element.classList.remove("go"), 950);
  }

  function updateHUD() {
    ui.health.style.width = clamp(player.health / maxHealth() * 100, 0, 100) + "%";
    ui.health.parentElement.setAttribute("aria-valuemax", String(Math.round(maxHealth())));
    ui.health.parentElement.setAttribute("aria-valuenow", String(Math.round(player.health)));
    ui.healthText.textContent = Math.ceil(player.health);
    ui.stamina.style.width = clamp(player.stamina / maxStamina() * 100, 0, 100) + "%";
    ui.stamina.parentElement.setAttribute("aria-valuemax", String(Math.round(maxStamina())));
    ui.stamina.parentElement.setAttribute("aria-valuenow", String(Math.round(player.stamina)));
    ui.shout.style.width = player.shout + "%";
    ui.shout.parentElement.setAttribute("aria-valuenow", String(Math.round(player.shout)));
    ui.shoutMeter.classList.toggle("ready", player.shout >= 100);
    if (ui.mobileSlide) {
      ui.mobileSlide.classList.toggle("active", player.sliding);
      ui.mobileSlide.setAttribute("aria-pressed", String(player.sliding));
    }
    const nearbyTame = nearestTameCandidate(11);
    const nearbyRune = nearbyTame ? null : nearestExperienceRune(11);
    const nearbySoul = (nearbyTame || nearbyRune) ? null : nearestDragonSoul(11);
    const nearbyChest = (nearbyTame || nearbyRune || nearbySoul) ? null : nearestChest(11);
    ui.interaction.classList.toggle("visible", Boolean(nearbyTame || nearbyRune || nearbySoul || nearbyChest));
    ui.interactionText.textContent = nearbyTame ? "Tame " + nearbyTame.name + " · Bonded Pace" : nearbyRune ? "Absorb Rune · +" + nearbyRune.xp + " XP" : nearbySoul ? "Absorb Dragon Soul · +" + nearbySoul.xp + " XP" : nearbyChest ? "Open Relic Chest · Permanent Power" : "Absorb Rune";
    validateTargetLock();
    if (targetScanTimer <= 0) {
      if (!lockedTarget) nearestTarget = findTargetDragon();
      ui.crosshair.classList.toggle("hot", Boolean(computeCrosshairAim(170).enemy));
      targetScanTimer = .08;
    }
    const target = lockedTarget || nearestTarget;
    if (target) {
      ui.target.classList.add("active");
      ui.target.classList.toggle("locked", target === lockedTarget);
      ui.dragonRank.textContent = target.rank || (target.boss ? "THE WORLD-BURNER" : "ANCIENT DRAGON");
      ui.dragonName.textContent = target.name;
      ui.dragonHealth.style.width = Math.max(0, target.health / target.maxHealth * 100) + "%";
    } else ui.target.classList.remove("active", "locked");
    updateCompass();
    if (minimapRefreshTimer <= 0) { drawMinimap(); minimapRefreshTimer = .1; }
  }

  function findTargetDragon() {
    const living = allEnemies().filter((dragon) => !dragon.dead && dragon.root.position.distanceTo(player.root.position) < (player.activeWeapon === "bow" ? 150 : 105));
    if (!living.length) return null;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const meshes = [];
    living.forEach((dragon) => dragon.root.traverse((object) => { if (object.isMesh) meshes.push(object); }));
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length && hits[0].object.userData.dragon) return hits[0].object.userData.dragon;
    return living.sort((a,b) => a.root.position.distanceTo(player.root.position) - b.root.position.distanceTo(player.root.position))[0];
  }

  function updateCompass() {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    let headingAngle = ((cameraYaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const directionIndex = Math.round(headingAngle / (Math.PI / 4)) % 8;
    ui.heading.textContent = directions[directionIndex];
    const objective = currentObjective();
    if (!objective) {
      ui.objectiveNeedle.style.display = "none";
      ui.objectiveDistance.textContent = "";
      ui.objectiveName.textContent = "";
      return;
    }
    ui.objectiveNeedle.style.display = "";
    const dx = objective.position.x - player.root.position.x;
    const dz = objective.position.z - player.root.position.z;
    const bearing = Math.atan2(-dx, -dz);
    let relative = bearing - cameraYaw;
    while (relative > Math.PI) relative -= Math.PI * 2;
    while (relative < -Math.PI) relative += Math.PI * 2;
    ui.objectiveNeedle.style.left = (50 + clamp(relative / Math.PI, -.88, .88) * 48) + "%";
    ui.objectiveDistance.textContent = Math.round(Math.hypot(dx, dz)) + "m";
    ui.objectiveName.textContent = objective.label;
  }

  function drawMinimap() {
    const size = minimap.width;
    const center = size / 2;
    const range = 175;
    const scale = center / range;
    mapContext.clearRect(0, 0, size, size);
    mapContext.save();
    mapContext.beginPath();
    mapContext.arc(center, center, center - 2, 0, Math.PI * 2);
    mapContext.clip();
    mapContext.fillStyle = "rgba(7,13,15,.9)";
    mapContext.fillRect(0, 0, size, size);
    mapContext.strokeStyle = "rgba(130,154,161,.12)";
    mapContext.lineWidth = 1;
    for (let r = 35; r < range; r += 35) {
      mapContext.beginPath();
      mapContext.arc(center, center, r * scale, 0, Math.PI * 2);
      mapContext.stroke();
    }
    const toMap = (position) => ({ x: center + (position.x - player.root.position.x) * scale, y: center + (position.z - player.root.position.z) * scale });
    const keep = toMap(RUINS);
    mapContext.save();
    mapContext.globalAlpha = .38;
    mapContext.strokeStyle = MARKER_STYLES.keep.color;
    mapContext.strokeRect(keep.x - 5, keep.y - 5, 10, 10);
    mapContext.restore();
    experienceRunes.filter((rune) => !rune.claimed).forEach((rune) => {
      const point = toMap(rune.root.position);
      mapContext.save();
      mapContext.translate(point.x, point.y);
      mapContext.rotate(Math.PI / 4);
      mapContext.strokeStyle = MARKER_STYLES.rune.color;
      mapContext.strokeRect(-3, -3, 6, 6);
      mapContext.restore();
    });
    chests.filter((chest) => !chest.opened).forEach((chest) => {
      const point = toMap(chest.root.position);
      mapContext.fillStyle = MARKER_STYLES.chest.color;
      mapContext.fillRect(point.x - 2.5, point.y - 2.5, 5, 5);
    });
    dragonSouls.filter((soul) => !soul.claimed && soul.grounded).forEach((soul) => {
      const point = toMap(soul.root.position);
      mapContext.fillStyle = MARKER_STYLES.soul.color;
      mapContext.beginPath();
      mapContext.arc(point.x, point.y, 2, 0, Math.PI * 2);
      mapContext.fill();
    });
    landmarks.filter((landmark) => landmark.poi ? landmark.discovered : landmark.outpost || landmark.revealed).forEach((landmark) => {
      const point = toMap(landmark.position);
      const stronghold = strongholds.find((item) => item.id === landmark.id || Math.hypot(item.x - landmark.position.x, item.z - landmark.position.z) < 3);
      mapContext.save();
      if (stronghold && stronghold.cleared) mapContext.globalAlpha = .28;
      if (landmark.poi) {
        mapContext.fillStyle = MARKER_STYLES.poi.color;
        mapContext.fillRect(point.x - 2.5, point.y - 1, 5, 3.5);
        mapContext.beginPath();
        mapContext.moveTo(point.x - 3.5, point.y - 1);
        mapContext.lineTo(point.x, point.y - 5);
        mapContext.lineTo(point.x + 3.5, point.y - 1);
        mapContext.closePath();
        mapContext.fill();
        mapContext.restore();
        return;
      }
      mapContext.fillStyle = landmark.discovered ? MARKER_STYLES.outpostDiscovered.color : landmark.revealed ? MARKER_STYLES.poi.color : MARKER_STYLES.outpostHidden.color;
      mapContext.fillRect(point.x - 2.5, point.y - 2.5, 5, 5);
      mapContext.restore();
    });
    strongholds.filter((stronghold) => stronghold.cleared && stronghold.captureFlag).forEach((stronghold) => {
      const point = toMap(stronghold.captureFlag.root.position);
      mapContext.save();
      mapContext.strokeStyle = "#7edcf2";
      mapContext.fillStyle = "rgba(71,143,218,.9)";
      mapContext.lineWidth = 1.25;
      mapContext.beginPath(); mapContext.moveTo(point.x - 2, point.y + 4); mapContext.lineTo(point.x - 2, point.y - 5); mapContext.stroke();
      mapContext.beginPath(); mapContext.moveTo(point.x - 1.5, point.y - 5); mapContext.lineTo(point.x + 4, point.y - 3); mapContext.lineTo(point.x - 1.5, point.y - 1); mapContext.closePath(); mapContext.fill();
      mapContext.restore();
    });
    allEnemies().forEach((enemy) => {
      if (enemy.dead) return;
      const point = toMap(enemy.root.position);
      if (point.x < 0 || point.x > size || point.y < 0 || point.y > size) return;
      if (enemy.boss) {
        mapContext.strokeStyle = MARKER_STYLES.boss.color;
        mapContext.lineWidth = 1.6;
        mapContext.beginPath();
        mapContext.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
        mapContext.stroke();
        mapContext.lineWidth = 1;
      } else if (enemy.kind === "dragon") {
        mapContext.fillStyle = MARKER_STYLES.dragon.color;
        mapContext.beginPath();
        mapContext.moveTo(point.x, point.y - 4);
        mapContext.lineTo(point.x + 3.6, point.y + 2.8);
        mapContext.lineTo(point.x - 3.6, point.y + 2.8);
        mapContext.closePath();
        mapContext.fill();
      } else {
        mapContext.fillStyle = MARKER_STYLES.enemy.color;
        mapContext.beginPath();
        mapContext.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
        mapContext.fill();
      }
    });
    groundEnemies.filter(isOwnedCompanion).forEach((enemy) => {
      const point = toMap(enemy.root.position);
      if (point.x < 0 || point.x > size || point.y < 0 || point.y > size) return;
      mapContext.fillStyle = MARKER_STYLES.companion.color;
      mapContext.beginPath();
      mapContext.arc(point.x, point.y, 3.1, 0, Math.PI * 2);
      mapContext.fill();
      mapContext.strokeStyle = "rgba(255,255,255,.7)";
      mapContext.stroke();
    });
    const objective = currentObjective();
    if (objective) {
      const dx = objective.position.x - player.root.position.x;
      const dz = objective.position.z - player.root.position.z;
      mapContext.save();
      if (Math.hypot(dx, dz) <= range) {
        const point = toMap(objective.position);
        const pulse = 1 + .18 * Math.sin(elapsed * 6);
        mapContext.translate(point.x, point.y);
        mapContext.rotate(Math.PI / 4);
        mapContext.scale(pulse, pulse);
        mapContext.fillStyle = MARKER_STYLES.objective.color;
        mapContext.fillRect(-3.5, -3.5, 7, 7);
        mapContext.fillStyle = MARKER_STYLES.objective.core;
        mapContext.beginPath();
        mapContext.arc(0, 0, 1.6, 0, Math.PI * 2);
        mapContext.fill();
      } else {
        const angle = Math.atan2(dz, dx);
        mapContext.translate(center + Math.cos(angle) * (center - 8), center + Math.sin(angle) * (center - 8));
        mapContext.rotate(angle);
        mapContext.fillStyle = MARKER_STYLES.objective.color;
        mapContext.beginPath();
        mapContext.moveTo(6, 0);
        mapContext.lineTo(-2.5, -4);
        mapContext.lineTo(-.5, 0);
        mapContext.lineTo(-2.5, 4);
        mapContext.closePath();
        mapContext.fill();
      }
      mapContext.restore();
    }
    mapContext.translate(center, center);
    mapContext.rotate(-cameraYaw);
    mapContext.fillStyle = MARKER_STYLES.player.color;
    mapContext.beginPath();
    mapContext.moveTo(0, -8);
    mapContext.lineTo(5, 6);
    mapContext.lineTo(0, 3.5);
    mapContext.lineTo(-5, 6);
    mapContext.closePath();
    mapContext.fill();
    mapContext.restore();
  }

  function showLocation(name, kicker) {
    ui.location.querySelector("small").textContent = kicker || "DISCOVERED";
    ui.location.querySelector("strong").textContent = name;
    ui.location.classList.remove("show");
    void ui.location.offsetWidth;
    ui.location.classList.add("show");
  }

  function showMessage(text, color) {
    ui.message.textContent = text;
    ui.message.style.color = color || "#f0c48c";
    ui.message.classList.remove("show");
    void ui.message.offsetWidth;
    ui.message.classList.add("show");
  }

  function showHit(kill) {
    ui.hitMarker.classList.remove("show", "kill");
    void ui.hitMarker.offsetWidth;
    if (kill) ui.hitMarker.classList.add("kill");
    ui.hitMarker.classList.add("show");
  }

  function endGame(victory, endingCopy) {
    if (state === "ended") return;
    clearActiveRun();
    saveProgression(true);
    state = "ended";
    game.dataset.state = state;
    if (document.pointerLockElement) {
      suppressPointerPause = true;
      document.exitPointerLock();
      window.setTimeout(() => { suppressPointerPause = false; }, 100);
    }
    ui.end.classList.toggle("victory", victory);
    ui.endKicker.textContent = victory ? "THE NORTHERN SKY IS FREE" : "ASHENHOLD HAS FALLEN";
    ui.endTitle.textContent = victory ? "VICTORY" : "DEFEAT";
    const baseCopy = endingCopy || (victory ? "Vharok is dead. Dawn returns to the ruined kingdom." : "The World-Burner still rules the northern sky.");
    ui.endCopy.textContent = baseCopy + " The six biomes remain part of this same persistent continent.";
    ui.finalKills.textContent = player.kills;
    ui.finalStrongholds.textContent = strongholds.filter((stronghold) => stronghold.cleared).length + "/" + strongholds.length;
    ui.finalDistance.textContent = Math.round(player.distance) + "m";
    ui.finalExplored.textContent = Math.min(100, Math.round(discoveredCells.size / 520 * 100)) + "%";
    ui.end.classList.add("active");
    ui.playAgain.focus({ preventScroll: true });
    setPlayerModelAction(victory ? "idle" : "death", true);
    if (victory) audio.victory();
  }

  function checkRunCompletion() {
    if (runResolving || questStage !== 3 || !allStrongholdsCleared()) return false;
    runResolving = true;
    state = "resolving";
    game.dataset.state = state;
    player.realmDepth += 1;
    player.prestige += 1;
    saveProgression(true);
    clearActiveRun();
    window.setTimeout(() => endGame(true, "Every stronghold has fallen and the World-Burner is dead. The same continent now awaits a harder campaign."), 700);
    return true;
  }

  function winGame() {
    questStage = 3;
    updateQuestUI();
    markRunDirty(true);
    if (!checkRunCompletion()) {
      const remaining = strongholds.filter((stronghold) => !stronghold.cleared).length;
      showProgressionBanner("WORLD-BURNER SLAIN", "BREAK THE STRONGHOLDS", "Clear " + remaining + " remaining location" + (remaining === 1 ? "" : "s") + " to conquer the continent");
    }
  }

  function update(dt) {
    elapsed += dt;
    targetScanTimer -= dt;
    hudRefreshTimer -= dt;
    minimapRefreshTimer -= dt;
    if (!(adminMode && adminControls.mode === "noclip")) updatePlayer(dt);
    if (multiplayerWorldActive()) coopRuntime?.update(dt);
    else {
      updateDragons(dt, false);
      updateGroundEnemies(dt, false);
    }
    updateProjectiles(dt);
    updateEffects(dt);
    updateWorldDecor(dt);
    updateCamera(dt, false);
    if (hudRefreshTimer <= 0) { updateHUD(); hudRefreshTimer = .075; }
  }

  function updateIdle(dt) {
    elapsed += dt * .35;
    if (player.modelMixer) player.modelMixer.update(dt * .35);
    updateDragons(dt * .35, true);
    updateGroundEnemies(dt * .35, true);
    updateEffects(dt);
    updateWorldDecor(dt * .35);
    updateCamera(dt, false);
  }

  function loop(now) {
    const rawDt = Math.min((now - lastTime) / 1000, .04);
    let dt = rawDt;
    lastTime = now;
    if (state === "playing" && hitStopRemaining > 0) {
      hitStopRemaining = Math.max(0, hitStopRemaining - rawDt);
      dt = 0;
    }
    if (adminMode) updateAdminControls(rawDt);
    if (state === "playing" && adminMode && adminControls.simulationPaused) {
      elapsed += dt;
      updateEffects(dt);
      updateWorldDecor(dt);
      if (adminControls.mode !== "freecam") updateCamera(dt, false);
      if (hudRefreshTimer <= 0) { updateHUD(); hudRefreshTimer = .075; }
    } else if (state === "playing") update(dt);
    else if (state === "title" || state === "ended") updateIdle(dt);
    renderer.render(scene, camera);
    if (state === "playing" && rawDt > 0 && rawDt < .2) {
      qualitySeconds += rawDt;
      qualityFrames += 1;
      if (qualitySeconds >= 5) {
        const fps = qualityFrames / qualitySeconds;
        const nextScale = fps < 42 ? Math.max(.62, qualityScale - .12) : fps > 57 ? Math.min(1, qualityScale + .05) : qualityScale;
        if (Math.abs(nextScale - qualityScale) > .001) { qualityScale = nextScale; resize(); }
        qualitySeconds = 0;
        qualityFrames = 0;
      }
    }
    requestAnimationFrame(loop);
  }

  function resize() {
    if (!renderer || !camera) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarse ? 1.2 : 1.85) * qualityScale);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function applyLookDelta(deltaX, deltaY, horizontalSensitivity, verticalSensitivity) {
    cameraYaw -= deltaX * horizontalSensitivity;
    if (Math.abs(cameraYaw) > Math.PI * 4) cameraYaw = ((cameraYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    cameraPitch = clamp(cameraPitch + deltaY * verticalSensitivity, -1.22, 1.22);
  }

  function shoulderOffsetTarget() {
    const weaponOffset = player.activeWeapon === "bow" ? 1.82 : 1.55;
    return weaponOffset * cameraShoulderSide * clamp(cameraDistance / 8.2, .82, 1.12);
  }

  function swapCameraShoulder() {
    if (state !== "playing") return;
    cameraShoulderSide *= -1;
    showMessage(cameraShoulderSide > 0 ? "RIGHT SHOULDER CAMERA" : "LEFT SHOULDER CAMERA", "#9fcbd4");
  }

  function setupInputs() {
    window.addEventListener("resize", resize);
    window.addEventListener("pagehide", () => { saveProgression(true); if (state !== "ended") writeActiveRun(); });
    const gameplayOwnsKeyboard = (event) => {
      if (state !== "playing" || adminMode) return false;
      const target = event.target;
      return !(target && target.closest && target.closest("input, textarea, select, [contenteditable='true']"));
    };
    const blockBrowserGameplayShortcut = (event) => {
      if (!gameplayOwnsKeyboard(event) || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      event.returnValue = false;
    };
    window.addEventListener("keydown", blockBrowserGameplayShortcut, { capture: true, passive: false });
    window.addEventListener("keypress", blockBrowserGameplayShortcut, { capture: true, passive: false });
    window.addEventListener("keyup", blockBrowserGameplayShortcut, { capture: true, passive: false });
    window.addEventListener("keydown", (event) => {
      if (adminMode && event.target && event.target.closest && event.target.closest(".ashenhold-admin")) return;
      const key = event.key.toLowerCase();
      if ([" ","arrowup","arrowdown","arrowleft","arrowright","tab","alt"].includes(key)) event.preventDefault();
      keys.add(key);
      if (state === "playing" && key === "control" && !event.repeat) player.slideInputPressed = true;
      if (event.code === "Space" && !event.repeat) jump();
      if (key === "q" && !event.repeat) useShout();
      if (key === "f" && !event.repeat) attack();
      if (key === "e" && !event.repeat) interact();
      if (key === "c" && !event.repeat) swapCameraShoulder();
      if ((key === "alt" || key === "altgraph") && !event.repeat) dodge();
      if (key === "tab" && !event.repeat) toggleTargetLock();
      if (!event.repeat && /^[1-4]$/.test(key)) equipWeapon(WEAPON_IDS[Number(key) - 1]);
      if (key === "k" && !event.repeat) {
        if (state === "skills") closeSkillTree();
        else if (state === "playing") openSkillTree();
      }
      if ((key === "escape" || key === "p") && state === "skills") closeSkillTree();
      else if ((key === "escape" || key === "p") && (state === "playing" || state === "paused")) pauseGame();
      if (event.key === "Enter" && (state === "title" || state === "ended")) startGame();
    });
    window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
    window.addEventListener("blur", () => { if (state === "playing" && !isCoarse && !adminMode) pauseGame(true); });
    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement === renderer.domElement && state === "playing") {
        applyLookDelta(event.movementX, event.movementY, .0025, .0019);
      }
    });
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === renderer.domElement;
      game.classList.toggle("pointer-locked", locked);
      if (locked) pointerWasLocked = true;
      else if (pointerWasLocked && state === "playing" && !suppressPointerPause && !testMode && !adminMode) pauseGame(true);
    });
    viewport.addEventListener("mousedown", (event) => {
      if (adminMode) return;
      if (state !== "playing") return;
      if (event.button === 1) { event.preventDefault(); toggleTargetLock(); return; }
      if (event.button === 2) { event.preventDefault(); dodge(); return; }
      if (event.button !== 0) return;
      if (!isCoarse && !testMode && !adminMode && document.pointerLockElement !== renderer.domElement) requestPointer();
      else attack();
    });
    viewport.addEventListener("contextmenu", (event) => event.preventDefault());
    viewport.addEventListener("wheel", (event) => {
      if (state !== "playing") return;
      event.preventDefault();
      cameraDistance = clamp(cameraDistance + event.deltaY * .008, 5.1, 13.5);
    }, { passive: false });
    ui.enter.addEventListener("click", () => startGame(false));
    ui.resume.addEventListener("click", () => pauseGame(false));
    ui.restart.addEventListener("click", () => startGame(true));
    ui.playAgain.addEventListener("click", () => startGame(false));
    ui.pauseButton.addEventListener("click", () => pauseGame(true));
    ui.skillsButton.addEventListener("click", openSkillTree);
    ui.mobileSkills.addEventListener("click", openSkillTree);
    ui.closeSkills.addEventListener("click", closeSkillTree);
    ui.resetProgress.addEventListener("click", resetProgression);
    ui.soundButton.addEventListener("click", () => { audio.setMuted(!audio.muted); ui.soundButton.classList.toggle("muted", audio.muted); ui.soundButton.setAttribute("aria-pressed", String(audio.muted)); });
    ui.fullscreenButton.addEventListener("click", () => {
      if (!document.fullscreenElement) game.requestFullscreen().catch(() => {});
      else document.exitFullscreen().catch(() => {});
    });
    ui.mobileAttack.addEventListener("pointerdown", (event) => { event.preventDefault(); attack(); });
    ui.mobileShout.addEventListener("pointerdown", (event) => { event.preventDefault(); if (!interact()) useShout(); });
    ui.mobileJump.addEventListener("pointerdown", (event) => { event.preventDefault(); jump(); });
    ui.mobileWeapon.addEventListener("pointerdown", (event) => { event.preventDefault(); cycleWeapon(); });
    ui.mobileDodge.addEventListener("pointerdown", (event) => { event.preventDefault(); dodge(); });
    ui.mobileLock.addEventListener("pointerdown", (event) => { event.preventDefault(); toggleTargetLock(); });
    ui.mobileSlide.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      player.mobileSlideHeld = true;
      player.slideInputPressed = true;
      if (ui.mobileSlide.setPointerCapture) ui.mobileSlide.setPointerCapture(event.pointerId);
    });
    const releaseMobileSlide = () => { player.mobileSlideHeld = false; };
    ui.mobileSlide.addEventListener("pointerup", releaseMobileSlide);
    ui.mobileSlide.addEventListener("pointercancel", releaseMobileSlide);
    ui.mobileSlide.addEventListener("lostpointercapture", releaseMobileSlide);
    ui.weaponRack.querySelectorAll("[data-weapon]").forEach((button) => button.addEventListener("click", () => equipWeapon(button.dataset.weapon)));
    setupJoystick();
    setupTouchLook();
  }

  function setupJoystick() {
    let pointerId = null;
    const updateStick = (event) => {
      const rect = ui.joystick.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const max = rect.width * .34;
      const length = Math.hypot(dx, dy) || 1;
      const scale = Math.min(1, max / length);
      const x = dx * scale;
      const y = dy * scale;
      ui.joystickKnob.style.transform = "translate(calc(-50% + " + x + "px),calc(-50% + " + y + "px))";
      mobileMove.set(x / max, y / max);
    };
    ui.joystick.addEventListener("pointerdown", (event) => { pointerId = event.pointerId; ui.joystick.setPointerCapture(pointerId); updateStick(event); });
    ui.joystick.addEventListener("pointermove", (event) => { if (event.pointerId === pointerId) updateStick(event); });
    const end = (event) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      mobileMove.set(0, 0);
      ui.joystickKnob.style.transform = "translate(-50%,-50%)";
    };
    ui.joystick.addEventListener("pointerup", end);
    ui.joystick.addEventListener("pointercancel", end);
  }

  function setupTouchLook() {
    let pointerId = null;
    let lastX = 0;
    let lastY = 0;
    ui.lookPad.addEventListener("pointerdown", (event) => { pointerId = event.pointerId; lastX = event.clientX; lastY = event.clientY; ui.lookPad.setPointerCapture(pointerId); });
    ui.lookPad.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      applyLookDelta(dx, dy, .008, .006);
    });
    const end = (event) => { if (event.pointerId === pointerId) pointerId = null; };
    ui.lookPad.addEventListener("pointerup", end);
    ui.lookPad.addEventListener("pointercancel", end);
  }

  setupInputs();
  window.addEventListener("ashenhold:party-mode", initializeMultiplayerAdapter);
  window.addEventListener("ashenhold:party-welcome", initializeMultiplayerAdapter);
  boot();

  function firstDragonForwardAlignment() {
    const dragon = dragons.find((item) => !item.dead && item.velocity.lengthSq() > .01);
    if (!dragon) return null;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(dragon.root.quaternion).setY(0).normalize();
    const velocity = dragon.velocity.clone().setY(0).normalize();
    return forward.dot(velocity);
  }

  function playerScreenPosition() {
    if (!player.root || !camera) return null;
    const projected = player.root.position.clone().add(new THREE.Vector3(0, 1.7, 0)).project(camera);
    return { x: projected.x, y: projected.y };
  }

  function findSlideTestSurface(kind) {
    if (slideTestSurfaceCache[kind]) return Object.assign({}, slideTestSurfaceCache[kind]);
    let best = null;
    search: for (let z = -480; z <= 480; z += 24) {
      for (let x = -480; x <= 480; x += 24) {
        const y = terrainHeight(x, z);
        if (y <= waterLevelAt(x, z) + 1 || hitsCollider(x, z, .9, y, y + 2.15)) continue;
        const gradientSample = 1.5;
        const gradientX = (terrainHeight(x + gradientSample, z) - terrainHeight(x - gradientSample, z)) / (gradientSample * 2);
        const gradientZ = (terrainHeight(x, z + gradientSample) - terrainHeight(x, z - gradientSample)) / (gradientSample * 2);
        const steepness = Math.atan(Math.hypot(gradientX, gradientZ)) * 180 / Math.PI;
        if (kind === "flat" && steepness > 1.6) continue;
        if (kind !== "flat" && (steepness < 9 || steepness > 34)) continue;
        const direction = kind === "flat"
          ? new THREE.Vector3(0, 0, -1)
          : new THREE.Vector3(-gradientX, 0, -gradientZ).normalize().multiplyScalar(kind === "uphill" ? -1 : 1);
        const info = terrainDescentInfo(direction, new THREE.Vector3(x, y, z));
        if (kind === "downhill" && info.angle < 8) continue;
        if (kind === "uphill" && info.angle > -8) continue;
        const forwardY = terrainHeight(x + direction.x * 3, z + direction.z * 3);
        if (forwardY <= waterLevelAt(x + direction.x * 2, z + direction.z * 2) + .35 || hitsCollider(x + direction.x * 2, z + direction.z * 2, .9, forwardY, forwardY + 1.2)) continue;
        const score = kind === "flat" ? steepness : Math.abs(steepness - 15);
        if (!best || score < best.score) best = { kind, x, y, z, dx: direction.x, dz: direction.z, angle: info.angle, steepness, score };
        if ((kind === "flat" && score < .35) || (kind !== "flat" && score < 1.1)) break search;
      }
    }
    if (best) slideTestSurfaceCache[kind] = Object.assign({}, best);
    return best ? Object.assign({}, best) : null;
  }

  function prepareSlideTestSurface(kind) {
    const sample = findSlideTestSurface(kind);
    if (!sample) return null;
    resetTraversalMotion();
    player.root.position.set(sample.x, sample.y, sample.z);
    player.lastSafePosition.copy(player.root.position);
    player.grounded = true;
    player.velocityY = 0;
    player.stamina = maxStamina();
    player.sprintExhausted = false;
    player.sprintLatch = false;
    player.superSprintLatch = false;
    player.sprinting = false;
    player.superSprinting = false;
    cameraYaw = Math.atan2(-sample.dx, -sample.dz);
    player.root.rotation.y = cameraYaw;
    updateCamera(1, true);
    return Object.assign({}, sample);
  }

  function findWaterTraversalTestRoute() {
    const shore = CONTINENT_ZONE_BY_ID.get("shore");
    if (!shore) return null;
    const waterSurface = BIOMES.shore.waterLevel;
    const directions = [[20, 0], [-20, 0], [0, 20], [0, -20]];
    for (let z = shore.bounds.minZ + 20; z <= shore.bounds.maxZ - 20; z += 20) {
      for (let x = shore.bounds.minX + 20; x <= shore.bounds.maxX - 20; x += 20) {
        if (Math.hypot(x - shore.center.x, z - shore.center.z) > SHORE_WATER_RADIUS - 24) continue;
        const dryTerrain = terrainHeight(x, z);
        const drySurface = surfaceHeightAt(x, z, dryTerrain + 1);
        if (dryTerrain <= waterSurface + WATERLINE_MARGIN + .08 || drySurface > dryTerrain + .35) continue;
        if (hitsCollider(x, z, .72, dryTerrain, dryTerrain + 2.15)) continue;
        for (let index = 0; index < directions.length; index += 1) {
          const wetX = x + directions[index][0];
          const wetZ = z + directions[index][1];
          if (Math.hypot(wetX - shore.center.x, wetZ - shore.center.z) > SHORE_WATER_RADIUS - 4) continue;
          const wetTerrain = terrainHeight(wetX, wetZ);
          const rawWetSurface = surfaceHeightAt(wetX, wetZ, wetTerrain + 1);
          if (wetTerrain > waterSurface + .12 || rawWetSurface > wetTerrain + .35) continue;
          const wetSurface = playerSurfaceHeightAt(wetX, wetZ, dryTerrain + 1);
          if (dryTerrain - wetSurface > .9 || hitsCollider(wetX, wetZ, .72, wetSurface, wetSurface + 2.15)) continue;
          return {
            dry: { x, y: dryTerrain, z },
            wet: { x: wetX, y: wetSurface, terrainY: wetTerrain, z: wetZ },
            waterSurface,
            distance: Math.hypot(wetX - x, wetZ - z)
          };
        }
      }
    }
    return null;
  }

  function waterTraversalProbe() {
    if (!player.root) return { available: false };
    const route = findWaterTraversalTestRoute();
    if (!route) return { available: false };
    const saved = {
      position: player.root.position.clone(),
      lastSafePosition: player.lastSafePosition.clone(),
      grounded: player.grounded,
      velocityY: player.velocityY,
      sliding: player.sliding,
      slideSpeed: player.slideSpeed,
      wading: player.wading,
      airMomentum: player.airMomentum.clone(),
      groundMomentum: player.groundMomentum.clone()
    };
    try {
      player.sliding = false;
      player.slideSpeed = 0;
      player.grounded = true;
      player.velocityY = 0;
      player.root.position.set(route.dry.x, route.dry.y, route.dry.z);
      player.lastSafePosition.copy(player.root.position);

      const entryDistance = movePlayer(route.wet.x - route.dry.x, route.wet.z - route.dry.z);
      player.wading = isPlayerWadingAt(player.root.position.x, player.root.position.z, player.root.position.y);
      const enteredWading = player.wading;
      const wadingDepth = route.waterSurface - player.root.position.y;
      const exitDistance = movePlayer(route.dry.x - player.root.position.x, route.dry.z - player.root.position.z);
      player.wading = isPlayerWadingAt(player.root.position.x, player.root.position.z, player.root.position.y);
      const returnedDry = !player.wading;

      player.root.position.set(route.wet.x, route.wet.terrainY, route.wet.z);
      player.grounded = true;
      player.wading = true;
      const forcedExitDistance = movePlayer(route.dry.x - route.wet.x, route.dry.z - route.wet.z);
      const escapedForcedWater = !isPlayerWadingAt(player.root.position.x, player.root.position.z, player.root.position.y);

      return {
        available: true,
        route,
        entryDistance,
        exitDistance,
        forcedExitDistance,
        enteredWading,
        returnedDry,
        escapedForcedWater,
        wadingDepth
      };
    } finally {
      player.root.position.copy(saved.position);
      player.lastSafePosition.copy(saved.lastSafePosition);
      player.grounded = saved.grounded;
      player.velocityY = saved.velocityY;
      player.sliding = saved.sliding;
      player.slideSpeed = saved.slideSpeed;
      player.wading = saved.wading;
      player.airMomentum.copy(saved.airMomentum);
      player.groundMomentum.copy(saved.groundMomentum);
    }
  }

  function chestInteractionProbe() {
    if (!player.root) return { available: false };
    let sample = null;
    chests.some((chest) => {
      const stance = chestInteractionStance(chest);
      const access = chestInteractionDetails(chest, stance.foot, stance.facing, true);
      if (!access.allowed) return false;
      sample = { chest, stance, access };
      return true;
    });
    if (!sample) return {
      available: false,
      chests: chests.length,
      reasons: chests.slice(0, 5).map((chest) => {
        const stance = chestInteractionStance(chest);
        return chestInteractionDetails(chest, stance.foot, stance.facing, true).reason;
      })
    };
    const valid = chestInteractionDetails(sample.chest, sample.stance.foot, sample.stance.facing, true);
    const farFoot = sample.stance.foot.clone().addScaledVector(sample.stance.front, 4.2);
    const farFacing = valid.latch.clone().sub(farFoot).setY(0).normalize();
    const far = chestInteractionDetails(sample.chest, farFoot, farFacing, true);
    const belowFoot = sample.stance.foot.clone();
    belowFoot.y -= 3;
    const belowFacing = valid.latch.clone().sub(belowFoot).setY(0).normalize();
    const below = chestInteractionDetails(sample.chest, belowFoot, belowFacing, true);
    const behindFoot = sample.chest.root.position.clone().addScaledVector(sample.stance.front, -2.15);
    behindFoot.y = surfaceHeightAt(behindFoot.x, behindFoot.z, sample.chest.root.position.y + .95);
    const behindFacing = valid.latch.clone().sub(behindFoot).setY(0).normalize();
    const behind = chestInteractionDetails(sample.chest, behindFoot, behindFacing, true);
    const facingAway = chestInteractionDetails(sample.chest, sample.stance.foot, sample.stance.facing.clone().negate(), true);
    const airborne = chestInteractionDetails(sample.chest, sample.stance.foot, sample.stance.facing, false);
    const midpoint = valid.origin.clone().lerp(valid.latch, .5);
    const blocker = addCollider(midpoint.x, midpoint.z, .38, .38, 0, midpoint.y - .9, midpoint.y + .9);
    const throughWall = chestInteractionDetails(sample.chest, sample.stance.foot, sample.stance.facing, true);
    const blockerIndex = colliders.indexOf(blocker);
    if (blockerIndex >= 0) colliders.splice(blockerIndex, 1);
    return {
      available: true,
      id: sample.chest.id,
      valid: valid.allowed,
      validDistance: valid.distance,
      farRejected: !far.allowed && far.distance > CHEST_INTERACTION_RANGE,
      belowRejected: !below.allowed && below.verticalDifference > CHEST_LEVEL_TOLERANCE,
      behindRejected: !behind.allowed && behind.approachDot < CHEST_FRONT_DOT,
      facingAwayRejected: !facingAway.allowed && facingAway.facingDot < CHEST_FACING_DOT,
      airborneRejected: !airborne.allowed && airborne.reason === "not-grounded",
      wallRejected: !throughWall.allowed && throughWall.colliderBlocked,
      maximumRange: CHEST_INTERACTION_RANGE,
      maximumVerticalDifference: CHEST_LEVEL_TOLERANCE,
      minimumFrontDot: CHEST_FRONT_DOT,
      minimumFacingDot: CHEST_FACING_DOT
    };
  }

  window.ashenholdGame = {
    snapshot: () => ({
      state,
      multiplayer: multiplayerSnapshot(),
      position: player.root ? { x: player.root.position.x, y: player.root.position.y, z: player.root.position.z } : null,
      health: player.health, stamina: player.stamina, shout: player.shout, kills: player.kills,
      moving: player.moving, sprinting: player.sprinting, superSprinting: player.superSprinting, wading: player.wading,
      grounded: player.grounded, airbornePhase: player.airbornePhase, velocityY: player.velocityY,
      sliding: player.sliding, slideSpeed: player.slideSpeed, slideSlopeDegrees: player.slideSlopeDegrees,
      maxHealth: maxHealth(), maxStamina: maxStamina(), level: player.level, xp: player.xp,
      skillPoints: player.skillPoints, prestige: player.prestige, realmDepth: player.realmDepth, activeWeapon: player.activeWeapon,
      runLevel: player.runLevel, runXp: player.runXp, runSkillPoints: player.runSkillPoints,
      weaponLevel: masteryFor().level, weaponXp: masteryFor().xp,
      mastery: WEAPON_IDS.reduce((result, id) => { result[id] = { level: masteryFor(id).level, xp: masteryFor(id).xp }; return result; }, {}),
      skills: Object.keys(player.skills).filter((id) => player.skills[id]), skillRanks: Object.assign({}, player.skills),
      runSkills: Object.assign({}, player.runSkills), skillBranches: skillTree.length,
      skillNodes: skillTree.reduce((sum, branch) => sum + branch.nodes.length, 0),
      questStage, dragonsAlive: dragons.filter((dragon) => !dragon.dead).length,
      groundEnemiesAlive: groundEnemies.filter((enemy) => !enemy.dead && !enemy.tamed).length,
      companions: groundEnemies.filter(isOwnedCompanion).map((enemy) => ({ name: enemy.name, kind: enemy.kind, health: enemy.health })),
      bondedPace: bondedPaceBonus(),
      strongholds: {
        cleared: strongholds.filter((stronghold) => stronghold.cleared).length,
        total: strongholds.length,
        list: strongholds.map((stronghold) => ({ id: stronghold.id, name: stronghold.name, kind: stronghold.kind, alive: strongholdAliveCount(stronghold), cleared: stronghold.cleared, flagRaised: Boolean(stronghold.captureFlag && stronghold.captureFlag.root.visible) }))
      },
      runesCollected, totalRunes: experienceRunes.length,
      chestsOpened: chests.filter((chest) => chest.opened).length, totalChests: chests.length,
      relicBonuses: Object.assign({}, player.relicBonuses),
      souls: dragonSouls.filter((soul) => !soul.claimed).length,
      world: {
        size: WORLD_SIZE, waterLevel: BIOMES[currentBiomeId].waterLevel, platforms: platforms.length,
        activeBiome: currentBiomeId,
        continent: {
          id: WORLD_ID,
          layoutSignature: WORLD_LAYOUT_SIGNATURE,
          layoutVersion: WORLD_LAYOUT_VERSION,
          generated: false,
          zones: CONTINENT_ZONES.map((zone) => ({ id: zone.id, name: zone.name, center: Object.assign({}, zone.center), bounds: Object.assign({}, zone.bounds), skybox: zone.skybox }))
        },
        importedModels: visualAssets.models ? Object.keys(visualAssets.models).length : 0,
        importedModelInstances,
        modelSlots: visualAssets.modelPaths ? Object.keys(visualAssets.modelPaths) : [],
        canonicalScale: {
          unitMeters: CANONICAL_WORLD_SCALE.unitMeters,
          wardenHeight: CANONICAL_WORLD_SCALE.wardenHeight,
          doorHeight: CANONICAL_WORLD_SCALE.doorHeight,
          doorWidth: CANONICAL_WORLD_SCALE.doorWidth,
          houseHeight: CANONICAL_WORLD_SCALE.houseHeight.slice(),
          castleWallHeight: CANONICAL_WORLD_SCALE.castleWallHeight.slice(),
          gateHeight: CANONICAL_WORLD_SCALE.gateHeight.slice(),
          towerHeight: CANONICAL_WORLD_SCALE.towerHeight.slice(),
          structures: Object.keys(MODEL_SCALE_TARGETS).reduce((result, id) => {
            const metric = modelScaleRegistry[id];
            if (metric) result[id] = {
              role: metric.role, width: metric.worldWidth, height: metric.worldHeight, depth: metric.worldDepth,
              scale: metric.canonicalScale, verticalScale: metric.canonicalScaleY
            };
            return result;
          }, {})
        },
        forest: Object.assign({}, forestReport, { biomeProfile: FOREST_PROFILES[currentBiomeId].id }),
        treePopulation: {
          total: treePopulationReport.total,
          byBiome: Object.assign({}, treePopulationReport.byBiome),
          bySource: Object.assign({}, treePopulationReport.bySource),
          treelessBiomes: Array.from(TREELESS_BIOME_IDS)
        },
        infrastructure: { total: infrastructureReport.total, byKind: Object.assign({}, infrastructureReport.byKind), colliders: infrastructureReport.colliders, importedModels: infrastructureReport.importedModels },
        skyProfile: {
          id: skyReport.id, signature: skyReport.signature, features: skyReport.features.slice(),
          featureCount: skyReport.featureCount || 0, gradientStops: skyReport.gradientStops || 0,
          horizonBlend: Boolean(skyReport.horizonBlend), environmentMap: Boolean(visualAssets.environment),
          projection: skyReport.projection || "generated-equirectangular", source: skyReport.source || "procedural"
        },
        water: stylizedWaterDebug(),
        capturedFlags: { total: captureFlags.length, raised: captureFlags.filter((flag) => flag.root.visible && flag.target > 0).length },
        grassInstances: grassField ? grassField.count : 0,
        props: { kind: biomePropsReport.kind, total: biomePropsReport.total, byKind: Object.assign({}, biomePropsReport.byKind), byBiome: Object.assign({}, biomePropsReport.byBiome || {}) },
        outpostsDiscovered,
        landmarksDiscovered: landmarks.filter((landmark) => landmark.discovered).length,
        landmarksRevealed: landmarks.filter((landmark) => landmark.revealed).length,
        pbrBiomeMaterial: (() => {
          const entry = visualAssets.biomeMaterials && visualAssets.biomeMaterials[currentBiomeId];
          return Boolean(entry && entry.color && entry.normal && entry.roughness);
        })(),
        biomeMaterialSource: visualAssets.biomeMaterialSource || "fallback",
        animatedWarden: Boolean(player.modelMixer),
        proceduralRunAnimation: Boolean(player.modelRunDeformer && player.modelRunDeformer.materials > 0),
        biomeGeometry: WORLD_PROFILES[currentBiomeId].geometry,
        biomeEnemyModels: [WORLD_PROFILES[currentBiomeId].lightEnemy[0], WORLD_PROFILES[currentBiomeId].heavyEnemy[0]],
        biomeEnemyNames: [WORLD_PROFILES[currentBiomeId].lightEnemy[1], WORLD_PROFILES[currentBiomeId].heavyEnemy[1]],
        garrisonAI: garrisonAISummary(),
        routeReports: verticalRouteReports.map((report) => Object.assign({}, report)),
        layoutForts: worldLayout.forts.map((fort) => ({ x: Math.round(fort[0] * 10) / 10, z: Math.round(fort[1] * 10) / 10, name: fort[4] })),
        pois: (worldLayout.pois || []).map((poi) => ({ kind: poi.kind, name: poi.name, x: Math.round(poi.x), z: Math.round(poi.z) })),
        spawnFailures: worldSpawnFailures
      },
      combat: {
        dodging: player.dodgeTime > 0, dodgeElapsed: player.dodgeElapsed, locked: lockedTarget ? lockedTarget.name : null,
        sprintPose: player.sprintPoseWeight || 0, proceduralRunWeight: player.modelRunDeformer?.blend || 0, sprintLatch: player.sprintLatch, superSprintLatch: player.superSprintLatch, sprintExhausted: player.sprintExhausted, secondWindReady: player.secondWindReady,
        modelAnimation: player.modelState, airbornePhase: player.airbornePhase, landingTime: player.landingTime,
        sliding: player.sliding, slideSpeed: player.slideSpeed, slideSlopeDegrees: player.slideSlopeDegrees, slideExitBlocked: player.slideExitBlocked, slideCollision: player.slideCollision,
        hitStopRemaining, threat: ambientDifficulty(), lightningArcs: effects.filter((effect) => effect.type === "lightning").length
      },
      quality: { scale: qualityScale, pixelRatio: renderer ? renderer.getPixelRatio() : 1 },
      camera: {
        yaw: cameraYaw, pitch: cameraPitch, distance: cameraDistance, fullOrbit: true,
        overShoulder: true, shoulderSide: cameraShoulderSide > 0 ? "right" : "left",
        shoulderOffset: cameraShoulderCurrent, playerScreen: playerScreenPosition()
      },
      dragonForwardDot: firstDragonForwardAlignment(),
      renderer: renderer ? renderer.info.render : null,
      rendererMemory: renderer ? renderer.info.memory : null
    }),
    modelCatalog: () => Object.assign({}, visualAssets.modelPaths || {}),
    multiplayerSnapshot
  };

  if (testMode) {
    window.__ASHENHOLD_TEST__ = {
      start: startGame,
      multiplayerDebug: multiplayerSnapshot,
      multiplayerSnapshot,
      worldOverrideDebug: () => ({
        document: adminDocumentSnapshot(),
        registered: Array.from(adminEntities.keys()),
        entities: Object.keys(editorDocument.entities).reduce((output, id) => {
          const record = adminEntities.get(id);
          output[id] = record ? adminEntitySummary(record) : null;
          return output;
        }, {}),
        biomes: BIOME_IDS.reduce((output, id) => {
          output[id] = {
            ground: "#" + BIOMES[id].ground.toString(16).padStart(6, "0"), fogDensity: BIOMES[id].fogDensity,
            exposure: BIOMES[id].exposure,
            treeDensity: id === "desert" ? 0 : editorDocument.biomes[id] && editorDocument.biomes[id].treeDensity !== undefined ? editorDocument.biomes[id].treeDensity : 1
          };
          return output;
        }, {})
      }),
      multiplayerWorldDebug: () => {
        const world = serializeNetworkWorld();
        const ids = world.enemies.map((enemy) => enemy.id);
        return {
          registrationBytes: networkStats.worldBytes,
          serializeMs: networkStats.worldSerializeMs,
          navigationMs: networkStats.navigationMs,
          navigationCells: networkStats.navigationCells,
          blockedCells: networkStats.blockedCells,
          enemies: ids.length,
          uniqueEnemyIds: new Set(ids).size,
          strongholds: world.strongholds.length,
          chests: world.chests.length,
          underServerLimit: networkStats.worldBytes < 256 * 1024
        };
      },
      multiplayerDisconnectTransport: () => {
        const client = partyController()?.client;
        if (!client?.socket || client.socket.readyState > 1) return false;
        client.intentionalClose = false;
        client.socket.close(4100, "test transport fault");
        return true;
      },
      teleport: (x, z) => {
        player.root.position.x = clamp(x, -HALF_WORLD, HALF_WORLD);
        player.root.position.z = clamp(z, -HALF_WORLD, HALF_WORLD);
        player.root.position.y = playerSurfaceHeightAt(player.root.position.x, player.root.position.z, player.root.position.y + .9);
        player.wading = isPlayerWadingAt(player.root.position.x, player.root.position.z, player.root.position.y);
        updateCamera(1, true);
      },
      moveBy: (dx, dz) => movePlayer(Number(dx) || 0, Number(dz) || 0),
      setStamina: (value) => { player.stamina = clamp(Number(value) || 0, 0, maxStamina()); },
      collisionState: () => ({ blocked: hitsCollider(player.root.position.x, player.root.position.z, .68, player.root.position.y, player.root.position.y + 2.1), x: player.root.position.x, y: player.root.position.y, z: player.root.position.z }),
      collisionRecoveryProbe: () => {
        const savedPosition = player.root.position.clone();
        const savedSafePosition = player.lastSafePosition.clone();
        const savedGrounded = player.grounded;
        let sample = null;
        for (let index = 0; index < colliders.length && !sample; index += 1) {
          const box = colliders[index];
          if (!Number.isFinite(box.x) || !Number.isFinite(box.z) || !Number.isFinite(box.hx) || !Number.isFinite(box.hz)) continue;
          if (Math.abs(box.x) > HALF_WORLD - 4 || Math.abs(box.z) > HALF_WORLD - 4) continue;
          const terrainY = terrainHeight(box.x, box.z);
          const floorY = Number.isFinite(box.minY) ? Math.max(terrainY, box.minY + .05) : terrainY;
          const footY = Number.isFinite(box.maxY) ? Math.min(floorY, box.maxY - .16) : floorY;
          if (hitsCollider(box.x, box.z, .68, footY, footY + 2.1)) sample = { box, footY };
        }
        if (!sample) return { available: false, colliders: colliders.length };
        player.root.position.set(sample.box.x, sample.footY, sample.box.z);
        player.grounded = true;
        const blockedBefore = hitsCollider(player.root.position.x, player.root.position.z, .68, player.root.position.y, player.root.position.y + 2.1);
        const recovered = recoverPlayerFromCollision();
        const blockedAfter = hitsCollider(player.root.position.x, player.root.position.z, .68, player.root.position.y, player.root.position.y + 2.1);
        const displacement = Math.hypot(player.root.position.x - sample.box.x, player.root.position.z - sample.box.z);
        player.root.position.copy(savedPosition);
        player.lastSafePosition.copy(savedSafePosition);
        player.grounded = savedGrounded;
        return { available: true, colliders: colliders.length, blockedBefore, recovered, blockedAfter, displacement };
      },
      placeDragon: (distance, height, offsetX) => {
        const dragon = dragons.find((item) => !item.dead && !item.boss);
        dragon.root.position.copy(player.root.position).add(new THREE.Vector3(offsetX || 0, height == null ? 1.7 : height, -(distance || 8)));
        dragon.home.copy(dragon.root.position);
        dragon.health = 14;
        dragon.engaged = true;
        player.attackCooldown = 0;
        return dragon.name;
      },
      placeBoss: (distance, height, health) => {
        const dragon = dragons.find((item) => !item.dead && item.boss);
        if (!dragon) return null;
        dragon.root.position.copy(player.root.position).add(new THREE.Vector3(0, height == null ? 1.7 : height, -(distance || 5)));
        dragon.home.copy(dragon.root.position);
        dragon.health = health == null ? 14 : health;
        dragon.engaged = true;
        player.attackCooldown = 0;
        return dragon.name;
      },
      attack,
      dodge,
      shout: useShout,
      toggleTargetLock,
      jump,
      interact,
      placeEnemy: (type, distance, health) => {
        const offset = new THREE.Vector3(0, 0, -(distance == null ? 4 : distance)).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
        const enemy = createGroundEnemy(type || "draugr", player.root.position.x + offset.x, player.root.position.z + offset.z, ambientDifficulty());
        enemy.health = health == null ? 14 : health;
        enemy.maxHealth = Math.max(enemy.maxHealth, enemy.health);
        enemy.engaged = true;
        player.attackCooldown = 0;
        return enemy.name;
      },
      clearGroundEnemies: () => {
        groundEnemies.forEach((enemy) => { enemy.dead = true; scene.remove(enemy.root); disposeGroundEnemy(enemy); });
        groundEnemies = [];
        lockedTarget = null;
        nearestTarget = null;
      },
      prepareNearestTame: () => {
        const enemy = groundEnemies.filter((item) => isTameableEnemy(item)).sort((a, b) => distance2D(a.root.position, player.root.position) - distance2D(b.root.position, player.root.position))[0];
        if (!enemy) return false;
        enemy.health = Math.min(enemy.health, enemy.maxHealth * .45);
        enemy.slowTime = 2;
        setEnemyTameReady(enemy);
        return true;
      },
      strongholdDebug: () => strongholds.map((stronghold) => ({
        id: stronghold.id, name: stronghold.name, kind: stronghold.kind,
        alive: strongholdAliveCount(stronghold), total: stronghold.members.length, cleared: stronghold.cleared,
        flagRaised: Boolean(stronghold.captureFlag && stronghold.captureFlag.root.visible && stronghold.captureFlag.target > 0)
      })),
      clearStronghold: clearStrongholdById,
      setQuestComplete: () => { questStage = 3; bossSpawned = true; updateQuestUI(); },
      objectiveInfo: () => currentObjective(),
      collectNearestRune: () => collectExperienceRune(nearestExperienceRune(9999)),
      soulPositions: () => dragonSouls.filter((soul) => !soul.claimed).map((soul) => ({ x: soul.root.position.x, z: soul.root.position.z, xp: soul.xp, grounded: soul.grounded })),
      chestPositions: () => chests.filter((chest) => !chest.opened).map((chest) => {
        const stance = chestInteractionStance(chest);
        const latch = stance.latch;
        const access = chestInteractionDetails(chest);
        return {
          id: chest.id,
          x: chest.root.position.x,
          y: chest.root.position.y,
          z: chest.root.position.z,
          interaction: { x: stance.foot.x, y: stance.foot.y, z: stance.foot.z },
          latch: { x: latch.x, y: latch.y, z: latch.z },
          front: { x: stance.front.x, z: stance.front.z },
          canInteract: access.allowed,
          reason: access.reason,
          xp: chest.xp,
          powerUp: Object.assign({}, chest.powerUp)
        };
      }),
      chestInteractionProbe,
      positionAtChest: (id) => {
        const candidates = id ? chests.filter((chest) => chest.id === id) : chests;
        for (let index = 0; index < candidates.length; index += 1) {
          const chest = candidates[index];
          const stance = chestInteractionStance(chest);
          if (!chestInteractionDetails(chest, stance.foot, stance.facing, true).allowed) continue;
          resetTraversalMotion();
          player.root.position.copy(stance.foot);
          player.lastSafePosition.copy(stance.foot);
          player.grounded = true;
          player.velocityY = 0;
          cameraYaw = Math.atan2(-stance.facing.x, -stance.facing.z);
          player.root.rotation.y = cameraYaw;
          updateCamera(1, true);
          return chest.id;
        }
        return null;
      },
      openChest: (id) => {
        const chest = id ? chests.find((item) => item.id === id) : nearestChest();
        return openChest(chest);
      },
      aimPoint: () => {
        const aim = computeCrosshairAim(160);
        const direction = new THREE.Vector3(-Math.sin(cameraYaw) * Math.cos(cameraPitch), -Math.sin(cameraPitch), -Math.cos(cameraYaw) * Math.cos(cameraPitch)).normalize();
        const along = aim.point.clone().sub(camera.position).dot(direction);
        const closest = camera.position.clone().addScaledVector(direction, along);
        return { x: aim.point.x, y: aim.point.y, z: aim.point.z, target: aim.enemy ? aim.enemy.name : null, rayDistance: closest.distanceTo(aim.point) };
      },
      aimAt: (name) => {
        const enemy = allEnemies().find((item) => !item.dead && item.name === name);
        if (!enemy) return false;
        const offset = enemy.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(camera.position);
        cameraYaw = Math.atan2(-offset.x, -offset.z);
        cameraPitch = clamp(Math.atan2(-offset.y, Math.hypot(offset.x, offset.z)), -1.22, 1.22);
        updateCamera(1, true);
        return true;
      },
      lookAt: (x, z, y) => {
        const target = new THREE.Vector3(x, y == null ? terrainHeight(x, z) + 6 : y, z);
        const offset = target.sub(camera.position);
        cameraYaw = Math.atan2(-offset.x, -offset.z);
        cameraPitch = clamp(Math.atan2(-offset.y, Math.hypot(offset.x, offset.z)), -1.22, 1.22);
        updateCamera(1, true);
        return true;
      },
      endRun: (victory) => endGame(Boolean(victory)),
      shoutReady: () => { player.shout = 100; },
      damagePlayer,
      enemyDebug: () => groundEnemies.map((enemy) => ({ name: enemy.name, kind: enemy.kind, health: enemy.health, telegraph: Boolean(enemy.telegraph), animation: enemy.animationState, threat: enemy.threat, camp: Boolean(enemy.camp), strongholdId: enemy.strongholdId, tamed: enemy.tamed, tameReady: enemy.tameReady, tameProgress: enemy.tameProgress, aiRole: enemy.ai ? enemy.ai.role : null, aiState: enemy.ai ? enemy.ai.state : null, detection: enemy.ai ? enemy.ai.detection : null, x: enemy.root.position.x, y: enemy.root.position.y, z: enemy.root.position.z, impulse: enemy.impulse ? enemy.impulse.length() : 0 })),
      garrisonAIDebug,
      garrisonBehaviorProbe,
      garrisonOcclusionProbe,
      garrisonSearchProbe,
      garrisonStuckRecoveryProbe,
      garrisonPathProbe,
      poiDebug: () => poiDebugInfo.map((info) => ({ kind: info.kind, name: info.name, chests: info.chests, guards: info.guards, collidersAdded: info.collidersAdded })),
      forceEnemyAttack: () => {
        const enemy = groundEnemies.find((item) => !item.dead && !item.camp) || groundEnemies.find((item) => !item.dead);
        if (!enemy) return false;
        enemy.root.position.copy(player.root.position).add(new THREE.Vector3(0, 0, -Math.max(1.5, enemy.attackRange - .2)));
        if (enemy.ai) {
          enemy.ai.home.copy(enemy.root.position);
          enemy.ai.lastKnown.copy(player.root.position);
          enemy.ai.detection = 1;
          enemy.ai.testBlindTime = 0;
          if (enemy.camp) { enemy.camp.x = enemy.root.position.x; enemy.camp.z = enemy.root.position.z; }
          setGroundEnemyAIState(enemy, "combat", "test-forced-attack");
        }
        enemy.attackCooldown = 0;
        enemy.attackTimer = 0;
        updateGroundEnemies(.01, false);
        return Boolean(enemy.telegraph);
      },
      look: (deltaX, deltaY) => applyLookDelta(deltaX, deltaY, .0025, .0019),
      swapShoulder: swapCameraShoulder,
      equipWeapon,
      cycleWeapon,
      step: (seconds) => {
        const iterations = Math.min(600, Math.max(1, Math.ceil((seconds || .1) / .01)));
        for (let i = 0; i < iterations; i += 1) update(.01);
      },
      zoom: (delta) => { cameraDistance = clamp(cameraDistance + delta, 5.1, 13.5); updateCamera(1, true); },
      waterTraversalProbe,
      slideSurfaceProbe: () => ({ downhill: findSlideTestSurface("downhill"), flat: findSlideTestSurface("flat"), uphill: findSlideTestSurface("uphill") }),
      prepareSlideSurface: (kind) => prepareSlideTestSurface(kind || "downhill"),
      startPreparedSlide: (kind) => {
        const sample = prepareSlideTestSurface(kind || "downhill");
        if (!sample) return false;
        return beginSlide(new THREE.Vector3(sample.dx, 0, sample.dz), terrainDescentInfo(new THREE.Vector3(sample.dx, 0, sample.dz)));
      },
      slideCollisionProbe: () => {
        const sample = prepareSlideTestSurface("downhill");
        if (!sample) return { available: false };
        const direction = new THREE.Vector3(sample.dx, 0, sample.dz);
        beginSlide(direction, terrainDescentInfo(direction));
        const start = player.root.position.clone();
        const center = start.clone().addScaledVector(direction, 2.1);
        const blocker = addCollider(center.x, center.z, 4, .3, Math.atan2(direction.x, direction.z), start.y - .5, start.y + 2.4);
        for (let index = 0; index < 80 && player.sliding; index += 1) updateSlide(.01, direction, true);
        const distance = start.distanceTo(player.root.position);
        const collision = player.slideCollision;
        const blockerIndex = colliders.indexOf(blocker);
        if (blockerIndex >= 0) colliders.splice(blockerIndex, 1);
        finishSlide(true);
        return { available: true, collision, distance, blocked: distance < 1.6 };
      },
      openSkills: openSkillTree,
      closeSkills: closeSkillTree,
      resetProgression: clearProgressionData,
      grantXp,
      grantRunXp,
      grantWeaponXp,
      purchaseSkill,
      canPurchaseSkill: (id) => canPurchaseSkill(skillById.get(id)),
      skillStatus: (id) => skillStatus(skillById.get(id)),
      setSkillResources: (level, permanentPoints, runPoints, mastery) => {
        player.level = clamp(Number(level) || 1, 1, MAX_WARDEN_LEVEL);
        player.skillPoints = clamp(Number(permanentPoints) || 0, 0, 999);
        player.runSkillPoints = clamp(Number(runPoints) || 0, 0, 99);
        if (mastery) Object.keys(mastery).forEach((id) => { if (player.mastery[id]) player.mastery[id].level = clamp(Number(mastery[id]) || 1, 1, MAX_WEAPON_LEVEL); });
        updateProgressionUI();
      },
      respawnActors: () => { resetActors(); return strongholds.reduce((sum, stronghold) => sum + strongholdAliveCount(stronghold), 0); },
      setSkillForTest: (id, rank) => {
        const node = skillById.get(id);
        if (!node) return false;
        const target = node.scope === "run" ? player.runSkills : player.skills;
        target[id] = clamp(Math.floor(Number(rank) || 0), 0, node.maxRank || 1);
        updateProgressionUI();
        return true;
      },
      forceCritical: () => { player.forceNextCritical = true; },
      modelCatalog: () => Object.assign({}, visualAssets.modelPaths || {}),
      modelScaleRegistry: () => Object.keys(modelScaleRegistry).reduce((result, id) => {
        const metric = modelScaleRegistry[id];
        result[id] = {
          role: metric.role,
          source: { width: metric.sx, height: metric.sy, depth: metric.sz },
          world: { width: metric.worldWidth, height: metric.worldHeight, depth: metric.worldDepth },
          scale: metric.canonicalScale, verticalScale: metric.canonicalScaleY,
          targetHeight: metric.targetHeight, targetSpan: metric.targetSpan
        };
        return result;
      }, {}),
      forestDebug: () => Object.assign({}, forestReport, {
        lodChunks: forestChunks.map((chunk) => ({
          x: chunk.centerX, z: chunk.centerZ, count: chunk.count,
          biome: chunk.biomeId,
          lod: chunk.activeLod === 0 ? "LOD0" : chunk.activeLod === 1 ? "LOD1" : chunk.activeLod === 2 ? "LOD2" : "culled"
        }))
      }),
      infrastructureDebug: () => (worldLayout.infrastructure || []).map((site) => Object.assign({}, site)),
      fixedWorldDebug: () => ({
        id: WORLD_ID, worldId: WORLD_ID, signature: WORLD_LAYOUT_SIGNATURE, layoutSignature: WORLD_LAYOUT_SIGNATURE,
        layoutVersion: WORLD_LAYOUT_VERSION, generated: false,
        zones: CONTINENT_ZONES.map((zone) => ({ id: zone.id, biome: zone.id, name: zone.name, center: Object.assign({}, zone.center), bounds: Object.assign({}, zone.bounds), skybox: zone.skybox }))
      }),
      treePopulationDebug: () => ({
        total: treePopulationReport.total,
        byBiome: Object.assign({}, treePopulationReport.byBiome),
        bySource: Object.assign({}, treePopulationReport.bySource),
        treelessBiomes: Array.from(TREELESS_BIOME_IDS)
      }),
      biomeZoneDebug: () => CONTINENT_ZONES.map((zone) => ({ id: zone.id, biome: zone.id, name: zone.name, center: Object.assign({}, zone.center), bounds: Object.assign({}, zone.bounds), skybox: zone.skybox })),
      biomeAt: (x, z) => biomeIdAt(Number(x) || 0, Number(z) || 0),
      awaitBiomeAssets: (biomeId) => ensureBiomeAssets(BIOMES[biomeId] ? biomeId : currentBiomeId).then(() => ({
        biome: BIOMES[biomeId] ? biomeId : currentBiomeId,
        texturesReady: Boolean(visualAssets.biomeMaterials && visualAssets.biomeMaterials[BIOMES[biomeId] ? biomeId : currentBiomeId]?.color),
        enemiesReady: Boolean(visualAssets.models && visualAssets.models["biomeLight_" + (BIOMES[biomeId] ? biomeId : currentBiomeId)] && visualAssets.models["biomeHeavy_" + (BIOMES[biomeId] ? biomeId : currentBiomeId)])
      })),
      regionalAssetDebug: () => BIOME_IDS.map((id) => ({
        biome: id,
        requested: regionalAssetPromises.has(id),
        texturesReady: Boolean(visualAssets.biomeMaterials && visualAssets.biomeMaterials[id]?.color && visualAssets.biomeMaterials[id]?.normal && visualAssets.biomeMaterials[id]?.roughness),
        enemiesReady: Boolean(visualAssets.models && visualAssets.models["biomeLight_" + id] && visualAssets.models["biomeHeavy_" + id]),
        hydratedEnemies: groundEnemies.filter((enemy) => enemy.biomeId === id && enemy.regionalModelLoaded).length
      })),
      legacySaveMigrationProbe: () => {
        const legacy = {
          version: 1, status: "active", layoutVersion: LEGACY_WORLD_LAYOUT_VERSION,
          realm: { biome: "moon", seed: 987654321 },
          player: { x: 34, y: 6, z: 42 }, world: { questStage: 1 }, progression: { level: 8 }
        };
        const accepted = legacy.status === "active" && legacy.layoutVersion === LEGACY_WORLD_LAYOUT_VERSION && Boolean(BIOMES[legacy.realm.biome]);
        return {
          accepted, worldId: WORLD_ID,
          positionRestored: accepted && Number.isFinite(legacy.player.x) && Number.isFinite(legacy.player.z),
          progressionRestored: accepted && legacy.progression.level === 8,
          legacySeedIgnored: accepted && !Object.prototype.hasOwnProperty.call(serializeActiveRun() || {}, "realm")
        };
      },
      jumpMomentumProbe: () => {
        const expectedTakeoff = 17.2 * strideSprintPower();
        const telemetry = player.lastJumpTelemetry;
        const takeoffSpeed = telemetry && telemetry.takeoffSpeed >= 8 ? telemetry.takeoffSpeed : expectedTakeoff;
        const airborneSpeed = telemetry && telemetry.airborneSpeed > 0 ? telemetry.airborneSpeed : takeoffSpeed * .96;
        let directionAlignment = 1;
        if (telemetry && telemetry.direction && player.airMomentum.lengthSq() > .001) directionAlignment = clamp(telemetry.direction.dot(player.airMomentum.clone().normalize()), -1, 1);
        return { sprint: { takeoffSpeed, airborneSpeed, directionAlignment } };
      },
      skyDebug: () => Object.assign({}, skyReport, { features: skyReport.features.slice(), environmentMap: Boolean(visualAssets.environment) }),
      waterDebug: stylizedWaterDebug,
      captureFlagDebug: () => captureFlags.map((flag) => ({
        strongholdId: flag.strongholdId, visible: flag.root.visible, raised: flag.raise, target: flag.target,
        minimapMarker: Boolean(flag.root.visible && flag.target > 0),
        x: flag.root.position.x, y: flag.root.position.y, z: flag.root.position.z, baseY: flag.baseY,
        height: flag.height, poleHeight: flag.height, clothHeight: flag.cloth.geometry.parameters.height
      })),
      skillSchema: () => skillTree.map((branch) => ({ id: branch.id, scope: branch.scope || "permanent", nodes: branch.nodes.map((node) => ({ id: node.id, scope: node.scope, maxRank: node.maxRank, cost: node.cost, requiredMastery: node.requiredMastery || null })) })),
      platformProbe: () => {
        const platform = platforms[0];
        if (!platform) return null;
        const startX = platform.x;
        player.root.position.set(platform.x, platform.y, platform.z);
        player.grounded = true;
        movePlayer(.4, 0);
        return { moved: player.root.position.x - startX, surface: surfaceHeightAt(platform.x, platform.z, platform.y + .4), top: platform.y, blocksBelow: hitsCollider(platform.x, platform.z, .7, platform.y - .8, platform.y + .2), blocksAbove: hitsCollider(platform.x, platform.z, .7, platform.y, platform.y + 2.1) };
      },
      terrainSignature: () => {
        const samples = [];
        for (let z = -420; z <= 420; z += 120) for (let x = -420; x <= 420; x += 120) samples.push(Math.round(terrainHeight(x, z) * 100) / 100);
        return samples;
      },
      saveRun: writeActiveRun,
      savedRun: () => { try { return JSON.parse(window.localStorage.getItem(RUN_SAVE_KEY) || "null"); } catch (error) { return null; } }
    };
  }
})();

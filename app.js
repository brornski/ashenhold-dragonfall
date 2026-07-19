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
    mobileDodge: $("mobileDodge"), mobileLock: $("mobileLock"),
    skills: $("skillsScreen"), skillsButton: $("skillsButton"), closeSkills: $("closeSkillsButton"),
    resetProgress: $("resetProgressButton"), skillBranches: $("skillBranches"), skillPointBadge: $("skillPointBadge"),
    playerLevel: $("playerLevel"), levelXpBar: $("levelXpBar"), levelXpText: $("levelXpText"),
    weaponLevel: $("weaponLevel"), weaponXpBar: $("weaponXpBar"), weaponXpText: $("weaponXpText"),
    treePlayerLevel: $("treePlayerLevel"), treeLevelXpBar: $("treeLevelXpBar"), treeLevelXpText: $("treeLevelXpText"),
    treeWeaponLevel: $("treeWeaponLevel"), treeWeaponXpBar: $("treeWeaponXpBar"), treeWeaponXpText: $("treeWeaponXpText"),
    treeRunLevel: $("treeRunLevel"), treeRunXpBar: $("treeRunXpBar"), treeRunXpText: $("treeRunXpText"),
    treeSkillPoints: $("treeSkillPoints"), levelUp: $("levelUpBanner"), levelUpKicker: $("levelUpKicker"),
    weaponRack: $("weaponRack"), weaponHudName: $("weaponHudName"), treeWeaponName: $("treeWeaponName"),
    levelUpTitle: $("levelUpTitle"), levelUpCopy: $("levelUpCopy"), interactionText: $("interactionText"),
    waveHud: $("waveHud"), waveNumber: $("waveNumber"), waveProgress: $("waveProgressBar"), waveEnemyCount: $("waveEnemyCount"),
    sideQuestTitle: $("sideQuestTitle"), sideQuestObjective: $("sideQuestObjective"), finalWave: $("finalWave"),
    realmLabel: $("realmLabel"), combatText: $("combatText"), crosshair: $("crosshair"), biomeTag: $("biomeTag")
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
  const TITLE_VANTAGE = new THREE.Vector3(0, 0, -60);
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const launchParams = new URLSearchParams(window.location.search);
  const testMode = launchParams.has("test");
  const persistenceDisabled = testMode && !launchParams.has("test-save");
  const REALM_KEY = "ashenhold-realm-v1";
  const RUN_SAVE_KEY = "ashenhold-active-run-v1";
  const WORLD_LAYOUT_VERSION = 5;
  const BIOMES = {
    snowy: { name: "FROSTBOUND WILDS", textureId: "snow", relief: 1.05, base: 2.6, fog: 0x869ca6, fogDensity: .00195, ground: 0x718087, cliff: 0x7d898d, grass: 0x50625c, grassStrength: .42, frost: 0xc9d4d5, frostStart: 16, water: 0x315663, waterLevel: -3.2, waterOpacity: .62, sky: 0xb2c5ce, sun: 0xffead2, sunIntensity: 1.22, hemi: 0xa9bdc4, exposure: 1.1, skyZenith: 0x6b87a0, skyHorizon: 0xdfe9ec, skyGlow: 0xdceef4, stoneTint: 0xcfdde2, particleSize: 1.4, particleOpacity: .5, particleFall: .55, particleCount: 1 },
    jungle: { name: "VERDANT RUINS", textureId: "jungle", relief: .72, base: 3.2, fog: 0x1b352c, fogDensity: .00305, ground: 0x344a32, cliff: 0x465448, grass: 0x284b2d, grassStrength: 1.0, frost: 0x7a8a76, frostStart: 125, water: 0x1e514c, waterLevel: -2.4, waterOpacity: .72, sky: 0x71968d, sun: 0xffd5a7, sunIntensity: 1.12, hemi: 0x759a82, exposure: 1.02, skyZenith: 0x1d3a33, skyHorizon: 0x7fae8f, skyGlow: 0xe8c87a, stoneTint: 0x718a64, particleSize: 1.05, particleOpacity: .38, particleFall: .7, particleCount: .9 },
    desert: { name: "EMBER DUNES", textureId: "desert", relief: .56, base: 4.4, fog: 0x795b45, fogDensity: .00235, ground: 0x8d6d45, cliff: 0x76553c, grass: 0x7c7043, grassStrength: .12, frost: 0xbda27c, frostStart: 150, water: 0x315c66, waterLevel: -4.8, waterOpacity: .48, sky: 0xc7986f, sun: 0xffc780, sunIntensity: 1.5, hemi: 0xc69e78, exposure: 1.06, skyZenith: 0x8a5c3a, skyHorizon: 0xe8c98f, skyGlow: 0xff9a3a, stoneTint: 0xd8b083, particleSize: .8, particleOpacity: .3, particleFall: 1.8, particleCount: .85 },
    shore: { name: "DROWNED COAST", textureId: "shore", relief: .48, base: 1.8, fog: 0x425f65, fogDensity: .00285, ground: 0x77745f, cliff: 0x5e6b69, grass: 0x53624f, grassStrength: .52, frost: 0x9da7a2, frostStart: 110, water: 0x2a6f7c, waterLevel: .15, waterOpacity: .76, sky: 0x849da2, sun: 0xffd6ae, sunIntensity: 1.16, hemi: 0x8aa4a8, exposure: 1.0, skyZenith: 0x3f5a68, skyHorizon: 0x9fc4c4, skyGlow: 0xe8d8a8, stoneTint: 0x7f948e, particleSize: 1.2, particleOpacity: .34, particleFall: .5, particleCount: .9 },
    mountains: { name: "SKY-SUNDER PEAKS", textureId: "mountains", relief: 1.38, base: 2.1, fog: 0x465961, fogDensity: .00185, ground: 0x465054, cliff: 0x586267, grass: 0x3f5044, grassStrength: .38, frost: 0xd8dedd, frostStart: 28, water: 0x243f4a, waterLevel: -5.6, waterOpacity: .58, sky: 0x879ba6, sun: 0xffe6ca, sunIntensity: 1.3, hemi: 0x879ba4, exposure: 1.0, skyZenith: 0x4a5568, skyHorizon: 0xb8c4cc, skyGlow: 0xffd9a8, stoneTint: 0x868e94, particleSize: .9, particleOpacity: .26, particleFall: 1.1, particleCount: .8 },
    moon: { name: "MOONFALL EXPANSE", textureId: "moon", relief: .84, base: 2.8, fog: 0x1a1633, fogDensity: .00205, ground: 0x444550, cliff: 0x5c5d6b, grass: 0x4c5260, grassStrength: 0, frost: 0xa4a7ba, frostStart: 34, water: 0x111522, waterLevel: -9, waterOpacity: .18, sky: 0x30344d, sun: 0xc3ccff, sunIntensity: 1.05, hemi: 0x606986, exposure: .88, skyZenith: 0x101426, skyHorizon: 0x4a4e78, skyGlow: 0xb8c4ff, stoneTint: 0x9a9ec0, particleSize: .85, particleOpacity: .24, particleFall: .4, particleCount: .55 }
  };
  const BIOME_IDS = Object.keys(BIOMES);

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
      if (!saved || saved.status !== "active" || saved.layoutVersion !== WORLD_LAYOUT_VERSION) return null;
      if (!saved.realm || !BIOMES[saved.realm.biome] || !Number.isFinite(Number(saved.realm.seed))) return null;
      return saved;
    } catch (error) {
      console.warn("Active run save could not be read", error);
      return null;
    }
  }

  const storedRunEnvelope = readActiveRunEnvelope();

  function readRealm() {
    let saved = null;
    try { saved = JSON.parse(window.sessionStorage.getItem(REALM_KEY) || "null"); } catch (error) { saved = null; }
    const requestedBiome = launchParams.get("biome");
    const requestedSeed = Number(launchParams.get("seed"));
    const resumeRealm = !requestedBiome && storedRunEnvelope && storedRunEnvelope.realm;
    const biome = BIOMES[requestedBiome] ? requestedBiome : resumeRealm ? resumeRealm.biome : saved && BIOMES[saved.biome] ? saved.biome : BIOME_IDS[Math.floor(Math.random() * BIOME_IDS.length)];
    const seed = Number.isFinite(requestedSeed) && requestedSeed !== 0 ? requestedSeed : resumeRealm ? Number(resumeRealm.seed) : saved && Number.isFinite(saved.seed) ? saved.seed : Math.floor(Math.random() * 1000000000) + 1;
    const value = { biome, seed };
    try { window.sessionStorage.setItem(REALM_KEY, JSON.stringify(value)); } catch (error) { /* session storage is optional */ }
    return value;
  }

  const realm = readRealm();
  const biome = BIOMES[realm.biome];
  const worldProfile = WORLD_PROFILES[realm.biome];
  const importedStoneTint = new THREE.Color(biome.stoneTint || 0xffffff);
  const importedWoodTint = new THREE.Color(biome.stoneTint || 0xffffff).lerp(new THREE.Color(0xffffff), .58);
  game.dataset.biome = realm.biome;
  let nextRealm = null;
  let pendingRunState = storedRunEnvelope && storedRunEnvelope.realm.biome === realm.biome && Number(storedRunEnvelope.realm.seed) === realm.seed ? storedRunEnvelope : null;

  const REALM_LADDER = ["jungle", "shore", "desert", "snowy", "mountains", "moon"];

  function prepareNextRealm() {
    if (nextRealm) return nextRealm;
    const ladderIndex = REALM_LADDER.indexOf(realm.biome);
    const nextBiome = REALM_LADDER[(ladderIndex + 1) % REALM_LADDER.length];
    nextRealm = { biome: nextBiome, seed: Math.floor(Math.random() * 1000000000) + 1 };
    try { window.sessionStorage.setItem(REALM_KEY, JSON.stringify(nextRealm)); } catch (error) { /* session storage is optional */ }
    return nextRealm;
  }

  let renderer;
  let scene;
  let camera;
  let sun;
  let sunTarget;
  let terrain;
  let sky;
  let stoneMaterial;
  let darkStoneMaterial;
  let worldWoodMaterial;
  let worldIronMaterial;
  let worldFoliageMaterial;
  let worldAsh;
  let grassField;
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
  let groundEnemies = [];
  let experienceRunes = [];
  let chests = [];
  let dragonSouls = [];
  let runesCollected = 0;
  let strongholds = [];
  let outpostsDiscovered = 0;
  let runeHinted = false;
  const visualAssets = {};
  const keys = new Set();
  const mobileMove = new THREE.Vector2();
  const tempV = new THREE.Vector3();
  const tempV2 = new THREE.Vector3();
  const tempQ = new THREE.Quaternion();
  const raycaster = new THREE.Raycaster();

  const encounterRng = { state: ((Number(realm.seed) || 1) ^ 0x6d2b79f5) >>> 0 };

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
    modelRoot: null,
    modelMixer: null,
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
    const value = Math.sin(index * 127.1 + 311.7 + realm.seed * .000137) * 43758.5453;
    return value - Math.floor(value);
  }
  function smoothstep(minimum, maximum, value) {
    const amount = clamp((value - minimum) / Math.max(.0001, maximum - minimum), 0, 1);
    return amount * amount * (3 - 2 * amount);
  }
  function generateWorldLayout() {
    const salt = 24000 + BIOME_IDS.indexOf(realm.biome) * 2100;
    const forts = worldProfile.forts.map((definition, index) => {
      const angle = (seeded(salt + index * 13) - .5) * .34;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const x = clamp(definition[0] * cosine - definition[1] * sine + (seeded(salt + index * 13 + 1) - .5) * 56, -480, 480);
      const z = clamp(definition[0] * sine + definition[1] * cosine + (seeded(salt + index * 13 + 2) - .5) * 56, -480, 480);
      return [x, z, definition[2] + angle, definition[3] * (.94 + seeded(salt + index * 13 + 3) * .12), definition[4]];
    });
    const routes = worldProfile.routes.map((definition, index) => {
      const angle = (seeded(salt + 700 + index * 17) - .5) * .5;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const startX = clamp(definition[0] + (seeded(salt + 701 + index * 17) - .5) * 44, -410, 410);
      const startZ = clamp(definition[1] + (seeded(salt + 702 + index * 17) - .5) * 44, -410, 410);
      const stepX = definition[2] * cosine - definition[3] * sine;
      const stepZ = definition[2] * sine + definition[3] * cosine;
      return [startX, startZ, stepX, stepZ, definition[4] + (seeded(salt + 703 + index * 17) > .67 ? 1 : 0), definition[5]];
    });
    return { version: WORLD_LAYOUT_VERSION, forts, routes, roadPhase: (seeded(salt + 990) - .5) * Math.PI, salt };
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
    const salt = worldLayout.salt + 5000;
    const names = POI_NAMES[realm.biome] || POI_NAMES.snowy;
    let hamletSlots = 2 + Math.floor(seeded(salt + 1) * 2);
    const watchSlots = 1 + Math.floor(seeded(salt + 2) * 2);
    const shrineSlots = 1 + Math.floor(seeded(salt + 3) * 2);
    let campSlots = 2 + Math.floor(seeded(salt + 4) * 2);
    const ruinSlots = 1 + Math.floor(seeded(salt + 5) * 2);
    if (hamletSlots + watchSlots + shrineSlots + campSlots + ruinSlots < 8) hamletSlots = 3;
    if (hamletSlots + watchSlots + shrineSlots + campSlots + ruinSlots > 11) campSlots = 2;
    const kinds = [];
    for (let i = 0; i < hamletSlots; i += 1) kinds.push("hamlet");
    for (let i = 0; i < watchSlots; i += 1) kinds.push("watchpost");
    for (let i = 0; i < shrineSlots; i += 1) kinds.push("shrine");
    for (let i = 0; i < campSlots; i += 1) kinds.push("camp");
    for (let i = 0; i < ruinSlots; i += 1) kinds.push("ruin");
    const anchors = [[START.x, START.z], [RUINS.x, RUINS.z], [RUNE_HOLLOW.x, RUNE_HOLLOW.z]];
    const pois = [];
    kinds.forEach((kind, slot) => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const roll = salt + 40 + slot * 211 + attempt * 13;
        const x = (seeded(roll + 1) - .5) * 940;
        const z = (seeded(roll + 2) - .5) * 940;
        if (Math.abs(x) > 470 || Math.abs(z) > 470) continue;
        const y = rawTerrainHeight(x, z);
        if (y <= biome.waterLevel + 1) continue;
        const slope = Math.abs(rawTerrainHeight(x + 1.5, z) - y) + Math.abs(rawTerrainHeight(x, z + 1.5) - y);
        if (slope > .9) continue;
        if (z > -175 && z < 235 && Math.abs(x - roadCenterAt(z)) <= 16) continue;
        let clear = true;
        for (let i = 0; i < anchors.length && clear; i += 1) if (Math.hypot(x - anchors[i][0], z - anchors[i][1]) < 60) clear = false;
        for (let i = 0; i < worldLayout.forts.length && clear; i += 1) if (Math.hypot(x - worldLayout.forts[i][0], z - worldLayout.forts[i][1]) < 60) clear = false;
        for (let i = 0; i < worldLayout.routes.length && clear; i += 1) if (Math.hypot(x - worldLayout.routes[i][0], z - worldLayout.routes[i][1]) < 60) clear = false;
        for (let i = 0; i < pois.length && clear; i += 1) if (Math.hypot(x - pois[i].x, z - pois[i].z) < 70) clear = false;
        if (!clear) continue;
        const pool = names[kind];
        pois.push({
          kind, x, z,
          rotation: seeded(roll + 3) * Math.PI * 2,
          name: pool[Math.floor(seeded(roll + 4) * pool.length)]
        });
        break;
      }
    });
    return pois;
  }
  const worldLayout = generateWorldLayout();
  function buildTerrainFeatures() {
    const biomeSalt = BIOME_IDS.indexOf(realm.biome) * 19000;
    const count = realm.biome === "shore" ? 13 : realm.biome === "mountains" ? 11 : 9;
    const features = [];
    for (let index = 0; index < count; index += 1) {
      features.push({
        x: (seeded(biomeSalt + index * 11 + 1) - .5) * 1120,
        z: (seeded(biomeSalt + index * 11 + 2) - .5) * 1120,
        radius: 58 + seeded(biomeSalt + index * 11 + 3) * 112,
        height: 22 + seeded(biomeSalt + index * 11 + 4) * 68,
        phase: seeded(biomeSalt + index * 11 + 5) * Math.PI * 2
      });
    }
    return features;
  }
  const terrainFeatures = buildTerrainFeatures();
  worldLayout.pois = generatePoiLayout();
  const foundationZones = [
    { id: "title-vantage", x: TITLE_VANTAGE.x, z: TITLE_VANTAGE.z, inner: 14, outer: 28, lift: 0 },
    { id: "start", x: START.x, z: START.z, inner: 18, outer: 42, lift: .2 },
    { id: "keep", x: RUINS.x, z: RUINS.z - 24, inner: 42, outer: 70, lift: 0 },
    { id: "rune-hollow", x: RUNE_HOLLOW.x, z: RUNE_HOLLOW.z, inner: 10, outer: 24, lift: 0 }
  ].concat(worldLayout.forts.map((fort, index) => ({ id: "fort-" + index, x: fort[0], z: fort[1], inner: 30, outer: 58, lift: .15 })))
    .concat(worldLayout.routes.map((route, index) => ({ id: "route-" + index, x: route[0], z: route[1], inner: 16, outer: 34, lift: .25 })))
    .concat(worldLayout.pois.map((poi, index) => ({ id: "poi-" + index, x: poi.x, z: poi.z, inner: 14, outer: 30, lift: .18 })));
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
        defineSkill("realmwalker", "REALMWALKER", "New realms begin with run XP and a route reveal.", { requiresAll: ["mountaineer"], requiresRanks: { runecraft: 3 }, requiredLevel: 38, cost: 3 })
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
      copy: "Adapt to the dangers of this realm.", nodes: [
        defineSkill("run_vigor", "BORROWED VIGOR", "+15 maximum health per rank this run.", { scope: "run", maxRank: 3 }),
        defineSkill("run_endurance", "DEEP RESERVE", "+12 maximum stamina per rank this run.", { scope: "run", maxRank: 3, requiresRanks: { run_vigor: 2 } }),
        defineSkill("run_guard", "REALM GUARD", "Take 5% less damage per rank this run.", { scope: "run", maxRank: 2, requiresAny: ["run_vigor", "run_endurance"], cost: 2 }),
        defineSkill("run_rebirth", "PHOENIX OATH", "Second Wind refreshes at the next wave.", { scope: "run", requiresRanks: { run_guard: 2 }, cost: 3 })
      ]
    },
    {
      id: "run_hunt", title: "RUN: HUNT", kicker: "TEMPORARY CONSTELLATION", rune: "+", scope: "run",
      copy: "Learn the realm, then turn it against its guardians.", nodes: [
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
  function maxHealth() { return 100 + (player.level - 1) * 4 + skillRank("vitality") * 12 + skillRank("bastion") * 10 + skillRank("run_vigor") * 15; }
  function maxStamina() { return 100 + (player.level - 1) * 2 + skillRank("endurance") * 10 + skillRank("run_endurance") * 12; }
  function weaponDamageMultiplier(id) {
    const focus = id === "blade" ? skillRank("blade_focus") : id === "bow" ? skillRank("marksman") : id === "axe" ? skillRank("axe_focus") : skillRank("staff_focus");
    const arsenal = hasSkill("arsenal_master") ? WEAPON_IDS.reduce((sum, weaponId) => sum + masteryFor(weaponId).level - 1, 0) * .006 : 0;
    const combo = elapsed < player.comboExpires ? Math.min(player.comboHits, 5) * skillRank("battle_focus") * .012 : 0;
    const rampage = player.rampageTime > 0 && hasSkill("run_rampage") ? .16 : 0;
    const bloodPact = id === "axe" && hasSkill("blood_pact") && player.health < maxHealth() * .4 ? .28 : 0;
    return 1 + (masteryFor(id).level - 1) * .055 + skillRank("edge") * .06 + focus * .07 + skillRank("run_damage") * .06 + skillRank("run_slayer") * .05 + arsenal + combo + rampage + bloodPact;
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
      if (saveVersion > 5) {
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
        version: 5,
        level: player.level, xp: player.xp, skillPoints: player.skillPoints,
        prestige: player.prestige, realmDepth: player.realmDepth,
        activeWeapon: player.activeWeapon, mastery: player.mastery,
        weaponLevel: activeMastery.level, weaponXp: activeMastery.xp, skills: player.skills
      }));
    } catch (error) {
      console.warn("Progression save could not be written", error);
    }
  }

  let runSaveTimer = 0;
  let activeRunId = pendingRunState && pendingRunState.runId ? pendingRunState.runId : "run-" + realm.seed + "-" + Date.now().toString(36);

  function serializeActiveRun() {
    if (!player.root) return null;
    return {
      version: 1, status: "active", layoutVersion: WORLD_LAYOUT_VERSION, runId: activeRunId,
      savedAt: Date.now(), realm: { biome: realm.biome, seed: realm.seed, depth: player.realmDepth },
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
    strongholds.forEach((stronghold) => { stronghold.cleared = clearedIds.indexOf(stronghold.id) !== -1; });
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
    const terrainY = terrainHeight(x, z);
    const savedY = Number(runPlayer.y);
    const restoredY = Number.isFinite(savedY) ? Math.max(terrainY, Math.min(savedY, terrainY + 90)) : terrainY;
    if (terrainY <= biome.waterLevel + .3 || hitsCollider(x, z, .8, restoredY, restoredY + 2.15)) player.root.position.copy(player.lastSafePosition);
    else player.root.position.set(x, restoredY, z);
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
    const savedRngState = Number(saved.world.rngState) || (saved.director ? Number(saved.director.rngState) : 0);
    encounterRng.state = savedRngState ? savedRngState >>> 0 : ((Number(realm.seed) || 1) ^ 0x6d2b79f5) >>> 0;
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
    ui.skillsButton.classList.toggle("no-points", player.skillPoints + player.runSkillPoints < 1);
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
    if (!isCoarse && !testMode) requestPointer();
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
    const paths = [
      "assets/textures/storm-sky-panorama.jpg",
      "assets/textures/ashen-ground.jpg",
      "assets/textures/ancient-stone.jpg",
      "assets/textures/alpine-cliff.jpg",
      "assets/textures/tundra-grass-v1.jpg",
      "assets/textures/biomes/" + biome.textureId + "-color.jpg",
      "assets/textures/biomes/" + biome.textureId + "-normal.jpg",
      "assets/textures/biomes/" + biome.textureId + "-roughness.jpg"
    ];
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
    if (loaded[5].status === "fulfilled") visualAssets.biomeGround = configureTexture(loaded[5].value, 64, 64);
    if (loaded[6].status === "fulfilled") visualAssets.biomeNormal = configureDataTexture(loaded[6].value, 64, 64);
    if (loaded[7].status === "fulfilled") visualAssets.biomeRoughness = configureDataTexture(loaded[7].value, 64, 64);
    loaded.forEach((result, index) => {
      if (result.status === "rejected") console.warn("Texture failed to load:", paths[index], result.reason);
    });
    stoneMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(biome.cliff).lerp(new THREE.Color(0xc1c5c5), .35), map: visualAssets.stone || null, bumpMap: visualAssets.stone || null,
      bumpScale: .32, roughness: .91, metalness: .025, envMapIntensity: .34
    });
    darkStoneMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(biome.cliff).multiplyScalar(.72), map: visualAssets.stone || null, bumpMap: visualAssets.stone || null,
      bumpScale: .4, roughness: .96, metalness: .01, envMapIntensity: .22
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
      warden: "assets/models/quaternius-rpg-character/warden.gltf",
      biomeLight: "assets/models/quaternius-monsters/" + worldProfile.lightEnemy[0] + ".gltf",
      biomeHeavy: "assets/models/quaternius-monsters/" + worldProfile.heavyEnemy[0] + ".gltf"
    };
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
    if (realm.biome === "moon") {
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
    }
    const loader = new THREE.GLTFLoader();
    const entries = Object.entries(modelPaths);
    const loaded = await Promise.allSettled(entries.map((entry) => loader.loadAsync(entry[1])));
    loaded.forEach((result, index) => {
      const id = entries[index][0];
      if (result.status === "fulfilled") visualAssets.models[id] = result.value;
      else console.warn("3D model failed to load:", entries[index][1], result.reason);
    });
  }

  async function boot() {
    try {
      updateLoading(8, "Opening the northern sky...");
      if (ui.realmLabel) ui.realmLabel.textContent = biome.name + " · BIOME " + (REALM_LADDER.indexOf(realm.biome) + 1) + " OF " + REALM_LADDER.length + " · SEED " + realm.seed;
      if (ui.biomeTag) ui.biomeTag.textContent = biome.name + " · REALM " + (player.realmDepth + 1);
      loadProgression();
      buildSkillTree();
      await delay(35);
      initRenderer();
      updateLoading(17, "Weaving storm and stone...");
      await Promise.all([loadVisualAssets(), loadModelAssets()]);
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
      createVerticalRoutes();
      createExperienceRunes();
      createSettlements();
      createChests();
      createBiomeProps();
      createAtmosphere();
      updateLoading(73, "Arming the Warden...");
      await delay(35);
      createPlayer();
      player.root.position.set(TITLE_VANTAGE.x, terrainHeight(TITLE_VANTAGE.x, TITLE_VANTAGE.z), TITLE_VANTAGE.z);
      player.lastSafePosition.copy(player.root.position);
      resetActors();
      createLandmarks();
      updateProgressionUI();
      updateLoading(94, "Waking the dragon flight...");
      resize();
      updateCamera(1, true);
      await delay(120);
      state = "title";
      game.dataset.state = state;
      if (pendingRunState && ui.enter) ui.enter.querySelector("span").textContent = "CONTINUE SAVED RUN";
      ui.loading.classList.remove("active");
      ui.title.classList.add("active");
      ui.enter.focus({ preventScroll: true });
      updateLoading(100, biome.name + " ready");
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

  function createBiomeSkyTexture() {
    const surface = document.createElement("canvas");
    surface.width = 1024;
    surface.height = 512;
    const context = surface.getContext("2d");
    if (!context) throw new Error("2d canvas unavailable for biome sky");
    const zenith = new THREE.Color(biome.skyZenith || biome.sky);
    const horizon = new THREE.Color(biome.skyHorizon || biome.sky);
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
    const glow = new THREE.Color(biome.skyGlow || biome.sun);
    const glowRgb = Math.round(glow.r * 255) + "," + Math.round(glow.g * 255) + "," + Math.round(glow.b * 255);
    const glowGradient = context.createRadialGradient(544, 219, 12, 544, 219, 320);
    glowGradient.addColorStop(0, "rgba(" + glowRgb + ",.72)");
    glowGradient.addColorStop(.28, "rgba(" + glowRgb + ",.26)");
    glowGradient.addColorStop(1, "rgba(" + glowRgb + ",0)");
    context.fillStyle = glowGradient;
    context.fillRect(0, 0, 1024, 512);
    const texture = new THREE.CanvasTexture(surface);
    texture.encoding = THREE.sRGBEncoding;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function createSkyAndLights() {
    const skyGeometry = new THREE.SphereGeometry(880, isCoarse ? 32 : 48, isCoarse ? 18 : 28);
    let skyTexture = null;
    try {
      skyTexture = createBiomeSkyTexture();
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
    halo.position.set(760, 180, -150);
    halo.scale.setScalar(realm.biome === "moon" ? 105 : 170);
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

  function rawTerrainHeight(x, z) {
    const seedX = (realm.seed % 1009) * .37;
    const seedZ = (Math.floor(realm.seed / 1009) % 1009) * .41;
    const waveA = Math.sin((x + seedX) * .018) * 2.8 + Math.cos((z - seedZ) * .015) * 2.4;
    const waveB = Math.sin((x + z + seedX) * .033) * 1.25 + Math.cos((x - z - seedZ) * .041) * .8;
    let heightValue = biome.base;

    if (worldProfile.geometry === "glacial") {
      heightValue += waveA * 1.15 + waveB * .72;
      heightValue += Math.pow(Math.abs(Math.sin((x + seedX) * .0075 + Math.cos(z * .004) * 1.8)), 2.4) * 12;
      heightValue -= Math.exp(-Math.pow(x - Math.sin(z * .006) * 34, 2) / 2200) * 7.5;
      terrainFeatures.forEach((feature) => {
        const distanceSquared = Math.pow(x - feature.x, 2) + Math.pow(z - feature.z, 2);
        heightValue += Math.exp(-distanceSquared / Math.pow(feature.radius, 2)) * feature.height * .58;
      });
    } else if (worldProfile.geometry === "karst") {
      heightValue += waveA * .82 + waveB * .58;
      terrainFeatures.forEach((feature) => {
        const distance = Math.hypot(x - feature.x, z - feature.z) / feature.radius;
        const tower = Math.pow(Math.max(0, 1 - distance), 2.35);
        heightValue += tower * feature.height * .78;
      });
      const riverCenter = Math.sin((z - seedZ) * .0105) * 42 + Math.sin(z * .0032) * 18;
      heightValue -= Math.exp(-Math.pow(x - riverCenter, 2) / 520) * 9.5;
    } else if (worldProfile.geometry === "dunes") {
      heightValue += Math.sin((x + seedX) * .041 + Math.sin(z * .012)) * 3.7;
      heightValue += Math.sin((x + z - seedZ) * .022) * 2.2 + waveB * .38;
      terrainFeatures.forEach((feature, index) => {
        if (index % 3 !== 0) return;
        const distance = Math.hypot(x - feature.x, z - feature.z) / feature.radius;
        const mesa = 1 - smoothstep(.48, 1, distance);
        heightValue += mesa * feature.height * .42;
      });
      const canyon = x * .72 + z * .34 - Math.sin(z * .007 + seedX) * 48;
      heightValue -= Math.exp(-(canyon * canyon) / 780) * 12;
    } else if (worldProfile.geometry === "archipelago") {
      heightValue = biome.waterLevel - 2.2 + waveA * .72 + waveB * .42;
      terrainFeatures.forEach((feature) => {
        const distanceSquared = Math.pow(x - feature.x, 2) + Math.pow(z - feature.z, 2);
        heightValue += Math.exp(-distanceSquared / Math.pow(feature.radius * 1.18, 2)) * (feature.height * .34 + 7);
      });
      const causeway = x - roadCenterAt(z);
      heightValue += Math.exp(-(causeway * causeway) / 820) * 7.8;
    } else if (worldProfile.geometry === "alpine") {
      const ridgeA = Math.pow(Math.abs(Math.sin((x + seedX) * .0085 + z * .003)), 2.5);
      const ridgeB = Math.pow(Math.abs(Math.cos((z - seedZ) * .0072 - x * .0024)), 3.1);
      heightValue += waveA * 1.25 + waveB * .8 + ridgeA * 22 + ridgeB * 15;
      terrainFeatures.forEach((feature) => {
        const distanceSquared = Math.pow(x - feature.x, 2) + Math.pow(z - feature.z, 2);
        heightValue += Math.exp(-distanceSquared / Math.pow(feature.radius * .82, 2)) * feature.height * .72;
      });
      heightValue -= Math.exp(-Math.pow(x - roadCenterAt(z), 2) / 620) * 13;
    } else {
      heightValue += waveA * .72 + waveB * .55;
      terrainFeatures.forEach((feature) => {
        const distance = Math.hypot(x - feature.x, z - feature.z);
        const core = Math.exp(-(distance * distance) / Math.pow(feature.radius * .62, 2));
        const rim = Math.exp(-Math.pow(distance - feature.radius * .78, 2) / Math.pow(feature.radius * .17, 2));
        heightValue += rim * feature.height * .25 - core * feature.height * .22;
      });
      heightValue += Math.pow(Math.abs(Math.sin((x - z + seedX) * .011)), 3.2) * 8.5;
    }

    const radius = Math.hypot(x, z);
    const edge = Math.max(0, (radius - 560) / 300);
    const edgeStrength = worldProfile.geometry === "archipelago" ? 24 : worldProfile.geometry === "alpine" ? 72 : 46;
    heightValue += edge * edge * edgeStrength;
    const roadDistance = x - roadCenterAt(z);
    heightValue -= Math.exp(-(roadDistance * roadDistance) / 760) * (worldProfile.geometry === "alpine" ? 5.5 : 2.6);
    heightValue -= Math.exp(-(x * x + Math.pow(z - RUINS.z, 2)) / 2400) * 2.2;
    return heightValue;
  }

  function foundationTarget(zone) {
    if (!foundationTargets.has(zone.id)) foundationTargets.set(zone.id, Math.max(rawTerrainHeight(zone.x, zone.z) + zone.lift, biome.waterLevel + 2.4));
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

  function createTerrain() {
    const segments = isCoarse ? 130 : 240;
    const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const colors = [];
    const textured = Boolean(visualAssets.biomeGround || visualAssets.ground);
    const low = new THREE.Color(biome.ground).multiplyScalar(textured ? 1.15 : .72);
    const rock = new THREE.Color(biome.cliff);
    const high = new THREE.Color(biome.frost).lerp(new THREE.Color(biome.cliff), .5);
    const snow = new THREE.Color(biome.frost);
    const color = new THREE.Color();
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const y = terrainHeight(x, z);
      position.setY(i, y);
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
      vertexColors: !visualAssets.cliff, map: groundDetail,
      normalMap: visualAssets.biomeNormal || null, normalScale: new THREE.Vector2(.54, .54),
      roughnessMap: visualAssets.biomeRoughness || null, roughness: .94, metalness: .018, envMapIntensity: .24
    });
    if (visualAssets.cliff) {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.cliffMap = { value: visualAssets.cliff };
        shader.uniforms.grassMap = { value: visualAssets.biomeGround || visualAssets.grass || groundDetail };
        shader.uniforms.biomeGroundTint = { value: new THREE.Color(biome.ground) };
        shader.uniforms.biomeCliffTint = { value: new THREE.Color(biome.cliff) };
        shader.uniforms.biomeGrassTint = { value: new THREE.Color(biome.grass) };
        shader.uniforms.biomeFrostTint = { value: new THREE.Color(biome.frost) };
        shader.uniforms.biomeGrassStrength = { value: biome.grassStrength };
        shader.uniforms.biomeFrostStart = { value: biome.frostStart };
        shader.vertexShader = "varying vec3 vTerrainWorldPosition; varying vec3 vTerrainWorldNormal;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n vTerrainWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;\n vTerrainWorldNormal=normalize(mat3(modelMatrix)*objectNormal);"
        );
        shader.fragmentShader = "uniform sampler2D cliffMap; uniform sampler2D grassMap; uniform vec3 biomeGroundTint; uniform vec3 biomeCliffTint; uniform vec3 biomeGrassTint; uniform vec3 biomeFrostTint; uniform float biomeGrassStrength; uniform float biomeFrostStart; varying vec3 vTerrainWorldPosition; varying vec3 vTerrainWorldNormal;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#ifdef USE_MAP
            vec3 terrainNormal=abs(normalize(vTerrainWorldNormal));
            terrainNormal=pow(terrainNormal,vec3(5.0));
            terrainNormal/=max(terrainNormal.x+terrainNormal.y+terrainNormal.z,0.0001);
            vec3 groundSample=pow(texture2D(map,vTerrainWorldPosition.xz*0.058).rgb,vec3(1.04))*mix(vec3(0.92),biomeGroundTint*1.65,0.55);
            vec3 cliffX=pow(texture2D(cliffMap,vTerrainWorldPosition.zy*0.047).rgb,vec3(1.06))*mix(vec3(0.82),biomeCliffTint*1.55,0.38);
            vec3 cliffY=pow(texture2D(cliffMap,vTerrainWorldPosition.xz*0.047).rgb,vec3(1.06))*mix(vec3(0.82),biomeCliffTint*1.55,0.38);
            vec3 cliffZ=pow(texture2D(cliffMap,vTerrainWorldPosition.xy*0.047).rgb,vec3(1.06))*mix(vec3(0.82),biomeCliffTint*1.55,0.38);
            vec3 cliffSample=cliffX*terrainNormal.x+cliffY*terrainNormal.y+cliffZ*terrainNormal.z;
            float slope=smoothstep(0.15,0.62,1.0-abs(normalize(vTerrainWorldNormal).y));
            float frost=smoothstep(biomeFrostStart,biomeFrostStart+55.0,vTerrainWorldPosition.y)*(1.0-smoothstep(0.34,0.82,slope));
            vec3 terrainColor=mix(groundSample,cliffSample,slope);
            vec3 grassSample=pow(texture2D(grassMap,vTerrainWorldPosition.xz*0.084).rgb,vec3(1.06))*mix(vec3(0.9),biomeGrassTint*1.75,0.28);
            float grassPatch=0.5+0.5*sin(vTerrainWorldPosition.x*0.031)*sin(vTerrainWorldPosition.z*0.027);
            float grassMask=(1.0-smoothstep(18.0,52.0,vTerrainWorldPosition.y))*(1.0-smoothstep(0.12,0.48,slope))*smoothstep(0.18,0.72,grassPatch);
            terrainColor=mix(terrainColor,grassSample,grassMask*biomeGrassStrength*0.92);
            terrainColor=mix(terrainColor,biomeFrostTint,frost*0.78);
            diffuseColor*=vec4(terrainColor*0.96,1.0);
          #endif`
        );
      };
      material.customProgramCacheKey = () => "ashenhold-terrain-blend-v3-" + realm.biome;
    }
    terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    scene.add(terrain);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE * 1.35, WORLD_SIZE * 1.35),
      new THREE.MeshPhongMaterial({ color: biome.water, transparent: true, opacity: biome.waterOpacity, shininess: 92, specular: new THREE.Color(biome.water).lerp(new THREE.Color(0xb6d9e4), .58) })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = biome.waterLevel;
    scene.add(water);
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
      material.color.multiply(importedWoodTint);
      const map = cloneTiledTexture(visualAssets.stone, repeatX, repeatY);
      material.map = map;
      material.bumpMap = map;
      material.bumpScale = .34;
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
    const ruins = new THREE.Group();
    ruins.name = "Ashenhold Keep";
    scene.add(ruins);
    const z = RUINS.z;
    addStoneBox(ruins, -24, z - 25, 5, 11, 52, 0, true);
    addStoneBox(ruins, 24, z - 25, 5, 11, 52, 0, true);
    addStoneBox(ruins, -16, z - 51, 19, 9, 5, 0, true);
    addStoneBox(ruins, 16, z - 51, 19, 13, 5, 0, true);
    addStoneBox(ruins, -17, z + 2, 15, 8, 4, 0, true);
    addStoneBox(ruins, 17, z + 2, 15, 6, 4, 0, true);

    const towerGeometry = new THREE.CylinderGeometry(7.2, 8, 17, 9);
    [[-25, z - 51], [25, z - 51], [-25, z + 2], [25, z + 2]].forEach((point, index) => {
      const tower = new THREE.Mesh(towerGeometry, index % 2 ? darkStoneMaterial : stoneMaterial);
      tower.position.set(point[0], terrainHeight(point[0], point[1]) + 8.5, point[1]);
      tower.rotation.y = index * .38;
      tower.castShadow = !isCoarse;
      tower.receiveShadow = true;
      ruins.add(tower);
      colliders.push({ x: point[0], z: point[1], hx: 6.2, hz: 6.2 });
      for (let b = 0; b < 6; b += 1) {
        if ((b + index) % 3 === 0) continue;
        const angle = b / 6 * Math.PI * 2;
        const battlement = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.5, 2.7), stoneMaterial);
        battlement.position.set(point[0] + Math.cos(angle) * 6.2, tower.position.y + 9, point[1] + Math.sin(angle) * 6.2);
        battlement.castShadow = !isCoarse;
        ruins.add(battlement);
      }
    });

    [-4.8, 4.8].forEach((x) => addStoneBox(ruins, x, z + 7, 3.2, 11, 3.5, 0, true));
    addStoneBox(ruins, 0, z + 7, 13, 2.8, 3.5, 0, false).position.y += 8.2;

    const obelisk = new THREE.Mesh(new THREE.ConeGeometry(2.3, 12, 4), darkStoneMaterial);
    obelisk.position.set(0, terrainHeight(0, z - 26) + 6, z - 26);
    obelisk.rotation.y = Math.PI / 4;
    obelisk.castShadow = !isCoarse;
    ruins.add(obelisk);

    createFire(-10, z - 15, true);
    createFire(12, z - 34, false);
    createFire(0, z + 15, false);
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

    const treeDensity = realm.biome === "moon" ? 0 : realm.biome === "desert" ? .22 : realm.biome === "jungle" ? 1.7 : realm.biome === "shore" ? .72 : 1;
    const treeCount = Math.round((isCoarse ? 20 : 38) * treeDensity);
    for (let i = 0; i < treeCount; i += 1) {
      let x = (seeded(i * 17 + 8) - .5) * 900;
      let z = (seeded(i * 23 + 2) - .5) * 900;
      if (Math.abs(x) < 23 && z > -180 && z < 230) x += x < 0 ? -35 : 35;
      createDeadTree(x, z, .75 + seeded(i * 31) * .8, seeded(i * 19) * Math.PI * 2);
    }

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

  function importedModel(id, x, z, scale, rotation, yOffset, collider, baseY) {
    const asset = visualAssets.models && visualAssets.models[id];
    if (!asset) return null;
    const root = asset.scene.clone(true);
    root.name = "Imported " + id;
    root.scale.setScalar(scale || 1);
    root.rotation.y = rotation || 0;
    const groundY = Number.isFinite(baseY) ? baseY : terrainHeight(x, z);
    root.position.set(x, groundY + (yOffset || 0), z);
    const wooden = id === "catapult" || id === "siegeTower";
    const ironwork = id === "gate";
    const palette = id === "tree" ? worldFoliageMaterial : wooden ? worldWoodMaterial : ironwork ? worldIronMaterial : darkStoneMaterial;
    let meshIndex = 0;
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = !isCoarse;
      object.receiveShadow = true;
      object.material = palette.clone();
      if (object.material.color) {
        if (palette === darkStoneMaterial) object.material.color.multiply(importedStoneTint);
        else if (palette === worldWoodMaterial) object.material.color.multiply(importedWoodTint);
        object.material.color.multiplyScalar(.88 + (meshIndex % 4) * .035);
      }
      meshIndex += 1;
    });
    scene.add(root);
    if (collider) addCollider(
      x, z, collider.hx, collider.hz, rotation || 0,
      groundY + (collider.minY || 0), groundY + (collider.maxY || collider.height || 12)
    );
    return root;
  }

  // --- POI pack placement (keeps original atlas materials; importedModel would override them) ---
  const packModelMetrics = {};
  function packModelSize(key) {
    if (!packModelMetrics[key]) {
      const asset = visualAssets.models && visualAssets.models[key];
      if (!asset) return null;
      const box = new THREE.Box3().setFromObject(asset.scene);
      packModelMetrics[key] = {
        sx: Math.max(.05, box.max.x - box.min.x),
        sy: Math.max(.05, box.max.y - box.min.y),
        sz: Math.max(.05, box.max.z - box.min.z),
        cx: (box.min.x + box.max.x) / 2,
        cz: (box.min.z + box.max.z) / 2
      };
    }
    return packModelMetrics[key];
  }

  function placePackModel(key, x, z, scale, rotation, opts) {
    const asset = visualAssets.models && visualAssets.models[key];
    if (!asset) return null;
    const options = opts || {};
    const root = asset.scene.clone(true);
    root.name = "Pack " + key;
    root.scale.setScalar(scale || 1);
    root.rotation.y = rotation || 0;
    const baseY = Number.isFinite(options.baseY) ? options.baseY : terrainHeight(x, z);
    root.position.set(x, baseY + (options.yOffset || 0), z);
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = !isCoarse;
      object.receiveShadow = true;
    });
    scene.add(root);
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
    const gap = clamp(doorGap || 1.8, 0, Math.max(0, halfX * 2 - 1.2));
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

  // Align a model's long horizontal axis (measured from its bbox) tangent to a placement angle.
  function poiTangentRotation(angle, size) {
    return -angle - (size.sx >= size.sz ? Math.PI / 2 : 0);
  }

  function createImportedFort(x, z, rotation, scale, name) {
    const fort = new THREE.Group();
    fort.name = name;
    scene.add(fort);
    const spacing = 17 * scale / 4;
    const towerScale = scale;
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
      place("tower", offset[0], offset[1], towerScale, index * Math.PI / 2, 0, { hx: 3.8 * scale / 4, hz: 3.8 * scale / 4 });
      place("towerTop", offset[0], offset[1], towerScale, index * Math.PI / 2, 7.75 * scale / 4);
    });
    [-.5,.5].forEach((side) => {
      place("wall", side * spacing, -spacing, scale, 0, 0, { hx: 4.2 * scale / 4, hz: 1.3 * scale / 4 });
      place("wall", side * spacing, spacing, scale, 0, 0, { hx: 4.2 * scale / 4, hz: 1.3 * scale / 4 });
      place("wall", -spacing, side * spacing, scale, Math.PI / 2, 0, { hx: 1.3 * scale / 4, hz: 4.2 * scale / 4 });
      place("wall", spacing, side * spacing, scale, Math.PI / 2, 0, { hx: 1.3 * scale / 4, hz: 4.2 * scale / 4 });
    });
    place("gate", 0, spacing, scale, 0, 0, null);
    place("doorway", 0, -spacing, scale, 0, 0, null);
    place("stairs", 0, -spacing * .55, scale * .9, Math.PI, 0, null);
    place("catapult", spacing * .25, -spacing * .18, scale * .78, .55, 0, null);
    place("rock", -spacing * .3, spacing * .15, scale * .72, 0, 0, null);
    const fireA = worldPoint(-5, 2);
    const fireB = worldPoint(6, -5);
    createFire(fireA.x, fireA.z, !isCoarse);
    createFire(fireB.x, fireB.z, false);
  }

  function createImportedWorld() {
    if (!visualAssets.models || !visualAssets.models.tower) return;
    worldLayout.forts.forEach((fort, index) => {
      createImportedFort(fort[0], fort[1], fort[2], fort[3], fort[4]);
      registerStronghold("fort-" + index, fort[4], "fort", fort[0], fort[1]);
    });
    importedModel("siegeTower", 34, -178, 4.1, -.45, 0, { hx: 4.5, hz: 4.5 });
    importedModel("bridgePillar", -356, 55, 5.2, Math.PI / 2, 0, { hx: 5, hz: 8 });
    importedModel("tree", -330, 242, 5.5, .2, 0, null);
    importedModel("tree", 295, -310, 5.2, -1.1, 0, null);
    importedModel("rock", 410, -165, 6.4, .7, 0, null);
    for (let i = 0; i < 4; i += 1) {
      const angle = seeded(7200 + i * 5) * Math.PI * 2;
      const radius = 285 + seeded(7201 + i * 5) * 245;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const rotation = seeded(7202 + i * 5) * Math.PI * 2;
      const scale = 3.45 + seeded(7203 + i * 5) * .75;
      importedModel("tower", x, z, scale, rotation, 0, { hx: 3.6, hz: 3.6 });
      importedModel("towerTop", x, z, scale, rotation, 7.75 * scale / 4, null);
      importedModel("wall", x + Math.cos(rotation) * 7.5, z + Math.sin(rotation) * 7.5, scale, rotation + Math.PI / 2, 0, null);
    }
    const dressingCount = realm.biome === "jungle" ? 15 : realm.biome === "moon" ? 10 : realm.biome === "desert" ? 7 : 9;
    for (let i = 0; i < dressingCount; i += 1) {
      const x = (seeded(7600 + i * 9) - .5) * 930;
      const z = (seeded(7601 + i * 9) - .5) * 930;
      if (Math.abs(x) < 28 && z > -185 && z < 235) continue;
      const id = realm.biome === "jungle" ? "tree" : "rock";
      importedModel(id, x, z, 3.2 + seeded(7602 + i * 9) * 3.4, seeded(7603 + i * 9) * Math.PI * 2, 0, null);
    }
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
      if (routeIndex === 0) buildSpireRoute(route, routeIndex);
      else buildScaffoldRoute(route, routeIndex);
      verticalRouteReports.push(measureVerticalRoute(route[5]));
      const summit = platforms.filter((platform) => platform.routeId === route[5]).sort((a, b) => b.stepIndex - a.stepIndex)[0];
      registerStronghold("ascent-" + routeIndex, route[5], "ascent", summit ? summit.x : route[0], summit ? summit.z : route[1]);
    });
  }

  function createExperienceRunes() {
    const routeSummits = worldLayout.routes.map((route) => platforms.filter((platform) => platform.routeId === route[5]).sort((a, b) => b.stepIndex - a.stepIndex)[0]);
    const definitions = [
      { id: "hollow", name: "RUNE OF THE HOLLOW", x: RUNE_HOLLOW.x, z: RUNE_HOLLOW.z, xp: 80 },
      { id: "keep", name: "KEEPER'S RUNE", x: RUINS.x + 12, z: RUINS.z - 26, xp: 100 }
    ].concat(worldLayout.forts.map((fort, index) => ({
      id: "fort-" + index, name: fort[4] + " RUNE", x: fort[0] + Math.cos(fort[2]) * 9, z: fort[1] + Math.sin(fort[2]) * 9, xp: 90 + index * 20
    }))).concat(routeSummits.filter(Boolean).map((summit, index) => ({
      id: "route-" + index, name: worldLayout.routes[index][5] + " RUNE", x: summit.x - (index ? 1.5 : 2.4), z: summit.z, xp: 135 + index * 25
    })));
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
        id: definition.id, name: definition.name, xp: definition.xp, root, crystal, halo, marker,
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

  function addPoiChestSpot(poi, x, z, xp) {
    poiChestSpots.push({ idSuffix: poiChestSpots.length, name: poi.name + " CACHE", x, z, xp: Math.round(xp) });
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

  // Strongholds are world gen: every fort, settlement, ascent summit and the keep registers once,
  // with seeded garrison spots ringed around its center (extra light/golem slots cover level scaling).
  function registerStronghold(id, name, kind, x, z) {
    const base = STRONGHOLD_GARRISONS[kind] || STRONGHOLD_GARRISONS.hamlet;
    const stronghold = { id, name, kind, x, z, members: [], cleared: false, spots: [], baseCount: base.light + base.heavy + base.warg + base.golem };
    const salt = worldLayout.salt + 8100 + strongholds.length * 137;
    const golemSlots = base.golem + (kind === "fort" || kind === "keep" ? 1 : 0);
    const plan = [];
    for (let i = 0; i < base.heavy; i += 1) plan.push("biomeHeavy");
    for (let i = 0; i < base.warg; i += 1) plan.push("warg");
    for (let i = 0; i < golemSlots; i += 1) plan.push("golem");
    for (let i = 0; i < base.light + 4; i += 1) plan.push("biomeLight");
    const ring = STRONGHOLD_RINGS[kind] || STRONGHOLD_RINGS.hamlet;
    plan.forEach((type, index) => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const angle = seeded(salt + index * 7 + attempt * 37 + 1) * Math.PI * 2;
        const distance = ring[0] + seeded(salt + index * 7 + attempt * 37 + 2) * (ring[1] - ring[0]);
        const gx = x + Math.cos(angle) * distance;
        const gz = z + Math.sin(angle) * distance;
        const gy = terrainHeight(gx, gz);
        if (gy <= biome.waterLevel + .35) continue;
        if (Math.abs(terrainHeight(gx + 1.5, gz) - gy) + Math.abs(terrainHeight(gx, gz + 1.5) - gy) > .9) continue;
        if (hitsCollider(gx, gz, .9, gy, gy + 3.4)) continue;
        stronghold.spots.push({ type, x: gx, z: gz, roll: seeded(salt + index * 7 + attempt * 37 + 3) });
        break;
      }
    });
    strongholds.push(stronghold);
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
      const radius = 9 + seeded(salt + 11 + index * 3) * 5;
      const bx = poi.x + Math.cos(angle) * radius;
      const bz = poi.z + Math.sin(angle) * radius;
      const facing = Math.atan2(poi.x - bx, poi.z - bz);
      if (!placePackModel(key, bx, bz, POI_SCALES.medieval, facing, { baseY })) return;
      const size = packModelSize(key);
      addBuildingColliders(bx, bz, facing, size.sx * POI_SCALES.medieval / 2, size.sz * POI_SCALES.medieval / 2, baseY, size.sy * POI_SCALES.medieval, 1.8, size.cx * POI_SCALES.medieval, size.cz * POI_SCALES.medieval);
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
    const treeKey = { snowy: "treePineA", jungle: "treePalmBend", desert: "cactusTall", shore: "treePalm", mountains: "treePineB" }[realm.biome];
    if (treeKey && models[treeKey]) {
      const angle = seeded(salt + 26) * Math.PI * 2;
      placePackModel(treeKey, poi.x + Math.cos(angle) * 13.5, poi.z + Math.sin(angle) * 13.5, POI_SCALES.natureTree, seeded(salt + 27) * Math.PI * 2, {});
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
    let towerScale = POI_SCALES.medieval * 1.4;
    const footprint = Math.min(size.sx, size.sz) * towerScale;
    if (footprint < 4.6) towerScale *= 4.6 / Math.max(.5, footprint);
    placePackModel(towerKey, poi.x, poi.z, towerScale, facing, { baseY });
    const halfX = size.sx * towerScale / 2;
    const halfZ = size.sz * towerScale / 2;
    // Gameplay-critical door: 2.4 gap so the r.8 capsule clears the front quarters with margin.
    addBuildingColliders(poi.x, poi.z, facing, halfX, halfZ, baseY, size.sy * towerScale, 2.4, size.cx * towerScale, size.cz * towerScale);
    // Interior wood steps to an upper floor; plain platforms so surfaceHeightAt just works.
    // Full-width strips (threshold +.75, mid +1.5, deck +2.25) so an r.8 capsule can climb
    // without clipping the next tier's collider band; decks align with the rotated shell.
    const innerX = halfX - .7;
    const innerZ = halfZ - .7;
    const floorTop = baseY + 2.25;
    const strip = Math.min(1.2, innerZ - .6);
    const stepAt = (localX, localZ, width, depth, topY) => {
      const point = poiLocalToWorld(poi.x, poi.z, facing, localX, localZ);
      addPoiPlatform(point.x, point.z, width, depth, topY, facing);
    };
    stepAt(0, innerZ - strip / 2, innerX * 2, strip, baseY + .75);
    stepAt(0, innerZ - strip * 1.5, innerX * 2, strip, baseY + 1.5);
    stepAt(0, -strip, innerX * 2, innerZ * 2 - strip * 2, floorTop);
    const chestPoint = poiLocalToWorld(poi.x, poi.z, facing, 0, -strip);
    addPoiChestSpot(poi, chestPoint.x, chestPoint.z, 100 + Math.floor(seeded(salt + 8) * 41));
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
    addPoiChestSpot(poi, chestPoint.x, chestPoint.z, 90 + Math.floor(seeded(salt + 12) * 31));
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
    const cryptHalf = cryptSize.sz * POI_SCALES.crypt / 2;
    const cryptZ = -6.4;
    const altarZ = cryptZ + cryptHalf + 1.2;
    const chestZ = altarZ + 1.7;
    const rowStart = Math.max(-.6, chestZ + 1.3);
    const cryptPoint = poiLocalToWorld(poi.x, poi.z, poi.rotation, 0, cryptZ);
    placePackModel(cryptKey, cryptPoint.x, cryptPoint.z, POI_SCALES.crypt, poi.rotation, { baseY });
    addCollider(cryptPoint.x, cryptPoint.z, cryptSize.sx * POI_SCALES.crypt * .5, cryptSize.sz * POI_SCALES.crypt * .5, poi.rotation, baseY - 1, baseY + Math.min(cryptSize.sy * POI_SCALES.crypt, 6));
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
    addPoiChestSpot(poi, chestPoint.x, chestPoint.z, 90 + Math.floor(seeded(salt + 12) * 31));
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
    addPoiChestSpot(poi, chestPoint.x, chestPoint.z, 90 + Math.floor(seeded(salt + 16) * 21));
    debug.chests += 1;
  }

  function createSettlements() {
    poiChestSpots.length = 0;
    poiDebugInfo.length = 0;
    (worldLayout.pois || []).forEach((poi, poiIndex) => {
      const debug = { kind: poi.kind, name: poi.name, chests: 0, guards: 0, collidersAdded: 0 };
      const collidersBefore = colliders.length;
      if (poi.kind === "hamlet") buildHamlet(poi, poiIndex, debug);
      else if (poi.kind === "watchpost") buildWatchpost(poi, poiIndex, debug);
      else if (poi.kind === "camp") buildRaiderCamp(poi, poiIndex, debug);
      else if (poi.kind === "ruin") buildRuinCluster(poi, poiIndex, debug);
      else if (realm.biome === "moon") buildGraveyard(poi, poiIndex, debug);
      else buildShrine(poi, poiIndex, debug);
      debug.collidersAdded = colliders.length - collidersBefore;
      poiDebugInfo.push(debug);
      const stronghold = registerStronghold("poi-" + poiIndex, poi.name, poi.kind === "shrine" && realm.biome === "moon" ? "graveyard" : poi.kind, poi.x, poi.z);
      debug.guards = stronghold.baseCount;
    });
    registerStronghold("keep", "ASHENHOLD KEEP", "keep", RUINS.x, RUINS.z);
  }

  function createChests() {
    const routeSummits = worldLayout.routes.map((route) => platforms.filter((platform) => platform.routeId === route[5]).sort((a, b) => b.stepIndex - a.stepIndex)[0]);
    const definitions = worldLayout.forts.map((fort, index) => ({
      id: "chest-fort-" + index, name: fort[4] + " CHEST", xp: 70 + index * 20,
      x: fort[0] + Math.cos(fort[2]) * 4 - Math.sin(fort[2]) * 6,
      z: fort[1] + Math.sin(fort[2]) * 4 + Math.cos(fort[2]) * 6
    })).concat(routeSummits.filter(Boolean).map((summit, index) => ({
      id: "chest-route-" + index, name: worldLayout.routes[index][5] + " TROVE", xp: 130 + index * 30,
      x: summit.x + (index ? 1.5 : 2.4), z: summit.z
    }))).concat(poiChestSpots.map((spot, index) => ({
      id: "chest-poi-" + index, name: spot.name, xp: spot.xp, x: spot.x, z: spot.z
    })));
    const bandMaterial = new THREE.MeshStandardMaterial({ color: 0x2e3436, roughness: .58, metalness: .7, envMapIntensity: .35 });
    definitions.forEach((definition, index) => {
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
      const marker = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.22, 30), new THREE.MeshBasicMaterial({ color: 0xe8b45a, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = .04;
      root.add(base, lid, bandA, bandB, lock, marker);
      root.position.set(definition.x, surfaceHeightAt(definition.x, definition.z, 999), definition.z);
      root.traverse((object) => { if (object.isMesh) { object.castShadow = !isCoarse; object.receiveShadow = true; } });
      scene.add(root);
      chests.push({
        id: definition.id, name: definition.name, xp: definition.xp,
        root, lid, lockMaterial, marker, opened: false, openTime: 0, phase: index * 1.71
      });
    });
  }

  function resetChests() {
    chests.forEach((chest) => {
      chest.opened = false;
      chest.openTime = 0;
      chest.lid.rotation.x = 0;
      chest.lockMaterial.visible = true;
      chest.marker.material.opacity = .5;
    });
  }

  function nearestChest(maxDistance) {
    if (!player.root) return null;
    const maximum = maxDistance == null ? 11 : maxDistance;
    return chests
      .filter((chest) => !chest.opened && distance2D(player.root.position, chest.root.position) <= maximum)
      .sort((a, b) => distance2D(player.root.position, a.root.position) - distance2D(player.root.position, b.root.position))[0] || null;
  }

  function openChest(chest) {
    if (!chest || chest.opened || state !== "playing") return false;
    chest.opened = true;
    chest.openTime = .01;
    grantXp(chest.xp);
    grantRunXp(Math.round(chest.xp * .72), "RELIC CHEST");
    player.health = Math.min(maxHealth(), player.health + 25);
    player.shout = Math.min(100, player.shout + 20);
    createShockwave(chest.root.position.clone().add(new THREE.Vector3(0, .15, 0)), 9, .8, 0xe8b45a);
    audio.discover();
    spawnCombatText(chest.root.position, "+" + chest.xp + " XP", "xp");
    spawnCombatText(player.root.position, "+25", "heal");
    showProgressionBanner("RELIC CHEST OPENED", chest.name, "+" + chest.xp + " WARDEN XP");
    chest.marker.material.opacity = .12;
    chest.lockMaterial.visible = false;
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
    const wanted = Math.round((isCoarse ? 1800 : 9500) * (.18 + biome.grassStrength * .82));
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
    if (y < biome.waterLevel + .6) return null;
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

  function biomePropDefinitions() {
    const cone = new THREE.ConeGeometry(1, 1, 7);
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 7);
    const sphere = new THREE.SphereGeometry(1, 7, 6);
    const dodeca = new THREE.DodecahedronGeometry(1, 0);
    const octa = new THREE.OctahedronGeometry(1, 0);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const jitterTint = (shade, roll) => shade.setRGB(1, 1, 1).offsetHSL(0, (roll - .5) * .06, (roll - .5) * .14);
    if (realm.biome === "snowy") return [
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
    if (realm.biome === "jungle") return [
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
    if (realm.biome === "desert") return [
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
    if (realm.biome === "shore") {
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
    if (realm.biome === "mountains") return [
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

  function placePropSet(definition, setIndex) {
    const wanted = isCoarse ? Math.round(definition.count / 2) : definition.count;
    const mesh = new THREE.InstancedMesh(definition.geometry, definition.material, wanted);
    const dummy = new THREE.Object3D();
    const shade = new THREE.Color();
    const salt = 97000 + BIOME_IDS.indexOf(realm.biome) * 4000 + setIndex * 500;
    let placed = 0;
    let attempt = 0;
    while (placed < wanted && attempt < wanted * 9) {
      const x = (seeded(salt + attempt * 3 + 1) - .5) * 1050;
      const z = (seeded(salt + attempt * 3 + 2) - .5) * 1050;
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
    return placed;
  }

  function createBiomeProps() {
    const definitions = biomePropDefinitions();
    const byKind = {};
    let total = 0;
    definitions.forEach((definition, index) => {
      const placed = placePropSet(definition, index);
      byKind[definition.kind] = placed;
      total += placed;
    });
    biomePropsReport = { kind: definitions[0].kind, total, byKind };
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
      modelRoot.name = "Quaternius Warden";
      modelRoot.scale.setScalar(1.02);
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
      lowerArmR: bone("LowerArm.R")
    } : null;
    player.sprintPoseSnapshot = null;
    player.sprintPoseApplied = false;
    player.sprintPoseWeight = 0;
    setPlayerModelAction("idle", true);
    equipWeapon(player.activeWeapon, true);
  }

  function setPlayerModelAction(nextState, force) {
    if (!player.modelMixer || !player.modelActions[nextState]) return;
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

  function createDragon(name, x, z, boss) {
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
    if (!enemy || !enemy.mixer || !enemy.actions || !enemy.actions[nextState]) return;
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

  function createGroundEnemy(type, x, z, difficulty) {
    const root = new THREE.Group();
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
    if ((type === "biomeLight" || type === "biomeHeavy") && visualAssets.models && visualAssets.models[type]) {
      const source = visualAssets.models[type];
      const profile = type === "biomeHeavy" ? worldProfile.heavyEnemy : worldProfile.lightEnemy;
      const model = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(source.scene) : source.scene.clone(true);
      model.name = profile[1];
      model.scale.setScalar(profile[3]);
      model.rotation.y = Math.PI;
      const tint = new THREE.Color(profile[4]);
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
      const clips = {
        idle: idleClip, run: findClip(/^Run$/i) || findClip(/^Walk$/i) || idleClip,
        attack: findClip(/Punch|Weapon/i) || idleClip, hit: findClip(/HitReact/i) || idleClip,
        death: findClip(/^Death$/i) || idleClip
      };
      Object.keys(clips).forEach((id) => { if (clips[id]) actions[id] = mixer.clipAction(clips[id]); });
      stats = type === "biomeHeavy"
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
      const runClip = source.animations.find((clip) => /run/i.test(clip.name)) || source.animations[source.animations.length - 1];
      if (runClip) mixer.clipAction(runClip).play();
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
      name: stats.name, rank: stats.rank, kind: type, root, modelRoot, mixer, parts,
      health: Math.round(stats.health * healthScale), maxHealth: Math.round(stats.health * healthScale),
      damage: Math.max(1, Math.round(stats.damage * damageScale)), speed: stats.speed * (1 + Math.min(.18, threat * .012)),
      attackRange: stats.range, attackInterval: Math.max(.72, stats.cooldown - tier * .025), attackCooldown: .4 + encounterRandom(),
      attackTimer: 0, attackDelivered: false, walkCycle: encounterRandom() * 10, hitRadius: stats.hitRadius,
      xpReward: Math.round(stats.xp * (1 + tier * .08)), healthReward: stats.heal,
      boss: false, elite: type === "golem" || type === "biomeHeavy", dead: false, deathTime: 0, engaged: true,
      tier, threat, strongholdId: null,
      actions, animationState, lastDamageSource: null, lastWeaponId: null, hitStun: 0, phase: encounterRandom() * Math.PI * 2,
      impulse: new THREE.Vector3(), telegraph: null, bleedStacks: 0, bleedTime: 0, slowTime: 0
    };
    setEnemyAction(enemy, "idle", true);
    root.traverse((object) => { if (object.isMesh || object.isSkinnedMesh) object.userData.dragon = enemy; });
    groundEnemies.push(enemy);
    return enemy;
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
    if (!ui.waveHud) return;
    const total = strongholds.length;
    const cleared = strongholds.filter((stronghold) => stronghold.cleared).length;
    const nearest = nearestUnclearedStronghold();
    ui.waveHud.classList.toggle("active", state === "playing");
    ui.waveNumber.textContent = cleared + " / " + total;
    ui.waveProgress.style.width = (total ? clamp(cleared / total * 100, 0, 100) : 0) + "%";
    ui.waveEnemyCount.textContent = nearest ? "CLEAR " + nearest.name : cleared >= total ? "THE WORLD-BURNER AWAITS" : "CLEAR ALL TO FACE VHAROK";
  }

  function disposeGroundEnemy(enemy) {
    clearEnemyTelegraph(enemy);
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
      const nextState = enemy.dead ? "death" : enemy.hitStun > 0 ? "hit" : enemy.attackTimer > 0 ? "attack" : moving ? "run" : "idle";
      setEnemyAction(enemy, nextState);
      enemy.mixer.timeScale = nextState === "run" ? 1.15 : 1;
      enemy.mixer.update(dt);
      return;
    }
    const parts = enemy.parts;
    const stride = Math.sin(enemy.walkCycle) * (enemy.kind === "golem" ? .38 : .72);
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

  function steerAroundObstacles(enemy, direction) {
    const y = enemy.root.position.y;
    const probe = (angle) => {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const dx = direction.x * c - direction.z * s;
      const dz = direction.x * s + direction.z * c;
      return {
        dx, dz,
        blocked: hitsCollider(enemy.root.position.x + dx * 3.5, enemy.root.position.z + dz * 3.5, enemy.hitRadius * .45, y, y + 3.6)
      };
    };
    if (!probe(0).blocked) return null;
    const left = probe(.55);
    const right = probe(-.55);
    let chosen = null;
    if (!left.blocked && !right.blocked) {
      const leftDistance = Math.hypot(enemy.root.position.x + left.dx * 3.5 - player.root.position.x, enemy.root.position.z + left.dz * 3.5 - player.root.position.z);
      const rightDistance = Math.hypot(enemy.root.position.x + right.dx * 3.5 - player.root.position.x, enemy.root.position.z + right.dz * 3.5 - player.root.position.z);
      chosen = leftDistance <= rightDistance ? left : right;
    } else chosen = !left.blocked ? left : !right.blocked ? right : null;
    if (!chosen) return new THREE.Vector3(-direction.x, 0, -direction.z);
    return new THREE.Vector3(chosen.dx, 0, chosen.dz);
  }

  function updateGroundEnemies(dt, idle) {
    groundEnemies.forEach((enemy) => {
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
        const footY = enemy.root.position.y;
        if (!hitsCollider(impulseX, impulseZ, enemy.hitRadius * .45, footY, footY + 3.6)) {
          enemy.root.position.x = clamp(impulseX, -HALF_WORLD, HALF_WORLD);
          enemy.root.position.z = clamp(impulseZ, -HALF_WORLD, HALF_WORLD);
        }
        enemy.impulse.multiplyScalar(Math.pow(.035, dt));
      }
      if (enemy.camp) {
        const playerCampDistance = player.root ? Math.hypot(player.root.position.x - enemy.camp.x, player.root.position.z - enemy.camp.z) : 0;
        if (playerCampDistance > enemy.camp.radius) {
          clearEnemyTelegraph(enemy);
          enemy.attackTimer = 0;
          const homeX = enemy.camp.x - enemy.root.position.x;
          const homeZ = enemy.camp.z - enemy.root.position.z;
          const homeDistance = Math.hypot(homeX, homeZ);
          let campMoving = false;
          if (homeDistance > 2.5 && enemy.hitStun <= 0) {
            const directionX = homeX / homeDistance;
            const directionZ = homeZ / homeDistance;
            const movementSpeed = enemy.speed * .72 * (enemy.slowTime > 0 ? .62 : 1);
            const nextX = enemy.root.position.x + directionX * movementSpeed * dt;
            const nextZ = enemy.root.position.z + directionZ * movementSpeed * dt;
            const enemyY = enemy.root.position.y;
            if (!hitsCollider(nextX, nextZ, enemy.hitRadius * .45, enemyY, enemyY + 3.6)) {
              enemy.root.position.x = nextX;
              enemy.root.position.z = nextZ;
            }
            enemy.root.rotation.y = rotateToward(enemy.root.rotation.y, Math.atan2(-directionX, -directionZ), dt * 7);
            enemy.walkCycle += dt * enemy.speed * 1.7;
            campMoving = true;
          }
          enemy.root.position.y = terrainHeight(enemy.root.position.x, enemy.root.position.z);
          animateGroundEnemy(enemy, dt, campMoving);
          return;
        }
      }
      const offset = player.root.position.clone().sub(enemy.root.position);
      const distance = offset.length();
      const moving = distance > enemy.attackRange && enemy.hitStun <= 0;
      if (moving) {
        const direction = offset.setY(0).normalize();
        groundEnemies.forEach((other) => {
          if (other === enemy || other.dead) return;
          const separation = enemy.root.position.clone().sub(other.root.position).setY(0);
          const length = separation.length();
          if (length > .01 && length < 2.2) direction.addScaledVector(separation.normalize(), (2.2 - length) * .32);
        });
        direction.normalize();
        const steered = steerAroundObstacles(enemy, direction);
        if (steered) direction.copy(steered);
        const movementSpeed = enemy.speed * (enemy.slowTime > 0 ? .62 : 1);
        const nextX = enemy.root.position.x + direction.x * movementSpeed * dt;
        const nextZ = enemy.root.position.z + direction.z * movementSpeed * dt;
        const enemyY = enemy.root.position.y;
        if (!hitsCollider(nextX, nextZ, enemy.hitRadius * .45, enemyY, enemyY + 3.6)) {
          enemy.root.position.x = nextX;
          enemy.root.position.z = nextZ;
        }
        enemy.root.rotation.y = rotateToward(enemy.root.rotation.y, Math.atan2(-direction.x, -direction.z), dt * 9);
        enemy.walkCycle += dt * enemy.speed * (enemy.kind === "golem" ? 1.1 : 2.1);
      } else if (distance <= enemy.attackRange && enemy.attackCooldown <= 0 && enemy.attackTimer <= 0) {
        enemy.attackTimer = .72;
        enemy.attackDelivered = false;
        enemy.attackCooldown = enemy.attackInterval;
        enemy.root.rotation.y = Math.atan2(-(player.root.position.x - enemy.root.position.x), -(player.root.position.z - enemy.root.position.z));
        beginEnemyTelegraph(enemy);
      }
      if (enemy.attackTimer > 0) {
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
          if (freshDistance < enemy.attackRange + .85 && facingDot > .15) damagePlayer(enemy.damage, enemy.name);
          createShockwave(enemy.root.position.clone(), enemy.attackRange, .22, enemy.elite ? 0xff6338 : 0xd18a52);
        }
        if (enemy.attackTimer <= 0) clearEnemyTelegraph(enemy);
      }
      enemy.root.position.y = terrainHeight(enemy.root.position.x, enemy.root.position.z);
      animateGroundEnemy(enemy, dt, moving);
    });
  }

  function interact() {
    if (state !== "playing") return false;
    return collectExperienceRune(nearestExperienceRune(11)) || collectDragonSoul(nearestDragonSoul(11)) || openChest(nearestChest(11));
  }


  function resetActors() {
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
    worldLayout.forts.forEach((fort, index) => {
      const angle = Math.atan2(fort[1], fort[0]) + .55;
      createDragon(worldProfile.dragonNames[index], clamp(fort[0] + Math.cos(angle) * 62, -560, 560), clamp(fort[1] + Math.sin(angle) * 62, -560, 560), false);
    });
    const wanderAngle = seeded(worldLayout.salt + 1600) * Math.PI * 2;
    createDragon(worldProfile.dragonNames[3], Math.cos(wanderAngle) * 360, Math.sin(wanderAngle) * 360, false);
    // Garrisons are world gen: seeded spots from registerStronghold, spawned with level-scaled
    // count and promotions, with the encounter RNG stream restored so combat stays deterministic.
    const garrisonRngState = encounterRng.state;
    strongholds.forEach((stronghold) => {
      stronghold.members = [];
      if (stronghold.cleared) return;
      const base = STRONGHOLD_GARRISONS[stronghold.kind] || STRONGHOLD_GARRISONS.hamlet;
      const countBonus = Math.min(4, Math.floor((player.level - 1) / 6));
      const promoteRoll = Math.min(.45, player.level * .02);
      const golemCount = base.golem + ((stronghold.kind === "fort" && player.level >= 10) || (stronghold.kind === "keep" && player.level >= 14) ? 1 : 0);
      const threat = ambientDifficulty();
      const plan = stronghold.spots.filter((spot) => spot.type === "biomeHeavy" || spot.type === "warg")
        .concat(stronghold.spots.filter((spot) => spot.type === "golem").slice(0, golemCount))
        .concat(stronghold.spots.filter((spot) => spot.type === "biomeLight").slice(0, base.light + countBonus)
          .map((spot) => ({ x: spot.x, z: spot.z, type: spot.roll < promoteRoll ? "biomeHeavy" : "biomeLight" })));
      plan.forEach((spot) => {
        const enemy = createGroundEnemy(spot.type, spot.x, spot.z, threat);
        enemy.strongholdId = stronghold.id;
        enemy.camp = { x: stronghold.x, z: stronghold.z, radius: stronghold.kind === "keep" ? 40 : 30 };
        enemy.name = stronghold.name + " " + enemy.name;
        stronghold.members.push(enemy);
      });
    });
    encounterRng.state = garrisonRngState;
  }

  function createLandmarks() {
    const routeSummits = worldLayout.routes.map((route) => platforms.filter((platform) => platform.routeId === route[5]).sort((a, b) => b.stepIndex - a.stepIndex)[0]);
    landmarks = [
      { id: "pass", name: biome.name + " GATE", position: new THREE.Vector3(START.x, 0, START.z - 28), radius: 32, discovered: false, revealed: false },
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

  function startGame(forceFresh) {
    if (state === "ended" && !testMode) {
      window.location.reload();
      return;
    }
    const resumeSave = !forceFresh && pendingRunState;
    if (forceFresh) clearActiveRun();
    runResolving = false;
    audio.init();
    outpostsDiscovered = 0;
    runeHinted = false;
    encounterRng.state = ((Number(realm.seed) || 1) ^ 0x6d2b79f5) >>> 0;
    strongholds.forEach((stronghold) => { stronghold.cleared = false; stronghold.members = []; });
    if (resumeSave) applySavedStrongholds(resumeSave);
    resetExperienceRunes();
    resetChests();
    resetActors();
    player.health = maxHealth();
    player.stamina = maxStamina();
    player.shout = 0;
    player.vertical = 0;
    player.velocityY = 0;
    player.grounded = true;
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
      activeRunId = "run-" + realm.seed + "-" + Date.now().toString(36);
    }
    const resumed = Boolean(resumeSave && restoreActiveRun(resumeSave));
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
    if (!isCoarse && !testMode) requestPointer();
    showLocation(biome.name, resumed ? "RUN RESTORED" : "ENTERING REALM " + (player.realmDepth + 1));
    markRunDirty(true);
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
      if (!isCoarse && !testMode) requestPointer();
    }
  }

  function surfaceHeightAt(x, z, footY) {
    let height = terrainHeight(x, z);
    platforms.forEach((platform) => {
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
    const staminaRecovery = (player.moving ? 16 : 25) * (1 + skillRank("endurance") * .06);
    player.stamina = Math.min(maxStamina(), player.stamina + staminaRecovery * dt);
    if (elapsed - player.lastDamage > 10) player.health = Math.min(maxHealth(), player.health + 1.8 * (hasSkill("immortal_warden") && player.health < maxHealth() * .4 ? 2 : 1) * dt);

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
    player.moving = moving;
    player.sprinting = false;
    player.superSprinting = false;

    if (player.dodgeTime > 0) {
      moving = true;
      const dodgeProgress = clamp(player.dodgeElapsed / .58, 0, 1);
      const dodgeSpeed = lerp(21, 7.5, dodgeProgress);
      movePlayer(player.dodgeDirection.x * dodgeSpeed * dt, player.dodgeDirection.z * dodgeSpeed * dt);
      player.root.rotation.y = rotateToward(player.root.rotation.y, Math.atan2(-player.dodgeDirection.x, -player.dodgeDirection.z), dt * 18);
      player.distance += dodgeSpeed * dt;
    } else if (moving) {
      inputX /= Math.max(1, magnitude);
      inputZ /= Math.max(1, magnitude);
      const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
      const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
      const direction = forward.multiplyScalar(inputZ).add(right.multiplyScalar(inputX)).normalize();
      const touchSuperSprint = isCoarse && magnitude > .92;
      const superSprinting = (keys.has("control") || touchSuperSprint) && player.stamina > 5;
      const sprinting = (superSprinting || keys.has("shift") || (isCoarse && magnitude > .68) || magnitude > 1.15) && player.stamina > 2;
      player.sprinting = sprinting;
      player.superSprinting = superSprinting;
      const speed = superSprinting ? 25.5 * (1 + skillRank("windstep") * .055) : sprinting ? 17.2 : 7.8;
      if (superSprinting) player.stamina = Math.max(0, player.stamina - 34 * (1 - skillRank("windstep") * .09) * dt);
      else if (sprinting) player.stamina = Math.max(0, player.stamina - 21 * dt);
      const dx = direction.x * speed * dt;
      const dz = direction.z * speed * dt;
      movePlayer(dx, dz);
      player.distance += Math.hypot(dx, dz);
      const desiredRotation = Math.atan2(-direction.x, -direction.z);
      player.root.rotation.y = rotateToward(player.root.rotation.y, desiredRotation, dt * (superSprinting ? 14 : sprinting ? 11 : 9));
      player.walkCycle += dt * (superSprinting ? 24 : sprinting ? 17.5 : 9.2);
    }

    const currentY = player.root.position.y;
    const landingHeight = surfaceHeightAt(player.root.position.x, player.root.position.z, currentY);
    if (player.grounded && currentY - landingHeight > .9) {
      player.grounded = false;
      player.velocityY = Math.min(0, player.velocityY);
      player.jumpTime = 0;
    }
    if (!player.grounded) {
      player.jumpTime += dt;
      player.velocityY -= 20.5 * dt;
      const nextY = player.root.position.y + player.velocityY * dt;
      const surface = surfaceHeightAt(player.root.position.x, player.root.position.z, player.root.position.y + .9);
      if (player.velocityY <= 0 && nextY <= surface) {
        player.root.position.y = surface;
        player.velocityY = 0;
        player.grounded = true;
        player.jumpTime = 0;
      } else player.root.position.y = nextY;
    } else player.root.position.y = landingHeight;
    if (player.grounded && player.root.position.y > biome.waterLevel + .35 && !hitsCollider(player.root.position.x, player.root.position.z, .7, player.root.position.y, player.root.position.y + 2.1)) player.lastSafePosition.copy(player.root.position);
    player.vertical = Math.max(0, player.root.position.y - terrainHeight(player.root.position.x, player.root.position.z));
    camera.fov = lerp(camera.fov, player.superSprinting ? 76 : player.sprinting ? 69 : 62, 1 - Math.pow(.002, dt));
    camera.updateProjectionMatrix();
    player.streakTimer -= dt;
    if (player.superSprinting && player.grounded && !isCoarse && !reducedMotion && player.streakTimer <= 0) {
      player.streakTimer = 1 / 12;
      spawnSpeedStreaks();
    }
    animatePlayer(dt, moving);
    const cellX = Math.floor((player.root.position.x + HALF_WORLD) / 45);
    const cellZ = Math.floor((player.root.position.z + HALF_WORLD) / 45);
    discoveredCells.add(cellX + ":" + cellZ);
    checkLandmarks();
    updateQuest();
  }

  function movePlayer(dx, dz) {
    const radius = .8;
    const footY = player.root.position.y;
    const candidateX = clamp(player.root.position.x + dx, -HALF_WORLD, HALF_WORLD);
    if (canPlayerOccupy(candidateX, player.root.position.z, radius, footY)) player.root.position.x = candidateX;
    const candidateZ = clamp(player.root.position.z + dz, -HALF_WORLD, HALF_WORLD);
    if (canPlayerOccupy(player.root.position.x, candidateZ, radius, footY)) player.root.position.z = candidateZ;
  }

  function hitsCollider(x, z, radius, footY, topY) {
    const actorBottom = Number.isFinite(footY) ? footY + .08 : -Infinity;
    const actorTop = Number.isFinite(topY) ? topY : Number.isFinite(footY) ? footY + 2.15 : Infinity;
    return colliders.some((box) => {
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
      return offsetX * offsetX + offsetZ * offsetZ < radius * radius;
    });
  }

  function canPlayerOccupy(x, z, radius, footY) {
    if (hitsCollider(x, z, radius, footY, footY + 2.15)) return false;
    if (!player.grounded) return true;
    const currentSurface = surfaceHeightAt(player.root.position.x, player.root.position.z, footY + .9);
    const nextSurface = surfaceHeightAt(x, z, footY + .9);
    const step = nextSurface - currentSurface;
    if (step > .82) return false;
    const terrain = terrainHeight(x, z);
    const supportedAboveWater = nextSurface > terrain + .35;
    if (!supportedAboveWater && terrain <= biome.waterLevel + .35) return false;
    const sample = 1.15;
    const slope = Math.max(
      Math.abs(terrainHeight(x + sample, z) - terrainHeight(x - sample, z)),
      Math.abs(terrainHeight(x, z + sample) - terrainHeight(x, z - sample))
    ) / (sample * 2);
    return supportedAboveWater || slope <= 1.18;
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

  function updateSprintPose(dt) {
    let target = player.superSprinting ? 1 : player.sprinting ? .65 : 0;
    if (player.dodgeTime > 0 || player.hitReaction > 0 || player.attackTime > 0 || !player.grounded || !player.moving || state !== "playing") target = 0;
    player.sprintPoseWeight = lerp(player.sprintPoseWeight || 0, target, 1 - Math.pow(.001, dt));
    const weight = player.sprintPoseWeight;
    if (weight < .001 || !player.sprintBones) return;
    const bones = player.sprintBones;
    if (!player.sprintPoseSnapshot) {
      player.sprintPoseSnapshot = {};
      Object.keys(bones).forEach((key) => { player.sprintPoseSnapshot[key] = new THREE.Quaternion(); });
    }
    Object.keys(bones).forEach((key) => { if (bones[key]) player.sprintPoseSnapshot[key].copy(bones[key].quaternion); });
    player.sprintPoseApplied = true;
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

  function animatePlayer(dt, moving) {
    const stride = moving ? Math.sin(player.walkCycle) : 0;
    const sprint = player.sprinting ? 1 : 0;
    const superSprint = player.superSprinting ? 1 : 0;
    const strideSize = superSprint ? 1.24 : sprint ? 1.02 : .58;
    const settle = Math.min(1, dt * 13);
    const verticalPulse = moving ? Math.abs(Math.sin(player.walkCycle * 2)) : 0;
    player.leftLeg.rotation.x = lerp(player.leftLeg.rotation.x, stride * strideSize, settle);
    player.rightLeg.rotation.x = lerp(player.rightLeg.rotation.x, -stride * strideSize, settle);
    player.leftLeg.rotation.z = lerp(player.leftLeg.rotation.z, sprint ? -.07 : 0, settle);
    player.rightLeg.rotation.z = lerp(player.rightLeg.rotation.z, sprint ? .07 : 0, settle);
    player.leftArm.rotation.x = lerp(player.leftArm.rotation.x, -stride * (superSprint ? 1.04 : sprint ? .82 : .38), settle);
    player.body.rotation.x = lerp(player.body.rotation.x, superSprint ? -.25 : sprint ? -.16 : 0, settle);
    player.body.rotation.z = lerp(player.body.rotation.z, moving ? -stride * .035 : 0, settle);
    player.body.rotation.y = lerp(player.body.rotation.y, 0, settle);
    if (!player.grounded) {
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
    player.body.position.y = 1.62 + verticalPulse * (superSprint ? .13 : sprint ? .09 : .045) - (!player.grounded ? .05 : 0);
    const capePosition = player.cape.geometry.attributes.position;
    const sway = Math.sin(elapsed * 3.2) * .035 + (moving ? (sprint ? .31 : .12) : 0);
    capePosition.setZ(2, .61 + sway);
    capePosition.setZ(3, .61 + sway);
    capePosition.needsUpdate = true;
    if (player.weaponModels.staff) player.weaponModels.staff.children.forEach((part, index) => { if (index > 0) part.rotation.y += dt * (1.4 + index * .25); });
    if (player.modelMixer) {
      let modelState = "idle";
      if (player.dodgeTime > 0) modelState = "roll";
      else if (player.hitReaction > 0) modelState = "hit";
      else if (player.attackTime > 0) modelState = player.attackVariant % 2 ? "attack1" : "attack2";
      else if (!player.grounded) modelState = "run";
      else if (moving) modelState = player.sprinting ? "run" : "walk";
      setPlayerModelAction(modelState);
      if (modelState === "run" && player.modelActions.run) player.modelActions.run.setEffectiveTimeScale(player.superSprinting ? 1.25 : 1.15);
      restoreSprintPoseBones();
      player.modelMixer.update(dt);
      updateSprintPose(dt);
    }
  }

  function jump() {
    if (state !== "playing" || !player.grounded || player.stamina < 10) return;
    player.grounded = false;
    player.velocityY = 15.2 + skillRank("acrobat") * 1.3 + (realm.biome === "moon" ? 1.6 : 0);
    player.jumpTime = 0;
    player.stamina -= 10;
    audio.tone(120, 185, .12, "triangle", .014);
  }

  function dodge() {
    if (state !== "playing" || !player.grounded || player.dodgeTime > 0 || player.dodgeCooldown > 0 || player.attackTime > .12 || player.stamina < 22) return false;
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
    audio.init();
    const attackSpeed = attackSpeedMultiplier(weaponId);
    player.attackCooldown = weapon.cooldown * attackSpeed;
    player.attackDuration = weapon.duration * attackSpeed;
    player.attackTime = player.attackDuration;
    player.attackVariant += 1;
    player.stamina -= staminaCost;
    player.root.rotation.y = rotateToward(player.root.rotation.y, cameraYaw, .7);
    audio.swing();
    player.pendingAttack = { weaponId, releaseAt: player.attackDuration * .55, executed: false };
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
        gravity: weapon.gravity * (weaponId === "bow" ? 1 - skillRank("eagle_eye") * .22 : 1), color: weapon.color,
        spin: weaponId === "axe" ? 11 : weaponId === "staff" ? 3.5 : 0
      });
      if (weaponId === "bow") {
        player.bowShots += 1;
        if (hasSkill("split_arrow") && player.bowShots % 3 === 0) {
          const sideDirection = forward.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.bowShots % 2 ? .055 : -.055);
          const sideMesh = createWeaponProjectile("bow", weapon);
          sideMesh.position.copy(origin).addScaledVector(sideDirection, 1.2);
          scene.add(sideMesh);
          bolts.push({ mesh: sideMesh, weaponId: "bow", velocity: sideDirection.multiplyScalar(weapon.speed * speedMultiplier), life: weapon.life, damage: Math.round(weapon.damage * weaponDamageMultiplier("bow") * .7), splash: 0, gravity: weapon.gravity * .55, color: weapon.color, spin: 0 });
        }
      }
      if (weaponId === "staff") {
        player.staffCasts += 1;
        if (hasSkill("tempest_crown") && player.staffCasts % 6 === 0) {
          createShockwave(player.root.position.clone(), 13, .7, 0xb388f0);
          allEnemies().forEach((enemy) => { if (!enemy.dead && enemy.root.position.distanceTo(player.root.position) < 12) damageDragon(enemy, 24, false, "arc", "staff"); });
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
      if (horizontalDistance < reach && verticalDistance < verticalWindow && facing > .08) damageDragon(enemy, Math.round(weapon.melee * weaponDamageMultiplier(weaponId) * riposteMultiplier), weaponId === "axe", "weapon", weaponId);
    });
  }

  function allEnemies() { return dragons.concat(groundEnemies); }

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
    audio.shoutSound();
    showMessage("FUS RO DAH", "#bceaf4");
    const forceMultiplier = 1 + skillRank("force") * .12;
    const shoutRadius = 48 + skillRank("force") * 4;
    const shoutTargets = allEnemies().filter((enemy) => !enemy.dead && enemy.root.position.distanceTo(player.root.position) < shoutRadius);
    createShockwave(player.root.position.clone(), shoutRadius, 1.05, 0x8ed5e8);
    shoutTargets.forEach((dragon) => {
      damageDragon(dragon, Math.round((dragon.boss ? 38 : 62) * forceMultiplier), true, "shout");
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
        if (!target.dead) damageDragon(target, target.boss ? 12 : 24, false, "arc", "staff");
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
          damageDragon(dragon, bolt.damage, bolt.weaponId === "axe", "weapon", bolt.weaponId);
          if (bolt.splash > 0) {
            allEnemies().forEach((other) => {
              if (other !== dragon && !other.dead && other.root.position.distanceTo(bolt.mesh.position) < bolt.splash) {
                damageDragon(other, Math.max(1, Math.round(bolt.damage * .55)), false, "weapon", bolt.weaponId);
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

  function damageDragon(dragon, amount, heavy, source, weaponId) {
    if (dragon.dead) return;
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
      finalAmount *= 1.65;
    }
    if (damageSource === "weapon" && player.swapEmpowered) {
      finalAmount *= 1 + skillRank("swift_change") * .12;
      player.swapEmpowered = false;
    }
    if (damageSource === "weapon" && weaponId === "blade") {
      player.bladeHits += 1;
      if (hasSkill("sword_saint") && player.bladeHits % 5 === 0) finalAmount *= 1.8;
      if (dragon.kind !== "dragon" && skillRank("bleeding_edge")) {
        dragon.bleedStacks = Math.min(skillRank("bleeding_edge"), (dragon.bleedStacks || 0) + 1);
        dragon.bleedTime = 4;
      }
    }
    if (damageSource === "weapon" && weaponId === "staff" && dragon.kind !== "dragon" && skillRank("frost_nova") && distance2D(dragon.root.position, player.root.position) < 9) dragon.slowTime = 1.4 + skillRank("frost_nova") * .55;
    finalAmount = Math.max(1, Math.round(finalAmount));
    const appliedDamage = Math.min(dragon.health, finalAmount);
    dragon.engaged = true;
    dragon.health -= finalAmount;
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

  function killDragon(dragon) {
    const isDragon = dragon.kind === "dragon";
    dragon.dead = true;
    dragon.health = 0;
    if (!isDragon) setEnemyAction(dragon, "death", true);
    player.kills += 1;
    if (hasSkill("run_rampage")) player.rampageTime = 4.5;
    if (isDragon) player.dragonKills += 1;
    player.shout = Math.min(100, player.shout + (dragon.boss ? 38 : 21) * shoutChargeMultiplier());
    const xpGain = dragon.xpReward || (dragon.boss ? 950 : 320);
    grantXp(xpGain);
    grantRunXp(Math.round((dragon.xpReward || 60) * .58), dragon.elite ? "ELITE SLAIN" : "ENEMY SLAIN");
    const heal = Math.max(3, Math.round((dragon.healthReward || 6) * .65 + skillRank("run_scavenger") * 2 + (hasSkill("immortal_warden") ? 3 : 0)));
    player.health = Math.min(maxHealth(), player.health + heal);
    if (dragon.lastDamageSource === "weapon") grantWeaponXp(dragon.boss ? 46 : 16, dragon.lastWeaponId);
    const effectScale = dragon.boss ? (isDragon ? 18 : 11) : isDragon ? 10 : 6;
    createExplosion(dragon.root.position, dragon.boss ? 0x8bc9d8 : isDragon ? 0xe15e31 : 0x75b9c9, effectScale);
    createShockwave(dragon.root.position.clone(), dragon.boss ? 22 : 10, .75, dragon.boss ? 0x8ccfe0 : 0xd46138);
    if (isDragon) spawnDragonSouls(dragon);
    showHit(true);
    showMessage((dragon.boss && isDragon ? "THE WORLD-BURNER IS SLAIN" : dragon.name + " SLAIN") + "  +" + heal + " HEALTH · +" + xpGain + " XP", dragon.boss ? "#a9deea" : "#edbd80");
    spawnCombatText(dragon.root.position, "+" + xpGain + " XP", "xp");
    spawnCombatText(player.root.position, "+" + heal, "heal");
    if (isDragon) audio.dragon(); else audio.hit();
    if (dragon.isAmbient && enemyDirector.phase === "combat") {
      enemyDirector.defeated = Math.min(enemyDirector.target, enemyDirector.defeated + 1);
      updateAssaultUI();
    }
    if (dragon.boss && isDragon) winGame();
    else if (isDragon && questStage >= 1 && player.dragonKills >= 3 && !bossSpawned) spawnBoss();
    updateQuestUI();
    markRunDirty();
  }

  function spawnBoss(silent) {
    bossSpawned = true;
    questStage = 2;
    const boss = createDragon("VHAROK, " + worldProfile.dragonNames[0] + " ASCENDANT", RUINS.x, RUINS.z - 18, true);
    boss.root.position.y = terrainHeight(RUINS.x, RUINS.z) + 44;
    boss.engaged = true;
    if (!silent) {
      showLocation(boss.name, "BOSS AWAKENED");
      audio.dragon();
    }
    updateQuestUI();
    markRunDirty(true);
  }

  function damagePlayer(amount, sourceName) {
    if (state !== "playing") return;
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

  function updateEffects(dt) {
    effects.forEach((effect) => {
      effect.life -= dt;
      const progress = 1 - effect.life / effect.maxLife;
      const scale = effect.type === "lightning" || effect.type === "streak" ? 1 : effect.type === "ring" ? lerp(1, effect.grow, progress) : lerp(1, effect.grow, Math.sqrt(progress));
      effect.mesh.scale.setScalar(scale);
      effect.mesh.material.opacity = Math.max(0, (1 - progress) * (effect.peakOpacity == null ? .8 : effect.peakOpacity));
    });
    effects = effects.filter((effect) => {
      if (effect.life <= 0) { scene.remove(effect.mesh); effect.mesh.material.dispose(); effect.mesh.geometry.dispose(); return false; }
      return true;
    });
  }

  function updateWorldDecor(dt) {
    if (sky) sky.rotation.y += dt * .0013;
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
    renderer.toneMappingExposure = biome.exposure + lightningPulse * .32;
    if (sun) sun.intensity = biome.sunIntensity + lightningPulse * 2.2;
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
        let y = positions.getY(i) - dt * (1.2 + (i % 7) * .08) * (biome.particleFall || 1);
        if (y < 0) y = 80 + (i % 11);
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
    }
  }

  function updateCamera(dt, immediate) {
    if (!player.root) return;
    const target = player.root.position.clone().add(new THREE.Vector3(0, 1.84, 0));
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
      ui.questObjective.innerHTML = "<i></i> Ashenhold is free";
      ui.questProgress.textContent = "The northern sky belongs to the living.";
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
    if (enemyDirector.phase === "combat") {
      const wave = groundEnemies.filter((enemy) => enemy.isAmbient && !enemy.dead).sort((a,b) => a.root.position.distanceTo(player.root.position) - b.root.position.distanceTo(player.root.position));
      if (wave.length) return { position: wave[0].root.position, label: "SURVIVE THE ASSAULT", kind: "assault" };
    }
    return null;
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
    const nearbyRune = nearestExperienceRune(11);
    const nearbySoul = nearbyRune ? null : nearestDragonSoul(11);
    const nearbyChest = (nearbyRune || nearbySoul) ? null : nearestChest(11);
    ui.interaction.classList.toggle("visible", Boolean(nearbyRune || nearbySoul || nearbyChest));
    ui.interactionText.textContent = nearbyRune ? "Absorb Rune · +" + nearbyRune.xp + " XP" : nearbySoul ? "Absorb Dragon Soul · +" + nearbySoul.xp + " XP" : nearbyChest ? "Open Relic Chest · +" + nearbyChest.xp + " XP" : "Absorb Rune";
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
      if (landmark.poi) {
        mapContext.fillStyle = MARKER_STYLES.poi.color;
        mapContext.fillRect(point.x - 2.5, point.y - 1, 5, 3.5);
        mapContext.beginPath();
        mapContext.moveTo(point.x - 3.5, point.y - 1);
        mapContext.lineTo(point.x, point.y - 5);
        mapContext.lineTo(point.x + 3.5, point.y - 1);
        mapContext.closePath();
        mapContext.fill();
        return;
      }
      mapContext.fillStyle = landmark.discovered ? MARKER_STYLES.outpostDiscovered.color : landmark.revealed ? MARKER_STYLES.poi.color : MARKER_STYLES.outpostHidden.color;
      mapContext.fillRect(point.x - 2.5, point.y - 2.5, 5, 5);
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
    const prepared = prepareNextRealm();
    const baseCopy = endingCopy || (victory ? "Vharok is dead. Dawn returns to the ruined kingdom." : "The World-Burner still rules the northern sky.");
    ui.endCopy.textContent = baseCopy + (prepared ? " Next realm: " + BIOMES[prepared.biome].name + " · BIOME " + (REALM_LADDER.indexOf(prepared.biome) + 1) + " OF " + REALM_LADDER.length + "." : "");
    ui.finalKills.textContent = player.kills;
    ui.finalWave.textContent = enemyDirector.wave;
    ui.finalDistance.textContent = Math.round(player.distance) + "m";
    ui.finalExplored.textContent = Math.min(100, Math.round(discoveredCells.size / 520 * 100)) + "%";
    ui.end.classList.add("active");
    ui.playAgain.focus({ preventScroll: true });
    setPlayerModelAction(victory ? "idle" : "death", true);
    if (victory) audio.victory();
  }

  function checkRunCompletion() {
    if (runResolving || questStage !== 3 || !enemyDirector.completed) return false;
    runResolving = true;
    state = "resolving";
    game.dataset.state = state;
    player.realmDepth += 1;
    player.prestige += 1;
    saveProgression(true);
    clearActiveRun();
    window.setTimeout(() => endGame(true, "The five-wave assault and its World-Burner are defeated. A harder realm has been forged."), 700);
    return true;
  }

  function winGame() {
    questStage = 3;
    updateQuestUI();
    markRunDirty(true);
    if (!checkRunCompletion()) showProgressionBanner("WORLD-BURNER SLAIN", "FINISH THE ASSAULT", "Complete all five waves to conquer this realm");
  }

  function update(dt) {
    elapsed += dt;
    targetScanTimer -= dt;
    hudRefreshTimer -= dt;
    minimapRefreshTimer -= dt;
    updatePlayer(dt);
    updateDragons(dt, false);
    updateGroundEnemies(dt, false);
    updateEnemyDirector(dt);
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
    if (state === "playing") update(dt);
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
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if ([" ","arrowup","arrowdown","arrowleft","arrowright","tab","alt"].includes(key)) event.preventDefault();
      keys.add(key);
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
    window.addEventListener("blur", () => { if (state === "playing" && !isCoarse) pauseGame(true); });
    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement === renderer.domElement && state === "playing") {
        applyLookDelta(event.movementX, event.movementY, .0025, .0019);
      }
    });
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === renderer.domElement;
      game.classList.toggle("pointer-locked", locked);
      if (locked) pointerWasLocked = true;
      else if (pointerWasLocked && state === "playing" && !suppressPointerPause && !testMode) pauseGame(true);
    });
    viewport.addEventListener("mousedown", (event) => {
      if (state !== "playing") return;
      if (event.button === 1) { event.preventDefault(); toggleTargetLock(); return; }
      if (event.button === 2) { event.preventDefault(); dodge(); return; }
      if (event.button !== 0) return;
      if (!isCoarse && !testMode && document.pointerLockElement !== renderer.domElement) requestPointer();
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

  window.ashenholdGame = {
    snapshot: () => ({
      state,
      position: player.root ? { x: player.root.position.x, y: player.root.position.y, z: player.root.position.z } : null,
      health: player.health, stamina: player.stamina, shout: player.shout, kills: player.kills,
      moving: player.moving, sprinting: player.sprinting, superSprinting: player.superSprinting,
      maxHealth: maxHealth(), maxStamina: maxStamina(), level: player.level, xp: player.xp,
      skillPoints: player.skillPoints, prestige: player.prestige, realmDepth: player.realmDepth, activeWeapon: player.activeWeapon,
      runLevel: player.runLevel, runXp: player.runXp, runSkillPoints: player.runSkillPoints,
      weaponLevel: masteryFor().level, weaponXp: masteryFor().xp,
      mastery: WEAPON_IDS.reduce((result, id) => { result[id] = { level: masteryFor(id).level, xp: masteryFor(id).xp }; return result; }, {}),
      skills: Object.keys(player.skills).filter((id) => player.skills[id]), skillRanks: Object.assign({}, player.skills),
      runSkills: Object.assign({}, player.runSkills), skillBranches: skillTree.length,
      skillNodes: skillTree.reduce((sum, branch) => sum + branch.nodes.length, 0),
      questStage, dragonsAlive: dragons.filter((dragon) => !dragon.dead).length,
      groundEnemiesAlive: groundEnemies.filter((enemy) => !enemy.dead).length,
      wave: enemyDirector.wave, maxWaves: enemyDirector.maxWaves,
      wavePhase: enemyDirector.phase, waveTimer: enemyDirector.timer,
      waveActive: enemyDirector.phase === "combat", assaultCompleted: enemyDirector.completed,
      waveDefeated: enemyDirector.defeated, waveSpawned: enemyDirector.spawned, waveTotal: enemyDirector.target,
      runesCollected, totalRunes: experienceRunes.length,
      chestsOpened: chests.filter((chest) => chest.opened).length, totalChests: chests.length,
      souls: dragonSouls.filter((soul) => !soul.claimed).length,
      realm: { biome: realm.biome, name: biome.name, seed: realm.seed, next: nextRealm },
      world: {
        size: WORLD_SIZE, waterLevel: biome.waterLevel, platforms: platforms.length,
        importedModels: visualAssets.models ? Object.keys(visualAssets.models).length : 0,
        grassInstances: grassField ? grassField.count : 0,
        props: { kind: biomePropsReport.kind, total: biomePropsReport.total, byKind: Object.assign({}, biomePropsReport.byKind) },
        outpostsDiscovered,
        landmarksDiscovered: landmarks.filter((landmark) => landmark.discovered).length,
        landmarksRevealed: landmarks.filter((landmark) => landmark.revealed).length,
        pbrBiomeMaterial: Boolean(visualAssets.biomeGround && visualAssets.biomeNormal && visualAssets.biomeRoughness),
        animatedWarden: Boolean(player.modelMixer), biomeGeometry: worldProfile.geometry,
        biomeEnemyModels: [worldProfile.lightEnemy[0], worldProfile.heavyEnemy[0]],
        biomeEnemyNames: [worldProfile.lightEnemy[1], worldProfile.heavyEnemy[1]],
        routeReports: verticalRouteReports.map((report) => Object.assign({}, report)),
        layoutForts: worldLayout.forts.map((fort) => ({ x: Math.round(fort[0] * 10) / 10, z: Math.round(fort[1] * 10) / 10, name: fort[4] })),
        pois: (worldLayout.pois || []).map((poi) => ({ kind: poi.kind, name: poi.name, x: Math.round(poi.x), z: Math.round(poi.z) })),
        spawnFailures: enemyDirector.spawnFailures
      },
      combat: {
        dodging: player.dodgeTime > 0, dodgeElapsed: player.dodgeElapsed, locked: lockedTarget ? lockedTarget.name : null,
        sprintPose: player.sprintPoseWeight || 0,
        hitStopRemaining, threat: enemyDirector.threat, lightningArcs: effects.filter((effect) => effect.type === "lightning").length
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
    })
  };

  if (testMode) {
    window.__ASHENHOLD_TEST__ = {
      start: startGame,
      teleport: (x, z) => {
        player.root.position.x = clamp(x, -HALF_WORLD, HALF_WORLD);
        player.root.position.z = clamp(z, -HALF_WORLD, HALF_WORLD);
        player.root.position.y = terrainHeight(player.root.position.x, player.root.position.z);
        updateCamera(1, true);
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
      startWave: () => { enemyDirector.timer = 0; updateEnemyDirector(.01); },
      skipIntermission: () => { enemyDirector.timer = 0; updateEnemyDirector(.01); },
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
      defeatWave: () => groundEnemies.filter((enemy) => enemy.isAmbient && !enemy.dead).forEach((enemy) => { enemy.lastDamageSource = "weapon"; enemy.lastWeaponId = player.activeWeapon; killDragon(enemy); }),
      completeCurrentWave: () => {
        groundEnemies.filter((enemy) => enemy.isAmbient && !enemy.dead).forEach((enemy) => { enemy.dead = true; scene.remove(enemy.root); disposeGroundEnemy(enemy); });
        groundEnemies = groundEnemies.filter((enemy) => !enemy.isAmbient);
        enemyDirector.spawned = enemyDirector.target;
        enemyDirector.defeated = enemyDirector.target;
        updateEnemyDirector(.01);
      },
      setQuestComplete: () => { questStage = 3; bossSpawned = true; updateQuestUI(); },
      objectiveInfo: () => currentObjective(),
      collectNearestRune: () => collectExperienceRune(nearestExperienceRune(9999)),
      soulPositions: () => dragonSouls.filter((soul) => !soul.claimed).map((soul) => ({ x: soul.root.position.x, z: soul.root.position.z, xp: soul.xp, grounded: soul.grounded })),
      chestPositions: () => chests.filter((chest) => !chest.opened).map((chest) => ({ x: chest.root.position.x, z: chest.root.position.z, xp: chest.xp })),
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
      enemyDebug: () => groundEnemies.map((enemy) => ({ name: enemy.name, kind: enemy.kind, health: enemy.health, telegraph: Boolean(enemy.telegraph), animation: enemy.animationState, threat: enemy.threat, camp: Boolean(enemy.camp), x: enemy.root.position.x, y: enemy.root.position.y, z: enemy.root.position.z, impulse: enemy.impulse ? enemy.impulse.length() : 0 })),
      poiDebug: () => poiDebugInfo.map((info) => ({ kind: info.kind, name: info.name, chests: info.chests, guards: info.guards, collidersAdded: info.collidersAdded })),
      forceEnemyAttack: () => {
        const enemy = groundEnemies.find((item) => !item.dead && !item.camp) || groundEnemies.find((item) => !item.dead);
        if (!enemy) return false;
        enemy.root.position.copy(player.root.position).add(new THREE.Vector3(0, 0, -Math.max(1.5, enemy.attackRange - .2)));
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
      setSkillForTest: (id, rank) => {
        const node = skillById.get(id);
        if (!node) return false;
        const target = node.scope === "run" ? player.runSkills : player.skills;
        target[id] = clamp(Math.floor(Number(rank) || 0), 0, node.maxRank || 1);
        updateProgressionUI();
        return true;
      },
      forceCritical: () => { player.forceNextCritical = true; },
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

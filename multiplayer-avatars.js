(() => {
  "use strict";

  const WARDEN_MODEL_PATH = "assets/models/hooded-shadow-assassin/scene.gltf";
  const WARDEN_SCALE = 1.68;
  const WARDEN_Y_OFFSET = 1.6;
  const FALLBACK_PALETTE = ["#69d5e6", "#e79a62", "#8bd58c", "#c695ef"];
  const ACTIVE_RENDERERS = new Set();
  const AXIS_X = new THREE.Vector3(1, 0, 0);
  const AXIS_Y = new THREE.Vector3(0, 1, 0);
  const POSE_QUATERNION = new THREE.Quaternion();
  let sharedWardenSource = null;
  let sharedWardenPromise = null;
  let sharedWardenStatus = "idle";
  let sharedWardenError = "";

  function loadSharedWarden() {
    if (sharedWardenPromise) return sharedWardenPromise;
    if (!THREE.GLTFLoader) {
      sharedWardenStatus = "unavailable";
      sharedWardenError = "GLTFLoader unavailable";
      sharedWardenPromise = Promise.reject(new Error(sharedWardenError));
      return sharedWardenPromise;
    }
    sharedWardenStatus = "loading";
    const loader = new THREE.GLTFLoader();
    sharedWardenPromise = loader.loadAsync(WARDEN_MODEL_PATH).then((source) => {
      if (!source?.scene || !Array.isArray(source.animations)) throw new Error("The Warden GLTF is incomplete.");
      sharedWardenSource = source;
      sharedWardenStatus = "ready";
      sharedWardenError = "";
      return source;
    }).catch((error) => {
      sharedWardenStatus = "failed";
      sharedWardenError = String(error?.message || error || "Warden model failed to load");
      console.warn("Remote Warden model failed to load; retaining the procedural fallback.", error);
      throw error;
    });
    return sharedWardenPromise;
  }

  function colorFromPlayer(player) {
    const supplied = String(player?.color || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(supplied)) return { value: supplied.toLowerCase(), source: "server" };
    const id = String(player?.id || "warden");
    let hash = 2166136261;
    for (let index = 0; index < id.length; index += 1) {
      hash ^= id.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return { value: FALLBACK_PALETTE[(hash >>> 0) % FALLBACK_PALETTE.length], source: "player-id" };
  }

  function disposeMaterial(material) {
    if (material?.dispose) material.dispose();
  }

  function applyLocalRotation(bone, axis, angle) {
    if (!bone || !angle) return;
    POSE_QUATERNION.setFromAxisAngle(axis, angle);
    bone.quaternion.multiply(POSE_QUATERNION);
  }

  class RemoteWardenRenderer {
    constructor(scene) {
      if (!window.THREE || !scene) throw new Error("RemoteWardenRenderer requires THREE and a scene.");
      this.scene = scene;
      this.wardens = new Map();
      this.disposed = false;
      this.geometry = {
        torso: new THREE.CylinderGeometry(.31, .24, .82, 8),
        shoulder: new THREE.SphereGeometry(.18, 7, 5),
        limb: new THREE.CylinderGeometry(.105, .085, .62, 7),
        boot: new THREE.BoxGeometry(.2, .19, .36),
        head: new THREE.SphereGeometry(.2, 9, 7),
        hood: new THREE.ConeGeometry(.28, .42, 8, 1, true),
        swordBlade: new THREE.BoxGeometry(.1, 1.65, .07),
        swordGuard: new THREE.BoxGeometry(.62, .08, .12),
        axeHandle: new THREE.CylinderGeometry(.065, .09, 1.85, 8),
        axeHead: new THREE.ConeGeometry(.46, .92, 4),
        axePommel: new THREE.DodecahedronGeometry(.12, 0),
        staffShaft: new THREE.CylinderGeometry(.055, .075, 2.15, 8),
        staffCrystal: new THREE.OctahedronGeometry(.28, 0),
        staffCrown: new THREE.TorusGeometry(.27, .025, 7, 22),
        cape: new THREE.PlaneGeometry(.78, 1.34, 1, 3),
        shadow: new THREE.CircleGeometry(.58, 24),
        marker: new THREE.RingGeometry(.56, .62, 32)
      };
      ACTIVE_RENDERERS.add(this);
      this.sourcePromise = loadSharedWarden();
      this.sourcePromise.then((source) => {
        if (this.disposed) return;
        for (const warden of this.wardens.values()) this.installFullWarden(warden, source);
      }).catch(() => {});
    }

    material(color, options = {}) {
      const parameters = {
        color,
        roughness: options.roughness ?? .68,
        metalness: options.metalness ?? .08,
        emissive: options.emissive || 0x000000,
        emissiveIntensity: options.emissiveIntensity || 0,
        transparent: Boolean(options.transparent),
        opacity: options.opacity ?? 1
      };
      if (options.side !== undefined) parameters.side = options.side;
      return new THREE.MeshStandardMaterial(parameters);
    }

    ownMaterial(warden, material) {
      if (material) warden.ownedMaterials.add(material);
      return material;
    }

    createProceduralFallback(warden, color) {
      const fallback = new THREE.Group();
      fallback.name = "Remote Warden loading fallback";
      const body = new THREE.Group();
      fallback.add(body);
      const armor = this.ownMaterial(warden, this.material(color.clone().multiplyScalar(.62), { roughness: .48, metalness: .42 }));
      const accent = this.ownMaterial(warden, this.material(color, { emissive: color, emissiveIntensity: .35, roughness: .35, metalness: .25 }));
      const cloth = this.ownMaterial(warden, this.material(color.clone().multiplyScalar(.24), { roughness: .94 }));
      const leather = this.ownMaterial(warden, this.material(0x211b19, { roughness: .92 }));
      const skin = this.ownMaterial(warden, this.material(0xc58f70, { roughness: .88 }));

      const torso = new THREE.Mesh(this.geometry.torso, armor);
      torso.position.y = 1.45;
      torso.castShadow = true;
      body.add(torso);
      const belt = new THREE.Mesh(new THREE.BoxGeometry(.53, .11, .35), leather);
      belt.geometry.userData.remoteOwned = true;
      belt.position.y = 1.11;
      body.add(belt);
      warden.ownedGeometries.add(belt.geometry);
      const chestRune = new THREE.Mesh(new THREE.OctahedronGeometry(.09, 0), accent);
      chestRune.geometry.userData.remoteOwned = true;
      chestRune.position.set(0, 1.53, -.29);
      chestRune.rotation.z = Math.PI / 4;
      body.add(chestRune);
      warden.ownedGeometries.add(chestRune.geometry);

      const head = new THREE.Mesh(this.geometry.head, skin);
      head.position.y = 2.04;
      head.castShadow = true;
      body.add(head);
      const hood = new THREE.Mesh(this.geometry.hood, cloth);
      hood.position.set(0, 2.16, .03);
      hood.rotation.x = Math.PI;
      body.add(hood);

      const makeLimb = (side, arm) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * (arm ? .37 : .18), arm ? 1.77 : 1.08, 0);
        const limb = new THREE.Mesh(this.geometry.limb, arm ? cloth : leather);
        limb.position.y = -.3;
        limb.castShadow = true;
        pivot.add(limb);
        if (arm) {
          const shoulder = new THREE.Mesh(this.geometry.shoulder, armor);
          shoulder.position.y = -.02;
          pivot.add(shoulder);
        } else {
          const boot = new THREE.Mesh(this.geometry.boot, leather);
          boot.position.set(0, -.63, -.07);
          pivot.add(boot);
        }
        body.add(pivot);
        return pivot;
      };
      const leftArm = makeLimb(-1, true);
      const rightArm = makeLimb(1, true);
      const leftLeg = makeLimb(-1, false);
      const rightLeg = makeLimb(1, false);
      warden.fallbackPose = { body, leftArm, rightArm, leftLeg, rightLeg };
      return fallback;
    }

    createWeaponRig(warden) {
      const rig = new THREE.Group();
      rig.name = "Remote Warden weapon rig";
      rig.position.set(.74, 2.18, 0);
      const steel = this.ownMaterial(warden, this.material(0xb8c2c3, { roughness: .25, metalness: .92 }));
      const leather = this.ownMaterial(warden, this.material(0x2d211c, { roughness: .9 }));
      const bowWood = this.ownMaterial(warden, this.material(0x6e402a, { roughness: .72, metalness: .08 }));
      const staffWood = this.ownMaterial(warden, this.material(0x302432, { roughness: .68, metalness: .18 }));
      const arcane = this.ownMaterial(warden, this.material(0xc6a2f0, { emissive: 0x5e258b, emissiveIntensity: 1.25, roughness: .22, metalness: .24 }));
      const weapons = {};

      const sword = new THREE.Group();
      const blade = new THREE.Mesh(this.geometry.swordBlade, steel);
      blade.position.y = -1.25;
      blade.castShadow = true;
      const guard = new THREE.Mesh(this.geometry.swordGuard, steel);
      guard.position.y = -.42;
      sword.add(blade, guard);
      sword.rotation.z = -.12;
      weapons.blade = sword;

      const weaponSegment = (start, end, radius, material) => {
        const direction = end.clone().sub(start);
        const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 7);
        warden.ownedGeometries.add(geometry);
        const segment = new THREE.Mesh(geometry, material);
        segment.position.copy(start).add(end).multiplyScalar(.5);
        segment.quaternion.setFromUnitVectors(AXIS_Y, direction.normalize());
        return segment;
      };
      const bow = new THREE.Group();
      const bowPoints = [
        new THREE.Vector3(-.03, -.35, 0), new THREE.Vector3(.25, -.66, 0), new THREE.Vector3(.34, -1.08, 0),
        new THREE.Vector3(.25, -1.52, 0), new THREE.Vector3(-.03, -1.84, 0)
      ];
      for (let index = 0; index < bowPoints.length - 1; index += 1) bow.add(weaponSegment(bowPoints[index], bowPoints[index + 1], .035, bowWood));
      const bowStringGeometry = new THREE.BufferGeometry().setFromPoints([bowPoints[0], new THREE.Vector3(.1, -1.08, .18), bowPoints[4]]);
      const bowStringMaterial = this.ownMaterial(warden, new THREE.LineBasicMaterial({ color: 0xd8e2df, transparent: true, opacity: .8 }));
      warden.ownedGeometries.add(bowStringGeometry);
      bow.add(new THREE.Line(bowStringGeometry, bowStringMaterial));
      bow.add(weaponSegment(new THREE.Vector3(.1, -.35, .18), new THREE.Vector3(.1, -1.85, .18), .018, steel));
      bow.rotation.z = -.2;
      weapons.bow = bow;

      const axe = new THREE.Group();
      const axeHandle = new THREE.Mesh(this.geometry.axeHandle, leather);
      axeHandle.position.y = -1.25;
      const axeHead = new THREE.Mesh(this.geometry.axeHead, steel);
      axeHead.position.set(-.03, -2.08, 0);
      axeHead.rotation.z = Math.PI / 2;
      axeHead.scale.z = .42;
      const axePommel = new THREE.Mesh(this.geometry.axePommel, steel);
      axePommel.position.y = -.3;
      axe.add(axeHandle, axeHead, axePommel);
      axe.rotation.z = -.1;
      weapons.axe = axe;

      const staff = new THREE.Group();
      const shaft = new THREE.Mesh(this.geometry.staffShaft, staffWood);
      shaft.position.y = -1.34;
      const crystal = new THREE.Mesh(this.geometry.staffCrystal, arcane);
      crystal.position.y = -.18;
      const crown = new THREE.Mesh(this.geometry.staffCrown, arcane);
      crown.position.y = -.2;
      staff.add(shaft, crystal, crown);
      weapons.staff = staff;

      Object.entries(weapons).forEach(([id, weapon]) => {
        weapon.name = `Remote ${id} weapon`;
        weapon.visible = id === "blade";
        rig.add(weapon);
      });
      warden.weapons = weapons;
      return rig;
    }

    createWarden(player) {
      const stableColor = colorFromPlayer(player);
      const color = new THREE.Color(stableColor.value);
      const root = new THREE.Group();
      root.name = `Remote Warden ${player.name || player.id}`;
      const warden = {
        id: player.id,
        root,
        sourcePath: WARDEN_MODEL_PATH,
        fullModel: false,
        fallbackVisible: true,
        accentColor: stableColor.value,
        colorSource: stableColor.source,
        ownedMaterials: new Set(),
        ownedGeometries: new Set(),
        modelMaterials: new Set(),
        modelRoot: null,
        modelMixer: null,
        modelHasClips: false,
        modelActions: {},
        animationSet: [],
        animationState: "idle",
        actionKey: "",
        phase: 0,
        lastX: Number(player.x) || 0,
        lastY: Number(player.y) || 0,
        lastZ: Number(player.z) || 0,
        sampledSpeed: 0,
        verticalSpeed: 0,
        rawVerticalSpeed: 0,
        wasAirborne: Boolean(player.airborne),
        lastAttacking: Boolean(player.attacking),
        attackVariant: 0,
        landingTime: 0,
        currentPlayer: player,
        weapon: "blade"
      };

      warden.fallback = this.createProceduralFallback(warden, color);
      root.add(warden.fallback);
      warden.weaponRig = this.createWeaponRig(warden);
      root.add(warden.weaponRig);

      const capeMaterial = this.ownMaterial(warden, this.material(color.clone().lerp(new THREE.Color(0xffffff), .08), {
        roughness: .92,
        emissive: color,
        emissiveIntensity: .08,
        side: THREE.DoubleSide
      }));
      const cape = new THREE.Mesh(this.geometry.cape, capeMaterial);
      cape.name = "Remote Warden accent cape";
      cape.position.set(0, 1.47, .31);
      cape.rotation.x = -.08;
      cape.castShadow = true;
      root.add(cape);
      warden.cape = cape;

      const shadowMaterial = this.ownMaterial(warden, new THREE.MeshBasicMaterial({ color: 0x020405, transparent: true, opacity: .38, depthWrite: false }));
      const shadow = new THREE.Mesh(this.geometry.shadow, shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = .025;
      root.add(shadow);
      warden.shadow = shadow;
      const markerMaterial = this.ownMaterial(warden, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
      const marker = new THREE.Mesh(this.geometry.marker, markerMaterial);
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = .035;
      root.add(marker);
      warden.marker = marker;
      const nameplate = this.createNameplate(player.name || "WARDEN", color);
      nameplate.position.y = 2.65;
      root.add(nameplate);
      warden.nameplate = nameplate;
      root.position.set(Number(player.x) || 0, Number(player.y) || 0, Number(player.z) || 0);
      root.rotation.y = Number(player.rotation) || 0;
      this.scene.add(root);
      this.wardens.set(player.id, warden);
      this.setWeapon(warden, player.weapon);
      if (sharedWardenSource) this.installFullWarden(warden, sharedWardenSource);
      return warden;
    }

    createNameplate(name, color) {
      const canvas = document.createElement("canvas");
      canvas.width = 384;
      canvas.height = 64;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(2,7,10,.76)";
      context.strokeStyle = `#${color.getHexString()}`;
      context.lineWidth = 2;
      context.beginPath();
      if (typeof context.roundRect === "function") context.roundRect(3, 3, 378, 56, 10);
      else context.rect(3, 3, 378, 56);
      context.fill();
      context.stroke();
      context.fillStyle = "#eef8f6";
      context.font = "600 24px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(name).toUpperCase().slice(0, 24), 192, 32);
      const texture = new THREE.CanvasTexture(canvas);
      texture.encoding = THREE.sRGBEncoding;
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(2.4, .4, 1);
      sprite.userData.disposeRemote = () => {
        texture.dispose();
        material.dispose();
      };
      return sprite;
    }

    installFullWarden(warden, source) {
      if (this.disposed || warden.fullModel || this.wardens.get(warden.id) !== warden) return false;
      if (!THREE.SkeletonUtils?.clone) {
        warden.modelError = "SkeletonUtils unavailable";
        return false;
      }
      let modelRoot;
      try {
        modelRoot = THREE.SkeletonUtils.clone(source.scene);
      } catch (error) {
        warden.modelError = String(error?.message || error);
        return false;
      }
      modelRoot.name = "Hooded Shadow Assassin Warden (remote)";
      modelRoot.scale.setScalar(WARDEN_SCALE);
      modelRoot.position.y = WARDEN_Y_OFFSET;
      modelRoot.rotation.y = Math.PI;
      const accent = new THREE.Color(warden.accentColor);
      const sourceMaterials = new Set();
      source.scene.traverse((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => sourceMaterials.add(material));
      });
      modelRoot.traverse((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        const accentTarget = true;
        const cloneMaterial = (material) => {
          if (!material) return material;
          const clone = material.clone();
          if (accentTarget && clone.color) clone.color.copy(accent).lerp(new THREE.Color(0xffffff), .12);
          if ("roughness" in clone) clone.roughness = Math.max(.48, clone.roughness == null ? .72 : clone.roughness);
          if ("metalness" in clone) clone.metalness = Math.max(.12, clone.metalness || 0);
          if ("envMapIntensity" in clone) clone.envMapIntensity = .42;
          warden.ownedMaterials.add(clone);
          warden.modelMaterials.add(clone);
          return clone;
        };
        object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
      });
      const modelSword = modelRoot.getObjectByName("Warrior_Sword");
      if (modelSword) modelSword.visible = false;
      warden.root.add(modelRoot);
      warden.modelRoot = modelRoot;
      warden.modelMixer = new THREE.AnimationMixer(modelRoot);
      warden.modelHasClips = Boolean(source.animations.length);
      const clip = (pattern, fallback) => source.animations.find((item) => pattern.test(item.name)) || fallback;
      const idle = clip(/^Idle_Weapon$/i, clip(/^Idle$/i, source.animations[0]));
      const walk = clip(/^Walk$/i, idle);
      const run = clip(/^Run_Weapon$/i, clip(/^Run$/i, walk));
      const attack1 = clip(/^Sword_Attack$/i, clip(/Attack/i, idle));
      const attack2 = clip(/^Sword_Attack2$/i, attack1);
      const dodge = clip(/^Roll$/i, idle);
      const death = clip(/^Death$/i, idle);
      const actionClips = {
        idle,
        walk,
        run,
        sprint: run,
        superSprint: run,
        jump: idle,
        fall: idle,
        land: idle,
        slide: idle,
        dodge,
        attack1,
        attack2,
        death
      };
      Object.entries(actionClips).forEach(([id, animation]) => {
        if (animation) warden.modelActions[id] = warden.modelMixer.clipAction(animation);
      });
      warden.animationSet = ["idle", "walk", "run", "sprint", "superSprint", "jump", "fall", "land", "slide", "dodge", "attack", "death"];
      const bone = (name) => modelRoot.getObjectByName(name) || modelRoot.getObjectByName(name.replace(/\./g, ""));
      warden.poseBones = {
        torso: bone("Torso"),
        abdomen: bone("Abdomen"),
        hips: bone("Hips"),
        upperArmL: bone("UpperArm.L"),
        upperArmR: bone("UpperArm.R"),
        lowerArmL: bone("LowerArm.L"),
        lowerArmR: bone("LowerArm.R"),
        upperLegL: bone("UpperLeg.L"),
        upperLegR: bone("UpperLeg.R"),
        lowerLegL: bone("LowerLeg.L"),
        lowerLegR: bone("LowerLeg.R")
      };
      warden.materialIsolation = warden.modelMaterials.size > 0 && [...warden.modelMaterials].every((material) => !sourceMaterials.has(material));
      warden.fallback.visible = false;
      warden.fallbackVisible = false;
      warden.fullModel = true;
      warden.modelError = "";
      this.setModelAction(warden, warden.animationState || "idle", true);
      return true;
    }

    setWeapon(warden, weapon) {
      const id = Object.prototype.hasOwnProperty.call(warden.weapons || {}, weapon) ? weapon : "blade";
      if (warden.weapon === id) return;
      Object.entries(warden.weapons || {}).forEach(([weaponId, model]) => { model.visible = weaponId === id; });
      warden.weapon = id;
    }

    setModelAction(warden, state, force = false) {
      if (!warden.modelMixer) {
        warden.animationState = state;
        return;
      }
      let actionKey = state;
      if (state === "attack") actionKey = warden.attackVariant % 2 ? "attack1" : "attack2";
      const next = warden.modelActions[actionKey] || warden.modelActions.idle;
      if (!next) {
        warden.animationState = state;
        warden.actionKey = actionKey;
        return;
      }
      const sameSemanticState = warden.animationState === state;
      if (!force && sameSemanticState && warden.actionKey === actionKey) return;
      const previous = warden.modelActions[warden.actionKey];
      if (previous && previous !== next) previous.fadeOut(state === "death" ? .08 : .13);
      const oneShot = state === "attack" || state === "dodge" || state === "death";
      if (force || previous !== next || oneShot) next.reset();
      next.enabled = true;
      next.setEffectiveWeight(1);
      next.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
      next.clampWhenFinished = oneShot;
      const timeScale = state === "superSprint" ? 1.42 : state === "sprint" ? 1.24 : state === "run" ? 1.1 : state === "slide" ? .82 : 1;
      next.setEffectiveTimeScale(timeScale);
      next.fadeIn(state === "death" ? .04 : .13).play();
      warden.animationState = state;
      warden.actionKey = actionKey;
    }

    chooseAnimationState(warden, player, dt, moving) {
      const health = Number(player.health);
      if (Number.isFinite(health) && health <= 0) return "death";
      if (player.attacking) return "attack";
      if (player.dodging || player.rolling || Number(player.dodgeTime) > 0) return "dodge";
      if (player.sliding) return "slide";
      if (player.airborne) {
        if (!warden.wasAirborne) return "jump";
        if (warden.rawVerticalSpeed < -.2 || warden.verticalSpeed < -.35) return "fall";
        if (warden.rawVerticalSpeed > .2 || warden.verticalSpeed > .35) return "jump";
        return warden.animationState === "fall" ? "fall" : "jump";
      }
      if (warden.wasAirborne) warden.landingTime = .2;
      warden.landingTime = Math.max(0, warden.landingTime - dt);
      if (warden.landingTime > 0) return "land";
      if (!moving) return "idle";
      if (player.superSprinting) return "superSprint";
      if (player.sprinting) return "sprint";
      return warden.sampledSpeed > 5.4 ? "run" : "walk";
    }

    applyFullModelPose(warden, state, dt) {
      if (!warden.modelRoot) return;
      const bones = warden.poseBones || {};
      const moving = ["walk", "run", "sprint", "superSprint"].includes(state);
      const staticBob = !warden.modelHasClips && moving ? Math.abs(Math.sin(warden.phase * 2)) * (state === "superSprint" ? .11 : state === "sprint" ? .085 : .05) : 0;
      const targetY = WARDEN_Y_OFFSET + (state === "slide" ? -.56 : state === "land" ? -.1 : 0) + staticBob;
      warden.modelRoot.position.y += (targetY - warden.modelRoot.position.y) * (1 - Math.pow(.0005, dt));
      if (!warden.modelHasClips) {
        const sprintWeight = state === "superSprint" ? 1 : state === "sprint" ? .68 : 0;
        const targetX = state === "slide" ? -.54 : state === "jump" ? -.12 : state === "fall" ? .1 : -.18 * sprintWeight;
        const targetZ = moving ? Math.sin(warden.phase) * (.025 + sprintWeight * .035) : 0;
        warden.modelRoot.rotation.x += (targetX - warden.modelRoot.rotation.x) * (1 - Math.pow(.0008, dt));
        warden.modelRoot.rotation.y += (Math.PI - warden.modelRoot.rotation.y) * (1 - Math.pow(.0008, dt));
        warden.modelRoot.rotation.z += (targetZ - warden.modelRoot.rotation.z) * (1 - Math.pow(.0008, dt));
      }
      if (state === "sprint" || state === "superSprint") {
        const weight = state === "superSprint" ? 1 : .68;
        applyLocalRotation(bones.torso, AXIS_X, -.34 * weight);
        applyLocalRotation(bones.abdomen, AXIS_X, -.14 * weight);
        applyLocalRotation(bones.upperArmL, AXIS_X, -.38 * weight);
        applyLocalRotation(bones.upperArmR, AXIS_X, -.38 * weight);
      } else if (state === "slide") {
        applyLocalRotation(bones.torso, AXIS_X, -.62);
        applyLocalRotation(bones.abdomen, AXIS_X, -.24);
        applyLocalRotation(bones.hips, AXIS_X, .32);
        applyLocalRotation(bones.upperLegL, AXIS_X, 1.08);
        applyLocalRotation(bones.upperLegR, AXIS_X, .72);
        applyLocalRotation(bones.lowerLegL, AXIS_X, -1.28);
        applyLocalRotation(bones.lowerLegR, AXIS_X, -.94);
        applyLocalRotation(bones.upperArmL, AXIS_X, -.64);
        applyLocalRotation(bones.upperArmR, AXIS_X, -.48);
      } else if (state === "jump" || state === "fall") {
        const rising = state === "jump";
        applyLocalRotation(bones.torso, AXIS_X, rising ? -.16 : .12);
        applyLocalRotation(bones.upperLegL, AXIS_X, rising ? -.58 : .42);
        applyLocalRotation(bones.upperLegR, AXIS_X, rising ? .76 : -.28);
        applyLocalRotation(bones.lowerLegL, AXIS_X, rising ? .72 : -.52);
        applyLocalRotation(bones.lowerLegR, AXIS_X, rising ? -.42 : .66);
        applyLocalRotation(bones.upperArmL, AXIS_X, -.38);
        applyLocalRotation(bones.upperArmR, AXIS_X, -.22);
      } else if (state === "land") {
        const weight = Math.min(1, warden.landingTime / .2);
        applyLocalRotation(bones.hips, AXIS_X, .16 * weight);
        applyLocalRotation(bones.upperLegL, AXIS_X, .34 * weight);
        applyLocalRotation(bones.upperLegR, AXIS_X, .34 * weight);
        applyLocalRotation(bones.lowerLegL, AXIS_X, -.48 * weight);
        applyLocalRotation(bones.lowerLegR, AXIS_X, -.48 * weight);
      }
    }

    updateFallbackPose(warden, player, moving, state, dt) {
      const pose = warden.fallbackPose;
      if (!pose) return;
      const pace = state === "superSprint" ? 13 : state === "sprint" ? 10 : state === "run" ? 8 : moving ? 6.5 : 2;
      warden.phase += dt * pace;
      const groundLocomotion = moving && !player.airborne && !player.sliding;
      const stride = groundLocomotion ? Math.sin(warden.phase) : 0;
      const strideSize = state === "superSprint" ? .82 : state === "sprint" ? .68 : state === "run" ? .58 : .48;
      pose.leftLeg.rotation.x = stride * strideSize;
      pose.rightLeg.rotation.x = -stride * strideSize;
      pose.leftArm.rotation.x = -stride * strideSize * .68;
      pose.rightArm.rotation.x = stride * strideSize * .45 - (state === "attack" ? .9 : 0);
      pose.body.position.y = state === "slide" ? .47 : player.airborne ? .08 : Math.abs(Math.sin(warden.phase * 2)) * (moving ? .035 : .01);
      pose.body.rotation.x = state === "slide" ? -.9 : state === "superSprint" ? -.17 : state === "sprint" ? -.1 : 0;
      pose.leftLeg.rotation.z = state === "slide" ? -.38 : 0;
      pose.rightLeg.rotation.z = state === "slide" ? .52 : 0;
      if (state === "jump" || state === "fall") {
        pose.leftLeg.rotation.x = state === "jump" ? -.55 : .35;
        pose.rightLeg.rotation.x = state === "jump" ? .35 : -.28;
        pose.leftArm.rotation.x = -.48;
        pose.rightArm.rotation.x = -.4;
      }
    }

    updateWeaponRig(warden, state, dt) {
      const stride = Math.sin(warden.phase);
      let rotationX = (state === "walk" || state === "run" || state === "sprint" || state === "superSprint") ? stride * .34 : 0;
      let rotationZ = 0;
      if (state === "attack") {
        rotationX = -1.1;
        rotationZ = warden.attackVariant % 2 ? -.45 : .45;
      } else if (state === "slide") {
        rotationX = -.48;
        rotationZ = .24;
      } else if (state === "jump" || state === "fall") rotationX = -.4;
      const blend = 1 - Math.pow(.001, dt);
      warden.weaponRig.rotation.x += (rotationX - warden.weaponRig.rotation.x) * blend;
      warden.weaponRig.rotation.z += (rotationZ - warden.weaponRig.rotation.z) * blend;
      const staff = warden.weapons?.staff;
      if (staff) staff.children.forEach((part, index) => { if (index > 0) part.rotation.y += dt * (1.4 + index * .25); });
    }

    updateWarden(warden, player, dt) {
      const frameDt = Math.max(1 / 240, Math.min(.05, Number(dt) || 1 / 60));
      const targetX = Number(player.x) || 0;
      const targetY = Number(player.y) || 0;
      const targetZ = Number(player.z) || 0;
      const sampleDistance = Math.hypot(targetX - warden.lastX, targetZ - warden.lastZ);
      const instantSpeed = sampleDistance / frameDt;
      warden.sampledSpeed += (instantSpeed - warden.sampledSpeed) * (1 - Math.pow(.03, frameDt));
      const instantVertical = (targetY - warden.lastY) / frameDt;
      warden.rawVerticalSpeed = instantVertical;
      warden.verticalSpeed += (instantVertical - warden.verticalSpeed) * (1 - Math.pow(.03, frameDt));
      const distance = Math.hypot(targetX - warden.root.position.x, targetZ - warden.root.position.z);
      const catchup = 1 - Math.pow(distance > 8 ? .00001 : .0015, frameDt);
      warden.root.position.x += (targetX - warden.root.position.x) * catchup;
      warden.root.position.y += (targetY - warden.root.position.y) * catchup;
      warden.root.position.z += (targetZ - warden.root.position.z) * catchup;
      const angle = Number(player.rotation) || 0;
      let delta = angle - warden.root.rotation.y;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      warden.root.rotation.y += delta * (1 - Math.pow(.003, frameDt));
      const moving = Boolean(player.moving) || sampleDistance > .0025 || distance > .025;
      if (player.attacking && !warden.lastAttacking) warden.attackVariant += 1;
      const state = this.chooseAnimationState(warden, player, frameDt, moving);
      this.setModelAction(warden, state, player.attacking && !warden.lastAttacking);
      this.updateFallbackPose(warden, player, moving, state, frameDt);
      this.updateWeaponRig(warden, state, frameDt);
      if (warden.modelMixer) {
        warden.modelMixer.update(frameDt);
        this.applyFullModelPose(warden, state, frameDt);
      }
      warden.cape.rotation.x = -.08 - (moving ? .18 : 0) - (state === "superSprint" ? .32 : 0) + (state === "slide" ? -.24 : 0);
      warden.cape.rotation.z = Math.sin(warden.phase * .72) * (moving ? .08 : .025);
      warden.marker.material.opacity = player.connected === false ? .12 : .48;
      warden.shadow.material.opacity = player.airborne ? .18 : .38;
      const health = Number(player.health);
      const maximum = Math.max(1, Number(player.maxHealth) || 1);
      const healthRatio = Number.isFinite(health) ? Math.max(0, Math.min(1, health / maximum)) : 1;
      warden.marker.scale.setScalar(.82 + healthRatio * .18);
      warden.root.visible = player.connected !== false;
      warden.currentPlayer = player;
      warden.lastX = targetX;
      warden.lastY = targetY;
      warden.lastZ = targetZ;
      warden.wasAirborne = Boolean(player.airborne);
      warden.lastAttacking = Boolean(player.attacking);
      this.setWeapon(warden, player.weapon);
    }

    sync(players, dt = 1 / 60) {
      const active = new Set();
      for (const player of players || []) {
        if (!player?.id) continue;
        active.add(player.id);
        const warden = this.wardens.get(player.id) || this.createWarden(player);
        this.updateWarden(warden, player, dt);
      }
      for (const [id, warden] of this.wardens) if (!active.has(id)) this.removeWarden(warden);
      return this.wardens.size;
    }

    removeWarden(warden) {
      if (!warden) return;
      this.scene.remove(warden.root);
      warden.nameplate?.userData.disposeRemote?.();
      if (warden.modelMixer && warden.modelRoot) {
        warden.modelMixer.stopAllAction();
        warden.modelMixer.uncacheRoot(warden.modelRoot);
      }
      warden.ownedMaterials.forEach(disposeMaterial);
      warden.ownedGeometries.forEach((geometry) => geometry.dispose());
      warden.ownedMaterials.clear();
      warden.ownedGeometries.clear();
      this.wardens.delete(warden.id);
    }

    clear() {
      for (const warden of [...this.wardens.values()]) this.removeWarden(warden);
    }

    debug() {
      return {
        asset: {
          path: WARDEN_MODEL_PATH,
          status: sharedWardenStatus,
          error: sharedWardenError,
          animations: sharedWardenSource?.animations?.map((clip) => clip.name) || []
        },
        wardens: [...this.wardens.values()].map((warden) => ({
          id: warden.id,
          sourcePath: warden.sourcePath,
          fullModel: warden.fullModel,
          fallbackVisible: warden.fallbackVisible,
          accentColor: warden.accentColor,
          colorSource: warden.colorSource,
          animationState: warden.animationState,
          animationSet: [...warden.animationSet],
          isolatedMaterials: Boolean(warden.materialIsolation),
          weapon: warden.weapon,
          modelScale: warden.fullModel ? WARDEN_SCALE : null,
          modelError: warden.modelError || ""
        }))
      };
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.clear();
      Object.values(this.geometry).forEach((geometry) => geometry.dispose());
      ACTIVE_RENDERERS.delete(this);
    }

    static debug() {
      const wardens = [];
      for (const renderer of ACTIVE_RENDERERS) wardens.push(...renderer.debug().wardens);
      return {
        asset: {
          path: WARDEN_MODEL_PATH,
          status: sharedWardenStatus,
          error: sharedWardenError,
          animations: sharedWardenSource?.animations?.map((clip) => clip.name) || []
        },
        renderers: ACTIVE_RENDERERS.size,
        wardens
      };
    }
  }

  window.AshenholdRemoteWardens = RemoteWardenRenderer;
})();

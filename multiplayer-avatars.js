(() => {
  "use strict";

  class RemoteWardenRenderer {
    constructor(scene) {
      if (!window.THREE || !scene) throw new Error("RemoteWardenRenderer requires THREE and a scene.");
      this.scene = scene;
      this.wardens = new Map();
      this.geometry = {
        torso: new THREE.CylinderGeometry(.31, .24, .82, 8),
        shoulder: new THREE.SphereGeometry(.18, 7, 5),
        limb: new THREE.CylinderGeometry(.105, .085, .62, 7),
        boot: new THREE.BoxGeometry(.2, .19, .36),
        head: new THREE.SphereGeometry(.2, 9, 7),
        hood: new THREE.ConeGeometry(.28, .42, 8, 1, true),
        blade: new THREE.BoxGeometry(.055, .88, .035),
        hilt: new THREE.BoxGeometry(.34, .055, .075),
        cape: new THREE.PlaneGeometry(.64, .94, 1, 3),
        shadow: new THREE.CircleGeometry(.58, 24),
        marker: new THREE.RingGeometry(.56, .62, 32)
      };
    }

    material(color, options = {}) {
      return new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? .68,
        metalness: options.metalness ?? .08,
        emissive: options.emissive || 0x000000,
        emissiveIntensity: options.emissiveIntensity || 0,
        transparent: Boolean(options.transparent),
        opacity: options.opacity ?? 1,
        side: options.side
      });
    }

    createWarden(player) {
      const color = new THREE.Color(player.color || "#69d5e6");
      const root = new THREE.Group();
      root.name = `Remote Warden ${player.name || player.id}`;
      const body = new THREE.Group();
      root.add(body);
      const armor = this.material(color.clone().multiplyScalar(.62), { roughness: .48, metalness: .42 });
      const accent = this.material(color, { emissive: color, emissiveIntensity: .35, roughness: .35, metalness: .25 });
      const cloth = this.material(color.clone().multiplyScalar(.24), { roughness: .94 });
      const leather = this.material(0x211b19, { roughness: .92 });
      const skin = this.material(0xc58f70, { roughness: .88 });
      const steel = this.material(0xbad8dc, { roughness: .22, metalness: .86, emissive: color, emissiveIntensity: .16 });

      const torso = new THREE.Mesh(this.geometry.torso, armor);
      torso.position.y = 1.45;
      torso.castShadow = true;
      body.add(torso);
      const belt = new THREE.Mesh(new THREE.BoxGeometry(.53, .11, .35), leather);
      belt.position.y = 1.11;
      body.add(belt);
      const chestRune = new THREE.Mesh(new THREE.OctahedronGeometry(.09, 0), accent);
      chestRune.position.set(0, 1.53, -.29);
      chestRune.rotation.z = Math.PI / 4;
      body.add(chestRune);

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

      const sword = new THREE.Group();
      const blade = new THREE.Mesh(this.geometry.blade, steel);
      blade.position.y = -.48;
      const hilt = new THREE.Mesh(this.geometry.hilt, accent);
      sword.add(blade, hilt);
      sword.position.set(.02, -.5, -.05);
      sword.rotation.z = -.18;
      rightArm.add(sword);

      const cape = new THREE.Mesh(this.geometry.cape, cloth);
      cape.position.set(0, 1.48, .27);
      cape.rotation.x = -.08;
      body.add(cape);

      const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x020405, transparent: true, opacity: .38, depthWrite: false });
      const shadow = new THREE.Mesh(this.geometry.shadow, shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = .025;
      root.add(shadow);
      const markerMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false });
      const marker = new THREE.Mesh(this.geometry.marker, markerMaterial);
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = .035;
      root.add(marker);
      const nameplate = this.createNameplate(player.name || "WARDEN", color);
      nameplate.position.y = 2.65;
      root.add(nameplate);
      root.position.set(Number(player.x) || 0, Number(player.y) || 0, Number(player.z) || 0);
      root.rotation.y = Number(player.rotation) || 0;
      this.scene.add(root);
      const record = { id: player.id, root, body, torso, cape, leftArm, rightArm, leftLeg, rightLeg, sword, marker, shadow, nameplate, materials: [armor, accent, cloth, leather, skin, steel, shadowMaterial, markerMaterial], phase: Math.random() * Math.PI * 2, lastX: root.position.x, lastZ: root.position.z };
      this.wardens.set(player.id, record);
      return record;
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
      context.roundRect(3, 3, 378, 56, 10);
      context.fill(); context.stroke();
      context.fillStyle = "#eef8f6";
      context.font = "600 24px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(name).toUpperCase().slice(0, 24), 192, 32);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(2.4, .4, 1);
      sprite.userData.disposeRemote = () => { texture.dispose(); material.dispose(); };
      return sprite;
    }

    updateWarden(warden, player, dt) {
      const targetX = Number(player.x) || 0;
      const targetY = Number(player.y) || 0;
      const targetZ = Number(player.z) || 0;
      const distance = Math.hypot(targetX - warden.root.position.x, targetZ - warden.root.position.z);
      const catchup = 1 - Math.pow(distance > 8 ? .00001 : .0015, Math.min(.05, dt));
      warden.root.position.x += (targetX - warden.root.position.x) * catchup;
      warden.root.position.y += (targetY - warden.root.position.y) * catchup;
      warden.root.position.z += (targetZ - warden.root.position.z) * catchup;
      let angle = Number(player.rotation) || 0;
      let delta = angle - warden.root.rotation.y;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      warden.root.rotation.y += delta * (1 - Math.pow(.003, Math.min(.05, dt)));
      const moving = Boolean(player.moving) || distance > .025;
      const pace = player.superSprinting ? 13 : player.sprinting ? 10 : moving ? 6.5 : 2;
      warden.phase += dt * pace;
      const stride = moving && !player.airborne && !player.sliding ? Math.sin(warden.phase) : 0;
      const strideSize = player.superSprinting ? .82 : player.sprinting ? .68 : .48;
      warden.leftLeg.rotation.x = stride * strideSize;
      warden.rightLeg.rotation.x = -stride * strideSize;
      warden.leftArm.rotation.x = -stride * strideSize * .68;
      warden.rightArm.rotation.x = stride * strideSize * .45 - (player.attacking ? .9 : 0);
      warden.body.position.y = player.sliding ? .47 : player.airborne ? .08 : Math.abs(Math.sin(warden.phase * 2)) * (moving ? .035 : .01);
      warden.body.rotation.x = player.sliding ? -.9 : player.superSprinting ? -.17 : player.sprinting ? -.1 : 0;
      warden.leftLeg.rotation.z = player.sliding ? -.38 : 0;
      warden.rightLeg.rotation.z = player.sliding ? .52 : 0;
      if (player.airborne) {
        warden.leftLeg.rotation.x = -.55;
        warden.rightLeg.rotation.x = .35;
        warden.leftArm.rotation.x = -.48;
        warden.rightArm.rotation.x = -.4;
      }
      warden.cape.rotation.x = -.08 - (moving ? .18 : 0) - (player.superSprinting ? .32 : 0);
      warden.cape.rotation.z = Math.sin(warden.phase * .72) * (moving ? .08 : .025);
      warden.marker.material.opacity = player.connected === false ? .12 : .48;
      warden.shadow.material.opacity = player.airborne ? .18 : .38;
      const healthRatio = Math.max(0, Math.min(1, Number(player.health || 0) / Math.max(1, Number(player.maxHealth || 1))));
      warden.marker.scale.setScalar(.82 + healthRatio * .18);
      warden.root.visible = player.connected !== false;
      warden.lastX = targetX; warden.lastZ = targetZ;
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
      this.scene.remove(warden.root);
      warden.nameplate.userData.disposeRemote?.();
      warden.materials.forEach((material) => material.dispose());
      this.wardens.delete(warden.id);
    }

    clear() {
      for (const warden of [...this.wardens.values()]) this.removeWarden(warden);
    }

    dispose() {
      this.clear();
      Object.values(this.geometry).forEach((geometry) => geometry.dispose());
    }
  }

  window.AshenholdRemoteWardens = RemoteWardenRenderer;
})();

(function () {
  "use strict";

  const api = window.__ASHENHOLD_ADMIN__;
  if (!api || !api.isLocal || !/^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(window.location.hostname)) return;

  const DRAFT_KEY = "ashenhold-admin-draft-v1";
  const state = {
    tab: "scene", selectedId: null, category: "All", search: "", panelCollapsed: false,
    pointerMode: null, pointerId: null, dragAxis: null,
    startX: 0, startY: 0, lastX: 0, lastY: 0,
    bridge: { connected: false, token: "", publishEnabled: false, branch: "", dirty: false },
    renderQueued: false, draftAvailable: false
  };

  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const rounded = (value, digits) => Number(finite(value, 0).toFixed(digits == null ? 2 : digits));
  const byId = (id) => document.getElementById(id);

  function button(id, label, options) {
    const config = options || {};
    return `<button type="button" id="${id}" class="${config.className || ""}"${config.title ? ` title="${escapeHtml(config.title)}"` : ""}${config.pressed != null ? ` aria-pressed="${config.pressed}"` : ""}${config.disabled ? " disabled" : ""}>${config.icon ? `<span aria-hidden="true">${config.icon}</span>` : ""}<b>${label}</b>${config.key ? `<kbd>${config.key}</kbd>` : ""}</button>`;
  }

  function field(id, label, value, options) {
    const config = options || {};
    const attrs = [
      `id="${id}"`, `type="${config.type || "number"}"`, `value="${escapeHtml(value)}"`,
      config.step != null ? `step="${config.step}"` : "", config.min != null ? `min="${config.min}"` : "",
      config.max != null ? `max="${config.max}"` : "", config.disabled ? "disabled" : ""
    ].filter(Boolean).join(" ");
    return `<label class="admin-field ${config.className || ""}"><span>${label}</span><input ${attrs}></label>`;
  }

  const shell = document.createElement("div");
  shell.id = "ashenholdAdmin";
  shell.className = "ashenhold-admin";
  shell.innerHTML = `
    <div class="admin-modebar" role="toolbar" aria-label="Sandbox controls">
      ${button("adminModeSelect", "Warden", { icon: "◇", key: "V", pressed: false, title: "Return the Warden to the freecam position" })}
      ${button("adminModeFreecam", "Freecam", { icon: "◎", key: "F", pressed: true })}
      ${button("adminModeNoclip", "Noclip", { icon: "↟", key: "N", pressed: false })}
      <i></i>
      ${button("adminToolMove", "Move", { icon: "↔", key: "G", pressed: true })}
      ${button("adminToolRotate", "Rotate", { icon: "↻", key: "R", pressed: false })}
      ${button("adminToolScale", "Scale", { icon: "⌁", key: "X", pressed: false, title: "Scale while flying; S remains backward movement" })}
      <i></i>
      <button type="button" id="adminPauseSimulation" class="admin-sim active" aria-pressed="true"><span class="admin-pulse"></span><b>Simulation paused</b></button>
    </div>
    <aside class="admin-panel" aria-label="Ashenhold world editor">
      <header class="admin-header">
        <div class="admin-mark"><span>A</span></div>
        <div><small>LOCAL SANDBOX</small><h1>ASHENHOLD FORGE</h1></div>
        <button type="button" id="adminCollapse" aria-label="Collapse editor" title="Collapse editor (backtick)">›</button>
      </header>
      <div class="admin-connection"><span id="adminBridgeDot"></span><b id="adminBridgeText">Export-only mode</b><small id="adminRevision">Revision 0</small></div>
      <nav class="admin-tabs" aria-label="Editor panels">
        <button type="button" data-admin-tab="scene" class="active">Scene</button>
        <button type="button" data-admin-tab="appearance">Look</button>
        <button type="button" data-admin-tab="world">World</button>
        <button type="button" data-admin-tab="combat">Combat</button>
        <button type="button" data-admin-tab="data">Publish</button>
      </nav>
      <main id="adminPanelBody" class="admin-panel-body"></main>
      <footer class="admin-footer"><span><kbd>LMB</kbd> edit/look</span><span><kbd>RMB</kbd> look</span><span><kbd>WASD</kbd> move</span><span><kbd>Q/E</kbd> down/up</span><span><kbd>Shift</kbd> boost</span><span><kbd>Ctrl Z</kbd> undo</span></footer>
    </aside>
    <button type="button" id="adminExpand" class="admin-expand" aria-label="Open Ashenhold Forge">A</button>
    <div id="adminToast" class="admin-toast" role="status" aria-live="polite"></div>
  `;
  document.body.appendChild(shell);

  function toast(message, tone) {
    const node = byId("adminToast");
    node.textContent = message;
    node.dataset.tone = tone || "info";
    node.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove("show"), 2600);
  }

  function setTab(tab) {
    state.tab = tab;
    shell.querySelectorAll("[data-admin-tab]").forEach((node) => node.classList.toggle("active", node.dataset.adminTab === tab));
    renderBody();
  }

  function setMode(mode) {
    finishPointerInteraction();
    api.controls.setMode(mode);
    ["select", "freecam", "noclip"].forEach((id) => {
      const node = byId("adminMode" + id.charAt(0).toUpperCase() + id.slice(1));
      if (node) node.setAttribute("aria-pressed", String(id === mode));
    });
    toast(mode === "freecam"
      ? "Freecam: click to edit · drag to look · WASD + Q/E to fly"
      : mode === "noclip" ? "Noclip: the Warden starts at the freecam position"
        : "Warden placed at the freecam position");
  }

  function setTransformMode(mode) {
    api.setTransformMode(mode);
    ["Move", "Rotate", "Scale"].forEach((label) => {
      const node = byId("adminTool" + label);
      if (node) node.setAttribute("aria-pressed", String(label.toLowerCase() === (mode === "translate" ? "move" : mode)));
    });
  }

  function selected() {
    return state.selectedId ? api.getEntity(state.selectedId) : null;
  }

  function categoryOptions(entities) {
    const categories = Array.from(new Set(entities.map((entity) => entity.category))).sort();
    return ["All"].concat(categories).map((category) => `<option value="${escapeHtml(category)}"${category === state.category ? " selected" : ""}>${escapeHtml(category)}</option>`).join("");
  }

  function entityListMarkup(entities) {
    const search = state.search.trim().toLowerCase();
    const filtered = entities.filter((entity) => (state.category === "All" || entity.category === state.category)
      && (!search || entity.label.toLowerCase().includes(search) || entity.id.toLowerCase().includes(search) || String(entity.modelSlot || "").toLowerCase().includes(search)));
    const grouped = filtered.reduce((output, entity) => {
      (output[entity.category] || (output[entity.category] = [])).push(entity);
      return output;
    }, {});
    if (!filtered.length) return `<div class="admin-empty">No objects match this filter.</div>`;
    return Object.keys(grouped).sort().map((category) => `
      <section class="admin-tree-group">
        <h3>${escapeHtml(category)} <span>${grouped[category].length}</span></h3>
        ${grouped[category].map((entity) => `
          <button type="button" class="admin-tree-item${entity.id === state.selectedId ? " selected" : ""}${entity.visible ? "" : " hidden"}" data-entity-id="${escapeHtml(entity.id)}">
            <i class="admin-type-${escapeHtml(entity.type)}"></i><span><b>${escapeHtml(entity.label)}</b><small>${escapeHtml(entity.modelSlot || entity.type)} · ${escapeHtml(entity.id)}</small></span><em>${entity.visible ? "●" : "○"}</em>
          </button>`).join("")}
      </section>`).join("");
  }

  function transformMarkup(entity) {
    if (!entity) return `<div class="admin-empty tall"><span>◇</span><b>Nothing selected</b><p>Click a model in the world or choose one from the scene hierarchy.</p></div>`;
    const transform = entity.transform;
    const lifecycleLocked = !entity.canHide && !entity.canRemove;
    const lifecycleTitle = "Gameplay-owned entities cannot be hidden or removed because their interaction, AI, or progression state remains authoritative.";
    return `
      <section class="admin-card admin-selected-card">
        <div class="admin-object-heading"><div><small>${escapeHtml(entity.type)} · ${escapeHtml(entity.id)}</small><h2>${escapeHtml(entity.label)}</h2></div><button type="button" id="adminFocus">Frame</button></div>
        <div class="admin-object-meta"><span>${entity.meshCount} meshes</span><span>${rounded(entity.size.x, 1)} × ${rounded(entity.size.y, 1)} × ${rounded(entity.size.z, 1)}m</span><span>${entity.collision ? "Collision on" : "No collision"}</span></div>
      </section>
      <section class="admin-card">
        <div class="admin-section-title"><div><small>TRANSFORM</small><h2>Position & shape</h2></div><span class="admin-axis-legend"><i>X</i><i>Y</i><i>Z</i></span></div>
        <div class="admin-vector-row"><b>Position</b>${field("adminPosX", "X", rounded(transform.position.x, 3), { step: .1 })}${field("adminPosY", "Y", rounded(transform.position.y, 3), { step: .1 })}${field("adminPosZ", "Z", rounded(transform.position.z, 3), { step: .1 })}</div>
        <div class="admin-vector-row"><b>Rotation</b>${field("adminRotY", "Y°", rounded(transform.rotationY * 180 / Math.PI, 2), { step: 1 })}<span></span><span></span></div>
        <div class="admin-vector-row"><b>Scale</b>${field("adminScaleX", "X", rounded(transform.scale.x, 4), { step: .05, min: .02 })}${field("adminScaleY", "Y", rounded(transform.scale.y, 4), { step: .05, min: .02 })}${field("adminScaleZ", "Z", rounded(transform.scale.z, 4), { step: .05, min: .02 })}</div>
        <div class="admin-inline-actions">${button("adminApplyTransform", "Apply")}${button("adminGround", "Drop to ground")}${button("adminResetTransform", "Reset")}</div>
      </section>
      <section class="admin-card admin-grid-settings">
        <div class="admin-section-title"><div><small>PRECISION</small><h2>Snapping</h2></div></div>
        <div class="admin-three-fields">${field("adminSnapMove", "Move", 1, { step: .1, min: 0 })}${field("adminSnapRotate", "Rotate °", 15, { step: 1, min: 0 })}${field("adminSnapScale", "Scale", .1, { step: .05, min: 0 })}</div>
      </section>
      <section class="admin-card admin-danger-zone">
        <div class="admin-two-actions">${button("adminDuplicate", "Duplicate", { icon: "＋" })}${button("adminToggleVisible", entity.visible ? "Hide" : "Show", { icon: entity.visible ? "◉" : "○", disabled: !entity.canHide, title: !entity.canHide ? lifecycleTitle : "" })}</div>
        <div class="admin-two-actions">${button("adminToggleCollision", entity.collision ? "Disable collision" : "Enable collision")}${button("adminDelete", "Remove", { className: "danger", disabled: !entity.canRemove, title: !entity.canRemove ? lifecycleTitle : "" })}</div>
        ${lifecycleLocked ? `<div class="admin-note"><b>Gameplay object protected</b><p>Chests, enemies, dragons, and location groups keep authoritative gameplay state, so Forge locks Hide and Remove. Edit their supported transform, appearance, collision, or tuning fields instead.</p></div>` : ""}
      </section>`;
  }

  function renderScene() {
    const entities = api.listEntities();
    return `
      <section class="admin-scene-tools">
        <label class="admin-search"><span>⌕</span><input id="adminSearch" type="search" value="${escapeHtml(state.search)}" placeholder="Search objects, IDs, models"></label>
        <select id="adminCategory" aria-label="Object category">${categoryOptions(entities)}</select>
      </section>
      <div class="admin-scene-split"><div id="adminEntityTree" class="admin-tree">${entityListMarkup(entities)}</div><div id="adminTransformInspector" class="admin-inspector">${transformMarkup(selected())}</div></div>
      <section class="admin-card admin-add-object">
        <div class="admin-section-title"><div><small>ASSET LIBRARY</small><h2>Place a model</h2></div></div>
        <div class="admin-select-action"><select id="adminAddModel">${modelOptions("")}</select>${button("adminAddModelButton", "Add at camera", { icon: "+" })}</div>
      </section>`;
  }

  function modelOptions(selectedId) {
    return api.modelCatalog().map((model) => `<option value="${escapeHtml(model.id)}"${model.id === selectedId ? " selected" : ""}>${escapeHtml(model.id)} — ${escapeHtml(model.metric && model.metric.role || model.path.split("/").pop())}</option>`).join("");
  }

  function renderAppearance() {
    const entity = selected();
    if (!entity) return `<div class="admin-empty tall"><span>◈</span><b>Select an object first</b><p>Appearance controls apply to the selected scene object.</p></div>`;
    const textures = api.textureCatalog();
    return `
      <section class="admin-card admin-selected-card">
        <div class="admin-object-heading"><div><small>APPEARANCE</small><h2>${escapeHtml(entity.label)}</h2></div><input class="admin-swatch" type="color" value="${escapeHtml(entity.color || "#ffffff")}" aria-label="Current material color" disabled></div>
        <div class="admin-object-meta"><span>${escapeHtml(entity.material)}</span><span>${entity.meshCount} meshes</span><span>${entity.textures.length} texture maps</span></div>
      </section>
      <section class="admin-card">
        <div class="admin-section-title"><div><small>MATERIAL TINT</small><h2>Color</h2></div><p>Applies a clear tint to every material on this object.</p></div>
        <div class="admin-color-row"><input id="adminColor" type="color" value="${escapeHtml(entity.color || "#ffffff")}"><input id="adminColorText" value="${escapeHtml(entity.color || "#ffffff")}" maxlength="7">${button("adminApplyColor", "Apply color")}</div>
      </section>
      <section class="admin-card">
        <div class="admin-section-title"><div><small>TEXTURE MAP</small><h2>Inspect or replace</h2></div><p>Only same-origin files under <code>assets/</code> are accepted.</p></div>
        <div class="admin-current-textures">${entity.textures.length ? entity.textures.map((texture) => `<code>${escapeHtml(texture)}</code>`).join("") : `<span>No texture map detected.</span>`}</div>
        <select id="adminTexturePreset"><option value="">Choose a known texture…</option>${textures.map((texture) => `<option value="${escapeHtml(texture)}"${texture === entity.texture ? " selected" : ""}>${escapeHtml(texture)}</option>`).join("")}</select>
        <div class="admin-select-action"><input id="adminTexturePath" value="${escapeHtml(entity.texture || "")}" placeholder="assets/textures/…">${button("adminApplyTexture", "Replace")}</div>
      </section>
      <section class="admin-card${entity.modelSlot ? "" : " disabled"}">
        <div class="admin-section-title"><div><small>MODEL SLOT</small><h2>Swap geometry</h2></div><p>Preserves the object transform and fits the replacement to its current bounds.</p></div>
        <div class="admin-select-action"><select id="adminReplaceModel"${entity.modelSlot ? "" : " disabled"}>${modelOptions(entity.modelSlot || "")}</select>${button("adminReplaceModelButton", "Replace", { className: entity.modelSlot ? "" : "disabled" })}</div>
      </section>`;
  }

  function renderWorld() {
    const biomes = api.biomes();
    const active = biomes.find((item) => item.id === (byId("adminBiome") && byId("adminBiome").value)) || biomes[0];
    return `
      <section class="admin-card">
        <div class="admin-section-title"><div><small>ONE AUTHORED CONTINENT</small><h2>Biome art direction</h2></div><p>Density changes preview within current instance capacity and fully rebuild on reload.</p></div>
        <select id="adminBiome">${biomes.map((item) => `<option value="${item.id}"${item.id === active.id ? " selected" : ""}>${escapeHtml(item.name)}${item.treeless ? " · TREELESS" : ""}</option>`).join("")}</select>
      </section>
      <section class="admin-card" id="adminBiomeFields">${biomeFieldsMarkup(active)}</section>
      <section class="admin-note"><b>Density safety</b><p>Ember Dunes remains hard-locked to zero trees. Increasing above the current generated capacity takes effect after Save + Reload so instancing stays stable.</p></section>`;
  }

  function biomeFieldsMarkup(biome) {
    return `
      <div class="admin-section-title"><div><small>${escapeHtml(biome.id.toUpperCase())}</small><h2>Palette & atmosphere</h2></div></div>
      <div class="admin-color-grid">
        <label><span>Ground</span><input id="biomeGround" type="color" value="${biome.ground}"></label>
        <label><span>Cliff</span><input id="biomeCliff" type="color" value="${biome.cliff}"></label>
        <label><span>Grass</span><input id="biomeGrass" type="color" value="${biome.grass}"></label>
        <label><span>Fog</span><input id="biomeFog" type="color" value="${biome.fog}"></label>
      </div>
      <div class="admin-density-grid">
        ${rangeField("biomeTrees", "Tree density", biome.treeDensity, 0, 3, .05, biome.treeless)}
        ${rangeField("biomeProps", "Prop density", biome.propDensity, 0, 3, .05)}
        ${rangeField("biomeGrassDensity", "Grass density", biome.grassDensity, 0, 3, .05)}
        ${rangeField("biomeFogDensity", "Fog density", biome.fogDensity, 0, .025, .0001)}
        ${rangeField("biomeExposure", "Exposure", biome.exposure, .15, 4, .05)}
      </div>
      ${button("adminApplyBiome", "Apply live", { className: "primary wide" })}`;
  }

  function rangeField(id, label, value, min, max, step, disabled) {
    return `<label class="admin-range"><span><b>${label}</b><output id="${id}Output">${rounded(value, 4)}</output></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"${disabled ? " disabled" : ""}></label>`;
  }

  function renderCombat() {
    const profiles = api.enemyProfiles();
    const scope = byId("adminEnemyScope") && byId("adminEnemyScope").value || "global";
    const values = scope === "global" ? profiles.document.global || {} : profiles.document.byKind[scope] || {};
    const enemy = selected() && selected().enemy;
    const multiplier = (field) => values[field] == null ? 1 : values[field];
    return `
      <section class="admin-card">
        <div class="admin-section-title"><div><small>ENEMY ARCHETYPE</small><h2>Combat tuning</h2></div><p>Multipliers apply immediately and persist for future spawns.</p></div>
        <select id="adminEnemyScope"><option value="global"${scope === "global" ? " selected" : ""}>All enemies · global</option>${["biomeLight", "biomeHeavy", "warg", "golem", "dragon"].map((kind) => `<option value="${kind}"${scope === kind ? " selected" : ""}>${kind}</option>`).join("")}</select>
        <div class="admin-multiplier-grid">
          ${field("enemyHealthMultiplier", "Health ×", multiplier("health"), { step: .05, min: .05, max: 10 })}
          ${field("enemyDamageMultiplier", "Damage ×", multiplier("damage"), { step: .05, min: .05, max: 10 })}
          ${field("enemySpeedMultiplier", "Move speed ×", multiplier("speed"), { step: .05, min: .05, max: 10 })}
          ${field("enemyRangeMultiplier", "Attack radius ×", multiplier("attackRange"), { step: .05, min: .05, max: 10 })}
          ${field("enemySightMultiplier", "Sight line ×", multiplier("sightRange"), { step: .05, min: .05, max: 10 })}
          ${field("enemyTrackingMultiplier", "Tracking ×", multiplier("tracking"), { step: .05, min: .05, max: 10 })}
          ${field("enemyRateMultiplier", "Attack rate ×", multiplier("attackRate"), { step: .05, min: .05, max: 10 })}
        </div>
        ${button("adminApplyEnemyProfile", "Apply archetype tuning", { className: "primary wide" })}
      </section>
      ${enemy ? `
      <section class="admin-card">
        <div class="admin-section-title"><div><small>SELECTED INSTANCE · ${escapeHtml(enemy.kind)}</small><h2>${escapeHtml(selected().label)}</h2></div><span class="admin-state-pill">${escapeHtml(enemy.state)}</span></div>
        <div class="admin-multiplier-grid">
          ${field("enemyInstanceHealth", "Current health", rounded(enemy.health, 1), { step: 1, min: 0 })}
          ${field("enemyInstanceMaxHealth", "Maximum health", rounded(enemy.maxHealth, 1), { step: 1, min: 1 })}
          ${field("enemyInstanceDamage", "Damage", rounded(enemy.damage, 2), { step: 1, min: 0 })}
          ${field("enemyInstanceSpeed", "Move speed", rounded(enemy.speed, 2), { step: .1, min: 0 })}
          ${field("enemyInstanceRange", "Attack radius", rounded(enemy.attackRange, 2), { step: .1, min: .1 })}
          ${field("enemyInstanceInterval", "Attack interval", rounded(enemy.attackInterval, 2), { step: .05, min: .05 })}
          ${field("enemyInstanceSight", "Sight range", rounded(enemy.sightRange, 2), { step: 1, min: .1 })}
          ${field("enemyInstanceTracking", "Tracking", rounded(enemy.tracking, 2), { step: .05, min: .05, max: 10 })}
        </div>
        ${button("adminApplyEnemyInstance", "Apply to selected enemy", { className: "wide" })}
      </section>` : `<div class="admin-note"><b>Instance editor</b><p>Select a sentry, beast, golem, or dragon in the Scene tab to set exact values on that actor.</p></div>`}`;
  }

  function renderData() {
    const info = api.info();
    const validation = api.validate();
    const draft = state.draftAvailable ? `<button type="button" id="adminRestoreDraft" class="admin-draft">Restore browser draft</button>` : "";
    return `
      <section class="admin-card admin-publish-status">
        <div class="admin-section-title"><div><small>LOCAL SAVE BRIDGE</small><h2>${state.bridge.connected ? "Repository connected" : "Export-only mode"}</h2></div><span class="admin-status-dot ${state.bridge.connected ? "online" : ""}"></span></div>
        <p>${state.bridge.connected ? `Branch <code>${escapeHtml(state.bridge.branch || "unknown")}</code>. ${state.bridge.publishEnabled ? "Publishing is unlocked for this bridge session." : "Save is available; publishing is locked by the server launch flags."}` : "Run open-admin-editor.cmd to enable repository writes. A regular static server can still export JSON and source files."}</p>
        ${draft}
        <div class="admin-metric-row"><span><b>${validation.entities}</b> scene entities</span><span><b>${validation.overrides}</b> overrides</span><span><b>${validation.colliders}</b> colliders</span><span><b>${info.history.length}</b> history states</span></div>
      </section>
      <section class="admin-card">
        <div class="admin-section-title"><div><small>VALIDATION</small><h2>${validation.valid ? "Ready to save" : "Fix errors before publish"}</h2></div><span class="admin-validation ${validation.valid ? "valid" : "invalid"}">${validation.valid ? "PASS" : "BLOCKED"}</span></div>
        <div class="admin-issues">${validation.issues.length ? validation.issues.map((issue) => `<div class="${issue.severity}"><b>${escapeHtml(issue.severity)}</b><span>${escapeHtml(issue.message)}</span><code>${escapeHtml(issue.id)}</code></div>`).join("") : `<p>No bounds, asset-slot, waterline, or transform errors found.</p>`}</div>
        ${button("adminRunValidation", "Run validation again", { className: "wide" })}
      </section>
      <section class="admin-card">
        <div class="admin-section-title"><div><small>PORTABLE OUTPUT</small><h2>Export & import</h2></div><p>JSON is editor data. Source export is a ready-to-use <code>world-overrides.js</code>.</p></div>
        <div class="admin-two-actions">${button("adminCopyJson", "Copy JSON")}${button("adminDownloadJson", "Download JSON")}</div>
        <div class="admin-two-actions">${button("adminDownloadSource", "Export source file")}${button("adminImportButton", "Import JSON")}</div>
        <input id="adminImportFile" type="file" accept="application/json,.json" hidden>
      </section>
      <section class="admin-card admin-publish-actions">
        ${button("adminSaveRepo", "Save to repository", { className: "primary wide" })}
        ${button("adminPublishLive", "Publish live", { className: `publish wide${state.bridge.publishEnabled ? "" : " disabled"}` })}
        <p>The publish action validates, writes only <code>world-overrides.js</code>, creates one Git commit, and pushes through the configured main branch. It never embeds a GitHub credential in the browser.</p>
      </section>`;
  }

  function renderBody() {
    const body = byId("adminPanelBody");
    const scroll = body.scrollTop;
    if (state.tab === "scene") body.innerHTML = renderScene();
    else if (state.tab === "appearance") body.innerHTML = renderAppearance();
    else if (state.tab === "world") body.innerHTML = renderWorld();
    else if (state.tab === "combat") body.innerHTML = renderCombat();
    else body.innerHTML = renderData();
    bindBodyEvents();
    body.scrollTop = scroll;
    refreshHeader();
  }

  function scheduleRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => { state.renderQueued = false; renderBody(); });
  }

  function refreshHeader() {
    const info = api.info();
    byId("adminRevision").textContent = `Revision ${info.revision}`;
    byId("adminBridgeDot").classList.toggle("online", state.bridge.connected);
    byId("adminBridgeText").textContent = state.bridge.connected ? `Bridge · ${state.bridge.branch || "repository"}` : "Export-only mode";
    const pause = byId("adminPauseSimulation");
    pause.classList.toggle("active", info.simulationPaused);
    pause.setAttribute("aria-pressed", String(info.simulationPaused));
    pause.querySelector("b").textContent = info.simulationPaused ? "Simulation paused" : "Simulation live";
  }

  function bindBodyEvents() {
    shell.querySelectorAll("[data-entity-id]").forEach((node) => node.addEventListener("click", () => {
      state.selectedId = node.dataset.entityId;
      api.select(state.selectedId);
      renderBody();
    }));
    const search = byId("adminSearch");
    if (search) search.addEventListener("input", () => {
      state.search = search.value;
      const tree = byId("adminEntityTree");
      tree.innerHTML = entityListMarkup(api.listEntities());
      tree.querySelectorAll("[data-entity-id]").forEach((node) => node.addEventListener("click", () => {
        state.selectedId = node.dataset.entityId;
        api.select(state.selectedId);
        renderBody();
      }));
    });
    const category = byId("adminCategory");
    if (category) category.addEventListener("change", () => { state.category = category.value; renderBody(); });
    const focus = byId("adminFocus");
    if (focus) focus.addEventListener("click", () => { api.focus(state.selectedId); setMode("freecam"); });
    const applyTransform = byId("adminApplyTransform");
    if (applyTransform) applyTransform.addEventListener("click", submitTransform);
    const ground = byId("adminGround");
    if (ground) ground.addEventListener("click", () => { api.ground(state.selectedId); toast("Object dropped to terrain"); renderBody(); });
    const resetTransform = byId("adminResetTransform");
    if (resetTransform) resetTransform.addEventListener("click", () => {
      const documentValue = api.getDocument();
      if (documentValue.entities[state.selectedId]) {
        delete documentValue.entities[state.selectedId].position;
        delete documentValue.entities[state.selectedId].rotationY;
        delete documentValue.entities[state.selectedId].scale;
        api.setDocument(documentValue);
        toast("Transform reset"); renderBody();
      }
    });
    ["adminSnapMove", "adminSnapRotate", "adminSnapScale"].forEach((id) => {
      const input = byId(id);
      if (input) input.addEventListener("change", () => api.controls.setSnap({
        translate: finite(byId("adminSnapMove").value, 1), rotate: finite(byId("adminSnapRotate").value, 15), scale: finite(byId("adminSnapScale").value, .1)
      }));
    });
    const duplicate = byId("adminDuplicate");
    if (duplicate) duplicate.addEventListener("click", () => { const item = api.duplicate(state.selectedId); if (item) { state.selectedId = item.id; toast("Object duplicated"); renderBody(); } else toast("This object has no replaceable model slot", "warning"); });
    const visible = byId("adminToggleVisible");
    if (visible) visible.addEventListener("click", () => {
      const item = selected();
      if (!item || !item.canHide || !api.setVisible(state.selectedId, !item.visible)) return toast("Gameplay-owned objects cannot be hidden", "warning");
      renderBody();
    });
    const collision = byId("adminToggleCollision");
    if (collision) collision.addEventListener("click", () => { const item = selected(); api.setCollision(state.selectedId, !item.collision); renderBody(); });
    const remove = byId("adminDelete");
    if (remove) remove.addEventListener("click", () => {
      const item = selected();
      if (!item || !item.canRemove) return toast("Gameplay-owned objects cannot be removed", "warning");
      if (window.confirm("Remove this object from the authored world?") && api.remove(state.selectedId)) { state.selectedId = null; renderBody(); }
    });
    const add = byId("adminAddModelButton");
    if (add) add.addEventListener("click", () => { const item = api.addModel(byId("adminAddModel").value); if (item) { state.selectedId = item.id; toast("Model placed at camera"); renderBody(); } });
    const color = byId("adminColor");
    const colorText = byId("adminColorText");
    if (color && colorText) color.addEventListener("input", () => { colorText.value = color.value; });
    const applyColor = byId("adminApplyColor");
    if (applyColor) applyColor.addEventListener("click", () => { const value = colorText.value; if (!/^#[0-9a-f]{6}$/i.test(value)) return toast("Use a six-digit hex color", "warning"); api.setColor(state.selectedId, value); toast("Material tint updated"); renderBody(); });
    const texturePreset = byId("adminTexturePreset");
    if (texturePreset) texturePreset.addEventListener("change", () => { if (texturePreset.value) byId("adminTexturePath").value = texturePreset.value; });
    const applyTexture = byId("adminApplyTexture");
    if (applyTexture) applyTexture.addEventListener("click", async () => {
      applyTexture.disabled = true;
      try { if (!await api.setTexture(state.selectedId, byId("adminTexturePath").value.trim())) throw new Error("Texture path rejected"); toast("Texture replaced"); renderBody(); }
      catch (error) { toast(error.message || "Texture could not be loaded", "error"); }
      finally { applyTexture.disabled = false; }
    });
    const replaceModel = byId("adminReplaceModelButton");
    if (replaceModel) replaceModel.addEventListener("click", () => { if (api.replaceModel(state.selectedId, byId("adminReplaceModel").value)) { toast("Model geometry replaced"); renderBody(); } else toast("Model replacement unavailable", "warning"); });
    const biomeSelect = byId("adminBiome");
    if (biomeSelect) biomeSelect.addEventListener("change", () => { const biome = api.biomes().find((item) => item.id === biomeSelect.value); byId("adminBiomeFields").innerHTML = biomeFieldsMarkup(biome); bindBodyEvents(); });
    shell.querySelectorAll(".admin-range input").forEach((input) => input.addEventListener("input", () => { const output = byId(input.id + "Output"); if (output) output.value = input.value; }));
    const applyBiome = byId("adminApplyBiome");
    if (applyBiome) applyBiome.addEventListener("click", () => {
      const id = byId("adminBiome").value;
      api.setBiome(id, {
        ground: byId("biomeGround").value, cliff: byId("biomeCliff").value, grass: byId("biomeGrass").value, fog: byId("biomeFog").value,
        treeDensity: finite(byId("biomeTrees").value, 1), propDensity: finite(byId("biomeProps").value, 1), grassDensity: finite(byId("biomeGrassDensity").value, 1),
        fogDensity: finite(byId("biomeFogDensity").value, .002), exposure: finite(byId("biomeExposure").value, 1)
      });
      toast("Biome updated live"); renderBody();
    });
    const enemyScope = byId("adminEnemyScope");
    if (enemyScope) enemyScope.addEventListener("change", renderBody);
    const applyProfile = byId("adminApplyEnemyProfile");
    if (applyProfile) applyProfile.addEventListener("click", () => {
      api.setEnemyProfile(byId("adminEnemyScope").value, {
        health: finite(byId("enemyHealthMultiplier").value, 1), damage: finite(byId("enemyDamageMultiplier").value, 1), speed: finite(byId("enemySpeedMultiplier").value, 1),
        attackRange: finite(byId("enemyRangeMultiplier").value, 1), sightRange: finite(byId("enemySightMultiplier").value, 1), tracking: finite(byId("enemyTrackingMultiplier").value, 1), attackRate: finite(byId("enemyRateMultiplier").value, 1)
      });
      toast("Enemy archetype updated"); renderBody();
    });
    const applyEnemy = byId("adminApplyEnemyInstance");
    if (applyEnemy) applyEnemy.addEventListener("click", () => {
      api.setEnemy(state.selectedId, {
        health: finite(byId("enemyInstanceHealth").value, 1), maxHealth: finite(byId("enemyInstanceMaxHealth").value, 1), damage: finite(byId("enemyInstanceDamage").value, 0), speed: finite(byId("enemyInstanceSpeed").value, 0),
        attackRange: finite(byId("enemyInstanceRange").value, 1), attackInterval: finite(byId("enemyInstanceInterval").value, 1), sightRange: finite(byId("enemyInstanceSight").value, 36), tracking: finite(byId("enemyInstanceTracking").value, 1)
      });
      toast("Selected enemy updated"); renderBody();
    });
    const validation = byId("adminRunValidation");
    if (validation) validation.addEventListener("click", () => { toast(api.validate().valid ? "Validation passed" : "Validation found blocking errors", api.validate().valid ? "success" : "error"); renderBody(); });
    const copy = byId("adminCopyJson");
    if (copy) copy.addEventListener("click", async () => { await navigator.clipboard.writeText(JSON.stringify(api.getDocument(), null, 2)); toast("Editor JSON copied"); });
    const downloadJson = byId("adminDownloadJson");
    if (downloadJson) downloadJson.addEventListener("click", () => download("ashenhold-world-overrides.json", JSON.stringify(api.getDocument(), null, 2), "application/json"));
    const downloadSource = byId("adminDownloadSource");
    if (downloadSource) downloadSource.addEventListener("click", () => download("world-overrides.js", api.sourceFile(), "text/javascript"));
    const importButton = byId("adminImportButton");
    if (importButton) importButton.addEventListener("click", () => byId("adminImportFile").click());
    const importFile = byId("adminImportFile");
    if (importFile) importFile.addEventListener("change", importDocument);
    const restoreDraft = byId("adminRestoreDraft");
    if (restoreDraft) restoreDraft.addEventListener("click", restoreBrowserDraft);
    const saveRepo = byId("adminSaveRepo");
    if (saveRepo) saveRepo.addEventListener("click", saveRepository);
    const publish = byId("adminPublishLive");
    if (publish) publish.addEventListener("click", publishLive);
  }

  function submitTransform() {
    api.setTransform(state.selectedId, {
      position: { x: finite(byId("adminPosX").value, 0), y: finite(byId("adminPosY").value, 0), z: finite(byId("adminPosZ").value, 0) },
      rotationY: finite(byId("adminRotY").value, 0) * Math.PI / 180,
      scale: { x: finite(byId("adminScaleX").value, 1), y: finite(byId("adminScaleY").value, 1), z: finite(byId("adminScaleZ").value, 1) }
    });
    toast("Transform applied"); renderBody();
  }

  function download(name, contents, type) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importDocument(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 512 * 1024) throw new Error("Editor documents are limited to 512 KB");
      const parsed = JSON.parse(await file.text());
      api.setDocument(parsed);
      state.selectedId = null;
      toast("Editor document imported", "success");
      renderBody();
    } catch (error) { toast("Import failed: " + error.message, "error"); }
    event.target.value = "";
  }

  function saveBrowserDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), worldSignature: api.info().worldSignature, document: api.getDocument() }));
      state.draftAvailable = true;
    } catch (_) {}
  }

  function queueBrowserDraft() {
    window.clearTimeout(queueBrowserDraft.timer);
    queueBrowserDraft.timer = window.setTimeout(saveBrowserDraft, 220);
  }

  function restoreBrowserDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (!draft || !draft.document || draft.worldSignature !== api.info().worldSignature) throw new Error("Draft does not match this world version");
      api.setDocument(draft.document);
      toast("Browser draft restored", "success");
      renderBody();
    } catch (error) { toast(error.message || "Draft could not be restored", "error"); }
  }

  async function connectBridge() {
    try {
      const response = await fetch("/__admin/session", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("No bridge");
      const data = await response.json();
      if (!data || !data.token || !data.localOnly) throw new Error("Bridge rejected");
      state.bridge = { connected: true, token: data.token, publishEnabled: Boolean(data.publishEnabled), branch: data.branch || "", dirty: Boolean(data.dirty) };
    } catch (_) {
      state.bridge = { connected: false, token: "", publishEnabled: false, branch: "", dirty: false };
    }
    refreshHeader();
    if (state.tab === "data") renderBody();
  }

  async function bridgeRequest(path, options) {
    if (!state.bridge.connected) throw new Error("Start the local save bridge with open-admin-editor.cmd first.");
    const response = await fetch(path, Object.assign({}, options || {}, {
      credentials: "same-origin",
      headers: Object.assign({ "Content-Type": "application/json", "X-Ashenhold-Admin": state.bridge.token }, options && options.headers || {})
    }));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Bridge request failed (${response.status})`);
    return data;
  }

  async function saveRepository() {
    const report = api.validate();
    if (!report.valid) return toast("Fix validation errors before saving", "error");
    const buttonNode = byId("adminSaveRepo");
    buttonNode.disabled = true;
    try {
      const result = await bridgeRequest("/__admin/overrides", { method: "PUT", body: JSON.stringify(api.getDocument()) });
      localStorage.removeItem(DRAFT_KEY);
      state.draftAvailable = false;
      toast(`Saved ${result.bytes} bytes to world-overrides.js`, "success");
      await connectBridge();
    } catch (error) { toast(error.message, "error"); }
    finally { buttonNode.disabled = false; }
  }

  async function publishLive() {
    if (!state.bridge.publishEnabled) return toast("Publishing is locked. Relaunch the bridge with --allow-publish.", "warning");
    const report = api.validate();
    if (!report.valid) return toast("Fix validation errors before publishing", "error");
    if (!window.confirm("Publish these world changes to the live GitHub Pages build? This will create and push one commit.")) return;
    const buttonNode = byId("adminPublishLive");
    buttonNode.disabled = true;
    try {
      const saved = await bridgeRequest("/__admin/overrides", { method: "PUT", body: JSON.stringify(api.getDocument()) });
      const result = await bridgeRequest("/__admin/publish", {
        method: "POST",
        body: JSON.stringify({ message: "Update Ashenhold world from local editor", digest: saved.digest })
      });
      toast(`Published ${result.commit.slice(0, 8)} to ${result.branch}`, "success");
      await connectBridge();
    } catch (error) { toast(error.message, "error"); }
    finally { buttonNode.disabled = false; }
  }

  function isEditorInput(target) {
    return Boolean(target && (target.closest && target.closest(".ashenhold-admin")) && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(target.tagName));
  }

  function keyDown(event) {
    if (isEditorInput(event.target)) return;
    const key = event.key.toLowerCase();
    const info = api.info();
    if ((event.ctrlKey || event.metaKey) && key === "z") { event.preventDefault(); event.stopImmediatePropagation(); if (event.shiftKey) api.redo(); else api.undo(); scheduleRender(); return; }
    if ((event.ctrlKey || event.metaKey) && key === "y") { event.preventDefault(); event.stopImmediatePropagation(); api.redo(); scheduleRender(); return; }
    if (key === "`") { event.preventDefault(); togglePanel(); return; }
    if (key === "v") setMode("select");
    else if (key === "f") setMode("freecam");
    else if (key === "n") setMode("noclip");
    else if (key === "g") setTransformMode("translate");
    else if (key === "r") setTransformMode("rotate");
    else if (key === "x" || (key === "s" && info.mode === "select")) setTransformMode("scale");
    else if ((key === "delete" || key === "backspace") && state.selectedId) {
      event.preventDefault();
      const item = selected();
      if (item && item.canRemove && api.remove(state.selectedId)) { state.selectedId = null; scheduleRender(); }
      else toast("Gameplay-owned objects cannot be removed", "warning");
    }
    if (["w", "a", "s", "d", "q", "e", "shift"].includes(key) && (info.mode === "freecam" || info.mode === "noclip")) {
      event.preventDefault(); event.stopImmediatePropagation(); api.controls.setInput(key, true);
    } else if (["v", "f", "n", "g", "r", "x"].includes(key) || (key === "s" && info.mode === "select")) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }

  function keyUp(event) {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "q", "e", "shift"].includes(key)) api.controls.setInput(key, false);
  }

  const viewport = document.getElementById("viewport");
  function finishPointerInteraction(event, pickOnRelease) {
    if (state.pointerMode === "transform") api.endDrag();
    else if (state.pointerMode === "pick" && pickOnRelease && event) {
      const item = api.pick(state.startX, state.startY);
      state.selectedId = item && item.id || null;
    }
    if (state.pointerId != null && viewport.hasPointerCapture && viewport.hasPointerCapture(state.pointerId)) viewport.releasePointerCapture(state.pointerId);
    state.pointerMode = null;
    state.pointerId = null;
    state.dragAxis = null;
    scheduleRender();
  }

  viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest && event.target.closest(".ashenhold-admin")) return;
    const info = api.info();
    event.preventDefault();
    event.stopImmediatePropagation();
    finishPointerInteraction();
    state.startX = state.lastX = event.clientX;
    state.startY = state.lastY = event.clientY;
    state.pointerId = event.pointerId;
    if ((info.mode === "freecam" || info.mode === "noclip") && event.button !== 0) {
      state.pointerMode = "look";
      viewport.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) { state.pointerId = null; return; }
    const axis = api.pickGizmo(event.clientX, event.clientY);
    if (axis && state.selectedId && api.beginDrag(info.transformMode, axis, event.clientX, event.clientY)) {
      state.pointerMode = "transform";
      state.dragAxis = axis;
      api.controls.clearInput();
    } else {
      state.pointerMode = "pick";
    }
    viewport.setPointerCapture(event.pointerId);
  }, true);
  viewport.addEventListener("pointermove", (event) => {
    if (event.pointerId !== state.pointerId) return;
    if (state.pointerMode === "transform" && state.dragAxis) {
      event.preventDefault(); event.stopImmediatePropagation(); api.drag(event.clientX, event.clientY); scheduleRender(); return;
    }
    if (state.pointerMode === "pick" && Math.hypot(event.clientX - state.startX, event.clientY - state.startY) >= 6) state.pointerMode = "look";
    if (state.pointerMode === "look") {
      event.preventDefault(); event.stopImmediatePropagation();
      api.controls.look(event.clientX - state.lastX, event.clientY - state.lastY);
      state.lastX = event.clientX; state.lastY = event.clientY;
    }
  }, true);
  const endPointer = (event) => {
    if (event.pointerId !== state.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    finishPointerInteraction(event, true);
  };
  viewport.addEventListener("pointerup", endPointer, true);
  viewport.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== state.pointerId) return;
    finishPointerInteraction(event, false);
  }, true);
  viewport.addEventListener("wheel", (event) => {
    if (api.info().mode !== "freecam") return;
    event.preventDefault(); event.stopImmediatePropagation();
    const current = finite(event.deltaY, 0) > 0 ? 28 : 52;
    api.controls.setSpeed(current);
    toast(`Freecam speed ${current} m/s`);
  }, { capture: true, passive: false });

  function togglePanel(forceOpen) {
    state.panelCollapsed = forceOpen === true ? false : !state.panelCollapsed;
    shell.classList.toggle("collapsed", state.panelCollapsed);
  }

  byId("adminCollapse").addEventListener("click", () => togglePanel());
  byId("adminExpand").addEventListener("click", () => togglePanel(true));
  byId("adminModeSelect").addEventListener("click", () => setMode("select"));
  byId("adminModeFreecam").addEventListener("click", () => setMode("freecam"));
  byId("adminModeNoclip").addEventListener("click", () => setMode("noclip"));
  byId("adminToolMove").addEventListener("click", () => setTransformMode("translate"));
  byId("adminToolRotate").addEventListener("click", () => setTransformMode("rotate"));
  byId("adminToolScale").addEventListener("click", () => setTransformMode("scale"));
  byId("adminPauseSimulation").addEventListener("click", () => { api.controls.setPaused(!api.info().simulationPaused); refreshHeader(); });
  shell.querySelectorAll("[data-admin-tab]").forEach((node) => node.addEventListener("click", () => setTab(node.dataset.adminTab)));
  window.addEventListener("keydown", keyDown, true);
  window.addEventListener("keyup", keyUp, true);
  window.addEventListener("blur", () => api.controls.clearInput());
  window.addEventListener("ashenhold:admin-selection", (event) => { state.selectedId = event.detail && event.detail.id || null; scheduleRender(); });
  window.addEventListener("ashenhold:admin-change", () => { queueBrowserDraft(); refreshHeader(); });

  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    state.draftAvailable = Boolean(draft && draft.document && draft.worldSignature === api.info().worldSignature);
  } catch (_) {}
  setMode("freecam");
  setTransformMode("translate");
  renderBody();
  connectBridge();
  toast("Ashenhold Forge ready · local sandbox", "success");
})();

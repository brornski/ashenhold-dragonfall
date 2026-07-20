import http from "node:http";
import { createReadStream } from "node:fs";
import { access, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const argumentsSet = new Set(process.argv.slice(2));
const valueArgument = (name, fallback) => {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((entry) => entry.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
};
const host = "127.0.0.1";
const port = Math.max(1024, Math.min(65535, Number(valueArgument("port", "4174")) || 4174));
const publishBranch = valueArgument("publish-branch", "main").replace(/[^a-zA-Z0-9._/-]/g, "").slice(0, 80) || "main";
const allowPublish = argumentsSet.has("--allow-publish");
const sessionToken = crypto.randomBytes(32).toString("base64url");
const overridePath = path.join(repositoryRoot, "world-overrides.js");
const repositoryId = crypto.createHash("sha256").update(repositoryRoot.toLowerCase()).digest("hex").slice(0, 20);
const maxBodyBytes = 512 * 1024;
let lastSavedOverride = null;
let saveInProgress = false;
let publishInProgress = false;
const git = async (...args) => execFileAsync("git", args, { cwd: repositoryRoot, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".webmanifest", "application/manifest+json"],
  [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".webp", "image/webp"], [".svg", "image/svg+xml"],
  [".glb", "model/gltf-binary"], [".gltf", "model/gltf+json"], [".bin", "application/octet-stream"], [".woff2", "font/woff2"],
  [".mp3", "audio/mpeg"], [".ogg", "audio/ogg"], [".wav", "audio/wav"]
]);

function securityHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; media-src 'self'; connect-src 'self' blob: ws://127.0.0.1:* ws://localhost:*; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin"
  };
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, Object.assign(securityHeaders("application/json; charset=utf-8"), { "Content-Length": Buffer.byteLength(body) }));
  response.end(body);
}

function requestHostAllowed(request) {
  const value = String(request.headers.host || "").toLowerCase();
  return value === `${host}:${port}` || value === `localhost:${port}`;
}

function requestOriginAllowed(request) {
  if (!request.headers.origin) return true;
  try {
    const origin = new URL(request.headers.origin);
    return origin.protocol === "http:" && (origin.hostname === host || origin.hostname === "localhost") && Number(origin.port || 80) === port;
  } catch (_) { return false; }
}

function tokenAllowed(request) {
  const supplied = String(request.headers["x-ashenhold-admin"] || "");
  if (supplied.length !== sessionToken.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(sessionToken));
}

async function readRequestBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw Object.assign(new Error("Editor document exceeds 512 KB."), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function safeNumber(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function safeColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : undefined;
}

function safeTexturePath(value) {
  if (typeof value !== "string" || value.length > 220 || !/^assets\/[a-z0-9_./-]+$/i.test(value)) return undefined;
  const segments = value.split("/");
  if (segments[0] !== "assets" || segments.some((segment) => !segment || segment === "." || segment === "..")) return undefined;
  return /\.(?:png|jpe?g|webp)$/i.test(value) ? value : undefined;
}

function validateNoPrototypeKeys(value, depth = 0) {
  if (depth > 10) throw new Error("Editor document nesting is too deep.");
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    if (key === "__proto__" || key === "prototype" || key === "constructor") throw new Error("Editor document contains a forbidden property name.");
    validateNoPrototypeKeys(value[key], depth + 1);
  }
}

function sanitizeDocument(input) {
  validateNoPrototypeKeys(input);
  const source = record(input);
  if (!source || source.schemaVersion !== 1 || source.worldSignature !== "ashenhold-authored-continent-8") throw new Error("Editor document schema or world signature does not match this build.");
  const output = { schemaVersion: 1, worldSignature: "ashenhold-authored-continent-8", entities: {}, biomes: {}, enemies: { global: {}, byKind: {} } };
  const entities = record(source.entities) || {};
  const ids = Object.keys(entities);
  if (ids.length > 2400) throw new Error("Editor document has too many entity overrides.");
  for (const id of ids) {
    if (!/^[a-z0-9:_-]{1,120}$/i.test(id)) throw new Error(`Invalid entity ID: ${id.slice(0, 60)}`);
    const entry = record(entities[id]);
    if (!entry) continue;
    const clean = {};
    if (typeof entry.type === "string" && /^[a-z-]{1,30}$/i.test(entry.type)) clean.type = entry.type;
    if (typeof entry.label === "string") clean.label = entry.label.slice(0, 100);
    if (typeof entry.modelSlot === "string" && /^[a-z0-9_-]{1,64}$/i.test(entry.modelSlot)) clean.modelSlot = entry.modelSlot;
    if (record(entry.position)) clean.position = {
      x: safeNumber(entry.position.x, -900, 900, 0), y: safeNumber(entry.position.y, -200, 600, 0), z: safeNumber(entry.position.z, -900, 900, 0)
    };
    if (entry.rotationY !== undefined) clean.rotationY = safeNumber(entry.rotationY, -Math.PI * 8, Math.PI * 8, 0);
    if (record(entry.scale)) clean.scale = {
      x: safeNumber(entry.scale.x, .02, 25, 1), y: safeNumber(entry.scale.y, .02, 25, 1), z: safeNumber(entry.scale.z, .02, 25, 1)
    };
    const color = safeColor(entry.color);
    if (color) clean.color = color;
    const texture = safeTexturePath(entry.texture);
    if (entry.texture !== undefined && !texture) throw new Error(`Invalid texture path for ${id}. Use an existing PNG, JPEG, or WebP under assets/.`);
    if (texture) clean.texture = texture;
    if (clean.type === "model" || clean.type === "custom-model") {
      for (const flag of ["visible", "deleted"]) if (typeof entry[flag] === "boolean") clean[flag] = entry[flag];
    }
    if (typeof entry.collision === "boolean") clean.collision = entry.collision;
    if (record(entry.enemy)) {
      clean.enemy = {};
      const limits = { health: [0, 100000], maxHealth: [1, 100000], damage: [0, 10000], speed: [0, 250], attackRange: [.1, 250], attackInterval: [.05, 60], sightRange: [.1, 500], tracking: [.05, 10] };
      for (const [field, range] of Object.entries(limits)) {
        const value = safeNumber(entry.enemy[field], range[0], range[1], undefined);
        if (value !== undefined) clean.enemy[field] = value;
      }
    }
    output.entities[id] = clean;
  }
  const biomeSource = record(source.biomes) || {};
  const biomeIds = new Set(["shore", "jungle", "desert", "snowy", "mountains", "moon"]);
  for (const id of Object.keys(biomeSource)) {
    if (!biomeIds.has(id) || !record(biomeSource[id])) continue;
    const entry = biomeSource[id];
    const clean = {};
    for (const field of ["ground", "cliff", "grass", "fog", "frost", "sky", "sun"]) {
      const color = safeColor(entry[field]);
      if (color) clean[field] = color;
    }
    const numeric = { fogDensity: [0, .025], exposure: [.15, 4], treeDensity: [0, 3], propDensity: [0, 3], grassDensity: [0, 3] };
    for (const [field, range] of Object.entries(numeric)) {
      const value = safeNumber(entry[field], range[0], range[1], undefined);
      if (value !== undefined) clean[field] = value;
    }
    if (id === "desert") clean.treeDensity = 0;
    output.biomes[id] = clean;
  }
  const enemySource = record(source.enemies) || {};
  const cleanMultipliers = (value) => {
    const clean = {};
    const sourceValue = record(value) || {};
    for (const field of ["health", "damage", "speed", "attackRange", "sightRange", "tracking", "attackRate"]) {
      const number = safeNumber(sourceValue[field], .05, 10, undefined);
      if (number !== undefined) clean[field] = number;
    }
    return clean;
  };
  output.enemies.global = cleanMultipliers(enemySource.global);
  const byKind = record(enemySource.byKind) || {};
  for (const kind of Object.keys(byKind).slice(0, 32)) if (/^[a-z0-9_-]{1,40}$/i.test(kind)) output.enemies.byKind[kind] = cleanMultipliers(byKind[kind]);
  return output;
}

async function validateTextureFiles(document) {
  const paths = Array.from(new Set(Object.values(document.entities).map((entry) => entry.texture).filter(Boolean)));
  for (const relative of paths) {
    const candidate = path.resolve(repositoryRoot, relative);
    const assetsRoot = path.resolve(repositoryRoot, "assets");
    if (!candidate.startsWith(assetsRoot + path.sep)) throw new Error(`Texture path leaves assets/: ${relative}`);
    await access(candidate, fsConstants.R_OK).catch(() => { throw new Error(`Texture file does not exist: ${relative}`); });
    const resolved = await realpath(candidate);
    if (!resolved.startsWith(assetsRoot + path.sep)) throw new Error(`Texture path resolves outside assets/: ${relative}`);
  }
}

const overrideSourcePrefix = `(function () {\n  "use strict";\n\n  // Data-only output from the local Ashenhold world editor.\n  window.AshenholdWorldOverrides = `;
const overrideSourceSuffix = `;\n})();\n`;

function sourceForDocument(document) {
  const json = JSON.stringify(document, null, 2).replace(/</g, "\\u003c");
  return overrideSourcePrefix + json + overrideSourceSuffix;
}

function digestForSource(source) {
  return crypto.createHash("sha256").update(source, "utf8").digest("hex");
}

function publishIntegrityError(message) {
  return Object.assign(new Error(message), { status: 409 });
}

function documentFromOverrideSource(source) {
  if (typeof source !== "string" || !source.startsWith(overrideSourcePrefix) || !source.endsWith(overrideSourceSuffix)) {
    throw publishIntegrityError("Publishing refused because world-overrides.js is not canonical Forge output. Save it through Forge again.");
  }
  const json = source.slice(overrideSourcePrefix.length, -overrideSourceSuffix.length);
  let document;
  try { document = sanitizeDocument(JSON.parse(json)); }
  catch (_) { throw publishIntegrityError("Publishing refused because world-overrides.js no longer contains a valid Forge document."); }
  if (sourceForDocument(document) !== source) {
    throw publishIntegrityError("Publishing refused because world-overrides.js changed after validation. Save it through Forge again.");
  }
  return document;
}

function requireLastSavedDigest(expectedDigest) {
  if (typeof expectedDigest !== "string" || !/^[a-f0-9]{64}$/.test(expectedDigest)) {
    throw publishIntegrityError("Publishing requires the digest returned by the latest Forge save.");
  }
  if (!lastSavedOverride || lastSavedOverride.digest !== expectedDigest) {
    throw publishIntegrityError("Publishing refused because this is not the latest override saved by this bridge session.");
  }
}

async function readValidatedOverride(expectedDigest, sourceLabel) {
  let source;
  try { source = await readFile(overridePath, "utf8"); }
  catch (_) { throw publishIntegrityError(`Publishing refused because ${sourceLabel || "world-overrides.js"} could not be read.`); }
  if (digestForSource(source) !== expectedDigest || source !== lastSavedOverride.source) {
    throw publishIntegrityError("Publishing refused because world-overrides.js changed after the latest Forge save.");
  }
  const document = documentFromOverrideSource(source);
  try { await validateTextureFiles(document); }
  catch (error) { throw publishIntegrityError(`Publishing refused during asset revalidation: ${error.message}`); }
  return { source, document };
}

async function writeOverrides(document) {
  const source = sourceForDocument(document);
  const digest = digestForSource(source);
  const temporaryPath = path.join(repositoryRoot, `.world-overrides.${process.pid}.${crypto.randomBytes(5).toString("hex")}.tmp`);
  await writeFile(temporaryPath, source, { encoding: "utf8", mode: 0o600, flag: "wx" });
  try {
    await rename(temporaryPath, overridePath);
  } catch (error) {
    if (process.platform !== "win32" || !["EEXIST", "EPERM"].includes(error.code)) throw error;
    const backupPath = path.join(repositoryRoot, `.world-overrides.${process.pid}.${crypto.randomBytes(5).toString("hex")}.bak`);
    await rename(overridePath, backupPath);
    try {
      await rename(temporaryPath, overridePath);
      await unlink(backupPath).catch(() => {});
    } catch (replacementError) {
      await rename(backupPath, overridePath).catch(() => {});
      await unlink(temporaryPath).catch(() => {});
      throw replacementError;
    }
  }
  const persisted = await readFile(overridePath, "utf8");
  if (persisted !== source) throw publishIntegrityError("The override changed while Forge was saving it. Save again before publishing.");
  return { bytes: Buffer.byteLength(source), digest, source };
}

async function gitStatus() {
  const [{ stdout: branchOutput }, { stdout: statusOutput }] = await Promise.all([
    git("branch", "--show-current"), git("status", "--porcelain", "--untracked-files=no")
  ]);
  const branch = branchOutput.trim();
  const changes = statusOutput.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).replace(/^"|"$/g, ""));
  return { branch, changes, dirty: changes.length > 0 };
}

async function publishOverrides(message, expectedDigest) {
  if (!allowPublish) throw Object.assign(new Error("Publishing is disabled. Start the bridge with --allow-publish."), { status: 403 });
  if (publishInProgress || saveInProgress) throw publishIntegrityError("Another Forge save or publish is already in progress.");
  requireLastSavedDigest(expectedDigest);
  publishInProgress = true;
  try {
    await readValidatedOverride(expectedDigest, "world-overrides.js");
    const status = await gitStatus();
    if (status.branch !== publishBranch) throw Object.assign(new Error(`Publishing requires branch ${publishBranch}; this worktree is on ${status.branch || "detached HEAD"}.`), { status: 409 });
    const unrelated = status.changes.filter((file) => file !== "world-overrides.js");
    if (unrelated.length) throw Object.assign(new Error(`Publishing refused because unrelated tracked files are modified: ${unrelated.slice(0, 5).join(", ")}`), { status: 409 });
    const { stdout: remoteUrl } = await git("remote", "get-url", "origin");
    if (!/^(?:https:\/\/github\.com\/|git@github\.com:)/i.test(remoteUrl.trim())) throw Object.assign(new Error("The origin remote is not a GitHub repository."), { status: 409 });
    await git("fetch", "origin", publishBranch);
    const [{ stdout: localHead }, { stdout: remoteHead }] = await Promise.all([git("rev-parse", "HEAD"), git("rev-parse", `origin/${publishBranch}`)]);
    if (localHead.trim() !== remoteHead.trim()) throw Object.assign(new Error(`Publishing requires HEAD to exactly match origin/${publishBranch} before the editor creates its one override commit.`), { status: 409 });
    await readValidatedOverride(expectedDigest, "world-overrides.js");
    await git("diff", "--check", "--", "world-overrides.js");
    await git("add", "--", "world-overrides.js");
    const { stdout: stagedSource } = await git("show", ":world-overrides.js");
    if (digestForSource(stagedSource) !== expectedDigest || stagedSource !== lastSavedOverride.source) {
      throw publishIntegrityError("Publishing refused because the staged override does not match the latest validated Forge save.");
    }
    documentFromOverrideSource(stagedSource);
    await readValidatedOverride(expectedDigest, "world-overrides.js");
    let committed = true;
    try { await git("diff", "--cached", "--quiet", "--", "world-overrides.js"); committed = false; }
    catch (_) { committed = true; }
    if (committed) {
      const cleanMessage = typeof message === "string" && /^[a-zA-Z0-9 .:_-]{3,100}$/.test(message) ? message : "Update Ashenhold world from local editor";
      await git("commit", "-m", cleanMessage);
    }
    const { stdout: committedSource } = await git("show", "HEAD:world-overrides.js");
    if (digestForSource(committedSource) !== expectedDigest || committedSource !== lastSavedOverride.source) {
      throw publishIntegrityError("Publishing refused because the committed override does not match the latest validated Forge save.");
    }
    await git("push", "origin", `HEAD:${publishBranch}`);
    const { stdout: commitOutput } = await git("rev-parse", "HEAD");
    return { branch: publishBranch, commit: commitOutput.trim(), committed, digest: expectedDigest };
  } finally {
    publishInProgress = false;
  }
}

async function handleApi(request, response, pathname) {
  if (!requestOriginAllowed(request)) return sendJson(response, 403, { error: "Origin is not allowed." });
  if (pathname === "/__admin/session" && request.method === "GET") {
    const status = await gitStatus().catch(() => ({ branch: "", changes: [], dirty: false }));
    return sendJson(response, 200, {
      localOnly: true, token: sessionToken, branch: status.branch, dirty: status.dirty,
      publishConfigured: allowPublish, publishEnabled: allowPublish && status.branch === publishBranch,
      publishBranch, worldSignature: "ashenhold-authored-continent-8", repositoryId, repositoryRoot
    });
  }
  if (!tokenAllowed(request)) return sendJson(response, 401, { error: "Missing or invalid local editor session token." });
  if (pathname === "/__admin/validate" && request.method === "POST") {
    const document = sanitizeDocument(JSON.parse(await readRequestBody(request)));
    await validateTextureFiles(document);
    return sendJson(response, 200, { valid: true, bytes: Buffer.byteLength(sourceForDocument(document)), worldSignature: document.worldSignature });
  }
  if (pathname === "/__admin/overrides" && request.method === "PUT") {
    const document = sanitizeDocument(JSON.parse(await readRequestBody(request)));
    await validateTextureFiles(document);
    if (publishInProgress || saveInProgress) throw publishIntegrityError("Another Forge save or publish is already in progress.");
    saveInProgress = true;
    try {
      const saved = await writeOverrides(document);
      lastSavedOverride = { digest: saved.digest, source: saved.source };
      return sendJson(response, 200, { saved: true, bytes: saved.bytes, digest: saved.digest, file: "world-overrides.js", validation: { valid: true } });
    } finally {
      saveInProgress = false;
    }
  }
  if (pathname === "/__admin/publish" && request.method === "POST") {
    const payload = record(JSON.parse(await readRequestBody(request) || "{}")) || {};
    const result = await publishOverrides(payload.message, payload.digest);
    return sendJson(response, 200, Object.assign({ published: true }, result));
  }
  return sendJson(response, 404, { error: "Unknown admin endpoint." });
}

async function serveStatic(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") return sendJson(response, 405, { error: "Method not allowed." });
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch (_) { return sendJson(response, 400, { error: "Malformed path." }); }
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  if (!relative || relative.includes("\0") || relative.split(/[\\/]/).some((segment) => segment === ".." || segment.startsWith("."))) return sendJson(response, 403, { error: "Path is not allowed." });
  const candidate = path.resolve(repositoryRoot, relative);
  if (candidate !== repositoryRoot && !candidate.startsWith(repositoryRoot + path.sep)) return sendJson(response, 403, { error: "Path is outside the repository." });
  try { await access(candidate, fsConstants.R_OK); }
  catch (_) { return sendJson(response, 404, { error: "Not found." }); }
  const resolved = await realpath(candidate);
  if (resolved !== repositoryRoot && !resolved.startsWith(repositoryRoot + path.sep)) return sendJson(response, 403, { error: "Resolved path is outside the repository." });
  const extension = path.extname(resolved).toLowerCase();
  const headers = securityHeaders(mimeTypes.get(extension) || "application/octet-stream");
  response.writeHead(200, headers);
  if (request.method === "HEAD") return response.end();
  createReadStream(resolved).on("error", () => response.destroy()).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    if (!requestHostAllowed(request)) return sendJson(response, 403, { error: "Host header is not allowed." });
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    if (url.pathname.startsWith("/__admin/")) await handleApi(request, response, url.pathname);
    else await serveStatic(request, response, url.pathname);
  } catch (error) {
    const validationFailure = error instanceof SyntaxError || /(?:editor document|entity id|world signature|forbidden property|invalid entity|texture)/i.test(String(error.message || ""));
    const status = Number(error.status) || (validationFailure ? 400 : 500);
    sendJson(response, status, { error: status === 500 ? "The local editor bridge could not complete the request." : error.message });
    if (status === 500) console.error(error);
  }
});

server.listen(port, host, () => {
  console.log(`Ashenhold Forge: http://${host}:${port}/?admin`);
  console.log(`Repository: ${repositoryRoot}`);
  console.log(`Publish: ${allowPublish ? `enabled only on ${publishBranch}` : "disabled"}`);
});

server.on("error", (error) => {
  console.error(`Ashenhold Forge could not listen on ${host}:${port}: ${error.message}`);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => { process.exitCode = 0; }));

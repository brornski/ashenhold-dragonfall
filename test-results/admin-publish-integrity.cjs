"use strict";

const { spawn } = require("child_process");
const { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } = require("fs/promises");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.ASHENHOLD_PUBLISH_AUDIT_PORT || (45000 + process.pid % 1000));
const BASE = `http://127.0.0.1:${PORT}/`;

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForBridge(process) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (process.exitCode != null) throw new Error(`Temporary Forge bridge exited with ${process.exitCode}.`);
    try {
      const response = await fetch(BASE + "__admin/session");
      if (response.ok) return response.json();
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Temporary Forge bridge did not become ready.");
}

async function stopBridgeProcess(bridge) {
  if (!bridge || bridge.exitCode != null) return;
  const waitForExit = (timeout) => new Promise((resolve) => {
    const onExit = () => { clearTimeout(timer); resolve(true); };
    const timer = setTimeout(() => { bridge.off("exit", onExit); resolve(false); }, timeout);
    bridge.once("exit", onExit);
  });
  bridge.kill("SIGTERM");
  if (!await waitForExit(1200) && bridge.exitCode == null) {
    bridge.kill("SIGKILL");
    await waitForExit(1200);
  }
}

async function publish(token, payload) {
  return fetch(BASE + "__admin/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Ashenhold-Admin": token },
    body: JSON.stringify(payload || {})
  });
}

(async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "ashenhold-publish-integrity-"));
  const toolsDirectory = path.join(temporaryRoot, "tools");
  const overridePath = path.join(temporaryRoot, "world-overrides.js");
  let bridge;
  let stderr = "";
  try {
    await mkdir(toolsDirectory, { recursive: true });
    await copyFile(path.join(ROOT, "tools", "ashenhold-admin-server.mjs"), path.join(toolsDirectory, "ashenhold-admin-server.mjs"));
    await writeFile(overridePath, "// temporary audit fixture\n", "utf8");
    bridge = spawn(process.execPath, ["tools/ashenhold-admin-server.mjs", `--port=${PORT}`, "--allow-publish", "--publish-branch=main"], {
      cwd: temporaryRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"]
    });
    bridge.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    const session = await waitForBridge(bridge);
    check(session.localOnly && session.token, "Temporary bridge did not issue a session token.");
    check(session.publishConfigured === true, "The session must distinguish configured publish capability.");
    check(session.publishEnabled === false, "A non-Git temporary directory must not be effectively publishable.");

    const document = {
      schemaVersion: 1,
      worldSignature: "ashenhold-authored-continent-8",
      entities: {},
      biomes: { desert: { treeDensity: 0 } },
      enemies: { global: {}, byKind: {} }
    };
    const savedResponse = await fetch(BASE + "__admin/overrides", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Ashenhold-Admin": session.token },
      body: JSON.stringify(document)
    });
    const saved = await savedResponse.json();
    check(savedResponse.ok && saved.saved && /^[a-f0-9]{64}$/.test(saved.digest), "Save must return a SHA-256 publish digest.");

    const missingDigest = await publish(session.token, { message: "Audit missing digest" });
    check(missingDigest.status === 409, "Publish must reject a missing save digest before Git access.");
    const staleDigest = await publish(session.token, { message: "Audit stale digest", digest: "0".repeat(64) });
    check(staleDigest.status === 409, "Publish must reject a digest not issued by the latest bridge save.");

    const canonicalSource = await readFile(overridePath, "utf8");
    await writeFile(overridePath, canonicalSource + "// manual race edit\n", "utf8");
    const changedDisk = await publish(session.token, { message: "Audit changed disk", digest: saved.digest });
    const changedPayload = await changedDisk.json();
    check(changedDisk.status === 409 && /changed after/i.test(changedPayload.error || ""), "Publish must reject a manual edit after the validated save.");

    const launcher = await readFile(path.join(ROOT, "open-admin-editor.cmd"), "utf8");
    const editor = await readFile(path.join(ROOT, "admin-editor.js"), "utf8");
    const server = await readFile(path.join(ROOT, "tools", "ashenhold-admin-server.mjs"), "utf8");
    check((launcher.match(/publishConfigured/g) || []).length >= 3, "Launcher must select, reuse, and await only publish-configured bridges.");
    check(launcher.includes("4174,4184,4194,4204,4214"), "Launcher must provide alternate ports when a save-only bridge occupies the first port.");
    check(/digest:\s*saved\.digest/.test(editor), "Publish Live must return the exact save digest to the bridge.");
    check(/git\("show",\s*":world-overrides\.js"\)/.test(server), "Bridge must verify the staged override before commit.");
    check(/git\("show",\s*"HEAD:world-overrides\.js"\)/.test(server), "Bridge must verify the committed override before push.");
    check(!/git\("commit"[^\n]+"--",\s*"world-overrides\.js"/.test(server), "Bridge must commit the verified index instead of rereading a pathspec from the working tree.");

    console.log(JSON.stringify({
      checks: {
        publishCapabilityIdentity: true,
        savedDigestIssued: true,
        missingDigestRejected: true,
        staleDigestRejected: true,
        changedDiskRejected: true,
        stagedSourceGuardPresent: true,
        committedSourceGuardPresent: true,
        launcherSkipsSaveOnlyBridge: true
      }
    }, null, 2));
  } finally {
    await stopBridgeProcess(bridge);
    await rm(temporaryRoot, { recursive: true, force: true });
    if (stderr) process.stderr.write(stderr);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

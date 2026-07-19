import { createAshenholdServer } from "./app.mjs";

const port = Math.max(1, Math.min(65535, Number(process.env.PORT) || 8787));
const host = process.env.HOST || "127.0.0.1";
const { server } = createAshenholdServer();
server.listen(port, host, () => console.log(`[ashenhold-multiplayer] http://${host}:${port} | ws://${host}:${port}/ws`));

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

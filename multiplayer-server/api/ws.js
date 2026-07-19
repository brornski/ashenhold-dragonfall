import { createAshenholdServer } from "../create-server.mjs";

const instance = createAshenholdServer({ path: "/api/ws" });
export default instance.server;

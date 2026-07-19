import { createAshenholdServer } from "../app.mjs";

const instance = createAshenholdServer({ path: "/api/ws" });
export default instance.server;

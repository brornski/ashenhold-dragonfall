(function () {
  "use strict";

  // Data-only output from the local Ashenhold world editor. The local editor and
  // save bridge are intentionally not part of the deployed site; this small file
  // is the only editor-authored artifact consumed by the production runtime.
  window.AshenholdWorldOverrides = {
    schemaVersion: 1,
    worldSignature: "ashenhold-authored-continent-8",
    entities: {},
    biomes: {},
    enemies: {
      global: {},
      byKind: {}
    }
  };
})();

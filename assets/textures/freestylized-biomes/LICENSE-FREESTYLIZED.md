# FreeStylized biome-material notice

The WebP material maps in this directory are project-optimized derivatives of 1K materials downloaded from FreeStylized.

- Library: https://freestylized.com/
- Publisher license and redistribution terms: https://freestylized.com/disclaimer/

FreeStylized permits its materials in commercial and non-commercial projects, asks (but does not require) attribution, and restricts standalone redistribution of source content. These files are renamed, web-compressed derivatives integrated into Ashenhold's biome renderer. Obtain source material archives from FreeStylized instead of extracting these project derivatives for redistribution.

## Runtime mapping

| Ashenhold biome | FreeStylized source archive | Runtime maps |
| --- | --- | --- |
| Verdant Ruins | [`ground_tiles_13_1k.zip`](https://freestylized.com/material/ground_tiles_13/) | `jungle-{color,normal,roughness}.webp` |
| Drowned Coast | [`ground_tiles_17_1k.zip`](https://freestylized.com/material/ground_tiles_17/) | `shore-{color,normal,roughness}.webp` |
| Sky-Sunder Peaks | [`ground_with_rocks_03_1k.zip`](https://freestylized.com/material/ground_with_rocks_03/) | `mountains-{color,normal,roughness}.webp` |
| Ember Dunes | [`sand_01_1k.zip`](https://freestylized.com/material/sand_01/) | `desert-{color,normal,roughness}.webp` |
| Moonfall Expanse | [`lava_rocks_01_1k.zip`](https://freestylized.com/material/lava_rocks_01/) | `moon-{color,normal,roughness}.webp` |

Each triplet contains a base-color map, the supplied OpenGL normal map, and a roughness map. The original 1K PNG maps were transcoded to 1K WebP for browser delivery. Unused DirectX normals, height, ambient-occlusion, and source ZIP files are not redistributed. Frostbound Wilds continues using Ashenhold's existing snow material because the provided library did not contain a thematically suitable snow surface.

These notices summarize the publisher terms for convenient project compliance; the linked publisher terms remain authoritative.

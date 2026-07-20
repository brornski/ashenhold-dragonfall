# Asset attribution and licenses

## Runtime libraries

- Three.js r128 (`assets/vendor/three.min.js`, `GLTFLoader.js`, `SkeletonUtils.js`) — MIT License, https://github.com/mrdoob/three.js
- Local MIT notice: `assets/vendor/LICENSE-THREE-MIT.txt`.

## Interface fonts

- Cinzel and Inter are bundled as WOFF2 subsets under the SIL Open Font License 1.1.
- Copyright, source, and license links are recorded in `assets/fonts/LICENSES.md`.

## Castle and world models

- Kenney Castle Kit — 75 models released under CC0 1.0, https://www.kenney.nl/assets/castle-kit
- Curated files are stored in `assets/models/kenney-castle/`.
- The original license copy is `assets/models/kenney-castle/LICENSE-KENNEY-CC0.txt`.
- `Textures/colormap.png` is the shared texture required by the curated GLBs.

## Animated frost warg

- Runtime file: `assets/models/creatures/frost-warg.glb`.
- Source: Khronos glTF Sample Assets “Fox”, https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox
- Model by PixelMannen is CC0; rigging/animation by @tomkranis and glTF conversion by Norbert Nopper are CC BY 4.0.
- Full notice: `assets/models/creatures/LICENSE-FROST-WARG.md`.
- The in-game name, material tint, scale, and role are project adaptations.

## Animated Warden

- Runtime file: `assets/models/quaternius-rpg-character/warden.gltf`.
- Source: Quaternius RPG Character Pack, https://quaternius.com/packs/rpgcharacters.html
- The pack provides six rigged, animated, textured fantasy characters under CC0 for personal and commercial use.
- The Warrior character supplies the Warden's blended idle, walk, run, attack, hit, roll, and death animations.
- Local notice: `assets/models/quaternius-rpg-character/LICENSE-QUATERNIUS-CC0.txt`.

## Biome monster roster

- Runtime directory: `assets/models/quaternius-monsters/`.
- Source: Quaternius Ultimate Monsters, https://quaternius.com/packs/ultimatemonsters.html
- The original pack provides 50 fully animated glTF monsters under CC0 for personal and commercial use.
- This build loads only two biome-selected monsters per run; each includes idle, run, attack, hit-reaction, and death clips.
- Local notice: `assets/models/quaternius-monsters/LICENSE-QUATERNIUS-CC0.txt`.

## PBR biome materials

- Runtime directory: `assets/textures/biomes/`.
- Source: ambientCG, https://ambientcg.com/
- License: CC0; ambientCG permits commercial use and redistribution.
- Curated 1K JPG color, OpenGL-normal, and roughness maps keep the web build sharp without loading impractical 8K archives.
- Asset IDs: Snow015, Ground037, Ground093C, Gravel041, Ground068, and Rocks011.
- Local notice: `assets/textures/biomes/LICENSE-AMBIENTCG-CC0.txt`.

## User-provided biome materials (Release 5.5)

- FreeStylized material library, https://freestylized.com/
- Runtime directory: `assets/textures/freestylized-biomes/`.
- Five user-supplied 1K PBR materials were curated for jungle, shore, mountains, desert, and moon, then transcoded to compact WebP color, OpenGL-normal, and roughness maps. The snow realm retains the existing ambientCG material.
- Exact sources: [Ground Tiles 13](https://freestylized.com/material/ground_tiles_13/), [Ground Tiles 17](https://freestylized.com/material/ground_tiles_17/), [Ground With Rocks 03](https://freestylized.com/material/ground_with_rocks_03/), [Sand 01](https://freestylized.com/material/sand_01/), and [Lava Rocks 01](https://freestylized.com/material/lava_rocks_01/).
- FreeStylized grants royalty-free commercial and non-commercial project use and restricts standalone redistribution of its source content. Exact archive-to-biome mapping and local terms notice: `assets/textures/freestylized-biomes/LICENSE-FREESTYLIZED.md`.

## User-provided Ember Dunes skybox

- Runtime asset: `assets/textures/skyboxes/ember-dunes-sandsky-2k.png`.
- Source archive: `sandskybox.zip`, supplied by the project owner for inclusion in Ashenhold.
- The 2048 x 1024 equirectangular panorama is used only by Ember Dunes; the redundant cubemap faces from the archive are not shipped.
- The supplied archive did not include original author or license metadata. Local provenance and authorization notice: `assets/textures/skyboxes/LICENSE-USER-SUPPLIED.md`.

## Generated tundra grass

- Runtime asset: `assets/textures/tundra-grass-v1.jpg`.
- Generated with OpenAI’s built-in image-generation tool for this game.
- The runtime copy is self-contained; no private workstation path is required to rebuild or deploy the game.
- Final prompt:

> Use case: stylized-concept. Asset type: seamless tileable game terrain texture. Primary request: dense wind-flattened northern tundra grass and moss for a realistic dark-fantasy open-world game. Subject: interwoven short fescue blades, low alpine moss, sparse dried straw, tiny patches of dark mineral soil, subtle natural color variation at multiple scales. Style/medium: highly detailed photorealistic PBR-style albedo texture, production game material, physically plausible surface, neutral delit illumination. Composition/framing: orthographic top-down square surface scan; perfectly seamless on every edge; uniform texel density; no focal clump and no obvious repeating islands. Lighting/mood: flat neutral diffuse capture with no directional lighting. Color palette: deep desaturated forest green, cold olive, muted sage, charcoal soil, restrained pale straw. Materials/textures: crisp individual grass fibers and moss microstructure, natural density variation without bare holes. Constraints: albedo only; seamless tiling; no cast shadows, no specular highlights, no perspective, no horizon, no flowers, no stones, no branches, no objects, no text, no logos, no watermark. Avoid: neon green, lawn stripes, large broad leaves, obvious circular clusters, blur, painterly appearance, repeating motifs.

## Settlement and structure models (Release 5.3)

- KayKit Medieval Hexagon Pack — CC0 1.0, https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0
  Curated complete buildings (tavern, market, blacksmith, homes, windmill, well, towers, church, destroyed building) and props (barrel, crates, sack, tent, weapon rack, flag) in `assets/models/kaykit-medieval/`.
  License copy: `assets/models/kaykit-medieval/LICENSE.txt`. The shared `hexagons_medieval.png` atlas is required by the curated glTF files.
- KayKit Dungeon Remastered — CC0 1.0, https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0
  Curated broken/cracked/arched walls and a column in `assets/models/kaykit-dungeon/` (self-contained GLBs with embedded textures).
  License copy: `assets/models/kaykit-dungeon/LICENSE.txt`.
- Kenney Fantasy Town Kit 2.0 — CC0 1.0, https://www.kenney.nl/assets/fantasy-town-kit
  Curated market stalls, fountain pieces, banners, and cart in `assets/models/kenney-town/`; `Textures/colormap.png` is required by the GLBs.
  License copy: `assets/models/kenney-town/License.txt`.
- Kenney Graveyard Kit 5.0 — CC0 1.0, https://www.kenney.nl/assets/graveyard-kit
  Curated crypts, gravestones, iron fences, altar, grave, crooked pine, and lightpost in `assets/models/kenney-graveyard/`; `Textures/colormap.png` is required by the GLBs.
  License copy: `assets/models/kenney-graveyard/License.txt`.
- Kenney Nature Kit — CC0 1.0, https://www.kenney.nl/assets/nature-kit
  Curated statues, campfire, tent, palms, pines, and cacti in `assets/models/kenney-nature/` (self-contained GLBs with embedded textures).
  License copy: `assets/models/kenney-nature/License.txt`.

## Ancient hero-tree models (Release 5.5)

- FreeStylized Starter Nature Pack — Foliage Kit 01, https://freestylized.com/asset_pack/foliage_kit_01/
- Runtime derivatives: `assets/models/freestylized-foliage/F1_Tree1.glb` and `F1_Tree3.glb`.
- The source FBX meshes were converted to GLB, welded, and quantized for the browser build. Source textures were omitted so Ashenhold can apply its existing biome palette without adding the pack's 19 MB normal map to startup transfer.
- FreeStylized grants royalty-free commercial and non-commercial project use and restricts standalone redistribution of its source content. Local source, adaptation, and terms notice: `assets/models/freestylized-foliage/LICENSE-FREESTYLIZED.md`.

## Project-created visual assets

The sky, terrain, stone, cliff, interface artwork, procedural geometry, shaders, and synthesized audio in this repository were created or generated for the Ashenhold project and are shipped locally. The user-provided `assets/dragons.png` remains a local design reference only; it is no longer used by the game and is excluded from production deployments.

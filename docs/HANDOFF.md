# Engine handoff

The campaign extension is documented in [CAMPAIGN.md](CAMPAIGN.md), including the objective grammar, generators, build systems, renderer, UI and verification.

## Start here

- `npm ci && npm run dev` serves port 5188.
- `npm run check` runs the authoritative simulation tests and strict production build.
- `npm run test:browser` exercises a real WebGPU renderer and the title → game → save → continue → attract → ending → next loop → interrupt path.
- Browser artifacts go to `/tmp/red-sky-qa` by default. Set `QA_OUTPUT` on other machines.
- The public main branch is `michaelcrosato/Red-Sky-Renegades-VM`.
- `npm run test:territory` verifies the expanded map in a hardware WebGPU browser, including a real ride outside the old boundary, discovery, save migration and all eight destinations.

## Territory expansion

The playable half extent is `108 * sqrt(10)` metres, giving exactly ten times the original 216 × 216 m area. `src/game/territory.ts` owns the bounds, scenery extent, eight landmarks, ten new routes, three crossing definitions, region names and additional collision data. Movement, terrain, camera, saves, atlas and scenery consume those definitions.

`src/render/frontier.ts` builds terrain tiles, the full trail network, bridges, landmark models and vegetation. The terrain extends beyond the movement boundary for a complete horizon. Vegetation uses 64 spatial groups with instanced geometry; high/balanced quality selects a 300/210 m visibility radius plus each group's size. Keep actor and prop dimensions in metres when changing territory size.

`src/ui/territory-map.ts` projects world coordinates into the full atlas. The journal cycles one destination at a time and forwards the chosen ID to `Simulation.navigateTo`. Discovery is recorded once per landmark. Camps restore rider/horse cores and trail markers use the existing dialogue system.

Existing version-1 saves migrate additively: missing `discovered` and `explorationTarget` fields default to `[]` and `null`. Original coordinates and mission progress stay intact. New save validation accepts all positions inside the enlarged world, with the same two-metre serialization tolerance used by the original map. Future landmark IDs should remain stable.

## Boundaries

| Module                     | Responsibility                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `src/engine/types.ts`      | Serializable state, command vocabulary, event contract                             |
| `src/engine/math.ts`       | Seeded randomness, terrain height, bridge surface, collision and line of sight     |
| `src/engine/simulation.ts` | Authoritative gameplay; independent of DOM, GPU and audio                          |
| `src/engine/mission.ts`    | Generic mission graph with duplicate and dangling-link validation                  |
| `src/game/mission.ts`      | Content-owned semantic mission transitions                                         |
| `src/game/content.ts`      | Landmarks, obstacles, spawns, objective text, weapons and field guide              |
| `src/game/director.ts`     | Autonomous actor: ordinary movement/aim/actions and normal dialogue responses      |
| `src/engine/input.ts`      | Browser inputs → command values and edges; standard gamepad mapping and dead zones |
| `src/engine/save.ts`       | Versioned story saves, validation, failure containment and settings                |
| `src/engine/audio.ts`      | Procedural score and foley, stereo gunfire, browser gesture unlock                 |
| `src/render/materials.ts`  | TSL cel-lighting bands, ink hulls, water, generated signs                          |
| `src/render/models.ts`     | Reusable actor rigs, horse, buildings, tents and wagon                             |
| `src/render/world.ts`      | Seeded scenery and authored scene composition                                      |
| `src/render/renderer.ts`   | WebGPU init, post-processing, camera, presentation, animation and effects          |
| `src/ui/ui.ts`             | Focus-driven screens, HUD, map, prompts, journal, wheel and settings               |
| `src/main.ts`              | Application states and system orchestration; save/demo isolation                   |

Simulation commands contain continuous values (movement, aim, fire) and edge actions (interact, reload, focus, menu actions). The simulation emits semantic events. Rendering and sound consume events; they never determine a hit, reward, or mission transition.

The game uses a bounded frame delta to prevent a background-tab return from advancing combat by seconds in one step. Pause and narrative choices stop simulation. Focus scales hostile time, while direct movement and camera controls remain responsive. The browser animation loop remains independent of saved simulation state.

## Adding content

### Another frontier story

1. Author landmarks, road points, enemy spawns, obstacles, objective descriptions, and weapon definitions in a content module using the existing shapes.
2. Define a `MissionGraph` using semantic signals. Current systems emit `conversation-finished`, `horse-mounted`, `evidence-read`, `site-reached`, `gang-defeated`, `leader-resolved`, `supplies-collected`, and `supplies-delivered`. `Simulation` accepts a mission graph in its constructor. The graph rejects duplicate nodes and nonexistent destinations.
3. Reuse the scene factories for the new settlement, camps, mounts, targets and enemies. Add authored composition to `world.ts`, or extract a second scene-builder function with the same `World` contract. Terrain and obstacle helpers are shared by camera, actors and combat, so changing them keeps all three aligned.
4. Add objective IDs/text and any new signal emissions required by genuinely new mechanics. Existing travel, investigate, combat, decision and delivery beats need content and graph changes rather than a replacement game loop.
5. Author a corresponding `Director` route for retail demonstration. A demo must never teleport the player, directly deplete enemy health, skip reward logic, or write a story save.
6. Extend the save schema version for breaking serialized-state changes. Additive optional fields can use a validated migration with defaults, as the territory expansion does.
7. Add one end-to-end simulation journey for the story, then inspect its real renderer and controller path.

### Actors, weapons and interactions

Actor geometry is presentation-only. Animation uses existing body/leg/arm pivots and simulation speed/phase. New enemy content can reuse the patrol → investigate → attack/flank → dead state loop. Obstacle occlusion is shared with targeting and camera clipping.

Weapon capacity, damage, cooldown, reload time and range come from `WEAPONS`. The selected weapon uses independent loaded/reserve ammunition. Keep inventory transactions inside the simulation. Add an interaction candidate with a priority, distance and semantic action; the input and prompt systems already consume that interface.

## Intentional scope

- Single-player, local saves, one authored mission, a practice area, and a repeatable procedural campaign across the territory.
- Kinematic ground movement and circular obstacle collision. No Rapier is needed for this content. Bridge height is a shared explicit walkable surface; the river slows travel.
- Hitscan combat with aim assistance and visible tracers. Cover blocks both incoming and outgoing shots.
- Witnessed gunfire near camp changes honor, bounty and search heat. Leave the area to cool the search; camp rest is unavailable during heat. This slice does not spawn police or simulate a town population.
- Wildlife has presentation and avoidance behavior, with no hunting/crafting economy beyond gatherable sage and tonics.
- Dialogue is authored text. Music and effects are synthesized original audio, unlocked by the first browser gesture.
- Weather changes periodically and renders rain/fog. The clock is recorded as world state; there is no full astronomical day/night cycle in this slice.

## Rendering and compatibility

Three.js r180 normally installs a WebGL fallback callback. This project explicitly sets `renderer._getFallback = null` before initialization and checks that the resulting backend is WebGPU. Keep this invariant when upgrading Three.js. Device loss produces a recovery message; it never silently substitutes another backend.

The primary validated path is native Windows Chrome with an NVIDIA adapter. WSL Linux Chromium’s SwiftShader path on this machine showed corrupted/black presentation despite a successful WebGPU initialization; its screenshots cannot establish rendering quality. Native Chrome uses the actual RTX 3060 Ti. Do not interpret the software adapter’s frame rate as a result for an RTX 4070 Super.

WebKit is checked for layout and graceful unsupported-renderer behavior. Linux Playwright WebKit is not real iOS Safari. A supported Safari WebGPU implementation must be evaluated separately on Apple hardware before claiming native Safari gameplay support.

## Automation and inspection

`window.__frontier.snapshot` exposes a cloned, read-only diagnostic snapshot: current screen, backend, real measured frame rate, mission state, camera heading, demo completions/restarts and connected gamepad name. It provides no state mutation or gameplay cheats.

`scripts/browser-session.mjs` can retain a local QA browser on CDP port 9239. Only use it locally and close the owned browser afterward. `scripts/browser-check.mjs` can connect via `CDP_URL` or launch its own browser. Synthetic standard-mapped controller tests validate API handling; physical DualSense ergonomics and haptics remain a hardware check.

The CI workflow builds and tests every change. Main-branch success publishes the static `dist` artifact to GitHub Pages. All runtime assets are self-contained; no secrets, analytics, paid service, or third-party account is involved.

# Red Sky Renegades-VM

**There’s still time to do one good thing.**

An original cel-shaded Western adventure built with **Three.js r180 and WebGPU**. Ride through Cinder Creek, recover a stolen medicine shipment, and decide what kind of name you leave behind.

[Play the game](https://michaelcrosato.github.io/Red-Sky-Renegades-VM/) · [Engine handoff](docs/HANDOFF.md) · [Controls](docs/CONTROLS.md) · [Verification](docs/VERIFICATION.md)

## The Last Good Deed

One complete frontier mission, with a free-roaming territory around it:

1. Speak with Ada at Cinder Creek camp.
2. Saddle Juniper and investigate the raided wagon.
3. Cross the river to Mercy Station.
4. Defeat the Cinder gang using cover, a revolver, a repeater, and time-slowing Focus.
5. Choose mercy or revenge when the leader surrenders.
6. Recover the medicine and bring it home.

Explore the trader, campfire, prairie sage, enemy saddlebags, a forgotten memorial, wildlife, and the consequences of firing near camp. The separate **Proving Ground** provides resettable targets, full equipment, and room to practice riding and combat.

The title screen becomes an autonomous store demo after **10 seconds without input**. Its director plays the actual mission using the same simulation commands as a human player, resolves dialogue and the mercy decision, completes the story, and begins again. Keyboard, pointer, touch, or active gamepad input returns immediately to the title. Demo sessions never write to your story save.

## Play locally

The territory now has **10× its original playable area**: **216 × 216 m → approximately 683.05 × 683.05 m** (466,560 m²). Explore eight new landmarks across pine highlands, Redwash Canyon, Sunscar Highlands, Saltwind Flats and Cottonwood Lowlands. Ten new connecting trails and three river bridges link the territory. Open the journal, cycle destinations with Left/Right, and select **Track this destination** to guide your ride. Discoveries and tracked destinations persist alongside your existing story save.

[Expansion details and evidence](docs/MAP-EXPANSION.md)

```sh
npm ci
npm run dev
```

Open **http://localhost:5188** in a WebGPU-capable browser. Use a standard-mapped controller such as a DualSense. Connect the controller and press a button to make it available to the browser. Keyboard and mouse map to the same actions.

```sh
npm run check       # simulation tests, strict TypeScript and production build
npm run preview    # serve the production build
npm run test:browser # complete browser flow; requires a functioning WebGPU browser
```

`CHROME_PATH` selects a local Chromium/Chrome executable for browser verification. `GAME_URL` changes the URL under test, `QA_OUTPUT` changes its artifact directory, and `CDP_URL` connects to an already running test browser. Tests save screenshots and a JSON report outside the repository.

WebGPU is the only renderer. Unsupported browsers receive an explanation and a retry action; there is no WebGL or canvas-rendered game fallback. Mobile receives the world and a menu button, without touch gameplay controls or a dense HUD. Use a controller on these devices.

## Engine evaluation

This slice exercises reusable input, collision/terrain, riding, combat, enemy perception and flanking, focus time, inventory/trading, honor and witnessed disturbance, mission transitions, saves, audio, procedural animation, and UI state. It uses authored mission data and a generic validated mission graph. A separate retail-demo director consumes the same command interface.

Rendering includes stepped TSL lighting, geometry ink outlines, a WebGPU scene pass and bloom, animated water and vegetation, particles, fog, procedural terrain, mesas, structures, characters, and wildlife. All models, environments, sound effects, and the synthesized score were created for this game. No source-game assets or external runtime services are used.

Progress saves at mission transitions, camp rest, purchases, and safe intervals. Settings persist separately. Death offers checkpoint recovery. New-story replacement has a confirmation screen; ordinary continuation does not.

The engine is a deliberately scoped single-player frontier foundation. Current content uses analytic ground/obstacle collision rather than rigid-body simulation, hitscan weapons rather than simulated ballistics, authored dialogue rather than generated speech, and a witnessed-disturbance/bounty loop rather than a population of police agents. See the handoff for the boundaries and the tested path for adding content.

## Source reference — separate from engine evaluation

| Field            | Reference                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial date     | **2026-10-16**, the first prompt date available in this workspace                                                                                                                                                                                                                     |
| SOURCE           | **Red Dead Redemption 2 for PS4, Xbox One and PC**; thematic and mechanical inspiration only                                                                                                                                                                                          |
| GAME ENGINE      | Original Frontier engine on **Three.js 0.180.0 / r180**, exclusively **WebGPU**; TypeScript and Vite. No physics dependency is required.                                                                                                                                              |
| Handoff          | [docs/HANDOFF.md](docs/HANDOFF.md); [public repository](https://github.com/michaelcrosato/Red-Sky-Renegades-VM)                                                                                                                                                                       |
| Environment      | Codex workspace and Bash CLI on **Ubuntu 26.04.1 under WSL2**. Native Windows Chrome is available for NVIDIA hardware WebGPU testing. Linux Playwright includes Chromium, Firefox and WebKit. The available GPU is an **RTX 3060 Ti**; the requested target is an **RTX 4070 Super**. |
| Model and effort | **OpenAI, Codex, GPT-6 family**. The exact model variant and reasoning effort are not independently exposed; neither is guessed.                                                                                                                                                      |

The brief required model knowledge only; no internet research was used. Package installation and publication used their respective registries and GitHub. Fifty candidate names and the actual random selection are retained in [docs/naming.json](docs/naming.json). The selected candidate was **#14, Red Sky Renegades**, followed by the randomly sampled two-character ID **VM**.

## License

MIT. Original code, geometry, generated textures, and procedural audio. The source game and its trademarks remain the property of their respective owners. This is an independent project.

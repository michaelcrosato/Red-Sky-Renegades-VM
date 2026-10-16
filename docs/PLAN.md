# Red Sky Renegades — delivery contract

Original brief: a complete, polished single-level spiritual successor to Red Dead Redemption 2; reusable engine; Three.js r180; exclusively WebGPU; cel shading; controller-first ten-foot presentation; autonomous input-interruptible attract mode after 10 seconds. No internet research. Public GitHub repository under michaelcrosato.

## Level: The Last Good Deed

Camp conversation → mount Juniper → inspect the raided wagon → ride over the river → fight five outlaws at Mercy Station → choose mercy or revenge → recover medicine → return to Ada → complete result and replay. Exploration supports trader, campfire, herbs, a forgotten grave, looting, wildlife and law consequences. A separate proving ground exposes reusable combat and equipment systems.

## Engine boundaries

- Deterministic simulation, typed command input, event queue and data-driven level content.
- Third-person movement, collision and terrain; mounted riding, horse call, stamina and bond.
- Enemy perception, patrol, pursuit, flanking, cover occlusion, combat and death.
- Revolver/repeater, finite ammunition, reload, aim assistance, time-slowing focus, damage and healing.
- Inventory, trade, honor, witnesses, wanted cooldown, supplies and interaction priorities.
- Mission state machine, dialogue, branching choice, result, checkpoint recovery and versioned saves.
- Gamepad/keyboard input parity, focus menus, radial equipment, journal, options and pause.
- WebGPU-only cel renderer, outlined models, procedural terrain/environment, water, atmosphere, animation, particles and synthesized spatial audio.
- Attract director sends normal simulation commands and loops without writing to player saves.
- Browser and simulation tests; documented content extension, controls, rendering and verification limits.

## Completion evidence

Record build/test results, mission playthrough, repeated attract runs and input interruption, persisted continue/retry, rendering screenshots, browser/viewport results, verified public remote and commit. Source reference metadata appears in README, HTML and chat separately from engine evaluation.

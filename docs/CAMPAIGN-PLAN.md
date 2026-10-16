# Frontier campaign delivery contract

Goal: use the expanded territory for a dynamic mission-hub, job, bounty, task and quest system, with ARPG-inspired leveling and loot. The systems must generate playable activities, interact with one another and remain extensible through content definitions.

## Required player loops

1. Visit one of three physical hubs, browse generated contracts, accept/track up to three, perform their world objectives and claim a single reward at the issuer.
2. Play distinct bounty, raid, recovery, courier, escort, defense, salvage, survey, supply and multi-stage quest activities. Their seeded composition combines destinations, factions, enemy families, challenge modifiers, rewards and regional conditions.
3. Encounter spontaneous field events through the same objective engine. Supply/threat changes influence subsequent offers, enemies, market prices and event selection.
4. Earn XP, levels and talent points through combat, exploration and contracts. Spend points in three build paths with prerequisites, ranks and capstones; respec at a hub.
5. Find item-levelled equipment across six slots, five rarities, randomized affixes, legendary/unique effects, runes and sets. Equip/compare items and apply their stats and effects to actual gameplay.
6. Collect world loot; manage pack/stash; salvage, upgrade, reforge and socket equipment at hubs; buy rotating gear and supplies using the shared economy.
7. Fight scaled enemies, elites and bosses with distinct modifiers, status effects and telegraphed hazards. Evade attacks through a stamina-based dodge. Protect actual escort/defense targets and handle failure/retry.
8. Persist all generated identities, accepted objective progress, actors, rewards, gear, talents, world pressure and crafting transactions. Migrate existing stories without losing them. Bound procedural world state and prevent duplicate rewards.

## Architecture

- Serializable campaign state and typed objective vocabulary.
- Content catalogs for hubs, factions, templates, modifiers, enemies, affixes, items, runes, talents and sets.
- Seeded contract/loot generators, progression and stat aggregation, navigation, objective runtime and territorial event director.
- Existing simulation supplies movement/combat/events; new systems consume the same player actions and coordinate through explicit signals.
- Controller-first hub, contract journal, equipment comparison, talents and workshop screens; world boards, actors, loot and hazard presentation.
- Original mission, map, WebGPU-only renderer, ten-second attract loop and old-save compatibility remain required regression gates.

## Evidence needed before completion

Engine tests for every objective kind, procedural variation/reproducibility, regional interactions, progression/gear effects, crafting transactions, failure/retry, persistence and bounded long-running state. Native WebGPU browser accept → play → reward → equip/upgrade loop, controller navigation, visual inspection, viewport/WebKit checks, original story/demo regression and successful public deployment.

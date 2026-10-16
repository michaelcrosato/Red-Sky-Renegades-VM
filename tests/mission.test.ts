import test from "node:test";
import assert from "node:assert/strict";
import { MissionGraph } from "../src/engine/mission.ts";
test("a different mission and branching route are authored as content", () => {
  const graph = new MissionGraph([
    { id: "arrival", on: { "evidence-read": "negotiation" } },
    {
      id: "negotiation",
      on: { "leader-resolved": "safe-road", "gang-defeated": "hard-road" },
    },
    { id: "safe-road", on: { "supplies-delivered": "ending" } },
    { id: "hard-road", on: { "supplies-delivered": "ending" } },
    { id: "ending", on: {}, terminal: true },
  ]);
  assert.equal(graph.transition("arrival", "evidence-read"), "negotiation");
  assert.equal(graph.transition("negotiation", "leader-resolved"), "safe-road");
  assert.equal(graph.transition("negotiation", "gang-defeated"), "hard-road");
  assert.equal(graph.transition("arrival", "gang-defeated"), null);
  assert.equal(graph.transition("safe-road", "supplies-delivered"), "ending");
});
test("mission graph rejects duplicate stages and broken links", () => {
  assert.throws(
    () =>
      new MissionGraph([
        { id: "a", on: {} },
        { id: "a", on: {} },
      ]),
    /unique/,
  );
  assert.throws(
    () => new MissionGraph([{ id: "a", on: { arrive: "missing" } }]),
    /Unknown/,
  );
});

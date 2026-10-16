import { MissionGraph } from "../engine/mission";
import type { StageId } from "./content";
/** Add/reorder supported beats here; engine systems emit semantic signals. */
export const lastGoodDeed = new MissionGraph<StageId>([
  { id: "meet", on: { "conversation-finished": "mount" } },
  { id: "mount", on: { "horse-mounted": "trail" } },
  { id: "trail", on: { "evidence-read": "outpost" } },
  { id: "outpost", on: { "site-reached": "fight" } },
  { id: "fight", on: { "gang-defeated": "choice" } },
  { id: "choice", on: { "leader-resolved": "medicine" } },
  { id: "medicine", on: { "supplies-collected": "return" } },
  { id: "return", on: { "supplies-delivered": "complete" } },
  { id: "complete", on: {}, terminal: true },
]);

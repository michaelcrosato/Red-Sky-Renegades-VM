import { LANDMARKS } from "./territory";
import { HUBS } from "./campaign/catalog";
export const DESTINATIONS = [
  ...LANDMARKS.map((l) => ({ ...l, isHub: false })),
  ...HUBS.map((h) => ({
    id: `hub:${h.id}`,
    name: h.name,
    x: h.x,
    z: h.z,
    description:
      "Dispatch contracts, claim rewards, trade equipment and use the workshop.",
    isHub: true,
  })),
];
export const destinationById = (id: string | null) =>
  DESTINATIONS.find((d) => d.id === id);

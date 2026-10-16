import { CAMP, POST, STAGES, TRAIL } from "../game/content";
import {
  FRONTIER_ROADS,
  LANDMARKS,
  MAP_HALF_EXTENT,
  MAP_SIZE,
} from "../game/territory";
import { riverX, type Vec2 } from "../engine/math";
import type { GameState } from "../engine/types";
import { HUBS } from "../game/campaign/catalog";
import { campaignNavigation } from "../engine/campaign/queries";

export const mapPoint = (p: Vec2) => ({
  x: 24 + ((p.x + MAP_HALF_EXTENT) / MAP_SIZE) * 372,
  y: 24 + ((p.z + MAP_HALF_EXTENT) / MAP_SIZE) * 372,
});
export function territoryMap(s: GameState, selected: number) {
  const path = (points: readonly Vec2[]) =>
    points
      .map((p, i) => {
        const m = mapPoint(p);
        return `${i ? "L" : "M"}${m.x.toFixed(1)},${m.y.toFixed(1)}`;
      })
      .join(" ");
  const rivers = Array.from({ length: 100 }, (_, i) => {
    const z = -MAP_HALF_EXTENT + (i * MAP_SIZE) / 99;
    return { x: riverX(z), z };
  });
  const player = mapPoint(s.player),
    camp = mapPoint(CAMP),
    post = mapPoint(POST),
    goal = mapPoint(STAGES.find((t) => t.id === s.stage)!.target);
  const task = campaignNavigation(s),
    taskPoint = task ? mapPoint(task.position) : null;
  return `<svg viewBox="0 0 420 440" role="img" aria-label="Cinder Creek territory, eight landmarks, three dispatch hubs and tracked contract">
  <defs><clipPath id="territory-border"><rect x="24" y="24" width="372" height="372" rx="3"/></clipPath></defs>
  <g clip-path="url(#territory-border)"><rect x="24" y="24" width="372" height="372" fill="#c4b389"/><path d="M24 24H210L170 170H24Z" fill="#a4ad83" opacity=".7"/><path d="M260 24H396V260L300 215Z" fill="#b99b6b" opacity=".6"/><path d="M240 280L396 255V396H215Z" fill="#d7c9a1"/>
  <path class="map-river" d="${path(rivers)}"/>
  ${[TRAIL, ...FRONTIER_ROADS].map((r) => `<path class="map-trail" d="${path(r)}"/>`).join("")}
  ${LANDMARKS.map((l, i) => {
    const p = mapPoint(l),
      visited = s.discovered.includes(l.id);
    return `<g class="landmark-map-point ${selected === i + 1 ? "active" : ""}" data-place="${l.id}" transform="translate(${p.x},${p.y})"><circle r="${selected === i + 1 ? 12 : 9}" fill="${selected === i + 1 ? "#ac4f36" : visited ? "#445c45" : "#ddcea8"}" stroke="#445444" stroke-width="1.2"/><text text-anchor="middle" y="4.5" fill="${selected === i + 1 || visited ? "#fff1c8" : "#3b4c3a"}">${i + 1}</text></g>`;
  }).join("")}
  <circle cx="${camp.x}" cy="${camp.y}" r="3.5"/><text x="${camp.x - 7}" y="${camp.y + 16}" text-anchor="end">CINDER CREEK</text>
  <circle cx="${post.x}" cy="${post.y}" r="3.5"/><text x="${post.x + 8}" y="${post.y - 9}">MERCY STATION</text>
  ${HUBS.map((h, i) => {
    const p = mapPoint(h),
      active = selected === LANDMARKS.length + i + 1;
    return `<g class="hub-map-point" data-hub="${h.id}" transform="translate(${p.x},${p.y})">${active ? '<circle r="11" fill="#ac4f36" stroke="#f4d796"/>' : ""}<path d="M-5 0L0-5 5 0V6H-5Z" fill="${active ? "#f1dfb1" : "#536b5b"}" stroke="#d9c99c" stroke-width="1"/></g>`;
  }).join("")}
  ${taskPoint ? `<circle cx="${taskPoint.x}" cy="${taskPoint.y}" r="6" fill="#edc46e" stroke="#9e5940" stroke-width="2"/>` : ""}
  ${selected === 0 ? `<path d="M${goal.x} ${goal.y - 7}l7 7-7 7-7-7Z" fill="#eac879" stroke="#66543b"/>` : ""}
  <path class="map-player" d="M0 -7L-4.5 5 0 2 4.5 5Z" transform="translate(${player.x},${player.y}) rotate(${180 - (s.player.yaw * 180) / Math.PI})"/>
  </g><rect x="24" y="24" width="372" height="372" rx="3" fill="none" stroke="#7c7956" stroke-width="1"/>
  <text x="375" y="16">N ↑</text><path d="M28 414H137M28 410v8M137 410v8" fill="none" stroke="#4a5840"/><text x="82.5" y="433" text-anchor="middle">200 m</text><text x="390" y="424" text-anchor="end">CINDER CREEK TERRITORY</text>
  </svg>`;
}

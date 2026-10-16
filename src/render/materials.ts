import * as T from "three/webgpu";
import {
  color,
  dot,
  normalWorld,
  vec3,
  positionLocal,
  normalLocal,
  float,
  sin,
  time,
  positionWorld,
  mix,
  uv,
  uniform,
} from "three/tsl";
export const PALETTE = {
  ink: "#222a2b",
  sand: "#cc9d61",
  rust: "#ac5136",
  mesa: "#b46944",
  sage: "#777f4d",
  darkSage: "#424f42",
  cream: "#f3d4a0",
  leather: "#683e2b",
  wood: "#77604a",
  red: "#c54834",
  gold: "#efbf64",
  blue: "#4d777d",
  skin: "#c99468",
};
const cache = new Map<string, T.MeshBasicNodeMaterial>();
export function toon(hex: string, wind = false) {
  const key = hex + wind;
  let mat = cache.get(key);
  if (mat) return mat;
  mat = new T.MeshBasicNodeMaterial();
  mat.name = `cel:${hex}`;
  const light = dot(normalWorld, vec3(-0.45, 0.82, 0.36))
    .mul(0.5)
    .add(0.5);
  const bands = light.mul(4).floor().div(4).mul(0.6).add(0.48);
  mat.colorNode = uniform(new T.Color(hex)).mul(bands);
  if (wind)
    mat.positionNode = positionLocal.add(
      vec3(
        sin(
          time
            .mul(1.8)
            .add(positionWorld.x.mul(0.13))
            .add(positionWorld.z.mul(0.1)),
        ).mul(positionLocal.y.max(0).mul(0.08)),
        0,
        0,
      ),
    );
  cache.set(key, mat);
  return mat;
}
export const ink = new T.MeshBasicNodeMaterial({
  color: PALETTE.ink,
  side: T.BackSide,
});
ink.positionNode = positionLocal.add(normalLocal.mul(0.025));
export const box = new T.BoxGeometry(1, 1, 1),
  sphere = new T.IcosahedronGeometry(1, 1),
  lowSphere = new T.IcosahedronGeometry(1, 0),
  cylinder = new T.CylinderGeometry(1, 1, 1, 8),
  cone = new T.ConeGeometry(1, 1, 7);
export function part(
  parent: T.Object3D,
  geo: T.BufferGeometry,
  hex: string,
  p: number[],
  s: number[],
  outlined = false,
): T.Mesh {
  const m = new T.Mesh(geo, toon(hex));
  m.position.set(p[0], p[1], p[2]);
  m.scale.set(s[0], s[1], s[2]);
  parent.add(m);
  if (outlined) {
    const o = new T.Mesh(geo, ink);
    m.add(o);
  }
  return m;
}
export function shadow(parent: T.Object3D, rx: number, rz: number) {
  const m = new T.Mesh(
    new T.CircleGeometry(1, 24),
    new T.MeshBasicNodeMaterial({
      color: "#292b2b",
      transparent: true,
      opacity: 0.23,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.scale.set(rx, rz, 1);
  m.position.y = 0.035;
  parent.add(m);
  return m;
}
export function labelTexture(text: string, fg = "#f1d5a0", bg = "#35433e") {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 5;
  ctx.strokeRect(16, 16, 992, 224);
  ctx.font = "bold 100px Georgia";
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 132, 940);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}
export function waterMaterial() {
  const mat = new T.MeshBasicNodeMaterial({
    transparent: true,
    opacity: 0.93,
    side: T.DoubleSide,
  });
  const ripple = sin(positionWorld.x.mul(2).add(time.mul(0.6))).mul(
    sin(positionWorld.z.mul(1.8).sub(time.mul(0.8))),
  );
  mat.colorNode = mix(
    color("#4a787c"),
    color("#a9b3a0"),
    ripple.smoothstep(0.75, 0.92).mul(0.65),
  );
  mat.positionNode = positionLocal.add(
    vec3(0, sin(positionLocal.x.mul(0.5).add(time)).mul(0.04), 0),
  );
  return mat;
}

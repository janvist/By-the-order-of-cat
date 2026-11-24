// The cutaway living room: meshes + collision boxes. ~12 x 9 m of floor.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Box } from "./physics";

export const COLORS = {
  floor: 0xd9b48c, floorLine: 0xc79f76, wall: 0xf4e4cc, wallTrim: 0xe7cfae,
  couch: 0xb5553c, couchDark: 0x94422e, rug: 0x8fa98a, rugEdge: 0xa9bfa3,
  blue: 0x7fa3c9, cushion: 0xe9c46a, cushion2: 0x7fa3c9, cushion3: 0xe8a598,
  wood: 0xa0704c, gold: 0xf2c14e, cream: 0xfaf0dc,
};

export const clay = (color: number, rough = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });

export interface World {
  scene: THREE.Scene;
  boxes: Box[];
  seat: { minX: number; maxX: number; minZ: number; maxZ: number; top: number; center: THREE.Vector3 };
  seatGlow: THREE.Mesh;
  couchFront: number;
}

function addBlock(
  scene: THREE.Scene, boxes: Box[], w: number, h: number, d: number, color: number,
  x: number, y: number, z: number, opts: { collide?: boolean; radius?: number; shadow?: boolean } = {}
) {
  const radius = opts.radius ?? Math.min(0.08, w / 3, h / 3, d / 3);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), clay(color));
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = opts.shadow ?? true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (opts.collide !== false) {
    boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, bottom: y, top: y + h });
  }
  return mesh;
}

export function buildWorld(): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6e7d2);
  const boxes: Box[] = [];

  // ---- Light: warm daylight ----
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0xcfa98a, 1.4));
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.0);
  sun.position.set(-5, 11, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 30;
  sun.shadow.bias = -0.0008;
  sun.shadow.radius = 4;
  scene.add(sun);

  // ---- Floor, walls ----
  const floor = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.2, 9.4), clay(COLORS.floor));
  floor.position.set(0, -0.1, 0);
  floor.receiveShadow = true;
  scene.add(floor);
  for (let i = -5; i <= 5; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 9.4), clay(COLORS.floorLine));
    line.position.set(i * 1.1, 0.002, 0);
    scene.add(line);
  }
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(12.4, 3.2, 0.25), clay(COLORS.wall));
  backWall.position.set(0, 1.6, -4.72);
  backWall.receiveShadow = true;
  scene.add(backWall);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.4, 9.6), clay(COLORS.wall));
    side.position.set(sx * 6.32, 0.7, 0);
    side.receiveShadow = true;
    scene.add(side);
  }
  const trim = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.16, 0.06), clay(COLORS.wallTrim));
  trim.position.set(0, 0.08, -4.57);
  scene.add(trim);

  // Window + picture on back wall
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.05), clay(0xbcd5ea, 0.4));
  win.position.set(3.6, 2.0, -4.57);
  scene.add(win);
  const winFrame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 0.04), clay(0xfffaf0));
  winFrame.position.set(3.6, 2.0, -4.59);
  scene.add(winFrame);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.05), clay(COLORS.wood));
  frame.position.set(0, 2.15, -4.57);
  scene.add(frame);
  const art = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.06), clay(COLORS.gold));
  art.position.set(0, 2.15, -4.56);
  scene.add(art);

  // Front door (decor, top-left)
  addBlock(scene, boxes, 1.1, 2.2, 0.12, 0xd8c7e6, -4.6, 0, -4.5, { collide: false });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05), clay(COLORS.gold, 0.4));
  knob.position.set(-4.2, 1.05, -4.42);
  scene.add(knob);
  const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.02, 24), clay(0xc9b3a0));
  mat.scale.z = 0.55; mat.position.set(-4.6, 0.01, -3.9);
  scene.add(mat);

  // ---- Rug (shared play space) ----
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.03, 48), clay(COLORS.rug));
  rug.scale.set(1.3, 1, 0.82);
  rug.position.set(0, 0.015, 0.2);
  rug.receiveShadow = true;
  scene.add(rug);
  const rugRing = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.04, 6, 64), clay(COLORS.rugEdge));
  rugRing.rotation.x = Math.PI / 2; rugRing.scale.set(1.3, 0.82, 1);
  rugRing.position.set(0, 0.035, 0.2);
  scene.add(rugRing);

  // ---- Couch (top centre) ----
  const couchFrontZ = -3.25;
  addBlock(scene, boxes, 4.6, 0.42, 1.0, COLORS.couch, 0, 0, -3.75);           // seat base (top 0.42)
  addBlock(scene, boxes, 4.6, 1.15, 0.38, COLORS.couchDark, 0, 0, -4.36);      // backrest
  addBlock(scene, boxes, 0.42, 0.72, 1.3, COLORS.couchDark, -2.1, 0, -3.9);   // arms
  addBlock(scene, boxes, 0.42, 0.72, 1.3, COLORS.couchDark, 2.1, 0, -3.9);
  // seat cushions (decor, part of seat)
  for (const x of [-1.25, 0, 1.25]) addBlock(scene, boxes, 1.2, 0.1, 0.9, x === 0 ? COLORS.couch : 0xc0644a, x, 0.42, -3.72, { radius: 0.05 });
  const seatTop = 0.52;

  // Low steps on both ends (two routes up)
  addBlock(scene, boxes, 0.6, 0.24, 0.6, COLORS.wood, -2.75, 0, -3.0);
  addBlock(scene, boxes, 0.6, 0.24, 0.6, COLORS.wood, 2.75, 0, -3.0);

  // Golden seat marker on the middle cushion
  const seat = { minX: -0.6, maxX: 0.6, minZ: -4.15, maxZ: -3.3, top: seatTop, center: new THREE.Vector3(0, seatTop, -3.72) };
  const goldMat = new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.35, metalness: 0.25, emissive: 0x6b4a00, emissiveIntensity: 0.25 });
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 40), goldMat);
  marker.scale.z = 0.8; marker.position.set(0, seatTop + 0.016, -3.72);
  scene.add(marker);
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  glow.rotation.x = -Math.PI / 2; glow.scale.y = 0.8;
  glow.position.set(0, seatTop + 0.04, -3.72);
  scene.add(glow);

  // ---- Treat station (right) ----
  addBlock(scene, boxes, 1.0, 0.9, 0.7, 0xb9cbb5, 5.15, 0, -1.4);
  for (const z of [-1.6, -1.2]) {
    const chute = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 16), clay(COLORS.blue));
    chute.position.set(5.0, 1.15, z);
    scene.add(chute);
  }
  for (const z of [-0.7, -2.1]) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.12, 20), clay(COLORS.blue, 0.5));
    bowl.position.set(4.9, 0.06, z);
    bowl.castShadow = true;
    scene.add(bowl);
  }

  // ---- Toy corner (bottom left): two baskets ----
  for (const [x, z] of [[-5.0, 2.6], [-5.0, 3.6]] as const) {
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.36, 20), clay(0xd8a65c));
    basket.position.set(x, 0.18, z);
    basket.castShadow = true;
    scene.add(basket);
    boxes.push({ minX: x - 0.36, maxX: x + 0.36, minZ: z - 0.36, maxZ: z + 0.36, bottom: 0, top: 0.36 });
  }

  // ---- Armchair (bottom right) ----
  addBlock(scene, boxes, 1.3, 0.45, 1.2, COLORS.blue, 4.8, 0, 2.9);
  addBlock(scene, boxes, 1.3, 1.0, 0.3, 0x6b8fb4, 4.8, 0, 3.55);
  addBlock(scene, boxes, 0.25, 0.65, 1.2, 0x6b8fb4, 4.25, 0, 2.95);
  addBlock(scene, boxes, 0.25, 0.65, 1.2, 0x6b8fb4, 5.35, 0, 2.95);

  // ---- Side table (left) ----
  addBlock(scene, boxes, 0.7, 0.5, 0.7, COLORS.wood, -3.6, 0, -1.2, { radius: 0.06 });
  addBlock(scene, boxes, 0.8, 0.06, 0.8, 0xc08a5f, -3.6, 0.5, -1.2, { radius: 0.03 });

  // ---- Plant (decor, top right corner) ----
  addBlock(scene, boxes, 0.45, 0.45, 0.45, 0xd9825b, 5.5, 0, -4.1, { radius: 0.1 });
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), clay(0x81b29a));
  leaves.position.set(5.5, 0.85, -4.1);
  leaves.castShadow = true;
  scene.add(leaves);

  return { scene, boxes, seat, seatGlow: glow, couchFront: couchFrontZ };
}

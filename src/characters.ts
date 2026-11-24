// Procedural, rounded "clay" characters. Each rig faces +Z in local space.
import * as THREE from "three";
import { clay } from "./world";

export interface RigState {
  speed: number;       // horizontal speed (m/s)
  grounded: boolean;
  carrying: boolean;
  time: number;
  stunned: boolean;
  happy: boolean;      // victory / joy: tail goes wild
  sitting: boolean;    // on the golden seat, idle
}

export interface Rig {
  root: THREE.Group;
  animate(s: RigState, dt: number): void;
  pulse(): void;       // ability gesture
  setCrown?(on: boolean): void;
  carryPoint: THREE.Object3D;
}

const sphere = (r: number, color: number, seg = 20) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), clay(color));
  m.castShadow = true;
  return m;
};
const eye = (r = 0.032) => {
  const g = new THREE.Group();
  const e = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshStandardMaterial({ color: 0x2d2220, roughness: 0.3 }));
  const glint = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  glint.position.set(r * 0.35, r * 0.35, r * 0.7);
  g.add(e, glint);
  return g;
};
function leg(r: number, h: number, color: number) {
  const pivot = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 4, 10), clay(color));
  m.position.y = -h / 2;
  m.castShadow = true;
  pivot.add(m);
  return pivot;
}
function footRing(color: number, r: number) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.82, r, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  ring.renderOrder = 1;
  return ring;
}

// ---------------------------------------------------------------- CAT
export function makeCat(): Rig {
  const FUR = 0x9d93b8, LIGHT = 0xd7d0e6, DARK = 0x7d729c, PINK = 0xf4a7b0, COLLAR = 0xe07a5f;
  const root = new THREE.Group();
  root.add(footRing(COLLAR, 0.42));
  const body = new THREE.Group();
  root.add(body);

  const torso = sphere(0.24, FUR);
  torso.scale.set(0.85, 0.85, 1.45);
  torso.position.set(0, 0.36, -0.02);
  const belly = sphere(0.18, LIGHT);
  belly.scale.set(0.8, 0.7, 1.3);
  belly.position.set(0, 0.3, 0.04);
  body.add(torso, belly);

  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.1, 0.2], [0.1, 0.2], [-0.1, -0.22], [0.1, -0.22]]) {
    const l = leg(0.05, 0.2, FUR);
    l.position.set(x, 0.3, z);
    body.add(l); legs.push(l);
  }

  const head = new THREE.Group();
  head.position.set(0, 0.6, 0.3);
  body.add(head);
  const skull = sphere(0.2, FUR);
  skull.scale.set(1.08, 0.95, 0.95);
  head.add(skull);
  const muzzle = sphere(0.08, LIGHT);
  muzzle.scale.set(1.3, 0.8, 0.8);
  muzzle.position.set(0, -0.06, 0.15);
  head.add(muzzle);
  const nose = sphere(0.025, PINK, 10);
  nose.position.set(0, -0.03, 0.21);
  head.add(nose);
  for (const s of [-1, 1]) {
    const e = eye(0.034);
    e.position.set(s * 0.08, 0.03, 0.16);
    head.add(e);
    const cheek = sphere(0.035, PINK, 10);
    cheek.position.set(s * 0.13, -0.05, 0.12);
    (cheek.material as THREE.MeshStandardMaterial).transparent = true;
    (cheek.material as THREE.MeshStandardMaterial).opacity = 0.6;
    head.add(cheek);
  }
  const ears: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const ep = new THREE.Group();
    ep.position.set(s * 0.12, 0.13, 0);
    ep.rotation.z = -s * 0.25;
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.18, 4), clay(FUR));
    ear.position.y = 0.08; ear.rotation.y = Math.PI / 4; ear.castShadow = true;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 4), clay(PINK));
    inner.position.set(0, 0.07, 0.025); inner.rotation.y = Math.PI / 4;
    ep.add(ear, inner);
    head.add(ep); ears.push(ep);
  }
  // paper crown
  const crown = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.07, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.6, side: THREE.DoubleSide }));
  crown.add(band);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 4), clay(0xf2c14e, 0.6));
    spike.position.set(Math.sin(a) * 0.11, 0.065, Math.cos(a) * 0.11);
    crown.add(spike);
  }
  const jewel = sphere(0.018, 0xe56b6f, 8);
  jewel.position.set(0, 0.0, 0.12);
  crown.add(jewel);
  crown.position.set(0, 0.2, -0.02);
  crown.rotation.z = 0.15;
  head.add(crown);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 20), clay(COLLAR));
  collar.position.set(0, 0.5, 0.22); collar.rotation.x = Math.PI / 2.4;
  body.add(collar);

  // tail: chain of segments
  const tail = new THREE.Group();
  tail.position.set(0, 0.42, -0.32);
  body.add(tail);
  const tailSegs: THREE.Group[] = [];
  let parent: THREE.Object3D = tail;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? 0 : 0.075, 0);
    const m = sphere(0.042 - i * 0.003, i === 5 ? DARK : FUR, 10);
    m.scale.y = 1.4;
    m.position.y = 0.035;
    seg.add(m);
    parent.add(seg);
    parent = seg;
    tailSegs.push(seg);
  }

  const carryPoint = new THREE.Object3D();
  carryPoint.position.set(0, 0.62, 0.5);
  body.add(carryPoint);

  let pulseT = 0;
  return {
    root, carryPoint,
    setCrown: (on) => (crown.visible = on),
    pulse: () => (pulseT = 0.35),
    animate(s, dt) {
      const t = s.time;
      const moving = s.speed > 0.4 && s.grounded;
      const swing = moving ? Math.sin(t * 16) * 0.7 * Math.min(1, s.speed / 4) : 0;
      legs[0].rotation.x = swing; legs[3].rotation.x = swing;
      legs[1].rotation.x = -swing; legs[2].rotation.x = -swing;
      if (!s.grounded) legs.forEach((l, i) => (l.rotation.x = i < 2 ? -0.7 : 0.7));
      body.position.y = moving ? Math.abs(Math.sin(t * 16)) * 0.04 : (s.sitting ? -0.04 : Math.sin(t * 2) * 0.008);
      // tail: confident flick, faster when happy
      const tailSpeed = s.happy ? 9 : moving ? 6 : 2.2;
      tailSegs.forEach((seg, i) => {
        seg.rotation.x = -0.28 + (i === 0 ? -0.5 : 0);
        seg.rotation.z = Math.sin(t * tailSpeed - i * 0.5) * (s.happy ? 0.35 : 0.18);
      });
      const earDroop = s.stunned ? 0.9 : 0;
      ears.forEach((e) => { e.rotation.x = THREE.MathUtils.lerp(e.rotation.x, earDroop, 10 * dt); });
      head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, s.stunned ? 0.35 : 0, 10 * dt);
      head.rotation.x = s.carrying ? -0.15 : 0;
      pulseT = Math.max(0, pulseT - dt);
      const p = pulseT > 0 ? Math.sin((pulseT / 0.35) * Math.PI) * 0.12 : 0;
      body.scale.set(1 + p, 1 - p * 0.5, 1 + p);
      if (!s.grounded) body.scale.set(0.92, 1.1, 0.92);
    },
  };
}

// ---------------------------------------------------------------- DOG
export function makeDog(): Rig {
  const FUR = 0xe2a75c, LIGHT = 0xf3cf94, DARK = 0xb97a3a, SNOUT = 0xfbe6c6, COLLAR = 0x5b8fc7;
  const root = new THREE.Group();
  root.add(footRing(COLLAR, 0.55));
  const body = new THREE.Group();
  root.add(body);

  const torso = sphere(0.32, FUR);
  torso.scale.set(0.95, 0.85, 1.45);
  torso.position.set(0, 0.5, -0.05);
  const chest = sphere(0.22, LIGHT);
  chest.scale.set(1, 1, 0.8);
  chest.position.set(0, 0.5, 0.28);
  body.add(torso, chest);

  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.16, 0.28], [0.16, 0.28], [-0.16, -0.34], [0.16, -0.34]]) {
    const l = leg(0.075, 0.26, FUR);
    l.position.set(x, 0.4, z);
    body.add(l); legs.push(l);
  }

  const head = new THREE.Group();
  head.position.set(0, 0.86, 0.42);
  body.add(head);
  const skull = sphere(0.25, LIGHT);
  head.add(skull);
  const muzzle = sphere(0.13, SNOUT);
  muzzle.scale.set(1.1, 0.85, 1.15);
  muzzle.position.set(0, -0.07, 0.2);
  head.add(muzzle);
  const nose = sphere(0.05, 0x3a2a26, 12);
  nose.scale.set(1.2, 0.85, 1);
  nose.position.set(0, -0.02, 0.34);
  head.add(nose);
  const tongue = sphere(0.045, 0xef7f8b, 10);
  tongue.scale.set(1, 0.5, 1.4);
  tongue.position.set(0, -0.15, 0.26);
  head.add(tongue);
  for (const s of [-1, 1]) {
    const e = eye(0.04);
    e.position.set(s * 0.1, 0.06, 0.2);
    head.add(e);
  }
  const ears: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const ep = new THREE.Group();
    ep.position.set(s * 0.21, 0.1, -0.02);
    const ear = sphere(0.11, DARK);
    ear.scale.set(0.45, 1.25, 0.85);
    ear.position.set(s * 0.03, -0.12, 0);
    ep.add(ear);
    head.add(ep); ears.push(ep);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 8, 22), clay(COLLAR));
  collar.position.set(0, 0.7, 0.33); collar.rotation.x = Math.PI / 2.6;
  body.add(collar);
  const tag = sphere(0.04, 0xf2c14e, 10);
  tag.position.set(0, 0.6, 0.48);
  body.add(tag);

  const tail = new THREE.Group();
  tail.position.set(0, 0.62, -0.5);
  body.add(tail);
  const tailMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.32, 4, 10), clay(FUR));
  tailMesh.position.y = 0.18; tailMesh.castShadow = true;
  tail.add(tailMesh);
  tail.rotation.x = -0.7;

  const carryPoint = new THREE.Object3D();
  carryPoint.position.set(0, 0.72, 0.78);
  body.add(carryPoint);

  // sniff nose marker
  let pulseT = 0;
  return {
    root, carryPoint,
    pulse: () => (pulseT = 0.35),
    animate(s, dt) {
      const t = s.time;
      const moving = s.speed > 0.4 && s.grounded;
      const swing = moving ? Math.sin(t * 13) * 0.6 * Math.min(1, s.speed / 4) : 0;
      legs[0].rotation.x = swing; legs[3].rotation.x = swing;
      legs[1].rotation.x = -swing; legs[2].rotation.x = -swing;
      if (!s.grounded) legs.forEach((l, i) => (l.rotation.x = i < 2 ? -0.8 : 0.8));
      // bouncy
      body.position.y = moving ? Math.abs(Math.sin(t * 13)) * 0.07 : (s.sitting ? -0.06 : Math.sin(t * 2.5) * 0.01);
      const wag = s.happy ? 22 : moving ? 12 : 5;
      tail.rotation.z = Math.sin(t * wag) * (s.stunned ? 0.05 : 0.55);
      tail.rotation.x = s.stunned ? 0.6 : -0.7;
      ears.forEach((e, i) => (e.rotation.z = (i ? 1 : -1) * (moving ? 0.25 + Math.sin(t * 13) * 0.15 : s.stunned ? 0.5 : 0.1)));
      head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, s.stunned ? -0.4 : 0, 10 * dt);
      tongue.visible = s.happy || moving;
      pulseT = Math.max(0, pulseT - dt);
      const p = pulseT > 0 ? Math.sin((pulseT / 0.35) * Math.PI) : 0;
      head.position.z = 0.42 + p * 0.1;
      body.scale.set(1, 1, 1);
      if (!s.grounded) body.scale.set(0.94, 1.08, 0.94);
    },
  };
}

// Lightweight custom physics: upright cylinders (characters and props) against
// axis-aligned boxes (furniture). Enough for walking, jumping, standing on furniture
// and stacking cushions. Swap for Rapier later if the design needs real rigid bodies.

import * as THREE from "three";

export interface Box {
  minX: number; maxX: number; minZ: number; maxZ: number;
  bottom: number; top: number;
  owner?: Body; // set for boxes that come from a dynamic body (cushions)
}

export const ROOM = { minX: -5.85, maxX: 5.85, minZ: -4.4, maxZ: 4.35 };
export const GRAVITY = 20;
const STEP_UP = 0.14;

export class Body {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  grounded = false;
  groundedTime = 0;
  airTime = 0;
  enabled = true;
  /** Prop bodies that others can stand on (cushions). */
  solidTop = false;
  /** Bounciness on landing (balls). */
  bounce = 0;
  friction = 10;
  mass = 1;
  /** The dynamic body this one is standing on, if any (e.g. a cushion). */
  supportOwner: Body | null = null;

  constructor(public radius: number, public height: number) {}

  asBox(): Box {
    const r = this.radius * 0.95;
    return {
      minX: this.pos.x - r, maxX: this.pos.x + r, minZ: this.pos.z - r, maxZ: this.pos.z + r,
      bottom: this.pos.y, top: this.pos.y + this.height, owner: this,
    };
  }
}

function circleBoxPush(x: number, z: number, r: number, b: Box): [number, number] | null {
  const cx = Math.max(b.minX, Math.min(x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
  let dx = x - cx, dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    return [(dx / d) * (r - d), (dz / d) * (r - d)];
  }
  // centre inside box: push out along the shallowest side
  const left = x - b.minX, right = b.maxX - x, back = z - b.minZ, front = b.maxZ - z;
  const m = Math.min(left, right, back, front);
  if (m === left) return [-(left + r), 0];
  if (m === right) return [right + r, 0];
  if (m === back) return [0, -(back + r)];
  return [0, front + r];
}

const overlapsXZ = (x: number, z: number, r: number, b: Box) => {
  const cx = Math.max(b.minX, Math.min(x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
  return (x - cx) ** 2 + (z - cz) ** 2 < r * r;
};

/** Integrate one body for one fixed step against static + dynamic boxes. */
export function stepBody(body: Body, dt: number, boxes: Box[], applyFriction: boolean) {
  if (!body.enabled) return;
  const prevY = body.pos.y;

  body.vel.y -= GRAVITY * dt;
  if (applyFriction && body.grounded) {
    const f = Math.max(0, 1 - body.friction * dt);
    body.vel.x *= f; body.vel.z *= f;
  }

  // Horizontal move + push out of anything taller than a small step.
  body.pos.x += body.vel.x * dt;
  body.pos.z += body.vel.z * dt;
  for (const b of boxes) {
    if (b.owner === body) continue;
    if (b.top <= body.pos.y + STEP_UP || b.bottom >= body.pos.y + body.height) continue;
    const p = circleBoxPush(body.pos.x, body.pos.z, body.radius, b);
    if (p) {
      body.pos.x += p[0]; body.pos.z += p[1];
      if (p[0] !== 0 && Math.sign(p[0]) !== Math.sign(body.vel.x)) body.vel.x *= -body.bounce;
      if (p[1] !== 0 && Math.sign(p[1]) !== Math.sign(body.vel.z)) body.vel.z *= -body.bounce;
    }
  }
  // Room walls
  const r = body.radius;
  if (body.pos.x < ROOM.minX + r) { body.pos.x = ROOM.minX + r; body.vel.x = Math.abs(body.vel.x) * body.bounce; }
  if (body.pos.x > ROOM.maxX - r) { body.pos.x = ROOM.maxX - r; body.vel.x = -Math.abs(body.vel.x) * body.bounce; }
  if (body.pos.z < ROOM.minZ + r) { body.pos.z = ROOM.minZ + r; body.vel.z = Math.abs(body.vel.z) * body.bounce; }
  if (body.pos.z > ROOM.maxZ - r) { body.pos.z = ROOM.maxZ - r; body.vel.z = -Math.abs(body.vel.z) * body.bounce; }

  // Vertical move + landing on the highest surface underneath.
  body.pos.y += body.vel.y * dt;
  let ground = 0;
  let groundBox: Box | null = null;
  const footR = body.radius * 0.7;
  for (const b of boxes) {
    if (b.owner === body) continue;
    if (b.top > Math.max(prevY, body.pos.y) + STEP_UP) continue;
    if (overlapsXZ(body.pos.x, body.pos.z, footR, b) && b.top > ground) { ground = b.top; groundBox = b; }
  }
  const wasGrounded = body.grounded;
  if (body.pos.y <= ground) {
    body.pos.y = ground;
    if (body.vel.y < -3 && body.bounce > 0) body.vel.y = -body.vel.y * body.bounce;
    else body.vel.y = 0;
    body.grounded = body.vel.y === 0;
    body.supportOwner = groundBox?.owner ?? null;
  } else {
    body.grounded = false;
    body.supportOwner = null;
  }
  if (body.grounded) { body.groundedTime += dt; body.airTime = 0; }
  else { body.airTime += dt; body.groundedTime = 0; }
  return !wasGrounded && body.grounded;
}

/** Push two overlapping bodies apart, sharing the correction by mass. */
export function separate(a: Body, b: Body, strength = 1) {
  if (!a.enabled || !b.enabled) return false;
  // Not overlapping vertically (one standing on the other) → no push.
  if (a.pos.y >= b.pos.y + b.height - STEP_UP || b.pos.y >= a.pos.y + a.height - STEP_UP) return false;
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  const minD = a.radius + b.radius;
  const d2 = dx * dx + dz * dz;
  if (d2 >= minD * minD) return false;
  const d = Math.sqrt(d2) || 0.001;
  const push = (minD - d) * strength;
  const nx = dx / d, nz = dz / d;
  const total = a.mass + b.mass;
  a.pos.x -= nx * push * (b.mass / total); a.pos.z -= nz * push * (b.mass / total);
  b.pos.x += nx * push * (a.mass / total); b.pos.z += nz * push * (a.mass / total);
  return true;
}

export function inCone(from: THREE.Vector3, facing: number, to: THREE.Vector3, range: number, halfAngleDeg: number) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d > range || d < 0.001) return d < 0.001;
  const ang = Math.atan2(dx, dz);
  let diff = Math.abs(ang - facing) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff <= (halfAngleDeg * Math.PI) / 180;
}

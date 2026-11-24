// Level runtime: explore the room as the cat, use objects, talk to Bruno.
import * as THREE from "three";
import { Body, Box, stepBody, separate } from "./physics";
import { makeCat, makeDog, Rig } from "./characters";
import { World, clay, COLORS } from "./world";
import { Input } from "./input";
import { SFX } from "./audio";
import { Dialogue } from "./dialogue";
import { Choice, Cond, Level, Mood, REGALIA, Spot, MeshKind } from "./content";
import { save, upgradeLevel } from "./save";

const CAT_SPEED = 4.2;
const JUMP_V = 6.6;
const JUMP_BUFFER = 0.12;
const COYOTE = 0.1;
const USE_RANGE = 1.35;
const TALK_RANGE = 1.7;

class Actor {
  body: Body;
  facing = Math.PI;
  jumpBuffer = 0;
  speed = 0;
  happy = 0;
  stunned = 0;
  constructor(public rig: Rig, r: number, h: number) { this.body = new Body(r, h); this.body.friction = 14; }
  get grounded() { return this.body.grounded || this.body.airTime < COYOTE; }
}

export type Phase = "explore" | "talk" | "cutscene" | "done";

export interface TalkOption {
  choice: Choice;
  available: boolean;
  delta: number;
}

export interface Hooks {
  onEmote(emoji: string): void;
  onBelief(value: number, delta: number): void;
  onInventory(): void;
  onFinished(won: boolean): void;
}

const MOOD_EMOJI: Record<Mood, string> = { neutral: "💬", happy: "💛", confused: "❓", scared: "😱", annoyed: "😤", impressed: "✨" };

export class Adventure {
  cat: Actor;
  dog: Actor;
  level!: Level;
  phase: Phase = "done";
  belief = 0;
  audiences = 0;
  audiencesMax = 0;
  inventory = new Set<string>();
  flags = new Set<string>();
  used = new Set<string>();       // used choices
  usedSpots = new Set<string>();
  prompt = "";
  promptTarget: THREE.Vector3 | null = null;
  focus = new THREE.Vector3();     // camera focus point while talking

  private spotMeshes = new Map<string, THREE.Object3D>();
  private highlight: THREE.Mesh;
  private ambientT = 8;
  private cut: { t: number; steps: { at: number; fn: () => void }[]; i: number } | null = null;
  private dogTarget: THREE.Vector3 | null = null;
  private carried: THREE.Object3D | null = null;
  private t = 0;

  constructor(private world: World, private input: Input, private dialogue: Dialogue, private hooks: Hooks) {
    this.cat = new Actor(makeCat(), 0.3, 0.7);
    this.dog = new Actor(makeDog(), 0.42, 1.0);
    this.dog.body.mass = 1.4;
    world.scene.add(this.cat.rig.root, this.dog.rig.root);
    this.highlight = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.36, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    this.highlight.rotation.x = -Math.PI / 2;
    this.highlight.visible = false;
    world.scene.add(this.highlight);
  }

  // ---------------------------------------------------------------- setup
  start(level: Level) {
    this.level = level;
    for (const m of this.spotMeshes.values()) this.world.scene.remove(m);
    this.spotMeshes.clear();
    if (this.carried) { this.world.scene.remove(this.carried); this.carried = null; }
    this.inventory = new Set(save.regalia.filter((r) => REGALIA.includes(r)));
    this.flags.clear(); this.used.clear(); this.usedSpots.clear();
    this.belief = Math.min(90, level.startBelief + upgradeLevel("respect") * 10);
    this.audiencesMax = level.audiences + upgradeLevel("audience");
    this.audiences = this.audiencesMax;
    this.cat.body.pos.set(-1.4, 0, 3.0); this.cat.body.vel.set(0, 0, 0); this.cat.facing = Math.PI; this.cat.happy = 0;
    this.dog.body.pos.set(...level.dogSpot); this.dog.body.vel.set(0, 0, 0); this.dog.facing = level.dogFacing; this.dog.happy = 0;
    this.dogTarget = null;
    this.cut = null;
    this.ambientT = 9;
    for (const s of level.spots) this.addSpotMesh(s);
    this.refreshCrown();
    this.phase = "explore";
    this.hooks.onInventory();
    this.hooks.onBelief(this.belief, 0);
  }

  private refreshCrown() { this.cat.rig.setCrown?.(this.inventory.has("crown")); }

  private addSpotMesh(s: Spot) {
    const m = spotMesh(s.mesh);
    m.position.set(...s.pos);
    this.world.scene.add(m);
    this.spotMeshes.set(s.id, m);
  }

  // ---------------------------------------------------------------- conditions
  meets(c?: Cond) {
    if (!c) return true;
    if (c.has && !c.has.every((h) => this.inventory.has(h))) return false;
    if (c.flags && !c.flags.every((f) => this.flags.has(f))) return false;
    if (c.notFlags && c.notFlags.some((f) => this.flags.has(f))) return false;
    return true;
  }

  choiceDelta(c: Choice) {
    let d = c.belief;
    if (c.praise) d += upgradeLevel("purr") * 8;
    return d;
  }

  talkOptions(): TalkOption[] {
    return this.level.choices
      .filter((c) => !this.used.has(c.id))
      .map((c) => ({ choice: c, available: this.meets(c.requires), delta: this.choiceDelta(c) }));
  }

  greeting() {
    let line = this.level.greetings[0][1];
    for (const [min, text] of this.level.greetings) if (this.belief >= min) line = text;
    return line;
  }

  // ---------------------------------------------------------------- talking
  beginTalk() {
    if (this.audiences <= 0) return false;
    this.phase = "talk";
    this.cat.body.vel.set(0, this.cat.body.vel.y, 0);
    this.cat.facing = Math.atan2(this.dog.body.pos.x - this.cat.body.pos.x, this.dog.body.pos.z - this.cat.body.pos.z);
    this.dog.facing = Math.atan2(this.cat.body.pos.x - this.dog.body.pos.x, this.cat.body.pos.z - this.dog.body.pos.z);
    this.hooks.onEmote("❗");
    return true;
  }

  say(id: string) {
    const c = this.level.choices.find((x) => x.id === id)!;
    if (!c || this.used.has(id) || !this.meets(c.requires) || this.audiences <= 0) return null;
    const delta = this.choiceDelta(c);
    this.used.add(id);
    this.audiences--;
    this.belief = Math.max(0, Math.min(100, this.belief + delta));
    c.sets?.forEach((f) => this.flags.add(f));
    c.consumes?.forEach((i) => this.inventory.delete(i));
    if (c.consumes?.length) this.hooks.onInventory();
    this.hooks.onBelief(this.belief, delta);
    this.hooks.onEmote(MOOD_EMOJI[c.mood]);
    if (c.mood === "happy" || c.mood === "impressed") { this.dog.happy = 2.5; this.dog.body.vel.y = 3; SFX.good(); }
    else if (c.mood === "scared") { this.dog.stunned = 1.2; SFX.bad(); }
    else if (delta < 0) { SFX.bad(); this.dog.stunned = 0.6; }
    else SFX.good();
    return { choice: c, delta };
  }

  /** Close the conversation; returns what happens next. */
  endTalk(): "win" | "lose" | "continue" {
    if (this.belief >= 100) { this.startWin(); return "win"; }
    if (this.audiences <= 0) { this.startLose(); return "lose"; }
    this.phase = "explore";
    return "continue";
  }

  // ---------------------------------------------------------------- cutscenes
  private runCut(steps: { at: number; fn: () => void }[]) {
    this.phase = "cutscene";
    this.cut = { t: 0, steps, i: 0 };
  }

  private startWin() {
    const L = this.level;
    const lines = L.win;
    const steps: { at: number; fn: () => void }[] = [];
    steps.push({ at: 0.2, fn: () => this.dialogue.say({ id: "win", priority: 9, lines }) });
    if (L.winScene === "seat") {
      steps.push({ at: 0.4, fn: () => { this.dogTarget = new THREE.Vector3(1.6, 0, -1.2); } });
      steps.push({ at: 2.0, fn: () => this.hopCatTo(new THREE.Vector3(0, 0.52, -3.7)) });
    } else if (L.winScene === "biscuit") {
      steps.push({ at: 0.6, fn: () => {
        const b = spotMesh("biscuit");
        b.position.set(4.9, 0.15, -0.7);
        this.world.scene.add(b);
        this.carried = b;
        this.slide(b, new THREE.Vector3(this.cat.body.pos.x, 0.08, this.cat.body.pos.z + 0.2), 1.2);
      } });
    } else if (L.winScene === "fetch") {
      const cushion = this.spotMeshes.get("cushion");
      const cp = cushion ? cushion.position.clone() : new THREE.Vector3(-2.6, 0, -2.3);
      steps.push({ at: 0.3, fn: () => { this.dogTarget = new THREE.Vector3(cp.x + 0.6, 0, cp.z + 0.4); } });
      steps.push({ at: 2.3, fn: () => {
        const shown = this.spotMeshes.get("toyShow");
        if (shown) { this.world.scene.remove(shown); this.spotMeshes.delete("toyShow"); }
        const toy = spotMesh("goldtoy");
        this.world.scene.add(toy);
        this.carried = toy;
        SFX.squeak();
        this.dogTarget = new THREE.Vector3(-4.3, 0, 2.6);
      } });
      steps.push({ at: 5.2, fn: () => {
        if (this.carried) { this.carried.position.set(-5.0, 0.45, 2.6); }
        this.carried = null;
        SFX.squeak();
      } });
    }
    const end = L.winScene === "fetch" ? 6.2 : 4.2;
    steps.push({ at: end - 1.2, fn: () => { this.cat.happy = 99; this.dog.happy = 99; SFX.fanfare(); } });
    steps.push({ at: end, fn: () => { this.phase = "done"; this.hooks.onFinished(true); } });
    this.runCut(steps);
  }

  private startLose() {
    this.runCut([
      { at: 0.2, fn: () => { this.dialogue.say({ id: "fail", priority: 9, lines: [{ who: "DOG", text: this.level.fail }] }); this.hooks.onEmote("😌"); SFX.sad(); } },
      { at: 2.6, fn: () => { this.phase = "done"; this.hooks.onFinished(false); } },
    ]);
  }

  private hop: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  private hopCatTo(to: THREE.Vector3) { this.hop = { from: this.cat.body.pos.clone(), to, t: 0 }; SFX.jump(); }
  private slides: { obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number }[] = [];
  private slide(obj: THREE.Object3D, to: THREE.Vector3, dur: number) { this.slides.push({ obj, from: obj.position.clone(), to, t: 0, dur }); }

  // ---------------------------------------------------------------- per-step
  step(dt: number) {
    this.t += dt;
    if (this.phase === "done") return;

    // cutscene timeline
    if (this.cut) {
      this.cut.t += dt;
      while (this.cut && this.cut.i < this.cut.steps.length && this.cut.t >= this.cut.steps[this.cut.i].at) {
        const s = this.cut.steps[this.cut.i++];
        s.fn();
      }
    }

    if (this.phase === "explore") this.controlCat(dt);
    else this.brake(this.cat, dt);

    this.controlDog(dt);

    const boxes: Box[] = this.world.boxes;
    for (const a of [this.cat, this.dog]) {
      a.stunned = Math.max(0, a.stunned - dt);
      a.happy = Math.max(0, a.happy - dt);
      if (this.hop && a === this.cat) continue;
      const landed = stepBody(a.body, dt, boxes, false);
      if (landed && a === this.cat && this.phase === "explore") SFX.land();
    }
    separate(this.cat.body, this.dog.body, 0.9);

    if (this.hop) {
      this.hop.t = Math.min(1, this.hop.t + dt / 0.7);
      const k = this.hop.t;
      this.cat.body.pos.lerpVectors(this.hop.from, this.hop.to, k);
      this.cat.body.pos.y += Math.sin(k * Math.PI) * 0.9;
      this.cat.facing = Math.atan2(this.hop.to.x - this.hop.from.x, this.hop.to.z - this.hop.from.z);
      if (k >= 1) { this.hop = null; this.cat.body.vel.set(0, 0, 0); this.cat.facing = 0; }
    }
    for (const s of this.slides.slice()) {
      s.t = Math.min(1, s.t + dt / s.dur);
      s.obj.position.lerpVectors(s.from, s.to, s.t);
      s.obj.position.y += Math.sin(s.t * Math.PI) * 0.5;
      if (s.t >= 1) this.slides.splice(this.slides.indexOf(s), 1);
    }

    // ambient chatter from Bruno while you explore
    if (this.phase === "explore") {
      this.ambientT -= dt;
      if (this.ambientT <= 0 && !this.dialogue.busy) {
        this.ambientT = 14 + Math.random() * 8;
        const lines = this.level.ambient;
        this.dialogue.quip("amb" + this.t, "DOG", lines[Math.floor(Math.random() * lines.length)]);
      }
    }
  }

  private brake(a: Actor, dt: number) {
    const f = Math.max(0, 1 - 18 * dt);
    a.body.vel.x *= f; a.body.vel.z *= f;
  }

  private move(a: Actor, mx: number, mz: number, speed: number, dt: number) {
    const len = Math.hypot(mx, mz);
    const control = a.body.grounded ? 1 : 0.55;
    if (len > 0.01) {
      mx /= len; mz /= len;
      const target = Math.atan2(mx, mz);
      let diff = target - a.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.facing += diff * Math.min(1, 14 * dt);
      const k = Math.min(1, (40 * control * dt) / speed);
      a.body.vel.x += (mx * speed - a.body.vel.x) * k;
      a.body.vel.z += (mz * speed - a.body.vel.z) * k;
    } else if (a.body.grounded) this.brake(a, dt);
  }

  private tryJump(a: Actor, dt: number) {
    if (a.jumpBuffer > 0) {
      a.jumpBuffer -= dt;
      if (a.grounded && a.body.vel.y <= 0.01) {
        a.body.vel.y = JUMP_V; a.body.grounded = false; a.body.airTime = COYOTE; a.jumpBuffer = 0;
        if (a === this.cat) SFX.jump();
      }
    }
  }

  /** What E would do right now. */
  private nearest(): { kind: "talk" } | { kind: "spot"; spot: Spot } | null {
    const c = this.cat.body.pos, d = this.dog.body.pos;
    const dDog = Math.hypot(c.x - d.x, c.z - d.z);
    let best: Spot | null = null, bestD = USE_RANGE;
    for (const s of this.level.spots) {
      if (this.usedSpots.has(s.id)) continue; // every object is used once
      const dist = Math.hypot(c.x - s.pos[0], c.z - s.pos[2]);
      if (dist < bestD && Math.abs(s.pos[1] - c.y) < 1.0) { best = s; bestD = dist; }
    }
    if (dDog < TALK_RANGE && Math.abs(d.y - c.y) < 1.2 && (!best || dDog < bestD)) return { kind: "talk" };
    return best ? { kind: "spot", spot: best } : null;
  }

  private controlCat(dt: number) {
    const a = this.cat, inp = this.input;
    let mx = 0, mz = 0;
    if (inp.held("left")) mx -= 1;
    if (inp.held("right")) mx += 1;
    if (inp.held("up")) mz -= 1;
    if (inp.held("down")) mz += 1;
    this.move(a, mx, mz, CAT_SPEED, dt);
    if (inp.consume("jump")) a.jumpBuffer = JUMP_BUFFER;
    this.tryJump(a, dt);

    const n = this.nearest();
    this.highlight.visible = false;
    if (!n) { this.prompt = ""; this.promptTarget = null; }
    else if (n.kind === "talk") {
      this.prompt = this.audiences > 0 ? `<kbd>E</kbd> Talk to Bruno` : `No audiences left`;
      this.promptTarget = this.dog.body.pos;
    } else {
      const s = n.spot;
      const ok = this.meets(s.requires);
      this.prompt = `<kbd>E</kbd> ${s.verb} ${s.name}${ok ? "" : " 🔒"}`;
      this.promptTarget = new THREE.Vector3(...s.pos);
      this.highlight.visible = true;
      this.highlight.position.set(s.pos[0], s.pos[1] + 0.02, s.pos[2]);
      this.highlight.scale.setScalar(1 + Math.sin(this.t * 6) * 0.08);
    }
    if (inp.consume("use") && n) {
      if (n.kind === "talk") { if (this.beginTalk()) this.onTalkStart(); }
      else this.useSpot(n.spot);
    }
  }

  /** Set by the UI to open the talk panel. */
  onTalkStart: () => void = () => {};

  private useSpot(s: Spot) {
    if (!this.meets(s.requires)) {
      this.dialogue.quip("locked" + s.id + this.t, "CAT", s.lockedThought ?? "Not yet.");
      SFX.drop();
      return;
    }
    this.usedSpots.add(s.id);
    s.consumes?.forEach((i) => this.inventory.delete(i));
    if (s.gives) this.inventory.add(s.gives);
    s.sets?.forEach((f) => this.flags.add(f));
    const hide = s.hideAfter ?? !!s.gives;
    const mesh = this.spotMeshes.get(s.id);
    if (mesh && hide) this.world.scene.remove(mesh);
    if (s.mesh === "cushion" && mesh) { mesh.rotation.z = 0.5; mesh.position.x -= 0.25; mesh.position.y += 0.05; this.addSpotMesh({ ...s, id: "toyShow", mesh: "goldtoy" }); }
    if (s.mesh === "lever" && mesh) mesh.rotation.z = -0.7;
    if (s.mesh === "vacuum" && mesh) mesh.rotation.y += 1;
    SFX.pickup();
    this.refreshCrown();
    this.hooks.onInventory();
    this.cat.rig.pulse();
    const lines = [{ who: "CAT" as const, text: s.thought }];
    if (s.dogReact) lines.push({ who: "DOG" as const, text: s.dogReact } as any);
    this.dialogue.say({ id: "spot" + s.id, priority: 4, lines });
    if (s.dogReact) this.hooks.onEmote("👀");
  }

  private controlDog(dt: number) {
    const dog = this.dog;
    if (this.dogTarget) {
      const dx = this.dogTarget.x - dog.body.pos.x, dz = this.dogTarget.z - dog.body.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.15) { this.dogTarget = null; this.brake(dog, dt); }
      else this.move(dog, dx, dz, dist < 0.6 ? 2 : 3.6, dt);
      this.tryJump(dog, dt);
      if (this.carried && this.level.winScene === "fetch") {
        const p = new THREE.Vector3();
        dog.rig.carryPoint.getWorldPosition(p);
        this.carried.position.set(p.x, p.y - 0.12, p.z);
      }
      return;
    }
    this.brake(dog, dt);
    // turn toward the cat when it's close, otherwise settle back
    const c = this.cat.body.pos, d = dog.body.pos;
    const near = Math.hypot(c.x - d.x, c.z - d.z) < 2.4;
    const want = near ? Math.atan2(c.x - d.x, c.z - d.z) : this.level.dogFacing;
    let diff = want - dog.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    dog.facing += diff * Math.min(1, 4 * dt);
  }

  // ---------------------------------------------------------------- render sync
  sync(time: number, dt: number) {
    for (const a of [this.cat, this.dog]) {
      a.rig.root.position.copy(a.body.pos);
      a.rig.root.rotation.y = a.facing;
      a.speed = Math.hypot(a.body.vel.x, a.body.vel.z);
      a.rig.animate({
        speed: a.speed, grounded: a.body.grounded, carrying: false, time,
        stunned: a.stunned > 0, happy: a.happy > 0, sitting: a.speed < 0.3 && a.body.pos.y > 0.4,
      }, dt);
    }
    for (const [id, m] of this.spotMeshes) {
      if (id === "toyShow" || m.userData.bob) m.position.y = (m.userData.baseY ?? (m.userData.baseY = m.position.y)) + Math.sin(time * 2 + m.position.x) * 0.03;
    }
    // camera focus between cat and Bruno during conversations
    this.focus.set((this.cat.body.pos.x + this.dog.body.pos.x) / 2, 0.5, (this.cat.body.pos.z + this.dog.body.pos.z) / 2);
  }
}

// ---------------------------------------------------------------- object meshes
export function spotMesh(kind: MeshKind | "biscuit"): THREE.Object3D {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, rough = 0.8) => {
    const m = new THREE.Mesh(geo, clay(color, rough));
    m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  };
  switch (kind) {
    case "note": {
      const n = add(new THREE.BoxGeometry(0.3, 0.3, 0.02), 0xfff07a, 0, 0, 0);
      n.rotation.z = 0.08;
      g.userData.bob = false;
      break;
    }
    case "crown": {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.09, 16, 1, true), new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.5, side: THREE.DoubleSide }));
      band.position.y = 0.06; band.castShadow = true; g.add(band);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(new THREE.ConeGeometry(0.035, 0.09, 4), COLORS.gold, Math.sin(a) * 0.14, 0.14, Math.cos(a) * 0.14); }
      g.userData.bob = true;
      break;
    }
    case "ball": add(new THREE.SphereGeometry(0.14, 18, 14), 0xcfe35a, 0, 0.14, 0); g.userData.bob = true; break;
    case "vacuum": {
      add(new THREE.CylinderGeometry(0.34, 0.36, 0.12, 28), 0x5f6b7a, 0, 0.06, 0, 0.5);
      add(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 16), 0x7fd0a8, 0, 0.13, 0.05, 0.3);
      add(new THREE.BoxGeometry(0.4, 0.12, 0.1), 0x4a5563, 0, 0.06, -0.38);
      break;
    }
    case "napkin": { const n = add(new THREE.BoxGeometry(0.32, 0.015, 0.32), 0xffffff, 0, 0.01, 0); n.rotation.y = 0.4; break; }
    case "pen": { const p = add(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), 0x3b6fb6, 0, 0.03, 0); p.rotation.z = Math.PI / 2; p.rotation.y = 0.6; break; }
    case "desk": {
      // inkpot + quill on the side table
      add(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12), 0x2d2a3a, 0.12, 0.05, 0.05);
      const q = add(new THREE.ConeGeometry(0.03, 0.28, 6), 0xfaf0dc, 0.12, 0.2, 0.05); q.rotation.z = 0.4;
      break;
    }
    case "lever": {
      const l = add(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), 0x8a5a3c, 0, 0.17, 0);
      add(new THREE.SphereGeometry(0.06, 12, 10), 0xe56b6f, 0, 0.35, 0);
      l.rotation.z = 0.2;
      break;
    }
    case "bone": {
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 10), 0xf6dfb6, 0, 0.06, 0).rotation.z = Math.PI / 2;
      for (const x of [-0.15, 0.15]) for (const z of [-0.04, 0.04]) add(new THREE.SphereGeometry(0.05, 10, 8), 0xf6dfb6, x, 0.06, z);
      g.userData.bob = true;
      break;
    }
    case "cushion": {
      const c = add(new THREE.SphereGeometry(0.42, 24, 12), COLORS.blue, 0, 0.14, 0);
      c.scale.set(1, 0.36, 1);
      add(new THREE.SphereGeometry(0.04, 10, 8), 0xfaf0dc, 0, 0.29, 0);
      break;
    }
    case "sock": {
      add(new THREE.CapsuleGeometry(0.06, 0.22, 4, 10), 0xe8a598, 0, 0.06, 0).rotation.z = Math.PI / 2;
      add(new THREE.CapsuleGeometry(0.06, 0.1, 4, 10), 0xe8a598, 0.14, 0.06, 0.07).rotation.x = Math.PI / 2;
      add(new THREE.TorusGeometry(0.06, 0.015, 6, 12), 0xffffff, -0.15, 0.06, 0).rotation.y = Math.PI / 2;
      break;
    }
    case "laser": { add(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 10), 0x444a55, 0, 0.03, 0, 0.4).rotation.z = Math.PI / 2; add(new THREE.SphereGeometry(0.025, 8, 6), 0xff3344, 0.12, 0.03, 0); g.userData.bob = true; break; }
    case "goldtoy": {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.3, metalness: 0.4, emissive: 0x6b4a00, emissiveIntensity: 0.3 }));
      m.position.y = 0.15; m.castShadow = true; g.add(m);
      break;
    }
    case "biscuit": add(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 6), 0xc98a45, 0, 0.03, 0); break;
  }
  return g;
}

import * as THREE from "three";
import "./style.css";
import { buildWorld } from "./world";
import { Input } from "./input";
import { Dialogue } from "./dialogue";
import { Adventure, TalkOption } from "./adventure";
import { ITEMS, LEVELS, Level, REGALIA, UPGRADES } from "./content";
import { save, persist, upgradeLevel, treasuryPending, treasuryRate, collectTreasury, settleTreasury, resetSave } from "./save";
import { SFX } from "./audio";

const $ = (id: string) => document.getElementById(id)!;

// ---------------------------------------------------------------- WebGL check
function webglOk() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}
if (!webglOk()) { $("no-webgl").classList.add("show"); throw new Error("WebGL 2 not available"); }

// ---------------------------------------------------------------- renderer + camera
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$("stage").appendChild(renderer.domElement);

const world = buildWorld();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
const CAM_OFFSET = new THREE.Vector3(0, 10.3, 12.05);   // camera position relative to its look point
const BASE_LOOK = new THREE.Vector3(0, 0.2, -0.55);
const camLook = BASE_LOOK.clone();
let camZoom = 1;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  const aspect = w / h;
  let viewH = 9.6;
  if (viewH * aspect < 14.2) viewH = 14.2 / aspect;
  camera.left = (-viewH * aspect) / 2; camera.right = (viewH * aspect) / 2;
  camera.top = viewH / 2 + 0.3; camera.bottom = -viewH / 2 + 0.3;
  camera.updateProjectionMatrix();
  $("small-screen").classList.toggle("show", w < 760);
}
window.addEventListener("resize", resize);
resize();

// ---------------------------------------------------------------- systems
const input = new Input();
const dialogue = new Dialogue($("subtitle"));
let emoteT = 0;

const adv = new Adventure(world, input, dialogue, {
  onEmote(e) { const el = $("emote"); el.textContent = e; el.classList.remove("show"); void el.offsetWidth; el.classList.add("show"); emoteT = 2.2; },
  onBelief(v, d) { renderBelief(v, d); },
  onInventory() { renderInventory(); },
  onFinished(won) { finishLevel(won); },
});
adv.onTalkStart = openTalk;

// ---------------------------------------------------------------- flow
type Mode = "title" | "court" | "intro" | "play" | "talk" | "paused" | "result";
let mode: Mode = "title";
let current: Level = LEVELS[0];

function showOverlay(id: string | null) {
  document.querySelectorAll(".overlay").forEach((o) => o.classList.remove("show"));
  if (id) $(id).classList.add("show");
}
const setHud = (on: boolean) => document.body.classList.toggle("playing", on);

function toTitle() { mode = "title"; setHud(false); input.active = false; showOverlay("title"); }

function toCourt() {
  mode = "court";
  setHud(false);
  input.active = false;
  closeTalk();
  dialogue.reset();
  renderCourt();
  showOverlay("court");
}

function openIntro(level: Level) {
  SFX.unlock();
  current = level;
  mode = "intro";
  $("intro-num").textContent = `Decree ${level.id}`;
  $("intro-title").textContent = level.title;
  $("intro-goal").textContent = level.goal;
  const aud = level.audiences + upgradeLevel("audience");
  const start = Math.min(90, level.startBelief + upgradeLevel("respect") * 10);
  const reg = save.regalia.filter((r) => REGALIA.includes(r)).map((r) => ITEMS[r].icon).join(" ") || "none yet";
  $("intro-stats").innerHTML = `<div><b>${aud}</b><small>conversations</small></div><div><b>${start}%</b><small>starting belief</small></div><div><b>${reg}</b><small>your regalia</small></div>`;
  showOverlay("intro");
}

function startLevel() {
  adv.start(current);
  world.seatGlow.visible = current.id === 1;
  mode = "play";
  input.active = true;
  input.clear();
  dialogue.reset();
  setHud(true);
  showOverlay(null);
  $("hud-title").textContent = `Decree ${current.id} · ${current.title}`;
  $("hud-goal").textContent = current.goal;
  renderAudiences();
  dialogue.say({ id: "intro", priority: 6, lines: current.intro });
}

function pause() {
  if (mode !== "play") return;
  mode = "paused";
  input.clear();
  showOverlay("pause");
  ($("btn-resume") as HTMLButtonElement).focus();
}
input.onBlur = pause;
function resume() { mode = "play"; showOverlay(null); input.clear(); }

function finishLevel(won: boolean) {
  mode = "result";
  input.active = false;
  setHud(false);
  const L = current;
  const left = adv.audiences;
  if (won) {
    const firstClear = !(save.stars[L.id] > 0);
    const stars = left >= 2 ? 3 : left >= 1 ? 2 : 1;
    const earned = 2 + left + (firstClear ? 3 : 0);
    settleTreasury(); // treasury rate grows with cleared decrees
    save.stars[L.id] = Math.max(save.stars[L.id] ?? 0, stars);
    save.authority += earned;
    const newRegalia: string[] = [];
    for (const r of REGALIA) if (adv.inventory.has(r) && !save.regalia.includes(r)) { save.regalia.push(r); newRegalia.push(r); }
    // the decree's own reward, even if the item was used up
    const reward = L.id === 1 ? "crown" : L.id === 2 ? "permit" : null;
    if (reward && !save.regalia.includes(reward)) { save.regalia.push(reward); newRegalia.push(reward); }
    persist();
    $("res-eyebrow").textContent = `Decree ${L.id} obeyed`;
    $("res-title").textContent = "By order of the Cat!";
    $("res-stars").innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? "" : "empty"}">★</span>`).join("");
    $("res-points").innerHTML = `+${earned} 👑 Authority <small>(${2} for the decree, ${left} for spare conversations${firstClear ? ", 3 first-time bonus" : ""})</small>`;
    $("res-extra").innerHTML = newRegalia.length
      ? newRegalia.map((r) => `<p>${ITEMS[r].icon} <b>${ITEMS[r].name}</b> added to your royal regalia. It unlocks new lines in later decrees.</p>`).join("")
      : stars < 3 ? `<p>Win with 2 conversations to spare for 3 stars.</p>` : `<p>Flawless diplomacy.</p>`;
  } else {
    save.authority += 1;
    persist();
    const missed = L.choices.find((c) => c.requires && !adv.meets(c.requires) && c.lockedHint);
    $("res-eyebrow").textContent = `Decree ${L.id}`;
    $("res-title").textContent = "Bruno wasn't convinced… yet";
    $("res-stars").innerHTML = "";
    $("res-points").innerHTML = `+1 👑 Authority for trying`;
    $("res-extra").innerHTML = `<p>💡 ${missed ? `Unlock better lines first. Hint: <b>${missed.lockedHint}</b>.` : "Save your conversations for your strongest lines."}</p>`;
  }
  showOverlay("result");
  ($("btn-res-court") as HTMLButtonElement).focus();
}

// ---------------------------------------------------------------- talk panel
let talkStage: "choose" | "reply" = "choose";
let typing: { iv: number; finish: () => void } | null = null;

function typeInto(el: HTMLElement, text: string, done?: () => void) {
  if (typing) typing.finish();
  el.textContent = "";
  let i = 0;
  const t = {
    iv: 0,
    finish: () => { clearInterval(t.iv); el.textContent = text; typing = null; done?.(); },
  };
  t.iv = window.setInterval(() => {
    i++; el.textContent = text.slice(0, i);
    if (i % 3 === 0) SFX.blip();
    if (i >= text.length) t.finish();
  }, 20);
  typing = t;
}

function openTalk() {
  mode = "talk";
  talkStage = "choose";
  $("talk").classList.add("show");
  $("talk-you").textContent = "";
  $("talk-you").classList.remove("show");
  typeInto($("talk-dog"), adv.greeting());
  renderChoices();
}

function renderChoices() {
  const box = $("talk-choices");
  box.innerHTML = "";
  const opts = adv.talkOptions();
  // available first, then locked teasers
  opts.sort((a, b) => Number(b.available) - Number(a.available));
  let n = 0;
  for (const o of opts) {
    const b = document.createElement("button");
    b.className = "choice" + (o.available ? "" : " locked") + (o.choice.trap ? " trap" : "");
    const key = o.available ? ++n : 0;
    const spy = upgradeLevel("spy") > 0 && o.available ? `<span class="delta ${o.delta >= 0 ? "up" : "down"}">${o.delta >= 0 ? "+" : ""}${o.delta}</span>` : "";
    b.innerHTML = o.available
      ? `<span class="num">${key}</span><span class="tag">${o.choice.tag ?? "💬"}</span><span class="txt">${o.choice.text}</span>${spy}`
      : `<span class="num">🔒</span><span class="tag">${o.choice.tag ?? "💬"}</span><span class="txt">${o.choice.lockedHint ?? "Locked"}</span>`;
    b.disabled = !o.available;
    if (o.available) { b.dataset.key = String(key); b.onclick = () => choose(o); }
    box.appendChild(b);
  }
  $("talk-foot").innerHTML = `<span><kbd>1</kbd>–<kbd>${Math.max(1, n)}</kbd> choose · <kbd>Esc</kbd> walk away (free)</span><span>${adv.audiences} conversation${adv.audiences === 1 ? "" : "s"} left</span>`;
}

function choose(o: TalkOption) {
  if (talkStage !== "choose") return;
  const r = adv.say(o.choice.id);
  if (!r) return;
  talkStage = "reply";
  renderAudiences();
  $("talk-choices").innerHTML = "";
  const you = $("talk-you");
  you.innerHTML = `<span class="talk-name you">You</span>${o.choice.text}`;
  you.classList.add("show");
  typeInto($("talk-dog"), r.choice.reply, () => {
    if (r.choice.catBack) {
      you.innerHTML = `<span class="talk-name you">You</span>${r.choice.catBack}`;
    }
  });
  $("talk-foot").innerHTML = `<span class="delta ${r.delta >= 0 ? "up" : "down"} big">${r.delta >= 0 ? "+" : ""}${r.delta}% belief</span><button class="btn small primary" id="btn-talk-next">Continue <kbd>E</kbd></button>`;
  ($("btn-talk-next") as HTMLButtonElement).onclick = continueTalk;
}

function continueTalk() {
  if (typing) { typing.finish(); return; }
  input.clear(); // the key that closed the panel must not re-open it
  closeTalk();
  const outcome = adv.endTalk();
  void outcome; // win/lose cutscenes run in play mode; the result screen comes from onFinished
  mode = "play";
}

function walkAway() {
  if (talkStage !== "choose") return;
  input.clear();
  closeTalk();
  adv.phase = "explore";
  mode = "play";
}

function closeTalk() { $("talk").classList.remove("show"); if (typing) typing.finish(); }

window.addEventListener("keydown", (e) => {
  if (mode !== "talk") return;
  if (talkStage === "choose") {
    if (/^Digit[1-9]$/.test(e.code)) {
      const k = e.code.slice(5);
      const btn = document.querySelector<HTMLButtonElement>(`#talk-choices button[data-key="${k}"]`);
      btn?.click();
    } else if (e.code === "Escape") walkAway();
  } else if (["KeyE", "Enter", "Space"].includes(e.code)) {
    e.preventDefault();
    continueTalk();
  }
});

// ---------------------------------------------------------------- HUD renders
function renderBelief(v: number, d: number) {
  $("belief-num").textContent = Math.round(v) + "%";
  ($("belief-fill") as HTMLElement).style.width = v + "%";
  if (d !== 0) {
    const el = $("belief-delta");
    el.textContent = (d > 0 ? "+" : "") + d + "%";
    el.className = "belief-delta show " + (d > 0 ? "up" : "down");
    setTimeout(() => el.classList.remove("show"), 1400);
  }
}

function renderAudiences() {
  const el = $("audiences");
  el.innerHTML = "";
  for (let i = 0; i < adv.audiencesMax; i++) {
    const s = document.createElement("span");
    s.className = "aud" + (i < adv.audiences ? "" : " spent");
    s.textContent = "🗣️";
    el.appendChild(s);
  }
}

function renderInventory() {
  const el = $("inventory");
  const items = [...adv.inventory];
  el.innerHTML = items.length
    ? items.map((i) => `<div class="inv" title="${ITEMS[i].name}"><span>${ITEMS[i].icon}</span><small>${ITEMS[i].name}</small></div>`).join("")
    : `<div class="inv empty"><small>Nothing yet. Explore!</small></div>`;
}

// ---------------------------------------------------------------- court
function renderCourt() {
  $("authority").textContent = String(save.authority);
  // decrees
  const list = $("decree-list");
  list.innerHTML = "";
  LEVELS.forEach((L, i) => {
    const unlocked = i === 0 || (save.stars[LEVELS[i - 1].id] ?? 0) > 0;
    const stars = save.stars[L.id] ?? 0;
    const b = document.createElement("button");
    b.className = "decree" + (unlocked ? "" : " locked");
    b.disabled = !unlocked;
    b.innerHTML = `<span class="num">${L.id}</span><span class="name">${L.title}<small>${unlocked ? L.goal : "Obey the previous decree to unlock"}</small></span><span class="st">${unlocked ? "★".repeat(stars) + "☆".repeat(3 - stars) : "🔒"}</span>`;
    if (unlocked) b.onclick = () => openIntro(L);
    list.appendChild(b);
  });
  const more = document.createElement("div");
  more.className = "decree soon";
  more.textContent = "More decrees coming: The Doorbell Emergency, The Vacuum Coup…";
  list.appendChild(more);
  // regalia
  $("regalia").innerHTML = REGALIA.map((r) => save.regalia.includes(r)
    ? `<div class="reg">${ITEMS[r].icon}<small>${ITEMS[r].name}</small></div>`
    : `<div class="reg missing">❔<small>???</small></div>`).join("");
  // upgrades
  const ul = $("upgrade-list");
  ul.innerHTML = "";
  for (const u of UPGRADES) {
    const lvl = upgradeLevel(u.id);
    const maxed = lvl >= u.costs.length;
    const cost = maxed ? 0 : u.costs[lvl];
    const b = document.createElement("button");
    b.className = "upgrade" + (maxed ? " maxed" : save.authority >= cost ? " afford" : "");
    b.disabled = maxed || save.authority < cost;
    b.innerHTML = `<span class="u-icon">${u.icon}</span><span class="u-body"><b>${u.name}</b> <small class="lvl">${lvl}/${u.costs.length}</small><small>${u.desc}</small></span><span class="u-cost">${maxed ? "Max" : cost + " 👑"}</span>`;
    b.onclick = () => {
      if (save.authority < cost || maxed) return;
      if (u.id === "clerk") settleTreasury();
      save.authority -= cost;
      save.upgrades[u.id] = lvl + 1;
      persist();
      SFX.coin();
      renderCourt();
    };
    ul.appendChild(b);
  }
  renderTreasury();
}

function renderTreasury() {
  const p = treasuryPending();
  $("treasury-amt").textContent = p.toFixed(1);
  $("treasury-rate").textContent = treasuryRate() > 0 ? `${treasuryRate()} 👑 / hour · fills up to 8 hours` : "Hire a Treasury Clerk or obey decrees to start earning";
  ($("btn-collect") as HTMLButtonElement).disabled = p < 1;
}

// ---------------------------------------------------------------- buttons
$("btn-play").onclick = () => { SFX.unlock(); toCourt(); };
$("btn-how").onclick = () => showOverlay("how");
$("btn-how-back").onclick = () => showOverlay("title");
$("btn-court-title").onclick = toTitle;
$("btn-reset").onclick = () => {
  const b = $("btn-reset");
  if (b.dataset.confirm) { resetSave(); delete b.dataset.confirm; b.textContent = "Reset progress"; renderCourt(); }
  else { b.dataset.confirm = "1"; b.textContent = "Click again to erase all progress"; setTimeout(() => { delete b.dataset.confirm; b.textContent = "Reset progress"; }, 3000); }
};
$("btn-collect").onclick = () => { const n = collectTreasury(); if (n > 0) SFX.coin(); renderCourt(); };
$("btn-intro-go").onclick = startLevel;
$("btn-intro-back").onclick = toCourt;
$("btn-resume").onclick = resume;
$("btn-restart").onclick = () => openIntro(current);
$("btn-quit").onclick = toCourt;
$("btn-res-court").onclick = toCourt;
$("btn-res-again").onclick = () => openIntro(current);
const muteBtn = $("btn-mute");
const syncMute = () => (muteBtn.textContent = SFX.muted ? "🔇" : "🔊");
syncMute();
muteBtn.onclick = () => { SFX.toggleMute(); syncMute(); };

// ---------------------------------------------------------------- labels
const tmp = new THREE.Vector3();
function toScreen(v: THREE.Vector3, el: HTMLElement, yOff: number) {
  tmp.set(v.x, v.y + yOff, v.z).project(camera);
  el.style.transform = `translate(-50%, -100%) translate(${(tmp.x * 0.5 + 0.5) * window.innerWidth}px, ${(-tmp.y * 0.5 + 0.5) * window.innerHeight}px)`;
}

// ---------------------------------------------------------------- main loop (fixed 60 Hz)
const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
let clockT = 0;
let courtRefresh = 0;

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clockT += dt;

  if (input.consume("pause")) {
    if (mode === "play" && adv.phase === "explore") pause();
    else if (mode === "paused") resume();
  }

  if (mode === "play" || mode === "talk") {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) { adv.step(STEP); acc -= STEP; steps++; }
    if (steps === 5) acc = 0;
  }
  if (mode !== "paused") dialogue.update(dt);
  input.endFrame();
  adv.sync(clockT, dt);

  if (mode === "court") { courtRefresh -= dt; if (courtRefresh <= 0) { courtRefresh = 0.5; renderTreasury(); } }

  // camera: ease in toward cat + Bruno during conversations and cutscenes
  const close = mode === "talk" || adv.phase === "cutscene";
  const targetZoom = close ? 1.65 : 1;
  camZoom += (targetZoom - camZoom) * Math.min(1, 4 * dt);
  const lookTarget = close ? adv.focus : BASE_LOOK;
  camLook.lerp(lookTarget, Math.min(1, 4 * dt));
  camera.zoom = camZoom;
  camera.position.copy(camLook).add(CAM_OFFSET);
  camera.lookAt(camLook);
  camera.updateProjectionMatrix();

  // labels
  const playing = mode === "play" || mode === "talk" || mode === "paused";
  document.body.classList.toggle("playing", playing);
  toScreen(adv.cat.body.pos, $("label-cat"), 1.05);
  toScreen(adv.dog.body.pos, $("label-dog"), 1.45);
  toScreen(adv.dog.body.pos, $("emote"), 1.95);
  emoteT -= dt;
  if (emoteT <= 0) $("emote").classList.remove("show");
  const prompt = $("prompt");
  const showPrompt = mode === "play" && adv.phase === "explore" && !!adv.prompt && !!adv.promptTarget;
  prompt.classList.toggle("show", showPrompt);
  if (showPrompt) { prompt.innerHTML = adv.prompt; toScreen(adv.promptTarget!, prompt, 0.75); }

  const pulse = 0.45 + Math.sin(clockT * 4) * 0.2;
  (world.seatGlow.material as THREE.MeshBasicMaterial).opacity = pulse;
  renderer.render(world.scene, camera);
  requestAnimationFrame(frame);
}

// title screen backdrop: Bruno napping on the couch
adv.start(LEVELS[0]);
adv.phase = "done";
renderInventory();
toTitle();
requestAnimationFrame(frame);

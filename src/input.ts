// Keyboard input for the single player (the cat). WASD and arrow keys both move.

export type Action = "up" | "down" | "left" | "right" | "jump" | "use" | "pause";

export const BINDINGS: Record<Action, string[]> = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  jump: ["Space"],
  use: ["KeyE", "Enter"],
  pause: ["Escape", "KeyP"],
};

const GAME_KEYS = new Set(Object.values(BINDINGS).flat());

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  /** While true, game keys don't scroll the page. */
  active = false;
  onBlur: () => void = () => {};

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (this.active && GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => { this.clear(); this.onBlur(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { this.clear(); this.onBlur(); } });
  }

  held(a: Action) { return BINDINGS[a].some((c) => this.down.has(c)); }

  /** True once per key press (consumed). */
  consume(a: Action) {
    for (const c of BINDINGS[a]) if (this.pressed.has(c)) { this.pressed.delete(c); return true; }
    return false;
  }

  endFrame() { this.pressed.clear(); }
  clear() { this.down.clear(); this.pressed.clear(); }
}

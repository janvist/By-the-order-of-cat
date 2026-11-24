// Subtitle dialogue: one exchange at a time, a global gap between exchanges,
// and no exchange repeats within a round. Dialogue never pauses gameplay.
import { SFX } from "./audio";

export type Speaker = "CAT" | "DOG" | "HUMAN";
export interface Line { who: Speaker; text: string; }
export interface Exchange { id: string; lines: Line[]; priority?: number; repeatable?: boolean; }

const GAP = 4; // seconds between exchanges

export class Dialogue {
  private el: HTMLElement;
  private current: { ex: Exchange; index: number; t: number; dur: number } | null = null;
  private pending: Exchange | null = null;
  private used = new Set<string>();
  private gap = 0;
  onLine: (line: Line) => void = () => {};

  constructor(el: HTMLElement) { this.el = el; }

  reset() { this.current = null; this.pending = null; this.used.clear(); this.gap = 0; this.render(null); }

  /** Queue an exchange. Higher priority replaces a lower-priority pending one. */
  say(ex: Exchange) {
    if (!ex.repeatable && this.used.has(ex.id)) return false;
    if (this.current?.ex.id === ex.id || this.pending?.id === ex.id) return false;
    const pr = ex.priority ?? 0;
    if (this.pending && (this.pending.priority ?? 0) > pr) return false;
    this.pending = ex;
    return true;
  }

  /** Interrupt-free one-liner that plays right away if nothing else is talking. */
  quip(id: string, who: Speaker, text: string) {
    if (this.current) return false;
    return this.say({ id, lines: [{ who, text }], repeatable: true, priority: -1 });
  }

  get busy() { return !!this.current; }

  update(dt: number) {
    if (this.current) {
      this.current.t += dt;
      if (this.current.t >= this.current.dur) {
        this.current.index++;
        if (this.current.index >= this.current.ex.lines.length) {
          this.current = null;
          this.gap = GAP;
          this.render(null);
        } else this.startLine();
      }
      return;
    }
    this.gap = Math.max(0, this.gap - dt);
    if (this.pending && (this.gap === 0 || (this.pending.priority ?? 0) >= 5)) {
      const ex = this.pending;
      this.pending = null;
      this.used.add(ex.id);
      this.current = { ex, index: 0, t: 0, dur: 0 };
      this.startLine();
    }
  }

  private startLine() {
    const c = this.current!;
    const line = c.ex.lines[c.index];
    const words = line.text.split(/\s+/).length;
    c.t = 0;
    c.dur = Math.min(3.4, 1.0 + words * 0.24);
    this.render(line);
    SFX.blip();
    this.onLine(line);
  }

  private render(line: Line | null) {
    if (!line) { this.el.classList.remove("show"); return; }
    this.el.innerHTML = `<span class="who who-${line.who.toLowerCase()}">${line.who}</span><span class="text">${line.text}</span>`;
    this.el.classList.remove("show");
    void this.el.offsetWidth;
    this.el.classList.add("show");
  }
}

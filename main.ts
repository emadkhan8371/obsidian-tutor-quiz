import { App, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownRenderer, Plugin, TFile } from "obsidian";

/*
 * ```quiz
 * id: 2026-09-27-n1
 * q: Three equal 2-minute slices compose one tripling. What must $r$ satisfy?
 * A: $r \cdot r \cdot r = 3$
 * B: $r + r + r = 3$
 * C: $r = 3 / 3$
 * D: I don't know
 * answered: B          <- written by this plugin on click
 * graded: ✗ A          <- written by the tutor after grading (mark, correct letter)
 * ```
 * The answer key never lives in the note. The terminal tutor polls the file for
 * the `answered:` line inside the block with this id and writes the grade.
 */

interface Quiz {
  id: string;
  q: string;
  options: { k: string; text: string }[];
  answered?: string;
  graded?: { mark: string; correct: string };
}

function parse(src: string): Quiz {
  const quiz: Quiz = { id: "", q: "", options: [] };
  const qLines: string[] = [];
  let inQ = false;
  for (const raw of src.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^id:\s*(.+)$/))) { quiz.id = m[1].trim(); inQ = false; continue; }
    if ((m = line.match(/^q:\s*(.*)$/))) { qLines.push(m[1]); inQ = true; continue; }
    if ((m = line.match(/^([A-H]):\s*(.*)$/))) { quiz.options.push({ k: m[1], text: m[2] }); inQ = false; continue; }
    if ((m = line.match(/^answered:\s*([A-H])\b/))) { quiz.answered = m[1]; inQ = false; continue; }
    if ((m = line.match(/^graded:\s*(\S+)\s*([A-H])?/))) { quiz.graded = { mark: m[1], correct: m[2] ?? "" }; inQ = false; continue; }
    if (inQ) qLines.push(line);
  }
  quiz.q = qLines.join("\n").trim();
  return quiz;
}

/** Insert `answered: X` into the ```quiz block carrying `id`, unless already answered. */
function persist(data: string, id: string, letter: string, hint?: { lineStart: number; lineEnd: number }): string | null {
  const lines = data.split("\n");
  const isBlockStart = (i: number) => /^```+\s*quiz\b/.test(lines[i] ?? "");
  const findEnd = (start: number) => { for (let j = start + 1; j < lines.length; j++) if (/^```+\s*$/.test(lines[j])) return j; return -1; };
  const hasId = (s: number, e: number) => lines.slice(s + 1, e).some(l => new RegExp("^id:\\s*" + id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$").test(l));
  let s = -1, e = -1;
  if (hint && isBlockStart(hint.lineStart)) { const ee = findEnd(hint.lineStart); if (ee > 0 && hasId(hint.lineStart, ee)) { s = hint.lineStart; e = ee; } }
  if (s < 0) for (let i = 0; i < lines.length; i++) if (isBlockStart(i)) { const ee = findEnd(i); if (ee > 0 && hasId(i, ee)) { s = i; e = ee; break; } }
  if (s < 0) return null;
  if (lines.slice(s + 1, e).some(l => /^answered:/.test(l))) return null;
  lines.splice(e, 0, `answered: ${letter}`);
  return lines.join("\n");
}

class QuizChild extends MarkdownRenderChild {
  constructor(containerEl: HTMLElement, private app: App, private src: string, private ctx: MarkdownPostProcessorContext) { super(containerEl); }

  async onload() {
    const quiz = parse(this.src);
    const el = this.containerEl;
    el.empty();
    el.addClass("tq");
    if (quiz.answered) el.addClass("tq-answered");
    if (quiz.graded) el.addClass("tq-graded");
    el.createDiv({ cls: "tq-title", text: quiz.id ? `checkpoint · ${quiz.id}` : "checkpoint" });
    const qEl = el.createDiv({ cls: "tq-q" });
    await MarkdownRenderer.render(this.app, quiz.q || "*(no question)*", qEl, this.ctx.sourcePath, this);
    for (const opt of quiz.options) {
      const row = el.createDiv({ cls: "tq-opt", attr: { role: "button", tabindex: "0", "data-k": opt.k } });
      if (quiz.answered === opt.k) row.addClass("tq-chosen");
      if (quiz.graded?.correct === opt.k) row.addClass("tq-correct");
      if (quiz.graded && quiz.answered === opt.k && quiz.graded.correct !== opt.k) row.addClass("tq-wrong");
      row.createSpan({ cls: "tq-k", text: opt.k });
      const body = row.createDiv({ cls: "tq-body" });
      await MarkdownRenderer.render(this.app, opt.text, body, this.ctx.sourcePath, this);
      if (!quiz.answered) {
        const choose = () => this.choose(quiz, opt.k);
        row.addEventListener("click", choose);
        row.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); choose(); } });
      }
    }
    if (quiz.answered && !quiz.graded) el.createDiv({ cls: "tq-state", text: `answered ${quiz.answered} · waiting for the tutor` });
    if (quiz.graded) el.createDiv({ cls: "tq-state", text: `${quiz.graded.mark} graded` + (quiz.graded.correct ? ` · correct: ${quiz.graded.correct}` : "") });
  }

  private async choose(quiz: Quiz, letter: string) {
    const el = this.containerEl;
    if (el.hasClass("tq-answered")) return;
    // deck rule: answer the tap before the disk does
    el.addClass("tq-answered");
    el.querySelectorAll<HTMLElement>(".tq-opt").forEach(o => { if (o.dataset.k === letter) o.addClass("tq-chosen"); });
    const file = this.app.vault.getAbstractFileByPath(this.ctx.sourcePath);
    if (!(file instanceof TFile)) { el.createDiv({ cls: "tq-state", text: "could not find the note on disk; answer not saved" }); return; }
    const info = this.ctx.getSectionInfo(el);
    let wrote = false;
    await this.app.vault.process(file, (data) => {
      const out = persist(data, quiz.id, letter, info ? { lineStart: info.lineStart, lineEnd: info.lineEnd } : undefined);
      if (out === null) return data;
      wrote = true;
      return out;
    });
    el.createDiv({ cls: "tq-state", text: wrote ? `answered ${letter} · waiting for the tutor` : `answered ${letter} · already recorded` });
  }
}

export default class TutorQuizPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("quiz", (source, el, ctx) => {
      ctx.addChild(new QuizChild(el, this.app, source, ctx));
    });
  }
}

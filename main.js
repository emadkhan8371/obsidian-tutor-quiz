"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TutorQuizPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
function parse(src) {
  var _a;
  const quiz = { id: "", q: "", options: [] };
  const qLines = [];
  let inQ = false;
  for (const raw of src.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    let m;
    if (m = line.match(/^id:\s*(.+)$/)) {
      quiz.id = m[1].trim();
      inQ = false;
      continue;
    }
    if (m = line.match(/^q:\s*(.*)$/)) {
      qLines.push(m[1]);
      inQ = true;
      continue;
    }
    if (m = line.match(/^([A-H]):\s*(.*)$/)) {
      quiz.options.push({ k: m[1], text: m[2] });
      inQ = false;
      continue;
    }
    if (m = line.match(/^answered:\s*([A-H])\b/)) {
      quiz.answered = m[1];
      inQ = false;
      continue;
    }
    if (m = line.match(/^graded:\s*(\S+)\s*([A-H])?/)) {
      quiz.graded = { mark: m[1], correct: (_a = m[2]) != null ? _a : "" };
      inQ = false;
      continue;
    }
    if (inQ) qLines.push(line);
  }
  quiz.q = qLines.join("\n").trim();
  return quiz;
}
function persist(data, id, letter, hint) {
  const lines = data.split("\n");
  const isBlockStart = (i) => {
    var _a;
    return /^```+\s*quiz\b/.test((_a = lines[i]) != null ? _a : "");
  };
  const findEnd = (start) => {
    for (let j = start + 1; j < lines.length; j++) if (/^```+\s*$/.test(lines[j])) return j;
    return -1;
  };
  const hasId = (s2, e2) => lines.slice(s2 + 1, e2).some((l) => new RegExp("^id:\\s*" + id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$").test(l));
  let s = -1, e = -1;
  if (hint && isBlockStart(hint.lineStart)) {
    const ee = findEnd(hint.lineStart);
    if (ee > 0 && hasId(hint.lineStart, ee)) {
      s = hint.lineStart;
      e = ee;
    }
  }
  if (s < 0) {
    for (let i = 0; i < lines.length; i++) if (isBlockStart(i)) {
      const ee = findEnd(i);
      if (ee > 0 && hasId(i, ee)) {
        s = i;
        e = ee;
        break;
      }
    }
  }
  if (s < 0) return null;
  if (lines.slice(s + 1, e).some((l) => /^answered:/.test(l))) return null;
  lines.splice(e, 0, `answered: ${letter}`);
  return lines.join("\n");
}
var QuizChild = class extends import_obsidian.MarkdownRenderChild {
  constructor(containerEl, app, src, ctx) {
    super(containerEl);
    this.app = app;
    this.src = src;
    this.ctx = ctx;
  }
  async onload() {
    var _a;
    const quiz = parse(this.src);
    const el = this.containerEl;
    el.empty();
    el.addClass("tq");
    if (quiz.answered) el.addClass("tq-answered");
    if (quiz.graded) el.addClass("tq-graded");
    el.createDiv({ cls: "tq-title", text: quiz.id ? `checkpoint \xB7 ${quiz.id}` : "checkpoint" });
    const qEl = el.createDiv({ cls: "tq-q" });
    await import_obsidian.MarkdownRenderer.render(this.app, quiz.q || "*(no question)*", qEl, this.ctx.sourcePath, this);
    for (const opt of quiz.options) {
      const row = el.createDiv({ cls: "tq-opt", attr: { role: "button", tabindex: "0", "data-k": opt.k } });
      if (quiz.answered === opt.k) row.addClass("tq-chosen");
      if (((_a = quiz.graded) == null ? void 0 : _a.correct) === opt.k) row.addClass("tq-correct");
      if (quiz.graded && quiz.answered === opt.k && quiz.graded.correct !== opt.k) row.addClass("tq-wrong");
      row.createSpan({ cls: "tq-k", text: opt.k });
      const body = row.createDiv({ cls: "tq-body" });
      await import_obsidian.MarkdownRenderer.render(this.app, opt.text, body, this.ctx.sourcePath, this);
      if (!quiz.answered) {
        const choose = () => this.choose(quiz, opt.k);
        row.addEventListener("click", choose);
        row.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            choose();
          }
        });
      }
    }
    if (quiz.answered && !quiz.graded) el.createDiv({ cls: "tq-state", text: `answered ${quiz.answered} \xB7 waiting for the tutor` });
    if (quiz.graded) el.createDiv({ cls: "tq-state", text: `${quiz.graded.mark} graded` + (quiz.graded.correct ? ` \xB7 correct: ${quiz.graded.correct}` : "") });
  }
  async choose(quiz, letter) {
    const el = this.containerEl;
    if (el.hasClass("tq-answered")) return;
    el.addClass("tq-answered");
    el.querySelectorAll(".tq-opt").forEach((o) => {
      if (o.dataset.k === letter) o.addClass("tq-chosen");
    });
    const file = this.app.vault.getAbstractFileByPath(this.ctx.sourcePath);
    if (!(file instanceof import_obsidian.TFile)) {
      el.createDiv({ cls: "tq-state", text: "could not find the note on disk; answer not saved" });
      return;
    }
    const info = this.ctx.getSectionInfo(el);
    let wrote = false;
    await this.app.vault.process(file, (data) => {
      const out = persist(data, quiz.id, letter, info ? { lineStart: info.lineStart, lineEnd: info.lineEnd } : void 0);
      if (out === null) return data;
      wrote = true;
      return out;
    });
    el.createDiv({ cls: "tq-state", text: wrote ? `answered ${letter} \xB7 waiting for the tutor` : `answered ${letter} \xB7 already recorded` });
  }
};
var TutorQuizPlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("quiz", (source, el, ctx) => {
      ctx.addChild(new QuizChild(el, this.app, source, ctx));
    });
  }
};

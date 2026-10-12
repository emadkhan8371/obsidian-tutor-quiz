# obsidian-tutor-quiz

An Obsidian plugin that turns a fenced ```` ```quiz ```` block into a clickable multiple-choice question. It's the in-note half of a spaced-repetition tutor I run with Claude Code: the agent writes lessons and quizzes into my vault, I answer in Obsidian, and the agent grades.

```quiz
id: 2026-09-27-n1
q: Three equal 2-minute slices compose one tripling. What must $r$ satisfy?
A: $r \cdot r \cdot r = 3$
B: $r + r + r = 3$
C: $r = 3 / 3$
D: I don't know
```

- The question and options render as full markdown, including LaTeX.
- One click (or Enter/Space) locks the choice, dims the rest, and appends `answered: X` inside the block using `vault.process`, so the write is atomic.
- The grader, any script or agent watching the file, adds `graded: ✓ A` or `graded: ✗ A`, and the block colours the result green or red.

**The answer key never lives in the note.** The plugin only records which option you picked. Grading happens outside Obsidian against a key you can't see, so peeking at the source gives nothing away.

## Install

```bash
npm install && npm run build
mkdir -p <vault>/.obsidian/plugins/tutor-quiz
cp main.js manifest.json styles.css <vault>/.obsidian/plugins/tutor-quiz/
```

Then enable **Tutor Quiz** under Settings → Community plugins. A prebuilt `main.js` is included.

## Block format

| line | written by | meaning |
|---|---|---|
| `id:` | author | unique id the grader looks for |
| `q:` | author | question (can run over several lines) |
| `A:` … `H:` | author | options |
| `answered: X` | plugin | your choice |
| `graded: ✓ X` / `✗ X` | grader | mark and the correct letter |

MIT licensed.

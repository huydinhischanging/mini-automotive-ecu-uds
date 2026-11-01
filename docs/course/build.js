#!/usr/bin/env node
/*
 * Builds the course website (one self-contained HTML file) from:
 *   - the project's real source files (embedded verbatim),
 *   - the lessons in content/*.js,
 *   - app.html (the website shell).
 *
 *   node docs/course/build.js            -> docs/course/dist/mini-ecu-course.html
 *
 * Every code reference in a lesson is a text anchor, resolved here to line numbers.
 * The build fails if an anchor, a file, a lesson link or a quiz answer is wrong, so the
 * course cannot silently drift away from the code.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const HERE = __dirname;
const errors = [];
const fail = (msg) => errors.push(msg);

// ---------------------------------------------------------------- sources
const SOURCE_GLOBS = [
  ['common', /\.(c|h)$/],
  ['sensor_ecu/Core/App', /\.(c|h)$/],
  ['sensor_ecu/Core/Mcal', /\.(c|h)$/],
  ['control_ecu/CM4/Core/App', /\.(c|h)$/],
  ['control_ecu/CM4/Core/Mcal', /\.(c|h)$/],
  ['tester/include', /\.hpp$/],
  ['tester/src', /\.cpp$/],
  ['tester/apps', /\.cpp$/],
  ['tester/tests', /\.cpp$/],
  ['tests', /\.(c|h)$/],
  ['tools', /\.(sh|txt)$/],
];
const SINGLE_FILES = [
  'sensor_ecu/Core/Src/main.c',
  'control_ecu/CM4/Core/Src/main.c',
  'control_ecu/CM4/Core/Inc/FreeRTOSConfig.h',
  'tests/Makefile',
  'tester/CMakeLists.txt',
  '.github/workflows/tests.yml',
  'docs/misra_deviations.md',
];

function walk(dir, re, out) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) { fail(`source dir missing: ${dir}`); return; }
  for (const name of fs.readdirSync(abs).sort()) {
    const rel = dir + '/' + name;
    const st = fs.statSync(path.join(ROOT, rel));
    if (st.isDirectory()) { if (name !== 'build') walk(rel, re, out); }
    else if (re.test(name)) out.push(rel);
  }
}
const files = [];
SOURCE_GLOBS.forEach(([d, re]) => walk(d, re, files));
SINGLE_FILES.forEach((f) => { if (fs.existsSync(path.join(ROOT, f))) files.push(f); else fail(`file missing: ${f}`); });

function langOf(p) {
  if (/\.(c|h)$/.test(p)) return 'c';
  if (/\.(cpp|hpp)$/.test(p)) return 'cpp';
  if (/\.sh$/.test(p)) return 'bash';
  if (/Makefile$/.test(p)) return 'makefile';
  if (/\.ya?ml$/.test(p)) return 'yaml';
  if (/\.md$/.test(p)) return 'markdown';
  if (/CMakeLists/.test(p)) return 'cmake';
  return 'plaintext';
}
const SRC = {};
for (const f of files) {
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n').replace(/\t/g, '    ');
  SRC[f] = { lang: langOf(f), text, lines: text.split('\n') };
}

// ---------------------------------------------------------------- cross references
const topOf = (p) => p.split('/')[0];
function resolveInclude(from, inc) {
  const cands = files.filter((f) => f === inc || f.endsWith('/' + inc));
  if (cands.length <= 1) return cands[0] || null;
  return cands.find((c) => topOf(c) === topOf(from)) || cands[0];
}
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'return', 'sizeof', 'TEST', 'TEST_F', 'defined', 'else']);
const XF = {};
const DEFS = [];
for (const f of files) {
  const L = SRC[f].lines;
  const x = { inc: [], ext: [], incBy: [], defs: [] };
  L.forEach((line) => {
    const m = line.match(/^\s*#\s*include\s+["<]([^">]+)[">]/);
    if (!m) return;
    const r = m[0].includes('"') ? resolveInclude(f, m[1]) : null;
    if (r) { if (!x.inc.includes(r)) x.inc.push(r); }
    else if (!x.ext.includes(m[1])) x.ext.push(m[1]);
  });
  if (/\.(c|cpp)$/.test(f)) {
    for (let i = 0; i < L.length; i++) {
      const line = L[i];
      if (/^\s/.test(line) || /^(#|\/\/|\/\*|\*|typedef|struct|enum|namespace|class|using|template)/.test(line)) continue;
      const m = line.match(/^(?:static\s+|inline\s+|extern\s+)*[A-Za-z_][\w\s\*&:<>,]*?[\s\*&]([A-Za-z_]\w*(?:::~?\w+)?)\s*\(/);
      if (!m || KEYWORDS.has(m[1])) continue;
      // join the signature until its closing parenthesis
      let sig = '', j = i;
      for (; j < Math.min(L.length, i + 6); j++) { sig += L[j] + '\n'; if (sig.split('(').length === sig.split(')').length) break; }
      const after = sig.slice(sig.lastIndexOf(')') + 1).trim();
      if (after.startsWith(';') || after.startsWith('=')) continue;
      let k = j + 1;
      while (k < L.length && L[k].trim() === '') k++;
      const next = (L[k] || '').trim();
      if (!(after.includes('{') || next.startsWith('{') || next.startsWith(':'))) continue;
      x.defs.push({ name: m[1], line: i + 1 });
      DEFS.push({ name: m[1], file: f, line: i + 1 });
    }
  }
  XF[f] = x;
}
for (const f of files) for (const t of XF[f].inc) XF[t].incBy.push(f);

const STOP = new Set(['request', 'send', 'receive', 'value', 'error', 'describe', 'main', 'add', 'run', 'ok', 'Now', 'Elapsed',
  'Lock', 'Unlock', 'SendFrame', 'Put', 'HandleButton', 'LogStatus', 'OnCanRx', 'GetTimeMs', 'FakeTime', 'FakeSend', 'ReadVersion',
  'ReadSpeed', 'ReadFaults', 'EcuReset', 'Negative', 'malformed', 'session']);
const shortName = (n) => n.split('::').pop();
const nameCount = {};
DEFS.forEach((d) => { const s = shortName(d.name); nameCount[s] = (nameCount[s] || 0) + 1; });
function enclosing(f, line) {
  let best = null;
  for (const d of XF[f].defs) if (d.line <= line) best = d.name;
  return best;
}
const FN = {};
for (const d of DEFS) {
  const s = shortName(d.name);
  const entry = { file: d.file, line: d.line, callers: [], refs: [] };
  FN[d.file + '#' + d.name] = entry;
  if (s.length < 5 || STOP.has(s) || nameCount[s] > 1) { entry.skipped = true; continue; }
  const callRe = new RegExp('\\b' + s + '\\s*\\(');
  const refRe = new RegExp('\\b' + s + '\\b(?!\\s*\\()');
  for (const f of files) {
    if (!/\.(c|cpp|h|hpp)$/.test(f)) continue;
    SRC[f].lines.forEach((line, i) => {
      const t = line.trim();
      if (f === d.file && i + 1 === d.line) return;
      if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return;
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (callRe.test(code)) {
        if (/\.(h|hpp)$/.test(f) && /\);\s*$/.test(t)) return;   // prototype
        entry.callers.push({ file: f, line: i + 1, fn: enclosing(f, i + 1) });
      } else if (refRe.test(code) && /\.(c|cpp)$/.test(f)) {
        entry.refs.push({ file: f, line: i + 1, fn: enclosing(f, i + 1) });
      }
    });
  }
}

// ---------------------------------------------------------------- lessons
const contentDir = path.join(HERE, 'content');
const levels = [];
for (const name of fs.readdirSync(contentDir).filter((n) => n.endsWith('.js')).sort()) {
  const mod = require(path.join(contentDir, name));
  for (const ch of mod.chapters) {
    let lv = levels.find((l) => l.id === mod.level.id);
    if (!lv) { lv = { ...mod.level, chapters: [] }; levels.push(lv); }
    lv.chapters.push(ch);
  }
}
const subs = [];
const subById = {};
levels.forEach((lv) => lv.chapters.forEach((ch) => ch.lessons.forEach((ls) => ls.subs.forEach((s) => {
  s.level = lv.id; s.chapter = ch.id; s.lesson = ls.id;
  if (subById[s.id]) fail(`duplicate sub-lesson id ${s.id}`);
  subById[s.id] = s; subs.push(s);
}))));

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function findLine(file, pattern, from, where) {
  const L = SRC[file].lines;
  if (pattern.includes('\n')) { fail(`${where}: anchor "${pattern.replace(/\n/g, '\\n')}" spans lines; anchors match one line`); return -1; }
  for (let i = from; i < L.length; i++) if (L[i].includes(pattern)) return i;
  fail(`${where}: "${pattern}" not found in ${file}${from ? ' after line ' + (from + 1) : ''}`);
  return -1;
}
function inline(t, where) {
  let s = esc(t);
  // Inline code: `x` or ⟦x⟧ (the latter is used inside JS template literals).
  s = s.replace(/`([^`]+)`|⟦([^⟧]+)⟧/g, (_, a, b) => `<code>${a || b}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\[\[([\d.]+)\]\]/g, (_, id) => {
    if (!subById[id]) { fail(`${where}: lesson link [[${id}]] does not exist`); return id; }
    return `<a href="#l-${id.replace(/\./g, '-')}" class="xref">${id} ${esc(subById[id].t)}</a>`;
  });
  s = s.replace(/\{\{([^}@]+)(?:@([^}]+))?\}\}/g, (_, f, pat) => {
    f = f.trim();
    if (!SRC[f]) { fail(`${where}: file link {{${f}}} is not an embedded source`); return f; }
    let line = 0;
    if (pat) { const i = findLine(f, pat.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), 0, where); line = i + 1; }
    return `<a class="flink" data-file="${f}" data-line="${line}">${f.split('/').pop()}${line ? ':' + line : ''}</a>`;
  });
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}
function md(text, where) {
  if (text === undefined || text === null) return '';
  const lines = String(text).replace(/^\n+|\s+$/g, '').split('\n').map((l) => l.replace(/^ {0,4}/, (m) => (m.length >= 4 ? '    ' : '')));
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === '') { i++; continue; }
    if (/^(```|~~~)/.test(l.trim())) {
      const lang = l.trim().slice(3).trim() || 'plaintext';
      const buf = [];
      i++;
      while (i < lines.length && !/^(```|~~~)/.test(lines[i].trim())) buf.push(lines[i++]);
      i++;
      out.push(`<pre class="snip" data-lang="${lang}"><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\s*- /.test(l)) {
      const items = [];
      while (i < lines.length && /^\s*- /.test(lines[i])) {
        let item = lines[i].replace(/^\s*- /, '');
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*- /.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(`<li>${inline(item, where)}</li>`);
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+\. /.test(l)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) {
        let item = lines[i].replace(/^\s*\d+\. /, '');
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*\d+\. /.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(`<li>${inline(item, where)}</li>`);
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r) => !/^\|[\s:-]+\|/.test(r) || /[a-zA-Z0-9]/.test(r.replace(/[|:\-\s]/g, '')));
      const head = cells(body[0]).map((c) => `<th>${inline(c, where)}</th>`).join('');
      const trs = body.slice(1).map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c, where)}</td>`).join('')}</tr>`).join('');
      out.push(`<div class="tbl"><table><thead><tr>${head}</tr></thead><tbody>${trs}</tbody></table></div>`);
      continue;
    }
    if (l.startsWith('> ')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('> ')) buf.push(lines[i++].slice(2));
      out.push(`<div class="callout">${inline(buf.join(' '), where)}</div>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^\s*(- |\d+\. |```|~~~|\||> )/.test(lines[i])) buf.push(lines[i++].trim());
    out.push(`<p>${inline(buf.join(' '), where)}</p>`);
  }
  return out.join('\n');
}

function resolveCode(ref, where) {
  if (!SRC[ref.f]) { fail(`${where}: code file ${ref.f} is not embedded`); return null; }
  const L = SRC[ref.f].lines;
  const after = ref.after ? findLine(ref.f, ref.after, 0, where) : 0;
  const start = findLine(ref.f, ref.from, Math.max(after, 0), where);
  if (start < 0) return null;
  let end;
  if (ref.to) end = findLine(ref.f, ref.to, start, where);
  else end = Math.min(L.length - 1, start + (ref.n || 12) - 1);
  if (end < 0) return null;
  if (end - start > 90) fail(`${where}: code range in ${ref.f} is ${end - start + 1} lines, keep it under 90`);
  const inRange = (pat) => { for (let i = start; i <= end; i++) if (L[i].includes(pat)) return i + 1; fail(`${where}: "${pat}" not inside the shown range of ${ref.f} (${start + 1}-${end + 1})`); return 0; };
  return {
    f: ref.f, a: start + 1, b: end + 1, cap: ref.cap ? inline(ref.cap, where) : '',
    hl: (ref.hl || []).map(inRange).filter(Boolean),
    ex: (ref.ex || []).map(([pat, txt]) => ({ line: inRange(pat), html: inline(txt, where) })),
  };
}

function checkFig(fig, where) {
  if (!fig) return;
  const types = ['seq', 'flow', 'layers', 'bytes', 'fsm', 'widget'];
  if (!types.includes(fig.type)) fail(`${where}: unknown figure type ${fig.type}`);
  if (fig.type === 'seq') fig.msgs.forEach((m) => { if (m[0] >= fig.actors.length || m[1] >= fig.actors.length) fail(`${where}: seq message actor index out of range`); });
  if (fig.type === 'widget' && !['crc', 'e2e', 'isotp', 'dtcbits'].includes(fig.name)) fail(`${where}: unknown widget ${fig.name}`);
}

const OUT_SUBS = {};
const REQUIRED = ['goal', 'bg', 'th', 'use', 'run', 'video', 'pit', 'ex', 'quiz', 'sum'];
for (const s of subs) {
  const w = `lesson ${s.id}`;
  REQUIRED.forEach((k) => { if (s[k] === undefined) fail(`${w}: missing section "${k}"`); });
  if (!s.code || !s.code.length) fail(`${w}: no source code reference`);
  (s.pre || []).forEach((p) => { if (!subById[p]) fail(`${w}: prerequisite ${p} does not exist`); });
  (s.quiz || []).forEach((q, i) => { if (!Array.isArray(q[1]) || q[2] < 0 || q[2] >= q[1].length) fail(`${w}: quiz ${i + 1} has an invalid answer index`); });
  checkFig(s.fig, w);
  const fig = s.fig ? JSON.parse(JSON.stringify(s.fig)) : null;
  if (fig && fig.type === 'flow') fig.nodes = fig.nodes.map((n) => (Array.isArray(n) ? [esc(n[0]), n[1] || ''] : [esc(n), '']));
  OUT_SUBS[s.id] = {
    id: s.id, t: s.t, level: s.level, chapter: s.chapter, lesson: s.lesson, extra: !!s.extra, min: s.min || 15,
    pre: s.pre || [],
    concepts: (s.concepts || []).map(([a, b]) => [a, inline(b, w)]),
    goal: md(s.goal, w), bg: md(s.bg, w), th: md(s.th, w), use: md(s.use, w),
    code: (s.code || []).map((c) => resolveCode(c, w)).filter(Boolean),
    explain: md(s.explain, w),
    run: (s.run || []).map((r) => inline(r, w)),
    fig, figCap: s.figCap ? inline(s.figCap, w) : '',
    video: s.video ? { t: s.video.t, d: s.video.d, goal: s.video.goal || '', s: s.video.s.map((x) => inline(x, w)), url: s.video.url || '' } : null,
    pit: (s.pit || []).map(([a, b]) => [inline(a, w), inline(b, w)]),
    ex: s.ex ? { task: md(s.ex.task, w), hint: md(s.ex.hint, w), sol: md(s.ex.sol, w) } : null,
    quiz: (s.quiz || []).map(([q, opts, a, why]) => [inline(q, w), opts.map((o) => inline(o, w)), a, inline(why, w)]),
    sum: (s.sum || []).map((x) => inline(x, w)),
    text: [s.t, s.goal, s.th, s.use, (s.concepts || []).map((c) => c.join(' ')).join(' ')].join(' '),
  };
}
const TREE = levels.map((lv) => ({
  id: lv.id, t: lv.t, d: lv.d,
  chapters: lv.chapters.map((ch) => ({ id: ch.id, t: ch.t, d: ch.d, lessons: ch.lessons.map((ls) => ({ id: ls.id, t: ls.t, subs: ls.subs.map((s) => s.id) })) })),
}));

if (errors.length) {
  console.error(`BUILD FAILED, ${errors.length} problem(s):`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}

// ---------------------------------------------------------------- output
const DATA = {
  built: new Date().toISOString().slice(0, 10),
  tree: TREE, subs: OUT_SUBS, order: subs.map((s) => s.id),
  src: Object.fromEntries(files.map((f) => [f, { lang: SRC[f].lang, text: SRC[f].text }])),
  xf: XF, fn: FN,
};
const json = JSON.stringify(DATA).replace(/</g, '\\u003c');
const shell = fs.readFileSync(path.join(HERE, 'app.html'), 'utf8');
if (!shell.includes('/*__COURSE_DATA__*/')) { console.error('app.html has no data placeholder'); process.exit(1); }
const html = shell.replace('/*__COURSE_DATA__*/', () => 'window.COURSE = ' + json + ';');
fs.mkdirSync(path.join(HERE, 'dist'), { recursive: true });
const outFile = path.join(HERE, 'dist', 'mini-ecu-course.html');
fs.writeFileSync(outFile, html);
const nCode = subs.reduce((n, s) => n + (s.code || []).length, 0);
const nQuiz = subs.reduce((n, s) => n + (s.quiz || []).length, 0);
const nConcepts = subs.reduce((n, s) => n + (s.concepts || []).length, 0);
console.log(`ok: ${subs.length} sub-lessons, ${nCode} code references, ${nQuiz} quiz questions, ${nConcepts} concepts`);
console.log(`    ${files.length} source files, ${DEFS.length} functions indexed, ${(html.length / 1024).toFixed(0)} KB -> ${path.relative(ROOT, outFile)}`);

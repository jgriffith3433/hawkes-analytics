// Build-time: render docs/*.md (and the README quickstart pages we keep as .md) into static HTML under dist/docs/.
// No runtime markdown fetch. Shared layout matches the demo (example/index.html): same colours, Copy on code blocks,
// left sidebar (menu at phone width), on-page TOC, heading anchors, build-time syntax highlight.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist', 'docs');
const DOCS = path.join(ROOT, 'docs');

const PAGES = [
  { id: 'quickstart', file: 'quickstart.md', title: 'Quickstart', nav: 'Quickstart' },
  { id: 'events', file: 'events.md', title: 'Events', nav: 'Events' },
  { id: 'privacy', file: 'privacy.md', title: 'Privacy', nav: 'Privacy' },
  { id: 'api', file: 'api.md', title: 'API', nav: 'API' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';

// --- syntax highlight (build-time, small, no deps) ---
const KW = new Set('await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null return static super switch this throw true try typeof var void while with yield of async from as'.split(' '));
const CS = new Set('abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile while'.split(' '));

function highlight(code, lang) {
  const raw = code.replace(/\n$/, '');
  const L = (lang || '').toLowerCase();
  if (L === 'html' || L === 'xml') return highlightHtml(raw);
  if (L === 'bash' || L === 'sh' || L === 'shell') return highlightBash(raw);
  if (L === 'csharp' || L === 'cs') return highlightCSharp(raw);
  if (L === 'js' || L === 'javascript' || L === 'ts' || L === 'typescript') return highlightJs(raw);
  return esc(raw);
}

function highlightJs(src) {
  let out = '', i = 0;
  const push = (cls, t) => { out += cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t); };
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '/') {
      let j = i; while (j < src.length && src[j] !== '\n') j++;
      push('cmt', src.slice(i, j)); i = j; continue;
    }
    if (src[i] === '/' && src[i + 1] === '*') {
      let j = i + 2; while (j < src.length && !(src[j] === '*' && src[j + 1] === '/')) j++;
      j = Math.min(src.length, j + 2); push('cmt', src.slice(i, j)); i = j; continue;
    }
    if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const q = src[i]; let j = i + 1;
      while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++; }
      j = Math.min(src.length, j + 1); push('str', src.slice(i, j)); i = j; continue;
    }
    if (/[0-9]/.test(src[i]) && (i === 0 || !/[\w$]/.test(src[i - 1]))) {
      let j = i; while (j < src.length && /[0-9_.xXa-fA-F]/.test(src[j])) j++;
      push('num', src.slice(i, j)); i = j; continue;
    }
    if (/[A-Za-z_$]/.test(src[i])) {
      let j = i; while (j < src.length && /[\w$]/.test(src[j])) j++;
      const w = src.slice(i, j);
      push(KW.has(w) ? 'kw' : '', w); i = j; continue;
    }
    out += esc(src[i]); i++;
  }
  return out;
}

function highlightCSharp(src) {
  let out = '', i = 0;
  const push = (cls, t) => { out += cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t); };
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '/') {
      let j = i; while (j < src.length && src[j] !== '\n') j++;
      push('cmt', src.slice(i, j)); i = j; continue;
    }
    if (src[i] === '"') {
      let j = i + 1; while (j < src.length && src[j] !== '"') { if (src[j] === '\\') j++; j++; }
      j = Math.min(src.length, j + 1); push('str', src.slice(i, j)); i = j; continue;
    }
    if (/[A-Za-z_]/.test(src[i])) {
      let j = i; while (j < src.length && /[\w]/.test(src[j])) j++;
      const w = src.slice(i, j);
      push(CS.has(w) ? 'kw' : '', w); i = j; continue;
    }
    out += esc(src[i]); i++;
  }
  return out;
}

function highlightBash(src) {
  return src.split('\n').map((line) => {
    const m = /^(\s*)(#.*)$/.exec(line);
    if (m) return esc(m[1]) + `<span class="cmt">${esc(m[2])}</span>`;
    return line.replace(/(^|\s)(npm|npx|cd|git|curl|node)(?=\s|$)/g, (a, sp, cmd) => esc(sp) + `<span class="kw">${esc(cmd)}</span>`)
      .replace(/(https?:\/\/\S+)/g, '<span class="str">$1</span>');
  }).join('\n');
}

function highlightHtml(src) {
  // Tokenize so we never re-match inside spans we just wrote (class= on <span> broke a replace chain).
  let out = '', i = 0;
  const push = (cls, t) => { out += cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t); };
  while (i < src.length) {
    if (src[i] === '<') {
      let j = i + 1;
      const close = src[j] === '/';
      if (close) j++;
      const nameStart = j;
      while (j < src.length && /[\w:-]/.test(src[j])) j++;
      out += esc('<') + (close ? esc('/') : '') + (j > nameStart ? `<span class="kw">${esc(src.slice(nameStart, j))}</span>` : '');
      while (j < src.length && src[j] !== '>') {
        if (/\s/.test(src[j])) { out += esc(src[j]); j++; continue; }
        if (src[j] === '/' && src[j + 1] === '>') { out += esc('/>'); j += 2; break; }
        const a0 = j;
        while (j < src.length && /[\w:-]/.test(src[j])) j++;
        if (j > a0) push('attr', src.slice(a0, j));
        if (src[j] === '=') {
          out += esc('='); j++;
          if (src[j] === '"' || src[j] === "'") {
            const q = src[j]; let k = j + 1;
            while (k < src.length && src[k] !== q) k++;
            out += esc(q) + `<span class="str">${esc(src.slice(j + 1, k))}</span>` + esc(k < src.length ? q : '');
            j = Math.min(src.length, k + 1);
          }
        }
      }
      if (j < src.length && src[j] === '>') { out += esc('>'); j++; }
      i = j; continue;
    }
    out += esc(src[i]); i++;
  }
  return out;
}

// --- markdown ---
function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, href) => {
    let h = href.replace(/&amp;/g, '&');
    // On the static site, sibling .md pages are the .html we just built (GitHub still opens the .md source).
    if (/^[a-z0-9_.-]+\.md([?#].*)?$/i.test(h)) h = h.replace(/\.md(?=[?#]|$)/i, '.html');
    const safe = /^(https?:|mailto:|#|\.?\.?\/|[a-z0-9_.-]+\.html)/i.test(h) ? h : '#';
    return `<a href="${esc(safe)}">${t}</a>`;
  });
  return s;
}

function renderMd(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const toc = [];
  const used = new Map();
  let i = 0;
  const takeId = (title) => {
    let id = slug(title), n = used.get(id) || 0;
    used.set(id, n + 1);
    if (n) id = `${id}-${n}`;
    return id;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = /^```([\w-]*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] || '';
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      const code = buf.join('\n');
      const label = lang || 'code';
      html.push(`<div class="snip" data-lang="${esc(label)}"><div class="snip-head"><span>${esc(label)}</span><button type="button" class="copy" data-copy>Copy</button></div><pre><code class="language-${esc(label)}">${highlight(code, lang)}</code></pre></div>`);
      continue;
    }

    const hm = /^(#{1,3})\s+(.+)$/.exec(line);
    if (hm) {
      const level = hm[1].length;
      const title = hm[2].replace(/#+\s*$/, '').trim();
      const id = takeId(title);
      if (level <= 2) toc.push({ id, title, level });
      html.push(`<h${level} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${inline(title)}</h${level}>`);
      i++; continue;
    }

    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const split = (row) => row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const heads = split(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(split(lines[i])); i++; }
      html.push('<div class="table-wrap"><table><thead><tr>' + heads.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>'
        + rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('')
        + '</tbody></table></div>');
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const startRe = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      const items = [];
      while (i < lines.length) {
        if (startRe.test(lines[i])) {
          let text = lines[i].replace(startRe, '');
          i++;
          // Continuation lines (indented, not a new list marker / heading / fence).
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !startRe.test(lines[i].trimStart()) && !/^(#{1,3}\s|```)/.test(lines[i].trimStart())) {
            text += ' ' + lines[i].trim();
            i++;
          }
          items.push(text);
          continue;
        }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>` + items.map((t) => `<li>${inline(t)}</li>`).join('') + `</${tag}>`);
      continue;
    }

    if (/^---+\s*$/.test(line)) { html.push('<hr>'); i++; continue; }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|[-*]\s|\d+\.\s|\||---+\s*$)/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    html.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return { body: html.join('\n'), toc };
}

const CSS = `/* Hawkes Analytics docs — same tokens as the demo */
:root { color-scheme: light dark; --bg: #f6f5f2; --fg: #1b1b1b; --muted: #666; --card: #fff; --line: #ddd; --accent: #b3261e; --ok: #1b7f3b; --side: 240px; --toc: 200px; }
@media (prefers-color-scheme: dark) { :root { --bg: #121212; --fg: #eee; --muted: #aaa; --card: #1d1d1d; --line: #333; --accent: #ff8a80; --ok: #7bd88f; } }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, sans-serif; }
a { color: var(--accent); }
.site-header { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--card); position: sticky; top: 0; z-index: 20; }
.site-header .brand { font-weight: 700; color: var(--fg); text-decoration: none; }
.site-header nav { display: flex; gap: 12px; flex-wrap: wrap; }
.site-header nav a { color: var(--muted); text-decoration: none; font-weight: 600; }
.site-header nav a:hover, .site-header nav a[aria-current="page"] { color: var(--accent); }
.menu-btn { display: none; font: inherit; min-height: 44px; min-width: 44px; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--fg); cursor: pointer; }
.layout { display: grid; grid-template-columns: var(--side) minmax(0, 1fr) var(--toc); gap: 0; max-width: 1200px; margin: 0 auto; min-height: calc(100vh - 57px); }
.sidebar { padding: 20px 12px 40px 16px; border-right: 1px solid var(--line); position: sticky; top: 57px; align-self: start; max-height: calc(100vh - 57px); overflow: auto; }
.sidebar h2 { margin: 0 0 8px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); font-weight: 700; }
.sidebar a { display: block; padding: 8px 10px; border-radius: 8px; color: var(--fg); text-decoration: none; min-height: 44px; line-height: 28px; }
.sidebar a:hover, .sidebar a[aria-current="page"] { background: var(--card); color: var(--accent); font-weight: 600; }
.article { padding: 24px 28px 64px; min-width: 0; max-width: 760px; }
.article > h1:first-child { margin-top: 0; }
.toc { padding: 20px 16px 40px 12px; border-left: 1px solid var(--line); position: sticky; top: 57px; align-self: start; max-height: calc(100vh - 57px); overflow: auto; font-size: 13px; }
.toc h2 { margin: 0 0 8px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.toc a { display: block; color: var(--muted); text-decoration: none; padding: 4px 0; overflow-wrap: anywhere; }
.toc a:hover, .toc a.active { color: var(--accent); }
.toc .l2 { padding-left: 12px; }
h1 { font-size: 1.6rem; margin: 0 0 12px; }
h2 { font-size: 1.2rem; margin: 28px 0 8px; scroll-margin-top: 72px; }
h3 { font-size: 1.05rem; margin: 20px 0 6px; scroll-margin-top: 72px; }
h1 .anchor, h2 .anchor, h3 .anchor { float: left; margin-left: -1.1em; padding-right: 0.3em; color: var(--line); text-decoration: none; opacity: 0; }
h1:hover .anchor, h2:hover .anchor, h3:hover .anchor, h1 .anchor:focus, h2 .anchor:focus, h3 .anchor:focus { opacity: 1; color: var(--accent); }
p, li { color: var(--fg); }
p { margin: 0 0 12px; }
.article > p, li { color: var(--muted); }
.article > p strong, li strong, .article > p code, li code { color: var(--fg); }
ul, ol { margin: 0 0 12px; padding-left: 1.3em; }
hr { border: 0; border-top: 1px solid var(--line); margin: 24px 0; }
.table-wrap { overflow-x: auto; margin: 0 0 16px; -webkit-overflow-scrolling: touch; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; vertical-align: top; padding: 8px 10px 8px 0; border-top: 1px solid var(--line); overflow-wrap: anywhere; }
th { font-weight: 600; }
code { font-family: ui-monospace, monospace; font-size: 0.9em; background: var(--card); border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; }
.snip { margin: 0 0 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); overflow: hidden; }
.snip-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 4px 4px 12px; border-bottom: 1px solid var(--line); font-size: 13px; color: var(--muted); }
button.copy { min-height: 44px; min-width: 88px; padding: 6px 14px; font: inherit; font-size: 15px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); cursor: pointer; }
button.copy:hover, button.copy:focus-visible { border-color: var(--accent); }
pre { margin: 0; padding: 12px; overflow: auto; font-size: 13px; line-height: 1.45; }
pre code { background: none; border: 0; padding: 0; font-size: inherit; color: var(--fg); }
.kw { color: #0b57d0; } .str { color: #1b7f3b; } .cmt { color: var(--muted); font-style: italic; } .num { color: #8a4b00; } .attr { color: #0b57d0; }
@media (prefers-color-scheme: dark) { .kw { color: #8ab4f8; } .str { color: #7bd88f; } .num { color: #fdd663; } .attr { color: #8ab4f8; } }
@media (max-width: 960px) {
  .layout { grid-template-columns: var(--side) minmax(0, 1fr); }
  .toc { display: none; }
}
@media (max-width: 720px) {
  .menu-btn { display: inline-flex; align-items: center; justify-content: center; }
  .layout { grid-template-columns: minmax(0, 1fr); }
  .sidebar { display: none; position: fixed; inset: 57px 0 auto 0; max-height: none; z-index: 30; background: var(--card); border-bottom: 1px solid var(--line); border-right: 0; padding: 12px 16px 20px; box-shadow: 0 8px 24px rgba(0,0,0,.12); }
  body.nav-open .sidebar { display: block; }
  .article { padding: 20px 16px 48px; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
}
`;

const JS = `(() => {
  const btn = document.getElementById('menu-btn');
  const side = document.getElementById('sidebar');
  if (btn && side) {
    btn.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', String(open));
    });
    side.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      document.body.classList.remove('nav-open');
      btn.setAttribute('aria-expanded', 'false');
    }));
  }
  document.querySelectorAll('button.copy').forEach((b) => {
    b.addEventListener('click', () => {
      const pre = b.closest('.snip')?.querySelector('pre');
      if (!pre) return;
      const text = pre.textContent || '';
      const done = () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => { b.textContent = 'Press Ctrl+C'; });
      else b.textContent = 'Press Ctrl+C';
    });
  });
  const links = [...document.querySelectorAll('.toc a')];
  const heads = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  const mark = () => {
    let cur = heads[0];
    for (const h of heads) if (h.getBoundingClientRect().top <= 80) cur = h;
    links.forEach((a) => a.classList.toggle('active', cur && a.getAttribute('href') === '#' + cur.id));
  };
  if (links.length) { mark(); window.addEventListener('scroll', mark, { passive: true }); }
})();`;

function pageHtml(page, body, toc) {
  const nav = PAGES.map((p) =>
    `<a href="${p.id}.html"${p.id === page.id ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`).join('\n      ');
  const tocHtml = toc.length
    ? `<aside class="toc" aria-label="On this page"><h2>On this page</h2>${toc.map((t) =>
      `<a class="l${t.level}" href="#${t.id}">${esc(t.title)}</a>`).join('\n') }</aside>`
    : '<aside class="toc" aria-label="On this page" hidden></aside>';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(page.title)} · Hawkes Analytics</title>
  <link rel="stylesheet" href="docs.css">
</head>
<body>
  <header class="site-header">
    <button type="button" class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="sidebar">Menu</button>
    <a class="brand" href="../index.html">Hawkes Analytics</a>
    <nav aria-label="Site">
      <a href="../index.html">Demo</a>
      <a href="index.html" aria-current="page">Docs</a>
    </nav>
  </header>
  <div class="layout">
    <nav class="sidebar" id="sidebar" aria-label="Docs">
      <h2>Docs</h2>
      ${nav}
    </nav>
    <article class="article" id="content">
${body}
    </article>
    ${tocHtml}
  </div>
  <script src="docs.js"></script>
</body>
</html>
`;
}

function build() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'docs.css'), CSS);
  fs.writeFileSync(path.join(OUT, 'docs.js'), JS);

  for (const page of PAGES) {
    const src = path.join(DOCS, page.file);
    if (!fs.existsSync(src)) throw new Error(`missing ${page.file}`);
    const md = fs.readFileSync(src, 'utf8');
    const { body, toc } = renderMd(md);
    fs.writeFileSync(path.join(OUT, `${page.id}.html`), pageHtml(page, body, toc));
  }

  // Hub: same as quickstart (so /docs/ and /docs/index.html work).
  fs.copyFileSync(path.join(OUT, 'quickstart.html'), path.join(OUT, 'index.html'));

  console.log(`✓ docs → dist/docs/ (${PAGES.map((p) => p.id).join(', ')}, index)`);
}

build();

// Builds every image used by the profile README.
// Text comes from .github/profile/content.json, numbers come live from the GitHub API.
// Usage: GITHUB_TOKEN=... node .github/scripts/build-profile.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const content = JSON.parse(readFileSync(join(ROOT, '.github/profile/content.json'), 'utf8'));
const shapes = JSON.parse(readFileSync(join(ROOT, '.github/profile/shapes.json'), 'utf8'));
const USER = process.env.PROFILE_USER || content.user;
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = join(ROOT, 'assets');
if (!TOKEN) {
  console.error('GITHUB_TOKEN is required');
  process.exit(1);
}

// ------------------------------------------------------------------ design tokens
const C = {
  tile: '#0A1122', tile2: '#101B33', line: '#1C2A4A', line2: '#2A3D66',
  text: '#EAF2FF', muted: '#9AA8BF', dim: '#7486A3',
  blue: '#3B82F6', cyan: '#22D3EE', sky: '#7DD3FC', ink: '#04101F', ok: '#34D399',
};
const SANS = "'Inter','Segoe UI',system-ui,-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono','Cascadia Code','Fira Code',Consolas,Menlo,'Courier New',monospace";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fmtMonth = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function wrap(s, n) {
  const lines = [];
  let cur = '';
  for (const w of s.split(' ')) {
    if (cur && (cur + ' ' + w).length > n) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function T(x, y, s, o = {}) {
  const { size = 16, fill = C.text, weight, font = SANS, anchor, ls, cls, style } = o;
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}"` +
    (weight ? ` font-weight="${weight}"` : '') + (anchor ? ` text-anchor="${anchor}"` : '') +
    (ls != null ? ` letter-spacing="${ls}"` : '') + (cls ? ` class="${cls}"` : '') + (style ? ` style="${style}"` : '') +
    ` fill="${fill}">${esc(s)}</text>`;
}
const eyebrow = (x, y, s, fill = C.dim) => T(x, y, s.toUpperCase(), { size: 14, fill, font: MONO, ls: 2.2, weight: 600 });

const icon = (name, x, y, size = 24, color = C.cyan, sw = 1.8) =>
  `<g transform="translate(${x} ${y}) scale(${(size / 24).toFixed(4)})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${shapes.icons[name]}</g>`;
const logo = (name, x, y, size, color, extra = '') =>
  `<g transform="translate(${x} ${y}) scale(${(size / 24).toFixed(4)})"><path${extra} fill="${color}" d="${shapes.logos[name]}"/></g>`;
const brand = (key, x, y, size, color) =>
  `<g transform="translate(${x} ${y}) scale(${(size / 24).toFixed(4)})">${shapes.brands[key].replace(/\stransform="[^"]*"/, '').replaceAll('#FFB547', color)}</g>`;

function iconBox(x, y, name, size = 40) {
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.3}" fill="${C.blue}" fill-opacity=".14" stroke="${C.line2}"/>` +
    icon(name, x + (size - size * 0.55) / 2, y + (size - size * 0.55) / 2, size * 0.55, C.cyan, 2);
}

function chip(x, y, label, o = {}) {
  const { h = 34, size = 15, color = C.sky, fill = C.blue, fo = 0.12, stroke = C.line2, pad = 15 } = o;
  const w = Math.round(label.length * size * 0.62 + pad * 2);
  return {
    w,
    svg: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" fill-opacity="${fo}" stroke="${stroke}"/>` +
      T(+(x + w / 2).toFixed(1), +(y + h / 2 + size * 0.35).toFixed(1), label, { size, fill: color, font: MONO, anchor: 'middle' }),
  };
}

let uid = 0;
function tile(x, y, w, h, inner = '', o = {}) {
  const id = `c${++uid}`;
  const r = o.r ?? 22;
  return `<g class="a"><g class="fu" style="animation-delay:${(o.delay ?? 0).toFixed(2)}s">
<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${o.fill || 'url(#tileG)'}"/>
<g clip-path="url(#${id})">${inner}</g>
<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r - 0.5}" fill="none" stroke="${o.stroke || C.line}"/>
<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r - 0.5}" fill="none" stroke="url(#edgeG)"/>
</g></g>`;
}

const BASE_CSS = `
@keyframes fu{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes ping{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.8);opacity:0}}
@keyframes drift{0%,100%{transform:translate(0,0)}50%{transform:translate(-50px,26px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.fu{animation:fu .8s cubic-bezier(.2,.7,.2,1) both}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2s ease-out infinite}
.drift{animation:drift 16s ease-in-out infinite}
.grow{transform-box:fill-box;transform-origin:50% 100%;animation:grow .9s cubic-bezier(.2,.7,.2,1) both}
@media (prefers-reduced-motion: reduce){.a,.a *{animation:none!important}}
`;

const COMMON_DEFS = `
<linearGradient id="tileG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.tile2}"/><stop offset="1" stop-color="${C.tile}"/></linearGradient>
<linearGradient id="brandG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>
<linearGradient id="brandH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>
<linearGradient id="barG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.blue}"/></linearGradient>
<linearGradient id="edgeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".12"/><stop offset=".3" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<radialGradient id="glowB"><stop offset="0" stop-color="${C.blue}" stop-opacity=".38"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
<radialGradient id="glowC"><stop offset="0" stop-color="${C.cyan}" stop-opacity=".22"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></radialGradient>
<pattern id="gridP" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="#FFFFFF" stroke-opacity=".035"/></pattern>`;

function svg(W, H, title, desc, body, { defs = '', css = '' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(desc)}</desc>
<style>${BASE_CSS}${css}</style>
<defs>${COMMON_DEFS}${defs}</defs>
${body}
</svg>
`;
}

// ------------------------------------------------------------------ GitHub data
async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-builder' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GitHub API ${res.status}: ${JSON.stringify(json.errors || json)}`);
  return json.data;
}

async function loadData() {
  const { user: u } = await gql(`query($login:String!){ user(login:$login){
    login createdAt followers{totalCount}
    repositories(ownerAffiliations:OWNER, privacy:PUBLIC, first:100, orderBy:{field:PUSHED_AT,direction:DESC}){
      totalCount nodes{ name isFork stargazerCount pushedAt primaryLanguage{name color}
        languages(first:10, orderBy:{field:SIZE,direction:DESC}){ edges{ size node{name color} } } } }
    contributionsCollection{ totalCommitContributions totalPullRequestContributions contributionYears
      contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount weekday } } } } } }`, { login: USER });

  const days = new Map();
  for (const y of u.contributionsCollection.contributionYears) {
    const r = await gql(`query($login:String!,$from:DateTime!,$to:DateTime!){ user(login:$login){
      contributionsCollection(from:$from,to:$to){ contributionCalendar{ weeks{ contributionDays{ date contributionCount } } } } } }`,
    { login: USER, from: `${y}-01-01T00:00:00Z`, to: `${y}-12-31T23:59:59Z` });
    for (const w of r.user.contributionsCollection.contributionCalendar.weeks) for (const d of w.contributionDays) days.set(d.date, d.contributionCount);
  }
  const cal = u.contributionsCollection.contributionCalendar;
  for (const w of cal.weeks) for (const d of w.contributionDays) days.set(d.date, d.contributionCount);

  const today = new Date().toISOString().slice(0, 10);
  const series = [...days.entries()].filter(([d]) => d <= today).sort(([a], [b]) => (a < b ? -1 : 1));
  let longest = 0, run = 0;
  for (const [, c] of series) { run = c > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let current = 0, i = series.length - 1;
  if (i >= 0 && series[i][1] === 0) i--; // today may simply not have activity yet
  for (; i >= 0 && series[i][1] > 0; i--) current++;

  const yearDays = cal.weeks.flatMap((w) => w.contributionDays);
  const byWeekday = Array(7).fill(0);
  for (const d of yearDays) byWeekday[d.weekday] += d.contributionCount;
  const best = yearDays.reduce((a, b) => (b.contributionCount > a.contributionCount ? b : a), yearDays[0]);
  const weeks = cal.weeks.slice(-26).map((w) => ({ start: w.contributionDays[0].date, total: w.contributionDays.reduce((s, d) => s + d.contributionCount, 0) }));

  const langs = new Map();
  for (const r of u.repositories.nodes) {
    if (r.isFork) continue;
    for (const e of r.languages.edges) {
      const l = langs.get(e.node.name) || { name: e.node.name, color: e.node.color || C.muted, size: 0 };
      l.size += e.size;
      langs.set(l.name, l);
    }
  }
  const langTotal = [...langs.values()].reduce((s, l) => s + l.size, 0) || 1;
  const languages = [...langs.values()].sort((a, b) => b.size - a.size).map((l) => ({ ...l, pct: (l.size / langTotal) * 100 }));

  return {
    login: u.login,
    joined: u.createdAt,
    followers: u.followers.totalCount,
    repoCount: u.repositories.totalCount,
    repos: new Map(u.repositories.nodes.map((r) => [r.name.toLowerCase(), r])),
    stars: u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0),
    yearTotal: cal.totalContributions,
    commits: u.contributionsCollection.totalCommitContributions,
    prs: u.contributionsCollection.totalPullRequestContributions,
    allTime: series.reduce((s, [, c]) => s + c, 0),
    current, longest, byWeekday, best, weeks, languages,
    achievements: await loadAchievements(),
  };
}

async function loadAchievements() {
  let list = [];
  try {
    const html = await (await fetch(`https://github.com/${USER}?tab=achievements`, { headers: { 'User-Agent': 'Mozilla/5.0 (profile-builder)' } })).text();
    const seen = new Map();
    for (const tag of html.match(/<img[^>]+alt="Achievement: [^"]+"[^>]*>/g) || []) {
      const name = tag.match(/alt="Achievement: ([^"]+)"/)[1];
      const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1];
      if (src && !seen.has(name)) seen.set(name, src);
    }
    list = [...seen].map(([name, src]) => ({ name, src }));
  } catch (e) {
    console.warn('Could not read achievements page:', e.message);
  }
  if (!list.length) list = content.achievementsFallback;
  for (const a of list) {
    try {
      const res = await fetch(a.src);
      if (res.ok) a.data = `data:${res.headers.get('content-type') || 'image/png'};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
    } catch (e) {
      console.warn('Could not fetch achievement image:', a.name, e.message);
    }
  }
  return list.filter((a) => a.data).slice(0, 4);
}

// ------------------------------------------------------------------ hero
function buildHero(d) {
  const W = 1200, H = 444;
  let cx = 44;
  const chips = content.stack.map((s) => { const c = chip(cx, 252, s); cx += c.w + 10; return c.svg; }).join('');
  const roleW = content.role.length * 32 * 0.6;
  const rings = `<g fill="none" stroke="${C.line2}" stroke-opacity=".8"><circle cx="705" cy="40" r="80"/><circle cx="705" cy="40" r="140"/><circle cx="705" cy="40" r="200" stroke-dasharray="3 7"/></g>
<g class="a"><g style="transform-origin:705px 40px;animation:spin 22s linear infinite"><circle cx="565" cy="40" r="5" fill="${C.cyan}"/></g></g>
<g class="a"><g style="transform-origin:705px 40px;animation:spin 34s linear infinite reverse"><circle cx="705" cy="240" r="3.5" fill="${C.blue}"/></g></g>`;

  const A = tile(0, 0, 760, 300, `
<rect width="760" height="300" fill="url(#gridP)"/>
<g class="a"><g class="drift"><circle cx="660" cy="0" r="340" fill="url(#glowB)"/></g></g>
<circle cx="80" cy="330" r="260" fill="url(#glowC)"/>
${rings}
${T(44, 64, 'HELLO, I’M', { size: 15, fill: C.cyan, font: MONO, ls: 4, weight: 600 })}
${T(40, 148, content.name, { size: 80, weight: 800, ls: -1.5 })}
${T(44, 196, content.role, { size: 32, weight: 700, fill: 'url(#roleG)' })}
${T(44, 232, content.tagline, { size: 20, fill: C.muted })}
${chips}`, { delay: 0.05 });

  const B1 = tile(776, 0, 424, 142, `
<circle cx="1170" cy="150" r="110" fill="#FFFFFF" fill-opacity=".10"/>
<circle cx="1170" cy="150" r="64" fill="#FFFFFF" fill-opacity=".10"/>
${T(800, 82, content.work.duration, { size: 50, weight: 800, fill: C.ink, ls: -1 })}
${T(802, 116, `${content.work.title} at ${content.work.company}`, { size: 19, weight: 600, fill: C.ink })}
${icon('briefcase', 1148, 24, 28, C.ink, 2)}`, { fill: 'url(#brandG)', stroke: '#5FB3F9', delay: 0.15 });

  const B2 = tile(776, 158, 424, 142, `
${eyebrow(800, 200, 'Education')}
${T(800, 240, content.education.title, { size: 28, weight: 800 })}
${T(801, 270, content.education.school, { size: 18, fill: C.muted })}
${icon('cap', 1146, 180, 28)}`, { delay: 0.22 });

  const row = (x, w, label, title, sub, ic, extra = '', tx = x + 32) => `
${eyebrow(x + 32, 360, label)}
${extra}
${T(tx, 400, title, { size: 26, weight: 800 })}
${T(x + 33, 428, sub, { size: 17, fill: C.muted })}
${ic}`;

  const Ct = tile(0, 316, 388, 128, row(0, 388, 'Based in', content.location.city, content.location.country, icon('pin', 332, 338, 28)), { delay: 0.3 });
  const Dt = tile(404, 316, 388, 128, row(404, 388, 'On GitHub', `${d.repoCount} public repos`, `@${d.login} · since ${fmtMonth(d.joined)}`, brand('github', 736, 338, 28, C.cyan)), { delay: 0.36 });
  const Et = tile(808, 316, 392, 128, row(808, 392, 'Status', content.status.title, content.status.sub, icon('spark', 1144, 338, 28),
    `<circle cx="848" cy="391" r="7" fill="${C.ok}"/><g class="a"><circle class="ping" cx="848" cy="391" r="7" fill="none" stroke="${C.ok}" stroke-width="2"/></g>`, 866), { delay: 0.42 });

  return svg(W, H, `${content.name} — ${content.role}`,
    `${content.name}, ${content.role} at ${content.work.company} working with ${content.stack.join(', ')}. ${content.education.title} at ${content.education.school}. Based in ${content.location.city}, Bangladesh. ${d.repoCount} public repositories on GitHub. ${content.status.title}.`,
    A + B1 + B2 + Ct + Dt + Et,
    { defs: `<linearGradient id="roleG" gradientUnits="userSpaceOnUse" x1="44" y1="0" x2="${44 + roleW}" y2="0"><stop offset="0" stop-color="${C.sky}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>` });
}

// ------------------------------------------------------------------ about
function buildAbout() {
  const W = 1200, G = 16;
  const parts = [];
  let y = 104;
  for (const a of content.about) {
    const lines = wrap(a.text, 56);
    parts.push(iconBox(40, y - 27, a.icon, 38));
    lines.forEach((l, k) => parts.push(T(96, y + k * 30, l, { size: 20 })));
    y += lines.length * 30 + 20;
  }
  const h1 = Math.max(y + 4, 280);
  const A = tile(0, 0, 780, h1, `<circle cx="0" cy="0" r="300" fill="url(#glowB)"/>${eyebrow(40, 50, 'About me')}${parts.join('')}`, { delay: 0.05 });

  const q = wrap(content.quote, 19);
  const qy = (h1 - q.length * 38) / 2 + 40;
  const B = tile(796, 0, 404, h1, `
<circle cx="1200" cy="${h1}" r="260" fill="url(#glowC)"/>
${T(824, qy - 22, '“', { size: 110, weight: 800, fill: 'url(#brandG)' })}
${q.map((l, k) => T(832, qy + 36 + k * 38, l, { size: 28, weight: 800 })).join('')}`, { delay: 0.12 });

  const y2 = h1 + G, fw = (W - 3 * G) / 4, fh = 214;
  const facts = content.facts.map((f, i) => {
    const x = i * (fw + G);
    const lines = wrap(f.text, 19);
    return tile(x, y2, fw, fh, `${iconBox(x + 28, y2 + 28, f.icon, 46)}
${eyebrow(x + 28, y2 + 108, f.label)}
${lines.map((l, k) => T(x + 28, y2 + 142 + k * 27, l, { size: 20, weight: k === 2 ? 500 : 700, fill: k === 2 ? C.muted : C.text })).join('')}`, { delay: 0.18 + i * 0.06 });
  }).join('');

  const y3 = y2 + fh + G;
  const desc = wrap(content.work.summary, 66);
  const h3 = Math.max(172, 46 + desc.length * 30 + 24);
  const E = tile(0, y3, W, h3, `
<circle cx="1200" cy="${y3}" r="320" fill="url(#glowB)"/>
${eyebrow(40, y3 + 50, 'Experience')}
${T(40, y3 + 96, content.work.title, { size: 30, weight: 800 })}
${T(41, y3 + 128, `${content.work.company} · ${content.work.duration}`, { size: 17, fill: C.cyan, font: MONO, weight: 600 })}
<path d="M470 ${y3 + 32}V${y3 + h3 - 32}" stroke="${C.line2}"/>
${desc.map((l, k) => T(504, y3 + 70 + k * 30, l, { size: 19, fill: C.muted })).join('')}`, { delay: 0.45 });

  const H = y3 + h3;
  return svg(W, H, 'About Tumit Hasan',
    `${content.about.map((a) => a.text).join(' ')} Motto: "${content.quote}" ${content.facts.map((f) => `${f.label}: ${f.text}.`).join(' ')} Experience: ${content.work.title} at ${content.work.company} for ${content.work.duration}. ${content.work.summary}`,
    A + B + facts + E);
}

// ------------------------------------------------------------------ skills
function buildSkills() {
  const W = 1200, G = 16, h = 196;
  const [fe, be, db, cms, tools] = content.skills;
  const layout = [
    [fe, 0, 0, 780], [be, 796, 0, 404],
    [db, 0, h + G, 389], [cms, 405, h + G, 389], [tools, 810, h + G, 390],
  ];
  let n = 0;
  const total = content.skills.reduce((s, g) => s + g.items.length, 0);
  const cycle = (total * 0.3).toFixed(1);
  const tiles = layout.map(([g, x, y, w], gi) => {
    const step = Math.min(120, (w - 64) / g.items.length);
    const start = x + (w - step * g.items.length) / 2 + step / 2;
    const items = g.items.map((name, i) => {
      const cxp = start + i * step;
      const delay = (1 + n++ * 0.3).toFixed(2);
      return logo(name, +(cxp - 22).toFixed(1), y + 70, 44, C.text, ` class="lit" style="animation-delay:${delay}s"`) +
        T(+cxp.toFixed(1), y + 150, name, { size: 16, weight: 600, fill: C.muted, anchor: 'middle' });
    }).join('');
    return tile(x, y, w, h, `${eyebrow(x + 30, y + 44, g.label)}${T(x + w - 30, y + 44, `${g.items.length} tools`, { size: 13, fill: C.dim, font: MONO, anchor: 'end' })}${items}`, { delay: 0.05 + gi * 0.06 });
  }).join('');

  const y3 = 2 * (h + G);
  let cx = 30;
  const extra = content.skillsExtra.items.map((s) => { const c = chip(cx, y3 + 62, s); cx += c.w + 10; return c.svg; }).join('');
  const X = tile(0, y3, W, 124, `<circle cx="1200" cy="${y3 + 124}" r="300" fill="url(#glowC)"/>${eyebrow(30, y3 + 44, content.skillsExtra.label)}${extra}`, { delay: 0.4 });

  const H = y3 + 124;
  return svg(W, H, 'Skills and tools',
    `Tech stack. ${content.skills.map((g) => `${g.label}: ${g.items.join(', ')}`).join('. ')}. ${content.skillsExtra.label}: ${content.skillsExtra.items.join(', ')}.`,
    tiles + X,
    { css: `@keyframes lit{0%,100%{fill:${C.text}}5%{fill:${C.cyan}}16%{fill:${C.text}}}.lit{animation:lit ${cycle}s ease-in-out infinite}` });
}

// ------------------------------------------------------------------ live stats
function buildStats(d) {
  const W = 1200, G = 16;
  const tw = (W - 3 * G) / 4;
  const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;
  const nums = [
    ['Contributions', String(d.yearTotal), `in the last year · ${d.allTime} all time`],
    ['Commits', String(d.commits), `${d.prs} pull requests · last year`],
    ['Public repos', String(d.repoCount), `${d.stars} ${d.stars === 1 ? 'star' : 'stars'} earned`],
    ['Current streak', days(d.current), `longest: ${days(d.longest)}`],
  ].map(([label, value, sub], i) => {
    const x = i * (tw + G);
    return tile(x, 0, tw, 156, `${i === 0 ? '<circle cx="0" cy="0" r="220" fill="url(#glowB)"/>' : ''}
${eyebrow(x + 28, 44, label)}
${T(x + 26, 104, value, { size: 50, weight: 800, fill: i === 0 ? 'url(#brandH)' : C.text, ls: -1 })}
${T(x + 28, 134, sub, { size: 16, fill: C.muted })}`, { delay: 0.05 + i * 0.06 });
  }).join('');

  // weekly bars
  const y2 = 172, h2 = 320, bx = 40, bw = 700, base = y2 + 262, maxH = 160;
  const max = Math.max(1, ...d.weeks.map((w) => w.total));
  const slot = bw / d.weeks.length;
  let lastMonth = '', lastLabel = -9;
  const bars = d.weeks.map((w, i) => {
    const x = +(bx + i * slot + (slot - 16) / 2).toFixed(1);
    const bh = w.total ? Math.max(6, (w.total / max) * maxH) : 3;
    const month = new Date(w.start + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    let label = '';
    if (month !== lastMonth) {
      if (i - lastLabel >= 3) { label = T(x + 8, base + 30, month, { size: 13, fill: C.dim, font: MONO, anchor: 'middle' }); lastLabel = i; }
      lastMonth = month;
    }
    const top = w.total === max && max > 0 ? T(x + 8, +(base - bh - 10).toFixed(1), String(w.total), { size: 14, fill: C.cyan, font: MONO, weight: 700, anchor: 'middle' }) : '';
    const bar = w.total
      ? `<g class="a"><rect class="grow" style="animation-delay:${(0.3 + i * 0.03).toFixed(2)}s" x="${x}" y="${+(base - bh).toFixed(1)}" width="16" height="${+bh.toFixed(1)}" rx="5" fill="url(#barG)"/></g>`
      : `<rect x="${x}" y="${base - 3}" width="16" height="3" rx="1.5" fill="${C.line2}"/>`;
    return bar + top + label;
  }).join('');
  const grid = [0.33, 0.66, 1].map((f) => `<path d="M${bx} ${+(base - f * maxH).toFixed(1)}H${bx + bw}" stroke="${C.line}" stroke-dasharray="4 6"/>`).join('');
  const weekly = tile(0, y2, 780, h2, `<circle cx="780" cy="${y2}" r="300" fill="url(#glowB)"/>
${eyebrow(40, y2 + 46, 'Weekly contributions')}
${T(740, y2 + 46, 'last 26 weeks', { size: 13, fill: C.dim, font: MONO, anchor: 'end' })}
${grid}<path d="M${bx} ${base + 0.5}H${bx + bw}" stroke="${C.line2}"/>${bars}`, { delay: 0.3 });

  // languages
  const lx = 796, lw = 404, barW = lw - 56;
  const top = d.languages.slice(0, 5);
  let acc = 0;
  const seg = d.languages.map((l) => { const w = (l.pct / 100) * barW; const s = `<rect x="${(lx + 28 + acc).toFixed(1)}" y="${y2 + 72}" width="${Math.max(w, 0.5).toFixed(1)}" height="12" fill="${l.color}"/>`; acc += w; return s; }).join('');
  const rows = top.map((l, i) => {
    const ry = y2 + 132 + i * 38;
    return `<circle cx="${lx + 35}" cy="${ry - 6}" r="6" fill="${l.color}"/>${T(lx + 52, ry, l.name, { size: 18, weight: 600 })}${T(lx + lw - 28, ry, `${l.pct < 0.1 ? '<0.1' : l.pct.toFixed(1)}%`, { size: 16, fill: C.muted, font: MONO, anchor: 'end' })}`;
  }).join('');
  const langs = tile(lx, y2, lw, h2, `${eyebrow(lx + 28, y2 + 46, 'Top languages')}
<clipPath id="lbar"><rect x="${lx + 28}" y="${y2 + 72}" width="${barW}" height="12" rx="6"/></clipPath><g clip-path="url(#lbar)"><rect x="${lx + 28}" y="${y2 + 72}" width="${barW}" height="12" fill="${C.line}"/>${seg}</g>
${rows}`, { delay: 0.36 });

  // bottom row
  const y3 = y2 + h2 + G, h3 = 170, w3 = (W - 2 * G) / 3;
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const wdMax = Math.max(...d.byWeekday);
  const wdIdx = d.byWeekday.indexOf(wdMax);
  const wdPct = d.yearTotal ? Math.round((wdMax / d.yearTotal) * 100) : 0;
  const t1 = tile(0, y3, w3, h3, `${eyebrow(28, y3 + 46, 'Most active day')}
${T(26, y3 + 100, wdMax ? names[wdIdx] : '—', { size: 36, weight: 800 })}
${T(28, y3 + 134, `${wdPct}% of last year's contributions`, { size: 16, fill: C.muted })}`, { delay: 0.45 });
  const bx3 = w3 + G;
  const t2 = tile(bx3, y3, w3, h3, `${eyebrow(bx3 + 28, y3 + 46, 'Best day')}
${T(bx3 + 26, y3 + 100, `${d.best.contributionCount} contributions`, { size: 36, weight: 800 })}
${T(bx3 + 28, y3 + 134, fmtDate(d.best.date), { size: 16, fill: C.muted })}`, { delay: 0.5 });
  const ax = 2 * (w3 + G);
  let ach;
  if (!d.achievements.length) {
    ach = T(ax + 28, y3 + 104, 'None yet', { size: 30, weight: 800 });
  } else if (d.achievements.length === 1) {
    const a = d.achievements[0];
    ach = `<image href="${a.data}" x="${ax + 26}" y="${y3 + 64}" width="80" height="80"/>${T(ax + 124, y3 + 106, a.name, { size: 28, weight: 800 })}${T(ax + 125, y3 + 134, `on @${d.login}`, { size: 16, fill: C.muted })}`;
  } else {
    ach = d.achievements.map((a, i) => `<image href="${a.data}" x="${ax + 26 + i * 86}" y="${y3 + 64}" width="72" height="72"/>`).join('');
  }
  const t3 = tile(ax, y3, w3, h3, `<circle cx="${ax + w3}" cy="${y3}" r="200" fill="url(#glowC)"/>${eyebrow(ax + 28, y3 + 46, 'Achievements')}${ach}`, { delay: 0.55 });

  const H = y3 + h3;
  const desc = `GitHub activity for @${d.login}: ${d.yearTotal} contributions in the last year (${d.allTime} all time), ${d.commits} commits, ${d.prs} pull requests, ${d.repoCount} public repositories, current streak ${days(d.current)}, longest ${days(d.longest)}. Top languages: ${top.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(', ')}. Achievements: ${d.achievements.map((a) => a.name).join(', ') || 'none yet'}.`;
  return svg(W, H, 'GitHub activity', desc, nums + weekly + langs + t1 + t2 + t3);
}

// ------------------------------------------------------------------ project tiles
function buildProject(p, repo, i) {
  const W = 590, H = 320;
  const lines = wrap(p.description, 47);
  if (lines.length > 3) console.warn(`Description for ${p.name} wraps to ${lines.length} lines`);
  let cx = 28;
  const chips = [];
  for (const s of p.stack) {
    const c = chip(cx, 214, s, { h: 30, size: 14, pad: 12, color: C.text, fill: '#FFFFFF', fo: 0.04 });
    if (cx + c.w > W - 28) break;
    chips.push(c.svg);
    cx += c.w + 8;
  }
  const domain = p.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const lang = repo?.primaryLanguage;
  const right = repo
    ? `<text x="${W - 28}" y="294" font-family="${MONO}" font-size="14" text-anchor="end" fill="${C.dim}">${lang ? `<tspan fill="${lang.color || C.muted}">●</tspan> ${esc(lang.name)} · ` : ''}updated ${esc(fmtDate(repo.pushedAt))}</text>`
    : '';
  const body = tile(0, 0, W, H, `
<circle cx="${W}" cy="0" r="260" fill="url(#accGlow)"/>
<circle cx="56" cy="62" r="28" fill="url(#accG)"/>
${T(56, 71, p.name[0], { size: 26, weight: 800, fill: C.ink, anchor: 'middle' })}
${T(100, 58, p.name, { size: 28, weight: 800 })}
${T(101, 84, p.category.toUpperCase(), { size: 13, fill: p.accent, font: MONO, ls: 2, weight: 700 })}
<rect x="${W - 112}" y="36" width="84" height="30" rx="15" fill="${C.ok}" fill-opacity=".12" stroke="${C.ok}" stroke-opacity=".45"/>
<circle cx="${W - 94}" cy="51" r="4" fill="${C.ok}"/><g class="a"><circle class="ping" cx="${W - 94}" cy="51" r="4" fill="none" stroke="${C.ok}" stroke-width="1.6"/></g>
${T(W - 82, 56, 'LIVE', { size: 13, fill: C.ok, font: MONO, weight: 700 })}
<path d="M${W - 48} 56l7-7M${W - 47} 49h6v6" fill="none" stroke="${C.ok}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
${lines.slice(0, 3).map((l, k) => T(28, 134 + k * 28, l, { size: 20, fill: C.muted })).join('')}
${chips.join('')}
<path d="M28 262H${W - 28}" stroke="${C.line}"/>
${T(28, 294, domain, { size: 14, fill: C.dim, font: MONO })}
${right}`, { delay: 0.05 });
  return svg(W, H, `${p.name} — ${p.category}`,
    `${p.description} Built with ${p.stack.join(', ')}. Live at ${domain}.${repo ? ` Last updated ${fmtDate(repo.pushedAt)}.` : ''}`,
    body,
    {
      defs: `<linearGradient id="accG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.accent}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>
<radialGradient id="accGlow"><stop offset="0" stop-color="${p.accent}" stop-opacity=".3"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient>`,
    });
}

// ------------------------------------------------------------------ section headers, contact pills, footer
function buildHeader(num, title, sub) {
  const W = 1200, H = 88;
  return svg(W, H, `${num} — ${title}`, sub, tile(0, 0, W, H, `
<circle cx="0" cy="44" r="220" fill="url(#glowB)"/>
<rect x="22" y="20" width="48" height="48" rx="14" fill="url(#brandG)"/>
${T(46, 50.5, num, { size: 18, weight: 800, fill: C.ink, font: MONO, anchor: 'middle' })}
${T(90, 55, title, { size: 30, weight: 800 })}
${T(W - 30, 53, sub, { size: 17, fill: C.muted, anchor: 'end' })}`, { r: 20 }));
}

function buildConnect(c) {
  const W = 380, H = 96;
  return svg(W, H, c.label, c.sub, tile(0, 0, W, H, `
<circle cx="0" cy="48" r="140" fill="url(#glowB)"/>
<circle cx="50" cy="48" r="27" fill="url(#brandG)"/>
${brand(c.key, 37, 35, 26, C.ink)}
${T(94, 44, c.label, { size: 23, weight: 800 })}
${T(95, 70, c.sub, { size: 15, fill: C.dim, font: MONO })}
<path d="M${W - 40} 56l10-10M${W - 39} 46h9v9" fill="none" stroke="${C.cyan}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`, { r: 20 }));
}

function buildFooter(d) {
  const W = 1200, H = 176;
  return svg(W, H, 'Thanks for stopping by', `If you like my work, consider starring my repositories. Always open to collaborations, freelance gigs and learning opportunities. @${d.login} · Jashore, Bangladesh.`,
    tile(0, 0, W, H, `
<rect width="${W}" height="${H}" fill="url(#gridP)"/>
<g class="a"><g class="drift"><circle cx="1000" cy="0" r="320" fill="url(#glowB)"/></g></g>
<circle cx="150" cy="${H}" r="300" fill="url(#glowC)"/>
${T(600, 70, 'Thanks for stopping by!', { size: 38, weight: 800, anchor: 'middle', ls: -0.5 })}
${T(600, 108, 'If you like my work, consider starring my repositories.', { size: 19, fill: C.muted, anchor: 'middle' })}
${T(600, 138, 'Always open to collaborations, freelance gigs and learning opportunities.', { size: 17, fill: C.dim, anchor: 'middle' })}
<rect x="0" y="${H - 5}" width="${W}" height="5" fill="url(#brandH)"/>`));
}

// ------------------------------------------------------------------ main
const data = await loadData();
const files = {
  'hero.svg': buildHero(data),
  'about.svg': buildAbout(),
  'skills.svg': buildSkills(),
  'stats.svg': buildStats(data),
  'footer.svg': buildFooter(data),
  'headers/about.svg': buildHeader('01', 'About', 'Who I am and what I do'),
  'headers/projects.svg': buildHeader('02', 'Projects', 'Live client work on this account'),
  'headers/skills.svg': buildHeader('03', 'Skills', 'Tools I use every day'),
  'headers/activity.svg': buildHeader('04', 'GitHub Activity', `Updated daily from @${data.login}`),
  'headers/connect.svg': buildHeader('05', "Let's Connect", 'Always happy to talk'),
};
content.projects.forEach((p, i) => { files[`projects/${p.repo.toLowerCase()}.svg`] = buildProject(p, data.repos.get(p.repo.toLowerCase()), i); });
for (const c of content.connect) files[`connect/${c.key}.svg`] = buildConnect(c);

rmSync(OUT, { recursive: true, force: true });
for (const [name, body] of Object.entries(files)) {
  const path = join(OUT, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}
console.log(`Wrote ${Object.keys(files).length} files for @${data.login}: ${data.yearTotal} contributions last year, streak ${data.current}/${data.longest}, ${data.achievements.length} achievements.`);

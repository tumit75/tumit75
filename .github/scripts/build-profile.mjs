// Builds every image used by the profile README.
// Text comes from .github/profile/content.json, numbers and the avatar come live from GitHub.
// Usage: GITHUB_TOKEN=... node .github/scripts/build-profile.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROFILE = join(ROOT, '.github/profile');
const content = JSON.parse(readFileSync(join(PROFILE, 'content.json'), 'utf8'));
const shapes = JSON.parse(readFileSync(join(PROFILE, 'shapes.json'), 'utf8'));
const USER = process.env.PROFILE_USER || content.user;
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = join(ROOT, 'assets');
if (!TOKEN) {
  console.error('GITHUB_TOKEN is required');
  process.exit(1);
}

// ------------------------------------------------------------------ design tokens
const C = {
  bg: '#07050F', panel: '#0F0B1E', panel2: '#161030', line: '#2A2050', line2: '#3D2F72',
  text: '#F7F5FF', muted: '#C3BAE3', dim: '#968CBD',
  violet: '#A855F7', pink: '#EC4899', cyan: '#22D3EE', ink: '#0B0716', ok: '#34D399',
};
const LOGO_COLOR = {
  HTML5: '#E34F26', CSS3: '#2965F1', JavaScript: '#F7DF1E', TypeScript: '#3178C6', React: '#61DAFB',
  'Next.js': '#FFFFFF', Tailwind: '#38BDF8', 'Node.js': '#5FA04E', Express: '#FFFFFF', MongoDB: '#47A248',
  PostgreSQL: '#699EEB', Prisma: '#E2E8F0', Firebase: '#FFCA28', WordPress: '#3D9BD8', PHP: '#8892BF',
  Git: '#F05032', Figma: '#F24E1E', 'VS Code': '#23A9F2',
};
const BRAND_COLOR = {
  gmail: ['#EA4335', '#FBBC05'], linkedin: ['#0A66C2', '#38A1F3'], github: ['#6E40C9', '#A855F7'],
  portfolio: ['#A855F7', '#EC4899'], facebook: ['#1877F2', '#4E9BFF'], instagram: ['#F58529', '#DD2A7B'],
};
const SANS = "'Inter','Segoe UI',system-ui,-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono','Cascadia Code','Fira Code',Consolas,Menlo,'Courier New',monospace";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fmtMonth = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const r1 = (n) => +n.toFixed(1);

function wrap(s, n) {
  const lines = [];
  let cur = '';
  for (const w of s.split(' ')) {
    if (cur && (cur + ' ' + w).length > n) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function T(x, y, s, o = {}) {
  const { size = 16, fill = C.text, weight, font = SANS, anchor, ls, cls, style, filter, italic } = o;
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}"` +
    (weight ? ` font-weight="${weight}"` : '') + (italic ? ' font-style="italic"' : '') + (anchor ? ` text-anchor="${anchor}"` : '') +
    (ls != null ? ` letter-spacing="${ls}"` : '') + (cls ? ` class="${cls}"` : '') + (style ? ` style="${style}"` : '') +
    (filter ? ` filter="${filter}"` : '') + ` fill="${fill}">${esc(s)}</text>`;
}
const label = (x, y, s, fill = C.dim, anchor) => T(x, y, s.toUpperCase(), { size: 14, fill, font: MONO, ls: 2.4, weight: 700, anchor });

const icon = (name, x, y, size = 24, color = C.text, sw = 1.9) =>
  `<g transform="translate(${r1(x)} ${r1(y)}) scale(${(size / 24).toFixed(4)})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${shapes.icons[name]}</g>`;
const logo = (name, x, y, size, color = LOGO_COLOR[name] || C.text) =>
  `<g transform="translate(${r1(x)} ${r1(y)}) scale(${(size / 24).toFixed(4)})"><path fill="${color}" d="${shapes.logos[name]}"/></g>`;
const brand = (key, x, y, size, color) =>
  `<g transform="translate(${r1(x)} ${r1(y)}) scale(${(size / 24).toFixed(4)})">${shapes.brands[key].replace(/\stransform="[^"]*"/, '').replaceAll('#FFB547', color)}</g>`;

function chip(x, y, text, o = {}) {
  const { h = 32, size = 14, color = '#E9D5FF', fill = C.violet, fo = 0.14, stroke = C.violet, so = 0.45, pad = 14 } = o;
  const w = Math.round(text.length * size * 0.62 + pad * 2);
  return {
    w,
    svg: `<rect x="${r1(x)}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" fill-opacity="${fo}" stroke="${stroke}" stroke-opacity="${so}"/>` +
      T(r1(x + w / 2), r1(y + h / 2 + size * 0.35), text, { size, fill: color, font: MONO, anchor: 'middle', weight: 600 }),
  };
}

// A dark card with a soft glow and a light that keeps running around its border.
function card(x, y, w, h, inner, o = {}) {
  const id = o.id || `k${x}_${y}`;
  const r = o.r ?? 28;
  const glow = o.glow ?? C.violet;
  return `<g class="a"><g class="fu" style="animation-delay:${(o.delay ?? 0).toFixed(2)}s">
<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#panelG)"/>
<g clip-path="url(#${id})">
  <circle cx="${x + w}" cy="${y}" r="${Math.max(w, h) * 0.55}" fill="${glow}" fill-opacity=".16" filter="url(#soft)"/>
  ${inner}
</g>
<rect x="${x + 0.75}" y="${y + 0.75}" width="${w - 1.5}" height="${h - 1.5}" rx="${r - 0.75}" fill="none" stroke="${C.line2}" stroke-width="1.5"/>
<rect class="run" style="animation-delay:-${(o.delay ?? 0) * 4}s" x="${x + 0.75}" y="${y + 0.75}" width="${w - 1.5}" height="${h - 1.5}" rx="${r - 0.75}" fill="none" stroke="url(#neon3)" stroke-width="2" pathLength="1000" stroke-dasharray="140 860" stroke-linecap="round"/>
</g></g>`;
}

function waves(y, W, H) {
  // Two layers of a sine band that slide sideways, like a waving banner.
  const band = (amp, phase, base) => {
    let d = `M0 ${base}`;
    for (let x = 0; x <= W * 2; x += 300) {
      const up = ((x / 300) + phase) % 2 === 0 ? -amp : amp;
      d += ` Q${x + 150} ${base + up} ${x + 300} ${base}`;
    }
    return d + ` V${H} H0 Z`;
  };
  return `<g>
<g class="a"><path class="wave" style="animation-duration:14s" d="${band(26, 0, y + 22)}" fill="url(#neon3H)" fill-opacity=".35"/></g>
<g class="a"><path class="wave" style="animation-duration:9s;animation-direction:reverse" d="${band(20, 1, y + 40)}" fill="url(#neon3H)" fill-opacity=".9"/></g>
</g>`;
}

const BASE_CSS = `
@keyframes fu{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes tw{0%,100%{opacity:.15}50%{opacity:1}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes ping{0%{transform:scale(1);opacity:.85}100%{transform:scale(2.8);opacity:0}}
@keyframes wave{to{transform:translateX(-1200px)}}
@keyframes da{0%,100%{transform:translate(0,0)}50%{transform:translate(70px,34px)}}
@keyframes db{0%,100%{transform:translate(0,0)}50%{transform:translate(-80px,26px)}}
@keyframes run{to{stroke-dashoffset:-1000}}
@keyframes pulse{0%,100%{opacity:.2}50%{opacity:.85}}
@keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes draw{from{stroke-dasharray:0 100}}
.fu{animation:fu .9s cubic-bezier(.2,.7,.2,1) both}
.tw{animation:tw 3s ease-in-out infinite}
.bob{animation:bob 4s ease-in-out infinite}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2s ease-out infinite}
.wave{animation:wave 12s linear infinite}
.da{animation:da 18s ease-in-out infinite}
.db{animation:db 22s ease-in-out infinite}
.run{animation:run 7s linear infinite}
.pulse{animation:pulse 3s ease-in-out infinite}
.grow{transform-box:fill-box;transform-origin:50% 100%;animation:grow 1s cubic-bezier(.2,.7,.2,1) both}
@media (prefers-reduced-motion: reduce){.a,.a *{animation:none!important}}
`;

const COMMON_DEFS = `
<linearGradient id="panelG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.panel2}"/><stop offset="1" stop-color="${C.panel}"/></linearGradient>
<linearGradient id="neonG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.violet}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient>
<linearGradient id="neonH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.violet}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient>
<linearGradient id="neon3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.violet}"/><stop offset=".5" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>
<linearGradient id="neon3H" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1200" y2="0" spreadMethod="repeat"><stop offset="0" stop-color="#7C3AED"/><stop offset=".5" stop-color="#DB2777"/><stop offset="1" stop-color="#7C3AED"/></linearGradient>
<linearGradient id="barG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.violet}"/></linearGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter>
<filter id="glow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

function svg(W, H, title, desc, body, { defs = '', css = '' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
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

async function dataUri(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (profile-builder)' } });
    if (!res.ok) return null;
    return `data:${(res.headers.get('content-type') || 'image/png').split(';')[0]};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch (e) {
    console.warn('Could not fetch', url, e.message);
    return null;
  }
}

async function loadData() {
  const { user: u } = await gql(`query($login:String!){ user(login:$login){
    login createdAt avatarUrl(size:320) followers{totalCount}
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
    avatar: await dataUri(u.avatarUrl),
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
  for (const a of list) a.data = await dataUri(a.src);
  return list.filter((a) => a.data).slice(0, 4);
}

// ------------------------------------------------------------------ hero
function buildHero(d) {
  const W = 1200, H = 560, cx = 300, cy = 262;
  const rand = rng(75);
  const stars = Array.from({ length: 80 }, (_, i) => {
    const x = r1(rand() * W), y = r1(rand() * 470), r = r1(0.5 + rand() * 1.5);
    const tw = i % 3 === 0 ? ` class="tw" style="animation-delay:${r1(rand() * 3)}s"` : '';
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFFFFF" fill-opacity="${r1(0.25 + rand() * 0.6)}"${tw}/>`;
  }).join('');

  const orbitR = 200;
  const orbitLogos = ['React', 'Next.js', 'Node.js', 'MongoDB', 'TypeScript', 'WordPress'];
  const badges = orbitLogos.map((name, i) => {
    const a = (i / orbitLogos.length) * Math.PI * 2 - Math.PI / 2;
    const bx = cx + orbitR * Math.cos(a), by = cy + orbitR * Math.sin(a);
    return `<g class="up"><circle cx="${r1(bx)}" cy="${r1(by)}" r="27" fill="${C.panel}" stroke="${LOGO_COLOR[name]}" stroke-opacity=".55" stroke-width="1.5"/>${logo(name, bx - 13, by - 13, 26)}</g>`;
  }).join('');

  const avatar = d.avatar
    ? `<clipPath id="av"><circle cx="${cx}" cy="${cy}" r="124"/></clipPath><image href="${d.avatar}" x="${cx - 124}" y="${cy - 124}" width="248" height="248" preserveAspectRatio="xMidYMid slice" clip-path="url(#av)"/>`
    : `<circle cx="${cx}" cy="${cy}" r="124" fill="url(#neonG)"/>${T(cx, cy + 30, content.name[0], { size: 90, weight: 900, fill: C.ink, anchor: 'middle' })}`;

  const x0 = 580;
  const tag = wrap(`${content.tagline.replace(/\.$/, '')} with ${content.stack.slice(0, -1).join(', ')} & ${content.stack.at(-1)}.`, 46);
  const facts = [['pin', 'Jashore, Bangladesh'], ['briefcase', content.work.company], ['cap', content.education.title]];
  let fx = x0;
  const factRow = facts.map(([ic, s]) => {
    const out = icon(ic, fx, 366, 20, C.pink, 2) + T(fx + 28, 382, s, { size: 17, fill: C.muted, weight: 500 });
    fx += 28 + s.length * 17 * 0.53 + 30;
    return out;
  }).join('');
  const p1 = chip(x0, 410, content.status.title, { h: 40, size: 15, color: '#A7F3D0', fill: C.ok, stroke: C.ok, pad: 40 });
  const p2 = chip(x0 + p1.w + 12, 410, `${content.work.duration} experience`, { h: 40, size: 15, pad: 20 });

  const body = `
<clipPath id="heroClip"><rect width="${W}" height="${H}" rx="30"/></clipPath>
<g clip-path="url(#heroClip)">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <g class="a"><g class="da"><circle cx="230" cy="120" r="260" fill="${C.violet}" fill-opacity=".45" filter="url(#soft)"/></g></g>
  <g class="a"><g class="db"><circle cx="1020" cy="60" r="260" fill="${C.pink}" fill-opacity=".32" filter="url(#soft)"/></g></g>
  <g class="a"><g class="da" style="animation-duration:26s"><circle cx="760" cy="470" r="240" fill="${C.cyan}" fill-opacity=".22" filter="url(#soft)"/></g></g>
  <g class="a">${stars}</g>
  ${waves(476, W, H)}

  <circle cx="${cx}" cy="${cy}" r="${orbitR}" fill="none" stroke="#FFFFFF" stroke-opacity=".14" stroke-dasharray="2 9"/>
  <circle cx="${cx}" cy="${cy}" r="160" fill="${C.violet}" fill-opacity=".35" filter="url(#soft)"/>
  <g class="a"><g style="transform-origin:${cx}px ${cy}px;animation:spin 12s linear infinite"><circle cx="${cx}" cy="${cy}" r="138" fill="none" stroke="url(#neon3)" stroke-width="5" stroke-linecap="round" stroke-dasharray="210 50 90 50 120 347"/></g></g>
  <g class="a"><g style="transform-origin:${cx}px ${cy}px;animation:spin 30s linear infinite reverse"><circle cx="${cx}" cy="${cy}" r="152" fill="none" stroke="${C.cyan}" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="3 12"/></g></g>
  ${avatar}
  <circle cx="${cx}" cy="${cy}" r="124" fill="none" stroke="#FFFFFF" stroke-opacity=".18" stroke-width="2"/>
  <g class="a"><g class="orb">${badges}</g></g>

  <g class="a"><g class="fu" style="animation-delay:.1s">
    <rect x="${x0}" y="88" width="252" height="36" rx="18" fill="${C.violet}" fill-opacity=".16" stroke="${C.violet}" stroke-opacity=".55"/>
    <circle cx="${x0 + 22}" cy="106" r="5" fill="${C.ok}"/><circle class="ping" cx="${x0 + 22}" cy="106" r="5" fill="none" stroke="${C.ok}" stroke-width="1.6"/>
    ${T(x0 + 38, 111, "HELLO WORLD, I'M", { size: 14, fill: '#E9D5FF', font: MONO, ls: 2.5, weight: 700 })}
  </g></g>
  <g class="a"><g class="fu" style="animation-delay:.25s">${T(x0 - 4, 206, content.name, { size: 82, weight: 900, fill: 'url(#nameG)', ls: -2, filter: 'url(#glow)' })}</g></g>
  <g class="a"><g class="fu" style="animation-delay:.4s">${T(x0, 260, content.role, { size: 32, weight: 800, fill: C.text })}<rect x="${r1(x0 + content.role.length * 32 * 0.505 + 8)}" y="232" width="4" height="34" fill="${C.pink}" class="tw" style="animation-duration:1s"/></g></g>
  <g class="a"><g class="fu" style="animation-delay:.55s">${tag.map((l, k) => T(x0, 306 + k * 30, l, { size: 20, fill: C.muted })).join('')}</g></g>
  <g class="a"><g class="fu" style="animation-delay:.7s">${factRow}</g></g>
  <g class="a"><g class="fu" style="animation-delay:.85s">${p1.svg}<circle cx="${x0 + 22}" cy="430" r="5" fill="${C.ok}"/>${p2.svg}</g></g>

</g>`;
  return svg(W, H, `${content.name} — ${content.role}`,
    `${content.name}, ${content.role} at ${content.work.company} working with ${content.stack.join(', ')}. ${content.education.title} at ${content.education.school}. Based in Jashore, Bangladesh. ${content.status.title}.`,
    body,
    {
      css: `.orb{transform-origin:${cx}px ${cy}px;animation:spin 48s linear infinite}.up{transform-box:fill-box;transform-origin:center;animation:spin 48s linear infinite reverse}`,
      defs: `<linearGradient id="nameG" gradientUnits="userSpaceOnUse" x1="${x0}" y1="0" x2="${x0 + 560}" y2="0" spreadMethod="reflect"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#F0ABFC"/><stop offset=".75" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.cyan}"/><animateTransform attributeName="gradientTransform" type="translate" values="0 0;560 0;0 0" dur="10s" repeatCount="indefinite"/></linearGradient>`,
    });
}

// ------------------------------------------------------------------ section header
function buildHeader(num, title, ic) {
  const W = 1200, H = 112, w = 560, x = (W - w) / 2;
  return svg(W, H, `${num} — ${title}`, title, `
<defs><linearGradient id="lineL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.violet}" stop-opacity="0"/><stop offset="1" stop-color="${C.violet}"/></linearGradient>
<linearGradient id="lineR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.pink}" stop-opacity="0"/></linearGradient></defs>
<rect x="40" y="55" width="${x - 56}" height="2" fill="url(#lineL)"/>
<rect x="${x + w + 16}" y="55" width="${x - 56}" height="2" fill="url(#lineR)"/>
<g class="a"><circle class="pulse" cx="${x - 10}" cy="56" r="4" fill="${C.violet}"/><circle class="pulse" style="animation-delay:1.5s" cx="${x + w + 10}" cy="56" r="4" fill="${C.pink}"/></g>
${card(x, 18, w, 76, `
<circle cx="${x + 46}" cy="56" r="24" fill="url(#neonG)"/>
${icon(ic, x + 34, 44, 24, '#FFFFFF', 2.1)}
${T(x + 86, 67, title, { size: 32, weight: 900, ls: -0.5 })}
${T(x + w - 32, 63, num, { size: 18, fill: C.dim, font: MONO, weight: 700, anchor: 'end' })}`, { r: 38, id: 'hc' })}`);
}

// ------------------------------------------------------------------ about + experience
function buildAbout() {
  const W = 1200;
  const items = [];
  let y = 104;
  for (const a of content.about) {
    const lines = wrap(a.text, 50);
    items.push(`<rect x="48" y="${y - 30}" width="44" height="44" rx="14" fill="url(#neonG)"/>${icon(a.icon, 58, y - 20, 24, '#FFFFFF', 2)}`);
    lines.forEach((l, k) => items.push(T(112, y + k * 30, l, { size: 21, fill: C.text, weight: k === 0 ? 600 : 400 })));
    y += lines.length * 30 + 26;
  }
  const q = wrap(`“${content.quote}”`, 44);
  const qy = y + 18;
  const quote = `<rect x="48" y="${qy - 30}" width="4" height="${q.length * 34 + 18}" rx="2" fill="url(#neonG)"/>` +
    q.map((l, k) => T(72, qy + k * 34, l, { size: 24, weight: 700, italic: true, fill: '#F0ABFC' })).join('') +
    T(72, qy + q.length * 34 + 4, 'words I live by', { size: 15, fill: C.dim, font: MONO });
  const leftH = qy + q.length * 34 + 40;

  const fx = 770;
  const facts = [...content.facts, { icon: 'pin', label: 'Based in', text: `${content.location.city}, Bangladesh` }];
  let fy = 70;
  const factRows = facts.map((f) => {
    const lines = wrap(f.text, 30).slice(0, 2);
    const row = fy;
    fy += 52 + lines.length * 22;
    return ((fy) => `<circle cx="${fx + 22}" cy="${fy + 14}" r="22" fill="${C.violet}" fill-opacity=".18" stroke="${C.violet}" stroke-opacity=".5"/>${icon(f.icon, fx + 11, fy + 3, 22, '#E9D5FF', 2)}
${label(fx + 58, fy + 4, f.label)}
${lines.map((l, k) => T(fx + 58, fy + 30 + k * 22, l, { size: 18, weight: 700 })).join('')}`)(row);
  }).join('');
  const rightH = fy + 10;
  const h1 = Math.max(leftH, rightH);
  const aboutCard = card(0, 0, W, h1, `<path d="M736 40V${h1 - 40}" stroke="${C.line2}" stroke-dasharray="3 7"/>${items.join('')}${quote}${factRows}`, { id: 'ab', delay: 0.05 });

  const ey = h1 + 24;
  const desc = wrap(content.work.summary, 92);
  const eh = 188 + (desc.length - 1) * 30 + 44;
  const exp = card(0, ey, W, eh, `
<rect x="72.5" y="${ey + 40}" width="3" height="${eh - 80}" rx="1.5" fill="url(#neonG)"/>
<circle cx="74" cy="${ey + 76}" r="12" fill="${C.bg}" stroke="${C.pink}" stroke-width="3"/>
<g class="a"><circle class="ping" cx="74" cy="${ey + 76}" r="12" fill="none" stroke="${C.pink}" stroke-width="2"/></g>
${label(112, ey + 56, 'Experience', C.pink)}
${T(110, ey + 98, content.work.title, { size: 34, weight: 900, ls: -0.5 })}
${chip(112, ey + 116, `@ ${content.work.company} · ${content.work.duration}`, { h: 34, size: 15 }).svg}
${desc.map((l, k) => T(112, ey + 188 + k * 30, l, { size: 20, fill: C.muted })).join('')}`, { id: 'ex', delay: 0.2, glow: C.pink });

  const H = ey + eh;
  return svg(W, H, 'About Tumit Hasan',
    `${content.about.map((a) => a.text).join(' ')} Motto: "${content.quote}" ${facts.map((f) => `${f.label}: ${f.text}.`).join(' ')} Experience: ${content.work.title} at ${content.work.company} for ${content.work.duration}. ${content.work.summary}`,
    aboutCard + exp);
}

// ------------------------------------------------------------------ skills
function buildSkills() {
  const W = 1200;
  const rows = [
    ['Frontend', content.skills[0].items],
    ['Backend & DB', [...content.skills[1].items, ...content.skills[2].items]],
    ['CMS & Tools', [...content.skills[3].items, ...content.skills[4].items]],
  ];
  let n = 0;
  const tw = 108, th = 118, gap = 16, x0 = 256;
  const body = rows.map(([name, items], r) => {
    const y = 48 + r * 150;
    const tiles = items.map((it, i) => {
      const x = x0 + i * (tw + gap);
      const col = LOGO_COLOR[it] || C.text;
      const k = n++;
      return `<g class="a"><g class="bob" style="animation-delay:-${r1(k * 0.37)}s">
<rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="26" fill="${C.panel2}" stroke="${C.line2}" stroke-width="1.5"/>
<rect class="pulse" style="animation-delay:${r1(k * 0.33)}s;animation-duration:6s" x="${x}" y="${y}" width="${tw}" height="${th}" rx="26" fill="${col}" fill-opacity=".10" stroke="${col}" stroke-opacity=".8" stroke-width="1.5"/>
${logo(it, x + (tw - 46) / 2, y + 20, 46, col)}
${T(x + tw / 2, y + 98, it, { size: 14, weight: 700, fill: C.muted, anchor: 'middle' })}
</g></g>`;
    }).join('');
    return `${label(48, y + 54, name, C.text)}${T(48, y + 80, `${items.length} tools`, { size: 14, fill: C.dim, font: MONO })}${tiles}`;
  }).join('');
  const cy = 48 + 3 * 150 + 4;
  let cx = 256;
  const extras = content.skillsExtra.items.map((s) => { const c = chip(cx, cy, s, { h: 36, size: 14 }); cx += c.w + 10; return c.svg; }).join('');
  const H = cy + 36 + 44;
  return svg(W, H, 'Skills and tools',
    `${rows.map(([n2, items]) => `${n2}: ${items.join(', ')}`).join('. ')}. ${content.skillsExtra.label}: ${content.skillsExtra.items.join(', ')}.`,
    card(0, 0, W, H, `${body}${label(48, cy + 24, 'Also', C.text)}${extras}`, { id: 'sk', glow: C.cyan }));
}

// ------------------------------------------------------------------ projects
function buildProject(p, repo, i) {
  const W = 1200, H = 420;
  const left = i % 2 === 0;
  const mx = left ? 40 : 560, mw = 600, my = 40, mh = 340;
  const tx = left ? 690 : 48, tw = 462;
  const shotPath = join(PROFILE, 'shots', `${p.repo.toLowerCase()}.jpg`);
  const shot = existsSync(shotPath) ? `data:image/jpeg;base64,${readFileSync(shotPath).toString('base64')}` : null;
  const domain = p.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const mock = `
<g class="a"><g class="bob" style="animation-duration:6s">
<rect x="${mx - 10}" y="${my + 14}" width="${mw + 20}" height="${mh}" rx="22" fill="${p.accent}" fill-opacity=".35" filter="url(#soft)"/>
<clipPath id="shot"><rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="18"/></clipPath>
<g clip-path="url(#shot)">
  <rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="#1A1430"/>
  ${shot ? `<image href="${shot}" x="${mx}" y="${my + 36}" width="${mw}" height="${mh - 36}" preserveAspectRatio="xMidYMin slice"/>` : `<rect x="${mx}" y="${my + 36}" width="${mw}" height="${mh - 36}" fill="url(#neonG)"/>`}
  <rect x="${mx}" y="${my}" width="${mw}" height="36" fill="#1A1430"/>
</g>
<circle cx="${mx + 22}" cy="${my + 18}" r="5.5" fill="#FF5F57"/><circle cx="${mx + 40}" cy="${my + 18}" r="5.5" fill="#FEBC2E"/><circle cx="${mx + 58}" cy="${my + 18}" r="5.5" fill="#28C840"/>
<rect x="${mx + 84}" y="${my + 7}" width="${mw - 108}" height="22" rx="11" fill="${C.bg}" fill-opacity=".7"/>
${icon('shield', mx + 96, my + 11, 14, C.ok, 2.2)}
${T(mx + 116, my + 23, domain, { size: 12.5, fill: C.muted, font: MONO })}
<rect x="${mx + 0.75}" y="${my + 0.75}" width="${mw - 1.5}" height="${mh - 1.5}" rx="17.25" fill="none" stroke="#FFFFFF" stroke-opacity=".14" stroke-width="1.5"/>
</g></g>`;

  const lines = wrap(p.description, 42);
  if (lines.length > 4) console.warn(`Description for ${p.name} wraps to ${lines.length} lines`);
  const cat = chip(tx + 46, 64, p.category.toUpperCase(), { h: 30, size: 12.5, color: '#FFFFFF', fill: p.accent, fo: 0.22, stroke: p.accent, so: 0.7, pad: 12 });
  let cx = tx, cyy = 290;
  const chips = [];
  for (const s of p.stack) {
    const c = chip(cx, cyy, s, { h: 30, size: 13, pad: 11, color: C.text, fill: '#FFFFFF', fo: 0.05, stroke: '#FFFFFF', so: 0.16 });
    if (cx + c.w > tx + tw) break;
    chips.push(c.svg);
    cx += c.w + 8;
  }
  const lang = repo?.primaryLanguage;
  const meta = repo
    ? `<text x="${tx}" y="381" font-family="${MONO}" font-size="13.5" fill="${C.dim}">${lang ? `<tspan fill="${lang.color || C.muted}">●</tspan> ${esc(lang.name)} · ` : ''}${esc(fmtDate(repo.pushedAt))}</text>`
    : '';
  const cta = `<rect x="${tx + tw - 176}" y="354" width="176" height="42" rx="21" fill="url(#accH)"/>${T(tx + tw - 98, 381, 'Visit site', { size: 16, weight: 800, fill: '#FFFFFF', anchor: 'middle' })}<path d="M${tx + tw - 40} 382l9-9M${tx + tw - 39} 373h8v8" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;

  const text = `
${T(tx, 86, String(i + 1).padStart(2, '0'), { size: 22, weight: 800, fill: p.accent, font: MONO })}
${cat.svg}
${T(tx - 2, 150, p.name, { size: 44, weight: 900, ls: -1 })}
${lines.slice(0, 4).map((l, k) => T(tx, 192 + k * 27, l, { size: 19, fill: C.muted })).join('')}
${chips.join('')}
<path d="M${tx} 340H${tx + tw}" stroke="${C.line2}"/>
${meta}
${cta}`;

  return svg(W, H, `${p.name} — ${p.category}`,
    `${p.description} Built with ${p.stack.join(', ')}. Live at ${domain}.${repo ? ` Last updated ${fmtDate(repo.pushedAt)}.` : ''}`,
    card(0, 0, W, H, `${mock}<g class="a"><g class="fu" style="animation-delay:.2s">${text}</g></g>`, { id: 'pc', glow: p.accent }),
    { defs: `<linearGradient id="accH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.accent}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient>` });
}

// ------------------------------------------------------------------ live stats
function buildStats(d) {
  const W = 1200, G = 24;
  const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;
  const sw = (W - 3 * G) / 4;
  const nums = [
    ['layers', 'Contributions', d.yearTotal, `last year · ${d.allTime} all time`],
    ['code', 'Commits', d.commits, `${d.prs} pull requests · last year`],
    ['folder', 'Public repos', d.repoCount, `${d.stars} ${d.stars === 1 ? 'star' : 'stars'} earned`],
    ['spark', 'Day streak', d.current, `longest: ${days(d.longest)}`],
  ].map(([ic, name, value, sub], i) => {
    const x = i * (sw + G);
    return card(x, 0, sw, 176, `
<circle cx="${x + 46}" cy="48" r="22" fill="url(#neonG)"/>${icon(ic, x + 35, 37, 22, '#FFFFFF', 2)}
${label(x + 80, 54, name, C.muted)}
${T(x + 26, 124, String(value), { size: 60, weight: 900, fill: 'url(#neonH)', ls: -2 })}
${T(x + 28, 154, sub, { size: 15, fill: C.dim })}`, { id: `n${i}`, delay: 0.05 + i * 0.07, glow: i % 2 ? C.pink : C.violet });
  }).join('');

  // weekly bars
  const y2 = 200, h2 = 340, ww = 760, bx = 44, bw = ww - 88, base = y2 + 282, maxH = 170;
  const max = Math.max(1, ...d.weeks.map((w) => w.total));
  const slot = bw / d.weeks.length;
  let lastMonth = '', lastLabel = -9;
  const bars = d.weeks.map((w, i) => {
    const x = r1(bx + i * slot + (slot - 16) / 2);
    const bh = w.total ? Math.max(8, (w.total / max) * maxH) : 4;
    const month = new Date(w.start + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    let lab = '';
    if (month !== lastMonth) {
      if (i - lastLabel >= 3) { lab = T(x + 8, base + 32, month, { size: 13, fill: C.dim, font: MONO, anchor: 'middle' }); lastLabel = i; }
      lastMonth = month;
    }
    const top = w.total === max && max > 0 ? T(x + 8, r1(base - bh - 12), String(w.total), { size: 15, fill: '#F0ABFC', font: MONO, weight: 800, anchor: 'middle' }) : '';
    const bar = w.total
      ? `<g class="a"><rect class="grow" style="animation-delay:${r1(0.3 + i * 0.04)}s" x="${x}" y="${r1(base - bh)}" width="16" height="${r1(bh)}" rx="6" fill="url(#barG)"/></g>`
      : `<rect x="${x}" y="${base - 4}" width="16" height="4" rx="2" fill="${C.line2}"/>`;
    return bar + top + lab;
  }).join('');
  const grid = [0.33, 0.66, 1].map((f) => `<path d="M${bx} ${r1(base - f * maxH)}H${bx + bw}" stroke="${C.line2}" stroke-opacity=".6" stroke-dasharray="4 8"/>`).join('');
  const weekly = card(0, y2, ww, h2, `${label(44, y2 + 50, 'Weekly contributions', C.muted)}${T(ww - 44, y2 + 50, 'last 26 weeks', { size: 13, fill: C.dim, font: MONO, anchor: 'end' })}${grid}${bars}`, { id: 'wk', delay: 0.3 });

  // languages donut
  const lx = ww + G, lw = W - lx, dcx = lx + 112, dcy = y2 + 196, dr = 66;
  const top = d.languages.slice(0, 5);
  let acc = 0;
  const segs = d.languages.map((l) => {
    const len = Math.max(l.pct, 0.4);
    const s = `<circle cx="${dcx}" cy="${dcy}" r="${dr}" fill="none" stroke="${l.color}" stroke-width="24" pathLength="100" stroke-dasharray="${r1(len)} ${r1(100 - len)}" stroke-dashoffset="${r1(-acc)}" transform="rotate(-90 ${dcx} ${dcy})"/>`;
    acc += l.pct;
    return s;
  }).join('');
  const legend = top.map((l, i) => {
    const ry = y2 + 128 + i * 34;
    return `<circle cx="${lx + 228}" cy="${ry - 5}" r="6" fill="${l.color}"/>${T(lx + 242, ry, l.name, { size: 16, weight: 600 })}${T(W - 28, ry, `${l.pct < 0.1 ? '<0.1' : l.pct.toFixed(1)}%`, { size: 14, fill: C.dim, font: MONO, anchor: 'end' })}`;
  }).join('');
  const langs = card(lx, y2, lw, h2, `${label(lx + 32, y2 + 50, 'Top languages', C.muted)}
<circle cx="${dcx}" cy="${dcy}" r="${dr}" fill="none" stroke="${C.line}" stroke-width="24"/>${segs}
${T(dcx, dcy + 2, `${top[0] ? Math.round(top[0].pct) : 0}%`, { size: 26, weight: 900, anchor: 'middle' })}
${T(dcx, dcy + 24, top[0] ? top[0].name : '', { size: 12, fill: C.dim, font: MONO, anchor: 'middle' })}
${legend}`, { id: 'lg', delay: 0.36, glow: C.cyan });

  // bottom row
  const y3 = y2 + h2 + G, h3 = 176, w3 = (W - 2 * G) / 3;
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const wdMax = Math.max(...d.byWeekday);
  const wdPct = d.yearTotal ? Math.round((wdMax / d.yearTotal) * 100) : 0;
  const t1 = card(0, y3, w3, h3, `${label(32, y3 + 50, 'Most active day', C.muted)}
${T(30, y3 + 108, wdMax ? names[d.byWeekday.indexOf(wdMax)] : '—', { size: 40, weight: 900, fill: 'url(#neonH)' })}
${T(32, y3 + 142, `${wdPct}% of last year's contributions`, { size: 15, fill: C.dim })}`, { id: 't1', delay: 0.45 });
  const x2 = w3 + G;
  const t2 = card(x2, y3, w3, h3, `${label(x2 + 32, y3 + 50, 'Best day', C.muted)}
${T(x2 + 30, y3 + 108, `${d.best.contributionCount} contributions`, { size: 36, weight: 900 })}
${T(x2 + 32, y3 + 142, fmtDate(d.best.date), { size: 15, fill: C.dim })}`, { id: 't2', delay: 0.5, glow: C.pink });
  const ax = 2 * (w3 + G);
  let ach;
  if (!d.achievements.length) ach = T(ax + 32, y3 + 110, 'None yet', { size: 34, weight: 900 });
  else if (d.achievements.length === 1) {
    const a = d.achievements[0];
    ach = `<circle cx="${ax + 74}" cy="${y3 + 108}" r="46" fill="${C.cyan}" fill-opacity=".25" filter="url(#soft)"/><image href="${a.data}" x="${ax + 32}" y="${y3 + 66}" width="84" height="84"/>${T(ax + 136, y3 + 110, a.name, { size: 30, weight: 900 })}${T(ax + 137, y3 + 138, `earned on @${d.login}`, { size: 15, fill: C.dim })}`;
  } else ach = d.achievements.map((a, i) => `<image href="${a.data}" x="${ax + 30 + i * 88}" y="${y3 + 70}" width="76" height="76"/>`).join('');
  const t3 = card(ax, y3, w3, h3, `${label(ax + 32, y3 + 50, 'Achievements', C.muted)}${ach}`, { id: 't3', delay: 0.55, glow: C.cyan });

  const H = y3 + h3;
  const desc = `GitHub activity for @${d.login}: ${d.yearTotal} contributions in the last year (${d.allTime} all time), ${d.commits} commits, ${d.prs} pull requests, ${d.repoCount} public repositories, current streak ${days(d.current)}, longest ${days(d.longest)}. Top languages: ${top.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(', ')}. Achievements: ${d.achievements.map((a) => a.name).join(', ') || 'none yet'}.`;
  return svg(W, H, 'GitHub activity', desc, nums + weekly + langs + t1 + t2 + t3);
}

// ------------------------------------------------------------------ contact buttons and footer
function buildConnect(c) {
  const W = 380, H = 104;
  const [a, b] = BRAND_COLOR[c.key] || [C.violet, C.pink];
  return svg(W, H, c.label, c.sub, card(0, 0, W, H, `
<circle cx="52" cy="52" r="30" fill="url(#brandG)"/>
${brand(c.key, 38, 38, 28, '#FFFFFF')}
${T(98, 48, c.label, { size: 24, weight: 900 })}
${T(99, 74, c.sub, { size: 14, fill: C.dim, font: MONO })}
<path d="M${W - 42} 59l11-11M${W - 41} 48h10v10" fill="none" stroke="${b}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`, { r: 26, id: 'cb', glow: a }),
  { defs: `<linearGradient id="brandG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>` });
}

function buildFooter(d) {
  const W = 1200, H = 250;
  return svg(W, H, 'Thanks for stopping by', `Thanks for stopping by! If you like my work, consider starring my repositories. Always open to collaborations, freelance gigs and learning opportunities. @${d.login}, Jashore, Bangladesh.`, `
<clipPath id="fc"><rect width="${W}" height="${H}" rx="30"/></clipPath>
<g clip-path="url(#fc)">
${waves(40, W, H)}
<rect y="110" width="${W}" height="${H - 110}" fill="url(#neon3H)"/>
<g class="a"><g class="fu" style="animation-delay:.2s">
${T(600, 150, 'Thanks for stopping by!', { size: 44, weight: 900, anchor: 'middle', fill: '#FFFFFF', ls: -1 })}
${T(600, 188, 'If you like my work, consider starring my repositories.', { size: 20, weight: 600, anchor: 'middle', fill: '#FFFFFF' })}
${T(600, 218, 'Always open to collaborations, freelance gigs and learning opportunities.', { size: 17, anchor: 'middle', fill: '#FFFFFF' })}
</g></g>
</g>`);
}

// ------------------------------------------------------------------ main
const data = await loadData();
const files = {
  'hero.svg': buildHero(data),
  'about.svg': buildAbout(),
  'skills.svg': buildSkills(),
  'stats.svg': buildStats(data),
  'footer.svg': buildFooter(data),
  'headers/about.svg': buildHeader('01', 'About Me', 'code'),
  'headers/projects.svg': buildHeader('02', 'Projects', 'folder'),
  'headers/skills.svg': buildHeader('03', 'Tech Stack', 'layers'),
  'headers/activity.svg': buildHeader('04', 'GitHub Activity', 'terminal'),
  'headers/connect.svg': buildHeader('05', "Let's Connect", 'spark'),
};
content.projects.forEach((p, i) => { files[`projects/${p.repo.toLowerCase()}.svg`] = buildProject(p, data.repos.get(p.repo.toLowerCase()), i); });
for (const c of content.connect) files[`connect/${c.key}.svg`] = buildConnect(c);

rmSync(OUT, { recursive: true, force: true });
for (const [name, body] of Object.entries(files)) {
  const path = join(OUT, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}
console.log(`Wrote ${Object.keys(files).length} files for @${data.login}: ${data.yearTotal} contributions last year, streak ${data.current}/${data.longest}, ${data.achievements.length} achievements, avatar ${data.avatar ? 'ok' : 'missing'}.`);

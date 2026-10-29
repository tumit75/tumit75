// Builds the green stat, language, achievement and project cards for the profile README
// from this account's GitHub data. Usage: GITHUB_TOKEN=... node .github/scripts/build-cards.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'assets/cards');
const USER = process.env.PROFILE_USER || 'tumit75';
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error('GITHUB_TOKEN is required');
  process.exit(1);
}

// Projects shown on the profile. Live data (language, last update) is added from GitHub.
const PROJECTS = [
  { repo: 'sizanbd', name: 'SIZANBD', category: 'E-commerce', url: 'https://sizanbd.vercel.app',
    description: 'Gadget store for official, verified phones, laptops, audio and accessories, backed by a showroom in Dhaka.',
    stack: ['React', 'TypeScript', 'React Query', 'Zustand', 'Tailwind CSS', 'Express'] },
  { repo: 'mint-homes', name: 'Mint Homes', category: 'Real estate', url: 'https://mint-homes-delta.vercel.app',
    description: 'Long Island real estate site: search properties, meet licensed agents and explore client services in Nassau and Suffolk.',
    stack: ['React', 'TypeScript', 'Tailwind CSS', 'Motion', 'Express'] },
  { repo: 'lucas-heffner', name: 'Lucas Heffner', category: 'Author platform', url: 'https://lucas-heffner.vercel.app',
    description: 'Author platform for Lucas Heffner and Up Armor Publishing, with the Cut the Crap book, resources, community and a store.',
    stack: ['React', 'TypeScript', 'Tailwind CSS', 'Motion', 'Express'] },
  { repo: 'cat-the-carp', name: 'Cut The Crap', category: 'Book store', url: 'https://cat-the-carp.vercel.app',
    description: "Sales hub for the Cut The Crap book with a library, Founder's Edition, store, cart, checkout and customer portal.",
    stack: ['React', 'TypeScript', 'Tailwind CSS', 'Motion', 'Express'] },
  { repo: 'start', name: 'Start SAH', category: 'Training & coaching', url: 'https://start-two-nu.vercel.app',
    description: 'Site for a training and coaching organisation, built in Next.js to agree the visual identity before the WordPress build.',
    stack: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS'] },
  { repo: 'DoubleGood', name: 'Pop City Popcorn', category: 'Fundraising', url: 'https://double-good.vercel.app',
    description: 'Responsive fundraising homepage for Pop City Gourmet Popcorn that helps teams raise money and build community.',
    stack: ['React', 'TypeScript', 'Tailwind CSS', 'Motion'] },
];

const ACHIEVEMENT_TEXT = {
  'Pull Shark': 'Opened pull requests that have been merged.',
  Quickdraw: 'Closed an issue or pull request within 5 minutes of opening.',
  'Pair Extraordinaire': 'Coauthored commits on merged pull requests.',
  YOLO: 'Merged a pull request without code review.',
  Starstruck: 'Created a repository that has many stars.',
  'Galaxy Brain': 'Answered discussions.',
  'Public Sponsor': 'Sponsored open source work.',
  'Arctic Code Vault Contributor': 'Contributed code to the 2020 GitHub Archive Program.',
};

// Same palette and fonts as the hand-made assets in assets/v2.
const C = {
  lime: '#9AE600', bright: '#BBF451', deep: '#3D6300', border: '#1E2A18',
  bg1: '#0E130D', bg2: '#070908', text: '#F2F6EE', muted: '#8E9A88',
};
const SANS = "'Segoe UI','Inter',system-ui,-apple-system,Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n) => +n.toFixed(1);
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

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
  const { size = 14, fill = C.text, weight, font = SANS, anchor, ls } = o;
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}"` +
    (weight ? ` font-weight="${weight}"` : '') + (anchor ? ` text-anchor="${anchor}"` : '') +
    (ls != null ? ` letter-spacing="${ls}"` : '') + ` fill="${fill}">${esc(s)}</text>`;
}

function folderIcon() {
  const s = readFileSync(join(ROOT, 'assets/v2/icons/folder.svg'), 'utf8');
  return s.match(/<g transform="[^"]*" fill="none"[^>]*>(.*)<\/g>/s)[1];
}

const CSS = `
@keyframes rise{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
@keyframes sweep{0%{transform:translateX(0)}55%,100%{transform:translateX(1120px)}}
@keyframes seq{0%,100%{opacity:.25}30%{opacity:1}}
@keyframes ping{0%{transform:scale(1);opacity:.9}100%{transform:scale(2.6);opacity:0}}
@keyframes draw{from{stroke-dashoffset:var(--len)}to{stroke-dashoffset:var(--off)}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.rise{animation:rise .7s cubic-bezier(.2,.7,.2,1) .1s both}
.sweep{animation:sweep 8s ease-in-out 1s infinite}
.seq{animation:seq 1.5s ease-in-out infinite}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 1.8s ease-out infinite}
.grow{transform-box:fill-box;transform-origin:left;animation:grow 1s cubic-bezier(.2,.7,.2,1) .3s both}
@media (prefers-reduced-motion: reduce){.a,.a *{animation:none!important}}`;

const DEFS = `
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg2}"/></linearGradient>
<pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="${C.text}" stroke-opacity=".035" stroke-width=".6"/></pattern>
<radialGradient id="glow"><stop offset="0" stop-color="${C.lime}" stop-opacity=".18"/><stop offset="1" stop-color="${C.lime}" stop-opacity="0"/></radialGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.text}" stop-opacity="0"/><stop offset=".5" stop-color="${C.text}" stop-opacity=".05"/><stop offset="1" stop-color="${C.text}" stop-opacity="0"/></linearGradient>`;

// Card frame shared by everything: dark gradient, faint grid, glow, light sweep, rounded border.
function frame(W, H, title, desc, body, { r = 14, bar = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(desc)}</desc>
<style>${CSS}</style>
<defs>${DEFS}<clipPath id="clip"><rect width="${W}" height="${H}" rx="${r}"/></clipPath></defs>
<g clip-path="url(#clip)">
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <circle cx="40" cy="30" r="${Math.max(120, H)}" fill="url(#glow)"/>
  ${bar ? `<rect width="3" height="${H}" fill="${C.lime}"/>` : ''}
  <g class="a" transform="skewX(-18)"><rect class="sweep" x="-260" y="0" width="160" height="${H}" fill="url(#sheen)"/></g>
  ${body}
</g>
<rect x=".6" y=".6" width="${W - 1.2}" height="${H - 1.2}" rx="${r - 0.6}" fill="none" stroke="${C.border}" stroke-width="1.2"/>
</svg>
`;
}

const dots = (x, y) => `<g class="a" fill="${C.lime}">${[0, 1, 2].map((i) => `<rect class="seq" style="animation-delay:${i * 0.25}s" x="${x + i * 12}" y="${y}" width="8" height="8" rx="1.5"/>`).join('')}</g>`;

// ------------------------------------------------------------------ data
async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-cards' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GitHub API ${res.status}: ${JSON.stringify(json.errors || json)}`);
  return json.data;
}

async function dataUri(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (profile-cards)' } });
    if (!res.ok) return null;
    return `data:${(res.headers.get('content-type') || 'image/png').split(';')[0]};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}

async function loadAchievements() {
  let list = [];
  try {
    const html = await (await fetch(`https://github.com/${USER}?tab=achievements`, { headers: { 'User-Agent': 'Mozilla/5.0 (profile-cards)' } })).text();
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
  if (!list.length) list = [{ name: 'Pull Shark', src: 'https://github.githubassets.com/assets/pull-shark-default-498c279a747d.png' }];
  for (const a of list) a.data = await dataUri(a.src);
  return list.filter((a) => a.data).slice(0, 4);
}

async function loadData() {
  const { user: u } = await gql(`query($login:String!){ user(login:$login){
    login name pullRequests{totalCount} issues{totalCount}
    repositoriesContributedTo(first:1, contributionTypes:[COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]){ totalCount }
    repositories(ownerAffiliations:OWNER, privacy:PUBLIC, first:100, orderBy:{field:PUSHED_AT,direction:DESC}){
      totalCount nodes{ name isFork stargazerCount pushedAt primaryLanguage{name color}
        languages(first:10, orderBy:{field:SIZE,direction:DESC}){ edges{ size node{name color} } } } }
    contributionsCollection{ totalCommitContributions contributionCalendar{ totalContributions } } } }`, { login: USER });

  const langs = new Map();
  for (const r of u.repositories.nodes) {
    if (r.isFork) continue;
    for (const e of r.languages.edges) {
      const l = langs.get(e.node.name) || { name: e.node.name, color: e.node.color || C.muted, size: 0 };
      l.size += e.size;
      langs.set(l.name, l);
    }
  }
  const total = [...langs.values()].reduce((s, l) => s + l.size, 0) || 1;
  return {
    login: u.login,
    name: u.name || u.login,
    stars: u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0),
    commits: u.contributionsCollection.totalCommitContributions,
    contributions: u.contributionsCollection.contributionCalendar.totalContributions,
    prs: u.pullRequests.totalCount,
    issues: u.issues.totalCount,
    contributedTo: u.repositoriesContributedTo.totalCount,
    repoCount: u.repositories.totalCount,
    repos: new Map(u.repositories.nodes.map((r) => [r.name.toLowerCase(), r])),
    languages: [...langs.values()].sort((a, b) => b.size - a.size).map((l) => ({ ...l, pct: (l.size / total) * 100 })),
    achievements: await loadAchievements(),
  };
}

// ------------------------------------------------------------------ cards
const ICON = {
  star: '<path d="M8 1.5l1.9 4 4.4.5-3.3 3 .9 4.3L8 11.1 4.1 13.3 5 9 1.7 6l4.4-.5z"/>',
  commit: '<circle cx="8" cy="8" r="2.6"/><path d="M1 8h4.4M10.6 8H15"/>',
  pr: '<circle cx="4" cy="3.5" r="1.8"/><circle cx="4" cy="12.5" r="1.8"/><circle cx="12" cy="12.5" r="1.8"/><path d="M4 5.3v5.4M12 10.7V6.5c0-1.4-1-2.5-2.5-2.5H7M8.5 2.5L7 4l1.5 1.5"/>',
  issue: '<circle cx="8" cy="8" r="6.2"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/>',
  repo: '<path d="M3 2.5h8.5a1 1 0 0 1 1 1V13H4.2A1.2 1.2 0 0 1 3 11.8z"/><path d="M3 11.8a1.2 1.2 0 0 1 1.2-1.2h8.3"/>',
  pulse: '<path d="M1 8.5h3l2-5 3.5 9 2-4H15"/>',
};
const ic = (name, x, y) => `<g transform="translate(${x} ${y})" fill="none" stroke="${C.lime}" color="${C.lime}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</g>`;

function statsCard(d) {
  const W = 495, H = 195;
  const rows = [
    ['star', 'Total Stars Earned:', d.stars],
    ['commit', 'Total Commits (last year):', d.commits],
    ['pulse', 'Contributions (last year):', d.contributions],
    ['pr', 'Total PRs:', d.prs],
    ['issue', 'Total Issues:', d.issues],
  ];
  const body = rows.map(([i, label, v], k) => {
    const y = 76 + k * 24;
    return `<g class="a"><g class="rise" style="animation-delay:${(0.15 + k * 0.12).toFixed(2)}s">${ic(i, 25, y - 12)}${T(50, y, label, { size: 14, weight: 600, fill: C.text })}${T(272, y, String(v), { size: 14, weight: 700, fill: C.text })}</g></g>`;
  }).join('');
  const cx = 400, cy = 105, r = 46, len = 2 * Math.PI * r;
  const ring = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.border}" stroke-width="7"/>
<g class="a"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.lime}" stroke-width="7" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})" stroke-dasharray="${r1(len)}" style="--len:${r1(len)};--off:${r1(len * 0.25)};stroke-dashoffset:${r1(len * 0.25)};animation:draw 1.4s cubic-bezier(.6,0,.2,1) .3s both"/></g>
<g transform="translate(${cx - 20} ${cy - 20}) scale(1.6667)"><path fill="${C.text}" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></g>`;
  return frame(W, H, `${d.name}'s GitHub Stats`,
    `Total stars earned: ${d.stars}. Commits in the last year: ${d.commits}. Contributions in the last year: ${d.contributions}. Total pull requests: ${d.prs}. Total issues: ${d.issues}.`,
    `${T(25, 36, `${titleName(d.name)}'s GitHub Stats`, { size: 18, weight: 600, fill: C.lime })}${body}${ring}`);
}

const titleName = (n) => n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function langsCard(d) {
  const W = 350, H = 195;
  const top = d.languages.slice(0, 8);
  const barW = W - 50;
  let acc = 0;
  const segs = top.map((l) => { const w = (l.pct / 100) * barW; const s = `<rect x="${r1(25 + acc)}" y="52" width="${r1(Math.max(w, 1))}" height="8" fill="${l.color}"/>`; acc += w; return s; }).join('');
  const legend = top.map((l, i) => {
    const x = 25 + (i % 2) * 155, y = 88 + Math.floor(i / 2) * 24;
    return `<g class="a"><g class="rise" style="animation-delay:${(0.2 + i * 0.08).toFixed(2)}s"><circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${l.color}"/>${T(x + 16, y, `${l.name} ${l.pct < 0.1 ? '<0.1' : l.pct.toFixed(1)}%`, { size: 11.5, weight: 400, fill: C.text })}</g></g>`;
  }).join('');
  return frame(W, H, 'Most Used Languages', `Most used languages: ${top.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(', ')}.`,
    `${T(25, 36, 'Most Used Languages', { size: 18, weight: 600, fill: C.lime })}
<clipPath id="lb"><rect x="25" y="52" width="${barW}" height="8" rx="4"/></clipPath><g clip-path="url(#lb)"><rect x="25" y="52" width="${barW}" height="8" fill="${C.border}"/><g class="a"><g class="grow">${segs}</g></g></g>
${legend}`);
}

function achievementsCard(d) {
  const W = 820;
  const list = d.achievements;
  let body, H;
  if (list.length <= 1) {
    H = 150;
    const a = list[0];
    body = a
      ? `<circle cx="96" cy="75" r="56" fill="url(#glow)"/>
<image href="${a.data}" x="46" y="25" width="100" height="100"/>
<g class="a"><g class="rise">
${T(176, 52, `01 //  EARNED ON @${d.login.toUpperCase()}`, { size: 11, fill: C.lime, font: MONO, ls: 3 })}
${T(175, 88, a.name, { size: 30, weight: 800, fill: C.text })}
${T(176, 114, ACHIEVEMENT_TEXT[a.name] || 'GitHub achievement.', { size: 15, fill: C.muted })}
</g></g>${dots(780, 71)}`
      : T(40, 84, 'No achievements yet', { size: 24, weight: 800 });
  } else {
    H = 190;
    const colW = (W - 80) / list.length;
    body = list.map((a, i) => {
      const cx = 40 + colW * i + colW / 2;
      return `<g class="a"><g class="rise" style="animation-delay:${(0.1 + i * 0.12).toFixed(2)}s"><circle cx="${r1(cx)}" cy="70" r="46" fill="url(#glow)"/><image href="${a.data}" x="${r1(cx - 40)}" y="30" width="80" height="80"/>${T(r1(cx), 140, a.name, { size: 15, weight: 700, anchor: 'middle' })}${T(r1(cx), 162, (ACHIEVEMENT_TEXT[a.name] || '').replace(/\.$/, '').slice(0, 34), { size: 11, fill: C.muted, anchor: 'middle' })}</g></g>`;
    }).join('');
  }
  return frame(W, H, 'GitHub achievements', `GitHub achievements on @${d.login}: ${list.map((a) => a.name).join(', ') || 'none yet'}.`, body, { bar: true });
}

function projectCard(p, repo, i) {
  const W = 820;
  const lines = wrap(p.description, 98);
  const chipY = 82 + (lines.length - 1) * 20 + 16;
  const H = chipY + 22 + 18;
  let cx = 77;
  const chips = p.stack.map((s) => {
    const w = Math.round(s.length * 6.9 + 18);
    const out = `<rect x="${cx}" y="${chipY}" width="${w}" height="22" rx="5" fill="${C.bg2}" stroke="${C.deep}"/>${T(r1(cx + w / 2), chipY + 15, s, { size: 11, fill: C.bright, font: MONO, anchor: 'middle' })}`;
    cx += w + 8;
    return out;
  }).join('');
  const domain = p.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const lang = repo?.primaryLanguage;
  // Drop the word "updated" when the tech tags leave too little room for the full line.
  const metaText = (full) => `${lang ? `● ${lang.name} · ` : ''}${full ? 'updated ' : ''}${fmtDate(repo.pushedAt)}`;
  const full = repo && cx + 16 < W - 22 - metaText(true).length * 6.7;
  const meta = repo
    ? `<text x="${W - 22}" y="${chipY + 15}" font-family="${MONO}" font-size="11" text-anchor="end" fill="${C.muted}">${lang ? `<tspan fill="${lang.color || C.muted}">●</tspan> ${esc(lang.name)} · ` : ''}${full ? 'updated ' : ''}${esc(fmtDate(repo.pushedAt))}</text>`
    : '';
  const body = `
<rect x="14" y="14" width="44" height="44" rx="10" fill="${C.bg2}" stroke="${C.deep}" stroke-width="1.2"/>
<g transform="translate(24 24)" fill="none" stroke="${C.lime}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${folderIcon()}</g>
<g class="a"><g class="rise">
  <text x="78" y="30" font-family="${MONO}" font-size="11" letter-spacing="3" fill="${C.lime}">${String(i + 1).padStart(2, '0')}<tspan fill="${C.muted}" dx="8">//  ${esc(p.category.toUpperCase())}</tspan></text>
  ${T(77, 55, p.name, { size: 23, weight: 800 })}
</g></g>
<circle cx="${W - 120}" cy="26" r="4" fill="${C.lime}"/><g class="a"><circle class="ping" cx="${W - 120}" cy="26" r="4" fill="none" stroke="${C.lime}" stroke-width="1.4"/></g>
${T(W - 108, 30, 'LIVE', { size: 11, fill: C.lime, font: MONO, ls: 2, weight: 700 })}
${dots(W - 58, 22)}
${T(W - 22, 52, domain, { size: 11, fill: C.muted, font: MONO, anchor: 'end' })}
${lines.map((l, k) => T(77, 82 + k * 20, l, { size: 14, fill: '#C9D3C2' })).join('')}
${chips}
${meta}`;
  return frame(W, H, `${p.name} — ${p.category}`,
    `${p.description} Built with ${p.stack.join(', ')}. Live at ${domain}.${repo ? ` Last updated ${fmtDate(repo.pushedAt)}.` : ''}`,
    body, { bar: true });
}

// ------------------------------------------------------------------ main
const d = await loadData();
const files = {
  'stats.svg': statsCard(d),
  'languages.svg': langsCard(d),
  'achievements.svg': achievementsCard(d),
};
PROJECTS.forEach((p, i) => { files[`projects/${p.repo.toLowerCase()}.svg`] = projectCard(p, d.repos.get(p.repo.toLowerCase()), i); });

rmSync(OUT, { recursive: true, force: true });
for (const [name, body] of Object.entries(files)) {
  const path = join(OUT, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}
console.log(`Wrote ${Object.keys(files).length} cards for @${d.login}: ${d.commits} commits, ${d.languages.length} languages, ${d.achievements.length} achievements.`);

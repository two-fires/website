// Build the Two Fires blog: markdown posts -> /blog/<slug>.html + the blog.html card grid.
//
//   node scripts/build-blog.mjs            # write files
//   node scripts/build-blog.mjs --check    # report dropped source text, write nothing
//
// Source posts live in ../two-fires-blog (outside this repo). Each post carries
// frontmatter (title, slug, meta_description, date, category).
//
// POSTS below holds the per-post editorial layer that markdown cannot express:
// which clause of the headline takes the gradient italic, which paragraph is
// lifted into a pullquote, and how the "how we think about it" section maps onto
// the homepage fires-grid. Everything else is derived.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(SITE, '../../two-fires-blog');
const OUT = path.join(SITE, 'blog');
const CHECK = process.argv.includes('--check');

const CONTACT = 'lightmyfuse@two-fires.com';

// ---------------------------------------------------------------- editorial layer

const POSTS = {
  'ai-amplifies-what-you-already-are': {
    category: { label: 'AI & Marketing', slug: 'ai-marketing' },
    heroEm: 'What You Already Are',
    lightSection: 'The businesses winning with AI didn\'t start with AI',
    pullquote: 'If your foundation is weak, AI amplifies that weakness at scale. If your foundation is strong, AI becomes the most powerful multiplier you\'ve ever encountered.',
    fires: {
      section: 'How we think about it',
      intro: ['Two fires, one outcome.'],
      one: { label: 'Fire One · Brand', name: 'Brand.', desc: 'Thirty years of work at the world\'s most competitive companies, spent getting positioning, insight and distinctive assets right.' },
      two: { label: 'Fire Two · Engine', name: 'Engine.', desc: 'An AI agent stack we run every day to handle the production: research, drafting, distribution, reporting.' },
      outro: ['We build the foundation. Then we let AI multiply it. Never the other way around.'],
    },
    close: 'The honest test',
  },

  'your-product-isnt-the-problem': {
    category: { label: 'Growth', slug: 'growth' },
    heroEm: 'Your Altitude Is.',
    lightSection: 'What the altitude demands',
    pullquote: 'It feels like you tried. What you actually did was add volume to a foundation that was never built for this height.',
    fires: {
      section: 'How we think about it',
      intro: [],
      one: { label: 'Fire One · Brand', name: 'Brand.', desc: 'Thirty years of brand work at McDonald\'s, Mars, Unilever, Burger King and Primo Foods. The altitude where marketing has to earn its place.' },
      two: { label: 'Fire Two · Engine', name: 'Engine.', desc: 'The engine that executes it, every day, at volume.' },
      outro: ['We bring both to your hardest growth problem.'],
    },
    close: 'The reframe',
  },

  'theyre-already-buying-just-not-from-you': {
    category: { label: 'Brand Strategy', slug: 'brand-strategy' },
    heroEm: 'Just Not From You.',
    lightSection: 'What positioning actually is',
    pullquote: 'Visibility without that clarity just helps more people ignore you faster.',
    fires: {
      section: 'How we think about it',
      intro: [],
      one: { label: 'Fire One · Position', name: 'Position.', desc: 'We start with position, not tactics. Sharp positioning, deep customer insight, distinctive assets. Thirty years in the making.' },
      two: { label: 'Fire Two · Engine', name: 'Engine.', desc: 'The engine takes that position and puts it everywhere it needs to be, at a scale a traditional agency cannot match.' },
      outro: ['Foundation first. Amplification second.'],
    },
    close: 'The reframe',
  },

  'busy-is-not-the-same-as-growing': {
    category: { label: 'Growth', slug: 'growth' },
    heroEm: 'as Growing.',
    lightSection: 'Motion is not progress',
    pullquote: 'Activity feels like progress because you can see it and count it. But volume without strategy is just a faster, more expensive way to say nothing.',
    fires: {
      section: 'The order most firms get backwards',
      intro: [
        'In most agencies, the strategic calls are made by the least experienced people in the building, or by an AI tool with no judgment, while the people with real depth are nowhere near the decision.',
        'We run it the other way.',
      ],
      one: { label: 'Fire One · Craft', name: 'Craft.', desc: 'We handle judgment, strategy and the calls that matter. Craft decides what is worth making.' },
      two: { label: 'Fire Two · Engine', name: 'Engine.', desc: 'The agent stack handles the production. The engine makes it, at scale.' },
      outro: [],
    },
    close: 'The reframe',
  },

  'everyone-has-the-same-ai': {
    category: { label: 'AI & Marketing', slug: 'ai-marketing' },
    heroEm: 'That\'s the Opportunity.',
    lightSection: 'What still cannot be copied',
    pullquote: 'The whole internet now sounds like a polite, capable robot that has read everything and believes nothing. Technically fine. Completely forgettable.',
    fires: {
      section: 'Built from craft, not gimmick',
      intro: ['This is the whole reason we exist in the shape we do.'],
      one: { label: 'Fire One · Craft', name: 'Craft.', desc: 'The fires, thirty years of brand work, decide what is worth producing in the first place, and make sure it sounds like you and no one else.' },
      two: { label: 'Fire Two · Engine', name: 'Engine.', desc: 'The engine does the production. It is fast, tireless and very good.' },
      outro: ['Using AI is not the advantage anymore. Everyone is doing that. Having something worth amplifying is the advantage.'],
    },
    close: 'The reframe',
  },

  'a-customer-youve-never-studied': {
    category: { label: 'Customer Intelligence', slug: 'customer-intelligence' },
    heroEm: 'You\'ve Never Actually Studied.',
    lightSection: 'What insight actually is',
    pullquote: 'The room goes quiet.',
    fires: {
      section: 'How we think about it',
      intro: [],
      one: { label: 'Fire One · Insight', name: 'Insight.', desc: 'Every framework we use is tested against real consumer behaviour, built over thirty years in the world\'s most competitive categories.' },
      two: { label: 'Fire Two · Engine', name: 'Engine.', desc: 'The engine takes that insight and puts it to work everywhere, at a scale and speed that used to be impossible.' },
      outro: ['Insight first. Amplification second. Always in that order.'],
    },
    close: 'The reframe',
  },
};

// ---------------------------------------------------------------- helpers

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const longDate = (iso) => { const [y,m,d] = iso.split('-').map(Number); return `${d} ${MONTHS[m-1]} ${y}`; };
const shortDate = (iso) => { const [y,m,d] = iso.split('-').map(Number); return `${d} ${MONTHS[m-1].slice(0,3)} ${y}`; };

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('no frontmatter');
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    fm[kv[1]] = v;
  }
  return { fm, body: m[2] };
}

// Split markdown into an intro run plus one entry per H2.
function parseBody(md) {
  const lines = md.replace(/^\s*#\s+.*\n/, '').split('\n');
  const intro = [];
  const sections = [];
  let para = [];
  const target = () => (sections.length ? sections[sections.length - 1].paras : intro);
  const flush = () => { if (para.length) { target().push(para.join(' ')); para = []; } };
  for (const line of lines) {
    const t = line.trim();
    if (!t) { flush(); continue; }
    const h2 = t.match(/^##\s+(.*)$/);
    if (h2) { flush(); sections.push({ title: h2[1], paras: [] }); continue; }
    para.push(t);
  }
  flush();
  return { intro, sections };
}

const readTime = (md) => Math.max(1, Math.round(md.split(/\s+/).filter(Boolean).length / 220));

// Wrap the configured clause of the headline in the gradient italic.
function heroTitle(title, em) {
  if (!em) return esc(title);
  const i = title.lastIndexOf(em);
  if (i === -1) throw new Error(`heroEm not found in title: ${em}`);
  return esc(title.slice(0, i)) + `<em>${esc(title.slice(i, i + em.length))}</em>` + esc(title.slice(i + em.length));
}

const paraHtml = (t) => `            <p>${esc(t)}</p>`;
const num = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------- css

const BASE_CSS = readFileSync(path.join(SITE, 'case-study-wellness.html'), 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];

const POST_CSS = `
    /* ============================ READING PROGRESS ============================ */
    .progress {
      position: fixed; top: 0; left: 0; height: 2px; width: 0;
      background: linear-gradient(90deg, var(--purple-deep), var(--purple), var(--purple-bright));
      box-shadow: 0 0 12px var(--purple-glow);
      z-index: 200; transition: width 0.1s linear;
    }

    /* ============================ POST HERO ============================ */
    .post-hero { padding: 56px 0 64px; border-bottom: 1px solid var(--border); }
    .post-hero h1 {
      font-family: var(--font-display); font-weight: 500;
      font-size: clamp(2.2rem, 5vw, 4rem); line-height: 1.04;
      letter-spacing: -0.025em; margin-bottom: 28px; max-width: 20ch;
      opacity: 0; animation: fadeUp 0.8s ease 0.3s forwards;
    }
    .post-hero h1 em {
      font-style: italic; letter-spacing: -0.01em;
      color: var(--purple-bright);
      background: linear-gradient(135deg, var(--purple-deep) 0%, var(--purple) 100%);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* ============================ SECTIONS ============================ */
    .post-section { padding: 76px 0; position: relative; z-index: 2; }
    .post-section.intro { padding-top: 64px; padding-bottom: 40px; }
    .post-section.soft { background: var(--bg-soft); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }

    .post-num {
      font-family: var(--font-mono); font-size: 10px;
      letter-spacing: 0.22em; text-transform: uppercase;
      color: var(--purple-bright); margin-bottom: 20px;
      display: inline-flex; align-items: center; gap: 12px;
    }
    .post-num::after { content: ""; width: 32px; height: 1px; background: var(--purple); opacity: 0.5; }
    .section-light .post-num { color: var(--purple-deep); }
    .section-light .post-num::after { background: var(--purple-deep); }

    .post-section h2 {
      font-family: var(--font-display); font-weight: 500;
      font-size: clamp(1.6rem, 3vw, 2.4rem); line-height: 1.12;
      letter-spacing: -0.02em; margin-bottom: 32px; max-width: 22ch;
    }

    /* Opening paragraph carries a drop cap and rides a little larger. */
    .post-lede-para {
      font-size: clamp(1.15rem, 1.7vw, 1.35rem);
      line-height: 1.6; color: var(--text);
    }
    .post-lede-para::first-letter {
      font-family: var(--font-display); font-style: italic; font-weight: 500;
      float: left; font-size: 4.6rem; line-height: 0.82;
      padding: 6px 14px 0 0; color: var(--purple-bright);
      text-shadow: 0 0 40px var(--purple-glow);
    }

    .section-light .body-copy p { color: var(--text-muted-on-light); }

    /* ============================ PULLQUOTE ============================ */
    .post-pull { padding: 4px 0 20px; position: relative; z-index: 2; }
    .post-pull .quote {
      font-family: var(--font-display); font-style: italic; font-weight: 500;
      font-size: clamp(1.5rem, 3.2vw, 2.4rem); line-height: 1.3;
      letter-spacing: -0.015em; color: var(--text);
      max-width: 22ch;
      border-left: 3px solid var(--purple);
      padding-left: 32px;
    }
    @media (max-width: 720px) { .post-pull .quote { padding-left: 20px; max-width: 100%; } }

    /* ============================ FIRES ============================ */
    .post-fires {
      padding: 84px 0; position: relative; z-index: 2;
      background: var(--bg-soft);
      border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
    }
    .fires-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 8px; }
    @media (max-width: 800px) { .fires-grid { grid-template-columns: 1fr; gap: 40px; } }
    .fire-rule { width: 40px; height: 2px; background: var(--purple); box-shadow: 0 0 12px var(--purple-glow); margin-bottom: 16px; }
    .fire-label {
      font-family: var(--font-mono); font-size: 10px;
      letter-spacing: 0.22em; text-transform: uppercase;
      color: var(--purple-bright); font-weight: 600; margin-bottom: 12px;
    }
    .fire-name { font-family: var(--font-display); font-style: italic; font-size: clamp(2rem, 3.5vw, 2.6rem); margin-bottom: 20px; line-height: 1; }
    .fire-desc { font-size: 1.02rem; line-height: 1.6; color: var(--text-muted); margin-bottom: 0; }
    .fires-outro { margin-top: 48px; }
    .fires-outro p {
      font-family: var(--font-display); font-style: italic;
      font-size: clamp(1.15rem, 1.9vw, 1.5rem); line-height: 1.4;
      color: var(--purple-bright); max-width: 30ch;
    }

    /* ============================ CLOSE ============================ */
    .post-close { padding: 84px 0 72px; position: relative; z-index: 2; }
    .post-close h2 {
      font-family: var(--font-display); font-weight: 500;
      font-size: clamp(1.6rem, 3vw, 2.4rem); line-height: 1.12;
      letter-spacing: -0.02em; margin-bottom: 32px;
    }
    .post-close .body-copy p:first-of-type {
      font-family: var(--font-display);
      font-size: clamp(1.2rem, 2vw, 1.6rem); line-height: 1.45;
      color: var(--text); letter-spacing: -0.01em; margin-bottom: 24px;
    }

    /* ============================ RELATED ============================ */
    .related { padding: 72px 0 80px; border-top: 1px solid var(--border); position: relative; z-index: 2; }
    .related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 36px; }
    @media (max-width: 900px) { .related-grid { grid-template-columns: 1fr; } }
    .post-card {
      background: rgba(255, 255, 255, 0.04);
      border: 0.5px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px; padding: 1.75rem;
      text-decoration: none; color: inherit;
      display: flex; flex-direction: column; min-height: 190px;
      transition: border-color 0.25s ease, transform 0.25s ease;
    }
    .post-card:hover { border-color: rgba(168, 85, 247, 0.4); transform: translateY(-3px); }
    .post-cat {
      font-family: var(--font-mono); font-size: 10px;
      text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;
      color: var(--purple-bright); background: var(--purple-soft-fill);
      padding: 5px 11px; border-radius: 999px; align-self: flex-start;
    }
    .post-title { font-family: var(--font-display); font-weight: 500; font-size: 19px; color: var(--text); line-height: 1.3; margin-top: 12px; }
    .post-meta {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: auto; padding-top: 20px;
      font-family: var(--font-mono); font-size: 11px; color: rgba(255, 255, 255, 0.4);
    }
    .post-card:hover .post-readmore { color: var(--purple-bright); }

    /* ============================ REVEAL ============================ */
    .reveal { opacity: 0; transform: translateY(18px); transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1); }
    .reveal.in { opacity: 1; transform: none; }
    @media (prefers-reduced-motion: reduce) {
      .reveal { opacity: 1; transform: none; transition: none; }
      .post-hero h1, .cs-back, .cs-eyebrow, .cs-lede, .cs-meta { animation: none; opacity: 1; }
      .progress { transition: none; }
    }

    @media (max-width: 720px) {
      .post-hero h1 { max-width: 100%; }
      .post-section { padding: 56px 0; }
      .post-fires, .post-close { padding: 60px 0; }
      .post-lede-para::first-letter { font-size: 3.6rem; padding-right: 10px; }
    }`;

// ---------------------------------------------------------------- render

function renderSection(sec, cfg, n) {
  const light = sec.title === cfg.lightSection;
  const cls = `post-section${light ? ' section-light' : ''}`;
  const out = [];
  const paras = [];
  let pull = null;

  for (const p of sec.paras) {
    if (p === cfg.pullquote) pull = p;
    else paras.push(p);
  }

  out.push(`    <section class="${cls}">
      <div class="container reveal">
        <div class="post-num">${num(n)}</div>
        <h2>${esc(sec.title)}</h2>
        <div class="body-copy">
${paras.map(paraHtml).join('\n')}
        </div>
      </div>
    </section>`);

  if (pull) {
    out.push(`
    <section class="post-pull${light ? ' section-light' : ''}">
      <div class="container reveal">
        <div class="quote">${esc(pull)}</div>
      </div>
    </section>`);
  }
  return out.join('\n');
}

function renderFires(sec, cfg, n) {
  const f = cfg.fires;
  const intro = f.intro.length
    ? `        <div class="body-copy" style="margin-bottom: 44px;">\n${f.intro.map(paraHtml).join('\n')}\n        </div>`
    : '';
  const outro = f.outro.length
    ? `        <div class="fires-outro">\n${f.outro.map(paraHtml).join('\n')}\n        </div>`
    : '';
  return `    <section class="post-fires">
      <div class="container reveal">
        <div class="post-num">${num(n)}</div>
        <h2 style="font-family: var(--font-display); font-weight: 500; font-size: clamp(1.6rem, 3vw, 2.4rem); line-height: 1.12; letter-spacing: -0.02em; margin-bottom: 32px;">${esc(sec.title)}</h2>
${intro}
        <div class="fires-grid">
          <div class="fire">
            <div class="fire-rule"></div>
            <div class="fire-label">${esc(f.one.label)}</div>
            <div class="fire-name">${esc(f.one.name)}</div>
            <p class="fire-desc">${esc(f.one.desc)}</p>
          </div>
          <div class="fire">
            <div class="fire-rule"></div>
            <div class="fire-label">${esc(f.two.label)}</div>
            <div class="fire-name">${esc(f.two.name)}</div>
            <p class="fire-desc">${esc(f.two.desc)}</p>
          </div>
        </div>
${outro}
      </div>
    </section>`;
}

function renderClose(sec, n) {
  // The sign-off email becomes the CTA button, not a stray line of body copy.
  const paras = sec.paras.filter(p => !p.includes(CONTACT));
  return `    <section class="post-close">
      <div class="container reveal">
        <div class="post-num">${num(n)}</div>
        <h2>${esc(sec.title)}</h2>
        <div class="body-copy">
${paras.map(paraHtml).join('\n')}
        </div>
      </div>
    </section>`;
}

function relatedCards(all, current) {
  const others = all.filter(p => p.fm.slug !== current.fm.slug)
    .sort((a, b) => b.fm.date.localeCompare(a.fm.date))
    .slice(0, 3);
  return others.map(p => `        <a class="post-card" href="/blog/${p.fm.slug}.html">
          <span class="post-cat">${esc(p.cfg.category.label)}</span>
          <div class="post-title">${esc(p.fm.title)}</div>
          <div class="post-meta">
            <span>${shortDate(p.fm.date)}</span>
            <span class="post-readmore">Read →</span>
          </div>
        </a>`).join('\n\n');
}

function page(post, all) {
  const { fm, cfg, doc, mins } = post;
  const titleClean = fm.title.replace(/\.$/, '');

  let n = 0;
  const bodyParts = doc.sections.map(sec => {
    n += 1;
    if (cfg.fires && sec.title === cfg.fires.section) return renderFires(sec, cfg, n);
    if (sec.title === cfg.close) return renderClose(sec, n);
    return renderSection(sec, cfg, n);
  });

  // The intro run: first paragraph gets the drop cap, a pullquote may be lifted out.
  const introParas = doc.intro.filter(p => p !== cfg.pullquote);
  const introPull = doc.intro.find(p => p === cfg.pullquote);
  const introHtml = introParas.map((p, i) =>
    i === 0 ? `            <p class="post-lede-para">${esc(p)}</p>` : paraHtml(p)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png">
  <meta name="description" content="${esc(fm.meta_description)}">
  <meta property="og:title" content="Two Fires · ${esc(titleClean)}">
  <meta property="og:description" content="${esc(fm.meta_description)}">
  <meta property="og:type" content="article">
  <meta property="article:published_time" content="${fm.date}">
  <meta property="article:section" content="${esc(cfg.category.label)}">
  <title>Two Fires · ${esc(titleClean)}</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300;1,9..40,400;1,9..40,500&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">

  <style>${BASE_CSS}${POST_CSS}
  </style>
</head>
<body>

  <div class="progress" id="progress"></div>

  <!-- Header -->
  <header class="header">
    <div class="header-inner">
      <a class="brand nav-logo" href="/index.html">
        <img src="/images/two-fires-logo-transparent.png" alt="Two Fires" style="height: 60px; width: auto; display: block;">
      </a>
      <nav class="nav">
        <a href="/index.html#what">What we do</a>
        <a href="/index.html#principals">Who we are</a>
        <a href="/blog.html" class="active">Blog</a>
        <a href="/podcast.html">Podcast</a>
        <a class="nav-cta" href="/index.html#contact">Light the fuse</a>
      </nav>
    </div>
  </header>

  <main>
    <article>

    <!-- HERO -->
    <section class="post-hero">
      <div class="container">
        <a class="cs-back" href="/blog.html">← Blog</a>
        <div class="cs-eyebrow">${esc(cfg.category.label)}</div>
        <h1>${heroTitle(fm.title, cfg.heroEm)}</h1>
        <p class="cs-lede">${esc(fm.meta_description)}</p>
        <div class="cs-meta">
          <div class="cs-meta-item">
            <div class="cs-meta-label">Published</div>
            <div class="cs-meta-value"><time datetime="${fm.date}">${longDate(fm.date)}</time></div>
          </div>
          <div class="cs-meta-item">
            <div class="cs-meta-label">Category</div>
            <div class="cs-meta-value">${esc(cfg.category.label)}</div>
          </div>
          <div class="cs-meta-item">
            <div class="cs-meta-label">Read</div>
            <div class="cs-meta-value">${mins} min</div>
          </div>
          <div class="cs-meta-item">
            <div class="cs-meta-label">Written by</div>
            <div class="cs-meta-value">Two Fires</div>
          </div>
        </div>
      </div>
    </section>

    <!-- INTRO -->
    <section class="post-section intro">
      <div class="container">
        <div class="body-copy">
${introHtml}
        </div>
      </div>
    </section>
${introPull ? `
    <section class="post-pull">
      <div class="container reveal">
        <div class="quote">${esc(introPull)}</div>
      </div>
    </section>
` : ''}
${bodyParts.join('\n\n')}

    </article>

    <!-- CTA -->
    <section class="cs-cta">
      <div class="container">
        <div class="section-label" style="justify-content: center;">Work with us</div>
        <h2>Got a growth problem<br><em>that needs both fires?</em></h2>
        <p>Every engagement starts with one conversation. Forty-five minutes of your time, a full day of ours in preparation.</p>
        <div class="cta-row">
          <a class="pill pill-primary" href="/index.html#contact"><span>Book the conversation →</span></a>
          <a class="pill" href="mailto:${CONTACT}"><span>${CONTACT}</span></a>
        </div>
      </div>
    </section>

    <!-- RELATED -->
    <section class="related">
      <div class="container">
        <div class="section-label">Keep reading</div>
        <div class="related-grid">
${relatedCards(all, post)}
        </div>
      </div>
    </section>

  </main>

  <!-- Footer -->
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <span class="footer-text">Two Fires · Sydney · 2026</span>
      </div>
      <div class="footer-links">
        <a href="/index.html">Home</a>
        <a href="/blog.html">Blog</a>
        <a href="/podcast.html">Podcast</a>
        <a href="/index.html#contact">Contact</a>
        <a href="/portal.html">Client Portal</a>
      </div>
    </div>
  </footer>

  <script>
    // Reading progress
    const bar = document.getElementById('progress');
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Reveal on scroll
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = document.querySelectorAll('.reveal');
    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('in'));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -12% 0px' });
      targets.forEach(el => io.observe(el));
    }
  </script>

</body>
</html>
`;
}

// ---------------------------------------------------------------- main

const posts = readdirSync(SRC).filter(f => f.endsWith('.md')).sort().map(f => {
  const raw = readFileSync(path.join(SRC, f), 'utf8');
  const { fm, body } = parseFrontmatter(raw);
  const cfg = POSTS[fm.slug];
  if (!cfg) throw new Error(`no editorial config for slug: ${fm.slug}`);
  return { file: f, fm, cfg, doc: parseBody(body), mins: readTime(body), body };
});

// Guard: report any source sentence the editorial layer dropped on the floor.
let dropped = 0;
for (const p of posts) {
  const rendered = page(p, posts);
  const strip = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const haystack = strip(rendered.replace(/<[^>]+>/g, ' '));
  const sourceParas = [...p.doc.intro, ...p.doc.sections.flatMap(s => s.paras)];
  for (const para of sourceParas) {
    if (para.includes(CONTACT)) continue; // deliberately promoted to the CTA button
    const words = strip(para).split(' ').filter(w => w.length > 3);
    const missing = words.filter(w => !haystack.includes(w));
    if (missing.length > words.length * 0.5) {
      dropped++;
      console.log(`DROPPED  ${p.fm.slug}\n  "${para.slice(0, 90)}..."\n  missing: ${missing.slice(0, 8).join(', ')}`);
    }
  }
}
console.log(dropped ? `\n${dropped} source paragraph(s) not represented in output` : 'coverage: every source paragraph is represented in the output');

if (CHECK) process.exit(dropped ? 1 : 0);

mkdirSync(OUT, { recursive: true });
for (const p of posts) {
  writeFileSync(path.join(OUT, `${p.fm.slug}.html`), page(p, posts));
  console.log(`wrote blog/${p.fm.slug}.html  [${p.cfg.category.label}, ${p.mins} min]`);
}

// Rewrite the card grid in blog.html, preserving the case study card.
const cards = posts.slice().sort((a, b) => b.fm.date.localeCompare(a.fm.date)).map(p =>
`        <a class="post-card" href="/blog/${p.fm.slug}.html" data-category="${p.cfg.category.slug}">
          <span class="post-cat">${esc(p.cfg.category.label)}</span>
          <div class="post-title">${esc(p.fm.title)}</div>
          <p class="post-excerpt">${esc(p.fm.meta_description)}</p>
          <div class="post-meta">
            <span class="post-date">${shortDate(p.fm.date)}</span>
            <span class="post-readmore">Read more →</span>
          </div>
        </a>`).join('\n\n');

const blogPath = path.join(SITE, 'blog.html');
let blog = readFileSync(blogPath, 'utf8');
const start = blog.indexOf('        <a class="post-card" href="/blog/');
const end = blog.indexOf('        <a class="post-card" href="/case-study-wellness.html"');
if (start === -1 || end === -1 || end < start) throw new Error('blog.html card anchors not found');
blog = blog.slice(0, start) + cards + '\n\n' + blog.slice(end);
writeFileSync(blogPath, blog);
console.log('rewrote blog.html card grid');

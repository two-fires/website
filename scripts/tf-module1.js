/* Two Fires Module 1: Marketing Diagnosis. One source of truth for the four
 * stages, the "where am I" rail every stage shows, and the end state block every
 * stage finishes with (download plus a clear next step, never a dead end).
 *
 * Depends on tf-work.js for the completed run lookup and tf-brief.js for the
 * shared brief. Both are optional at runtime: the rail and the end state still
 * render without them, just without tick marks.
 *
 * Additive. No em dashes anywhere. */
(function () {
  var STAGES = [
    {
      key: 'insight', n: 1, tool: 'insight',
      label: 'Customer Insight', href: '/insight/',
      short: 'Customer Insight',
      examines: 'Who your customer actually is: the pains they describe, the language they use, the objections they raise, and what makes them buy.',
      provides: 'A customer evidence report drawn from public sources.',
    },
    {
      key: 'audit', n: 2, tool: 'audit',
      label: 'Communications Audit', href: '/audit/',
      short: 'Comms Audit',
      examines: 'Your live message measured against the customer reality stage 1 found. Where what you say and what they care about do not meet.',
      provides: 'An executive summary, a message to market fit read, and priority fixes.',
    },
    {
      key: 'competitor', n: 3, tool: 'competitor',
      label: 'Competitor and Category Review', href: '/competitor/',
      short: 'Competitor and Category',
      examines: 'How your competitors and your category actually talk, where everybody sounds the same, and the whitespace nobody has taken.',
      provides: 'A competitor messaging matrix, the category norms, and your whitespace.',
    },
    {
      key: 'diagnosis', n: 4, tool: 'diagnosis',
      label: 'Marketing Diagnosis Report', href: '/diagnosis/',
      short: 'Diagnosis Report',
      examines: 'Everything above, pulled together. Your positioning, messaging, channels and offer, scored and ranked.',
      provides: 'A marketing scorecard and a prioritised action plan.',
    },
  ];

  function byKey(key) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].key === key) return STAGES[i];
    return null;
  }
  function nextOf(key) {
    var s = byKey(key);
    if (!s) return null;
    return STAGES[s.n] || null; // s.n is 1 based, so STAGES[s.n] is the one after
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Which stages this client has already completed. Reuses the existing
  // /client/:email/versions endpoint through TFWork. Never throws: on any
  // failure every stage simply shows as not done.
  async function fetchDone(email) {
    var done = {};
    if (!email || !window.TFWork) return done;
    try {
      var data = await TFWork.fetchVersions(email);
      var v = (data && data.versions) || {};
      STAGES.forEach(function (s) {
        done[s.key] = !!(v[s.tool] && v[s.tool].length);
      });
    } catch (e) { /* ignore */ }
    return done;
  }

  // The "where am I, what is next" rail. currentKey highlights a stage;
  // doneMap (optional) ticks the finished ones.
  function renderStepper(el, currentKey, doneMap) {
    if (!el) return;
    doneMap = doneMap || {};
    var cur = byKey(currentKey);
    var nxt = nextOf(currentKey);
    var items = STAGES.map(function (s) {
      var cls = 'tf-m1-step';
      if (s.key === currentKey) cls += ' current';
      if (doneMap[s.key]) cls += ' done';
      var mark = doneMap[s.key] && s.key !== currentKey ? '&#10003;' : String(s.n);
      return '<a class="' + cls + '" href="' + s.href + '">' +
        '<span class="tf-m1-step-n">' + mark + '</span>' +
        '<span class="tf-m1-step-l">' + esc(s.short) + '</span>' +
        '</a>';
    }).join('<span class="tf-m1-step-sep"></span>');

    el.innerHTML =
      '<div class="tf-m1-rail-head">' +
        '<span class="tf-m1-rail-mod"><a href="/module1.html">Module 1 &middot; Marketing Diagnosis</a></span>' +
        (cur ? '<span class="tf-m1-rail-pos">Stage ' + cur.n + ' of ' + STAGES.length + '</span>' : '') +
      '</div>' +
      '<div class="tf-m1-rail">' + items + '</div>' +
      (cur ? '<p class="tf-m1-rail-now"><strong>Now:</strong> ' + esc(cur.examines) +
        (nxt ? ' <span class="tf-m1-rail-next"><strong>Next:</strong> ' + esc(nxt.label) + '.</span>' : ' <span class="tf-m1-rail-next">This is the final stage.</span>') +
        '</p>' : '');
  }

  // The end state every completed stage finishes with. The download is
  // prominent and obvious, the sequential next step is the visually dominant
  // action, and there is always a way back to the portal. Never a dead end.
  //
  // opts: { onDownload: fn, downloadLabel: string, onNewBrandTest: fn }
  function renderEndState(el, currentKey, opts) {
    if (!el) return;
    opts = opts || {};
    var cur = byKey(currentKey);
    var nxt = nextOf(currentKey);
    var dlLabel = opts.downloadLabel || 'Download PDF report';

    var dlIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

    var headline = nxt
      ? 'Stage ' + (cur ? cur.n : '') + ' done. Take it into ' + nxt.label + '.'
      : 'Module 1 complete. You have the full diagnosis.';
    var sub = nxt
      ? nxt.label + ' ' + nxt.examines.charAt(0).toLowerCase() + nxt.examines.slice(1) + ' It uses the brief you have already given us, so there is nothing to retype.'
      : 'Every stage is done and every report is downloadable above. Start a new brand test whenever you want to run the module again on another brand.';

    var nextBtn = nxt
      ? '<a class="tf-m1-btn tf-m1-primary" href="' + nxt.href + '">Next: ' + esc(nxt.label) + ' &rarr;</a>'
      : '<a class="tf-m1-btn tf-m1-primary" href="/dashboard/">Open your Diagnosis Hub &rarr;</a>';

    el.innerHTML =
      '<div class="tf-m1-end">' +
        '<div class="tf-m1-end-eyebrow">' + (nxt ? 'Stage ' + (cur ? cur.n : '') + ' of ' + STAGES.length + ' complete' : 'Module 1 complete') + '</div>' +
        '<h3 class="tf-m1-end-h">' + esc(headline) + '</h3>' +
        '<p class="tf-m1-end-p">' + esc(sub) + '</p>' +
        '<div class="tf-m1-end-actions">' +
          '<button type="button" class="tf-m1-btn tf-m1-download" id="tf-m1-dl">' + dlIcon + '<span>' + esc(dlLabel) + '</span></button>' +
          nextBtn +
        '</div>' +
        '<div class="tf-m1-end-minor">' +
          '<a href="/portal.html">Back to portal</a>' +
          '<a href="/module1.html">Module 1 overview</a>' +
          '<a href="mailto:lightmyfuse@two-fires.com?subject=' + encodeURIComponent((cur ? cur.label : 'Module 1') + ' follow up') + '">Talk to a strategist</a>' +
          (opts.onNewBrandTest ? '<a href="#" id="tf-m1-new">Start a new brand test</a>' : '') +
        '</div>' +
      '</div>';

    var dl = el.querySelector('#tf-m1-dl');
    if (dl) {
      dl.addEventListener('click', function () {
        if (typeof opts.onDownload === 'function') opts.onDownload();
      });
    }
    var nb = el.querySelector('#tf-m1-new');
    if (nb) {
      nb.addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof opts.onNewBrandTest === 'function') opts.onNewBrandTest();
      });
    }
  }

  // A short line naming what a stage read, so the client can see the work is
  // cumulative rather than four isolated tools. items: array of strings.
  function renderSources(el, items, opts) {
    if (!el) return;
    opts = opts || {};
    items = (items || []).filter(Boolean);
    if (!items.length) { el.innerHTML = ''; return; }
    el.innerHTML =
      '<div class="tf-m1-src">' +
        '<div class="tf-m1-src-head">' + esc(opts.title || 'Sources analysed') + '</div>' +
        '<ul class="tf-m1-src-list">' +
          items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') +
        '</ul>' +
      '</div>';
  }

  // One stylesheet for the rail, the end state and the sources panel, injected
  // once, so every stage page matches without editing four separate CSS blocks.
  (function injectStyle() {
    if (document.getElementById('tf-m1-style')) return;
    var s = document.createElement('style');
    s.id = 'tf-m1-style';
    s.textContent =
      '.tf-m1-rail-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}' +
      '.tf-m1-rail-mod a{font-family:"Geist Mono",monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#C4A8FF;text-decoration:none}' +
      '.tf-m1-rail-mod a:hover{text-decoration:underline}' +
      '.tf-m1-rail-pos{font-family:"Geist Mono",monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4)}' +
      '.tf-m1-rail{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:12px 14px;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.03)}' +
      '.tf-m1-step{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:999px;text-decoration:none;border:1px solid transparent;transition:all .2s ease}' +
      '.tf-m1-step:hover{border-color:rgba(168,85,247,0.35);background:rgba(168,85,247,0.08)}' +
      '.tf-m1-step-n{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-family:"Geist Mono",monospace;font-size:11px;background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.14);flex:none}' +
      '.tf-m1-step-l{font-size:0.82rem;color:rgba(255,255,255,0.5);white-space:nowrap}' +
      '.tf-m1-step.done .tf-m1-step-n{background:rgba(52,211,153,0.16);color:#34d399;border-color:rgba(52,211,153,0.4)}' +
      '.tf-m1-step.done .tf-m1-step-l{color:rgba(255,255,255,0.75)}' +
      '.tf-m1-step.current{background:rgba(168,85,247,0.14);border-color:rgba(168,85,247,0.45)}' +
      '.tf-m1-step.current .tf-m1-step-n{background:#A855F7;color:#fff;border-color:#A855F7}' +
      '.tf-m1-step.current .tf-m1-step-l{color:#FBFAFE;font-weight:600}' +
      '.tf-m1-step-sep{flex:1 1 8px;min-width:8px;height:1px;background:rgba(255,255,255,0.12)}' +
      '.tf-m1-rail-now{font-size:0.86rem;line-height:1.6;color:rgba(255,255,255,0.55);margin:10px 2px 0;max-width:78ch}' +
      '.tf-m1-rail-now strong{color:#C4A8FF;font-weight:500}' +
      '.tf-m1-rail-next{display:inline}' +
      '@media (max-width:640px){.tf-m1-step-l{display:none}.tf-m1-step{padding:6px}}' +

      '.tf-m1-end{margin-top:28px;padding:30px 28px;border:1px solid rgba(168,85,247,0.3);border-radius:18px;background:linear-gradient(180deg,rgba(168,85,247,0.12),rgba(255,255,255,0.03))}' +
      '.tf-m1-end-eyebrow{font-family:"Geist Mono",monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#C4A8FF;margin-bottom:10px}' +
      '.tf-m1-end-h{font-size:1.5rem;line-height:1.25;font-weight:400;font-style:italic;color:#FBFAFE;margin:0 0 10px}' +
      '.tf-m1-end-p{font-size:0.95rem;line-height:1.65;color:rgba(255,255,255,0.6);margin:0 0 22px;max-width:64ch}' +
      '.tf-m1-end-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:stretch}' +
      '.tf-m1-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;height:52px;padding:0 26px;border-radius:11px;font-family:"DM Sans",sans-serif;font-size:0.95rem;font-weight:600;text-decoration:none;cursor:pointer;border:1px solid transparent;transition:all .2s ease;white-space:nowrap}' +
      '.tf-m1-primary{background:#A855F7;color:#fff;box-shadow:0 6px 22px rgba(168,85,247,0.32);flex:1 1 300px}' +
      '.tf-m1-primary:hover{background:#9333ea;transform:translateY(-1px)}' +
      '.tf-m1-download{background:rgba(255,255,255,0.06);color:#FBFAFE;border-color:rgba(168,85,247,0.5);flex:0 1 auto}' +
      '.tf-m1-download:hover{background:rgba(168,85,247,0.16);border-color:#A855F7}' +
      '.tf-m1-download svg{flex:none}' +
      '.tf-m1-end-minor{display:flex;gap:20px;flex-wrap:wrap;margin-top:20px}' +
      '.tf-m1-end-minor a{font-family:"Geist Mono",monospace;font-size:11px;letter-spacing:0.06em;color:rgba(255,255,255,0.45);text-decoration:none;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:2px;cursor:pointer}' +
      '.tf-m1-end-minor a:hover{color:#C4A8FF;border-color:rgba(168,85,247,0.5)}' +
      '@media (max-width:560px){.tf-m1-btn{width:100%;flex:1 1 100%}}' +

      '.tf-m1-src{margin:0 0 20px;padding:14px 16px;border:1px solid rgba(255,255,255,0.09);border-radius:12px;background:rgba(255,255,255,0.03)}' +
      '.tf-m1-src-head{font-family:"Geist Mono",monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#C4A8FF;margin-bottom:8px}' +
      '.tf-m1-src-list{list-style:none;margin:0;padding:0}' +
      '.tf-m1-src-list li{font-size:0.86rem;line-height:1.7;color:rgba(255,255,255,0.6);padding-left:16px;position:relative}' +
      '.tf-m1-src-list li::before{content:"\\2713";position:absolute;left:0;color:#34d399;font-size:0.8rem}';
    document.head.appendChild(s);
  })();

  window.TFModule1 = {
    STAGES: STAGES,
    byKey: byKey,
    nextOf: nextOf,
    fetchDone: fetchDone,
    renderStepper: renderStepper,
    renderEndState: renderEndState,
    renderSources: renderSources,
  };
})();

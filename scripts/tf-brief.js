/* Two Fires shared Module 1 brief. The four Marketing Diagnosis stages used to
 * collect the same core inputs four times over. This is the single place they
 * are collected: product or service, website, market category, region, plus the
 * rest of the foundational fields the agents ask for.
 *
 * Canonical store: localStorage 'tf_brief_v1' (JSON). localStorage, not
 * sessionStorage, because each stage is a separate page load and a client may
 * open a stage in a new tab. That matches tf-identity.js, the existing durable
 * pattern in this codebase.
 *
 * "Start a new brand test" archives the current brief into 'tf_brief_archive'
 * (append only) and clears the active one. Nothing is ever deleted.
 *
 * Additive. No em dashes anywhere. */
(function () {
  var KEY = 'tf_brief_v1';
  var ARCHIVE_KEY = 'tf_brief_archive';
  var FRESH_KEY = 'tf_brief_fresh';
  var TOOLS = ['insight', 'audit', 'competitor', 'diagnosis'];

  // Every field any Module 1 stage asks for. One shape, one source of truth.
  var FIELDS = [
    'brand_label',            // what the client calls this brand test
    'product_service',        // Insight, Competitor
    'market_category',        // Insight, Competitor
    'region',                 // Insight, Competitor, Diagnosis
    'website_url',            // Insight, Audit, Competitor
    'customer_description',   // Insight
    'competitors',            // Insight, Competitor
    'substitutes',            // Competitor
    'category_language',      // Competitor
    'offer_description',      // Insight, Competitor
    'testimonials',           // Insight
    'extra_assets',           // Audit
    'primary_goal',           // Diagnosis
    'current_channels',       // Diagnosis
  ];

  function readLS(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function writeLS(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function delLS(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  // The active brief, with every field present as a string so callers never
  // have to guard for undefined.
  function get() {
    var raw = null;
    try { raw = JSON.parse(readLS(KEY) || 'null'); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') raw = {};
    var out = { v: 1, updated_at: raw.updated_at || '' };
    FIELDS.forEach(function (f) { out[f] = typeof raw[f] === 'string' ? raw[f] : ''; });
    return out;
  }

  // Merge in whatever the caller has. Blank values never overwrite a stored
  // value, so a stage that does not ask for a field cannot wipe it.
  function patch(obj) {
    obj = obj || {};
    var cur = get();
    FIELDS.forEach(function (f) {
      if (typeof obj[f] === 'string' && obj[f].trim() !== '') cur[f] = obj[f].trim();
    });
    cur.updated_at = new Date().toISOString();
    writeLS(KEY, JSON.stringify(cur));
    return cur;
  }

  // Enough of a brief to run the first stage.
  function has() {
    var b = get();
    return !!(b.product_service && b.market_category && b.region);
  }

  // Which required core fields are still blank, for the onboarding page.
  function missingCore() {
    var b = get();
    var core = [
      ['product_service', 'Product or service'],
      ['market_category', 'Market or category'],
      ['region', 'Region'],
      ['website_url', 'Website'],
    ];
    return core.filter(function (c) { return !b[c[0]]; }).map(function (c) { return c[1]; });
  }

  // A readable name for the brand test in progress.
  function label() {
    var b = get();
    return b.brand_label || b.product_service || 'Untitled brand test';
  }

  // ---- form wiring. map is { domElementId: briefFieldName } ----

  // Fill a page's inputs from the brief. Only fills blanks, so anything the
  // client has already typed on this page wins. Fields stay editable.
  function fillForm(map) {
    var b = get();
    Object.keys(map || {}).forEach(function (domId) {
      var el = document.getElementById(domId);
      if (!el) return;
      var val = b[map[domId]];
      if (val && !String(el.value || '').trim()) el.value = val;
    });
    return b;
  }

  // Read a page's inputs back into the brief so the next stage inherits any
  // edits the client made here.
  function captureForm(map) {
    var obj = {};
    Object.keys(map || {}).forEach(function (domId) {
      var el = document.getElementById(domId);
      if (el) obj[map[domId]] = String(el.value || '');
    });
    return patch(obj);
  }

  // ---- brand tests ----

  // Every archived brief, oldest first. Read only.
  function archived() {
    try {
      var a = JSON.parse(readLS(ARCHIVE_KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }

  // ---- fresh brand test markers ----
  // A completed run stays in Supabase against the lead forever, and every stage
  // rehydrates the newest one on load. That is right for a returning client and
  // wrong immediately after starting a new brand test: the client would be shown
  // the previous brand's report. These per tool markers say "this stage has not
  // been run for the current brand test yet", so the stage opens its intake
  // instead of a stale report. A stage clears its own marker once it completes a
  // run. Nothing is deleted: the old reports stay available under Previous
  // versions and in the Diagnosis Hub.
  function readFresh() {
    try {
      var o = JSON.parse(readLS(FRESH_KEY) || '{}');
      return (o && typeof o === 'object') ? o : {};
    } catch (e) { return {}; }
  }
  function isFresh(tool) { return !!readFresh()[tool]; }
  function clearFresh(tool) {
    var o = readFresh();
    if (!o[tool]) return;
    delete o[tool];
    if (Object.keys(o).length) writeLS(FRESH_KEY, JSON.stringify(o));
    else delLS(FRESH_KEY);
  }

  // Start a fresh brand test. Archives the current brief (never deletes it),
  // clears the active one, and clears the per tool rehydration keys so the
  // previous brand's stored report is not dragged into the new test. The
  // client's identity and their reports in Supabase are untouched.
  function startNew() {
    var cur = get();
    if (cur.product_service || cur.brand_label) {
      var list = archived();
      cur.archived_at = new Date().toISOString();
      list.push(cur);
      writeLS(ARCHIVE_KEY, JSON.stringify(list));
    }
    delLS(KEY);
    ['tf_insight', 'tf_competitor'].forEach(function (k) {
      try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ }
    });
    // Every stage is now unrun for this brand test.
    var fresh = {};
    TOOLS.forEach(function (t) { fresh[t] = 1; });
    writeLS(FRESH_KEY, JSON.stringify(fresh));
    return get();
  }

  window.TFBrief = {
    FIELDS: FIELDS,
    get: get,
    patch: patch,
    has: has,
    missingCore: missingCore,
    label: label,
    fillForm: fillForm,
    captureForm: captureForm,
    archived: archived,
    startNew: startNew,
    isFresh: isFresh,
    clearFresh: clearFresh,
  };
})();

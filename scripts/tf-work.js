/* Two Fires shared "versioned work" helpers. Additive, read-only. Talks to the
 * tf-insight-api endpoints /tool/:tool/last and /client/:email/versions, plus the
 * existing /download-* routes. Gives every tool the same returning-user
 * behaviour: reload the latest completed run, list previous versions, and offer
 * a working branded PDF for each. No em dashes anywhere. */
(function () {
  var API = 'https://insight.two-fires.com';

  // Latest completed run for a tool: { result, sessionId, leadId } or null.
  async function fetchLast(tool, email) {
    if (!tool || !email) return null;
    try {
      var res = await fetch(API + '/tool/' + encodeURIComponent(tool) + '/last', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email }),
      });
      if (!res.ok) return null;
      var data = await res.json();
      if (data && data.result) return { result: data.result, sessionId: data.sessionId, leadId: data.leadId };
      return null;
    } catch (e) { return null; }
  }

  // All completed versions across tools: { present, versions } or null.
  async function fetchVersions(email) {
    if (!email) return null;
    try {
      var res = await fetch(API + '/client/' + encodeURIComponent(email) + '/versions', { credentials: 'include' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  function downloadUrl(pathOrDownload) { return API + pathOrDownload; }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch (e) { return String(iso || ''); }
  }

  // Render a dated version list with PDF buttons into el.
  // items: [{ sessionId, created_at, download }]. opts.currentSessionId marks the
  // one on screen. opts.emptyText for none.
  function renderVersions(el, items, opts) {
    opts = opts || {};
    items = items || [];
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<p class="tf-ver-empty">' + (opts.emptyText || 'No previous versions yet.') + '</p>';
      return;
    }
    el.innerHTML = items.map(function (v, i) {
      var isCur = opts.currentSessionId && v.sessionId === opts.currentSessionId;
      var tag = (i === 0 ? ' (latest)' : '') + (isCur ? ' - showing now' : '');
      return '<div class="tf-ver-row">' +
        '<span class="tf-ver-date">' + fmtDate(v.created_at) + tag + '</span>' +
        '<a class="tf-ver-dl" href="' + downloadUrl(v.download) + '" target="_blank" rel="noopener">Download PDF</a>' +
        '</div>';
    }).join('');
  }

  // Consistent dark styling for the version lists and helper links, injected once
  // so every page matches without touching each page's own CSS.
  (function injectStyle() {
    if (document.getElementById('tf-work-style')) return;
    var s = document.createElement('style');
    s.id = 'tf-work-style';
    s.textContent =
      '.tf-ver-wrap{margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08)}' +
      '.tf-ver-head{font-family:"Geist Mono",monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#C4A8FF;margin-bottom:14px}' +
      '.tf-ver-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 14px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;background:rgba(255,255,255,0.03);margin-bottom:8px}' +
      '.tf-ver-date{font-size:0.9rem;color:#A0A0A0}' +
      '.tf-ver-dl{font-family:"Geist Mono",monospace;font-size:11px;letter-spacing:0.04em;color:#C4A8FF;text-decoration:none;border:1px solid rgba(168,85,247,0.4);border-radius:999px;padding:6px 14px;white-space:nowrap;transition:all .2s ease}' +
      '.tf-ver-dl:hover{background:rgba(168,85,247,0.12);color:#FBFAFE}' +
      '.tf-ver-empty{font-size:0.9rem;color:#666;font-style:italic}' +
      '.tf-identity-note{font-family:"Geist Mono",monospace;font-size:11px;letter-spacing:0.04em;color:#A0A0A0;margin-top:10px}' +
      '.tf-identity-note a{color:#C4A8FF;cursor:pointer;text-decoration:underline}';
    document.head.appendChild(s);
  })();

  window.TFWork = {
    API: API,
    fetchLast: fetchLast,
    fetchVersions: fetchVersions,
    downloadUrl: downloadUrl,
    fmtDate: fmtDate,
    renderVersions: renderVersions,
  };
})();

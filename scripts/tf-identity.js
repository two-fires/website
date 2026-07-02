/* Two Fires shared identity. One identity (name, email, company) across every
 * portal tool and the hub. Canonical store: localStorage 'tf_identity' (JSON).
 * Backward compatible: migrates from and mirrors to the legacy keys the tools
 * used before (tf_dash_email, tf_insight_email, tf_competitor_email, tf_cs_name,
 * tf_cs_company) so anything that still reads those keeps working. Additive only.
 * No em dashes anywhere. */
(function () {
  var KEY = 'tf_identity';
  function readLS(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function writeLS(k, v) { try { if (v) localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function delLS(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  function get() {
    var id = null;
    try { id = JSON.parse(readLS(KEY) || 'null'); } catch (e) { id = null; }
    if (!id || typeof id !== 'object') id = {};
    // Migrate from legacy keys when the canonical record is missing a field.
    if (!id.email) id.email = readLS('tf_dash_email') || readLS('tf_insight_email') || readLS('tf_competitor_email') || '';
    if (!id.name) id.name = readLS('tf_cs_name') || '';
    if (!id.company) id.company = readLS('tf_cs_company') || '';
    return {
      name: id.name || '',
      email: (id.email || '').trim().toLowerCase(),
      company: id.company || '',
    };
  }

  function set(obj) {
    obj = obj || {};
    var cur = get();
    var id = {
      name: (obj.name != null ? obj.name : cur.name) || '',
      email: ((obj.email != null ? obj.email : cur.email) || '').trim().toLowerCase(),
      company: (obj.company != null ? obj.company : cur.company) || '',
    };
    writeLS(KEY, JSON.stringify(id));
    // Mirror to the legacy keys so existing tool code paths keep working.
    if (id.email) {
      writeLS('tf_dash_email', id.email);
      writeLS('tf_insight_email', id.email);
      writeLS('tf_competitor_email', id.email);
    }
    if (id.name) writeLS('tf_cs_name', id.name);
    if (id.company) writeLS('tf_cs_company', id.company);
    return id;
  }

  function clear() {
    delLS(KEY);
    ['tf_dash_email', 'tf_insight_email', 'tf_competitor_email', 'tf_cs_name', 'tf_cs_company'].forEach(delLS);
    try { sessionStorage.removeItem('tf_insight'); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem('tf_competitor'); } catch (e) { /* ignore */ }
  }

  function has() { return !!get().email; }

  window.TFIdentity = { get: get, set: set, clear: clear, has: has };
})();

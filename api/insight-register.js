// POST /api/insight-register
// Registers a lead for the Customer Insight tool and reports how many of the
// 3 free analyses remain. Body: { name, email, company }
// Response: { leadId, runsRemaining, isNew }

import { createClient } from '@supabase/supabase-js';

const FREE_RUNS = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Something went wrong on our end. Please try again shortly.' });
  }

  // Body may arrive parsed (Vercel) or as a raw string. Handle both.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const company = String(body.company || '').trim();

  if (!name || !email || !company) {
    return res.status(400).json({ error: 'Please fill in your name, email, and company.' });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Look for an existing lead by email.
    const { data: existing, error: lookupErr } = await supabase
      .from('tf_leads')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (lookupErr) throw lookupErr;

    if (existing) {
      const leadId = existing.id;

      // Read usage. Create the row if it's somehow missing.
      let { data: usage, error: usageErr } = await supabase
        .from('tf_usage')
        .select('run_count')
        .eq('lead_id', leadId)
        .maybeSingle();
      if (usageErr) throw usageErr;

      if (!usage) {
        const ins = await supabase
          .from('tf_usage')
          .insert({ lead_id: leadId, run_count: 0 })
          .select('run_count')
          .single();
        if (ins.error) throw ins.error;
        usage = ins.data;
      }

      const runsRemaining = Math.max(0, FREE_RUNS - (usage.run_count || 0));
      return res.status(200).json({ leadId, runsRemaining, isNew: false });
    }

    // New lead: insert lead + usage row.
    const { data: lead, error: insertErr } = await supabase
      .from('tf_leads')
      .insert({ name, email, company })
      .select('id')
      .single();
    if (insertErr) throw insertErr;

    const { error: usageInsertErr } = await supabase
      .from('tf_usage')
      .insert({ lead_id: lead.id, run_count: 0 });
    if (usageInsertErr) throw usageInsertErr;

    return res.status(200).json({ leadId: lead.id, runsRemaining: FREE_RUNS, isNew: true });
  } catch (err) {
    console.error('insight-register error:', err);
    return res.status(500).json({ error: 'Something went wrong on our end. Please try again shortly.' });
  }
}

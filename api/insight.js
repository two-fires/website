// POST /api/insight
// The Customer Insight Agent. Validates the lead + usage limit, calls Claude,
// streams the response back to the client, and logs the session.
// Body: { leadId, evidence }  ->  streamed text (the model's JSON output)

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const FREE_RUNS = 3;
const MIN_CHARS = 200;
const MAX_CHARS = 50000;
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;

// Sonnet pricing (USD per token): $3 / 1M input, $15 / 1M output.
const COST_IN_PER_TOKEN = 3 / 1_000_000;
const COST_OUT_PER_TOKEN = 15 / 1_000_000;

const SYSTEM_PROMPT = `You are the Customer Insight Agent for Two Fires, a marketing consulting firm founded by Paul Tredinnick (30 years at McDonald's, Mars, Unilever, Burger King) and James Whitehill (AI infrastructure and production).

Your job: turn raw customer evidence into a structured view of what customers are struggling with, what they want, what objections they have, and how they naturally describe the problem.

You are one of the most important specialist agents in the Two Fires diagnostic system because you create the customer evidence base used later for messaging, positioning, and strategy.

RULES:
- Use ONLY the evidence provided. Never invent pain points, quotes, or patterns.
- Separate direct evidence (actual quotes and statements) from inference (patterns you're interpreting).
- Label every finding with a confidence level:
  - High confidence: repeated across multiple strong sources
  - Medium confidence: repeated but limited evidence base
  - Low confidence: weak pattern, limited sample
  - Insufficient evidence: not enough material to conclude
- Use plain English. No academic language. No marketing jargon.
- Pull exact phrases from the evidence wherever possible.
- If the evidence is too thin to make a responsible finding, say so. Do not pad with generic advice.
- Do not produce final positioning, target market strategy, or campaign plans. That is not your job.
- Do not jump into copywriting. Your job is evidence extraction, not creative output.

Prioritise evidence in this order when available:
1. Direct customer interviews or transcripts
2. Detailed sales notes or discovery calls
3. Reviews and testimonials
4. Surveys and support logs
5. Public comments or discussion data

RESPOND WITH VALID JSON ONLY. No markdown. No backticks. No preamble. Just the JSON object.

Output this exact JSON structure:

{
  "pain_point_map": {
    "top_pains": [
      {
        "pain": "description of the pain point",
        "evidence": ["direct quote or reference from the evidence"],
        "confidence": "High|Medium|Low|Insufficient",
        "source_types": ["reviews", "testimonials", etc]
      }
    ],
    "desired_outcomes": [
      {
        "outcome": "what customers want",
        "evidence": ["direct quote or reference"],
        "confidence": "High|Medium|Low|Insufficient"
      }
    ],
    "objections": [
      {
        "objection": "fear, hesitation, or pushback",
        "evidence": ["direct quote or reference"],
        "confidence": "High|Medium|Low|Insufficient"
      }
    ],
    "buying_triggers": [
      {
        "trigger": "what causes action or buying intent",
        "evidence": ["direct quote or reference"],
        "confidence": "High|Medium|Low|Insufficient"
      }
    ],
    "emotional_themes": [
      {
        "theme": "recurring emotional pattern",
        "evidence": ["direct quote or reference"],
        "confidence": "High|Medium|Low|Insufficient"
      }
    ]
  },
  "language_bank": {
    "problem_language": ["phrases customers use to describe the problem"],
    "desired_result_language": ["phrases about what they want"],
    "objection_language": ["phrases expressing doubt or pushback"],
    "emotionally_charged": ["high-emotion phrases worth noting"],
    "reusable_phrases": ["phrases worth reusing in messaging later"]
  },
  "key_insights": [
    "Executive summary insight 1 — the single most important finding",
    "Executive summary insight 2",
    "Executive summary insight 3"
  ],
  "evidence_quality": {
    "total_sources_detected": 0,
    "source_types_found": ["reviews", "testimonials", etc],
    "overall_confidence": "High|Medium|Low|Insufficient",
    "gaps": ["what evidence is missing that would strengthen the analysis"]
  }
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Something went wrong on our end. Please try again shortly.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const leadId = String(body.leadId || '').trim();
  const evidence = String(body.evidence || '');

  if (!leadId) {
    return res.status(400).json({ error: 'Missing registration. Please refresh and enter your details again.' });
  }
  if (evidence.length < MIN_CHARS) {
    return res.status(400).json({ error: `Please paste at least ${MIN_CHARS} characters of customer evidence.` });
  }
  if (evidence.length > MAX_CHARS) {
    return res.status(400).json({ error: `That is over the ${MAX_CHARS.toLocaleString()} character limit. Please trim it down.` });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Validate lead + check usage.
  let usageRow;
  try {
    const { data: lead, error: leadErr } = await supabase
      .from('tf_leads')
      .select('id')
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!lead) {
      return res.status(404).json({ error: 'We could not find your registration. Please refresh and enter your details again.' });
    }

    const { data: usage, error: usageErr } = await supabase
      .from('tf_usage')
      .select('run_count')
      .eq('lead_id', leadId)
      .maybeSingle();
    if (usageErr) throw usageErr;

    usageRow = usage || { run_count: 0 };
    if ((usageRow.run_count || 0) >= FREE_RUNS) {
      return res.status(403).json({ error: "You've used all 3 free analyses. Talk to us about the full system." });
    }
  } catch (err) {
    console.error('insight validate error:', err);
    return res.status(500).json({ error: 'Something went wrong on our end. Please try again shortly.' });
  }

  // Reserve the run (increment now) and open a session.
  const newCount = (usageRow.run_count || 0) + 1;
  let sessionId = null;
  try {
    await supabase
      .from('tf_usage')
      .upsert({ lead_id: leadId, run_count: newCount, last_run_at: new Date().toISOString() }, { onConflict: 'lead_id' });

    const { data: session, error: sessErr } = await supabase
      .from('tf_sessions')
      .insert({ lead_id: leadId, evidence_chars: evidence.length, status: 'processing' })
      .select('id')
      .single();
    if (sessErr) throw sessErr;
    sessionId = session.id;
  } catch (err) {
    console.error('insight session setup error:', err);
    // Refund the run we just reserved, since we never reached the model.
    try {
      await supabase
        .from('tf_usage')
        .update({ run_count: usageRow.run_count || 0 })
        .eq('lead_id', leadId);
    } catch (e) { /* best effort */ }
    return res.status(500).json({ error: 'Something went wrong on our end. Please try again shortly.' });
  }

  // From here we stream. Set streaming-friendly headers.
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  let fullText = '';

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Here is the customer evidence to analyse:\n\n${evidence}` },
      ],
    });

    stream.on('text', (delta) => {
      fullText += delta;
      res.write(delta);
    });

    const finalMessage = await stream.finalMessage();

    const tokensIn = finalMessage?.usage?.input_tokens ?? null;
    const tokensOut = finalMessage?.usage?.output_tokens ?? null;
    const estimatedCost =
      tokensIn != null && tokensOut != null
        ? Number((tokensIn * COST_IN_PER_TOKEN + tokensOut * COST_OUT_PER_TOKEN).toFixed(6))
        : null;

    // Parse the result for storage (the client parses its own copy from the stream).
    let parsed = null;
    try { parsed = JSON.parse(fullText); } catch { parsed = null; }

    await supabase
      .from('tf_sessions')
      .update({
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        estimated_cost_usd: estimatedCost,
        result: parsed,
        status: parsed ? 'complete' : 'error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return res.end();
  } catch (err) {
    console.error('insight stream error:', err);

    try {
      await supabase
        .from('tf_sessions')
        .update({ status: 'error', completed_at: new Date().toISOString() })
        .eq('id', sessionId);
    } catch (e) { /* best effort */ }

    // If nothing has been streamed yet we can send a clean JSON error and
    // refund the reserved run. Otherwise emit an inline error marker the
    // client watches for.
    if (!res.headersSent && fullText.length === 0) {
      try {
        await supabase
          .from('tf_usage')
          .update({ run_count: usageRow.run_count || 0 })
          .eq('lead_id', leadId);
      } catch (e) { /* best effort */ }
      return res.status(502).json({ error: 'The analysis could not be completed. Please try again.' });
    }
    res.write('\n__INSIGHT_ERROR__');
    return res.end();
  }
}

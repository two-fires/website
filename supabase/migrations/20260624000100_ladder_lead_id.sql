-- Link Brand Benefit Ladder sessions to a lead so a completed ladder can be
-- written into the unified client profile (tf_client_profiles). Additive only:
-- existing rows keep lead_id = NULL until a new session resolves a lead.
ALTER TABLE tf_ladder_sessions ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES tf_leads(id);

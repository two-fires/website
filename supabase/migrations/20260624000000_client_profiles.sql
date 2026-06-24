CREATE TABLE IF NOT EXISTS tf_client_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES tf_leads(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  industry TEXT,
  audience TEXT,
  tool_snapshots JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id)
);

ALTER TABLE tf_client_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_bypass ON tf_client_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- Knowledge Base Documents table
-- Stores references to documents uploaded to ElevenLabs agent knowledge base

CREATE TABLE knowledge_base_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  elevenlabs_document_id text NOT NULL,
  name text NOT NULL,
  file_size_bytes integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, elevenlabs_document_id)
);

-- Index for efficient account lookups
CREATE INDEX idx_kb_docs_account ON knowledge_base_documents(account_id);

-- Enable RLS
ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their account's KB docs
CREATE POLICY "Users can view their account KB docs"
  ON knowledge_base_documents
  FOR SELECT
  USING (account_id = (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their account KB docs"
  ON knowledge_base_documents
  FOR INSERT
  WITH CHECK (account_id = (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their account KB docs"
  ON knowledge_base_documents
  FOR DELETE
  USING (account_id = (SELECT account_id FROM users WHERE id = auth.uid()));

-- Service role bypass for edge functions
CREATE POLICY "Service role full access to KB docs"
  ON knowledge_base_documents
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE knowledge_base_documents IS 'Stores references to PDF documents uploaded to ElevenLabs agent knowledge base';
COMMENT ON COLUMN knowledge_base_documents.elevenlabs_document_id IS 'The document ID returned by ElevenLabs when uploading to knowledge base';
COMMENT ON COLUMN knowledge_base_documents.name IS 'Human-readable filename of the uploaded document';
COMMENT ON COLUMN knowledge_base_documents.file_size_bytes IS 'Size of the uploaded file in bytes';

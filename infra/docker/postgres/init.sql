-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'Extensions installed: uuid-ossp, pgcrypto, vector';
END $$;
import { createClient } from '@libsql/client';

// Local:  TURSO_DATABASE_URL=file:local.db  (fără token)
// Cloud:  TURSO_DATABASE_URL=libsql://...   + TURSO_AUTH_TOKEN
const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient(authToken ? { url, authToken } : { url });

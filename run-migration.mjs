import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

// Load env from server/_core managed path
config({ path: '.env.production' });
config({ path: '.env.local' });
config();

// Also try to get from process.env directly (injected by sandbox)
const url = process.env.DATABASE_URL;
if (!url) { 
  console.error('DATABASE_URL not set, trying to read from drizzle config...');
  process.exit(1); 
}

const conn = await createConnection(url);
const sql = readFileSync('drizzle/0040_spooky_shape.sql', 'utf8');
try {
  await conn.execute(sql);
  console.log('Migration applied successfully');
} catch (e) {
  if (e.code === 'ER_TABLE_EXISTS_ERROR') {
    console.log('Table already exists, skipping');
  } else {
    throw e;
  }
}
await conn.end();

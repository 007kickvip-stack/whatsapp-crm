import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationSQL = fs.readFileSync(
  path.join(__dirname, 'drizzle/0008_lucky_typhoid_mary.sql'),
  'utf-8'
);

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const statements = migrationSQL.split(';').filter(s => s.trim());
for (const stmt of statements) {
  await conn.execute(stmt);
  console.log('Executed:', stmt.substring(0, 60) + '...');
}
console.log('Migration done: daily_data table created');
await conn.end();

import fs from 'fs';
import mysql from 'mysql2/promise';

const sql = fs.readFileSync('drizzle/0038_tough_lilandra.sql', 'utf8');
const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      console.log('Executed:', stmt.substring(0, 80) + '...');
    } catch (e) {
      if (e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_FIELDNAME') {
        console.log('Already exists, skipping:', stmt.substring(0, 80));
      } else {
        throw e;
      }
    }
  }
  // 将现有baseSalary值同步到regularBaseSalary
  await conn.execute("UPDATE `users` SET `regularBaseSalary` = `baseSalary` WHERE `baseSalary` IS NOT NULL AND `baseSalary` != '0.00'");
  console.log('Synced baseSalary to regularBaseSalary');
  console.log('Migration completed successfully');
} finally {
  await conn.end();
}

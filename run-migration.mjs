import fs from 'fs';
import mysql from 'mysql2/promise';

const sql = fs.readFileSync('drizzle/0029_perpetual_johnny_storm.sql', 'utf8');
const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await conn.execute(sql);
  console.log('Migration executed successfully');
} catch (e) {
  if (e.code === 'ER_TABLE_EXISTS_ERROR') {
    console.log('Table already exists, skipping');
  } else {
    throw e;
  }
} finally {
  await conn.end();
}

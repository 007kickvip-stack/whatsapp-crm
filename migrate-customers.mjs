import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function run() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  const statements = [
    "ALTER TABLE customers ADD staffName varchar(64)",
    "ALTER TABLE customers ADD account varchar(64)",
    "ALTER TABLE customers ADD contactInfo text",
    "ALTER TABLE customers ADD totalOrderCount int DEFAULT 0",
    "ALTER TABLE customers ADD totalSpentUsd decimal(12,2) DEFAULT '0'",
    "ALTER TABLE customers ADD totalSpentCny decimal(12,2) DEFAULT '0'",
    "ALTER TABLE customers ADD firstOrderDate date",
    "ALTER TABLE customers ADD customerLevel varchar(32)",
    "ALTER TABLE customers ADD orderCategory varchar(255)",
    "ALTER TABLE customers ADD customerName varchar(128)",
    "ALTER TABLE customers ADD birthDate date",
    "ALTER TABLE customers ADD customerEmail varchar(320)"
  ];

  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      console.log(`✅ ${stmt}`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log(`⏭️ Column already exists: ${stmt}`);
      } else {
        console.error(`❌ ${stmt}: ${err.message}`);
      }
    }
  }

  await conn.end();
  console.log('\nMigration complete!');
}

run();

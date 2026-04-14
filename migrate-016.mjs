import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
await conn.execute("ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `wpEntryDate` date");
await conn.execute("ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `wpEntryDate` date");
console.log("Migration 016 done");
await conn.end();

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
await conn.execute("ALTER TABLE `order_items` ADD `originalOrderNo` varchar(128)");
console.log("Migration done: added originalOrderNo to order_items");
await conn.end();

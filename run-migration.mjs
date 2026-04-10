import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
await conn.execute("ALTER TABLE `users` ADD `hireDate` date;");
console.log("Migration done: added hireDate to users table");
await conn.end();

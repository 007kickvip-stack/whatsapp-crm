import mysql from 'mysql2/promise';

const ACCOUNTS = [
  { name: "M1 BUY-4254", color: "#c4b5fd" },
  { name: "K-ONE-1718", color: "#fbbf24" },
  { name: "UMI BUY-3264", color: "#93c5fd" },
  { name: "BEST-BUY-1152", color: "#f9a8d4" },
  { name: "First Supplier", color: "#86efac" },
  { name: "Best one-5832", color: "#a5b4fc" },
  { name: "Rich-4192", color: "#7dd3fc" },
  { name: "OKR", color: "#bef264" },
  { name: "topone", color: "#d8b4fe" },
  { name: "fashion", color: "#fca5a5" },
  { name: "Sneak Depot", color: "#f472b6" },
  { name: "rich", color: "#a5b4fc" },
  { name: "Jack", color: "#fdba74" },
  { name: "Everybuy", color: "#86efac" },
  { name: "k-club", color: "#f87171" },
  { name: "Trend Union", color: "#c084fc" },
  { name: "Factory Drip", color: "#7dd3fc" },
  { name: "Visionmart", color: "#93c5fd" },
  { name: "prosperity hub", color: "#fdba74" },
  { name: "电报娜", color: "#d8b4fe" },
  { name: "best", color: "#60a5fa" },
  { name: "Dark-pop", color: "#fb923c" },
  { name: "See.U", color: "#f97316" },
  { name: "A1 BUY", color: "#a5b4fc" },
  { name: "ONE BUY", color: "#60a5fa" },
  { name: "Lucky Buy", color: "#86efac" },
  { name: "Sneak Depot", color: "#a5b4fc" },
  { name: "coco", color: "#93c5fd" },
  { name: "Hyped Code", color: "#c4b5fd" },
  { name: "Keep Real", color: "#d8b4fe" },
  { name: "POP", color: "#60a5fa" },
];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Check if accounts table already has data
  const [rows] = await conn.execute('SELECT COUNT(*) as cnt FROM accounts');
  if (rows[0].cnt > 0) {
    console.log(`Accounts table already has ${rows[0].cnt} records, skipping seed.`);
    await conn.end();
    return;
  }

  let inserted = 0;
  for (let i = 0; i < ACCOUNTS.length; i++) {
    const { name, color } = ACCOUNTS[i];
    try {
      await conn.execute(
        'INSERT INTO accounts (name, color, sortOrder) VALUES (?, ?, ?)',
        [name, color, i]
      );
      inserted++;
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        console.log(`Skipping duplicate: ${name}`);
      } else {
        throw e;
      }
    }
  }
  
  console.log(`Seeded ${inserted} accounts successfully.`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("Connected...");
  const users = await prisma.user.findMany();
  console.log('Found users:', users.map(u => ({ email: u.email, name: u.managerName, role: u.role })));

  for (const user of users) {
    if (user.role !== 'ADMIN') {
        const u = await prisma.user.update({
             where: { id: user.id },
             data: { role: 'ADMIN' },
        });
        console.log(`Updated ${user.email} -> ADMIN`);    
    }
  }

  await prisma.$disconnect();
}

run().catch(console.error);

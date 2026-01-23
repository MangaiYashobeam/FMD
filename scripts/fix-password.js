// Generate password hash and update admin user
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updatePassword() {
  const password = 'Admin123!';
  const hash = bcrypt.hashSync(password, 10);
  console.log('Generated hash:', hash);

  const user = await prisma.user.update({
    where: { email: 'admin@gadproductions.com' },
    data: { passwordHash: hash },
  });

  console.log('Updated user:', user.email);
  await prisma.$disconnect();
}

updatePassword().catch(console.error);

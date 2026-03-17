import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
    const passwordHash = await bcrypt.hash('admin123', 12)
    const user = await prisma.user.upsert({
        where: { email: 'admin@empresa.com' },
        update: {},
        create: {
            email: 'admin@empresa.com',
            passwordHash,
            name: 'Admin',
        },
    })
    console.log(`Usuário criado: ${user.email}`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
    const passwordHash = await bcrypt.hash('admin123', 12)

    const empresa = await prisma.empresa.upsert({
        where: { id: 'seed-empresa-id' },
        update: {},
        create: {
            id: 'seed-empresa-id',
            razaoSocial: 'Empresa Teste',
            cnpj: '00000000000000',
        },
    })

    const user = await prisma.user.upsert({
        where: { email: 'admin@empresa.com' },
        update: {},
        create: {
            email: 'admin@empresa.com',
            passwordHash,
            name: 'Admin',
            empresaId: empresa.id,
        },
    })

    console.log(`Empresa criada: ${empresa.razaoSocial}`)
    console.log(`Usuário criado: ${user.email}`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())

-- AlterTable
ALTER TABLE "Cte" ADD COLUMN     "destinatarioId" TEXT,
ADD COLUMN     "remetenteId" TEXT,
ADD COLUMN     "tomadorId" TEXT;

-- CreateTable
CREATE TABLE "Parceiro" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipoPessoa" TEXT NOT NULL DEFAULT 'J',
    "xNome" TEXT NOT NULL,
    "cnpj" TEXT,
    "cpf" TEXT,
    "ie" TEXT,
    "fone" TEXT,
    "email" TEXT,
    "xLgr" TEXT,
    "nro" TEXT,
    "xCompl" TEXT,
    "xBairro" TEXT,
    "cMun" TEXT,
    "xMun" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "cPais" TEXT DEFAULT '1058',
    "xPais" TEXT DEFAULT 'BRASIL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parceiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Parceiro_userId_cnpj_idx" ON "Parceiro"("userId", "cnpj");

-- CreateIndex
CREATE INDEX "Parceiro_userId_xNome_idx" ON "Parceiro"("userId", "xNome");

-- AddForeignKey
ALTER TABLE "Parceiro" ADD CONSTRAINT "Parceiro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cte" ADD CONSTRAINT "Cte_remetenteId_fkey" FOREIGN KEY ("remetenteId") REFERENCES "Parceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cte" ADD CONSTRAINT "Cte_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Parceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cte" ADD CONSTRAINT "Cte_tomadorId_fkey" FOREIGN KEY ("tomadorId") REFERENCES "Parceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

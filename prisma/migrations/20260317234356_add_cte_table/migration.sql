-- CreateTable
CREATE TABLE "Cte" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "nCT" INTEGER,
    "serie" INTEGER,
    "nomeRemetente" TEXT,
    "nomeDestinatario" TEXT,
    "valorTotal" DOUBLE PRECISION,
    "dhEmi" TIMESTAMP(3),
    "idNuvem" TEXT,
    "chave" TEXT,
    "infCte" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cte_userId_status_idx" ON "Cte"("userId", "status");

-- CreateIndex
CREATE INDEX "Cte_userId_createdAt_idx" ON "Cte"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Cte" ADD CONSTRAINT "Cte_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

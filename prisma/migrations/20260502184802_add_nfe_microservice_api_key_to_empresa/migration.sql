/*
  Warnings:

  - You are about to drop the `Account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Cte` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmpresaConfig` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Parceiro` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VerificationToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Cte" DROP CONSTRAINT "Cte_destinatarioId_fkey";

-- DropForeignKey
ALTER TABLE "Cte" DROP CONSTRAINT "Cte_remetenteId_fkey";

-- DropForeignKey
ALTER TABLE "Cte" DROP CONSTRAINT "Cte_tomadorId_fkey";

-- DropForeignKey
ALTER TABLE "Cte" DROP CONSTRAINT "Cte_userId_fkey";

-- DropForeignKey
ALTER TABLE "EmpresaConfig" DROP CONSTRAINT "EmpresaConfig_userId_fkey";

-- DropForeignKey
ALTER TABLE "Parceiro" DROP CONSTRAINT "Parceiro_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropTable
DROP TABLE "Account";

-- DropTable
DROP TABLE "Cte";

-- DropTable
DROP TABLE "EmpresaConfig";

-- DropTable
DROP TABLE "Parceiro";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "VerificationToken";

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL DEFAULT '',
    "cnpj" TEXT NOT NULL DEFAULT '',
    "ie" TEXT NOT NULL DEFAULT '',
    "crt" TEXT NOT NULL DEFAULT '3',
    "rntrc" TEXT NOT NULL DEFAULT '',
    "cuf" TEXT NOT NULL DEFAULT '',
    "c_mun_env" TEXT NOT NULL DEFAULT '',
    "x_mun_env" TEXT NOT NULL DEFAULT '',
    "uf_env" TEXT NOT NULL DEFAULT '',
    "sequencia_cte" INTEGER NOT NULL DEFAULT 1,
    "serie" INTEGER NOT NULL DEFAULT 99,
    "sequencia_mdfe" INTEGER NOT NULL DEFAULT 1,
    "serie_mdfe" INTEGER NOT NULL DEFAULT 1,
    "nfe_microservice_api_key" TEXT,
    "nome_fantasia" TEXT NOT NULL DEFAULT '',
    "x_lgr" TEXT NOT NULL DEFAULT '',
    "nro" TEXT NOT NULL DEFAULT '',
    "x_compl" TEXT NOT NULL DEFAULT '',
    "x_bairro" TEXT NOT NULL DEFAULT '',
    "cep" TEXT NOT NULL DEFAULT '',
    "fone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "empresa_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parceiros" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo_pessoa" TEXT NOT NULL DEFAULT 'J',
    "x_nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "cpf" TEXT,
    "ie" TEXT,
    "fone" TEXT,
    "email" TEXT,
    "x_lgr" TEXT,
    "nro" TEXT,
    "x_compl" TEXT,
    "x_bairro" TEXT,
    "c_mun" TEXT,
    "x_mun" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "c_pais" TEXT DEFAULT '1058',
    "x_pais" TEXT DEFAULT 'BRASIL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parceiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctes" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "n_ct" INTEGER,
    "serie" INTEGER,
    "nome_remetente" TEXT,
    "nome_destinatario" TEXT,
    "nome_tomador" TEXT,
    "valor_total" DOUBLE PRECISION,
    "dh_emi" TIMESTAMP(3),
    "id_nuvem" TEXT,
    "chave" TEXT,
    "erro_msg" TEXT,
    "remetente_id" TEXT,
    "destinatario_id" TEXT,
    "tomador_id" TEXT,
    "inf_cte" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ctes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cte_eventos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "cte_id" TEXT,
    "tipo" TEXT NOT NULL,
    "chave" TEXT,
    "id_nuvem" TEXT,
    "erro_msg" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cte_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proprietarios" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "x_nome" TEXT NOT NULL,
    "cpf" TEXT,
    "cnpj" TEXT,
    "rntrc" TEXT NOT NULL,
    "ie" TEXT,
    "uf" TEXT,
    "tp_prop" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proprietarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veiculos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "renavam" TEXT,
    "tara" INTEGER NOT NULL DEFAULT 0,
    "cap_kg" INTEGER,
    "cap_m3" INTEGER,
    "tp_rod" TEXT NOT NULL DEFAULT '01',
    "tp_car" TEXT NOT NULL DEFAULT '00',
    "uf" TEXT,
    "rntrc" TEXT,
    "proprietario_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfes" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "n_mdf" INTEGER,
    "serie" INTEGER,
    "uf_ini" TEXT,
    "uf_fim" TEXT,
    "dh_emi" TIMESTAMP(3),
    "id_nuvem" TEXT,
    "chave" TEXT,
    "erro_msg" TEXT,
    "inf_mdfe" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_empresa_id_idx" ON "users"("empresa_id");

-- CreateIndex
CREATE INDEX "parceiros_empresa_id_cnpj_idx" ON "parceiros"("empresa_id", "cnpj");

-- CreateIndex
CREATE INDEX "parceiros_empresa_id_x_nome_idx" ON "parceiros"("empresa_id", "x_nome");

-- CreateIndex
CREATE INDEX "ctes_empresa_id_status_idx" ON "ctes"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "ctes_empresa_id_created_at_idx" ON "ctes"("empresa_id", "created_at");

-- CreateIndex
CREATE INDEX "cte_eventos_empresa_id_created_at_idx" ON "cte_eventos"("empresa_id", "created_at");

-- CreateIndex
CREATE INDEX "cte_eventos_cte_id_idx" ON "cte_eventos"("cte_id");

-- CreateIndex
CREATE INDEX "proprietarios_empresa_id_x_nome_idx" ON "proprietarios"("empresa_id", "x_nome");

-- CreateIndex
CREATE INDEX "proprietarios_empresa_id_cpf_idx" ON "proprietarios"("empresa_id", "cpf");

-- CreateIndex
CREATE INDEX "proprietarios_empresa_id_cnpj_idx" ON "proprietarios"("empresa_id", "cnpj");

-- CreateIndex
CREATE INDEX "veiculos_empresa_id_placa_idx" ON "veiculos"("empresa_id", "placa");

-- CreateIndex
CREATE UNIQUE INDEX "veiculos_empresa_id_placa_key" ON "veiculos"("empresa_id", "placa");

-- CreateIndex
CREATE INDEX "mdfes_empresa_id_status_idx" ON "mdfes"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "mdfes_empresa_id_created_at_idx" ON "mdfes"("empresa_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parceiros" ADD CONSTRAINT "parceiros_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctes" ADD CONSTRAINT "ctes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctes" ADD CONSTRAINT "ctes_remetente_id_fkey" FOREIGN KEY ("remetente_id") REFERENCES "parceiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctes" ADD CONSTRAINT "ctes_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "parceiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctes" ADD CONSTRAINT "ctes_tomador_id_fkey" FOREIGN KEY ("tomador_id") REFERENCES "parceiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cte_eventos" ADD CONSTRAINT "cte_eventos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cte_eventos" ADD CONSTRAINT "cte_eventos_cte_id_fkey" FOREIGN KEY ("cte_id") REFERENCES "ctes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietarios" ADD CONSTRAINT "proprietarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_proprietario_id_fkey" FOREIGN KEY ("proprietario_id") REFERENCES "proprietarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfes" ADD CONSTRAINT "mdfes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

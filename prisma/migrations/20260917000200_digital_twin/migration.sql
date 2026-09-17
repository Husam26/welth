-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "simulations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scenario" JSONB NOT NULL,
    "status" "SimulationStatus" NOT NULL DEFAULT 'PENDING',
    "iterations" INTEGER NOT NULL DEFAULT 1000,
    "horizonMonths" INTEGER NOT NULL DEFAULT 12,
    "results" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_batches" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "batchIndex" INTEGER NOT NULL,
    "iterations" INTEGER NOT NULL,
    "partial" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "simulations_userId_idx" ON "simulations"("userId");

-- CreateIndex
CREATE INDEX "simulation_batches_simulationId_idx" ON "simulation_batches"("simulationId");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_batches_simulationId_batchIndex_key" ON "simulation_batches"("simulationId", "batchIndex");

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_batches" ADD CONSTRAINT "simulation_batches_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

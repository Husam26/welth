-- CreateEnum
CREATE TYPE "AnomalyType" AS ENUM ('AMOUNT_SPIKE', 'CATEGORY_SURGE', 'NEW_MERCHANT', 'FREQUENCY_SPIKE', 'BUDGET_OVERRUN', 'DUPLICATE_CHARGE');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "anomalies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "category" TEXT,
    "type" "AnomalyType" NOT NULL,
    "severity" "AnomalySeverity" NOT NULL DEFAULT 'MEDIUM',
    "score" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_forecasts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "predicted" DECIMAL(65,30) NOT NULL,
    "lowerBound" DECIMAL(65,30) NOT NULL,
    "upperBound" DECIMAL(65,30) NOT NULL,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anomalies_userId_detectedAt_idx" ON "anomalies"("userId", "detectedAt");

-- CreateIndex
CREATE INDEX "expense_forecasts_userId_idx" ON "expense_forecasts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_forecasts_userId_month_category_key" ON "expense_forecasts"("userId", "month", "category");

-- AddForeignKey
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_forecasts" ADD CONSTRAINT "expense_forecasts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

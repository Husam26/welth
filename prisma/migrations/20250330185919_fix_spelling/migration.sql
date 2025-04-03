/*
  Warnings:

  - You are about to drop the column `reccuringInterval` on the `transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "reccuringInterval",
ADD COLUMN     "recurringInterval" "RecurringInterval";

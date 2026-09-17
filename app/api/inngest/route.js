import { serve } from "inngest/next";
import {inngest} from "@/lib/inngest/client"
import {
  checkBudgetAlert,
  generateMonthlyReports,
  processRecurringTransaction,
  triggerRecurringTransactions,
  detectAnomaliesForUser,
  detectAnomaliesDaily,
  generateForecasts,
  runSimulation,
} from "@/lib/inngest/functions";

// Create an API that serves the app's background functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    checkBudgetAlert,
    triggerRecurringTransactions,
    processRecurringTransaction,
    generateMonthlyReports,
    // Phase 2, Step 2
    detectAnomaliesForUser,
    detectAnomaliesDaily,
    generateForecasts,
    // Phase 2, Step 3
    runSimulation,
  ],
});

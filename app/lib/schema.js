import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Nmae is required"),
  type: z.enum(["CURRENT", "SAVINGS"]),
  balance: z.string().min(1, "Initial balance is required"),
  isDefault: z.boolean().default(false),
});

export const transactionSchema = z
  .object({
    // name: z.string().min(1, "Nmae is required"),
    amount: z.string().optional(),
    description: z.string().optional(),
    date: z.date({ required_error: "Date is required" }),
    accountId: z.string().min(1, "Account is required"),
    category: z.string().min(1, "Category is required"),
    isRecurring: z.boolean().default(false),
    recurringInterval: z.enum(["DAILY", "WEEKLY","MONTHLY","YEARLY"]).optional(),
    type:z.enum(["EXPENSE","INCOME"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isRecurring && !data.recurringInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Recurring interval is required for recurring for recurring transactions",
        path: ["recurringInterval"],
      });
    }
  });

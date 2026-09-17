import { auth } from "@clerk/nextjs/server";
import { seedTransactions } from "@/actions/seed";

// Demo/dev utility: generates sample transactions for the *currently signed-in*
// user's default account. It is intentionally scoped to the caller — it can no
// longer wipe or reseed another user's data (previously it used hard-coded IDs).
export async function GET() {
  const { userId } = await auth();

  // Require an authenticated session before doing any DB work.
  if (!userId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await seedTransactions();
  return Response.json(result, { status: result.success ? 200 : 400 });
}

"use server";

import { db } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function getAuthedUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");
  return user;
}

const shockSchema = z.object({
  type: z.enum([
    "JOB_LOSS",
    "INCOME_CHANGE",
    "EXPENSE_INFLATION",
    "NEW_LOAN",
    "BIG_PURCHASE",
  ]),
  startMonth: z.coerce.number().int().min(1).max(60).optional(),
  durationMonths: z.coerce.number().int().min(1).max(60).optional(),
  months: z.coerce.number().int().min(1).max(60).optional(),
  month: z.coerce.number().int().min(1).max(60).optional(),
  amount: z.coerce.number().min(0).optional(),
  emi: z.coerce.number().min(0).optional(),
  pct: z.coerce.number().min(-100).max(1000).optional(),
});

const createSimSchema = z.object({
  name: z.string().min(1).max(100).default("Scenario"),
  horizonMonths: z.coerce.number().int().min(1).max(60).default(12),
  iterations: z.coerce.number().int().min(100).max(5000).default(1000),
  shocks: z.array(shockSchema).max(10).default([]),
});

export async function createSimulation(data) {
  try {
    const user = await getAuthedUser();

    const parsed = createSimSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message || "Invalid scenario");
    }
    const { name, horizonMonths, iterations, shocks } = parsed.data;

    const sim = await db.simulation.create({
      data: {
        userId: user.id,
        name,
        horizonMonths,
        iterations,
        scenario: { shocks },
        status: "PENDING",
      },
    });

    // Kick off the distributed Monte Carlo run
    await inngest.send({
      name: "simulation.requested",
      data: { simulationId: sim.id },
    });

    revalidatePath("/simulations");
    return { success: true, id: sim.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getSimulation(id) {
  const user = await getAuthedUser();
  const sim = await db.simulation.findFirst({
    where: { id, userId: user.id },
  });
  if (!sim) return null;
  return sim; // scenario/results are JSON, iterations Int — safe to return as-is
}

export async function listSimulations() {
  const user = await getAuthedUser();
  return db.simulation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      status: true,
      horizonMonths: true,
      iterations: true,
      createdAt: true,
      completedAt: true,
    },
  });
}

export async function deleteSimulation(id) {
  try {
    const user = await getAuthedUser();
    await db.simulation.deleteMany({ where: { id, userId: user.id } });
    revalidatePath("/simulations");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

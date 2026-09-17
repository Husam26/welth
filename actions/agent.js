"use server";

import aj from "@/lib/arcjet";
import { db } from "@/lib/prisma";
import { runAgentTurn, executeTool } from "@/lib/agent/agent";
import { request } from "@arcjet/next";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

async function getAuthedUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");
  return user;
}

export async function createConversation() {
  const user = await getAuthedUser();
  const convo = await db.conversation.create({ data: { userId: user.id } });
  revalidatePath("/agent");
  return { success: true, id: convo.id };
}

export async function listConversations() {
  const user = await getAuthedUser();
  return db.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, title: true, updatedAt: true },
  });
}

export async function getConversation(id) {
  const user = await getAuthedUser();
  const convo = await db.conversation.findFirst({
    where: { id, userId: user.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      actions: { where: { status: "PROPOSED" }, orderBy: { createdAt: "desc" } },
    },
  });
  return convo;
}

export async function deleteConversation(id) {
  try {
    const user = await getAuthedUser();
    await db.conversation.deleteMany({ where: { id, userId: user.id } });
    revalidatePath("/agent");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function sendAgentMessage(conversationId, content) {
  try {
    const user = await getAuthedUser();

    if (!content || !content.trim()) throw new Error("Message is empty");

    // Rate-limit the agent endpoint (LLM + DB work)
    const req = await request();
    const decision = await aj.protect(req, { userId: user.id, requested: 1 });
    if (decision.isDenied()) {
      throw new Error("You're sending messages too fast. Please wait a moment.");
    }

    const convo = await db.conversation.findFirst({
      where: { id: conversationId, userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!convo) throw new Error("Conversation not found");

    const history = convo.messages.map((m) => ({ role: m.role, content: m.content }));

    // Persist the user message
    await db.message.create({
      data: { conversationId, role: "USER", content },
    });

    // Run the agent
    const turn = await runAgentTurn({ userId: user.id, history, userMessage: content });

    // Persist the assistant reply (with any tool-call log for display)
    await db.message.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        content: turn.text,
        toolCalls: turn.toolCalls?.length ? turn.toolCalls : undefined,
      },
    });

    // Persist a proposed (mutating) action, if any
    let proposedAction = null;
    if (turn.proposedAction) {
      const action = await db.agentAction.create({
        data: {
          userId: user.id,
          conversationId,
          tool: turn.proposedAction.tool,
          args: turn.proposedAction.args,
          status: "PROPOSED",
        },
      });
      proposedAction = { id: action.id, tool: action.tool, args: action.args };
    }

    // Auto-title the conversation from the first user message
    const updates = { updatedAt: new Date() };
    if (convo.title === "New conversation") {
      updates.title = content.slice(0, 48) + (content.length > 48 ? "…" : "");
    }
    await db.conversation.update({ where: { id: conversationId }, data: updates });

    revalidatePath("/agent");
    return {
      success: true,
      assistant: turn.text,
      toolCalls: turn.toolCalls || [],
      proposedAction,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function confirmAgentAction(actionId) {
  try {
    const user = await getAuthedUser();

    const action = await db.agentAction.findFirst({
      where: { id: actionId, userId: user.id },
    });
    if (!action) throw new Error("Action not found");
    if (action.status !== "PROPOSED") throw new Error("Action is no longer pending");

    let result;
    try {
      // Execute with the trusted session userId (NOT anything from the model)
      result = await executeTool({ userId: user.id, tool: action.tool, args: action.args });
    } catch (e) {
      await db.agentAction.update({
        where: { id: actionId },
        data: { status: "FAILED", result: { error: e.message }, executedAt: new Date() },
      });
      throw e;
    }

    await db.agentAction.update({
      where: { id: actionId },
      data: { status: "EXECUTED", result, executedAt: new Date() },
    });

    // Add a confirmation message to the conversation
    if (action.conversationId) {
      await db.message.create({
        data: {
          conversationId: action.conversationId,
          role: "ASSISTANT",
          content: `✅ Done — \`${action.tool}\` executed.`,
        },
      });
    }

    revalidatePath("/agent");
    revalidatePath("/budgets");
    revalidatePath("/dashboard");
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function rejectAgentAction(actionId) {
  try {
    const user = await getAuthedUser();
    const action = await db.agentAction.updateMany({
      where: { id: actionId, userId: user.id, status: "PROPOSED" },
      data: { status: "REJECTED" },
    });
    if (action.count === 0) throw new Error("Action not found or already handled");
    revalidatePath("/agent");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// The Welth Agent loop: a bounded Gemini function-calling ("ReAct") cycle.
// Read tools auto-execute and feed back into the model; the first mutating tool
// call halts the loop and is returned as a proposed action for the UI to confirm.

import { genAI, GEMINI_MODEL } from "@/lib/gemini";
import {
  TOOLS,
  FUNCTION_DECLARATIONS,
  SYSTEM_PROMPT,
  buildFinancialContext,
} from "./tools.js";

const MAX_ITERS = 5; // hard cap on tool round-trips per turn

function toGeminiHistory(history = []) {
  const mapped = history
    .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
    .map((m) => ({
      role: m.role === "USER" ? "user" : "model",
      parts: [{ text: m.content || "" }],
    }));
  // Gemini requires the history to begin with a user turn
  while (mapped.length && mapped[0].role !== "user") mapped.shift();
  return mapped;
}

function safeText(resp) {
  try {
    return resp.text();
  } catch {
    return "";
  }
}

/**
 * Run one agent turn.
 * @returns {{ text, proposedAction: {tool,args}|null, toolCalls: {name,args}[] }}
 */
export async function runAgentTurn({ userId, history, userMessage }) {
  const context = await buildFinancialContext(userId);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: `${SYSTEM_PROMPT}\n\nUser context: ${context}`,
    tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
  });

  const chat = model.startChat({ history: toGeminiHistory(history) });
  const toolCallsLog = [];
  let resp = (await chat.sendMessage(userMessage)).response;

  for (let i = 0; i < MAX_ITERS; i++) {
    const calls = resp.functionCalls?.() || [];
    if (!calls.length) break;

    const responses = [];
    for (const call of calls) {
      const tool = TOOLS[call.name];
      toolCallsLog.push({ name: call.name, args: call.args || {} });

      if (!tool) {
        responses.push({ functionResponse: { name: call.name, response: { error: "unknown tool" } } });
        continue;
      }

      // Mutating tool → propose for human confirmation, halt the loop
      if (tool.mutating) {
        return {
          text: safeText(resp) || `I'd like to run **${call.name}**. Please confirm below.`,
          proposedAction: { tool: call.name, args: call.args || {} },
          toolCalls: toolCallsLog,
        };
      }

      // Read tool → execute and feed the result back to the model
      try {
        const result = await tool.handler(call.args || {}, { userId });
        responses.push({ functionResponse: { name: call.name, response: result } });
      } catch (e) {
        responses.push({ functionResponse: { name: call.name, response: { error: e.message } } });
      }
    }

    resp = (await chat.sendMessage(responses)).response;
  }

  return {
    text: safeText(resp) || "I wasn't able to produce a response — could you rephrase?",
    proposedAction: null,
    toolCalls: toolCallsLog,
  };
}

/** Execute a (previously proposed) tool. userId is always the trusted session id. */
export async function executeTool({ userId, tool, args }) {
  const t = TOOLS[tool];
  if (!t) throw new Error("Unknown tool");
  return await t.handler(args || {}, { userId });
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  createConversation,
  getConversation,
  listConversations,
  sendAgentMessage,
  confirmAgentAction,
  rejectAgentAction,
  deleteConversation,
} from "@/actions/agent";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  User,
  Send,
  Plus,
  Wrench,
  Loader2,
  Check,
  X,
  Trash2,
} from "lucide-react";

const SUGGESTIONS = [
  "Am I on track this month?",
  "Where am I overspending?",
  "Set my food budget to ₹8000",
  "What if I lose my job for 3 months?",
];

export default function AgentChat({ initialConversations, initialConversation }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(initialConversation?.id || null);
  const [messages, setMessages] = useState(
    initialConversation?.messages?.map(toClientMsg) || []
  );
  const [pending, setPending] = useState(
    initialConversation?.actions?.[0]
      ? {
          id: initialConversation.actions[0].id,
          tool: initialConversation.actions[0].tool,
          args: initialConversation.actions[0].args,
        }
      : null
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, sending]);

  const refreshConversations = async () => setConversations(await listConversations());

  const openConversation = async (id) => {
    const convo = await getConversation(id);
    setActiveId(id);
    setMessages(convo?.messages?.map(toClientMsg) || []);
    setPending(
      convo?.actions?.[0]
        ? { id: convo.actions[0].id, tool: convo.actions[0].tool, args: convo.actions[0].args }
        : null
    );
  };

  const startNewChat = async () => {
    const res = await createConversation();
    if (res.success) {
      setActiveId(res.id);
      setMessages([]);
      setPending(null);
      await refreshConversations();
    }
  };

  const handleSend = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    let convoId = activeId;
    if (!convoId) {
      const res = await createConversation();
      if (!res.success) { toast.error("Could not start a conversation"); return; }
      convoId = res.id;
      setActiveId(convoId);
    }

    setInput("");
    setPending(null);
    setMessages((m) => [...m, { role: "USER", content }]);
    setSending(true);

    const res = await sendAgentMessage(convoId, content);
    setSending(false);

    if (!res.success) {
      toast.error(res.error || "Agent error");
      setMessages((m) => [...m, { role: "ASSISTANT", content: `⚠️ ${res.error}` }]);
      return;
    }

    setMessages((m) => [
      ...m,
      { role: "ASSISTANT", content: res.assistant, toolCalls: res.toolCalls },
    ]);
    if (res.proposedAction) setPending(res.proposedAction);
    await refreshConversations();
  };

  const handleConfirm = async () => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    const res = await confirmAgentAction(p.id);
    if (res.success) {
      toast.success("Action executed");
      setMessages((m) => [...m, { role: "ASSISTANT", content: `✅ Done — \`${p.tool}\` executed.` }]);
    } else {
      toast.error(res.error || "Failed to execute");
      setPending(p); // restore so the user can retry/reject
    }
  };

  const handleReject = async () => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    await rejectAgentAction(p.id);
    setMessages((m) => [...m, { role: "ASSISTANT", content: `❌ Cancelled \`${p.tool}\`.` }]);
  };

  const handleDelete = async (id) => {
    await deleteConversation(id);
    if (id === activeId) {
      setActiveId(null);
      setMessages([]);
      setPending(null);
    }
    await refreshConversations();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      {/* Conversation list */}
      <div className="space-y-2">
        <Button onClick={startNewChat} className="w-full">
          <Plus className="h-4 w-4 mr-2" /> New Chat
        </Button>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm ${
                c.id === activeId ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <span className="truncate">{c.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-negative shrink-0"
                aria-label="Delete conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <Card className="flex flex-col h-[70vh]">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
          {messages.length === 0 && !sending && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
              <Bot className="h-10 w-10 text-primary mb-3" />
              <p className="font-medium text-foreground">Ask Welth Agent anything about your money.</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4 max-w-md">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary/30 hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Bot className="h-5 w-5 text-primary" />
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          )}

          {pending && (
            <ProposedActionCard action={pending} onConfirm={handleConfirm} onReject={handleReject} />
          )}
        </CardContent>

        {/* Composer */}
        <div className="border-t p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask about your finances…"
            disabled={sending}
          />
          <Button onClick={() => handleSend()} disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

function toClientMsg(m) {
  return { role: m.role, content: m.content, toolCalls: m.toolCalls };
}

function MessageBubble({ message }) {
  const isUser = message.role === "USER";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <Bot className="h-6 w-6 text-primary shrink-0 mt-1" />}
      <div className={`max-w-[80%] ${isUser ? "order-1" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
          }`}
        >
          {message.content}
        </div>
        {message.toolCalls?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {message.toolCalls.map((tc, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                <Wrench className="h-3 w-3" /> {tc.name}
              </span>
            ))}
          </div>
        )}
      </div>
      {isUser && <User className="h-6 w-6 text-primary shrink-0 mt-1" />}
    </div>
  );
}

function ProposedActionCard({ action, onConfirm, onReject }) {
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
      <p className="mb-1 text-sm font-medium text-foreground">
        Confirm action: <code className="rounded bg-warning/20 px-1">{action.tool}</code>
      </p>
      <pre className="mb-3 overflow-x-auto rounded bg-muted p-2 text-xs text-foreground">
        {JSON.stringify(action.args, null, 2)}
      </pre>
      <div className="flex gap-2">
        <Button size="sm" className="bg-positive text-positive-foreground hover:bg-positive/90" onClick={onConfirm}>
          <Check className="h-4 w-4 mr-1" /> Confirm
        </Button>
        <Button size="sm" variant="outline" onClick={onReject}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

import React from "react";
import { listConversations, getConversation } from "@/actions/agent";
import AgentChat from "./_components/agent-chat";
import PageHeader from "@/components/page-header";

export const metadata = {
  title: "Welth Agent",
  description: "Your AI money agent — ask questions and take actions on your finances.",
};

export default async function AgentPage() {
  const conversations = await listConversations();
  const initialConversation = conversations[0]
    ? await getConversation(conversations[0].id)
    : null;

  return (
    <div>
      <PageHeader
        title="Welth Agent"
        subtitle="Ask about your finances or tell the agent what to do — it confirms before making changes."
      />
      <AgentChat
        initialConversations={conversations}
        initialConversation={initialConversation}
      />
    </div>
  );
}

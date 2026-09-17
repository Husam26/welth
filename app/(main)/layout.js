import React from "react";
import { checkUser } from "@/lib/checkUser";
import AppShell from "@/components/app-shell";

export default async function MainLayout({ children }) {
  // Provision the Clerk user in our DB on first app entry (previously done in
  // the global header, which the sidebar shell replaces).
  await checkUser();

  return <AppShell>{children}</AppShell>;
}

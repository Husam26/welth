import React from "react";
import { listSimulations } from "@/actions/simulation";
import SimulationLab from "./_components/simulation-lab";
import PageHeader from "@/components/page-header";

export const metadata = {
  title: "Digital Twin",
  description:
    "Monte Carlo simulation of your financial future — stress-test scenarios like job loss or big purchases.",
};

export default async function SimulationsPage() {
  const simulations = await listSimulations();

  return (
    <div>
      <PageHeader
        title="Financial Digital Twin"
        subtitle="Simulate thousands of possible futures and stress-test 'what if' scenarios."
      />
      <SimulationLab initialSimulations={simulations} />
    </div>
  );
}

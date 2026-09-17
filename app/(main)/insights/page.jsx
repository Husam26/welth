import React from "react";
import { getAnomalies, getForecasts } from "@/actions/insights";
import InsightsView from "./_components/insights-view";
import PageHeader from "@/components/page-header";

export const metadata = {
  title: "Insights",
  description: "AI-powered anomaly detection and next-month expense forecasts.",
};

export default async function InsightsPage() {
  const [anomalies, forecast] = await Promise.all([
    getAnomalies(),
    getForecasts(),
  ]);

  return (
    <div>
      <PageHeader
        title="Smart Insights"
        subtitle="Statistical anomaly detection and next-month spending forecasts."
      />
      <InsightsView initialAnomalies={anomalies} forecast={forecast} />
    </div>
  );
}

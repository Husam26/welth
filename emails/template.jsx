import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export default function EmailTemplate({
  userName = "",
  type = "monthly-report",
  data = {},
}) {
  if (type === "monthly-report") {
    return (
      <Html>
        <Head />
        <Preview>Your Monthly Financial Report</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            <Heading style={styles.title}>📊 Monthly Financial Report</Heading>

            <Text style={styles.text}>Hello {userName},</Text>
            <Text style={styles.text}>
              Here’s your financial summary for <strong>{data?.month}</strong>:
            </Text>

            {/* Main Stats */}
            <Section style={styles.statsContainer}>
              <div style={styles.stat}>
                <Text style={styles.label}>Total Income</Text>
                <Text style={styles.value}>${data?.stats.totalIncome}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.label}>Total Expenses</Text>
                <Text style={styles.value}>${data?.stats.totalExpenses}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.label}>Net Balance</Text>
                <Text
                  style={{
                    ...styles.value,
                    color:
                      data?.stats.totalIncome - data?.stats.totalExpenses < 0
                        ? "#E74C3C"
                        : "#2ECC71",
                  }}
                >
                  ${data?.stats.totalIncome - data?.stats.totalExpenses}
                </Text>
              </div>
            </Section>

            {/* Category Breakdown */}
            {data?.stats?.byCategory && (
              <Section style={styles.section}>
                <Heading style={styles.sectionTitle}>💰 Expenses by Category</Heading>
                <div style={styles.categoryContainer}>
                  {Object.entries(data?.stats.byCategory).map(
                    ([category, amount]) => (
                      <div key={category} style={styles.row}>
                        <Text style={styles.category}>{category}</Text>
                        <Text style={styles.categoryAmount}>${amount}</Text>
                      </div>
                    )
                  )}
                </div>
              </Section>
            )}

            {/* AI Insights */}
            {data?.insights && (
              <Section style={styles.section}>
                <Heading style={styles.sectionTitle}>💡 Welth Insights</Heading>
                {data.insights.map((insight, index) => (
                  <Text key={index} style={styles.insight}>
                    • {insight}
                  </Text>
                ))}
              </Section>
            )}

            <Text style={styles.footer}>
              Thank you for using Welth. Keep tracking your finances for better
              financial health! 🚀
            </Text>
          </Container>
        </Body>
      </Html>
    );
  }

  if (type === "budget-alert") {
    return (
      <Html>
        <Head />
        <Preview>Your Budget Usage Alert 🚨</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            {/* Header Section */}
            <Section style={styles.header}>
              <Heading style={styles.title}>📊 Budget Alert</Heading>
            </Section>

            {/* Main Message */}
            <Text style={styles.text}>
              Hello <strong>{userName}</strong>,
            </Text>
            <Text style={styles.text}>
              You have used{" "}
              <span style={styles.highlight}>
                {data?.percentageUsed?.toFixed(1) ?? "0"}%
              </span>{" "}
              of your monthly budget.
            </Text>

            {/* Budget Summary */}
            <Section style={styles.statsContainer}>
              <div style={styles.stat}>
                <Text style={styles.label}>Budget Amount</Text>
                <Text style={styles.value}>₹{data?.budgetAmount}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.label}>Spent So Far</Text>
                <Text style={styles.value}>₹{data?.totalExpenses}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.label}>Remaining</Text>
                <Text style={{ ...styles.value, color: "#2ECC71" }}>
                  ₹{data?.budgetAmount - data?.totalExpenses}
                </Text>
              </div>
            </Section>

            {/* Action Button */}
            <Section style={styles.buttonContainer}>
              <Button style={styles.button} href="/dashboard">
                Review Your Budget
              </Button>
            </Section>

            {/* Footer */}
            <Section style={styles.footer}>
              <Text style={styles.footerText}>
                Manage your budget wisely and stay in control! 🚀
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    );
  }
}

const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    padding: "20px",
  },
  container: {
    backgroundColor: "#ffffff",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
    maxWidth: "500px",
    margin: "auto",
  },
  title: {
    fontSize: "22px",
    fontWeight: "bold",
    color: "#007bff",
    textAlign: "center",
    marginBottom: "20px",
  },
  text: {
    fontSize: "16px",
    color: "#444",
    lineHeight: "1.6",
    margin: "10px 0",
  },
  highlight: {
    fontWeight: "bold",
    color: "#FF5733",
  },
  statsContainer: {
    display: "flex",
    justifyContent: "space-between",
    backgroundColor: "#f1f1f1",
    padding: "15px",
    borderRadius: "8px",
    marginTop: "15px",
  },
  stat: {
    textAlign: "center",
    flex: 1,
  },
  label: {
    fontSize: "14px",
    color: "#777",
    fontWeight: "bold",
  },
  value: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#333",
  },
  section: {
    marginTop: "20px",
    padding: "10px",
    backgroundColor: "#fafafa",
    borderRadius: "8px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "10px",
    color: "#333",
  },
  categoryContainer: {
    padding: "10px",
    backgroundColor: "#f1f1f1",
    borderRadius: "6px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px solid #ddd",
    padding: "5px 0",
  },
  category: {
    fontSize: "16px",
    color: "#333",
  },
  categoryAmount: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#E74C3C",
  },
  insight: {
    fontSize: "16px",
    color: "#555",
    marginLeft: "15px",
  },
  buttonContainer: {
    textAlign: "center",
    marginTop: "20px",
  },
  button: {
    backgroundColor: "#007bff",
    color: "#ffffff",
    padding: "12px 20px",
    borderRadius: "6px",
    textDecoration: "none",
    fontSize: "16px",
    fontWeight: "bold",
  },
  footer: {
    textAlign: "center",
    marginTop: "15px",
    padding: "10px",
    fontSize: "14px",
    color: "#888",
  },
};

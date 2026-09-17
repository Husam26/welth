'use client';

import { endOfDay, format, startOfDay, subDays } from 'date-fns';
import { BarChart, Bar, CartesianGrid, Legend, Rectangle, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import React, { useMemo, useState } from 'react';

const DATE_RANGES = {
    "7D": { label: "Last 7 Days", days: 7 },
    "1M": { label: "Last Month", days: 30 },
    "3M": { label: "Last 3 Months", days: 90 },
    "6M": { label: "Last 6 Months", days: 180 },
    ALL: { label: "All Time", days: null },
};

const AccountChart = ({ transactions }) => {
    const [dateRange, setDateRange] = useState("1M");

    const filteredData = useMemo(() => {
        const range = DATE_RANGES[dateRange];
        const now = new Date();
        const startDate = range.days ? startOfDay(subDays(now, range.days)) : startOfDay(new Date(0));

        // Filter transactions within the date range
        const filtered = transactions.filter(
            (t) => new Date(t.date) >= startDate && new Date(t.date) <= endOfDay(now)
        );

        const grouped = filtered.reduce((acc, transaction) => {
            const date = format(new Date(transaction.date), "MMM dd");

            if (!acc[date]) {
                acc[date] = { date, income: 0, expense: 0 };
            }

            if (transaction.type === "INCOME") {
                acc[date].income += transaction.amount;
            } else {
                acc[date].expense += transaction.amount;
            }

            return acc;
        }, {});

        // Convert to array and sort by date
        return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [transactions, dateRange]);

    const totals = useMemo(() => {
        return filteredData.reduce(
            (acc, day) => ({
                income: acc.income + day.income,
                expense: acc.expense + day.expense,
            }),
            { income: 0, expense: 0 }
        );
    }, [filteredData]);

    // Custom Tooltip content
    const CustomTooltip = ({ payload, label }) => {
        if (!payload || payload.length === 0) return null;

        const income = payload[0]?.value || 0;
        const expense = payload[1]?.value || 0;

        return (
            <div className="rounded-md border border-border bg-popover p-2 shadow-sm">
                <p className="text-sm text-foreground">{label}</p>
                <p className="text-sm text-positive nums">Income: ₹{income.toFixed(2)}</p>
                <p className="text-sm text-negative nums">Expense: ₹{expense.toFixed(2)}</p>
            </div>
        );
    };

    return (
        <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Account Activity</h2>
                <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                    {Object.entries(DATE_RANGES).map(([key, { label }]) => (
                        <option key={key} value={key} className="text-sm">
                            {label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={300}>
                <BarChart
                    data={filteredData}
                    margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--muted-foreground)' }} />
                    <YAxis tick={{ fill: 'var(--muted-foreground)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar
                        dataKey="income"
                        fill="var(--positive)"
                        radius={[6, 6, 0, 0]}
                        activeBar={<Rectangle fill="var(--positive)" fillOpacity={0.8} />}
                    />
                    <Bar
                        dataKey="expense"
                        fill="var(--negative)"
                        radius={[6, 6, 0, 0]}
                        activeBar={<Rectangle fill="var(--negative)" fillOpacity={0.8} />}
                    />
                </BarChart>
            </ResponsiveContainer>

            {/* Total Income & Expense Display */}
            <div className="mt-4 flex justify-between text-sm font-medium">
                <span className="text-positive nums">
                    Total Income: ₹{totals.income.toFixed(2)}
                </span>
                <span className="text-negative nums">
                    Total Expense: ₹{totals.expense.toFixed(2)}
                </span>
            </div>
        </div>
    );
};

export default AccountChart;

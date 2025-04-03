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
            <div className="bg-white p-2 rounded shadow-md">
                <p className="text-sm text-gray-700">{label}</p>
                <p className="text-sm text-green-600">Income: ₹{income.toFixed(2)}</p>
                <p className="text-sm text-red-600">Expense: ₹{expense.toFixed(2)}</p>
            </div>
        );
    };

    return (
        <div className="p-6 bg-gradient-to-t from-indigo-50 to-indigo-100 rounded-xl shadow-xl space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800">Account Transactions</h2>

            {/* Dropdown for date range selection */}
            <div className="flex justify-between items-center mb-4">
                <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="p-3 rounded-lg text-gray-800 bg-white border border-gray-300 shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fill: '#4B5563' }} />
                    <YAxis tick={{ fill: '#4B5563' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar
                        dataKey="income"
                        fill="#34D399"
                        radius={[8, 8, 0, 0]}
                        activeBar={<Rectangle fill="lightgreen" stroke="green" />}
                    />
                    <Bar
                        dataKey="expense"
                        fill="#F87171"
                        radius={[8, 8, 0, 0]}
                        activeBar={<Rectangle fill="red" stroke="darkred" />}
                    />
                </BarChart>
            </ResponsiveContainer>

            {/* Total Income & Expense Display */}
            <div className="mt-4 flex justify-between text-lg font-semibold text-gray-700">
                <span className="text-green-600">
                    Total Income: ₹{totals.income.toFixed(2)}
                </span>
                <span className="text-red-600">
                    Total Expense: ₹{totals.expense.toFixed(2)}
                </span>
            </div>
        </div>
    );
};

export default AccountChart;

# 💰 Welth — AI-Powered Personal Finance Management Platform

Welth is a full-stack, AI-powered personal finance platform that helps users **track spending, scan receipts, manage budgets, and receive intelligent monthly insights** — all in one place.

Built as a final-year major project, it combines a modern web stack with practical AI, background job processing, and production-grade security.

---

## ✨ Features

- 🔐 **Authentication** — Secure sign-in/sign-up and protected routes via Clerk.
- 🏦 **Multi-account management** — Create multiple accounts, set a default, and track balances.
- 💸 **Transaction management** — Full CRUD with atomic balance reconciliation.
- 🧾 **AI receipt scanning** — Upload a receipt and Google Gemini extracts the amount, date, merchant, description, and category automatically.
- 🔁 **Recurring transactions** — Daily / weekly / monthly / yearly transactions processed automatically via scheduled jobs.
- 📊 **Budgets & alerts** — Set a monthly budget and get email alerts when you cross 80% usage.
- 🤖 **AI monthly reports** — Gemini generates personalized, actionable financial insights emailed every month.
- 📈 **Dashboards & charts** — Recharts-powered income/expense and category breakdown visualizations.
- 🛡️ **Rate limiting & bot protection** — Arcjet shields sensitive actions from abuse.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui, Framer Motion, Recharts |
| Backend | Next.js Server Actions, Prisma ORM, PostgreSQL |
| Auth | Clerk |
| AI | Google Gemini 1.5 Flash (receipt scanning + insights) |
| Background Jobs | Inngest (cron + event-driven functions) |
| Email | Resend + React Email |
| Security | Arcjet (rate limiting, bot detection, shield) |

---

## 🚀 Getting Started

### 1. Clone & install

```bash
git clone <your-repo-url>
cd welth
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Google Gemini
GEMINI_API_KEY="..."

# Resend (email)
RESEND_API_KEY="..."

# Arcjet (security)
ARCJET_KEY="..."
```

### 3. Set up the database

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To preview email templates locally:

```bash
npm run email
```

---

## ⚙️ Background Jobs (Inngest)

Welth uses [Inngest](https://www.inngest.com/) for scheduled and event-driven work:

| Function | Trigger | Purpose |
|---|---|---|
| `checkBudgetAlert` | Every 6 hours | Emails users who cross 80% of their monthly budget |
| `triggerRecurringTransactions` | Daily at midnight | Finds due recurring transactions and fans out events |
| `processRecurringTransaction` | On event (throttled per user) | Creates the next occurrence and updates the balance |
| `generateMonthlyReports` | 1st of each month | Generates AI insights and emails a monthly report |

Run the Inngest dev server alongside the app to test these locally.

---

## 📁 Project Structure

```
app/                 # Next.js App Router (routes, pages, layouts)
  (auth)/            # Clerk sign-in / sign-up
  (main)/            # Authenticated app (dashboard, accounts, transactions)
  api/               # Inngest + seed route handlers
actions/             # Server Actions (transactions, accounts, budget, email, seed)
components/          # Shared UI components
data/                # Static data (categories, landing content)
emails/              # React Email templates
hooks/               # Custom React hooks (useFetch)
lib/                 # Prisma client, Arcjet, Inngest, currency & serialize utils
prisma/              # Prisma schema
```

---

## 💱 Currency

Welth uses the **Indian Rupee (₹ / INR)** throughout. Formatting is centralized in `lib/currency.js`.

---

## 👤 Author

Built with ❤️ by **Husamuddin** as a final-year major project.

# 🚀 Welth — Phase 2 Implementation Plan

> **Status:** Awaiting approval to begin **Step 1**.
> **Scope:** Per-Category Budgets · Anomaly Detection & Forecasting · Welth Agent (Agentic AI) · Financial Digital Twin (Monte Carlo) · (Bonus) NLP Voice/Text Logging.
> **Guiding rule:** every feature reuses the existing patterns — Server Actions, Prisma `$transaction`, Inngest jobs, Arcjet, Clerk, Gemini, Recharts — so nothing is bolted on.

---

## Table of Contents
1. [Goals & Design Principles](#1-goals--design-principles)
2. [Current Architecture Recap](#2-current-architecture-recap)
3. [Target Architecture (High Level)](#3-target-architecture-high-level)
4. [Consolidated Data Model Changes (Prisma)](#4-consolidated-data-model-changes-prisma)
5. [Step 0 — Foundation & Scaffolding](#step-0--foundation--scaffolding)
6. [Step 1 — Per-Category Budgets](#step-1--per-category-budgets)
7. [Step 2 — Anomaly Detection & Forecasting](#step-2--anomaly-detection--forecasting)
8. [Step 3 — Financial Digital Twin (Monte Carlo)](#step-3--financial-digital-twin-monte-carlo)
9. [Step 4 — Welth Agent (Agentic AI)](#step-4--welth-agent-agentic-ai)
10. [Step 5 — (Bonus) NLP Voice/Text Logging](#step-5--bonus-nlp-voicetext-logging)
11. [Step 6 — (Optional) Testing & CI/CD](#step-6--optional-testing--cicd)
12. [Recommended Execution Order & Dependency Graph](#12-recommended-execution-order--dependency-graph)
13. [Environment Variables & Dependencies](#13-environment-variables--dependencies)
14. [Cross-Cutting Concerns](#14-cross-cutting-concerns)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Viva / Examiner Talking-Point Map](#16-viva--examiner-talking-point-map)

---

## 1. Goals & Design Principles

- **Defensibility over flash.** Every "AI/ML" claim must be backed by an actual algorithm you can explain (statistics, Monte Carlo, function-calling loop) — not just a prompt.
- **Reuse the existing spine.** Server Actions for reads/mutations, Inngest for anything slow/scheduled/parallel, Gemini for language, Recharts for viz.
- **Security by default.** The AI agent never trusts model-supplied identity — `userId` always comes from the Clerk session; every tool handler re-checks ownership; mutations require human confirmation.
- **Incremental & shippable.** Each step ends in a demoable state with acceptance criteria. The build order is dependency-aware so the Agent (which orchestrates the other features) is built once its tools exist.

---

## 2. Current Architecture Recap

| Concern | Where it lives today |
|---|---|
| Server Actions | `actions/*.js` (`transaction`, `accounts`, `dashboard`, `budget`, `send-email`, `seed`) |
| DB / ORM | `lib/prisma.js` + `prisma/schema.prisma` (User, Account, Transaction, Budget) |
| Background jobs | `lib/inngest/functions.js`, client in `lib/inngest/client.js` (`id: "welth"`), served at `app/api/inngest/route.js` |
| AI | `@google/generative-ai` (Gemini 1.5 Flash) used in `actions/transaction.js` (receipt scan) and `lib/inngest/functions.js` (insights) |
| Auth | Clerk via `middleware.js` — protects `/dashboard`, `/account`, `/transaction` |
| Security | Arcjet token bucket in `lib/arcjet.js`; shield + bot detection in `middleware.js` |
| Shared utils (new in Phase 1) | `lib/currency.js` (INR formatting), `lib/serialize.js` (Decimal → number) |
| Categories | `data/categories.js` — category **id** strings (e.g. `"food"`) are what Transactions store in `category` |

**Integration gotchas to remember for every new route:**
- New authenticated pages (`/budgets`, `/insights`, `/simulations`, `/agent`) **must be added to `isProtectedRoute` in `middleware.js`.**
- New Inngest functions **must be registered in `app/api/inngest/route.js`.**
- Any inbound webhook (Telegram, Step 5) must be **excluded from Clerk protection and Arcjet bot detection** (use a secret path segment + signature check).

---

## 3. Target Architecture (High Level)

```
                         ┌──────────────────────────────────────────────┐
                         │                Next.js App                    │
                         │                                              │
  Browser / Voice ─────► │  Pages: /dashboard /budgets /insights        │
  WhatsApp/Telegram ──┐  │         /simulations /agent                  │
                      │  │                                              │
                      │  │  Server Actions ──► Prisma ──► PostgreSQL     │
                      │  │        │                                      │
                      │  │        ├─► Gemini (scan / NLP / agent tools)  │
                      │  │        └─► inngest.send(event)                │
                      │  └───────────────────┬──────────────────────────┘
                      │                       │ events
                      ▼                       ▼
              /api/telegram          ┌───────────────────────────┐
              (webhook)              │        Inngest             │
                                     │  • checkBudgetAlerts (v2)  │
                                     │  • detectAnomalies         │
                                     │  • generateForecasts       │
                                     │  • runSimulation (fan-out) │
                                     │  • processMessage (NLP)    │
                                     └───────────────────────────┘
```

The **Welth Agent** sits on top: a Gemini function-calling loop whose "tools" are thin wrappers around the Server Actions built in Steps 1–3.

---

## 4. Consolidated Data Model Changes (Prisma)

All new models in one place (added to `prisma/schema.prisma`). Money fields stay `Decimal` and are serialized with `lib/serialize.js` before crossing to the client.

```prisma
// ─────────────── User relations to add ───────────────
// (append these lines inside the existing `model User { ... }`)
//   categoryBudgets CategoryBudget[]
//   anomalies       Anomaly[]
//   forecasts       ExpenseForecast[]
//   simulations     Simulation[]
//   conversations   Conversation[]
//   agentActions    AgentAction[]
//   messagingLink   MessagingLink?

// ═══════════ STEP 1: PER-CATEGORY BUDGETS ═══════════
model CategoryBudget {
  id            String       @id @default(uuid())
  category      String       // category id from data/categories.js, e.g. "food"
  amount        Decimal
  period        BudgetPeriod @default(MONTHLY)
  lastAlertSent DateTime?
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@unique([userId, category])   // one budget per category per user
  @@index([userId])
  @@map("category_budgets")
}

enum BudgetPeriod { WEEKLY MONTHLY YEARLY }

// ═══════════ STEP 2: ANOMALIES & FORECASTS ═══════════
model Anomaly {
  id            String          @id @default(uuid())
  userId        String
  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactionId String?
  category      String?
  type          AnomalyType
  severity      AnomalySeverity @default(MEDIUM)
  score         Decimal         // modified z-score / deviation magnitude
  message       String
  metadata      Json?           // { mean, stdDev/MAD, observed, threshold }
  isRead        Boolean         @default(false)
  detectedAt    DateTime        @default(now())

  @@index([userId, detectedAt])
  @@map("anomalies")
}

enum AnomalyType {
  AMOUNT_SPIKE      // single transaction far above category norm
  CATEGORY_SURGE    // weekly category total far above trailing weeks
  NEW_MERCHANT      // first-seen merchant with large amount
  FREQUENCY_SPIKE   // unusually many transactions in a window
  BUDGET_OVERRUN    // category budget exceeded / pace to exceed
  DUPLICATE_CHARGE  // same amount+merchant within 48h
}

enum AnomalySeverity { LOW MEDIUM HIGH }

model ExpenseForecast {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  month      DateTime // first day of forecasted month
  category   String?  // null = overall
  predicted  Decimal
  lowerBound Decimal
  upperBound Decimal
  method     String   // "EWMA" | "HOLT" | "LINEAR"
  createdAt  DateTime @default(now())

  @@unique([userId, month, category])
  @@index([userId])
  @@map("expense_forecasts")
}

// ═══════════ STEP 3: FINANCIAL DIGITAL TWIN ═══════════
model Simulation {
  id            String            @id @default(uuid())
  userId        String
  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  scenario      Json              // { startingBalance, shocks: [...] }
  status        SimulationStatus  @default(PENDING)
  iterations    Int               @default(1000)
  horizonMonths Int               @default(12)
  results       Json?             // { trajectories: percentile bands, probInsolvency, medianEndBalance }
  error         String?
  createdAt     DateTime          @default(now())
  completedAt   DateTime?
  batches       SimulationBatch[]

  @@index([userId])
  @@map("simulations")
}

model SimulationBatch {
  id           String     @id @default(uuid())
  simulationId String
  simulation   Simulation @relation(fields: [simulationId], references: [id], onDelete: Cascade)
  batchIndex   Int
  iterations   Int
  partial      Json       // per-month aggregates (sums / sums-of-squares / min-balance counts)
  createdAt    DateTime   @default(now())

  @@unique([simulationId, batchIndex])
  @@index([simulationId])
  @@map("simulation_batches")
}

enum SimulationStatus { PENDING RUNNING COMPLETED FAILED }

// ═══════════ STEP 4: WELTH AGENT ═══════════
model Conversation {
  id        String        @id @default(uuid())
  userId    String
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String        @default("New conversation")
  messages  Message[]
  actions   AgentAction[]
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@index([userId])
  @@map("conversations")
}

model Message {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           MessageRole
  content        String       @db.Text
  toolCalls      Json?        // function calls the model requested
  toolResults    Json?        // results fed back to the model
  createdAt      DateTime     @default(now())

  @@index([conversationId])
  @@map("messages")
}

enum MessageRole { USER ASSISTANT SYSTEM TOOL }

model AgentAction {
  id             String        @id @default(uuid())
  userId         String
  user           User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversationId String?
  conversation   Conversation? @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  tool           String
  args           Json
  result         Json?
  status         ActionStatus  @default(PROPOSED)
  createdAt      DateTime      @default(now())
  executedAt     DateTime?

  @@index([userId])
  @@map("agent_actions")
}

enum ActionStatus { PROPOSED CONFIRMED EXECUTED REJECTED FAILED }

// ═══════════ STEP 5 (BONUS): MESSAGING LINK ═══════════
model MessagingLink {
  id         String   @id @default(uuid())
  userId     String   @unique
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider   String   // "telegram" | "whatsapp"
  externalId String   // chat id
  linkedAt   DateTime @default(now())

  @@unique([provider, externalId])
  @@map("messaging_links")
}
```

**Migration strategy:** one migration per step to keep history readable, e.g.
`npx prisma migrate dev --name category_budgets`, `--name anomalies_forecasts`, `--name digital_twin`, `--name welth_agent`, `--name messaging`.
The existing global `Budget` model is **kept** (acts as an optional overall monthly cap); per-category budgets are additive, so no destructive migration.

---

## Step 0 — Foundation & Scaffolding

**Goal:** land the shared plumbing every later step depends on, in one clean pass.

**Tasks**
1. Add all Prisma models from §4 (or add them per-step; see migration strategy). Run the first migration.
2. Create a **shared statistics library** `lib/stats.js` (pure, unit-testable functions):
   - `mean`, `stdDev`, `median`, `mad` (median absolute deviation)
   - `modifiedZScore(x, median, mad)` → `0.6745 * (x - median) / mad`
   - `ewma(series, alpha)` and `holtLinear(series, alpha, beta)` for forecasting
   - `percentile(sortedArray, p)`
   - `sampleFromEmpirical(series)` (bootstrap) and `sampleLogNormal(mu, sigma)`
   - A tiny seeded PRNG (e.g. mulberry32) so simulations are reproducible.
3. Extend `lib/currency.js` if needed (compact formatting for chart axes, e.g. `₹1.2L`).
4. Add nav entries to `components/Header.jsx` for the new pages (behind auth).
5. Update `middleware.js` `isProtectedRoute` to include `/budgets(.*)`, `/insights(.*)`, `/simulations(.*)`, `/agent(.*)`.

**Acceptance:** `npx prisma migrate dev` succeeds, `npm run build` passes, `lib/stats.js` exports the functions above with a couple of sanity asserts.

---

## Step 1 — Per-Category Budgets

**Why first:** directly fixes the documented weakness ("budget too simplistic"); becomes a data source for anomalies (BUDGET_OVERRUN) and an Agent tool.

### Data model
`CategoryBudget` (see §4). One row per `(userId, category)`.

### Server Actions — `actions/category-budget.js` (`"use server"`)
| Action | Signature | Notes |
|---|---|---|
| `getCategoryBudgets()` | → `CategoryBudget[]` (serialized) | current user's budgets |
| `upsertCategoryBudget(data)` | `{ category, amount, period }` | Zod-validated; `upsert` on `(userId, category)` |
| `deleteCategoryBudget(category)` | | ownership re-checked |
| `getBudgetOverview()` | → `[{ category, budget, spent, remaining, pct, status }]` | joins budgets with current-period expense aggregates per category |
| `suggestCategoryBudgets()` | → suggestions | average of last 3 months' spend per category (server-side compute) |

- **Validation:** reuse the Zod pattern from Phase 1 (`safeParse`, throw first error). `amount > 0`, `category ∈ known ids`, `period ∈ enum`.
- **Serialization:** `serializeDecimal` on every returned row.

### Inngest — extend `checkBudgetAlert`
- After the existing global-budget check, iterate the user's `CategoryBudget[]`, aggregate current-month expenses per category, and email a **BUDGET_OVERRUN** alert at ≥ 80% (respecting `lastAlertSent` per category, same "new month" guard already in the file). Reuse `EmailTemplate` with a new `type: "category-budget-alert"` branch.

### UI
- New page **`/budgets`** (or a dashboard tab): a grid of category cards, each with a Recharts mini progress bar (green/amber/red like `budget-progress.jsx`), inline edit, and a "Suggest budgets" button that calls `suggestCategoryBudgets()`.
- A category pie/bar comparing **budgeted vs actual** for the month.

### Acceptance criteria
- Create/edit/delete a category budget; values persist and survive reload.
- Overview shows correct spent/remaining/pct per category for the current month.
- Crossing 80% triggers an email in the Inngest dev server.
- `npm run build` + lint clean.

### Viva angle
"Per-category budgeting with smart suggestions derived from the user's own 3-month spending baseline."

---

## Step 2 — Anomaly Detection & Forecasting

**Why now:** turns raw transactions into an ML/statistics story; consumes Step 1 budgets; feeds the Agent and dashboard.

### The algorithms (all in `lib/stats.js`, explainable)
1. **Amount spike (per transaction):** build a per-category baseline from the last 90 days. Use the **robust modified z-score** (median + MAD) rather than mean/σ so a few big outliers don't hide the next one. Flag if `|modifiedZ| > 3.5`. Severity scales with the score.
2. **Category surge (weekly):** compare this week's category total against the trailing 8-week mean ± σ. Flag if it exceeds `mean + 2σ` → message like *"You spent 3.1× your usual on Food this week."*
3. **New merchant / large first charge:** merchant (description) never seen before **and** amount above the category median → flag.
4. **Frequency spike:** transaction count in a rolling window vs baseline count.
5. **Duplicate charge:** same amount + merchant within 48h.
6. **Budget overrun / pace:** from Step 1 — project month-end spend by linear pace; flag if projected > budget.

### Forecasting (`ExpenseForecast`)
- Aggregate monthly totals per category → apply **EWMA** (level) and **Holt's linear** (level + trend). Confidence band = prediction ± `z * residualStdDev`.
- Persist next-month predictions per category + overall; label with `method`.

### Server Actions — `actions/insights.js`
- `getAnomalies({ unreadOnly })`, `markAnomalyRead(id)`
- `getForecasts()` → next-month predictions with bands
- `runAnomalyScan()` → manual trigger (also used for demos)

### Inngest
- **`detectAnomalies`** — cron (e.g. daily `0 2 * * *`) + also fired as an event `transaction.created` for near-real-time flags. Loads recent history, runs the six detectors, **dedupes** against existing unread anomalies, persists new ones, optionally emails HIGH severity.
- **`generateForecasts`** — monthly cron (or on-demand); writes `ExpenseForecast` rows.
- Fire `transaction.created` from `createTransaction` via `inngest.send(...)` (non-blocking) so new transactions get scanned without slowing the request.

### UI
- **`/insights`** page: an **Anomaly feed** (severity-colored cards, mark-as-read) + a **forecast chart** (Recharts line with a shaded confidence band: predicted vs a dotted projection, historical actuals behind it).
- A dashboard badge showing unread HIGH anomalies.

### Acceptance criteria
- Seeded/known outliers get flagged with sensible messages and severities.
- No duplicate anomalies on repeated scans (dedupe works).
- Forecast chart renders predicted next-month spend with a band.
- Real-time flag appears shortly after creating an obviously anomalous transaction.

### Viva angle
"Robust statistical anomaly detection (median/MAD modified z-score) + exponential-smoothing/Holt forecasting — real data science, fully explainable, no black box."

---

## Step 3 — Financial Digital Twin (Monte Carlo)

**Why now:** the headline ML + distributed-systems feature; also becomes the Agent's most impressive tool.

### The model
- **Fit distributions from history:**
  - Monthly **income** total → empirical bootstrap (or lognormal fit `μ, σ`).
  - Monthly **expense per category** → same.
- **Scenario shocks** (`scenario.shocks`), e.g.:
  - `JOB_LOSS` → income = 0 for months `[a, b]`
  - `BIG_PURCHASE` → one-time expense at month `k`
  - `NEW_LOAN` → recurring EMI added for `n` months
  - `INCOME_CHANGE` / `EXPENSE_INFLATION` → scale factors
- **One iteration:** for each month `h` in `1..horizon`, sample income & per-category expenses, apply shocks, update `balance_h = balance_{h-1} + income_h − Σ expenses_h`. Record the whole trajectory + whether balance ever went `< 0`.
- **Aggregate across N iterations:** per month compute p5/p10/p25/p50/p75/p90/p95 and mean; overall compute `probInsolvency` (fraction of iterations whose min balance < 0) and `medianEndBalance`.
- **Reproducibility:** seed the PRNG from `simulationId` so results are stable/debuggable.

### Distributed execution via Inngest (the showcase)
Two patterns — build **A** first, mention **B** as the scaling story:

**Pattern A — parallel steps in one function (MVP):**
```js
// event: "simulation.requested" { simulationId }
export const runSimulation = inngest.createFunction(
  { id: "run-simulation" },
  { event: "simulation.requested" },
  async ({ event, step }) => {
    const sim = await step.run("load", () => loadSimAndHistory(event.data.simulationId));
    const BATCHES = 10;                 // 10 × (iterations/10) trajectories
    // Inngest runs Promise.all steps in parallel:
    const partials = await Promise.all(
      Array.from({ length: BATCHES }, (_, i) =>
        step.run(`batch-${i}`, () => simulateBatch(sim, i, sim.iterations / BATCHES))
      )
    );
    const results = await step.run("aggregate", () => aggregate(partials, sim));
    await step.run("save", () => persistResults(sim.id, results)); // status = COMPLETED
  }
);
```

**Pattern B — event fan-out + aggregator (horizontal scale):**
`startSimulation` sends `BATCHES` × `simulation.batch.process` events → `processSimulationBatch` (throttled per user) writes a `SimulationBatch` row → when the count of batches equals `BATCHES`, an aggregator finalizes. This is the "true distributed systems" version to talk about.

### Server Actions — `actions/simulation.js`
- `createSimulation(scenario)` → inserts `Simulation(status=PENDING)`, `inngest.send("simulation.requested")`, returns id.
- `getSimulation(id)` → status + results (for polling/SSE).
- `listSimulations()`.

### UI
- **`/simulations`** page: a **scenario builder** (sliders/inputs for shocks, horizon, iterations) → creates the sim → shows a live status, then a **fan chart** (Recharts area bands p10–p90 around the p50 line) + KPI tiles (*probability of staying solvent*, *median balance at horizon*, *worst-case p5*).
- Poll `getSimulation` every ~2s, or push status via SSE.

### Acceptance criteria
- Submitting a scenario transitions PENDING → RUNNING → COMPLETED in the Inngest dev UI.
- Fan chart + metrics render; changing a shock (e.g., 3-month job loss) visibly worsens `probInsolvency`.
- Same scenario + seed → identical results (reproducible).

### Viva angle
"A probabilistic digital twin: distributions fit from real history, thousands of Monte Carlo trajectories computed in parallel across background workers, surfaced as percentile fan charts and insolvency probabilities."

---

## Step 4 — Welth Agent (Agentic AI)

**Why after 1–3:** the agent is most impressive when its tools *do real work*. Its read-only tools can ship right after Step 1; mutating/simulation tools are wired as those features land.

### Architecture — Gemini function-calling loop
```
User msg ─► build context (system prompt + compact financial summary + tool declarations)
        ─► model.generateContent / chat.sendMessage
        ─► response.functionCalls()?
              ├─ none  ─► final text answer ─► persist + return/stream
              └─ yes   ─► for each call:
                            read-only  → execute handler(args, sessionUserId) → functionResponse
                            mutating   → create AgentAction(PROPOSED) → PAUSE, ask UI to confirm
                     ─► send functionResponses back to model ─► loop (max 5 iterations)
```

### Tool registry — `lib/agent/tools.js`
Each tool = `{ declaration, handler, mutating }`. `declaration` uses `SchemaType` from `@google/generative-ai`.

| Tool | Mutating? | Backing action |
|---|---|---|
| `getSpendingSummary({ period, category? })` | no | dashboard/insights aggregates |
| `getBudgetStatus()` | no | `getBudgetOverview()` (Step 1) |
| `listAnomalies({ severity? })` | no | `getAnomalies()` (Step 2) |
| `predictExpenses({ category? })` | no | `getForecasts()` (Step 2) |
| `runFinancialSimulation({ shocks, horizonMonths })` | no* | `createSimulation()` (Step 3) — returns id; agent polls/reports |
| `setCategoryBudget({ category, amount })` | **yes** | `upsertCategoryBudget()` (Step 1) |
| `categorizeUncategorized()` | **yes** | Gemini-assisted bulk categorize |
| `createTransactionDraft({...})` | **yes** | prefill + confirm, then `createTransaction()` |

\* `runFinancialSimulation` only *starts* a job (no data mutation), so it can auto-run.

Example declaration:
```js
{
  name: "setCategoryBudget",
  description: "Set or update the user's monthly budget for a spending category.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      category: { type: SchemaType.STRING, description: "Category id, e.g. 'food'." },
      amount:   { type: SchemaType.NUMBER, description: "Monthly budget amount in INR." },
    },
    required: ["category", "amount"],
  },
}
```

### Safety model (critical, and a great viva point)
- **Identity never comes from the model.** Handlers receive `userId` from the Clerk session; model args carry only domain data. Every handler re-checks ownership (same pattern as Phase 1).
- **Human-in-the-loop for mutations.** Mutating tool calls are persisted as `AgentAction(PROPOSED)` and surfaced in the UI as a confirm/reject card; execution happens only on confirm, then status → `EXECUTED` (audit trail).
- **Guardrails:** max 5 tool iterations per turn; Arcjet rate-limit on the agent endpoint (reuse `lib/arcjet.js`); tool allowlist; token budget cap.
- **Context builder** summarizes finances compactly (totals, top categories, budget status, recent anomalies) to keep prompts small and grounded — a lightweight RAG-style grounding (upgradeable to `pgvector` later).

### Server surface — `app/api/agent/route.js` (POST) or `actions/agent.js`
- Non-streamed MVP: server action returns the final assistant message + any `PROPOSED` actions.
- Streamed v2: Route Handler returns an SSE/`ReadableStream` for the final answer; tool steps emit status chips.
- Persistence: `Conversation` / `Message` / `AgentAction`.

### UI
- **`/agent`** page or a global chat drawer: message bubbles, **tool-call chips** ("🔧 getBudgetStatus"), streaming answer, and **confirm/reject cards** for proposed mutations. Conversation list in a sidebar.

### Acceptance criteria
- "Am I on track this month?" → agent calls `getBudgetStatus` + `listAnomalies`, answers with real numbers.
- "Set my food budget to ₹8000" → produces a **PROPOSED** action; confirming persists it (verifiable in `/budgets`); rejecting does not.
- "What if I lose my job for 3 months?" → agent starts a simulation and reports `probInsolvency`.
- Loop terminates (never exceeds max iterations); every action is auditable in `AgentAction`.

### Viva angle
"An autonomous agent with tool-calling and human-in-the-loop safety — it reasons, invokes typed tools backed by real server actions, and never acts on money without confirmation."

---

## Step 5 — (Bonus) NLP Voice/Text Logging

**Goal:** log expenses from natural language, voice, or a chat app.

### Text parsing — `actions/nlp.js`
- `parseTransactionText(text)` → Gemini prompt (reuse the receipt-scan JSON-extraction pattern) mapping *"spent 250 on lunch at dominos"* → `{ amount, category, description, merchant, date }` (default date = today), returning a **draft** the user confirms before `createTransaction`.

### Voice
- Browser **Web Speech API** (`SpeechRecognition`) → transcript → `parseTransactionText`. On-device, no server cost. (Optional future: server Whisper for unsupported browsers.)

### Messaging webhook (distributed) — `app/api/telegram/<secret>/route.js`
- Telegram bot → webhook → verify secret/signature → `inngest.send("message.received")` → **`processMessage`** Inngest fn parses via Gemini, resolves the user via `MessagingLink`, creates the transaction, and replies.
- **Middleware:** this path must be **excluded from Clerk** and **Arcjet bot detection** (secret path segment + Telegram signature check; do not gate on Clerk session).
- **Linking flow:** user connects Telegram from settings; we store `MessagingLink(provider, externalId → userId)`.

### Acceptance criteria
- Typing/saying a natural sentence produces a correct, editable draft transaction.
- A Telegram message from a linked account creates a transaction and gets a confirmation reply.

### Viva angle
"Conversational, India-native expense capture: NLP parsing + voice + a chat-app webhook running through the distributed Inngest pipeline."

---

## Step 6 — (Optional) Testing & CI/CD

Recommended because it also closes deferred Phase-1 items #9/#13 and is cheap credibility.
- **Unit:** Jest on the pure functions in `lib/stats.js`, `lib/currency.js`, `lib/serialize.js`, and the Monte Carlo aggregator (deterministic via seeded PRNG).
- **Integration:** server actions against a test Postgres (or mocked Prisma).
- **E2E:** Playwright happy paths (create transaction, set budget, run simulation).
- **CI/CD:** GitHub Actions — `install → prisma generate → lint → build → test`; deploy preview on Vercel.

---

## 12. Recommended Execution Order & Dependency Graph

```
Step 0  Foundation/scaffolding (schema + lib/stats.js)
   │
   ▼
Step 1  Per-Category Budgets ───────────────┐
   │                                        │ (provides tools + BUDGET_OVERRUN signal)
   ▼                                        ▼
Step 2  Anomaly Detection & Forecasting     │
   │                                        │
   ▼                                        │
Step 3  Financial Digital Twin ─────────────┤ (provides runFinancialSimulation tool)
   │                                        │
   ▼                                        ▼
Step 4  Welth Agent  ◄──────────── wraps Steps 1–3 as tools
   │
   ▼
Step 5  (Bonus) NLP logging
   │
   ▼
Step 6  (Optional) Testing & CI/CD
```

**Note on your priority order:** you listed the Agent as #2. It's built in Step 4 here **only because it orchestrates the other features** — an agent is far more impressive when `getBudgetStatus`, `listAnomalies`, and `runFinancialSimulation` are real. If you want the "wow" earlier, we can ship an **Agent MVP with read-only tools right after Step 1**, then keep adding tools as Steps 2–3 land. Your call.

**Suggested milestones:** M1 = Steps 0–1, M2 = Step 2, M3 = Step 3, M4 = Step 4, M5 = Steps 5–6.

---

## 13. Environment Variables & Dependencies

**Already present (no new install needed for the core):** `@google/generative-ai`, `inngest`, `prisma`/`@prisma/client`, `zod`, `recharts`, `date-fns`, `@clerk/nextjs`, `@arcjet/next`, `resend`.

**New env vars**
```env
# Step 5 (bonus) only
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_WEBHOOK_SECRET="..."        # secret path segment / signature
```

**Optional dependencies**
- Step 6: `jest`, `@testing-library/react`, `@testing-library/jest-dom`, `jest-environment-jsdom`, `@playwright/test` (dev).
- Future RAG upgrade: `pgvector` Postgres extension + an embeddings call (no new npm dep required with the Gemini SDK).

_No heavy ML runtime is required_ — all statistics and Monte Carlo run in JS (`lib/stats.js`), which keeps the stack single-language and fully explainable. (An Isolation-Forest microservice is a possible future stretch, not needed for the plan.)

---

## 14. Cross-Cutting Concerns

- **Serialization:** every Server Action returning `Decimal` fields must pass through `lib/serialize.js` before reaching the client.
- **Currency:** all money rendering uses `lib/currency.js` (₹/INR) — no raw symbols.
- **Auth/ownership:** every new action starts with the Clerk `auth()` → `findUnique(user)` guard; the agent additionally re-checks ownership inside each tool handler.
- **Registration checklist per step:** register new Inngest functions in `app/api/inngest/route.js`; add protected pages to `middleware.js`; add nav links in `components/Header.jsx`.
- **Validation:** continue the Phase-1 Zod `safeParse` pattern on every mutating action.
- **Revalidation:** mutations call `revalidatePath` (use the `"page"` type for dynamic routes, per the Phase-1 fix).

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Sparse history → weak stats/forecasts | Require a minimum sample (e.g. ≥ 20 txns / ≥ 3 months); fall back to simpler heuristics + a clear "needs more data" state. Seed script already generates 90 days. |
| Gemini returns malformed tool args / bad JSON | Validate every tool arg with Zod before executing; on parse failure, return a structured error to the model and let it retry (bounded by max iterations). |
| Agent infinite tool loop | Hard cap of 5 iterations/turn + Arcjet rate limit + token budget. |
| Agent performs unwanted mutations | Human-in-the-loop confirmation for all mutating tools; full `AgentAction` audit trail; identity from session only. |
| Monte Carlo too slow / heavy in one request | Offload to Inngest, batch + parallelize, cap iterations (default 1000, max ~10k); reproducible seed for debugging. |
| Webhook abuse (Step 5) | Secret path + signature verification; exclude from Clerk but still verify provider signature; rate-limit. |
| Migration mistakes on money data | Additive migrations only (keep global `Budget`); test on a branch DB first. |

---

## 16. Viva / Examiner Talking-Point Map

| Examiner theme | Feature that proves it |
|---|---|
| **Agentic AI (2025–26 trend)** | Welth Agent: Gemini function-calling loop, typed tool registry, HITL safety, audit log |
| **Machine learning / data science** | Anomaly detection (robust modified z-score / MAD), EWMA & Holt forecasting, Monte Carlo digital twin |
| **Distributed systems** | Inngest fan-out for parallel simulations, event-driven anomaly scans, webhook→queue NLP pipeline |
| **Full-stack depth** | Server Actions, atomic Prisma transactions, Recharts dashboards, streaming UI |
| **Software engineering maturity** | Zod validation, error boundaries, testing + CI/CD, security (Arcjet, HITL, ownership checks) |
| **Real-world FinTech / domain** | Per-category budgeting, INR-native, conversational capture, insolvency-probability planning |

---

> **Next action:** review this plan and approve **Step 1 — Per-Category Budgets** (or tell me to reorder, e.g. stand up the Agent read-only MVP earlier). I will not write application code until you say go.

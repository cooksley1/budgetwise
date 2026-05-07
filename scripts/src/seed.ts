import { db, accountsTable, categoriesTable, transactionsTable, goalsTable, subscriptionsTable, budgetsTable } from "@workspace/db";

async function seed() {
  console.log("🌱 Seeding database...");

  // Categories
  const cats = await db.insert(categoriesTable).values([
    { name: "Salary", icon: "💼", color: "#10b981", type: "income" },
    { name: "Freelance", icon: "💻", color: "#06b6d4", type: "income" },
    { name: "Groceries", icon: "🛒", color: "#f59e0b", type: "expense" },
    { name: "Dining", icon: "🍽", color: "#ef4444", type: "expense" },
    { name: "Transport", icon: "🚗", color: "#3b82f6", type: "expense" },
    { name: "Utilities", icon: "💡", color: "#8b5cf6", type: "expense" },
    { name: "Entertainment", icon: "🎮", color: "#ec4899", type: "expense" },
    { name: "Health", icon: "❤️", color: "#14b8a6", type: "expense" },
    { name: "Shopping", icon: "🛍", color: "#f97316", type: "expense" },
    { name: "Rent", icon: "🏠", color: "#64748b", type: "expense" },
  ]).returning();

  console.log(`  ✓ ${cats.length} categories`);

  const catByName = Object.fromEntries(cats.map(c => [c.name, c]));

  // Accounts
  const accs = await db.insert(accountsTable).values([
    { name: "Main Checking", type: "checking", balance: 3842.50, color: "#10b981" },
    { name: "High-Yield Savings", type: "savings", balance: 12500.00, color: "#3b82f6" },
    { name: "Visa Credit", type: "credit", balance: -1240.80, color: "#ef4444" },
    { name: "Investment Portfolio", type: "investment", balance: 28650.00, color: "#8b5cf6" },
  ]).returning();

  console.log(`  ✓ ${accs.length} accounts`);

  const checking = accs[0];

  // Transactions — last 6 months
  const now = new Date();
  const txns = [];
  for (let m = 5; m >= 0; m--) {
    const yr = now.getFullYear();
    const mo = now.getMonth() - m;
    const monthStr = `${yr + Math.floor(mo / 12)}-${String(((mo % 12) + 12) % 12 + 1).padStart(2, "0")}`;

    txns.push(
      { accountId: checking.id, categoryId: catByName["Salary"].id, amount: 5200, type: "income", description: "Monthly salary", date: `${monthStr}-01`, isRecurring: true },
      { accountId: checking.id, categoryId: catByName["Rent"].id, amount: 1450, type: "expense", description: "Rent payment", date: `${monthStr}-02`, isRecurring: true },
      { accountId: checking.id, categoryId: catByName["Groceries"].id, amount: 320 + Math.random() * 60, type: "expense", description: "Weekly groceries", date: `${monthStr}-05`, isRecurring: false },
      { accountId: checking.id, categoryId: catByName["Dining"].id, amount: 85 + Math.random() * 40, type: "expense", description: "Restaurant dinner", date: `${monthStr}-08`, isRecurring: false },
      { accountId: checking.id, categoryId: catByName["Transport"].id, amount: 60 + Math.random() * 20, type: "expense", description: "Fuel & transport", date: `${monthStr}-10`, isRecurring: false },
      { accountId: checking.id, categoryId: catByName["Utilities"].id, amount: 140 + Math.random() * 30, type: "expense", description: "Electric & gas", date: `${monthStr}-12`, isRecurring: true },
      { accountId: checking.id, categoryId: catByName["Entertainment"].id, amount: 45 + Math.random() * 30, type: "expense", description: "Cinema & events", date: `${monthStr}-15`, isRecurring: false },
      { accountId: checking.id, categoryId: catByName["Groceries"].id, amount: 180 + Math.random() * 40, type: "expense", description: "Grocery top-up", date: `${monthStr}-18`, isRecurring: false },
      { accountId: checking.id, categoryId: catByName["Health"].id, amount: 30 + Math.random() * 20, type: "expense", description: "Pharmacy", date: `${monthStr}-20`, isRecurring: false },
      { accountId: checking.id, categoryId: catByName["Shopping"].id, amount: 120 + Math.random() * 80, type: "expense", description: "Online shopping", date: `${monthStr}-22`, isRecurring: false },
    );
    if (m === 2) {
      txns.push({ accountId: checking.id, categoryId: catByName["Freelance"].id, amount: 1800, type: "income", description: "Freelance project", date: `${monthStr}-14`, isRecurring: false });
    }
  }

  const insertedTxns = await db.insert(transactionsTable).values(
    txns.map(t => ({ ...t, amount: Math.round(t.amount * 100) / 100 }))
  ).returning();
  console.log(`  ✓ ${insertedTxns.length} transactions`);

  // Goals
  const goals = await db.insert(goalsTable).values([
    { name: "Emergency Fund", targetAmount: 15000, currentAmount: 8500, targetDate: "2025-12-31", icon: "🛡", color: "#10b981" },
    { name: "New Laptop", targetAmount: 2500, currentAmount: 1200, targetDate: "2025-09-01", icon: "💻", color: "#3b82f6" },
    { name: "Europe Trip", targetAmount: 5000, currentAmount: 2100, targetDate: "2026-06-01", icon: "✈️", color: "#8b5cf6" },
    { name: "Down Payment", targetAmount: 50000, currentAmount: 12500, targetDate: "2028-01-01", icon: "🏠", color: "#f59e0b" },
  ]).returning();
  console.log(`  ✓ ${goals.length} goals`);

  // Subscriptions
  const subs = await db.insert(subscriptionsTable).values([
    { name: "Netflix", amount: 15.99, billingCycle: "monthly", nextBillingDate: "2025-06-01", categoryId: catByName["Entertainment"].id, isActive: true, color: "#ef4444" },
    { name: "Spotify", amount: 9.99, billingCycle: "monthly", nextBillingDate: "2025-06-05", categoryId: catByName["Entertainment"].id, isActive: true, color: "#10b981" },
    { name: "GitHub Copilot", amount: 10.00, billingCycle: "monthly", nextBillingDate: "2025-06-10", categoryId: catByName["Freelance"].id, isActive: true, color: "#6366f1" },
    { name: "iCloud 200GB", amount: 2.99, billingCycle: "monthly", nextBillingDate: "2025-06-15", isActive: true, color: "#3b82f6" },
    { name: "Adobe CC", amount: 54.99, billingCycle: "monthly", nextBillingDate: "2025-06-20", isActive: false, color: "#ef4444" },
    { name: "Gym Membership", amount: 360, billingCycle: "annually", nextBillingDate: "2026-01-15", categoryId: catByName["Health"].id, isActive: true, color: "#f59e0b" },
  ]).returning();
  console.log(`  ✓ ${subs.length} subscriptions`);

  // Budgets for current month
  const yr = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const month = `${yr}-${mo}`;

  const budgets = await db.insert(budgetsTable).values([
    { categoryId: catByName["Groceries"].id, limitAmount: 600, month },
    { categoryId: catByName["Dining"].id, limitAmount: 200, month },
    { categoryId: catByName["Transport"].id, limitAmount: 150, month },
    { categoryId: catByName["Entertainment"].id, limitAmount: 100, month },
    { categoryId: catByName["Shopping"].id, limitAmount: 250, month },
    { categoryId: catByName["Utilities"].id, limitAmount: 200, month },
    { categoryId: catByName["Health"].id, limitAmount: 100, month },
  ]).returning();
  console.log(`  ✓ ${budgets.length} budgets`);

  console.log("✅ Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

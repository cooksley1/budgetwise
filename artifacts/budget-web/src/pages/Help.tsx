import { useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, ArrowLeft, ExternalLink, HelpCircle, BookOpen, Zap, Map, BarChart2, CreditCard, RefreshCw, Target, PieChart } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── FAQ ────────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: "Is my data private?",
    a: "Yes. Each account is scoped to your Wayfare login. No other user can see your accounts, transactions, or trackers. Data is stored in an encrypted PostgreSQL database.",
  },
  {
    q: "What currencies are supported?",
    a: "All major world currencies. If you paid in a different currency than your account's home currency, enter the original amount and currency when logging a transaction and Wayfare will record the exchange rate automatically.",
  },
  {
    q: "Can I import my bank statement?",
    a: "Yes. Go to Transactions, click Import, and upload a CSV file. Wayfare auto-detects columns for date, description, and amount. Supported banks include Monzo, Revolut, HSBC, Barclays, Chase, and most others that export standard CSV.",
  },
  {
    q: "How does receipt AI scanning work?",
    a: "On the Trip Trackers page, tap the camera icon on a tracker. Upload or snap a photo of your receipt. AI extracts the vendor name, line items, total amount, and date automatically, then creates a transaction linked to your tracker.",
  },
  {
    q: "What is a Trip Tracker?",
    a: "A Trip Tracker groups all spending on a specific trip into one place with a map, daily story timeline, and Insights tab. Insights surfaces things like which hour you spend most, DCC currency conversion fees you may have been charged, and tipping patterns.",
  },
  {
    q: "Does Wayfare connect to my bank directly?",
    a: "Yes, via Plaid (US and Canada) and GoCardless (Europe and UK). Go to Smart Features to link your bank. Direct linking imports transactions automatically. You can also import CSV statements at any time.",
  },
  {
    q: "What is a DCC fee and why does Wayfare warn me?",
    a: "Dynamic Currency Conversion (DCC) is when a foreign terminal charges you in your home currency instead of the local one. Banks typically add a 3% markup when this happens. Always choose to pay in the local currency at the terminal. Wayfare detects likely DCC transactions and warns you in the tracker Insights tab.",
  },
  {
    q: "How do I reset my password?",
    a: "On the sign-in page, enter your email address and click Continue. On the password screen, click 'Forgot password?' to receive a reset email. You can also sign in with Google or Apple if you set that up.",
  },
  {
    q: "Can I use Wayfare on mobile?",
    a: "Yes. The Wayfare mobile app is available alongside the web app. Both share the same account and data. The mobile app is optimised for logging expenses on the go.",
  },
  {
    q: "What is the connection to The Slow Travel Planner?",
    a: "Wayfare is a sibling product to The Slow Travel Planner. The Planner helps you plan your trip; Wayfare helps you live it by tracking what it actually costs day by day.",
  },
];

// ── Feature guide cards ────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: LayoutDashboardIcon,
    title: "Dashboard",
    link: "/",
    description: "A real-time snapshot of your finances: total balance across all accounts, monthly income and expenses, cash flow chart over the last six months, budget progress, and recent transactions.",
    tips: [
      "Add accounts first so your balance is accurate",
      "Budgets and recent transactions update in real time",
      "Cash flow shows the last six months of income vs. expenses",
    ],
  },
  {
    icon: TransactionsIcon,
    title: "Transactions",
    link: "/transactions",
    description: "Log every spend manually, import a bank statement CSV, or let AI extract details from a receipt photo. Each transaction can have a category, account, date, description, and optional foreign currency details.",
    tips: [
      "Use the Import button to upload a CSV bank statement",
      "Recurring transactions can be flagged as recurring for subscription tracking",
      "If you paid in EUR but your account is AUD, fill in the original currency and amount to record the exchange rate",
    ],
  },
  {
    icon: BudgetsIcon,
    title: "Budgets",
    link: "/budgets",
    description: "Set monthly spending limits by category. Wayfare shows how much you have spent and how much remains, with a progress bar that turns red when you are close to the limit.",
    tips: [
      "Budgets are set per category per month",
      "Spending is pulled automatically from your transactions",
      "Create a new budget each month or copy from a previous one",
    ],
  },
  {
    icon: GoalsIcon,
    title: "Goals",
    link: "/goals",
    description: "Create savings goals with a name, target amount, and optional target date. Track how far along you are and mark goals as complete when you reach them.",
    tips: [
      "Set a target date to see a projected daily saving amount",
      "Goals are independent of accounts — update the current amount manually or via transactions",
    ],
  },
  {
    icon: AccountsIcon,
    title: "Accounts",
    link: "/accounts",
    description: "Manage all your financial accounts in one place: checking, savings, credit cards, cash, and investment accounts. Each account has a currency, balance, and colour label.",
    tips: [
      "Add accounts in the currency they are held in",
      "Balances are updated manually or via bank linking",
      "Credit card accounts show negative balances when you owe money",
    ],
  },
  {
    icon: SubscriptionsIcon,
    title: "Subscriptions",
    link: "/subscriptions",
    description: "Track recurring payments like streaming services, rent, gym memberships, and software. Use the auto-detect feature to scan your transaction history for patterns that look like subscriptions.",
    tips: [
      "Use 'Detect subscriptions' to find recurring charges automatically",
      "Set billing cycle to weekly, monthly, quarterly, or annually",
      "Inactive subscriptions are kept for historical reference",
    ],
  },
  {
    icon: TrackersIcon,
    title: "Trip Trackers",
    link: "/trackers",
    description: "Create a tracker for each trip or theme. Every linked transaction drops a pin on a map, feeds a daily story timeline with weather and mood, and contributes to the Insights tab.",
    tips: [
      "Link transactions to a tracker manually or via auto-tagging rules",
      "Set a daily budget to see if you are on track",
      "Insights surfaces DCC fees, peak spend hour, top vendors, and spending velocity",
    ],
  },
  {
    icon: ReportsIcon,
    title: "Reports",
    link: "/reports",
    description: "Deep-dive into your spending patterns: category breakdown, cash flow, net worth over time, savings rate, and income vs. expense trends by month.",
    tips: [
      "Use the month picker to explore any past period",
      "Net worth is estimated from your account balances projected backwards",
      "Savings rate is calculated as (income - expenses) / income",
    ],
  },
];

function LayoutDashboardIcon() { return <span className="text-lg">📊</span>; }
function TransactionsIcon() { return <span className="text-lg">📝</span>; }
function BudgetsIcon() { return <span className="text-lg">🎯</span>; }
function GoalsIcon() { return <span className="text-lg">🏆</span>; }
function AccountsIcon() { return <span className="text-lg">💳</span>; }
function SubscriptionsIcon() { return <span className="text-lg">🔄</span>; }
function TrackersIcon() { return <span className="text-lg">🌍</span>; }
function ReportsIcon() { return <span className="text-lg">📈</span>; }

// ── Getting started steps ─────────────────────────────────────────────────────
const GETTING_STARTED = [
  { n: 1, title: "Create your account", body: "Sign up with Google, Apple, or email. It takes less than 30 seconds and no credit card is required.", link: null },
  { n: 2, title: "Log your first transaction", body: "Go to Transactions and click Add. Fill in the amount, type (expense or income), date, and description. Your default 'My Spend' tracker is created automatically on your first entry.", link: "/transactions" },
  { n: 3, title: "Import a bank statement (optional)", body: "Have a CSV, PDF, or XLSX statement? Go to Transactions, click Import, and drop your file. AI extracts every transaction automatically.", link: "/transactions" },
  { n: 4, title: "Link your bank accounts (optional)", body: "Go to Accounts to add your bank accounts, credit cards, or travel wallets. Link via Plaid or GoCardless for automatic sync, or just import statements manually.", link: "/accounts" },
  { n: 5, title: "Set a budget or create a tracker", body: "Set monthly spending limits in Budgets, or create a Trip Tracker for a specific journey — with a map, daily timeline, and spend insights.", link: "/budgets" },
];

// ── FAQ accordion item ─────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 px-1 text-left gap-3 hover:text-primary transition-colors"
      >
        <span className="text-sm font-medium text-foreground">{q}</span>
        <ChevronDown size={16} className={`flex-shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="pb-4 px-1">
          <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
        </motion.div>
      )}
    </div>
  );
}

export default function Help() {
  const { isSignedIn } = useUser();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={`${basePath}/logo.svg`} alt="Wayfare" className="w-7 h-7" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div className="flex items-center gap-2">
              <Link href="/">
                <span className="text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer">Wayfare</span>
              </Link>
              <ChevronRight size={14} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <HelpCircle size={13} /> Help and FAQ
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <Link href="/">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  <ArrowLeft size={14} /> Back to app
                </button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/sign-in">
                  <button className="px-3 py-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">Sign in</button>
                </Link>
                <Link href="/sign-up">
                  <button className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-colors" style={{ background: "#2F4842" }}>
                    Get started
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="py-14 text-center px-6" style={{ background: "linear-gradient(180deg, #f5f0e8 0%, transparent 100%)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#2F4842" }}>
          <BookOpen size={22} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Help and FAQ</h1>
        <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
          Everything you need to get the most out of Wayfare, your slow-travel finance companion.
        </p>
      </div>

      {/* Quick links */}
      <div className="max-w-4xl mx-auto px-6 -mt-4 mb-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Getting Started", icon: Zap, href: "#getting-started", color: "#D4B483" },
            { label: "Feature Guide", icon: BookOpen, href: "#features", color: "#5A7A71" },
            { label: "Trackers", icon: Map, href: "#features", color: "#2F4842" },
            { label: "FAQ", icon: HelpCircle, href: "#faq", color: "#b85a47" },
          ].map((item) => (
            <a key={item.label} href={item.href} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-center">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${item.color}18` }}>
                <item.icon size={16} style={{ color: item.color }} />
              </div>
              <span className="text-xs font-medium text-foreground">{item.label}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 space-y-16 pb-20">
        {/* ── Getting Started ────────────────────────────────────────────── */}
        <section id="getting-started">
          <div className="flex items-center gap-2 mb-6">
            <Zap size={18} style={{ color: "#D4B483" }} />
            <h2 className="text-xl font-bold text-foreground">Getting Started</h2>
          </div>
          <div className="space-y-3">
            {GETTING_STARTED.map((s) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: s.n * 0.05 }}
                className="flex gap-4 p-5 rounded-xl border border-border bg-card"
              >
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white" style={{ background: "#2F4842" }}>
                  {s.n}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm mb-1">{s.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                </div>
                {s.link && isSignedIn && (
                  <Link href={s.link}>
                    <button className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80 transition-opacity mt-0.5">
                      Go <ChevronRight size={12} />
                    </button>
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Feature Guide ─────────────────────────────────────────────── */}
        <section id="features">
          <div className="flex items-center gap-2 mb-6">
            <BookOpen size={18} style={{ color: "#5A7A71" }} />
            <h2 className="text-xl font-bold text-foreground">Feature Guide</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => {
              const isActive = activeSection === f.title;
              return (
                <div key={f.title} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setActiveSection(isActive ? null : f.title)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(47,72,66,0.08)" }}>
                      <f.icon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{f.title}</p>
                    </div>
                    <ChevronDown size={15} className={`flex-shrink-0 text-muted-foreground transition-transform ${isActive ? "rotate-180" : ""}`} />
                  </button>
                  {isActive && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="px-4 pb-4 space-y-3 border-t border-border pt-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                      {f.tips.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Tips</p>
                          {f.tips.map((tip, i) => (
                            <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                              <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                              <span>{tip}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {isSignedIn && (
                        <Link href={f.link}>
                          <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-80 transition-opacity mt-1">
                            Open {f.title} <ChevronRight size={12} />
                          </button>
                        </Link>
                      )}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Multi-currency callout ─────────────────────────────────────── */}
        <section>
          <div className="rounded-2xl p-6 border" style={{ background: "rgba(47,72,66,0.04)", borderColor: "rgba(47,72,66,0.15)" }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" style={{ background: "rgba(47,72,66,0.1)" }}>
                💱
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-2">Foreign currency support</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  Paid in euros but your account is in Australian dollars? When adding a transaction, toggle "Paid in a different currency" and enter the original amount and currency. Wayfare records the live exchange rate at the time of entry and shows both amounts on the transaction.
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2 font-mono">
                  <span className="text-foreground font-semibold">€ 82.50 EUR</span>
                  <span>at 1.6412</span>
                  <span className="text-foreground font-semibold">= A$ 135.40 AUD</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <section id="faq">
          <div className="flex items-center gap-2 mb-6">
            <HelpCircle size={18} style={{ color: "#b85a47" }} />
            <h2 className="text-xl font-bold text-foreground">Frequently Asked Questions</h2>
          </div>
          <div className="border border-border rounded-xl bg-card divide-y divide-border px-4">
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </section>

        {/* ── SSTP footer ────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 text-center py-8 border-t border-border">
          <p className="text-xs text-muted-foreground">A sibling to</p>
          <a
            href="https://www.theslowtravelplanner.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img src={`${basePath}/sstp-logo.png`} alt="The Slow Travel Planner" className="w-8 h-8 rounded-lg" />
            <span className="text-sm font-semibold text-foreground">The Slow Travel Planner</span>
            <ExternalLink size={12} className="text-muted-foreground" />
          </a>
          <p className="text-xs text-muted-foreground">Plan the trip with SSTP. Live it with Wayfare.</p>
        </div>
      </div>
    </div>
  );
}

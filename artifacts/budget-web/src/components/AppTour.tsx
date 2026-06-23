import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ArrowLeft, Compass } from "lucide-react";
import { Link } from "wouter";

interface TourStep {
  icon: string;
  title: string;
  body: string;
  link?: string;
  linkLabel?: string;
}

const STEPS: TourStep[] = [
  {
    icon: "🗺️",
    title: "Welcome to Wayfare",
    body: "Your slow-travel finance companion is ready. Let's take a quick tour of the main features so you can hit the ground running.",
  },
  {
    icon: "📊",
    title: "Dashboard",
    body: "Your financial snapshot at a glance: total balance across all accounts, monthly income and expenses, and a six-month cash flow chart.",
    link: "/",
    linkLabel: "Go to Dashboard",
  },
  {
    icon: "📝",
    title: "Transactions",
    body: "Log a spend in seconds — type the amount, pick a category, done. Or import a whole bank statement (CSV, PDF, XLSX) and AI pulls out every transaction automatically. Supports any currency.",
    link: "/transactions",
    linkLabel: "Log your first spend",
  },
  {
    icon: "💳",
    title: "Accounts (optional)",
    body: "Connect your bank accounts, credit cards, or travel wallets to track balances across all of them. You can also just import statements manually — no account linking required.",
    link: "/accounts",
    linkLabel: "Add an account",
  },
  {
    icon: "🎯",
    title: "Budgets and Goals",
    body: "Set monthly spending limits by category to stay on track, and create savings goals with target dates and progress tracking.",
    link: "/budgets",
    linkLabel: "Set up a budget",
  },
  {
    icon: "🌍",
    title: "Trip Trackers",
    body: "Create a tracker for each trip. Every spend drops a pin on a map, builds a daily story with weather and mood, and surfaces non-obvious insights like DCC fees and peak spend hours.",
    link: "/trackers",
    linkLabel: "Create a tracker",
  },
  {
    icon: "📈",
    title: "Reports and Smart Features",
    body: "Reports shows spending trends, your savings rate, and net worth over time. Smart Features lets you link your bank directly and auto-detect recurring subscriptions.",
    link: "/reports",
    linkLabel: "View Reports",
  },
  {
    icon: "✅",
    title: "You're all set!",
    body: "Log your first spend, import a statement, or just explore. Your 'My Spend' tracker is ready and waiting. Need help? The Help and FAQ page has answers to everything.",
    link: "/transactions",
    linkLabel: "Log your first spend",
  },
];

interface AppTourProps {
  onClose: () => void;
}

export default function AppTour({ onClose }: AppTourProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && !isLast) setStep((s) => s + 1);
      if (e.key === "ArrowLeft" && !isFirst) setStep((s) => s - 1);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, isLast, isFirst]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
    >
      <motion.div
        key={step}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Compass size={16} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Quick Tour ({step + 1} of {STEPS.length})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Skip tour"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 pt-5 px-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="rounded-full transition-all"
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                background: i === step ? "#2F4842" : "#e0d9ce",
              }}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-6 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
            style={{ background: "rgba(47,72,66,0.1)" }}
          >
            {current.icon}
          </div>
          <h2 className="text-lg font-bold text-foreground mb-3">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.body}</p>

          {current.link && current.linkLabel && (
            <Link href={current.link}>
              <button
                onClick={onClose}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-80 transition-opacity underline underline-offset-2"
              >
                {current.linkLabel}
              </button>
            </Link>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 pb-5 gap-3">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={isFirst}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Skip tour
          </button>

          {isLast ? (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: "#2F4842" }}
            >
              Done
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: "#2F4842" }}
            >
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

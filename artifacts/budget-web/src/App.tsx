import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Target,
  CreditCard,
  RefreshCw,
  BarChart3,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Budgets from "@/pages/Budgets";
import Goals from "@/pages/Goals";
import Accounts from "@/pages/Accounts";
import Subscriptions from "@/pages/Subscriptions";
import Reports from "@/pages/Reports";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const NAV = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { path: "/budgets", label: "Budgets", icon: PieChart },
  { path: "/goals", label: "Goals", icon: Target },
  { path: "/accounts", label: "Accounts", icon: CreditCard },
  { path: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
  { path: "/reports", label: "Reports", icon: BarChart3 },
];

function Sidebar({ mobile, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const [location] = useLocation();
  return (
    <aside className={`flex flex-col h-full ${mobile ? "w-full" : "w-64"} bg-sidebar border-r border-sidebar-border`}>
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">B</span>
        </div>
        <span className="font-semibold text-sidebar-foreground text-lg tracking-tight">BudgetWise</span>
        {mobile && (
          <button onClick={onClose} className="ml-auto p-1 rounded-md hover:bg-sidebar-accent text-sidebar-foreground">
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ path, label, icon: Icon }) => {
          const active = location === path;
          return (
            <Link key={path} href={path} onClick={onClose}>
              <motion.div
                whileHover={{ x: 2 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm font-medium ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon size={18} />
                {label}
              </motion.div>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground">Your personal finance companion</p>
      </div>
    </aside>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 w-72 md:hidden"
          >
            <Sidebar mobile onClose={() => setMobileOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-md hover:bg-muted">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-foreground">BudgetWise</span>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/budgets" component={Budgets} />
        <Route path="/goals" component={Goals} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/subscriptions" component={Subscriptions} />
        <Route path="/reports" component={Reports} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

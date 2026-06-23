import { useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, Link, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ArrowLeftRight, PieChart, Target, CreditCard,
  RefreshCw, BarChart3, Menu, X, Sparkles, MapPin, LogOut, ChevronDown,
  HelpCircle, ExternalLink,
} from "lucide-react";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Budgets from "@/pages/Budgets";
import Goals from "@/pages/Goals";
import Accounts from "@/pages/Accounts";
import Subscriptions from "@/pages/Subscriptions";
import Reports from "@/pages/Reports";
import BankLink from "@/pages/BankLink";
import Trackers from "@/pages/Trackers";
import TrackerDetail from "@/pages/TrackerDetail";
import Help from "@/pages/Help";
import AppTour from "@/components/AppTour";
import { WayfareLogo, WayfareMark } from "@/components/WayfareLogo";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

// WCAG 2.0 AA compliant colours verified:
//   colorMutedForeground #3d5a52 on white  → 7.5:1 (AAA)
//   formButtonPrimary #2F4842 bg + white text → 14:1 (AAA)
//   feature card body #a8c4be on #2a4842 bg → 6.3:1 (AA)
//   landing body #8ab3ac on #1A2F2B bg → 6.4:1 (AA)
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#2F4842",
    colorForeground: "#1A2F2B",
    colorMutedForeground: "#3d5a52",
    colorDanger: "#b85a47",
    colorBackground: "#ffffff",
    colorInput: "#f8f6f1",
    colorInputForeground: "#1A2F2B",
    colorNeutral: "#c8bfa8",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#1A2F2B] font-semibold",
    headerSubtitle: "text-[#3d5a52]",
    socialButtonsBlockButtonText: "text-[#1A2F2B] font-medium",
    formFieldLabel: "text-[#1A2F2B] font-medium",
    footerActionLink: "text-[#2F4842] font-semibold hover:text-[#1A2F2B]",
    footerActionText: "text-[#3d5a52]",
    dividerText: "text-[#3d5a52]",
    identityPreviewEditButton: "text-[#2F4842]",
    formFieldSuccessText: "text-emerald-600",
    alertText: "text-[#b85a47]",
    logoBox: "flex justify-center py-2",
    logoImage: "w-14 h-14",
    socialButtonsBlockButton: "border-[#c8bfa8] hover:bg-[#f8f6f1] transition-colors",
    formButtonPrimary: "bg-[#2F4842] hover:bg-[#1A2F2B] transition-colors !text-white !font-semibold",
    formFieldInput: "border-[#c8bfa8] bg-[#f8f6f1] text-[#1A2F2B]",
    footerAction: "bg-[#f8f6f1]",
    dividerLine: "bg-[#e8e0d0]",
    alert: "border-[#f3c8c0]",
    otpCodeFieldInput: "border-[#c8bfa8] bg-[#f8f6f1]",
    formFieldRow: "gap-2",
    main: "px-6",
  },
};

// ── Guest mode helpers ─────────────────────────────────────────────────────────
function useIsGuest() {
  return !!localStorage.getItem("wayfare_guest_id");
}

// Keeps the API client's auth token getter in sync with Clerk session state.
// When signed in, clears the guest token so Clerk cookies take over.
// When signed out but a guest ID exists, injects it as a Bearer token.
function GuestModeInitializer() {
  const { isSignedIn } = useUser();
  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(null);
    } else {
      const guestId = localStorage.getItem("wayfare_guest_id");
      if (guestId) setAuthTokenGetter(() => guestId);
    }
  }, [isSignedIn]);
  return null;
}

// Banner shown inside the app shell when the user is in guest mode.
function GuestBanner() {
  const { isSignedIn } = useUser();
  const isGuest = !isSignedIn && !!localStorage.getItem("wayfare_guest_id");
  if (!isGuest) return null;
  return (
    <div className="bg-[#EBD9B4]/30 border-b border-[#D4B483]/40 px-4 py-2 flex items-center justify-between gap-4 flex-shrink-0">
      <span className="text-xs" style={{ color: "#5A7A71" }}>
        Exploring as a guest — your data is saved, but only on this browser.
      </span>
      <div className="flex gap-2 flex-shrink-0">
        <Link href="/sign-up">
          <button className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
            Create account
          </button>
        </Link>
        <button
          onClick={() => {
            localStorage.removeItem("wayfare_guest_id");
            setAuthTokenGetter(null);
            window.location.href = basePath || "/";
          }}
          className="px-3 py-1 rounded-md border border-border text-muted-foreground text-xs font-medium hover:bg-muted"
        >
          Exit guest
        </button>
      </div>
    </div>
  );
}

// ── Auto-show onboarding tour on first sign-in ─────────────────────────────────
function TourManager() {
  const { user } = useUser();
  const [showTour, setShowTour] = useState(false);
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (user && !triggeredRef.current && !localStorage.getItem("wayfare_tour_done")) {
      triggeredRef.current = true;
      const t = setTimeout(() => setShowTour(true), 900);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [user?.id]);

  if (!showTour) return null;
  return (
    <AppTour
      onClose={() => {
        localStorage.setItem("wayfare_tour_done", "1");
        setShowTour(false);
      }}
    />
  );
}

// ── Clerk cache invalidator ───────────────────────────────────────────────────
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    return addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prevIdRef.current !== undefined && prevIdRef.current !== id) qc.clear();
      prevIdRef.current = id;
    });
  }, [addListener, qc]);
  return null;
}

// ── NAV ───────────────────────────────────────────────────────────────────────
const NAV = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { path: "/budgets", label: "Budgets", icon: PieChart },
  { path: "/goals", label: "Goals", icon: Target },
  { path: "/accounts", label: "Accounts", icon: CreditCard },
  { path: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
  { path: "/trackers", label: "Trackers", icon: MapPin },
  { path: "/reports", label: "Reports", icon: BarChart3 },
  { path: "/smart", label: "Smart Features", icon: Sparkles },
  { path: "/help", label: "Help and FAQ", icon: HelpCircle },
];

// ── User avatar + sign-out in sidebar ─────────────────────────────────────────
function SidebarUser() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const name = user.fullName || user.primaryEmailAddress?.emailAddress || "You";
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="relative px-3 pb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
      >
        {user.imageUrl ? (
          <img src={user.imageUrl} alt={name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-[#D4B483] flex items-center justify-center text-[#1A2F2B] text-xs font-bold flex-shrink-0">
            {initials}
          </div>
        )}
        <span className="text-xs font-medium truncate flex-1 text-left">{name}</span>
        <ChevronDown size={14} className={`flex-shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-full left-3 right-3 mb-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50"
          >
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-xs font-semibold text-foreground truncate">{user.fullName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user.primaryEmailAddress?.emailAddress}</p>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={13} /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ mobile, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const [location] = useLocation();
  return (
    <aside className={`flex flex-col h-full ${mobile ? "w-full" : "w-64"} bg-sidebar border-r border-sidebar-border`}>
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <WayfareLogo size={32} variant="onDark" />
        {mobile && (
          <button onClick={onClose} className="ml-auto p-1 rounded-md hover:bg-sidebar-accent text-sidebar-foreground" aria-label="Close navigation">
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
      <div className="border-t border-sidebar-border">
        <a
          href="https://www.theslowtravelplanner.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-5 py-3 hover:bg-sidebar-accent transition-colors group"
        >
          <img
            src={`${basePath}/sstp-logo.png`}
            alt="The Slow Travel Planner"
            className="w-5 h-5 rounded-md flex-shrink-0"
          />
          <p className="text-xs text-sidebar-foreground/60 italic font-display truncate">
            A sibling to <span className="not-italic font-medium">The Slow Travel Planner</span>
          </p>
          <ExternalLink size={10} className="ml-auto flex-shrink-0 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/50 transition-colors" />
        </a>
        <SidebarUser />
      </div>
    </aside>
  );
}

// ── App shell (authenticated) ─────────────────────────────────────────────────
function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 w-72 md:hidden">
            <Sidebar mobile onClose={() => setMobileOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-md hover:bg-muted" aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <WayfareLogo size={26} variant="onLight" />
        </div>
        <GuestBanner />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

// ── Landing page (signed-out) ─────────────────────────────────────────────────
function Landing() {
  const [, setLocation] = useLocation();

  const handleContinueAsGuest = () => {
    const existing = localStorage.getItem("wayfare_guest_id");
    const guestId = existing ?? `guest-${crypto.randomUUID()}`;
    if (!existing) localStorage.setItem("wayfare_guest_id", guestId);
    setAuthTokenGetter(() => guestId);
    setLocation("/");
  };

  const FEATURES = [
    { icon: "📍", title: "Map every spend", body: "Drop a receipt, AI extracts vendor, items, and total, then pins it on your trip map." },
    { icon: "📖", title: "Daily story timeline", body: "Weather, mood, companions, and photos stitched into a day-by-day travel diary." },
    { icon: "✨", title: "Smart insights", body: "DCC fee detection, peak spend hour, subscription auto-discovery, and more." },
    { icon: "🏦", title: "Bank linking", body: "Import statements or connect via Plaid and GoCardless to auto-categorise your spend." },
  ];
  return (
    <div className="min-h-screen" style={{ background: "#1A2F2B" }}>
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="flex justify-center mb-8">
            <WayfareMark size={80} variant="onDark" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-widest uppercase mb-4" style={{ color: "#EBD9B4", letterSpacing: "0.2em" }}>
            Wayfare
          </h1>
          <p className="text-xl mb-3" style={{ color: "#D4B483", fontFamily: "Lora, Georgia, serif", fontStyle: "italic" }}>
            The cost of a journey, tracked.
          </p>
          <p className="text-base max-w-xl mx-auto mb-10" style={{ color: "#8ab3ac" }}>
            A slow-travel companion for tracking what a temporary life abroad actually costs: receipts, places, memories, and spend, mapped day by day.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/sign-up">
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
                className="px-7 py-3.5 rounded-xl font-semibold text-sm transition-colors"
                style={{ background: "#EBD9B4", color: "#1A2F2B" }}>
                Start your journey
              </motion.button>
            </Link>
            <Link href="/sign-in">
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
                className="px-7 py-3.5 rounded-xl font-semibold text-sm border-2 transition-colors"
                style={{ borderColor: "#8ab3ac", color: "#EBD9B4" }}>
                Sign in
              </motion.button>
            </Link>
          </div>
          <p className="text-xs mt-5" style={{ color: "#5A7A71" }}>
            or{" "}
            <button
              onClick={handleContinueAsGuest}
              className="underline underline-offset-2 hover:opacity-80 transition-opacity"
              style={{ color: "#8ab3ac" }}
            >
              continue as guest
            </button>
            {" "}— no account needed, data saved in this browser
          </p>
        </motion.div>
      </div>

      {/* Feature grid */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="rounded-2xl p-5 border"
              style={{ background: "rgba(47,72,66,0.4)", borderColor: "rgba(90,122,113,0.3)" }}>
              <div className="text-2xl mb-2">{f.icon}</div>
              <p className="font-semibold text-sm mb-1" style={{ color: "#EBD9B4" }}>{f.title}</p>
              <p className="text-sm leading-relaxed" style={{ color: "#a8c4be" }}>{f.body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Sibling branding + links */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="flex flex-col items-center gap-4 border-t pt-10" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-xs font-medium" style={{ color: "#8ab3ac" }}>A sibling to</p>
          <a
            href="https://www.theslowtravelplanner.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img
              src={`${basePath}/sstp-logo.png`}
              alt="The Slow Travel Planner"
              className="w-10 h-10 rounded-xl"
            />
            <span className="text-base font-semibold" style={{ color: "#EBD9B4" }}>The Slow Travel Planner</span>
            <ExternalLink size={14} style={{ color: "#8ab3ac" }} />
          </a>
          <p className="text-xs" style={{ color: "#8ab3ac" }}>
            Sign in with Google, Apple, or email
          </p>
          <Link href="/help">
            <span className="text-xs underline underline-offset-2 hover:opacity-80 transition-opacity cursor-pointer" style={{ color: "#8ab3ac" }}>
              Help and FAQ
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Auth pages ─────────────────────────────────────────────────────────────────
function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#1A2F2B" }}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#1A2F2B" }}>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

// ── Protected app router ───────────────────────────────────────────────────────
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn, isLoaded } = useUser();
  const isGuest = useIsGuest();
  if (!isLoaded) return null;
  if (!isSignedIn && !isGuest) return <Redirect to="/" />;
  return <AppShell><Component /></AppShell>;
}

function HomeRoute() {
  const { isSignedIn, isLoaded } = useUser();
  const isGuest = useIsGuest();
  if (!isLoaded) return null;
  if (isSignedIn || isGuest) return <AppShell><Dashboard /></AppShell>;
  return <Landing />;
}

// ── Root with Clerk ────────────────────────────────────────────────────────────
function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back to Wayfare",
            subtitle: "Sign in to continue your journey",
          },
        },
        signUp: {
          start: {
            title: "Start your journey",
            subtitle: "Create your Wayfare account",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <GuestModeInitializer />
        <TourManager />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRoute} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/help" component={Help} />
            <Route path="/transactions">{() => <ProtectedRoute component={Transactions} />}</Route>
            <Route path="/budgets">{() => <ProtectedRoute component={Budgets} />}</Route>
            <Route path="/goals">{() => <ProtectedRoute component={Goals} />}</Route>
            <Route path="/accounts">{() => <ProtectedRoute component={Accounts} />}</Route>
            <Route path="/subscriptions">{() => <ProtectedRoute component={Subscriptions} />}</Route>
            <Route path="/trackers">{() => <ProtectedRoute component={Trackers} />}</Route>
            <Route path="/trackers/:id">{() => <ProtectedRoute component={TrackerDetail} />}</Route>
            <Route path="/reports">{() => <ProtectedRoute component={Reports} />}</Route>
            <Route path="/smart">{() => <ProtectedRoute component={BankLink} />}</Route>
            <Route path="/smart-features">{() => <Redirect to="/smart" />}</Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, AlertCircle, CheckCircle2, CircleDashed, Flame, TrendingUp } from "lucide-react";
import "./FlowDashboard.css";

const MOCK_DATA = {
  user: "Alex",
  date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase(),
  summary: {
    totalBalance: 14250.80,
    monthlyIncome: 6200.00,
    monthlyExpenses: 4100.50,
    spendableAmount: 2099.50,
    savingsRate: 33.8,
  },
  insights: [
    { id: 1, type: "warning", title: "VELOCITY ALERT", text: "Dining out is 40% higher than last month. Slow down to maintain savings target.", color: "var(--accent-red)" },
    { id: 2, type: "positive", title: "OPTIMIZATION", text: "You saved $450 on subscriptions this quarter by dropping unused services.", color: "var(--accent-green)" },
    { id: 3, type: "neutral", title: "MILESTONE", text: "Emergency fund reached 80% of optimal capacity.", color: "var(--accent-blue)" },
  ],
  allocation: [
    { label: "NEEDS", amount: 2800, percentage: 45, color: "var(--accent-blue)" },
    { label: "WANTS", amount: 1300, percentage: 21, color: "var(--accent-yellow)" },
    { label: "SAVINGS", amount: 2100, percentage: 34, color: "var(--accent-green)" },
  ],
  transactions: [
    { id: "tx_1", merchant: "WHOLE FOODS MKT", amount: -142.50, category: "GROCERY", date: "TODAY 14:40", status: "CLEARED" },
    { id: "tx_2", merchant: "PAYROLL ACME CORP", amount: 3100.00, category: "INCOME", date: "YESTERDAY", status: "CLEARED" },
    { id: "tx_3", merchant: "NETFLIX.COM", amount: -15.99, category: "SUBSCRIPTION", date: "JUN 23", status: "CLEARED" },
    { id: "tx_4", merchant: "UBER RIDES", amount: -24.00, category: "TRANSPORT", date: "JUN 22", status: "PENDING" },
    { id: "tx_5", merchant: "BLUE BOTTLE COFFEE", amount: -6.50, category: "COFFEE", date: "JUN 21", status: "CLEARED" },
    { id: "tx_6", merchant: "VANGUARD INVEST", amount: -1000.00, category: "INVESTMENT", date: "JUN 20", status: "CLEARED" },
    { id: "tx_7", merchant: "CON EDISON", amount: -85.20, category: "UTILITY", date: "JUN 18", status: "CLEARED" },
  ]
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

export default function FlowDashboard() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flow-theme p-4 md:p-8">
      {/* HEADER MARQUEE */}
      <div className="brutal-card mb-8 overflow-hidden py-3 whitespace-nowrap bg-[var(--accent-yellow)] text-black relative flex items-center">
        <div className="animate-marquee font-bold tracking-widest text-sm flex gap-8">
          <span>SYSTEM ONLINE</span>
          <span>•</span>
          <span>{MOCK_DATA.date}</span>
          <span>•</span>
          <span>ALL SYSTEMS NOMINAL</span>
          <span>•</span>
          <span>SAVINGS RATE: {MOCK_DATA.summary.savingsRate}%</span>
          <span>•</span>
          <span>SPENDABLE: {formatCurrency(MOCK_DATA.summary.spendableAmount)}</span>
          <span>•</span>
          <span>SYSTEM ONLINE</span>
          <span>•</span>
          <span>{MOCK_DATA.date}</span>
          <span>•</span>
          <span>ALL SYSTEMS NOMINAL</span>
          <span>•</span>
          <span>SAVINGS RATE: {MOCK_DATA.summary.savingsRate}%</span>
          <span>•</span>
          <span>SPENDABLE: {formatCurrency(MOCK_DATA.summary.spendableAmount)}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-12">
        {/* NARRATIVE HERO */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-6"
        >
          <div className="flex justify-between items-end border-b-4 border-black pb-4 mb-8">
            <h1 className="font-display text-4xl md:text-6xl font-black leading-none tracking-tight">
              WAYFARE <br />
              <span className="text-[var(--accent-blue)]">FINANCIAL OS</span>
            </h1>
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold uppercase tracking-wider text-black/60">AUTHORIZED USER</p>
              <p className="text-2xl font-bold">{MOCK_DATA.user}</p>
            </div>
          </div>

          <div className="font-display text-3xl md:text-5xl lg:text-7xl font-bold uppercase leading-[1.1] tracking-tight max-w-5xl">
            YOUR RUNWAY IS <span className="bg-[var(--accent-green)] text-white px-3 brutal-shadow inline-block transform -rotate-1">{formatCurrency(MOCK_DATA.summary.spendableAmount)}</span>. 
            YOU HAVE ROUTED <span className="text-[var(--accent-blue)] underline decoration-4 underline-offset-8">{MOCK_DATA.allocation[2].percentage}%</span> TO SAVINGS THIS CYCLE.
          </div>
        </motion.section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: THE LEDGER */}
          <div className="lg:col-span-8 space-y-8">
            {/* ALLOCATION BAR */}
            <motion.section
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
               transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex justify-between items-end mb-4">
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide">Flow Allocation</h2>
                <span className="text-sm font-bold bg-black text-white px-2 py-1">IN: {formatCurrency(MOCK_DATA.summary.monthlyIncome)}</span>
              </div>
              
              <div className="h-16 flex w-full brutal-border bg-white overflow-hidden brutal-shadow relative">
                {MOCK_DATA.allocation.map((item, i) => (
                  <div 
                    key={item.label}
                    className="h-full flex items-center justify-center font-bold text-white text-xs md:text-sm border-r-2 border-black last:border-r-0 animate-expand whitespace-nowrap overflow-hidden transition-all hover:brightness-110 cursor-pointer"
                    style={{ 
                      backgroundColor: item.color, 
                      width: mounted ? `${item.percentage}%` : '0%',
                      transitionDelay: `${i * 0.1}s`
                    }}
                    title={`${item.label}: ${formatCurrency(item.amount)}`}
                  >
                    {item.percentage > 10 && <span className="px-2">{item.label} {item.percentage}%</span>}
                  </div>
                ))}
              </div>
            </motion.section>

            {/* RECENT TRANSACTIONS: STARK LEDGER */}
            <motion.section
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
               transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="flex justify-between items-end mb-4 border-b-2 border-black pb-2">
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide">The Ledger</h2>
                <button className="text-sm font-bold hover:bg-black hover:text-white px-3 py-1 border-2 border-transparent hover:border-black transition-colors uppercase">
                  View All →
                </button>
              </div>

              <div className="brutal-card p-0 overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap text-sm">
                  <thead>
                    <tr className="bg-black text-white">
                      <th className="p-3 font-bold tracking-wider">MERCHANT</th>
                      <th className="p-3 font-bold tracking-wider">CATEGORY</th>
                      <th className="p-3 font-bold tracking-wider">DATE</th>
                      <th className="p-3 font-bold tracking-wider text-right">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-black">
                    {MOCK_DATA.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[var(--bg)] transition-colors group">
                        <td className="p-3 font-bold flex items-center gap-2">
                          {tx.amount > 0 ? (
                            <ArrowUpRight size={16} className="text-[var(--accent-green)]" />
                          ) : (
                            <ArrowDownRight size={16} className="text-[var(--accent-red)]" />
                          )}
                          {tx.merchant}
                          {tx.status === "PENDING" && (
                            <span className="text-[10px] bg-black text-white px-1.5 py-0.5 ml-2 font-mono">PEND</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="border-2 border-black px-2 py-0.5 text-xs font-bold uppercase bg-[#E5E5E5] group-hover:bg-white transition-colors">
                            {tx.category}
                          </span>
                        </td>
                        <td className="p-3 text-black/60 font-bold">{tx.date}</td>
                        <td className={`p-3 font-display text-lg font-bold text-right ${tx.amount > 0 ? 'text-[var(--accent-green)]' : ''}`}>
                          {tx.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.section>
          </div>

          {/* RIGHT COLUMN: THE SITUATION */}
          <div className="lg:col-span-4 space-y-8">
            <motion.section
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
               transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide mb-4 border-b-2 border-black pb-2">The Situation</h2>
              
              <div className="space-y-4">
                {MOCK_DATA.insights.map((insight, i) => (
                  <motion.div 
                    key={insight.id}
                    whileHover={{ x: 4 }}
                    className="brutal-card p-4 flex flex-col gap-3 relative overflow-hidden"
                    style={{ borderTopWidth: '6px', borderTopColor: insight.color }}
                  >
                    <div className="flex items-center gap-2 font-display font-bold uppercase text-lg" style={{ color: insight.color }}>
                      {insight.type === 'warning' && <AlertCircle size={20} />}
                      {insight.type === 'positive' && <Flame size={20} />}
                      {insight.type === 'neutral' && <CheckCircle2 size={20} />}
                      {insight.title}
                    </div>
                    <p className="text-sm font-bold leading-relaxed">{insight.text}</p>
                    
                    {/* Decorative background shape */}
                    <div 
                      className="absolute -right-4 -bottom-4 opacity-10"
                      style={{ color: insight.color }}
                    >
                      <CircleDashed size={80} strokeWidth={4} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>

            {/* QUICK STATS */}
            <motion.section
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
               transition={{ duration: 0.5, delay: 0.5 }}
               className="grid grid-cols-2 gap-4"
            >
              <div className="brutal-card p-4 bg-black text-white">
                <p className="text-xs font-bold text-white/60 mb-1">TOTAL LIQUIDITY</p>
                <p className="font-display text-2xl font-bold">{formatCurrency(MOCK_DATA.summary.totalBalance)}</p>
              </div>
              <div className="brutal-card p-4 bg-[var(--accent-red)] text-white">
                <p className="text-xs font-bold text-white/80 mb-1">BURN RATE</p>
                <div className="flex items-center gap-2">
                  <p className="font-display text-2xl font-bold">{formatCurrency(MOCK_DATA.summary.monthlyExpenses)}</p>
                  <TrendingUp size={16} />
                </div>
              </div>
            </motion.section>
            
            {/* ENGAGE BUTTON */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="w-full brutal-card bg-[var(--accent-blue)] text-white font-display text-2xl font-bold uppercase py-6 brutal-shadow-hover hover:bg-black transition-colors"
            >
              Review Actions →
            </motion.button>

          </div>
        </div>
      </div>
    </div>
  );
}

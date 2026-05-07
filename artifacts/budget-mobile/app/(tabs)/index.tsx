import { Feather } from "@expo/vector-icons";
import { setBaseUrl, useGetDashboardSummary, useGetCashFlow, useGetSpendingByCategory, useListRecentTransactions, useGetBudgetsOverview } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View,
} from "react-native";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

function fmt(n: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(n);
}

function StatCard({ label, value, sub, iconName, colorBg, iconColor }: {
  label: string; value: string; sub?: string; iconName: string; colorBg: string; iconColor: string;
}) {
  const colors = useColors();
  const r = colors.radius;
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: r }]}>
      <View style={[styles.statIcon, { backgroundColor: colorBg, borderRadius: r - 4 }]}>
        <Feather name={iconName as any} size={16} color={iconColor} />
      </View>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      {sub && <Text style={[styles.statSub, { color: colors.mutedForeground }]}>{sub}</Text>}
    </View>
  );
}

function MiniBar({ month, income, expenses, maxVal }: { month: string; income: number; expenses: number; maxVal: number }) {
  const colors = useColors();
  return (
    <View style={styles.miniBarContainer}>
      <View style={styles.miniBars}>
        <View style={[styles.miniBarIncome, { height: Math.max(4, (income / maxVal) * 60), backgroundColor: colors.primary }]} />
        <View style={[styles.miniBarExpense, { height: Math.max(4, (expenses / maxVal) * 60), backgroundColor: colors.expense }]} />
      </View>
      <Text style={[styles.miniBarLabel, { color: colors.mutedForeground }]}>{month.slice(5)}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: recent } = useListRecentTransactions();
  const { data: cashFlow } = useGetCashFlow();
  const { data: byCategory } = useGetSpendingByCategory({});
  const { data: budgets } = useGetBudgetsOverview();

  const maxVal = cashFlow ? Math.max(...cashFlow.flatMap(m => [m.income, m.expenses]), 1) : 1;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: botPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Good morning 👋</Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Your Finances</Text>
        </View>
        <View style={[styles.headerAvatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.headerAvatarText}>B</Text>
        </View>
      </View>

      {/* Balance Hero */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 32 }} />
      ) : summary ? (
        <View style={[styles.heroCard, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
          <Text style={styles.heroLabel}>Total Balance</Text>
          <Text style={styles.heroValue}>{fmt(summary.totalBalance)}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Feather name="arrow-up-right" size={14} color="#a7f3d0" />
              <Text style={styles.heroStatLabel}>Income</Text>
              <Text style={styles.heroStatValue}>{fmt(summary.monthlyIncome, true)}</Text>
            </View>
            <View style={[styles.heroSep, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
            <View style={styles.heroStat}>
              <Feather name="arrow-down-right" size={14} color="#fca5a5" />
              <Text style={styles.heroStatLabel}>Expenses</Text>
              <Text style={styles.heroStatValue}>{fmt(summary.monthlyExpenses, true)}</Text>
            </View>
            <View style={[styles.heroSep, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
            <View style={styles.heroStat}>
              <Feather name="trending-up" size={14} color="#93c5fd" />
              <Text style={styles.heroStatLabel}>Savings</Text>
              <Text style={styles.heroStatValue}>{summary.savingsRate.toFixed(0)}%</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Stat Cards */}
      {summary && (
        <View style={styles.statRow}>
          <StatCard label="Spendable" value={fmt(summary.spendableAmount, true)} iconName="dollar-sign" colorBg="#dbeafe" iconColor="#3b82f6" />
          <StatCard label="Subscriptions" value={fmt(summary.activeSubscriptionsCost, true)} sub="monthly" iconName="refresh-cw" colorBg="#ede9fe" iconColor="#8b5cf6" />
          <StatCard label="Accounts" value={String(summary.accountCount)} iconName="credit-card" colorBg="#d1fae5" iconColor={colors.primary} />
        </View>
      )}

      {/* Cash Flow */}
      {cashFlow && cashFlow.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: colors.radius }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Cash Flow</Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>Last 6 months</Text>
          <View style={styles.barChart}>
            {cashFlow.map((m) => (
              <MiniBar key={m.month} month={m.month} income={m.income} expenses={m.expenses} maxVal={maxVal} />
            ))}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Income</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
              <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Expenses</Text>
            </View>
          </View>
        </View>
      )}

      {/* Budget Progress */}
      {budgets && budgets.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: colors.radius }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Budget Progress</Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>This month</Text>
          {budgets.slice(0, 4).map((b) => (
            <View key={b.id} style={styles.budgetItem}>
              <View style={styles.budgetRow}>
                <Text style={[styles.budgetName, { color: colors.foreground }]}>{b.categoryName ?? "Budget"}</Text>
                <Text style={[styles.budgetPct, { color: b.percentUsed >= 90 ? colors.expense : colors.mutedForeground }]}>
                  {b.percentUsed.toFixed(0)}%
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.muted, borderRadius: 4 }]}>
                <View
                  style={[styles.barFill, {
                    width: `${Math.min(100, b.percentUsed)}%` as any,
                    backgroundColor: b.percentUsed >= 90 ? colors.expense : b.percentUsed >= 70 ? "#f59e0b" : colors.primary,
                    borderRadius: 4,
                  }]}
                />
              </View>
              <View style={styles.budgetAmounts}>
                <Text style={[styles.budgetAmt, { color: colors.mutedForeground }]}>{fmt(b.spentAmount)} spent</Text>
                <Text style={[styles.budgetAmt, { color: colors.mutedForeground }]}>{fmt(b.limitAmount)} limit</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Spending by Category */}
      {byCategory && byCategory.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: colors.radius }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Spending by Category</Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>This month</Text>
          {byCategory.slice(0, 5).map((c, i) => (
            <View key={i} style={styles.catRow}>
              <View style={[styles.catDot, { backgroundColor: c.categoryColor ?? "#10b981" }]} />
              <Text style={[styles.catName, { color: colors.foreground }]}>{c.categoryName}</Text>
              <View style={{ flex: 1 }} />
              <Text style={[styles.catPct, { color: colors.mutedForeground }]}>{c.percentage.toFixed(0)}%</Text>
              <Text style={[styles.catAmt, { color: colors.foreground }]}>{fmt(c.totalAmount)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Recent Transactions */}
      {recent && recent.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: colors.radius }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Activity</Text>
          {recent.slice(0, 6).map((t, i) => (
            <View key={t.id} style={[styles.txnRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={[styles.txnIcon, { backgroundColor: t.categoryColor ? `${t.categoryColor}20` : colors.muted, borderRadius: colors.radius - 4 }]}>
                <Feather
                  name={t.type === "income" ? "arrow-up-right" : "arrow-down-right"}
                  size={14}
                  color={t.type === "income" ? colors.income : colors.expense}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.txnDesc, { color: colors.foreground }]}>{t.description ?? "Transaction"}</Text>
                <Text style={[styles.txnMeta, { color: colors.mutedForeground }]}>{t.categoryName ?? "Uncategorized"} · {t.date}</Text>
              </View>
              <Text style={[styles.txnAmt, { color: t.type === "income" ? colors.income : colors.foreground }]}>
                {t.type === "income" ? "+" : "-"}{fmt(t.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 20 },
  greeting: { fontSize: 13, marginBottom: 2 },
  headerTitle: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  heroCard: { marginHorizontal: 20, padding: 20, marginBottom: 16 },
  heroLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 4 },
  heroValue: { color: "#fff", fontSize: 32, fontWeight: "800", letterSpacing: -1, marginBottom: 16 },
  heroRow: { flexDirection: "row", alignItems: "center" },
  heroStat: { flex: 1, alignItems: "center", gap: 2 },
  heroSep: { width: 1, height: 32 },
  heroStatLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
  heroStatValue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  statRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  statCard: { flex: 1, padding: 12, borderWidth: 1, gap: 4 },
  statIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 15, fontWeight: "700" },
  statSub: { fontSize: 10 },
  section: { marginHorizontal: 20, padding: 16, borderWidth: 1, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  sectionSub: { fontSize: 12, marginBottom: 14 },
  barChart: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 80, marginBottom: 8 },
  miniBarContainer: { flex: 1, alignItems: "center", gap: 4 },
  miniBars: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  miniBarIncome: { width: 8, borderRadius: 4 },
  miniBarExpense: { width: 8, borderRadius: 4 },
  miniBarLabel: { fontSize: 10 },
  legend: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12 },
  budgetItem: { marginBottom: 12 },
  budgetRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  budgetName: { fontSize: 14, fontWeight: "600" },
  budgetPct: { fontSize: 13, fontWeight: "600" },
  barTrack: { height: 6, overflow: "hidden", marginBottom: 4 },
  barFill: { height: 6 },
  budgetAmounts: { flexDirection: "row", justifyContent: "space-between" },
  budgetAmt: { fontSize: 11 },
  catRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { fontSize: 14 },
  catPct: { fontSize: 12, marginRight: 8 },
  catAmt: { fontSize: 14, fontWeight: "600" },
  txnRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 0 },
  txnIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  txnDesc: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  txnMeta: { fontSize: 12 },
  txnAmt: { fontSize: 14, fontWeight: "700" },
});

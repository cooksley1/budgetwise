import { Feather } from "@expo/vector-icons";
import { setBaseUrl, useGetBudgetsOverview } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function BudgetsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: budgets, isLoading } = useGetBudgetsOverview();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const totalBudget = budgets?.reduce((s, b) => s + b.limitAmount, 0) ?? 0;
  const totalSpent = budgets?.reduce((s, b) => s + b.spentAmount, 0) ?? 0;
  const overallPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: botPad + 100, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Budgets</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>Track your monthly spending limits</Text>

      {/* Overall card */}
      {totalBudget > 0 && (
        <View style={[styles.overallCard, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
          <Text style={styles.overallLabel}>Monthly Budget</Text>
          <View style={styles.overallAmts}>
            <Text style={styles.overallSpent}>{fmt(totalSpent)}</Text>
            <Text style={styles.overallTotal}>of {fmt(totalBudget)}</Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
            <View style={[styles.barFill, { width: `${overallPct}%` as any, backgroundColor: overallPct >= 90 ? "#fca5a5" : "#a7f3d0" }]} />
          </View>
          <Text style={styles.overallPct}>{overallPct.toFixed(0)}% used · {fmt(totalBudget - totalSpent)} remaining</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.empty}>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Loading...</Text>
        </View>
      ) : budgets && budgets.length > 0 ? (
        budgets.map((b) => {
          const color = b.percentUsed >= 90 ? colors.expense : b.percentUsed >= 70 ? "#f59e0b" : colors.primary;
          return (
            <View key={b.id} style={[styles.budgetCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: colors.radius }]}>
              <View style={styles.budgetTop}>
                <View style={[styles.iconWrap, { backgroundColor: `${b.categoryColor ?? "#10b981"}20`, borderRadius: colors.radius - 4 }]}>
                  <Text style={{ fontSize: 16 }}>{b.categoryIcon ?? "📊"}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.budgetName, { color: colors.foreground }]}>{b.categoryName ?? "Budget"}</Text>
                  <Text style={[styles.budgetMonth, { color: colors.mutedForeground }]}>{b.month}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: `${color}20`, borderRadius: 999 }]}>
                  <Text style={[styles.badgeText, { color }]}>{b.percentUsed.toFixed(0)}%</Text>
                </View>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.muted, marginTop: 14 }]}>
                <View style={[styles.barFill, { width: `${Math.min(100, b.percentUsed)}%` as any, backgroundColor: color }]} />
              </View>
              <View style={styles.budgetAmts}>
                <Text style={[styles.budgetAmt, { color: colors.mutedForeground }]}>{fmt(b.spentAmount)} spent</Text>
                <Text style={[styles.budgetAmt, { color: b.remainingAmount < 0 ? colors.expense : colors.mutedForeground }]}>
                  {fmt(Math.abs(b.remainingAmount))} {b.remainingAmount < 0 ? "over" : "left"}
                </Text>
              </View>
            </View>
          );
        })
      ) : (
        <View style={styles.empty}>
          <Feather name="pie-chart" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No budgets set</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Use the web app to create budgets</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 20 },
  overallCard: { padding: 20, marginBottom: 16 },
  overallLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginBottom: 8 },
  overallAmts: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 12 },
  overallSpent: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  overallTotal: { color: "rgba(255,255,255,0.65)", fontSize: 14 },
  overallPct: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 8 },
  barTrack: { height: 6, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 4 },
  budgetCard: { padding: 16, borderWidth: 1, marginBottom: 12 },
  budgetTop: { flexDirection: "row", alignItems: "center" },
  iconWrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  budgetName: { fontSize: 15, fontWeight: "700" },
  budgetMonth: { fontSize: 12, marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  budgetAmts: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  budgetAmt: { fontSize: 12 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  emptySub: { fontSize: 14 },
});

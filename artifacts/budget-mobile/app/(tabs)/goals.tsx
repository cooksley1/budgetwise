import { Feather } from "@expo/vector-icons";
import { setBaseUrl, useListGoals } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function Ring({ pct, color, size = 80, stroke = 7 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct / 100);
  return (
    <View style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8f0ea" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ fontSize: 14, fontWeight: "700", color }}>{pct.toFixed(0)}%</Text>
      </View>
    </View>
  );
}

export default function GoalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: goals, isLoading } = useListGoals();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const totalSaved = goals?.reduce((s, g) => s + g.currentAmount, 0) ?? 0;
  const totalTarget = goals?.reduce((s, g) => s + g.targetAmount, 0) ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: botPad + 100, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Savings Goals</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>Track your financial milestones</Text>

      {/* Summary */}
      {totalTarget > 0 && (
        <View style={[styles.summaryCard, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
          <Text style={styles.summaryLabel}>Total Saved</Text>
          <Text style={styles.summaryValue}>{fmt(totalSaved)}</Text>
          <Text style={styles.summarySub}>of {fmt(totalTarget)} across {goals?.length ?? 0} goals</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.empty}>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Loading...</Text>
        </View>
      ) : goals && goals.length > 0 ? (
        goals.map((g) => {
          const goalColor = g.color ?? colors.primary;
          return (
            <View key={g.id} style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: colors.radius }]}>
              {g.isCompleted && (
                <View style={[styles.completedBadge, { backgroundColor: "#d1fae5", borderRadius: 999 }]}>
                  <Feather name="check-circle" size={12} color="#10b981" />
                  <Text style={styles.completedText}>Complete</Text>
                </View>
              )}
              <View style={styles.goalContent}>
                <View style={[styles.iconWrap, { backgroundColor: `${goalColor}20`, borderRadius: colors.radius - 4 }]}>
                  <Text style={{ fontSize: 20 }}>{g.icon ?? "🎯"}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.goalName, { color: colors.foreground }]}>{g.name}</Text>
                  {g.targetDate && (
                    <Text style={[styles.goalDate, { color: colors.mutedForeground }]}>Target: {g.targetDate}</Text>
                  )}
                  <Text style={[styles.goalSaved, { color: goalColor }]}>{fmt(g.currentAmount)}</Text>
                  <Text style={[styles.goalTarget, { color: colors.mutedForeground }]}>of {fmt(g.targetAmount)}</Text>
                </View>
                <Ring pct={g.percentComplete} color={goalColor} />
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.muted, marginTop: 14 }]}>
                <View style={[styles.barFill, { width: `${Math.min(100, g.percentComplete)}%` as any, backgroundColor: goalColor }]} />
              </View>
              <Text style={[styles.remaining, { color: colors.mutedForeground }]}>
                {fmt(g.targetAmount - g.currentAmount)} remaining
              </Text>
            </View>
          );
        })
      ) : (
        <View style={styles.empty}>
          <Feather name="target" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No goals yet</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Use the web app to create savings goals</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 20 },
  summaryCard: { padding: 20, marginBottom: 16 },
  summaryLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginBottom: 4 },
  summaryValue: { color: "#fff", fontSize: 32, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  summarySub: { color: "rgba(255,255,255,0.65)", fontSize: 13 },
  goalCard: { padding: 16, borderWidth: 1, marginBottom: 12 },
  completedBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, marginBottom: 12 },
  completedText: { color: "#10b981", fontSize: 11, fontWeight: "600" },
  goalContent: { flexDirection: "row", alignItems: "flex-start" },
  iconWrap: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  goalName: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  goalDate: { fontSize: 12, marginBottom: 6 },
  goalSaved: { fontSize: 18, fontWeight: "800" },
  goalTarget: { fontSize: 12 },
  barTrack: { height: 6, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 4 },
  remaining: { fontSize: 12, marginTop: 6 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  emptySub: { fontSize: 14 },
});

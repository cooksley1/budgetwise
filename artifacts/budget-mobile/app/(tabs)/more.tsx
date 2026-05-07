import { Feather } from "@expo/vector-icons";
import { setBaseUrl, useListAccounts, useListSubscriptions } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const CYCLE_LABELS: Record<string, string> = { weekly: "/ week", monthly: "/ mo", quarterly: "/ qtr", annually: "/ yr" };

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: accounts } = useListAccounts();
  const { data: subs } = useListSubscriptions();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const totalBalance = accounts?.reduce((s, a) => s + a.balance, 0) ?? 0;
  const monthlySubs = subs?.filter(s => s.isActive).reduce((sum, s) => {
    const m: Record<string, number> = { weekly: 4.33, monthly: 1, quarterly: 1 / 3, annually: 1 / 12 };
    return sum + s.amount * (m[s.billingCycle] ?? 1);
  }, 0) ?? 0;

  const ACCOUNT_TYPE_ICONS: Record<string, string> = {
    checking: "credit-card",
    savings: "bookmark",
    credit: "credit-card",
    investment: "trending-up",
    cash: "dollar-sign",
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: botPad + 100, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>More</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>Accounts & subscriptions</Text>

      {/* Accounts */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNTS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: colors.radius }]}>
        {accounts?.map((a, i) => (
          <View key={a.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={[styles.iconBox, { backgroundColor: `${a.color ?? "#10b981"}20`, borderRadius: colors.radius - 4 }]}>
              <Feather name={(ACCOUNT_TYPE_ICONS[a.type] ?? "credit-card") as any} size={16} color={a.color ?? "#10b981"} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{a.name}</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{a.type} · {a.currency}</Text>
            </View>
            <Text style={[styles.rowValue, { color: a.balance < 0 ? colors.expense : colors.foreground }]}>{fmt(a.balance)}</Text>
          </View>
        ))}
        <View style={[styles.totalRow, { borderTopWidth: 2, borderTopColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Net Worth</Text>
          <Text style={[styles.totalValue, { color: colors.primary }]}>{fmt(totalBalance)}</Text>
        </View>
      </View>

      {/* Subscriptions */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SUBSCRIPTIONS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: colors.radius }]}>
        {subs?.map((s, i) => (
          <View key={s.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }, !s.isActive && { opacity: 0.4 }]}>
            <View style={[styles.iconBox, { backgroundColor: `${s.color ?? "#8b5cf6"}20`, borderRadius: colors.radius - 4 }]}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: s.color ?? "#8b5cf6" }}>{s.name.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{s.name}</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Next: {s.nextBillingDate} {!s.isActive ? "· Inactive" : ""}
              </Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.foreground }]}>
              {fmt(s.amount)}{CYCLE_LABELS[s.billingCycle] ?? ""}
            </Text>
          </View>
        ))}
        <View style={[styles.totalRow, { borderTopWidth: 2, borderTopColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Monthly cost</Text>
          <Text style={[styles.totalValue, { color: colors.expense }]}>{fmt(monthlySubs)}</Text>
        </View>
      </View>

      {/* Quick links */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>QUICK LINKS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: colors.radius }]}>
        {[
          { label: "Open Web App", sub: "Full desktop experience", icon: "external-link" },
          { label: "Scan QR Code", sub: "Test on your device", icon: "smartphone" },
        ].map((item, i) => (
          <TouchableOpacity key={i} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.muted, borderRadius: colors.radius - 4 }]}>
              <Feather name={item.icon as any} size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.label}</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{item.sub}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8, marginTop: 8 },
  card: { borderWidth: 1, marginBottom: 24, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 14 },
  iconBox: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontWeight: "600", marginBottom: 1 },
  rowSub: { fontSize: 12 },
  rowValue: { fontSize: 15, fontWeight: "700" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  totalLabel: { fontSize: 13, fontWeight: "600" },
  totalValue: { fontSize: 17, fontWeight: "800" },
});

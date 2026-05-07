import { Feather } from "@expo/vector-icons";
import { setBaseUrl, useListTransactions, useListAccounts, useListCategories, useCreateTransaction, useDeleteTransaction, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

type NewTxn = { accountId: number; categoryId?: number; amount: string; type: string; description: string; date: string };

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [form, setForm] = useState<NewTxn>({ accountId: 0, amount: "", type: "expense", description: "", date: new Date().toISOString().split("T")[0] });

  const params = { type: (typeFilter as any) || undefined, limit: 100, offset: 0 };
  const { data } = useListTransactions(params);
  const { data: accounts } = useListAccounts();
  const { data: categories } = useListCategories();
  const createTxn = useCreateTransaction();
  const deleteTxn = useDeleteTransaction();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const handleCreate = () => {
    if (!form.amount || !form.accountId) return;
    const accId = form.accountId || accounts?.[0]?.id;
    if (!accId) return;
    createTxn.mutate(
      { data: { accountId: accId, categoryId: form.categoryId, amount: parseFloat(form.amount), type: form.type, description: form.description, date: form.date } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListTransactionsQueryKey(params) });
          setShowAdd(false);
          setForm({ accountId: 0, amount: "", type: "expense", description: "", date: new Date().toISOString().split("T")[0] });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete Transaction", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTxn.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListTransactionsQueryKey(params) }) }) },
    ]);
  };

  const txns = data?.data ?? [];

  const FILTERS = [
    { label: "All", value: "" },
    { label: "Income", value: "income" },
    { label: "Expenses", value: "expense" },
    { label: "Transfer", value: "transfer" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: topPad + (Platform.OS === "web" ? 0 : 8), paddingHorizontal: 20, paddingBottom: 8, backgroundColor: colors.background }}>
        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => setTypeFilter(f.value)}
              style={[styles.chip, { backgroundColor: typeFilter === f.value ? colors.primary : colors.muted, borderRadius: colors.radius - 4 }]}
            >
              <Text style={[styles.chipText, { color: typeFilter === f.value ? "#fff" : colors.foreground }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>{data?.total ?? 0} transactions</Text>
      </View>

      <FlatList
        data={txns}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 100 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item: t }) => (
          <View style={[styles.txnCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: colors.radius }]}>
            <View style={[styles.txnIconWrap, { backgroundColor: t.categoryColor ? `${t.categoryColor}20` : colors.muted, borderRadius: colors.radius - 4 }]}>
              <Feather
                name={t.type === "income" ? "arrow-up-right" : t.type === "transfer" ? "repeat" : "arrow-down-right"}
                size={16}
                color={t.type === "income" ? colors.income : t.type === "transfer" ? colors.transfer : colors.expense}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.txnDesc, { color: colors.foreground }]}>{t.description || "Transaction"}</Text>
              <Text style={[styles.txnMeta, { color: colors.mutedForeground }]}>{t.categoryName ?? "Uncategorized"} · {t.accountName} · {t.date}</Text>
            </View>
            <Text style={[styles.txnAmt, { color: t.type === "income" ? colors.income : colors.foreground }]}>
              {t.type === "income" ? "+" : "-"}{fmt(t.amount)}
            </Text>
            <TouchableOpacity onPress={() => handleDelete(t.id)} style={styles.deleteBtn}>
              <Feather name="trash-2" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="repeat" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No transactions</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Tap + to add your first one</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setShowAdd(true)}
        style={[styles.fab, { backgroundColor: colors.primary, bottom: botPad + 90, borderRadius: 32 }]}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 24, paddingTop: 40 }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Transaction</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Type</Text>
          <View style={styles.typeRow}>
            {["expense", "income", "transfer"].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setForm(f => ({ ...f, type: t }))}
                style={[styles.typeBtn, { backgroundColor: form.type === t ? colors.primary : colors.muted, borderRadius: colors.radius - 4 }]}
              >
                <Text style={{ color: form.type === t ? "#fff" : colors.foreground, textTransform: "capitalize", fontSize: 13, fontWeight: "600" }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius - 4 }]}
            value={form.description}
            onChangeText={(v) => setForm(f => ({ ...f, description: v }))}
            placeholder="e.g. Grocery run"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Amount ($)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius - 4 }]}
            value={form.amount}
            onChangeText={(v) => setForm(f => ({ ...f, amount: v }))}
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Date</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius - 4 }]}
            value={form.date}
            onChangeText={(v) => setForm(f => ({ ...f, date: v }))}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Account</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {accounts?.map((a) => (
              <TouchableOpacity
                key={a.id}
                onPress={() => setForm(f => ({ ...f, accountId: a.id }))}
                style={[styles.chip, { backgroundColor: form.accountId === a.id ? colors.primary : colors.muted, marginRight: 8, borderRadius: colors.radius - 4 }]}
              >
                <Text style={{ color: form.accountId === a.id ? "#fff" : colors.foreground, fontSize: 13 }}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
            {categories?.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setForm(f => ({ ...f, categoryId: form.categoryId === c.id ? undefined : c.id }))}
                style={[styles.chip, { backgroundColor: form.categoryId === c.id ? colors.primary : colors.muted, marginRight: 8, borderRadius: colors.radius - 4 }]}
              >
                <Text style={{ color: form.categoryId === c.id ? "#fff" : colors.foreground, fontSize: 13 }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Pressable
            onPress={handleCreate}
            style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          >
            <Text style={styles.saveBtnText}>Save Transaction</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  chipText: { fontSize: 13, fontWeight: "600" },
  count: { fontSize: 12, marginTop: 4 },
  txnCard: { flexDirection: "row", alignItems: "center", padding: 14, borderWidth: 1 },
  txnIconWrap: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  txnDesc: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  txnMeta: { fontSize: 12 },
  txnAmt: { fontSize: 14, fontWeight: "700", marginRight: 8 },
  deleteBtn: { padding: 4 },
  fab: { position: "absolute", right: 20, width: 56, height: 56, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  emptySub: { fontSize: 14 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: "700" },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { height: 48, paddingHorizontal: 14, marginBottom: 16, fontSize: 15 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  typeBtn: { flex: 1, height: 40, alignItems: "center", justifyContent: "center" },
  saveBtn: { height: 52, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

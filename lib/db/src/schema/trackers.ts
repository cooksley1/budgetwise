import { pgTable, text, serial, timestamp, doublePrecision, date, integer, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Trackers (trips, themes, projects) ────────────────────────────────────
export const trackersTable = pgTable("trackers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'trip' | 'theme'
  description: text("description"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  homeCurrency: text("home_currency").notNull().default("USD"),
  foreignCurrency: text("foreign_currency"),
  dailyBudget: doublePrecision("daily_budget"),
  color: text("color").default("#10b981"),
  icon: text("icon").default("plane"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTrackerSchema = createInsertSchema(trackersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTracker = z.infer<typeof insertTrackerSchema>;
export type Tracker = typeof trackersTable.$inferSelect;

// ── Tracker ↔ Transaction junction ────────────────────────────────────────
export const trackerTransactionsTable = pgTable("tracker_transactions", {
  trackerId: integer("tracker_id").notNull(),
  transactionId: integer("transaction_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.trackerId, t.transactionId] }),
}));

export type TrackerTransaction = typeof trackerTransactionsTable.$inferSelect;

// ── Auto-tagging rules ───────────────────────────────────────────────────
export const trackerRulesTable = pgTable("tracker_rules", {
  id: serial("id").primaryKey(),
  trackerId: integer("tracker_id").notNull(),
  type: text("type").notNull(), // 'date_range' | 'merchant_match' | 'category' | 'currency'
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrackerRuleSchema = createInsertSchema(trackerRulesTable).omit({ id: true, createdAt: true });
export type InsertTrackerRule = z.infer<typeof insertTrackerRuleSchema>;
export type TrackerRule = typeof trackerRulesTable.$inferSelect;

import { pgTable, text, serial, timestamp, doublePrecision, boolean, integer, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  categoryId: integer("category_id"),
  amount: doublePrecision("amount").notNull(),
  type: text("type").notNull(), // income, expense, transfer
  description: text("description"),
  date: date("date").notNull(),
  isRecurring: boolean("is_recurring").notNull().default(false),
  // Multi-currency support: if originalCurrency is set, `amount` is the converted home-currency value
  originalAmount: doublePrecision("original_amount"),
  originalCurrency: text("original_currency"),
  fxRate: doublePrecision("fx_rate"),
  // Optional location metadata (for theme analytics like coffee variance by place)
  merchant: text("merchant"),
  location: text("location"),
  // ── Holiday/memory tracker fields ──────────────────────────────────────
  vendorAddress: text("vendor_address"),
  vendorLat: doublePrecision("vendor_lat"),
  vendorLng: doublePrecision("vendor_lng"),
  items: jsonb("items"), // [{name, qty, price}]
  photoUrl: text("photo_url"),
  mood: text("mood"), // emoji or short note
  companions: text("companions").array(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }), // precise time-of-day for insights
  tipAmount: doublePrecision("tip_amount"),
  weather: jsonb("weather"), // {temp, condition, icon} cached
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;

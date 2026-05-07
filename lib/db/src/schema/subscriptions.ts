import { pgTable, text, serial, timestamp, doublePrecision, boolean, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: doublePrecision("amount").notNull(),
  billingCycle: text("billing_cycle").notNull(), // weekly, monthly, quarterly, annually
  nextBillingDate: date("next_billing_date").notNull(),
  categoryId: integer("category_id"),
  isActive: boolean("is_active").notNull().default(true),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;

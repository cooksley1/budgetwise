import { pgTable, text, serial, timestamp, doublePrecision, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const budgetsTable = pgTable("budgets", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull(),
  limitAmount: doublePrecision("limit_amount").notNull(),
  month: text("month").notNull(), // YYYY-MM
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBudgetSchema = createInsertSchema(budgetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgetsTable.$inferSelect;

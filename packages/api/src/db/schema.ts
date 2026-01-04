import { pgTable, uuid, integer, varchar, text, decimal, boolean, timestamp, unique, index } from "drizzle-orm/pg-core";

// Users linked to Are.na accounts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  arenaUserId: integer("arena_user_id").unique().notNull(),
  arenaUsername: varchar("arena_username", { length: 255 }),
  arenaSlug: varchar("arena_slug", { length: 255 }),
  arenaAccessToken: text("arena_access_token"), // encrypted in production
  walletAddress: varchar("wallet_address", { length: 42 }), // 0x...
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Paywall configurations
export const paywalls = pgTable("paywalls", {
  id: uuid("id").primaryKey().defaultRandom(),
  blockId: integer("block_id").unique().notNull(), // Are.na block ID
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  priceUsdc: decimal("price_usdc", { precision: 10, scale: 6 }).notNull(), // e.g., 0.010000
  recipientWallet: varchar("recipient_wallet", { length: 42 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_paywalls_block_id").on(table.blockId),
  index("idx_paywalls_owner").on(table.ownerUserId),
]);

// Payment records
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  paywallId: uuid("paywall_id").references(() => paywalls.id),
  payerWallet: varchar("payer_wallet", { length: 42 }).notNull(),
  payerUserId: uuid("payer_user_id").references(() => users.id), // NULL for AI agents
  amountUsdc: decimal("amount_usdc", { precision: 10, scale: 6 }).notNull(),
  txHash: varchar("tx_hash", { length: 66 }), // Base transaction hash
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, settled, failed
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_payments_paywall").on(table.paywallId),
]);

// Access grants (tracks who has paid for what)
export const accessGrants = pgTable("access_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  blockId: integer("block_id").notNull(),
  payerWallet: varchar("payer_wallet", { length: 42 }).notNull(),
  paymentId: uuid("payment_id").references(() => payments.id),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
}, (table) => [
  unique("unique_block_payer").on(table.blockId, table.payerWallet),
  index("idx_access_grants_block").on(table.blockId),
  index("idx_access_grants_wallet").on(table.payerWallet),
]);

// Type exports for use in services
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Paywall = typeof paywalls.$inferSelect;
export type NewPaywall = typeof paywalls.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type AccessGrant = typeof accessGrants.$inferSelect;
export type NewAccessGrant = typeof accessGrants.$inferInsert;

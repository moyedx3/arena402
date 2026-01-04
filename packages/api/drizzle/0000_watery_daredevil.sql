CREATE TABLE "access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" integer NOT NULL,
	"payer_wallet" varchar(42) NOT NULL,
	"payment_id" uuid,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_block_payer" UNIQUE("block_id","payer_wallet")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paywall_id" uuid,
	"payer_wallet" varchar(42) NOT NULL,
	"payer_user_id" uuid,
	"amount_usdc" numeric(10, 6) NOT NULL,
	"tx_hash" varchar(66),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paywalls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" integer NOT NULL,
	"owner_user_id" uuid,
	"price_usdc" numeric(10, 6) NOT NULL,
	"recipient_wallet" varchar(42) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "paywalls_block_id_unique" UNIQUE("block_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"arena_user_id" integer NOT NULL,
	"arena_username" varchar(255),
	"arena_slug" varchar(255),
	"arena_access_token" text,
	"wallet_address" varchar(42),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_arena_user_id_unique" UNIQUE("arena_user_id")
);
--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_paywall_id_paywalls_id_fk" FOREIGN KEY ("paywall_id") REFERENCES "public"."paywalls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paywalls" ADD CONSTRAINT "paywalls_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_access_grants_block" ON "access_grants" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "idx_access_grants_wallet" ON "access_grants" USING btree ("payer_wallet");--> statement-breakpoint
CREATE INDEX "idx_payments_paywall" ON "payments" USING btree ("paywall_id");--> statement-breakpoint
CREATE INDEX "idx_paywalls_block_id" ON "paywalls" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "idx_paywalls_owner" ON "paywalls" USING btree ("owner_user_id");
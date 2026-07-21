CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"external_id" text NOT NULL,
	"mask" varchar(50),
	"name" varchar(255) NOT NULL,
	"official_name" varchar(255),
	"type" varchar(50) NOT NULL,
	"subtype" varchar(50),
	"current_balance_cents" integer DEFAULT 0 NOT NULL,
	"available_balance_cents" integer,
	"balance_limit_cents" integer,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balances" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"current" integer NOT NULL,
	"available" integer,
	"limit_amount" integer,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" varchar(255) NOT NULL,
	"norm_name" varchar(255) NOT NULL,
	"kind" varchar(20) DEFAULT 'expense' NOT NULL,
	"parent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_cursors" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"cursor" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_job_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"stage" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"trigger" varchar(20) NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"external_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"date" varchar(10) NOT NULL,
	"authorized_date" varchar(10),
	"name" varchar(500) NOT NULL,
	"merchant_name" varchar(500),
	"pending" boolean DEFAULT false NOT NULL,
	"pending_transaction_external_id" text,
	"payment_channel" varchar(50),
	"iso_currency_code" varchar(3),
	"category_hash" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_cursors" ADD CONSTRAINT "sync_cursors_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_job_stages" ADD CONSTRAINT "sync_job_stages_job_id_sync_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."sync_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_connection_external_id_idx" ON "accounts" USING btree ("connection_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_cursors_connection_resource_type_idx" ON "sync_cursors" USING btree ("connection_id","resource_type");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_account_external_id_idx" ON "transactions" USING btree ("account_id","external_id");
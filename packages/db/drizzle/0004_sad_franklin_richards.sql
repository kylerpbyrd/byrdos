CREATE TABLE "event_log" (
	"id" text PRIMARY KEY NOT NULL,
	"aggregate_id" text NOT NULL,
	"aggregate_type" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "event_log_status_occurred_at_idx" ON "event_log" USING btree ("status","occurred_at");--> statement-breakpoint
CREATE INDEX "balances_account_id_idx" ON "balances" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "balances_account_id_recorded_at_idx" ON "balances" USING btree ("account_id","recorded_at");--> statement-breakpoint
CREATE INDEX "categories_user_id_idx" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "integrations_user_id_idx" ON "integrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "provider_connections_integration_id_idx" ON "provider_connections" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sync_job_stages_job_id_idx" ON "sync_job_stages" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_connection_id_idx" ON "sync_jobs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "transactions_account_id_date_id_idx" ON "transactions" USING btree ("account_id","date","id");
CREATE UNIQUE INDEX "categories_user_norm_name_idx" ON "categories" USING btree ("user_id","norm_name");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_integration_external_id_idx" ON "provider_connections" USING btree ("integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_hash_idx" ON "sessions" USING btree ("refresh_hash");
CREATE TABLE "channel_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"channel" varchar(32) NOT NULL,
	"external_id" varchar(256) NOT NULL,
	"label" varchar(200),
	"enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "app_deployments" CASCADE;--> statement-breakpoint
DROP TABLE "published_apps" CASCADE;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "channel" varchar(32) DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "channel_thread_id" varchar(256);--> statement-breakpoint
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_links_user_idx" ON "channel_links" USING btree ("user_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_links_external_uidx" ON "channel_links" USING btree ("channel","external_id");--> statement-breakpoint
DROP TYPE "public"."app_status";--> statement-breakpoint
DROP TYPE "public"."deployment_status";
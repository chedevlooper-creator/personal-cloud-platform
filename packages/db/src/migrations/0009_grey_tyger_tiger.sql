CREATE TABLE "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"table_name" varchar(120) NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"source_filename" varchar(512),
	"columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"row_count" bigint DEFAULT 0 NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "datasets_user_idx" ON "datasets" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "datasets_user_table_idx" ON "datasets" USING btree ("user_id","table_name");
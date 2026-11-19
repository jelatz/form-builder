CREATE TABLE "form_webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb DEFAULT '["submission.created"]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"form_id" text NOT NULL,
	"client_id" text NOT NULL,
	"submission_id" text,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"request_payload" jsonb NOT NULL,
	"response_status" integer,
	"response_body" text,
	"error_message" text,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "form_webhooks" ADD CONSTRAINT "form_webhooks_form_client_fk" FOREIGN KEY ("form_id","client_id") REFERENCES "public"."forms"("id","client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_form_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."form_webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_webhooks_client_form_idx" ON "form_webhooks" USING btree ("client_id","form_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_client_form_date_idx" ON "webhook_deliveries" USING btree ("client_id","form_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries" USING btree ("webhook_id");
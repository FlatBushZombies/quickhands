CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"clerk_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"image_url" varchar(500),
	"skills" varchar(1000),
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_type" varchar(100) NOT NULL,
	"selected_services" jsonb DEFAULT '[]'::jsonb,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"max_price" numeric(10, 2) DEFAULT '0',
	"specialist_choice" varchar(255),
	"additional_info" text,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"clerk_id" varchar(255) NOT NULL,
	"user_name" varchar(255),
	"user_avatar" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "password" varchar(255) NOT NULL;
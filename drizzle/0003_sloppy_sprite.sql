CREATE TYPE "public"."application_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"freelancer_clerk_id" varchar(255) NOT NULL,
	"freelancer_name" varchar(255),
	"freelancer_email" varchar(255),
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_id_service_request_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."service_request"("id") ON DELETE cascade ON UPDATE no action;
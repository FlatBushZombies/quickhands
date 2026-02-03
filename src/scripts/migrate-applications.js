import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  try {
    console.log("Running job_applications table migration...");
    
    // Create enum type
    await sql`CREATE TYPE "public"."application_status" AS ENUM('pending', 'accepted', 'rejected');`;
    console.log("✓ Created application_status enum");
    
    // Create table
    await sql`
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
    `;
    console.log("✓ Created job_applications table");
    
    // Add foreign key constraint
    await sql`
      ALTER TABLE "job_applications" 
      ADD CONSTRAINT "job_applications_job_id_service_request_id_fk" 
      FOREIGN KEY ("job_id") REFERENCES "public"."service_request"("id") 
      ON DELETE cascade ON UPDATE no action;
    `;
    console.log("✓ Added foreign key constraint");
    
    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

migrate();

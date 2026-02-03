import { pgTable, serial, integer, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { serviceRequest } from "./job.model.js";

export const applicationStatusEnum = pgEnum("application_status", ["pending", "accepted", "rejected"]);

export const jobApplications = pgTable("job_applications", {
  id: serial("id").primaryKey(),
  
  // References
  job_id: integer("job_id").notNull().references(() => serviceRequest.id, { onDelete: 'cascade' }),
  
  // Freelancer information
  freelancer_clerk_id: varchar("freelancer_clerk_id", { length: 255 }).notNull(),
  freelancer_name: varchar("freelancer_name", { length: 255 }),
  freelancer_email: varchar("freelancer_email", { length: 255 }),
  
  // Application status
  status: applicationStatusEnum("status").default("pending").notNull(),
  
  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

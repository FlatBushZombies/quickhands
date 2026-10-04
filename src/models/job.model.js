import { pgTable, serial, varchar, text, numeric, date, jsonb, timestamp } from "drizzle-orm/pg-core";

export const serviceRequest = pgTable("service_request", {
  id: serial("id").primaryKey(),
  
  // Job details
  service_type: varchar("service_type", { length: 100 }).notNull(),
  selected_services: jsonb("selected_services").default([]),
  start_date: date("start_date").notNull(),
  end_date: date("end_date").notNull(),
  // Nullable: a job posted without a budget stores NULL, never 0.
  max_price: numeric("max_price", { precision: 10, scale: 2 }),
  specialist_choice: varchar("specialist_choice", { length: 255 }),
  additional_info: text("additional_info"),
  documents: jsonb("documents").default([]),
  // morning | afternoon | evening | any. NULL when no time was asked for.
  preferred_time: varchar("preferred_time", { length: 16 }),

  // User information (from Clerk)
  clerk_id: varchar("clerk_id", { length: 255 }).notNull(),
  user_name: varchar("user_name", { length: 255 }),
  user_avatar: varchar("user_avatar", { length: 500 }),

  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
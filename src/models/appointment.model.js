import { pgTable, serial, smallint, text, time, timestamp, varchar } from "drizzle-orm/pg-core";

export const specialistAvailability = pgTable("specialist_availability", {
  id: serial("id").primaryKey(),
  specialist_clerk_id: varchar("specialist_clerk_id", { length: 255 }).notNull(),
  day_of_week: smallint("day_of_week").notNull(),
  start_time: time("start_time").notNull(),
  end_time: time("end_time").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// The appointments_no_overlap exclusion constraint (gist, on
// specialist_clerk_id + the scheduled tsrange, for status = 'confirmed')
// is applied directly in the migration — Drizzle has no exclusion-constraint
// builder, so it isn't declared here.
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  specialist_clerk_id: varchar("specialist_clerk_id", { length: 255 }).notNull(),
  client_clerk_id: varchar("client_clerk_id", { length: 255 }).notNull(),
  service_type: varchar("service_type", { length: 255 }),
  scheduled_start: timestamp("scheduled_start").notNull(),
  scheduled_end: timestamp("scheduled_end").notNull(),
  status: varchar("status", { length: 20 }).default("confirmed").notNull(),
  cancelled_by: varchar("cancelled_by", { length: 255 }),
  cancelled_at: timestamp("cancelled_at"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

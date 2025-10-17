import { pgTable, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: varchar("id", { length: 255 }).primaryKey(),

  email: varchar("email", { length: 255 }).notNull(),
  full_name: varchar("full_name", { length: 255 }),
  password: varchar("password", { length: 255 }).notNull(),
  image_url: varchar("image_url", { length: 500 }),

  role: varchar("role", { length: 50 }).notNull().default("user"),

  metadata: jsonb("metadata").default({}),

  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Users table for job matching
export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  clerk_id: varchar("clerk_id", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  full_name: varchar("full_name", { length: 255 }),
  image_url: varchar("image_url", { length: 500 }),
  skills: varchar("skills", { length: 1000 }), // For job matching
  role: varchar("role", { length: 50 }).notNull().default("user"),
  metadata: jsonb("metadata").default({}),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

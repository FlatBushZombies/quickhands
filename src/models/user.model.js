import { pgTable, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: varchar("id", { length: 255 }).primaryKey(),

  email: varchar("email", { length: 255 }).notNull(),
  full_name: varchar("full_name", { length: 255 }),
  image_url: varchar("image_url", { length: 500 }),

  role: varchar("role", { length: 50 }).notNull().default("user"),

  metadata: jsonb("metadata").default({}),

  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

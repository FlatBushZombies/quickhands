import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  job_id: integer("job_id").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
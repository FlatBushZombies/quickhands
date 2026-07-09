import { boolean, integer, pgTable, serial, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  job_id: integer("job_id").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  // Machine-readable kind (e.g. "message", "application_accepted") and the
  // conversation it relates to, if any — used to deep-link a tap straight
  // to the right screen instead of just opening the app.
  type: varchar("type", { length: 64 }),
  conversation_id: uuid("conversation_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

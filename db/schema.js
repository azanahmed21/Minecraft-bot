const { pgTable, serial, text, timestamp } = require("drizzle-orm/pg-core");

const chatLogs = pgTable("chat_logs", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  message: text("message").notNull(),
  response: text("response").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

module.exports = { chatLogs };

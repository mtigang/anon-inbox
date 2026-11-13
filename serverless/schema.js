import { table, integer, text, sql } from 'sdk/db';

export const users = table('users', {
  userId: integer('user_id').primaryKey(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  role: text('role').notNull().default('user'),
  blocked: integer('blocked').notNull().default(0),
  started: integer('started').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  lastSeen: integer('last_seen', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const messages = table('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull().default('unread'), // unread | read | replied
  ownerReply: text('owner_reply'),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  readAt: integer('read_at', { mode: 'timestamp' }),
});

export const settings = table('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

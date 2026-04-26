import type Database from "better-sqlite3";

export type ChatRole = "user" | "assistant";
export type ChatMode = "socratic" | "hints" | "style" | "interview";

export type ChatMessage = {
  id: number;
  user_id: number;
  problem_id: number;
  role: ChatRole;
  content: string;
  mode: ChatMode;
  created_at: number;
};

export type NewChatMessage = Omit<ChatMessage, "id" | "created_at">;

export function saveMessage(db: Database.Database, m: NewChatMessage): number {
  const info = db
    .prepare(
      `INSERT INTO chat_messages (user_id, problem_id, role, content, mode)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(m.user_id, m.problem_id, m.role, m.content, m.mode);
  return Number(info.lastInsertRowid);
}

export function listMessages(
  db: Database.Database,
  userId: number,
  problemId: number,
): ChatMessage[] {
  return db
    .prepare(
      `SELECT id, user_id, problem_id, role, content, mode, created_at
       FROM chat_messages
       WHERE user_id = ? AND problem_id = ?
       ORDER BY created_at ASC, id ASC`,
    )
    .all(userId, problemId) as ChatMessage[];
}

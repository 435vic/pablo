import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("pablo.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS linked_users (
    did TEXT PRIMARY KEY,
    mcid TEXT
  )
`);

export default db;


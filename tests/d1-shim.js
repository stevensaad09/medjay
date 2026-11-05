// Minimal Cloudflare D1 stand-in over Node's built-in node:sqlite, for
// tests only. Applies the real migration file. No npm dependencies.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const MIGRATION = new URL('../migrations/0003_exams.sql', import.meta.url);

class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.db, this.sql, args); }
  async first() {
    this.db.calls.push(this.sql);
    return this.db.raw.prepare(this.sql).get(...this.args) ?? null;
  }
  async all() {
    this.db.calls.push(this.sql);
    return { results: this.db.raw.prepare(this.sql).all(...this.args), success: true };
  }
  async run() {
    this.db.calls.push(this.sql);
    if (this.db.failNext && this.db.failNext(this.sql)) {
      this.db.failNext = null;
      throw new Error('D1_ERROR: forced');
    }
    const r = this.db.raw.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}

export function makeD1({ migrate = true } = {}) {
  const raw = new DatabaseSync(':memory:');
  if (migrate) raw.exec(readFileSync(MIGRATION, 'utf8'));
  const db = { raw, calls: [], failNext: null, prepare(sql) { return new Stmt(db, sql); } };
  return db;
}

// Random DUMMY keys for tests only. Never production data.
export function seedDummyKeys(db, slug, total = 20) {
  const letters = 'ABCD';
  let key = '';
  const ins = db.raw.prepare('INSERT INTO exam_keys (course_slug, question_no, correct) VALUES (?, ?, ?)');
  for (let n = 1; n <= total; n++) {
    const c = letters[Math.floor(Math.random() * 4)];
    key += c;
    ins.run(slug, n, c);
  }
  return key;
}

// An answer string with exactly `score` letters matching `key`.
export function answersWithScore(key, score) {
  return [...key].map((c, i) => (i < score ? c : 'ABCD'[('ABCD'.indexOf(c) + 1) % 4])).join('');
}

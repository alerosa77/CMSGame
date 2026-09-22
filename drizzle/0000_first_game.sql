CREATE TABLE IF NOT EXISTS game_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phase TEXT NOT NULL DEFAULT 'lobby',
  question_index INTEGER NOT NULL DEFAULT 0,
  round_id INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS answers (
  player_id TEXT NOT NULL,
  round_id INTEGER NOT NULL,
  option_index INTEGER NOT NULL,
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, round_id)
);
CREATE INDEX IF NOT EXISTS idx_answers_round_id ON answers(round_id);
INSERT OR IGNORE INTO game_state (id, phase, question_index, round_id) VALUES (1, 'lobby', 0, 0);
CREATE TABLE IF NOT EXISTS numeric_rounds (
  round_id INTEGER PRIMARY KEY,
  question_index INTEGER NOT NULL,
  guesser_id TEXT NOT NULL,
  guess_value REAL,
  deadline_at INTEGER NOT NULL,
  finalized INTEGER NOT NULL DEFAULT 0,
  guess_points INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS numeric_answers (
  player_id TEXT NOT NULL,
  round_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  value TEXT NOT NULL,
  answered_at INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, round_id)
);

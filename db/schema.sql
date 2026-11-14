PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL CHECK (email = lower(email)),
  name TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  size INTEGER,
  created_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_images_user_id ON images (user_id);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  merchant TEXT,
  amount_cents INTEGER NOT NULL,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Alimentação', 'Transporte', 'Educação', 'Lazer', 'Outros')),
  note TEXT,
  source TEXT CHECK (source IN ('image', 'text', 'manual')),
  status TEXT CHECK (status IN ('confirmed', 'needs_review')) DEFAULT 'confirmed',
  confidence_json TEXT,
  image_id TEXT,
  dedupe_hash TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_dedupe ON expenses (user_id, dedupe_hash);

CREATE TABLE IF NOT EXISTS budgets (
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Alimentação', 'Transporte', 'Educação', 'Lazer', 'Outros')),
  limit_cents INTEGER NOT NULL CHECK (limit_cents >= 0),
  alert_percent INTEGER DEFAULT 80 CHECK (alert_percent BETWEEN 1 AND 100),
  PRIMARY KEY (user_id, category),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS merchant_rules (
  user_id TEXT NOT NULL,
  merchant_norm TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Alimentação', 'Transporte', 'Educação', 'Lazer', 'Outros')),
  updated_at TEXT,
  PRIMARY KEY (user_id, merchant_norm),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT NOT NULL,
  attempted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_key ON login_attempts (key);

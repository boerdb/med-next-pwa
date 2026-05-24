-- Voer uit op bestaande medtracker-database (na eerdere schema.sql)
USE medtracker;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint_hash CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  subscription_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_push_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS push_reminder_flags (
  user_id CHAR(36) NOT NULL,
  slot_key VARCHAR(80) NOT NULL,
  first_sent TINYINT(1) NOT NULL DEFAULT 0,
  second_sent TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, slot_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

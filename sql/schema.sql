-- MedTracker MySQL schema
-- Run in phpMyAdmin as root, then create app user (do not use root in the app).

CREATE DATABASE IF NOT EXISTS medtracker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE medtracker;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  times JSON NOT NULL,
  stock_count INT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_medications_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS log_entries (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  medication_id CHAR(36) NOT NULL,
  medication_name VARCHAR(255) NOT NULL,
  date_key CHAR(10) NOT NULL,
  time CHAR(5) NOT NULL,
  status ENUM('taken', 'skipped') NOT NULL,
  updated_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_log_slot (user_id, medication_id, date_key, time),
  INDEX idx_logs_user_date (user_id, date_key)
) ENGINE=InnoDB;

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

-- App user (change password before production):
-- CREATE USER 'medtracker'@'localhost' IDENTIFIED BY 'your-strong-password';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON medtracker.* TO 'medtracker'@'localhost';
-- FLUSH PRIVILEGES;

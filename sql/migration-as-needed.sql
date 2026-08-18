-- Zo nodig (PRN): geen vast schema, niet als gemist tellen
USE medtracker;

ALTER TABLE medications
  ADD COLUMN as_needed TINYINT(1) NOT NULL DEFAULT 0 AFTER course_days;

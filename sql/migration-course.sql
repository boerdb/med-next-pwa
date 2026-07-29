-- Kuur (tijdelijke medicatie): startdatum + duur in dagen
USE medtracker;

ALTER TABLE medications
  ADD COLUMN course_start_date CHAR(10) NULL AFTER stock_count,
  ADD COLUMN course_days INT NULL AFTER course_start_date;

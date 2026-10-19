-- Datum waarop een medicijn is toegevoegd (YYYY-MM-DD, Europe/Amsterdam).
-- Geschiedenis telt dagen vóór deze datum niet als gemist. NULL = geen beperking.
USE medtracker;

ALTER TABLE medications
  ADD COLUMN created_date CHAR(10) NULL AFTER as_needed;

-- Bestaande medicijnen: eerste dag waarop er iets gelogd is.
UPDATE medications m
  SET m.created_date = (
    SELECT MIN(l.date_key) FROM log_entries l
    WHERE l.medication_id = m.id AND l.user_id = m.user_id
  );

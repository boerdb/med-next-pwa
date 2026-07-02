-- Voeg weekdagen-planning toe aan bestaande databases.
-- NULL = elke dag (bestaand gedrag). Veilig opnieuw uit te voeren als kolom al bestaat.

USE medtracker;

ALTER TABLE medications
  ADD COLUMN days_of_week JSON NULL AFTER times;

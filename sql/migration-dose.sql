-- Dosering (hoeveelheid + eenheid) bij medicijnen.
-- NULL = geen dosering ingevuld. Veilig opnieuw uit te voeren als kolommen al bestaan.

USE medtracker;

ALTER TABLE medications
  ADD COLUMN dose_amount DECIMAL(10, 3) NULL AFTER name,
  ADD COLUMN dose_unit VARCHAR(8) NULL AFTER dose_amount;

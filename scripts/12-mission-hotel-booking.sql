-- Optional hotel-booking planning flag for missions.

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS requires_hotel_booking BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_missions_requires_hotel_booking
  ON missions(requires_hotel_booking);

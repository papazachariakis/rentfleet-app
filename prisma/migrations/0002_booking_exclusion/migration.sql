ALTER TABLE \"Booking\"
ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
  \"vehicleId\" WITH =,
  daterange(\"pickupDate\", \"returnDate\", '[)') WITH &&
)
WHERE (\"deletedAt\" IS NULL AND \"status\" IN ('PENDING','CONFIRMED','ACTIVE'));

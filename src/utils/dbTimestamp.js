// The Neon HTTP driver returns `timestamp` (without time zone) columns as
// "YYYY-MM-DD HH:MM:SS" strings with no zone marker. `new Date(...)` on that
// exact shape is parsed as LOCAL time per the ECMA-262 fallback behavior,
// while every appointment timestamp this app writes is built from
// `.toISOString()` (a UTC instant). Reading it back without normalizing
// first silently reinterprets it in the server's local zone.
export function parseDbTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const isoLike = String(value).replace(" ", "T");
  return new Date(isoLike.endsWith("Z") ? isoLike : `${isoLike}Z`);
}

export function dbTimestampToIso(value) {
  const date = parseDbTimestamp(value);
  return date ? date.toISOString() : null;
}

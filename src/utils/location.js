const DEFAULT_NEARBY_RADIUS_KM = 35;

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function trimOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeLocationPayload(payload = {}) {
  const latitude = toFiniteNumber(
    payload.latitude ?? payload.lat ?? payload.locationLatitude ?? payload.location?.latitude
  );
  const longitude = toFiniteNumber(
    payload.longitude ?? payload.lng ?? payload.lon ?? payload.locationLongitude ?? payload.location?.longitude
  );
  const city =
    trimOptionalString(payload.city) ||
    trimOptionalString(payload.locationCity) ||
    trimOptionalString(payload.location?.city) ||
    null;
  const label =
    trimOptionalString(payload.label) ||
    trimOptionalString(payload.locationLabel) ||
    trimOptionalString(payload.locationName) ||
    trimOptionalString(payload.location?.label) ||
    city ||
    null;
  const radiusKm = toFiniteNumber(
    payload.radiusKm ?? payload.nearbyRadiusKm ?? payload.locationRadiusKm ?? payload.location?.radiusKm
  );

  return {
    latitude,
    longitude,
    city,
    label,
    radiusKm: radiusKm ?? DEFAULT_NEARBY_RADIUS_KM,
  };
}

export function hasCoordinates(location) {
  return Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude);
}

export function calculateDistanceKm(origin, destination) {
  if (!hasCoordinates(origin) || !hasCoordinates(destination)) {
    return null;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(destination.latitude - origin.latitude);
  const deltaLongitude = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function roundDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return null;
  }

  return Number(distanceKm.toFixed(distanceKm < 10 ? 1 : 0));
}

export function sameAreaByCity(origin, destination) {
  const originCity = trimOptionalString(origin?.city).toLowerCase();
  const destinationCity = trimOptionalString(destination?.city).toLowerCase();

  if (!originCity || !destinationCity) {
    return false;
  }

  return originCity === destinationCity;
}

export function isInYourArea({ viewerLocation, targetLocation, radiusKm = DEFAULT_NEARBY_RADIUS_KM }) {
  const distanceKm = calculateDistanceKm(viewerLocation, targetLocation);
  if (Number.isFinite(distanceKm)) {
    return distanceKm <= radiusKm;
  }

  return sameAreaByCity(viewerLocation, targetLocation);
}

export function annotateLocationMatch({
  viewerLocation,
  targetLocation,
  radiusKm = DEFAULT_NEARBY_RADIUS_KM,
}) {
  const distanceKm = calculateDistanceKm(viewerLocation, targetLocation);
  const inYourArea = isInYourArea({ viewerLocation, targetLocation, radiusKm });

  return {
    radiusKm,
    inYourArea,
    distanceKm: roundDistanceKm(distanceKm),
    cityMatch: sameAreaByCity(viewerLocation, targetLocation),
  };
}

export function buildInYourAreaPhrase(locationMatch) {
  if (!locationMatch?.inYourArea) {
    return "";
  }

  return locationMatch.distanceKm !== null
    ? ` in your area (${locationMatch.distanceKm} km away)`
    : " in your area";
}

export { DEFAULT_NEARBY_RADIUS_KM };

const db = require('./db');

// Haversine distance in km
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Rough ETA: assume avg 28 km/h on highway/mixed roads
function estimateEtaMinutes(km) {
  return Math.max(3, Math.round((km / 28) * 60));
}

const SERVICE_TYPE_MAP = {
  MECHANIC: 'MECHANIC',
  FUEL_PARTNER: 'FUEL_PARTNER',
  TOWING: 'TOWING',
  EV_CHARGING: 'EV_CHARGING',
  OTHER: 'OTHER',
};

// Provider Score = Distance 40% + ETA 25% + Availability 15% + Reliability 10% + Rating 10%
function scoreProvider(p, distance, eta, maxDistance, maxEta) {
  const distanceScore = 1 - Math.min(distance / (maxDistance || distance || 1), 1);
  const etaScore = 1 - Math.min(eta / (maxEta || eta || 1), 1);
  const availabilityScore = p.status === 'ACTIVE' && p.isEmergencyAvailable ? 1 : 0;
  const reliabilityScore = p.reliabilityScore ?? 0.5;
  const ratingScore = (p.rating ?? 4) / 5;

  return (
    distanceScore * 0.4 +
    etaScore * 0.25 +
    availabilityScore * 0.15 +
    reliabilityScore * 0.1 +
    ratingScore * 0.1
  );
}

/**
 * Find & rank nearby providers for a given provider type, within radiusKm.
 * Only ACTIVE + verified providers are eligible; offline/busy/suspended never win.
 */
function findNearbyProviders({ type, latitude, longitude, radiusKm = 50, limit = 10 }) {
  const rows = db
    .prepare(`SELECT * FROM Provider WHERE type = ? AND verified = 1`)
    .all(type);

  const withDistance = rows
    .map((p) => {
      const originLat = p.currentLat ?? p.latitude;
      const originLng = p.currentLng ?? p.longitude;
      const distance = distanceKm(latitude, longitude, originLat, originLng);
      const eta = estimateEtaMinutes(distance);
      return { ...p, distanceKm: Math.round(distance * 10) / 10, etaMinutes: eta };
    })
    .filter((p) => p.distanceKm <= radiusKm);

  // Only ACTIVE providers can normally receive new requests.
  const eligible = withDistance.filter((p) => p.status === 'ACTIVE' && p.isEmergencyAvailable);
  const maxDistance = Math.max(...withDistance.map((p) => p.distanceKm), 1);
  const maxEta = Math.max(...withDistance.map((p) => p.etaMinutes), 1);

  const ranked = eligible
    .map((p) => ({ ...p, score: scoreProvider(p, p.distanceKm, p.etaMinutes, maxDistance, maxEta) }))
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, limit);
}

module.exports = { distanceKm, estimateEtaMinutes, findNearbyProviders, scoreProvider };

const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../lib/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { findNearbyProviders, distanceKm, estimateEtaMinutes } = require('../lib/matching');
const { emitEmergencyEvent } = require('../sockets/io');

const router = express.Router();

function logEvent(emergencyId, label) {
  db.prepare(`INSERT INTO EmergencyEvent (id, emergencyRequestId, label) VALUES (?,?,?)`).run(uuid(), emergencyId, label);
}

function getEmergency(id) {
  return db.prepare(`SELECT * FROM EmergencyRequest WHERE id = ?`).get(id);
}

function timeline(id) {
  return db.prepare(`SELECT * FROM EmergencyEvent WHERE emergencyRequestId = ? ORDER BY timestamp ASC`).all(id);
}

function assertOwnEmergencyOrPrivileged(req, emergency) {
  if (req.user.role === 'SUPER_ADMIN') return true;
  if (req.user.role === 'USER' && emergency.userId === req.user.id) return true;
  if (req.user.role === 'PROVIDER' && emergency.assignedProviderId === req.user.providerId) return true;
  return false;
}

// Create an emergency request. Auto-matches the best ACTIVE provider of the requested type.
router.post('/', authRequired, requireRole('USER', 'SUPER_ADMIN'), (req, res) => {
  const b = req.body;
  const id = uuid();
  const typeToProviderType = {
    FUEL_EMPTY: 'FUEL_PARTNER',
    ENGINE_FAILURE: 'MECHANIC',
    BATTERY: 'MECHANIC',
    TYRE: 'MECHANIC',
    OVERHEATING: 'MECHANIC',
    ACCIDENT: 'TOWING',
    TOWING: 'TOWING',
    OTHER: 'MECHANIC',
  };
  const providerType = b.providerType || typeToProviderType[b.type] || 'MECHANIC';
  const userId = (req.user.role === 'SUPER_ADMIN' && b.userId) ? b.userId : req.user.id;

  db.prepare(`INSERT INTO EmergencyRequest (id,userId,vehicle,type,description,photo,latitude,longitude,roadName,status,priority)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, userId, b.vehicle || null, b.type, b.description || null, b.photo || null,
    b.latitude, b.longitude, b.roadName || null, 'REQUESTED', b.priority || 'NORMAL'
  );
  logEvent(id, `🚨 Emergency Request Created`);
  logEvent(id, `📍 Location Detected`);

  const matches = findNearbyProviders({ type: providerType, latitude: b.latitude, longitude: b.longitude });
  const best = matches[0];

  let emergency = getEmergency(id);
  if (best) {
    db.prepare(`UPDATE EmergencyRequest SET assignedProviderId=?, status='ASSIGNED', distanceKm=?, etaMinutes=? WHERE id=?`)
      .run(best.id, best.distanceKm, best.etaMinutes, id);
    logEvent(id, `${best.name} Found`);
    emergency = getEmergency(id);
    emitEmergencyEvent('emergency:created', emergency);
    emitEmergencyEvent('emergency:assigned', emergency);
  } else {
    emitEmergencyEvent('emergency:created', emergency);
  }

  res.status(201).json({ emergency: getEmergency(id), matchedProvider: best || null, candidates: matches });
});

router.get('/:id', authRequired, (req, res) => {
  const emergency = getEmergency(req.params.id);
  if (!emergency) return res.status(404).json({ error: 'Not found' });
  if (!assertOwnEmergencyOrPrivileged(req, emergency)) return res.status(403).json({ error: 'Forbidden' });
  const provider = emergency.assignedProviderId
    ? db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(emergency.assignedProviderId)
    : null;
  res.json({ emergency, provider, timeline: timeline(req.params.id) });
});

// Manually (re)assign — admin only
router.post('/:id/assign', authRequired, requireRole('SUPER_ADMIN'), (req, res) => {
  const { providerId } = req.body;
  const emergency = getEmergency(req.params.id);
  if (!emergency) return res.status(404).json({ error: 'Not found' });
  const provider = db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(providerId);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  const dist = distanceKm(emergency.latitude, emergency.longitude, provider.currentLat ?? provider.latitude, provider.currentLng ?? provider.longitude);
  const eta = estimateEtaMinutes(dist);
  db.prepare(`UPDATE EmergencyRequest SET assignedProviderId=?, status='ASSIGNED', distanceKm=?, etaMinutes=? WHERE id=?`)
    .run(providerId, Math.round(dist * 10) / 10, eta, req.params.id);
  logEvent(req.params.id, `🔁 Reassigned to ${provider.name} by admin`);
  const updated = getEmergency(req.params.id);
  emitEmergencyEvent('emergency:assigned', updated);
  res.json(updated);
});

router.post('/:id/accept', authRequired, requireRole('PROVIDER', 'SUPER_ADMIN'), (req, res) => {
  const emergency = getEmergency(req.params.id);
  if (!emergency) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'PROVIDER' && emergency.assignedProviderId !== req.user.providerId) {
    return res.status(403).json({ error: 'Forbidden: not assigned to you' });
  }
  db.prepare(`UPDATE EmergencyRequest SET status='ACCEPTED', acceptedAt=datetime('now') WHERE id=?`).run(req.params.id);
  logEvent(req.params.id, `✅ Request Accepted`);
  db.prepare(`UPDATE EmergencyRequest SET status='ON_THE_WAY', startedAt=datetime('now') WHERE id=?`).run(req.params.id);
  logEvent(req.params.id, `🚗 Provider Started`);
  const updated = getEmergency(req.params.id);
  emitEmergencyEvent('emergency:accepted', updated);
  emitEmergencyEvent('emergency:started', updated);
  res.json(updated);
});

router.post('/:id/decline', authRequired, requireRole('PROVIDER', 'SUPER_ADMIN'), (req, res) => {
  const emergency = getEmergency(req.params.id);
  if (!emergency) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'PROVIDER' && emergency.assignedProviderId !== req.user.providerId) {
    return res.status(403).json({ error: 'Forbidden: not assigned to you' });
  }
  const providerType = req.body.providerType || 'MECHANIC';
  logEvent(req.params.id, `❌ Declined by assigned provider`);
  // re-match, excluding the declining provider
  const matches = findNearbyProviders({ type: providerType, latitude: emergency.latitude, longitude: emergency.longitude })
    .filter((p) => p.id !== emergency.assignedProviderId);
  const next = matches[0];
  if (next) {
    db.prepare(`UPDATE EmergencyRequest SET assignedProviderId=?, status='ASSIGNED', distanceKm=?, etaMinutes=? WHERE id=?`)
      .run(next.id, next.distanceKm, next.etaMinutes, req.params.id);
    logEvent(req.params.id, `${next.name} Found`);
  } else {
    db.prepare(`UPDATE EmergencyRequest SET assignedProviderId=NULL, status='REQUESTED' WHERE id=?`).run(req.params.id);
  }
  const updated = getEmergency(req.params.id);
  emitEmergencyEvent('emergency:declined', updated);
  if (next) emitEmergencyEvent('emergency:assigned', updated);
  res.json(updated);
});

router.post('/:id/start', authRequired, requireRole('PROVIDER', 'SUPER_ADMIN'), (req, res) => {
  db.prepare(`UPDATE EmergencyRequest SET status='ON_THE_WAY', startedAt=datetime('now') WHERE id=?`).run(req.params.id);
  logEvent(req.params.id, `🚗 Provider Started`);
  const updated = getEmergency(req.params.id);
  emitEmergencyEvent('emergency:started', updated);
  res.json(updated);
});

router.post('/:id/arrived', authRequired, requireRole('PROVIDER', 'SUPER_ADMIN'), (req, res) => {
  db.prepare(`UPDATE EmergencyRequest SET status='ARRIVED', arrivedAt=datetime('now'), etaMinutes=0 WHERE id=?`).run(req.params.id);
  logEvent(req.params.id, `🔧 Provider Arrived`);
  const updated = getEmergency(req.params.id);
  emitEmergencyEvent('emergency:arrived', updated);
  res.json(updated);
});

router.post('/:id/complete', authRequired, requireRole('PROVIDER', 'SUPER_ADMIN'), (req, res) => {
  const { note } = req.body;
  db.prepare(`UPDATE EmergencyRequest SET status='COMPLETED', completedAt=datetime('now') WHERE id=?`).run(req.params.id);
  logEvent(req.params.id, `✅ Repair/Service Completed${note ? ': ' + note : ''}`);
  const updated = getEmergency(req.params.id);
  emitEmergencyEvent('emergency:completed', updated);
  res.json(updated);
});

router.post('/:id/cancel', authRequired, (req, res) => {
  const emergency = getEmergency(req.params.id);
  if (!emergency) return res.status(404).json({ error: 'Not found' });
  if (!assertOwnEmergencyOrPrivileged(req, emergency)) return res.status(403).json({ error: 'Forbidden' });
  db.prepare(`UPDATE EmergencyRequest SET status='CANCELLED' WHERE id=?`).run(req.params.id);
  logEvent(req.params.id, `🛑 Cancelled`);
  const updated = getEmergency(req.params.id);
  emitEmergencyEvent('emergency:cancelled', updated);
  res.json(updated);
});

// Update provider's live location + push new ETA (used by simulate movement)
router.post('/:id/tracking', authRequired, requireRole('PROVIDER', 'SUPER_ADMIN'), (req, res) => {
  const emergency = getEmergency(req.params.id);
  if (!emergency) return res.status(404).json({ error: 'Not found' });
  const { latitude, longitude } = req.body;
  const dist = distanceKm(emergency.latitude, emergency.longitude, latitude, longitude);
  const eta = estimateEtaMinutes(dist);
  db.prepare(`INSERT INTO EmergencyTracking (id, emergencyRequestId, providerId, latitude, longitude, etaMinutes) VALUES (?,?,?,?,?,?)`)
    .run(uuid(), req.params.id, emergency.assignedProviderId, latitude, longitude, eta);
  db.prepare(`UPDATE EmergencyRequest SET etaMinutes=?, distanceKm=? WHERE id=?`).run(eta, Math.round(dist * 10) / 10, req.params.id);
  if (emergency.assignedProviderId) {
    db.prepare(`UPDATE Provider SET currentLat=?, currentLng=? WHERE id=?`).run(latitude, longitude, emergency.assignedProviderId);
  }
  const updated = getEmergency(req.params.id);
  emitEmergencyEvent('provider:location', { ...updated, providerLat: latitude, providerLng: longitude });
  emitEmergencyEvent('emergency:eta_updated', updated);
  res.json({ etaMinutes: eta, distanceKm: Math.round(dist * 10) / 10 });
});

// Active emergencies for the requesting user
router.get('/', authRequired, (req, res) => {
  if (req.user.role === 'SUPER_ADMIN') {
    const all = db.prepare(`SELECT * FROM EmergencyRequest ORDER BY createdAt DESC LIMIT 100`).all();
    return res.json(all);
  }
  if (req.user.role === 'PROVIDER') {
    const rows = db.prepare(`SELECT * FROM EmergencyRequest WHERE assignedProviderId = ? ORDER BY createdAt DESC`).all(req.user.providerId);
    return res.json(rows);
  }
  const rows = db.prepare(`SELECT * FROM EmergencyRequest WHERE userId = ? ORDER BY createdAt DESC`).all(req.user.id);
  res.json(rows);
});

module.exports = router;

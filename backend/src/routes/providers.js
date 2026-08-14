const express = require('express');
const db = require('../lib/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { findNearbyProviders } = require('../lib/matching');

const router = express.Router();

function serialize(p) {
  return {
    ...p,
    services: JSON.parse(p.services || '[]'),
    fuelTypes: JSON.parse(p.fuelTypes || '[]'),
    vehicleTypes: JSON.parse(p.vehicleTypes || '[]'),
    verified: !!p.verified,
    is247: !!p.is247,
    isEmergencyAvailable: !!p.isEmergencyAvailable,
  };
}

// GET /api/providers/nearby?type=MECHANIC&lat=..&lng=..&radius=50
router.get('/nearby', authRequired, (req, res) => {
  const { type, lat, lng, radius } = req.query;
  if (!type || !lat || !lng) return res.status(400).json({ error: 'type, lat, lng required' });
  const ranked = findNearbyProviders({
    type,
    latitude: parseFloat(lat),
    longitude: parseFloat(lng),
    radiusKm: radius ? parseFloat(radius) : 50,
  });
  res.json(ranked.map(serialize));
});

router.get('/:id', authRequired, (req, res) => {
  const p = db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(serialize(p));
});

// A provider can only touch its own profile/availability — enforced server-side via req.user.providerId
router.patch('/:id/availability', authRequired, requireRole('PROVIDER', 'SUPER_ADMIN'), (req, res) => {
  if (req.user.role === 'PROVIDER' && req.user.providerId !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden: not your provider profile' });
  }
  const { status } = req.body; // ACTIVE|BUSY|OFFLINE
  if (!['ACTIVE', 'BUSY', 'OFFLINE'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare(`UPDATE Provider SET status=?, updatedAt=datetime('now') WHERE id=?`).run(status, req.params.id);
  res.json(serialize(db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(req.params.id)));
});

router.put('/:id/profile', authRequired, requireRole('PROVIDER', 'SUPER_ADMIN'), (req, res) => {
  if (req.user.role === 'PROVIDER' && req.user.providerId !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden: not your provider profile' });
  }
  const p = db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const b = req.body;
  db.prepare(`UPDATE Provider SET phone=?, whatsapp=?, address=?, updatedAt=datetime('now') WHERE id=?`).run(
    b.phone ?? p.phone, b.whatsapp ?? p.whatsapp, b.address ?? p.address, req.params.id
  );
  res.json(serialize(db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(req.params.id)));
});

// Provider dashboard summary — own requests only
router.get('/:id/dashboard', authRequired, requireRole('PROVIDER', 'SUPER_ADMIN'), (req, res) => {
  if (req.user.role === 'PROVIDER' && req.user.providerId !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden: not your provider profile' });
  }
  const provider = db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Not found' });

  const today = new Date().toISOString().slice(0, 10);
  const todaysRequests = db.prepare(
    `SELECT COUNT(*) c FROM EmergencyRequest WHERE assignedProviderId = ? AND date(createdAt) = ?`
  ).get(req.params.id, today).c;
  const active = db.prepare(
    `SELECT COUNT(*) c FROM EmergencyRequest WHERE assignedProviderId = ? AND status IN ('ASSIGNED','ACCEPTED','ON_THE_WAY','ARRIVED','DIAGNOSING','REPAIRING','WAITING_FOR_PART')`
  ).get(req.params.id).c;
  const completed = db.prepare(
    `SELECT COUNT(*) c FROM EmergencyRequest WHERE assignedProviderId = ? AND status = 'COMPLETED' AND date(createdAt) = ?`
  ).get(req.params.id, today).c;

  const newRequests = db.prepare(
    `SELECT er.*, u.name as userName, u.phone as userPhone 
     FROM EmergencyRequest er
     JOIN User u ON er.userId = u.id
     WHERE er.assignedProviderId = ? AND er.status = 'ASSIGNED' 
     ORDER BY er.createdAt DESC`
  ).all(req.params.id);
  const activeRequest = db.prepare(
    `SELECT er.*, u.name as userName, u.phone as userPhone 
     FROM EmergencyRequest er
     JOIN User u ON er.userId = u.id
     WHERE er.assignedProviderId = ? AND er.status IN ('ACCEPTED','ON_THE_WAY','ARRIVED','DIAGNOSING','REPAIRING','WAITING_FOR_PART') 
     ORDER BY er.createdAt DESC LIMIT 1`
  ).get(req.params.id);
  const completedList = db.prepare(
    `SELECT * FROM EmergencyRequest WHERE assignedProviderId = ? AND status = 'COMPLETED' ORDER BY completedAt DESC LIMIT 20`
  ).all(req.params.id);

  res.json({
    provider: serialize(provider),
    stats: { todaysRequests, active, completed, rating: provider.rating },
    newRequests,
    activeRequest: activeRequest || null,
    completed: completedList,
  });
});

module.exports = router;

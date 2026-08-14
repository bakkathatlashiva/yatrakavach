const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../lib/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { distanceKm, estimateEtaMinutes } = require('../lib/matching');
const { emitEmergencyEvent } = require('../sockets/io');

const router = express.Router();

function logEvent(emergencyId, label) {
  db.prepare(`INSERT INTO EmergencyEvent (id, emergencyRequestId, label) VALUES (?,?,?)`).run(uuid(), emergencyId, label);
}

// Public info
router.get('/scenario', (req, res) => {
  res.json({
    traveller: { name: 'Demo Traveller', phone: '9999911111' },
    location: { name: 'Bhadrachalam Highway', latitude: 17.6688, longitude: 80.8933 },
    vehicle: { model: 'Hyundai Creta', fuelPercent: 35, status: 'Running' },
    providers: { mechanic: "Shiva's Garage", fuel: "Shiva's Bunk" },
  });
});

// Reset the two demo providers back to their starting "far" position, and clear active requests
router.post('/reset', authRequired, requireRole('SUPER_ADMIN'), (req, res) => {
  db.prepare(`UPDATE Provider SET currentLat=17.6112, currentLng=80.8127, status='ACTIVE' WHERE name=?`).run("Shiva's Garage");
  db.prepare(`UPDATE Provider SET currentLat=17.5701, currentLng=80.7654, status='ACTIVE' WHERE name=?`).run("Shiva's Bunk");
  
  // Clean up previous demo requests to make demo easily repeatable
  const demoUser = db.prepare(`SELECT id FROM User WHERE phone='9999911111'`).get();
  if (demoUser) {
    db.prepare(`DELETE FROM EmergencyRequest WHERE userId = ?`).run(demoUser.id);
  }
  
  res.json({ reset: true });
});

// SIMULATE CAR BREAKDOWN
router.post('/car-breakdown', authRequired, requireRole('SUPER_ADMIN'), (req, res) => {
  const demoUser = db.prepare(`SELECT id FROM User WHERE phone='9999911111'`).get();
  if (!demoUser) return res.status(404).json({ error: 'Demo user not found' });

  const id = uuid();
  const targetLat = 17.6688;
  const targetLng = 80.8933;

  db.prepare(`INSERT INTO EmergencyRequest (id,userId,vehicle,type,description,latitude,longitude,roadName,status,priority)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    id, demoUser.id, 'Hyundai Creta', 'ENGINE_FAILURE', 'Vehicle Breakdown',
    targetLat, targetLng, 'Bhadrachalam Highway', 'REQUESTED', 'HIGH'
  );

  logEvent(id, `🚨 Emergency Request Created`);
  logEvent(id, `📍 Location Detected`);

  const provider = db.prepare(`SELECT * FROM Provider WHERE name = ?`).get("Shiva's Garage");
  if (provider) {
    const dist = distanceKm(targetLat, targetLng, provider.currentLat ?? provider.latitude, provider.currentLng ?? provider.longitude);
    const eta = estimateEtaMinutes(dist);

    db.prepare(`UPDATE EmergencyRequest SET assignedProviderId=?, status='ASSIGNED', distanceKm=?, etaMinutes=? WHERE id=?`)
      .run(provider.id, Math.round(dist * 10) / 10, eta, id);
    logEvent(id, `${provider.name} Found`);

    const updated = db.prepare(`SELECT * FROM EmergencyRequest WHERE id = ?`).get(id);
    emitEmergencyEvent('emergency:created', updated);
    emitEmergencyEvent('emergency:assigned', updated);
    res.json(updated);
  } else {
    const updated = db.prepare(`SELECT * FROM EmergencyRequest WHERE id = ?`).get(id);
    emitEmergencyEvent('emergency:created', updated);
    res.json(updated);
  }
});

// SIMULATE EMPTY FUEL
router.post('/empty-fuel', authRequired, requireRole('SUPER_ADMIN'), (req, res) => {
  const demoUser = db.prepare(`SELECT id FROM User WHERE phone='9999911111'`).get();
  if (!demoUser) return res.status(404).json({ error: 'Demo user not found' });

  const id = uuid();
  const targetLat = 17.6688;
  const targetLng = 80.8933;

  db.prepare(`INSERT INTO EmergencyRequest (id,userId,vehicle,type,description,latitude,longitude,roadName,status,priority)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    id, demoUser.id, 'Hyundai Creta', 'FUEL_EMPTY', 'Empty Fuel',
    targetLat, targetLng, 'Bhadrachalam Highway', 'REQUESTED', 'HIGH'
  );

  logEvent(id, `🚨 Emergency Request Created`);
  logEvent(id, `📍 Location Detected`);

  const provider = db.prepare(`SELECT * FROM Provider WHERE name = ?`).get("Shiva's Bunk");
  if (provider) {
    const dist = distanceKm(targetLat, targetLng, provider.currentLat ?? provider.latitude, provider.currentLng ?? provider.longitude);
    const eta = estimateEtaMinutes(dist);

    db.prepare(`UPDATE EmergencyRequest SET assignedProviderId=?, status='ASSIGNED', distanceKm=?, etaMinutes=? WHERE id=?`)
      .run(provider.id, Math.round(dist * 10) / 10, eta, id);
    logEvent(id, `${provider.name} Found`);

    const updated = db.prepare(`SELECT * FROM EmergencyRequest WHERE id = ?`).get(id);
    emitEmergencyEvent('emergency:created', updated);
    emitEmergencyEvent('emergency:assigned', updated);
    res.json(updated);
  } else {
    const updated = db.prepare(`SELECT * FROM EmergencyRequest WHERE id = ?`).get(id);
    emitEmergencyEvent('emergency:created', updated);
    res.json(updated);
  }
});

// SIMULATE MECHANIC ACCEPTANCE
router.post('/mechanic-accept', authRequired, requireRole('SUPER_ADMIN'), (req, res) => {
  const provider = db.prepare(`SELECT id FROM Provider WHERE name = ?`).get("Shiva's Garage");
  if (!provider) return res.status(404).json({ error: "Shiva's Garage not found" });

  const emergency = db.prepare(`SELECT * FROM EmergencyRequest WHERE assignedProviderId = ? AND status = 'ASSIGNED'`).get(provider.id);
  if (!emergency) return res.status(404).json({ error: 'No pending requests for Shiva\'s Garage' });

  db.prepare(`UPDATE EmergencyRequest SET status='ACCEPTED', acceptedAt=datetime('now') WHERE id=?`).run(emergency.id);
  logEvent(emergency.id, `✅ Request Accepted`);
  db.prepare(`UPDATE EmergencyRequest SET status='ON_THE_WAY', startedAt=datetime('now') WHERE id=?`).run(emergency.id);
  logEvent(emergency.id, `🚗 Provider Started`);

  const updated = db.prepare(`SELECT * FROM EmergencyRequest WHERE id = ?`).get(emergency.id);
  emitEmergencyEvent('emergency:accepted', updated);
  emitEmergencyEvent('emergency:started', updated);
  res.json(updated);
});

// SIMULATE FUEL ACCEPTANCE
router.post('/fuel-accept', authRequired, requireRole('SUPER_ADMIN'), (req, res) => {
  const provider = db.prepare(`SELECT id FROM Provider WHERE name = ?`).get("Shiva's Bunk");
  if (!provider) return res.status(404).json({ error: "Shiva's Bunk not found" });

  const emergency = db.prepare(`SELECT * FROM EmergencyRequest WHERE assignedProviderId = ? AND status = 'ASSIGNED'`).get(provider.id);
  if (!emergency) return res.status(404).json({ error: 'No pending requests for Shiva\'s Bunk' });

  db.prepare(`UPDATE EmergencyRequest SET status='ACCEPTED', acceptedAt=datetime('now') WHERE id=?`).run(emergency.id);
  logEvent(emergency.id, `✅ Request Accepted`);
  db.prepare(`UPDATE EmergencyRequest SET status='ON_THE_WAY', startedAt=datetime('now') WHERE id=?`).run(emergency.id);
  logEvent(emergency.id, `🚗 Provider Started`);

  const updated = db.prepare(`SELECT * FROM EmergencyRequest WHERE id = ?`).get(emergency.id);
  emitEmergencyEvent('emergency:accepted', updated);
  emitEmergencyEvent('emergency:started', updated);
  res.json(updated);
});

// SIMULATE PROVIDER MOVEMENT
router.post('/movement', authRequired, requireRole('SUPER_ADMIN'), async (req, res) => {
  const activeEmergencies = db.prepare(`SELECT * FROM EmergencyRequest WHERE status = 'ON_THE_WAY'`).all();
  if (!activeEmergencies.length) return res.status(400).json({ error: 'No active requests with providers on the way' });

  // Respond immediately so request doesn't timeout
  res.json({ simulating: true, count: activeEmergencies.length });

  // Simulate movement in the background step-by-step
  const targetLat = 17.6688;
  const targetLng = 80.8933;
  const steps = 4;

  for (let step = 1; step <= steps; step++) {
    // Wait 1.5s between steps
    await new Promise((r) => setTimeout(r, 1500));

    for (const emg of activeEmergencies) {
      const provider = db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(emg.assignedProviderId);
      if (!provider) continue;

      // Start coordinates
      const startLat = provider.latitude;
      const startLng = provider.longitude;

      // Calculate fraction
      const fraction = step / steps;
      const lat = startLat + (targetLat - startLat) * fraction;
      const lng = startLng + (targetLng - startLng) * fraction;

      const dist = distanceKm(targetLat, targetLng, lat, lng);
      const eta = estimateEtaMinutes(dist);

      db.prepare(`UPDATE Provider SET currentLat=?, currentLng=? WHERE id=?`).run(lat, lng, provider.id);
      db.prepare(`UPDATE EmergencyRequest SET etaMinutes=?, distanceKm=? WHERE id=?`).run(eta, Math.round(dist * 10) / 10, emg.id);

      db.prepare(`INSERT INTO EmergencyTracking (id, emergencyRequestId, providerId, latitude, longitude, etaMinutes) VALUES (?,?,?,?,?,?)`)
        .run(uuid(), emg.id, provider.id, lat, lng, eta);

      logEvent(emg.id, `📍 Mechanic ${Math.round(dist * 10) / 10} km Away`);

      const updated = db.prepare(`SELECT * FROM EmergencyRequest WHERE id = ?`).get(emg.id);
      emitEmergencyEvent('provider:location', { ...updated, providerLat: lat, providerLng: lng });
      emitEmergencyEvent('emergency:eta_updated', updated);
    }
  }
});

// SIMULATE ARRIVAL
router.post('/arrival', authRequired, requireRole('SUPER_ADMIN'), (req, res) => {
  const activeEmergencies = db.prepare(`SELECT * FROM EmergencyRequest WHERE status = 'ON_THE_WAY'`).all();
  if (!activeEmergencies.length) return res.status(400).json({ error: 'No active requests with providers on the way' });

  for (const emg of activeEmergencies) {
    db.prepare(`UPDATE EmergencyRequest SET status='ARRIVED', etaMinutes=0, arrivedAt=datetime('now') WHERE id=?`).run(emg.id);
    db.prepare(`UPDATE Provider SET currentLat=17.6688, currentLng=80.8933 WHERE id=?`).run(emg.assignedProviderId);
    logEvent(emg.id, `🔧 Provider Arrived`);

    const updated = db.prepare(`SELECT * FROM EmergencyRequest WHERE id = ?`).get(emg.id);
    emitEmergencyEvent('emergency:arrived', updated);
  }
  res.json({ arrived: true });
});

// SIMULATE REPAIR COMPLETE
router.post('/repair-complete', authRequired, requireRole('SUPER_ADMIN'), (req, res) => {
  const provider = db.prepare(`SELECT id FROM Provider WHERE name = ?`).get("Shiva's Garage");
  if (!provider) return res.status(404).json({ error: "Shiva's Garage not found" });

  const emergency = db.prepare(`SELECT * FROM EmergencyRequest WHERE assignedProviderId = ? AND status = 'ARRIVED'`).get(provider.id);
  if (!emergency) return res.status(404).json({ error: 'No arrived request found for Shiva\'s Garage' });

  db.prepare(`UPDATE EmergencyRequest SET status='COMPLETED', completedAt=datetime('now') WHERE id=?`).run(emergency.id);
  logEvent(emergency.id, `🔧 Battery failure diagnosed. Battery jump-start completed.`);
  logEvent(emergency.id, `✅ Repair Completed`);

  const updated = db.prepare(`SELECT * FROM EmergencyRequest WHERE id = ?`).get(emergency.id);
  emitEmergencyEvent('emergency:completed', updated);
  res.json(updated);
});

// SIMULATE FUEL DELIVERED
router.post('/fuel-delivered', authRequired, requireRole('SUPER_ADMIN'), (req, res) => {
  const provider = db.prepare(`SELECT id FROM Provider WHERE name = ?`).get("Shiva's Bunk");
  if (!provider) return res.status(404).json({ error: "Shiva's Bunk not found" });

  const emergency = db.prepare(`SELECT * FROM EmergencyRequest WHERE assignedProviderId = ? AND status = 'ARRIVED'`).get(provider.id);
  if (!emergency) return res.status(404).json({ error: 'No arrived request found for Shiva\'s Bunk' });

  db.prepare(`UPDATE EmergencyRequest SET status='COMPLETED', completedAt=datetime('now') WHERE id=?`).run(emergency.id);
  logEvent(emergency.id, `⛽ 10 Litres Petrol delivered safely.`);
  logEvent(emergency.id, `✅ Fuel Delivered`);

  const updated = db.prepare(`SELECT * FROM EmergencyRequest WHERE id = ?`).get(emergency.id);
  emitEmergencyEvent('emergency:completed', updated);
  res.json(updated);
});

module.exports = router;

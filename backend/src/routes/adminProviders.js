const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../lib/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, requireRole('SUPER_ADMIN'));

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

router.get('/', (req, res) => {
  const { type } = req.query;
  const rows = type
    ? db.prepare(`SELECT * FROM Provider WHERE type = ? ORDER BY createdAt DESC`).all(type)
    : db.prepare(`SELECT * FROM Provider ORDER BY createdAt DESC`).all();
  res.json(rows.map(serialize));
});

router.get('/:id', (req, res) => {
  const p = db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(serialize(p));
});

router.post('/', (req, res) => {
  const b = req.body;
  const id = uuid();
  db.prepare(`INSERT INTO Provider
    (id,name,type,ownerName,phone,whatsapp,address,state,district,highway,latitude,longitude,services,fuelTypes,vehicleTypes,is247,verified,verifiedBy,status,currentLat,currentLng)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, b.name, b.type, b.ownerName || null, b.phone || null, b.whatsapp || null,
    b.address || null, b.state || null, b.district || null, b.highway || null,
    b.latitude ?? null, b.longitude ?? null,
    JSON.stringify(b.services || []), JSON.stringify(b.fuelTypes || []), JSON.stringify(b.vehicleTypes || []),
    b.is247 ? 1 : 0,
    1, // admin-added providers are verified by the admin creating them
    req.user.name || 'Tagarampudi Issaku',
    'ACTIVE', // immediately discoverable by the matching engine
    b.latitude ?? null, b.longitude ?? null
  );
  const p = db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(id);
  res.status(201).json({ message: 'Provider successfully added.', provider: serialize(p) });
});

router.put('/:id', (req, res) => {
  const p = db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const b = req.body;
  const merged = {
    name: b.name ?? p.name, ownerName: b.ownerName ?? p.ownerName, phone: b.phone ?? p.phone,
    whatsapp: b.whatsapp ?? p.whatsapp, address: b.address ?? p.address, state: b.state ?? p.state,
    district: b.district ?? p.district, highway: b.highway ?? p.highway,
    latitude: b.latitude ?? p.latitude, longitude: b.longitude ?? p.longitude,
    services: JSON.stringify(b.services ?? JSON.parse(p.services || '[]')),
    fuelTypes: JSON.stringify(b.fuelTypes ?? JSON.parse(p.fuelTypes || '[]')),
    vehicleTypes: JSON.stringify(b.vehicleTypes ?? JSON.parse(p.vehicleTypes || '[]')),
    is247: (b.is247 ?? p.is247) ? 1 : 0,
    status: b.status ?? p.status,
  };
  db.prepare(`UPDATE Provider SET name=?,ownerName=?,phone=?,whatsapp=?,address=?,state=?,district=?,highway=?,
    latitude=?,longitude=?,services=?,fuelTypes=?,vehicleTypes=?,is247=?,status=?,updatedAt=datetime('now') WHERE id=?`).run(
    merged.name, merged.ownerName, merged.phone, merged.whatsapp, merged.address, merged.state, merged.district,
    merged.highway, merged.latitude, merged.longitude, merged.services, merged.fuelTypes, merged.vehicleTypes,
    merged.is247, merged.status, req.params.id
  );
  res.json(serialize(db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(req.params.id)));
});

router.post('/:id/approve', (req, res) => {
  db.prepare(`UPDATE Provider SET verified=1, status='ACTIVE', verifiedBy=?, updatedAt=datetime('now') WHERE id=?`)
    .run(req.user.name || 'Tagarampudi Issaku', req.params.id);
  res.json(serialize(db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(req.params.id)));
});

router.post('/:id/suspend', (req, res) => {
  db.prepare(`UPDATE Provider SET status='SUSPENDED', updatedAt=datetime('now') WHERE id=?`).run(req.params.id);
  res.json(serialize(db.prepare(`SELECT * FROM Provider WHERE id = ?`).get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM Provider WHERE id = ?`).run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;

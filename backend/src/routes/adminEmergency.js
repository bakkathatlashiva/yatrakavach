const express = require('express');
const db = require('../lib/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, requireRole('SUPER_ADMIN'));

router.get('/active', (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM EmergencyRequest WHERE status NOT IN ('COMPLETED','CANCELLED') ORDER BY createdAt DESC`
  ).all();
  const withProviders = rows.map((e) => ({
    ...e,
    provider: e.assignedProviderId ? db.prepare(`SELECT * FROM Provider WHERE id=?`).get(e.assignedProviderId) : null,
    user: db.prepare(`SELECT id,name,phone FROM User WHERE id=?`).get(e.userId),
  }));
  res.json({ count: withProviders.length, emergencies: withProviders });
});

router.get('/:id/timeline', (req, res) => {
  const rows = db.prepare(`SELECT * FROM EmergencyEvent WHERE emergencyRequestId=? ORDER BY timestamp ASC`).all(req.params.id);
  res.json(rows);
});

module.exports = router;

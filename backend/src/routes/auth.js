const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const { SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { phone, password } = req.body;
  const user = db.prepare(`SELECT * FROM User WHERE phone = ?`).get(phone);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.passwordHash || '');
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, role: user.role, providerId: user.providerId || null, name: user.name },
    SECRET,
    { expiresIn: '7d' }
  );
  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, providerId: user.providerId },
  });
});

// Convenience: quick demo logins without needing passwords in a UI form
router.get('/demo-accounts', (req, res) => {
  res.json({
    admin: { phone: '9999900000', password: 'admin123', role: 'SUPER_ADMIN', name: 'Tagarampudi Issaku' },
    traveller: { phone: '9999911111', password: 'demo123', role: 'USER' },
    garage: { phone: '9999922222', password: 'provider123', role: 'PROVIDER', name: "Shiva's Garage" },
    bunk: { phone: '9999933333', password: 'provider123', role: 'PROVIDER', name: "Shiva's Bunk" },
  });
});

module.exports = router;

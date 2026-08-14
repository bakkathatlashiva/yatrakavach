const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const { initIO } = require('./sockets/io');
require('./lib/db'); // ensures DB init + seed runs

const authRoutes = require('./routes/auth');
const adminProviderRoutes = require('./routes/adminProviders');
const providerRoutes = require('./routes/providers');
const emergencyRoutes = require('./routes/emergency');
const adminEmergencyRoutes = require('./routes/adminEmergency');
const demoRoutes = require('./routes/demo');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'YatraKavach API' }));

app.use('/api/auth', authRoutes);
app.use('/api/admin/providers', adminProviderRoutes);
app.use('/api/admin/emergencies', adminEmergencyRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/demo', demoRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
initIO(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`YatraKavach API + Socket.IO listening on :${PORT}`));

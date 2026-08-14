const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../yatrakavach.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT,
  passwordHash TEXT,
  role TEXT NOT NULL DEFAULT 'USER', -- USER | PROVIDER | SUPER_ADMIN
  providerId TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Provider (
  id TEXT PRIMARY KEY,
  userId TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- MECHANIC | FUEL_PARTNER | TOWING | EV_CHARGING | OTHER
  ownerName TEXT,
  phone TEXT,
  whatsapp TEXT,
  address TEXT,
  state TEXT,
  district TEXT,
  highway TEXT,
  latitude REAL,
  longitude REAL,
  services TEXT DEFAULT '[]',      -- JSON array
  fuelTypes TEXT DEFAULT '[]',     -- JSON array
  vehicleTypes TEXT DEFAULT '[]',  -- JSON array
  is247 INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  verifiedBy TEXT,
  status TEXT DEFAULT 'PENDING_VERIFICATION', -- ACTIVE|BUSY|OFFLINE|SUSPENDED|PENDING_VERIFICATION
  rating REAL DEFAULT 4.5,
  reliabilityScore REAL DEFAULT 0.8,
  isEmergencyAvailable INTEGER DEFAULT 1,
  currentLat REAL,
  currentLng REAL,
  operatingHours TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ProviderService (
  id TEXT PRIMARY KEY,
  providerId TEXT NOT NULL,
  serviceType TEXT NOT NULL,
  available INTEGER DEFAULT 1,
  price REAL
);

CREATE TABLE IF NOT EXISTS EmergencyRequest (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  vehicle TEXT,
  type TEXT NOT NULL, -- FUEL_EMPTY|ENGINE_FAILURE|BATTERY|TYRE|OVERHEATING|ACCIDENT|TOWING|OTHER
  description TEXT,
  photo TEXT,
  latitude REAL,
  longitude REAL,
  roadName TEXT,
  status TEXT DEFAULT 'REQUESTED', -- REQUESTED|ASSIGNED|ACCEPTED|DECLINED|ON_THE_WAY|ARRIVED|DIAGNOSING|REPAIRING|WAITING_FOR_PART|COMPLETED|CANCELLED
  priority TEXT DEFAULT 'NORMAL',
  assignedProviderId TEXT,
  distanceKm REAL,
  etaMinutes INTEGER,
  createdAt TEXT DEFAULT (datetime('now')),
  acceptedAt TEXT,
  startedAt TEXT,
  arrivedAt TEXT,
  completedAt TEXT
);

CREATE TABLE IF NOT EXISTS EmergencyTracking (
  id TEXT PRIMARY KEY,
  emergencyRequestId TEXT NOT NULL,
  providerId TEXT,
  latitude REAL,
  longitude REAL,
  etaMinutes INTEGER,
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS EmergencyEvent (
  id TEXT PRIMARY KEY,
  emergencyRequestId TEXT NOT NULL,
  label TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now'))
);
`);

// Dynamically alter tables for existing databases
try {
  db.exec(`ALTER TABLE Provider ADD COLUMN operatingHours TEXT;`);
} catch (e) {
  // column already exists
}
try {
  db.exec(`ALTER TABLE EmergencyRequest ADD COLUMN photo TEXT;`);
} catch (e) {
  // column already exists
}

// ---- Seed ----
function seed() {
  const adminExists = db.prepare(`SELECT id FROM User WHERE role='SUPER_ADMIN' OR phone='9999900000'`).get();
  if (!adminExists) {
    const id = uuid();
    db.prepare(`INSERT INTO User (id,name,phone,email,passwordHash,role) VALUES (?,?,?,?,?,?)`).run(
      id, 'Tagarampudi Issaku', '9999900000', 'admin@yatrakavach.app',
      bcrypt.hashSync('admin123', 8), 'SUPER_ADMIN'
    );
    console.log('Seeded SUPER_ADMIN: Tagarampudi Issaku (phone 9999900000 / pass admin123)');
  }

  const demoUserExists = db.prepare(`SELECT id FROM User WHERE phone='9999911111'`).get();
  if (!demoUserExists) {
    db.prepare(`INSERT INTO User (id,name,phone,email,passwordHash,role) VALUES (?,?,?,?,?,?)`).run(
      uuid(), 'Issaku (Demo Traveller)', '9999911111', 'traveller@yatrakavach.app',
      bcrypt.hashSync('demo123', 8), 'USER'
    );
  }

  let garageUser = db.prepare(`SELECT id, providerId FROM User WHERE phone='9999922222'`).get();
  let pid;
  let uid;
  if (!garageUser) {
    pid = uuid();
    uid = uuid();
    db.prepare(`INSERT INTO User (id,name,phone,email,passwordHash,role,providerId) VALUES (?,?,?,?,?,?,?)`).run(
      uid, "Shiva's Garage", '9999922222', 'garage@yatrakavach.app', bcrypt.hashSync('provider123', 8), 'PROVIDER', pid
    );
  } else {
    uid = garageUser.id;
    pid = garageUser.providerId || uuid();
    if (!garageUser.providerId) {
      db.prepare(`UPDATE User SET providerId = ? WHERE id = ?`).run(pid, uid);
    }
  }

  const garageExists = db.prepare(`SELECT id FROM Provider WHERE id = ? OR name = 'Shiva''s Garage'`).get(pid);
  if (!garageExists) {
    db.prepare(`INSERT INTO Provider
      (id,userId,name,type,ownerName,phone,whatsapp,address,state,district,highway,latitude,longitude,services,fuelTypes,vehicleTypes,is247,verified,verifiedBy,status,rating,reliabilityScore,isEmergencyAvailable,currentLat,currentLng,operatingHours)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      pid, uid, "Shiva's Garage", 'MECHANIC', 'Shiva', '9999922222', '9999922222',
      'Near Bhadrachalam Highway, Demo Location', 'Telangana', 'Bhadradri Kothagudem', 'Bhadrachalam Highway (NH-30)',
      17.6688, 80.8933,
      JSON.stringify(['GENERAL_REPAIR','ENGINE_REPAIR','BATTERY','TYRE','PUNCTURE','ELECTRICAL','OIL_FLUID','EMERGENCY_ROADSIDE_ASSISTANCE']),
      JSON.stringify([]),
      JSON.stringify(['BIKE','CAR','SUV','VAN','TRUCK']),
      1, 1, 'Tagarampudi Issaku', 'ACTIVE', 4.9, 0.95, 1,
      17.6112, 80.8127, // ~8-9km away starting point for demo
      '24/7'
    );
  }

  let bunkUser = db.prepare(`SELECT id, providerId FROM User WHERE phone='9999933333'`).get();
  let bunkPid;
  let bunkUid;
  if (!bunkUser) {
    bunkPid = uuid();
    bunkUid = uuid();
    db.prepare(`INSERT INTO User (id,name,phone,email,passwordHash,role,providerId) VALUES (?,?,?,?,?,?,?)`).run(
      bunkUid, "Shiva's Bunk", '9999933333', 'bunk@yatrakavach.app', bcrypt.hashSync('provider123', 8), 'PROVIDER', bunkPid
    );
  } else {
    bunkUid = bunkUser.id;
    bunkPid = bunkUser.providerId || uuid();
    if (!bunkUser.providerId) {
      db.prepare(`UPDATE User SET providerId = ? WHERE id = ?`).run(bunkPid, bunkUid);
    }
  }

  const bunkExists = db.prepare(`SELECT id FROM Provider WHERE id = ? OR name = 'Shiva''s Bunk'`).get(bunkPid);
  if (!bunkExists) {
    db.prepare(`INSERT INTO Provider
      (id,userId,name,type,ownerName,phone,whatsapp,address,state,district,highway,latitude,longitude,services,fuelTypes,vehicleTypes,is247,verified,verifiedBy,status,rating,reliabilityScore,isEmergencyAvailable,currentLat,currentLng,operatingHours)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      bunkPid, bunkUid, "Shiva's Bunk", 'FUEL_PARTNER', 'Shiva', '9999933333', '9999933333',
      'Near Bhadrachalam Highway, Demo Location', 'Telangana', 'Bhadradri Kothagudem', 'Bhadrachalam Highway (NH-30)',
      17.6688, 80.8933,
      JSON.stringify(['EMERGENCY_FUEL_ASSISTANCE','DELIVERY_AUTHORIZED_PARTNER']),
      JSON.stringify(['PETROL','DIESEL']),
      JSON.stringify([]),
      1, 1, 'Tagarampudi Issaku', 'ACTIVE', 4.8, 0.9, 1,
      17.5701, 80.7654, // ~11km away starting point for demo
      '24/7'
    );
  }

  // Seed Towing
  let towingUser = db.prepare(`SELECT id, providerId FROM User WHERE phone='9999944444'`).get();
  let towingPid;
  let towingUid;
  if (!towingUser) {
    towingPid = uuid();
    towingUid = uuid();
    db.prepare(`INSERT INTO User (id,name,phone,email,passwordHash,role,providerId) VALUES (?,?,?,?,?,?,?)`).run(
      towingUid, "Shiva's Towing", '9999944444', 'towing@yatrakavach.app', bcrypt.hashSync('provider123', 8), 'PROVIDER', towingPid
    );
  } else {
    towingUid = towingUser.id;
    towingPid = towingUser.providerId || uuid();
    if (!towingUser.providerId) {
      db.prepare(`UPDATE User SET providerId = ? WHERE id = ?`).run(towingPid, towingUid);
    }
  }

  const towingExists = db.prepare(`SELECT id FROM Provider WHERE id = ? OR name = 'Shiva''s Towing'`).get(towingPid);
  if (!towingExists) {
    db.prepare(`INSERT INTO Provider
      (id,userId,name,type,ownerName,phone,whatsapp,address,state,district,highway,latitude,longitude,services,fuelTypes,vehicleTypes,is247,verified,verifiedBy,status,rating,reliabilityScore,isEmergencyAvailable,currentLat,currentLng,operatingHours)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      towingPid, towingUid, "Shiva's Towing", 'TOWING', 'Shiva', '9999944444', '9999944444',
      'Near Bhadrachalam Highway, Demo Location', 'Telangana', 'Bhadradri Kothagudem', 'Bhadrachalam Highway (NH-30)',
      17.6688, 80.8933,
      JSON.stringify(['TOWING','ACCIDENT_RECOVERY','FLATBED_TOWING']),
      JSON.stringify([]),
      JSON.stringify(['BIKE','CAR','SUV','VAN','TRUCK']),
      1, 1, 'Tagarampudi Issaku', 'ACTIVE', 4.7, 0.92, 1,
      17.6350, 80.8400, // starting position for demo
      '24/7'
    );
  }

  // Seed EV Charging
  let evUser = db.prepare(`SELECT id, providerId FROM User WHERE phone='9999955555'`).get();
  let evPid;
  let evUid;
  if (!evUser) {
    evPid = uuid();
    evUid = uuid();
    db.prepare(`INSERT INTO User (id,name,phone,email,passwordHash,role,providerId) VALUES (?,?,?,?,?,?,?)`).run(
      evUid, "Shiva's EV Charging", '9999955555', 'ev@yatrakavach.app', bcrypt.hashSync('provider123', 8), 'PROVIDER', evPid
    );
  } else {
    evUid = evUser.id;
    evPid = evUser.providerId || uuid();
    if (!evUser.providerId) {
      db.prepare(`UPDATE User SET providerId = ? WHERE id = ?`).run(evPid, evUid);
    }
  }

  const evExists = db.prepare(`SELECT id FROM Provider WHERE id = ? OR name = 'Shiva''s EV Charging'`).get(evPid);
  if (!evExists) {
    db.prepare(`INSERT INTO Provider
      (id,userId,name,type,ownerName,phone,whatsapp,address,state,district,highway,latitude,longitude,services,fuelTypes,vehicleTypes,is247,verified,verifiedBy,status,rating,reliabilityScore,isEmergencyAvailable,currentLat,currentLng,operatingHours)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      evPid, evUid, "Shiva's EV Charging", 'EV_CHARGING', 'Shiva', '9999955555', '9999955555',
      'Near Bhadrachalam Highway, Demo Location', 'Telangana', 'Bhadradri Kothagudem', 'Bhadrachalam Highway (NH-30)',
      17.6688, 80.8933,
      JSON.stringify(['EV_FAST_CHARGING','EV_PORTABLE_CHARGING']),
      JSON.stringify([]),
      JSON.stringify(['CAR','SUV']),
      1, 1, 'Tagarampudi Issaku', 'ACTIVE', 4.6, 0.88, 1,
      17.6520, 80.8700, // starting position for demo
      '24/7'
    );
  }
}
seed();

module.exports = db;

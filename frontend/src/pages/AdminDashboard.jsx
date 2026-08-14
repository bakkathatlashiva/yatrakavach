import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { getSocket, joinRoom } from '../lib/socket';
import ProviderForm from '../components/ProviderForm';

const TABS = ['Providers', 'Live Monitor', 'Demo Mode'];
const TYPE_TABS = ['MECHANIC', 'FUEL_PARTNER', 'TOWING', 'EV_CHARGING', 'OTHER'];

const TYPE_LABELS = {
  MECHANIC: 'Mechanics',
  FUEL_PARTNER: 'Fuel Partners',
  TOWING: 'Towing',
  EV_CHARGING: 'EV Charging',
  OTHER: 'Other Services',
};

const STATUS_COLOR = {
  ACTIVE: 'text-[var(--green)]',
  BUSY: 'text-[var(--amber)]',
  OFFLINE: 'text-[var(--fog)]',
  SUSPENDED: 'text-[var(--red)]',
  PENDING_VERIFICATION: 'text-[var(--amber)]',
};

function ProvidersTab() {
  const [type, setType] = useState('MECHANIC');
  const [providers, setProviders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [viewingProvider, setViewingProvider] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const rows = await api.adminListProviders(type);
    setProviders(rows);
  }, [type]);

  useEffect(() => { load(); }, [load]);

  async function saveProvider(payload) {
    if (editingProvider) {
      await api.adminUpdateProvider(editingProvider.id, payload);
      setMsg(`Provider "${payload.name}" updated successfully.`);
      setEditingProvider(null);
    } else {
      const res = await api.adminAddProvider(payload);
      setMsg(`${res.message} — ${res.provider.name} is ACTIVE.`);
      setShowForm(false);
    }
    load();
    setTimeout(() => setMsg(''), 4000);
  }

  async function approve(id) { await api.adminApproveProvider(id); load(); }
  async function suspend(id) { await api.adminSuspendProvider(id); load(); }
  async function remove(id) { if (confirm('Delete this provider?')) { await api.adminDeleteProvider(id); load(); } }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {TYPE_TABS.map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-150 ${type === t ? 'bg-[var(--amber)] text-[var(--asphalt)] border-[var(--amber)] font-medium' : 'border-[var(--steel-light)] text-[var(--fog)] hover:text-white'}`}>
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditingProvider(null); setShowForm((v) => !v); }} className="text-xs px-4 py-2 rounded-lg bg-[var(--steel)] hover:bg-[var(--steel-light)] font-semibold transition">
          {showForm ? '✕ Close Form' : '+ ADD PROVIDER'}
        </button>
      </div>

      {msg && <div className="text-sm text-[var(--green)] bg-[var(--green)]/10 border border-[var(--green)]/30 rounded-lg px-3 py-2">{msg}</div>}

      {showForm && (
        <div className="my-2">
          <ProviderForm initialType={type} onSubmit={saveProvider} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {editingProvider && (
        <div className="my-2">
          <ProviderForm provider={editingProvider} onSubmit={saveProvider} onCancel={() => setEditingProvider(null)} />
        </div>
      )}

      {/* Provider Details View Modal */}
      {viewingProvider && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-[var(--steel)] pb-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-[var(--amber)] font-mono">{viewingProvider.type}</div>
                <h3 className="font-display text-2xl font-700">{viewingProvider.name}</h3>
              </div>
              <button onClick={() => setViewingProvider(null)} className="text-[var(--fog)] hover:text-white text-lg">✕</button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-[var(--fog)] block uppercase">Owner / Manager</span>
                <span className="font-medium">{viewingProvider.ownerName || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-[var(--fog)] block uppercase">Phone</span>
                <span className="font-mono">{viewingProvider.phone || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-[var(--fog)] block uppercase">WhatsApp</span>
                <span className="font-mono">{viewingProvider.whatsapp || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-[var(--fog)] block uppercase">Availability</span>
                <span>{viewingProvider.is247 ? '24/7 Emergency Service' : viewingProvider.operatingHours || 'Standard Hours'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-[var(--fog)] block uppercase">Road / Highway Area</span>
                <span>{viewingProvider.highway || '—'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-[var(--fog)] block uppercase">Full Address</span>
                <span>{viewingProvider.address || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-[var(--fog)] block uppercase">District & State</span>
                <span>{viewingProvider.district ? `${viewingProvider.district}, ` : ''}{viewingProvider.state || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-[var(--fog)] block uppercase">Coordinates (Lat, Lng)</span>
                <span className="font-mono text-xs">{viewingProvider.latitude}, {viewingProvider.longitude}</span>
              </div>
              <div>
                <span className="text-xs text-[var(--fog)] block uppercase">Rating</span>
                <span>⭐ {viewingProvider.rating} / 5</span>
              </div>
              <div>
                <span className="text-xs text-[var(--fog)] block uppercase">Status</span>
                <span className={`font-mono text-xs font-semibold ${STATUS_COLOR[viewingProvider.status] || ''}`}>{viewingProvider.status}</span>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-[var(--fog)] block uppercase">Verification status</span>
                <span>{viewingProvider.verified ? `✓ Verified by ${viewingProvider.verifiedBy}` : 'Pending Verification'}</span>
              </div>
              {viewingProvider.services?.length > 0 && (
                <div className="col-span-2">
                  <span className="text-xs text-[var(--fog)] block uppercase mb-1">Services Offered</span>
                  <div className="flex flex-wrap gap-1">
                    {viewingProvider.services.map(s => (
                      <span key={s} className="bg-[var(--steel)] text-[var(--paper)] text-xs px-2 py-0.5 rounded-full">{s.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="pt-3 border-t border-[var(--steel)] flex justify-end gap-2">
              <button onClick={() => { setViewingProvider(null); setEditingProvider(viewingProvider); }} className="bg-[var(--amber)] text-[var(--asphalt)] font-semibold rounded-lg px-4 py-2 text-sm hover:opacity-90">Edit Profile</button>
              <button onClick={() => setViewingProvider(null)} className="bg-[var(--steel)] rounded-lg px-4 py-2 text-sm hover:bg-[var(--steel-light)]">Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--fog)] text-xs uppercase tracking-wide border-b border-[var(--steel)]">
              <th className="py-2.5 pr-3">Provider Name</th>
              <th className="py-2.5 pr-3">Provider Type</th>
              <th className="py-2.5 pr-3">Location</th>
              <th className="py-2.5 pr-3">Distance/Area</th>
              <th className="py-2.5 pr-3">Phone</th>
              <th className="py-2.5 pr-3">Availability</th>
              <th className="py-2.5 pr-3">Verification</th>
              <th className="py-2.5 pr-3">Rating</th>
              <th className="py-2.5 pr-3">Status</th>
              <th className="py-2.5 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id} className="border-b border-[var(--steel)]/40 hover:bg-[var(--steel)]/10 transition-colors">
                <td className="py-3 pr-3 font-semibold text-white">{p.name}</td>
                <td className="py-3 pr-3 font-mono text-xs text-[var(--amber)]">{p.type}</td>
                <td className="py-3 pr-3 text-[var(--fog)] max-w-xs truncate" title={p.address}>{p.address || '—'}</td>
                <td className="py-3 pr-3 text-[var(--fog)]">{p.highway || p.district || '—'}</td>
                <td className="py-3 pr-3 font-mono text-xs">{p.phone}</td>
                <td className="py-3 pr-3 text-xs">{p.is247 ? '24/7 Available' : p.operatingHours || 'Standard'}</td>
                <td className="py-3 pr-3 text-xs">
                  {p.verified ? (
                    <span className="text-[var(--green)]" title={`Verified by ${p.verifiedBy}`}>✓ Verified</span>
                  ) : (
                    <span className="text-[var(--fog)]">Pending</span>
                  )}
                </td>
                <td className="py-3 pr-3">⭐ {p.rating}</td>
                <td className={`py-3 pr-3 font-mono text-xs font-semibold ${STATUS_COLOR[p.status] || ''}`}>{p.status}</td>
                <td className="py-3 pr-3 space-x-2.5 whitespace-nowrap">
                  <button onClick={() => setViewingProvider(p)} className="text-white hover:text-[var(--amber)] text-xs underline font-medium">View</button>
                  <button onClick={() => { setShowForm(false); setEditingProvider(p); }} className="text-white hover:text-[var(--amber)] text-xs underline font-medium">Edit</button>
                  {p.status !== 'ACTIVE' && <button onClick={() => approve(p.id)} className="text-[var(--green)] text-xs font-semibold hover:underline">Approve</button>}
                  {p.status === 'ACTIVE' && <button onClick={() => suspend(p.id)} className="text-[var(--amber)] text-xs font-semibold hover:underline">Suspend</button>}
                  <button onClick={() => remove(p.id)} className="text-[var(--red)] text-xs font-semibold hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {providers.length === 0 && (
              <tr><td colSpan={10} className="py-8 text-center text-[var(--fog)]">No {TYPE_LABELS[type].toLowerCase()} providers registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LiveMonitorTab() {
  const [data, setData] = useState({ count: 0, emergencies: [] });

  const load = useCallback(async () => {
    const d = await api.adminActiveEmergencies();
    setData(d);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    joinRoom('admin:emergencies');
    const s = getSocket();
    const handler = () => load();
    ['emergency:created', 'emergency:assigned', 'emergency:accepted', 'provider:location', 'emergency:arrived', 'emergency:completed', 'emergency:cancelled']
      .forEach((ev) => s.on(ev, handler));
    return () => {
      ['emergency:created', 'emergency:assigned', 'emergency:accepted', 'provider:location', 'emergency:arrived', 'emergency:completed', 'emergency:cancelled']
        .forEach((ev) => s.off(ev, handler));
    };
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="marker-plate rounded-xl p-4 inline-block">
        <div className="text-xs uppercase tracking-widest text-[var(--amber)] font-mono">Active Emergencies</div>
        <div className="font-display text-4xl">{data.count}</div>
      </div>
      <div className="space-y-3">
        {data.emergencies.map((e) => (
          <div key={e.id} className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="font-semibold text-lg flex items-center gap-2 text-white">
                <span>{e.user?.name}</span>
                <span className="text-xs font-mono bg-[var(--steel)] px-2 py-0.5 rounded text-[var(--fog)]">{e.vehicle}</span>
              </div>
              <div className="text-sm text-[var(--fog)]">
                <b>Problem:</b> {e.type.replace('_', ' ')} · <b>Road:</b> {e.roadName}
              </div>
              <div className="text-xs text-[var(--fog)] flex items-center gap-2">
                <span><b>Assigned:</b> {e.provider ? `${e.provider.type === 'FUEL_PARTNER' ? '⛽' : '🔧'} ${e.provider.name}` : 'Unassigned'}</span>
                {e.provider && (
                  <>
                    <span>·</span>
                    <span><b>Distance:</b> {e.distanceKm ?? '—'} km</span>
                    <span>·</span>
                    <span><b>ETA:</b> {e.etaMinutes ?? '—'} min</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 w-full md:w-auto">
              <span className="font-mono text-xs bg-[var(--amber)]/10 text-[var(--amber)] px-3 py-1 rounded-full border border-[var(--amber)]/20 font-semibold">{e.status}</span>
              <span className="text-[10px] text-[var(--fog)] font-mono">{e.createdAt}</span>
            </div>
          </div>
        ))}
        {data.emergencies.length === 0 && (
          <div className="text-[var(--fog)] text-sm py-12 text-center bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl">
            No active emergencies currently monitored on the highway.
          </div>
        )}
      </div>
    </div>
  );
}

function DemoModeTab() {
  const [log, setLog] = useState([]);
  const [scenarioInfo, setScenarioInfo] = useState(null);
  const [activeEmergencies, setActiveEmergencies] = useState([]);

  const pushLog = useCallback((msg) => {
    setLog((l) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...l].slice(0, 15));
  }, []);

  const loadActiveDemoRequests = useCallback(async () => {
    const res = await api.adminActiveEmergencies();
    // Filter to only requests of demo traveler user
    const demoReqs = res.emergencies.filter(e => e.user?.phone === '9999911111');
    setActiveEmergencies(demoReqs);
  }, []);

  useEffect(() => {
    api.demoScenario().then(setScenarioInfo);
    loadActiveDemoRequests();
  }, [loadActiveDemoRequests]);

  useEffect(() => {
    joinRoom('admin:emergencies');
    const s = getSocket();
    const handler = () => loadActiveDemoRequests();
    ['emergency:created', 'emergency:assigned', 'emergency:accepted', 'provider:location', 'emergency:arrived', 'emergency:completed', 'emergency:cancelled']
      .forEach((ev) => s.on(ev, handler));
    return () => {
      ['emergency:created', 'emergency:assigned', 'emergency:accepted', 'provider:location', 'emergency:arrived', 'emergency:completed', 'emergency:cancelled']
        .forEach((ev) => s.off(ev, handler));
    };
  }, [loadActiveDemoRequests]);

  async function resetDemo() {
    await api.demoReset();
    pushLog("START BHADRACHALAM DEMO — Shiva's Garage & Shiva's Bunk reset to starting positions, old demo requests deleted.");
    loadActiveDemoRequests();
  }

  async function carBreakdown() {
    try {
      const res = await api.demoCarBreakdown();
      pushLog(`🚨 CAR BREAKDOWN: Created Mechanic emergency request for Shiva's Garage (ID: ${res.id.slice(0,8)}).`);
    } catch(e) {
      pushLog(`Error simulating breakdown: ${e.message}`);
    }
  }

  async function emptyFuel() {
    try {
      const res = await api.demoEmptyFuel();
      pushLog(`⛽ EMPTY FUEL: Created Fuel emergency request for Shiva's Bunk (ID: ${res.id.slice(0,8)}).`);
    } catch(e) {
      pushLog(`Error simulating empty fuel: ${e.message}`);
    }
  }

  async function mechanicAccept() {
    try {
      await api.demoMechanicAccept();
      pushLog("🔧 Shiva's Garage ACCEPTED the request! Status updated to ON THE WAY.");
    } catch(e) {
      pushLog(`Error simulating mechanic acceptance: ${e.message}`);
    }
  }

  async function fuelAccept() {
    try {
      await api.demoFuelAccept();
      pushLog("⛽ Shiva's Bunk ACCEPTED the request! Status updated to ON THE WAY.");
    } catch(e) {
      pushLog(`Error simulating fuel acceptance: ${e.message}`);
    }
  }

  async function providerMovement() {
    try {
      await api.demoMovement();
      pushLog("🚗 SIMULATING PROVIDER MOVEMENT: Providers are progressively approaching traveler location...");
    } catch(e) {
      pushLog(`Error simulating movement: ${e.message}`);
    }
  }

  async function arrive() {
    try {
      await api.demoArrival();
      pushLog("🔧 SIMULATING ARRIVAL: Providers have arrived at traveler location!");
    } catch(e) {
      pushLog(`Error simulating arrival: ${e.message}`);
    }
  }

  async function repairComplete() {
    try {
      await api.demoRepairComplete();
      pushLog("✅ REPAIR COMPLETED: Shiva's Garage finished repair. Battery jump-started!");
    } catch(e) {
      pushLog(`Error completing repair: ${e.message}`);
    }
  }

  async function fuelDelivered() {
    try {
      await api.demoFuelDelivered();
      pushLog("✅ FUEL DELIVERED: Shiva's Bunk delivered 10L Petrol successfully!");
    } catch(e) {
      pushLog(`Error delivering fuel: ${e.message}`);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        {/* Controls Card */}
        <div className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--steel)] pb-3">
            <div>
              <h2 className="font-display text-2xl font-700 tracking-wide">Bhadrachalam Highway Demo Controls</h2>
              <p className="text-xs text-[var(--fog)]">Execute the entire demo story workflow sequentially.</p>
            </div>
            <button onClick={resetDemo} className="bg-[var(--red)] text-white hover:opacity-90 font-semibold px-3 py-1.5 rounded-lg text-xs transition">
              START / RESET DEMO
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <button onClick={carBreakdown} className="bg-[var(--steel)] hover:bg-[var(--steel-light)] text-sm font-semibold p-3 rounded-lg text-center flex flex-col items-center justify-center gap-1.5 transition">
              <span className="text-xl">🚨</span>
              <span>Car Breakdown</span>
            </button>
            <button onClick={emptyFuel} className="bg-[var(--steel)] hover:bg-[var(--steel-light)] text-sm font-semibold p-3 rounded-lg text-center flex flex-col items-center justify-center gap-1.5 transition">
              <span className="text-xl">⛽</span>
              <span>Empty Fuel</span>
            </button>
            <button onClick={mechanicAccept} className="bg-[var(--steel)] hover:bg-[var(--steel-light)] text-sm font-semibold p-3 rounded-lg text-center flex flex-col items-center justify-center gap-1.5 transition">
              <span className="text-xl">🔧</span>
              <span>Accept Mechanic</span>
            </button>
            <button onClick={fuelAccept} className="bg-[var(--steel)] hover:bg-[var(--steel-light)] text-sm font-semibold p-3 rounded-lg text-center flex flex-col items-center justify-center gap-1.5 transition">
              <span className="text-xl">⛽</span>
              <span>Accept Fuel Partner</span>
            </button>
            <button onClick={providerMovement} className="bg-[var(--steel)] hover:bg-[var(--steel-light)] text-sm font-semibold p-3 rounded-lg text-center flex flex-col items-center justify-center gap-1.5 transition col-span-2">
              <span className="text-xl">🚙 ➔ 🚗</span>
              <span>Simulate Provider Movement</span>
            </button>
            <button onClick={arrive} className="bg-[var(--steel)] hover:bg-[var(--steel-light)] text-sm font-semibold p-3 rounded-lg text-center flex flex-col items-center justify-center gap-1.5 transition col-span-2">
              <span className="text-xl">🏁</span>
              <span>Simulate Arrival</span>
            </button>
            <button onClick={repairComplete} className="bg-[var(--steel)] hover:bg-[var(--steel-light)] text-sm font-semibold p-3 rounded-lg text-center flex flex-col items-center justify-center gap-1.5 transition col-span-2">
              <span className="text-xl">🔧 ✓</span>
              <span>Repair Complete</span>
            </button>
            <button onClick={fuelDelivered} className="bg-[var(--steel)] hover:bg-[var(--steel-light)] text-sm font-semibold p-3 rounded-lg text-center flex flex-col items-center justify-center gap-1.5 transition col-span-2">
              <span className="text-xl">⛽ ✓</span>
              <span>Fuel Delivered</span>
            </button>
          </div>
        </div>

        {/* Console logs */}
        <div className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-5 space-y-2">
          <div className="text-xs uppercase tracking-wider text-[var(--fog)] font-mono border-b border-[var(--steel)] pb-1.5">Simulation Console</div>
          <div className="h-48 overflow-y-auto space-y-1 select-text scrollbar">
            {log.map((l, i) => (
              <div key={i} className="text-xs font-mono text-[var(--fog)] border-l-2 border-[var(--amber)] pl-2 py-0.5">{l}</div>
            ))}
            {log.length === 0 && <div className="text-xs font-mono text-[var(--steel-light)]">Console is idle. Trigger demo actions above...</div>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Scenario Details */}
        {scenarioInfo && (
          <div className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-5 space-y-3">
            <h3 className="font-display text-xl text-white font-700 tracking-wide border-b border-[var(--steel)] pb-2">Demo Context</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs text-[var(--fog)] block uppercase">Traveller</span>
                <span className="font-semibold text-white">{scenarioInfo.traveller.name}</span>
                <span className="text-xs text-[var(--fog)] block font-mono">Phone: {scenarioInfo.traveller.phone}</span>
              </div>
              <div>
                <span className="text-xs text-[var(--fog)] block uppercase">Vehicle</span>
                <span className="font-semibold text-white">{scenarioInfo.vehicle.model}</span>
                <span className="text-xs text-[var(--fog)] block">Fuel Level: {scenarioInfo.vehicle.fuelPercent}% · Status: {scenarioInfo.vehicle.status}</span>
              </div>
              <div>
                <span className="text-xs text-[var(--fog)] block uppercase">Location</span>
                <span className="font-semibold text-white">{scenarioInfo.location.name}</span>
                <span className="text-xs text-[var(--fog)] block font-mono">Coordinates: {scenarioInfo.location.latitude}, {scenarioInfo.location.longitude}</span>
              </div>
            </div>
          </div>
        )}

        {/* Active Demo Requests */}
        <div className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-5 space-y-3">
          <h3 className="font-display text-xl text-white font-700 tracking-wide border-b border-[var(--steel)] pb-2">Active Demo Requests ({activeEmergencies.length})</h3>
          <div className="space-y-3">
            {activeEmergencies.map((e) => (
              <div key={e.id} className="bg-[var(--steel)]/40 border border-[var(--steel)] rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span>{e.type.replace('_', ' ')}</span>
                  <span className="text-[var(--amber)] uppercase font-mono">{e.status}</span>
                </div>
                <div><b>Assigned:</b> {e.provider?.name || 'Searching...'}</div>
                <div><b>Distance:</b> {e.distanceKm ?? '—'} km · <b>ETA:</b> {e.etaMinutes ?? '—'} min</div>
              </div>
            ))}
            {activeEmergencies.length === 0 && <div className="text-xs text-[var(--fog)] text-center py-6">No active requests for the demo traveler.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('Providers');

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-16">
      <div className="mb-6 flex justify-between items-end border-b border-[var(--steel)] pb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--amber)] font-mono">Tagarampudi Issaku</div>
          <h1 className="font-display text-4xl font-700 tracking-wide text-white">SUPER ADMIN</h1>
        </div>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${tab === t ? 'bg-[var(--amber)] text-[var(--asphalt)]' : 'text-[var(--fog)] hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      
      {tab === 'Providers' && <ProvidersTab />}
      {tab === 'Live Monitor' && <LiveMonitorTab />}
      {tab === 'Demo Mode' && <DemoModeTab />}
    </div>
  );
}

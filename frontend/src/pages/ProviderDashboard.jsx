import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import { getSocket, joinRoom } from '../lib/socket';
import MarkerPlate from '../components/MarkerPlate';

export default function ProviderDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api.providerDashboard(user.providerId);
      setData(d);
    } catch (e) {
      setError(e.message);
    }
  }, [user.providerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    joinRoom(`provider:${user.providerId}`);
    const s = getSocket();
    const handler = () => load();
    ['emergency:created', 'emergency:assigned', 'emergency:accepted', 'provider:location', 'emergency:completed']
      .forEach((ev) => s.on(ev, handler));
    return () => {
      ['emergency:created', 'emergency:assigned', 'emergency:accepted', 'provider:location', 'emergency:completed']
        .forEach((ev) => s.off(ev, handler));
    };
  }, [user.providerId, load]);

  async function toggleStatus() {
    const next = data.provider.status === 'ACTIVE' ? 'OFFLINE' : 'ACTIVE';
    await api.setAvailability(user.providerId, next);
    load();
  }

  async function accept(id) { await api.acceptEmergency(id); load(); }
  async function decline(id, providerType) { await api.declineEmergency(id, providerType); load(); }
  async function arrived(id) { await api.arrivedEmergency(id); load(); }
  async function complete(id) { await api.completeEmergency(id, 'Service completed'); load(); }

  // Demo control: step the provider's live position toward the emergency location
  async function simulateMovement(emg) {
    if (!emg) return;
    const startLat = data.provider.currentLat, startLng = data.provider.currentLng;
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const lat = startLat + ((emg.latitude - startLat) * i) / steps;
      const lng = startLng + ((emg.longitude - startLng) * i) / steps;
      // eslint-disable-next-line no-await-in-loop
      await api.trackingUpdate(emg.id, lat, lng);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 500));
    }
    load();
  }

  if (error) return <div className="p-6 text-[var(--red)]">{error}</div>;
  if (!data) return <div className="p-6 text-[var(--fog)]">Loading…</div>;

  const { provider, stats, newRequests, activeRequest, completed } = data;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-16 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--amber)] font-mono">Provider</div>
          <h1 className="font-display text-3xl font-700">Welcome, {provider.name}</h1>
        </div>
        <button onClick={toggleStatus}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${provider.status === 'ACTIVE' ? 'bg-[var(--green)]/20 text-[var(--green)]' : 'bg-[var(--steel)] text-[var(--fog)]'}`}>
          {provider.status === 'ACTIVE' ? '🟢 AVAILABLE' : '⚪ OFFLINE'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          ['Today', stats.todaysRequests],
          ['Active', stats.active],
          ['Completed', stats.completed],
          ['Rating', `⭐${stats.rating}`],
        ].map(([label, val]) => (
          <div key={label} className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-lg p-3 text-center">
            <div className="font-display text-2xl">{val}</div>
            <div className="text-[10px] uppercase text-[var(--fog)] tracking-wide">{label}</div>
          </div>
        ))}
      </div>

      {activeRequest && (
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--fog)] mb-2">Active Request</div>
          <div className="marker-plate rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">{activeRequest.vehicle} — {activeRequest.type.replace('_', ' ')}</div>
                <div className="text-xs text-[var(--fog)]">{activeRequest.roadName}</div>
                {activeRequest.userName && (
                  <div className="text-xs text-[var(--fog)] mt-1.5 flex items-center gap-1">
                    👤 <span className="font-medium text-white">{activeRequest.userName}</span> 
                    <span>({activeRequest.userPhone})</span>
                  </div>
                )}
                <div className="text-xs mt-1 font-mono text-[var(--amber)]">{activeRequest.status}</div>
              </div>
              <MarkerPlate etaMinutes={activeRequest.etaMinutes} distanceKm={activeRequest.distanceKm} status={activeRequest.status} />
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {activeRequest.userPhone && (
                <a href={`tel:${activeRequest.userPhone}`} className="bg-[var(--steel)] hover:bg-[var(--steel-light)] rounded-lg px-3 py-1.5 text-sm font-semibold transition flex items-center gap-1">
                  📞 CALL TRAVELER
                </a>
              )}
              {activeRequest.status === 'ON_THE_WAY' && (
                <>
                  <button onClick={() => simulateMovement(activeRequest)} className="bg-[var(--steel)] rounded-lg px-3 py-1.5 text-sm">SIMULATE MOVEMENT</button>
                  <button onClick={() => arrived(activeRequest.id)} className="bg-[var(--amber)] text-[var(--asphalt)] font-semibold rounded-lg px-3 py-1.5 text-sm">ARRIVED</button>
                </>
              )}
              {activeRequest.status === 'ARRIVED' && (
                <button onClick={() => complete(activeRequest.id)} className="bg-[var(--green)]/20 text-[var(--green)] rounded-lg px-3 py-1.5 text-sm">COMPLETE SERVICE</button>
              )}
            </div>
          </div>
        </div>
      )}

      {newRequests?.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--fog)] mb-2">🚨 New Requests</div>
          <div className="space-y-2">
            {newRequests.map((r) => (
              <div key={r.id} className="bg-[var(--asphalt-2)] border border-[var(--amber)]/40 rounded-xl p-4">
                <div className="font-semibold">{r.vehicle} — {r.type.replace('_', ' ')}</div>
                <div className="text-xs text-[var(--fog)]">{r.roadName} · {r.distanceKm} km · ETA {r.etaMinutes} min</div>
                {r.userName && (
                  <div className="text-xs text-[var(--fog)] mt-1.5 flex items-center gap-1">
                    👤 <span className="font-medium text-white">{r.userName}</span>
                    <span>({r.userPhone})</span>
                  </div>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={() => accept(r.id)} className="bg-[var(--amber)] text-[var(--asphalt)] font-semibold rounded-lg px-3 py-1.5 text-sm">ACCEPT REQUEST</button>
                  <button onClick={() => decline(r.id, provider.type)} className="bg-[var(--steel)] rounded-lg px-3 py-1.5 text-sm">DECLINE</button>
                  {r.userPhone && (
                    <a href={`tel:${r.userPhone}`} className="bg-[var(--steel)] hover:bg-[var(--steel-light)] rounded-lg px-3 py-1.5 text-sm font-semibold transition flex items-center gap-1">
                      📞 CALL
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!activeRequest && !newRequests?.length && (
        <div className="text-[var(--fog)] text-sm py-8 text-center">No pending or active requests right now.</div>
      )}

      {completed?.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--fog)] mb-2">Completed</div>
          <div className="space-y-1.5">
            {completed.map((c) => (
              <div key={c.id} className="flex justify-between text-sm bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-lg px-3 py-2">
                <span>{c.vehicle} — {c.type.replace('_', ' ')}</span>
                <span className="text-[var(--green)] font-mono text-xs">✓ DONE</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

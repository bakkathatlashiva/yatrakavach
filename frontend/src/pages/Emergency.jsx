import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { getSocket, joinRoom } from '../lib/socket';
import { useAuth } from '../lib/AuthContext';
import MarkerPlate from '../components/MarkerPlate';
import StepChecklist from '../components/StepChecklist';
import Timeline from '../components/Timeline';

const PROBLEMS = [
  { type: 'ENGINE_FAILURE', icon: '🔧', label: 'Mechanic', providerType: 'MECHANIC' },
  { type: 'FUEL_EMPTY', icon: '⛽', label: 'Fuel Partner', providerType: 'FUEL_PARTNER' },
  { type: 'TOWING', icon: '🚛', label: 'Towing', providerType: 'TOWING' },
  { type: 'BATTERY', icon: '🔋', label: 'Battery Assistance', providerType: 'MECHANIC' },
  { type: 'TYRE', icon: '🛞', label: 'Tyre Assistance', providerType: 'MECHANIC' },
  { type: 'ACCIDENT', icon: '🆘', label: 'SOS / Recovery', providerType: 'TOWING' },
];

const DIRECT_SERVICES = [
  { type: 'mechanic', icon: '🔧', label: 'Mechanic' },
  { type: 'fuel', icon: '⛽', label: 'Fuel' },
  { type: 'tyre', icon: '🛞', label: 'Tyre' },
  { type: 'battery', icon: '🔋', label: 'Battery' },
  { type: 'towing', icon: '🚛', label: 'Towing' },
  { type: 'ev_charging', icon: '⚡', label: 'EV Charging' },
];

const getServicesArray = (servicesField) => {
  if (Array.isArray(servicesField)) return servicesField;
  if (typeof servicesField === 'string') {
    try {
      return JSON.parse(servicesField || '[]');
    } catch (e) {
      return [];
    }
  }
  return [];
};

const DEMO_LOC = { latitude: 17.6688, longitude: 80.8933, roadName: 'Bhadrachalam Highway' };
const DEMO_VEHICLE = 'Hyundai Creta';

export default function Emergency() {
  const { user } = useAuth();
  
  // Navigation tabs
  const [viewMode, setViewMode] = useState('dispatch'); // dispatch | direct
  
  // Original stages (Dispatch Assistance flow)
  const [stage, setStage] = useState('pick'); // pick | searching | list | tracking | done
  const [selectedProblems, setSelectedProblems] = useState([]); // Array of problem objects
  const [candidatesMap, setCandidatesMap] = useState({}); // { MECHANIC: [...], FUEL_PARTNER: [...] }
  const [activeRequests, setActiveRequests] = useState([]); // Array of emergency request objects
  const [requestDetailsMap, setRequestDetailsMap] = useState({}); // { id: { emergency, provider, timeline } }
  const [focusedRequestId, setFocusedRequestId] = useState(null);
  const [error, setError] = useState('');

  // Direct Call states
  const [directService, setDirectService] = useState(null); // mechanic | fuel | tyre | battery | towing | ev_charging
  const [directProvider, setDirectProvider] = useState(null);
  const [directLoading, setDirectLoading] = useState(false);
  const [directError, setDirectError] = useState('');
  const [locationSource, setLocationSource] = useState('demo'); // gps | demo
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle | locating | active | error
  const [gpsErrorMsg, setGpsErrorMsg] = useState('');

  // Refresh detailed data for all active requests
  const refreshAll = useCallback(async (requestsToRefresh) => {
    try {
      const details = {};
      let allDone = true;
      for (const reqObj of requestsToRefresh) {
        const data = await api.getEmergency(reqObj.id);
        details[reqObj.id] = data;
        if (data.emergency.status !== 'COMPLETED' && data.emergency.status !== 'CANCELLED') {
          allDone = false;
        }
      }
      setRequestDetailsMap(details);
      
      // If all active requests have completed, transition to done stage
      if (requestsToRefresh.length > 0 && allDone) {
        setStage('done');
      }
    } catch(e) {
      console.error("Error refreshing request details:", e);
    }
  }, []);

  // Listen for socket events for all active requests
  useEffect(() => {
    if (!activeRequests.length) return;
    
    // Join rooms
    activeRequests.forEach((reqObj) => {
      joinRoom(`emergency:${reqObj.id}`);
      joinRoom(`user:${reqObj.userId}`);
    });

    const s = getSocket();
    const handler = () => refreshAll(activeRequests);
    
    const events = [
      'emergency:assigned', 'emergency:accepted', 'emergency:started', 'provider:location',
      'emergency:eta_updated', 'emergency:arrived', 'emergency:completed', 'emergency:declined', 'emergency:cancelled'
    ];
    
    events.forEach((ev) => s.on(ev, handler));
    
    // Initial fetch
    refreshAll(activeRequests);

    return () => {
      events.forEach((ev) => s.off(ev, handler));
    };
  }, [activeRequests, refreshAll]);

  // Toggle selection of problem types
  function toggleProblem(p) {
    setSelectedProblems((prev) => {
      const exists = prev.find(item => item.type === p.type);
      if (exists) {
        return prev.filter(item => item.type !== p.type);
      } else {
        return [...prev, p];
      }
    });
  }

  // Find providers for all selected problem types
  async function findAssistance() {
    if (selectedProblems.length === 0) return;
    setStage('searching');
    setError('');
    
    try {
      const map = {};
      for (const p of selectedProblems) {
        // Query nearby providers for this providerType
        const list = await api.nearbyProviders(p.providerType, DEMO_LOC.latitude, DEMO_LOC.longitude);
        map[p.providerType] = list;
      }
      setCandidatesMap(map);
      setStage('list');
    } catch (e) {
      setError(e.message);
      setStage('pick');
    }
  }

  // Dispatch emergency requests for all selected categories
  async function requestHelp() {
    setError('');
    try {
      const createdList = [];
      for (const p of selectedProblems) {
        const res = await api.createEmergency({
          vehicle: DEMO_VEHICLE,
          type: p.type,
          roadName: DEMO_LOC.roadName,
          latitude: DEMO_LOC.latitude,
          longitude: DEMO_LOC.longitude,
          providerType: p.providerType,
        });
        createdList.push(res.emergency);
      }
      
      setActiveRequests(createdList);
      setFocusedRequestId(createdList[0]?.id || null);
      setStage('tracking');
      refreshAll(createdList);
    } catch (e) {
      setError(e.message);
    }
  }

  function reset() {
    setStage('pick');
    setSelectedProblems([]);
    setCandidatesMap({});
    setActiveRequests([]);
    setRequestDetailsMap({});
    setFocusedRequestId(null);
    setError('');
    
    // Reset Direct Call states
    setDirectService(null);
    setDirectProvider(null);
    setDirectError('');
  }

  // Geolocation Handler
  const getGpsLocation = useCallback((onSuccess) => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsErrorMsg('Geolocation not supported by browser.');
      setLocationSource('demo');
      if (onSuccess) onSuccess(DEMO_LOC.latitude, DEMO_LOC.longitude);
      return;
    }

    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGpsCoords({ latitude, longitude });
        setGpsStatus('active');
        setLocationSource('gps');
        if (onSuccess) onSuccess(latitude, longitude);
      },
      (err) => {
        setGpsStatus('error');
        let msg = 'Failed to get GPS coordinates.';
        if (err.code === 1) msg = 'Location access denied.';
        else if (err.code === 2) msg = 'Position unavailable.';
        else if (err.code === 3) msg = 'Location request timeout.';
        setGpsErrorMsg(msg);
        setLocationSource('demo');
        if (onSuccess) onSuccess(DEMO_LOC.latitude, DEMO_LOC.longitude);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  }, []);

  // Retrieve nearest provider of direct service type from database
  async function findDirectCallProvider(serviceName, useLat, useLng) {
    setDirectLoading(true);
    setDirectError('');
    setDirectProvider(null);

    let providerType = 'MECHANIC';
    if (serviceName === 'fuel') providerType = 'FUEL_PARTNER';
    else if (serviceName === 'towing') providerType = 'TOWING';
    else if (serviceName === 'ev_charging') providerType = 'EV_CHARGING';

    try {
      const list = await api.nearbyProviders(providerType, useLat, useLng);
      let filtered = list.filter(p => p.status === 'ACTIVE' && p.verified);

      if (serviceName === 'tyre') {
        filtered = filtered.filter(p => {
          const svcs = getServicesArray(p.services);
          return svcs.includes('TYRE') || svcs.includes('PUNCTURE');
        });
      } else if (serviceName === 'battery') {
        filtered = filtered.filter(p => {
          const svcs = getServicesArray(p.services);
          return svcs.includes('BATTERY');
        });
      } else if (serviceName === 'mechanic') {
        filtered = filtered.filter(p => {
          const svcs = getServicesArray(p.services);
          return svcs.includes('GENERAL_REPAIR') || svcs.includes('ENGINE_REPAIR');
        });
      }

      if (filtered.length === 0) {
        setDirectProvider(null);
        if (locationSource === 'gps') {
          setDirectError(`No active & verified partners found for ${serviceName} within 50 km of your GPS location. Try using the Demo Location.`);
        } else {
          setDirectError(`No active & verified partners found for ${serviceName} within 50 km.`);
        }
      } else {
        setDirectProvider(filtered[0]);
      }
    } catch (e) {
      setDirectError(`Error searching for providers: ${e.message}`);
    } finally {
      setDirectLoading(false);
    }
  }

  function selectDirectService(serviceName) {
    setDirectService(serviceName);
    
    const searchWithCoords = (lat, lng) => {
      findDirectCallProvider(serviceName, lat, lng);
    };

    if (locationSource === 'gps') {
      if (gpsStatus === 'active' && gpsCoords) {
        searchWithCoords(gpsCoords.latitude, gpsCoords.longitude);
      } else {
        getGpsLocation(searchWithCoords);
      }
    } else {
      searchWithCoords(DEMO_LOC.latitude, DEMO_LOC.longitude);
    }
  }

  // Handle access restrictions
  if (!user || (user.role !== 'USER' && user.role !== 'SUPER_ADMIN')) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-5xl">🛑</div>
        <h2 className="font-display text-3xl font-800 text-white">Access Denied</h2>
        <p className="text-sm text-[var(--fog)]">
          Only registered Travellers or Admins are authorized to request highway assistance.
        </p>
      </div>
    );
  }

  const focusedData = requestDetailsMap[focusedRequestId];
  const focusedEmergency = focusedData?.emergency;
  const focusedProvider = focusedData?.provider;
  const focusedTimeline = focusedData?.timeline || [];

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-16 space-y-6">
      <div className="border-b border-[var(--steel)] pb-4">
        <div className="text-xs uppercase tracking-widest text-[var(--amber)] font-mono">
          📍 {locationSource === 'gps' && gpsCoords ? `${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude.toFixed(4)}` : DEMO_LOC.roadName}
        </div>
        <h1 className="font-display text-4xl font-800 mt-1 text-white">
          {viewMode === 'direct' ? (
            directService ? `📞 Direct Call > ${directService.toUpperCase()}` : '📞 Direct Call Hotline'
          ) : (
            <>
              {stage === 'pick' && '🚨 Emergency Assistance'}
              {stage === 'searching' && 'Locating Verified Help…'}
              {stage === 'list' && 'Nearby Services Found'}
              {stage === 'tracking' && 'Highway Assistance Tracker'}
              {stage === 'done' && '✅ Journey Ready to Resume'}
            </>
          )}
        </h1>
        {viewMode === 'direct' ? (
          <p className="text-[var(--fog)] text-xs mt-1">Get immediate phone access to the nearest verified and active service provider.</p>
        ) : (
          stage === 'pick' && <p className="text-[var(--fog)] text-xs mt-1">Travelling in a <b>{DEMO_VEHICLE}</b>. Select one or more services you require:</p>
        )}
      </div>

      {/* Mode tab switcher (visible in setup stages only) */}
      {(stage === 'pick' || stage === 'searching' || stage === 'list') && (
        <div className="flex bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-lg p-1">
          <button
            onClick={() => {
              setViewMode('dispatch');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
              viewMode === 'dispatch'
                ? 'bg-[var(--amber)] text-[var(--asphalt)]'
                : 'text-[var(--fog)] hover:text-white'
            }`}
          >
            🚨 Emergency Dispatch
          </button>
          <button
            onClick={() => {
              setViewMode('direct');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
              viewMode === 'direct'
                ? 'bg-[var(--amber)] text-[var(--asphalt)]'
                : 'text-[var(--fog)] hover:text-white'
            }`}
          >
            📞 Direct Call Hotline
          </button>
        </div>
      )}

      {error && <div className="text-sm text-[var(--red)] bg-[var(--red)]/10 border border-[var(--red)]/30 rounded-lg px-3 py-2">{error}</div>}

      {viewMode === 'direct' ? (
        <div className="space-y-6">
          {directService === null ? (
            <div className="space-y-6">
              {/* Geolocation selector */}
              <div className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-[var(--steel)] pb-2">
                  <span className="text-xs uppercase tracking-wider text-[var(--fog)] font-mono">Location Mode</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setLocationSource('gps');
                        getGpsLocation();
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded transition ${
                        locationSource === 'gps'
                          ? 'bg-[var(--amber)] text-[var(--asphalt)]'
                          : 'bg-[var(--steel)] text-[var(--fog)] hover:text-white'
                      }`}
                    >
                      GPS
                    </button>
                    <button
                      onClick={() => setLocationSource('demo')}
                      className={`px-3 py-1 text-xs font-semibold rounded transition ${
                        locationSource === 'demo'
                          ? 'bg-[var(--amber)] text-[var(--asphalt)]'
                          : 'bg-[var(--steel)] text-[var(--fog)] hover:text-white'
                      }`}
                    >
                      Demo Location
                    </button>
                  </div>
                </div>

                <div className="text-xs flex items-center justify-between">
                  <div>
                    {locationSource === 'gps' ? (
                      gpsStatus === 'locating' ? (
                        <span className="text-[var(--fog)]">📍 Fetching GPS location...</span>
                      ) : gpsStatus === 'active' && gpsCoords ? (
                        <span className="text-[var(--green)] font-mono">
                          📍 GPS Active: {gpsCoords.latitude.toFixed(4)}, {gpsCoords.longitude.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-[var(--red)]">
                          ⚠️ GPS Error: {gpsErrorMsg || 'Permission denied'}. Using demo fallback.
                        </span>
                      )
                    ) : (
                      <span className="text-[var(--amber)] font-mono">
                        📍 Demo Active: {DEMO_LOC.roadName} (17.6688, 80.8933)
                      </span>
                    )}
                  </div>
                  {locationSource === 'gps' && gpsStatus !== 'locating' && (
                    <button
                      onClick={() => getGpsLocation()}
                      className="text-[var(--amber)] hover:underline font-semibold"
                    >
                      Retry GPS
                    </button>
                  )}
                </div>
              </div>

              {/* Service selectors */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {DIRECT_SERVICES.map((s) => (
                    <button
                      key={s.type}
                      onClick={() => selectDirectService(s.type)}
                      className="bg-[var(--asphalt-2)] border border-[var(--steel)] hover:border-[var(--amber)] rounded-xl py-6 flex flex-col items-center gap-2 transition-all duration-200"
                    >
                      <span className="text-4xl">{s.icon}</span>
                      <span className="text-xs uppercase tracking-wide font-medium text-center px-1 text-white">
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>

                {user && (
                  <div className="text-center text-[10px] text-[var(--fog)] font-mono border-t border-[var(--steel)] pt-2.5">
                    Authorized Traveller Session: <span className="text-[var(--green)]">{user.name} ({user.role})</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {directLoading && (
                <div className="text-center py-16 text-[var(--fog)] space-y-4 bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-[var(--amber)] pulse-dot mx-auto" />
                  <p className="text-sm">Querying database for nearest active & verified provider...</p>
                </div>
              )}

              {directError && (
                <div className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-5 text-center space-y-4">
                  <div className="text-4xl text-[var(--red)]">⚠️</div>
                  <h3 className="font-display text-2xl font-700 text-white uppercase">No Service Partner Found</h3>
                  <p className="text-xs text-[var(--fog)]">{directError}</p>

                  {locationSource === 'gps' && (
                    <button
                      onClick={() => {
                        setLocationSource('demo');
                        findDirectCallProvider(directService, DEMO_LOC.latitude, DEMO_LOC.longitude);
                      }}
                      className="w-full bg-[var(--amber)] text-[var(--asphalt)] font-semibold py-2.5 rounded-lg hover:opacity-90 transition text-xs uppercase tracking-wider"
                    >
                      Switch to Demo Location
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setDirectError('');
                      setDirectService(null);
                    }}
                    className="w-full bg-[var(--steel)] text-white font-semibold py-2 rounded-lg hover:bg-[var(--steel-light)] transition text-xs"
                  >
                    Back to Services
                  </button>
                </div>
              )}

              {directProvider && (
                <div className="marker-plate rounded-xl p-5 text-center space-y-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--amber)] font-mono mb-1">
                      Nearest Verified Provider Found
                    </div>
                    <h2 className="font-display text-3xl font-800 text-white flex items-center justify-center gap-1.5 flex-wrap">
                      <span>{directProvider.name}</span>
                      {directProvider.verified && (
                        <span className="text-[10px] text-[var(--green)] bg-[var(--green)]/15 border border-[var(--green)]/30 rounded px-1.5 py-0.5 font-sans normal-case tracking-normal">
                          ✓ Verified
                        </span>
                      )}
                    </h2>
                    <div className="text-xs text-[var(--fog)] mt-1 flex items-center justify-center gap-2">
                      <span>⭐ {directProvider.rating.toFixed(1)}</span>
                      <span>·</span>
                      <span className="text-[var(--green)]">🟢 {directProvider.status}</span>
                    </div>
                  </div>

                  {/* Distance and ETA */}
                  <div className="flex justify-center">
                    <MarkerPlate
                      etaMinutes={directProvider.etaMinutes}
                      distanceKm={directProvider.distanceKm}
                      status="ACTIVE"
                    />
                  </div>

                  {/* Details table */}
                  <div className="bg-[var(--asphalt)]/40 border border-[var(--steel)] rounded-lg p-3 text-left text-xs space-y-2">
                    <div>
                      <span className="text-[var(--fog)] font-semibold">Operating Hours:</span>{' '}
                      <span className="text-white font-medium">{directProvider.operatingHours || '24/7'}</span>
                    </div>
                    <div>
                      <span className="text-[var(--fog)] font-semibold">Address:</span>{' '}
                      <span className="text-white">{directProvider.address}</span>
                    </div>
                    {directProvider.highway && (
                      <div>
                        <span className="text-[var(--fog)] font-semibold">Highway:</span>{' '}
                        <span className="text-white font-mono">{directProvider.highway}</span>
                      </div>
                    )}
                    <div className="border-t border-[var(--steel)] pt-2 mt-2">
                      <span className="text-[var(--fog)] font-semibold block mb-1">Services Offered:</span>
                      <div className="flex flex-wrap gap-1">
                        {getServicesArray(directProvider.services).map((svc) => (
                          <span
                            key={svc}
                            className="bg-[var(--steel-light)] text-white text-[10px] px-2 py-0.5 rounded font-mono uppercase"
                          >
                            {svc.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Call Now and WhatsApp Actions */}
                  <div className="flex gap-2">
                    {directProvider.phone ? (
                      <a
                        href={`tel:${directProvider.phone}`}
                        className="flex-1 bg-[var(--amber)] text-[var(--asphalt)] font-800 uppercase tracking-wider py-3 rounded-lg hover:opacity-90 transition font-display text-lg text-center flex items-center justify-center gap-2"
                      >
                        📞 Call Now
                      </a>
                    ) : (
                      <button
                        disabled
                        className="flex-1 bg-[var(--steel)] text-[var(--fog)] font-800 uppercase tracking-wider py-3 rounded-lg cursor-not-allowed text-lg"
                      >
                        📞 No Phone Available
                      </button>
                    )}

                    {directProvider.whatsapp && (
                      <a
                        href={`https://wa.me/${directProvider.whatsapp}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#25D366] text-white font-semibold px-4 py-3 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-1.5 text-xs text-center"
                      >
                        💬 WhatsApp
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setDirectProvider(null);
                      setDirectService(null);
                    }}
                    className="w-full bg-[var(--steel)] text-white font-semibold py-2 rounded-lg hover:bg-[var(--steel-light)] transition text-xs"
                  >
                    Back to Services
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* STAGE 1: Pick problem types (Multi-select) */}
          {stage === 'pick' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {PROBLEMS.map((p) => {
                  const isSelected = selectedProblems.some(item => item.type === p.type);
                  return (
                    <button key={p.type} onClick={() => toggleProblem(p)}
                      className={`bg-[var(--asphalt-2)] border rounded-xl py-5 flex flex-col items-center gap-2 transition-all duration-200 ${isSelected ? 'border-[var(--amber)] ring-1 ring-[var(--amber)]' : 'border-[var(--steel)] hover:border-[var(--fog)]'}`}>
                      <span className="text-3xl">{p.icon}</span>
                      <span className="text-xs uppercase tracking-wide font-medium text-center px-1">{p.label}</span>
                    </button>
                  );
                })}
              </div>

              <button disabled={selectedProblems.length === 0} onClick={findAssistance}
                className="w-full bg-[var(--amber)] text-[var(--asphalt)] font-800 uppercase tracking-wider py-3 rounded-lg hover:opacity-90 disabled:opacity-30 transition font-display text-lg">
                FIND ASSISTANCE {selectedProblems.length > 0 ? `(${selectedProblems.length} SELECTED)` : ''}
              </button>
            </div>
          )}

          {/* STAGE 2: Locating help loader */}
          {stage === 'searching' && (
            <div className="text-center py-16 text-[var(--fog)] space-y-4 bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl">
              <div className="w-4 h-4 rounded-full bg-[var(--amber)] pulse-dot mx-auto" />
              <p className="text-sm">Obtaining GPS location & querying closest active providers...</p>
            </div>
          )}

          {/* STAGE 3: List discovered providers for each service */}
          {stage === 'list' && (
            <div className="space-y-4">
              {selectedProblems.map((p) => {
                const list = candidatesMap[p.providerType] || [];
                const best = list[0];
                return (
                  <div key={p.type} className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 border-b border-[var(--steel)] pb-2">
                      <span className="text-xl">{p.icon}</span>
                      <h3 className="font-display text-lg text-white font-700 uppercase tracking-wide">{p.label} Assistance</h3>
                    </div>
                    
                    {list.length === 0 ? (
                      <div className="text-xs text-[var(--red)] py-2">⚠️ No active {p.label.toLowerCase()} partners found within 50 km.</div>
                    ) : (
                      <div className="space-y-2">
                        {list.map((partner) => (
                          <div key={partner.id} className="flex justify-between items-start text-xs bg-[var(--steel)]/30 p-2.5 rounded-lg border border-[var(--steel)]/60">
                            <div>
                              <div className="font-semibold text-white flex items-center gap-1">
                                {partner.name}
                                {partner.verified && <span className="text-[10px] text-[var(--green)]">✓ Verified</span>}
                              </div>
                              <div className="text-[10px] text-[var(--fog)] mt-0.5">Rating: ⭐{partner.rating} · 🟢 ACTIVE</div>
                            </div>
                            <div className="text-right font-mono flex flex-col items-end gap-1">
                              <div>{partner.distanceKm} km</div>
                              <div className="text-[var(--fog)]">{partner.etaMinutes} min ETA</div>
                              {partner.phone && (
                                <a href={`tel:${partner.phone}`} className="bg-[var(--steel)] hover:bg-[var(--steel-light)] rounded px-2.5 py-1 text-[10px] font-semibold transition mt-1.5 flex items-center gap-1">
                                  📞 CALL
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex gap-2">
                <button onClick={requestHelp} className="flex-1 bg-[var(--amber)] text-[var(--asphalt)] font-800 uppercase tracking-wider py-3 rounded-lg hover:opacity-90 transition font-display text-lg">
                  REQUEST ASSISTANCE NOW
                </button>
                <button onClick={() => setStage('pick')} className="bg-[var(--steel)] text-white font-semibold px-4 py-3 rounded-lg hover:bg-[var(--steel-light)] transition">
                  Back
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: Real-time assistance tracking screen (Unified) */}
          {stage === 'tracking' && activeRequests.length > 0 && (
            <div className="space-y-4">
              {/* Unified active emergency listing at top */}
              <div className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-4 space-y-2.5">
                <div className="text-[10px] uppercase tracking-wider text-[var(--fog)] border-b border-[var(--steel)] pb-1.5 font-mono">Active Roadside Dispatches</div>
                <div className="space-y-2">
                  {activeRequests.map((reqObj) => {
                    const det = requestDetailsMap[reqObj.id];
                    const emg = det?.emergency || reqObj;
                    const prov = det?.provider;
                    const isFocused = emg.id === focusedRequestId;
                    
                    const icon = PROBLEMS.find(p => p.type === emg.type)?.icon || '🚨';
                    
                    return (
                      <button key={emg.id} onClick={() => setFocusedRequestId(emg.id)}
                        className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${isFocused ? 'bg-[var(--steel)]/60 border-[var(--amber)]' : 'bg-[var(--steel)]/20 border-[var(--steel)] hover:bg-[var(--steel)]/30'}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{icon}</span>
                          <div>
                            <div className="font-semibold text-white">{prov?.name || 'Locating Partner...'}</div>
                            <div className="text-[10px] text-[var(--fog)]">{emg.type.replace('_', ' ')} · {emg.roadName}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xs font-semibold text-[var(--amber)]">{emg.status}</div>
                          {emg.status !== 'COMPLETED' && emg.status !== 'CANCELLED' && (
                            <div className="text-[10px] text-[var(--fog)] font-mono">{emg.etaMinutes != null ? `${emg.etaMinutes} min ETA` : '—'}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Details & timeline for focused request */}
              {focusedEmergency && (
                <div className="space-y-4">
                  {/* Highlight Refined Status Card */}
                  <div className="marker-plate rounded-xl p-5 text-center space-y-4">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-[var(--amber)] font-mono mb-1">
                        {focusedEmergency.status === 'COMPLETED' ? '✓ SERVICE COMPLETED' : `🚗 ${focusedProvider?.name || 'Partner'} is coming!`}
                      </div>
                      <h2 className="font-display text-3xl font-800 text-white">
                        {focusedProvider?.name} {focusedProvider?.verified && <span className="text-sm text-[var(--green)]">✓ Verified</span>}
                      </h2>
                    </div>

                    <div className="flex justify-center">
                      <MarkerPlate etaMinutes={focusedEmergency.etaMinutes} distanceKm={focusedEmergency.distanceKm} status={focusedEmergency.status} />
                    </div>

                    {/* Subtext */}
                    <p className="text-xs text-[var(--fog)] italic max-w-sm mx-auto">
                      {focusedEmergency.status === 'REQUESTED' && 'Your request has been dispatched. Matching with closest partner...'}
                      {focusedEmergency.status === 'ASSIGNED' && 'Assistance request assigned. Waiting for provider confirmation.'}
                      {focusedEmergency.status === 'ACCEPTED' && 'Your roadside assistance request has been accepted. Partner is preparing dispatch.'}
                      {focusedEmergency.status === 'ON_THE_WAY' && 'A mechanic is on the way to your location. Keep safety indicators active.'}
                      {focusedEmergency.status === 'ARRIVED' && 'Assistance has arrived at your location. Commencing diagnosis.'}
                      {focusedEmergency.status === 'COMPLETED' && 'Roadside service complete. You are safe to continue your travel.'}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2 justify-center">
                      {focusedProvider?.phone ? (
                        <a href={`tel:${focusedProvider.phone}`} className="bg-[var(--steel)] hover:bg-[var(--steel-light)] rounded-lg px-4 py-2 text-xs font-semibold tracking-wider transition">📞 CALL</a>
                      ) : (
                        <button disabled className="bg-[var(--steel)]/30 text-[var(--fog)] rounded-lg px-4 py-2 text-xs font-semibold tracking-wider cursor-not-allowed">📞 CALL</button>
                      )}
                      <button className="bg-[var(--steel)] hover:bg-[var(--steel-light)] rounded-lg px-4 py-2 text-xs font-semibold tracking-wider transition">📍 TRACK</button>
                      {focusedEmergency.status !== 'COMPLETED' && focusedEmergency.status !== 'CANCELLED' && (
                        <button onClick={async () => {
                          await api.cancelEmergency(focusedEmergency.id);
                          // Remove request from active list
                          const nextList = activeRequests.filter(r => r.id !== focusedEmergency.id);
                          setActiveRequests(nextList);
                          if (nextList.length > 0) setFocusedRequestId(nextList[0].id);
                          else reset();
                        }} className="bg-[var(--red)]/20 text-[var(--red)] hover:bg-[var(--red)]/30 rounded-lg px-4 py-2 text-xs font-semibold tracking-wider transition">CANCEL</button>
                      )}
                    </div>
                  </div>

                  {/* Live Tracking Visual Graphic */}
                  {focusedEmergency.status === 'ON_THE_WAY' && (
                    <div className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-5 space-y-4">
                      <div className="text-xs uppercase tracking-wide text-[var(--fog)] font-mono border-b border-[var(--steel)] pb-1.5">Live Tracking Radar</div>
                      
                      {/* Vertical Tracking Map Diagram */}
                      <div className="flex flex-col items-center py-6 bg-[var(--steel)]/10 rounded-lg relative overflow-hidden">
                        {/* User Marker */}
                        <div className="flex flex-col items-center z-10">
                          <div className="text-3xl animate-bounce">🚗</div>
                          <span className="text-[10px] font-mono bg-[var(--amber)] text-[var(--asphalt)] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">YOU (Hyundai Creta)</span>
                        </div>

                        {/* Path line & distance indicator */}
                        <div className="h-28 w-1 bg-dashed border-l border-dashed border-[var(--steel-light)] my-2 relative flex items-center justify-center">
                          <span className="absolute bg-[var(--asphalt-2)] border border-[var(--steel)] font-mono text-xs px-2.5 py-1 rounded-full text-white font-bold z-10">
                            {focusedEmergency.distanceKm} km
                          </span>
                        </div>

                        {/* Provider Marker */}
                        <div className="flex flex-col items-center z-10">
                          <div className="text-3xl animate-pulse">🚙</div>
                          <span className="text-[10px] font-mono bg-white text-[var(--asphalt)] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{focusedProvider?.name}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status checklist */}
                  <div className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-4">
                    <div className="text-xs uppercase tracking-wide text-[var(--fog)] mb-2 font-mono">Workflow Progress</div>
                    <StepChecklist status={focusedEmergency.status} />
                  </div>

                  {/* Timeline */}
                  <div className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-4">
                    <div className="text-xs uppercase tracking-wide text-[var(--fog)] mb-3 font-mono">Assistance Timeline</div>
                    <Timeline events={focusedTimeline} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STAGE 5: Done / resolved screen */}
          {stage === 'done' && (
            <div className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-6 text-center space-y-4">
              <div className="text-5xl">🎉</div>
              <h2 className="font-display text-3xl font-800 text-white">All Services Completed</h2>
              <p className="text-sm text-[var(--fog)]">
                Shiva's Garage and Shiva's Bunk have successfully resolved your breakdown emergencies on the Bhadrachalam Highway.
              </p>
              <button onClick={reset} className="w-full bg-[var(--amber)] text-[var(--asphalt)] font-800 uppercase py-3 rounded-lg hover:opacity-90 transition font-display text-lg tracking-wider">
                REQUEST NEW HELP
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

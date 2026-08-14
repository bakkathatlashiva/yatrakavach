const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('yk_token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    return data;
  } catch (err) {
    // If it's a network error (failed connection, DNS issue, CORS block, etc.)
    if (err.name === 'TypeError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      console.error(`Network connection error to backend URL: ${BASE}${path}`, err);
      
      let errorMsg = `Failed to connect to the backend server at "${BASE}".`;
      if (BASE.includes('localhost') && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        errorMsg += ` Your frontend is running in production (${window.location.hostname}) but is trying to connect to a local backend ("${BASE}"). Please set the VITE_API_URL environment variable in Vercel to your Render backend URL (e.g., https://your-backend.onrender.com) and redeploy.`;
      } else {
        errorMsg += ` Please verify the backend is running and your VITE_API_URL environment variable is set correctly.`;
      }
      
      throw new Error(errorMsg);
    }
    throw err;
  }
}

export const api = {
  login: (phone, password) => request('/api/auth/login', { method: 'POST', body: { phone, password }, auth: false }),
  demoAccounts: () => request('/api/auth/demo-accounts', { auth: false }),

  nearbyProviders: (type, lat, lng) => request(`/api/providers/nearby?type=${type}&lat=${lat}&lng=${lng}`),
  providerDashboard: (id) => request(`/api/providers/${id}/dashboard`),
  setAvailability: (id, status) => request(`/api/providers/${id}/availability`, { method: 'PATCH', body: { status } }),

  createEmergency: (payload) => request('/api/emergency', { method: 'POST', body: payload }),
  getEmergency: (id) => request(`/api/emergency/${id}`),
  myEmergencies: () => request('/api/emergency'),
  acceptEmergency: (id) => request(`/api/emergency/${id}/accept`, { method: 'POST' }),
  declineEmergency: (id, providerType) => request(`/api/emergency/${id}/decline`, { method: 'POST', body: { providerType } }),
  arrivedEmergency: (id) => request(`/api/emergency/${id}/arrived`, { method: 'POST' }),
  completeEmergency: (id, note) => request(`/api/emergency/${id}/complete`, { method: 'POST', body: { note } }),
  trackingUpdate: (id, latitude, longitude) => request(`/api/emergency/${id}/tracking`, { method: 'POST', body: { latitude, longitude } }),
  cancelEmergency: (id) => request(`/api/emergency/${id}/cancel`, { method: 'POST' }),

  adminListProviders: (type) => request(`/api/admin/providers${type ? `?type=${type}` : ''}`),
  adminAddProvider: (payload) => request('/api/admin/providers', { method: 'POST', body: payload }),
  adminApproveProvider: (id) => request(`/api/admin/providers/${id}/approve`, { method: 'POST' }),
  adminSuspendProvider: (id) => request(`/api/admin/providers/${id}/suspend`, { method: 'POST' }),
  adminDeleteProvider: (id) => request(`/api/admin/providers/${id}`, { method: 'DELETE' }),
  adminActiveEmergencies: () => request('/api/admin/emergencies/active'),
  adminAssignProvider: (id, providerId) => request(`/api/emergency/${id}/assign`, { method: 'POST', body: { providerId } }),

  adminUpdateProvider: (id, payload) => request(`/api/admin/providers/${id}`, { method: 'PUT', body: payload }),

  demoScenario: () => request('/api/demo/scenario', { auth: false }),
  demoReset: () => request('/api/demo/reset', { method: 'POST' }),
  demoCarBreakdown: () => request('/api/demo/car-breakdown', { method: 'POST' }),
  demoEmptyFuel: () => request('/api/demo/empty-fuel', { method: 'POST' }),
  demoMechanicAccept: () => request('/api/demo/mechanic-accept', { method: 'POST' }),
  demoFuelAccept: () => request('/api/demo/fuel-accept', { method: 'POST' }),
  demoMovement: () => request('/api/demo/movement', { method: 'POST' }),
  demoArrival: () => request('/api/demo/arrival', { method: 'POST' }),
  demoRepairComplete: () => request('/api/demo/repair-complete', { method: 'POST' }),
  demoFuelDelivered: () => request('/api/demo/fuel-delivered', { method: 'POST' }),
};

export { getToken, BASE };

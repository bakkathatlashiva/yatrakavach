import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const QUICK = [
  { label: 'Traveller', phone: '9999911111', password: 'demo123', role: 'USER', to: '/emergency' },
  { label: "Shiva's Garage", phone: '9999922222', password: 'provider123', role: 'PROVIDER', to: '/provider' },
  { label: "Shiva's Bunk", phone: '9999933333', password: 'provider123', role: 'PROVIDER', to: '/provider' },
  { label: 'Tagarampudi Issaku', phone: '9999900000', password: 'admin123', role: 'SUPER_ADMIN', to: '/admin' },
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function doLogin(p, pw, to) {
    setErr('');
    setBusy(true);
    try {
      const user = await login(p, pw);
      nav(to || roleHome(user.role));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function roleHome(role) {
    if (role === 'SUPER_ADMIN') return '/admin';
    if (role === 'PROVIDER') return '/provider';
    return '/emergency';
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block hazard-stripe w-14 h-14 rounded-lg mb-3" />
          <h1 className="font-display text-4xl font-800 tracking-wide">YATRAKAVACH</h1>
          <p className="text-[var(--fog)] text-sm mt-1">Highway breakdown assistance, dispatched in minutes.</p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); doLogin(phone, password); }}
          className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-5 space-y-3"
        >
          <div>
            <label className="text-xs uppercase tracking-wider text-[var(--fog)]">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full mt-1 bg-[var(--steel)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--amber)]"
              placeholder="9999900000" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-[var(--fog)]">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 bg-[var(--steel)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--amber)]"
              placeholder="••••••••" />
          </div>
          {err && <div className="text-[var(--red)] text-sm">{err}</div>}
          <button disabled={busy} className="w-full bg-[var(--amber)] text-[var(--asphalt)] font-semibold rounded-lg py-2 hover:opacity-90 disabled:opacity-50">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6">
          <div className="text-xs uppercase tracking-wider text-[var(--fog)] mb-2">Demo accounts</div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK.map((q) => (
              <button key={q.label} onClick={() => doLogin(q.phone, q.password, q.to)}
                className="text-left bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-lg px-3 py-2 hover:border-[var(--amber)] transition">
                <div className="text-sm font-medium">{q.label}</div>
                <div className="text-[10px] text-[var(--fog)] font-mono">{q.role}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

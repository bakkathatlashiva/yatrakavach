import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function NavBar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return null;

  return (
    <div className="border-b border-[var(--steel)] bg-[var(--asphalt-2)]">
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="hazard-stripe w-5 h-5 rounded" />
          <span className="font-display text-lg tracking-wide">YATRAKAVACH</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[var(--fog)] hidden sm:inline">{user.name} · <span className="font-mono text-xs">{user.role}</span></span>
          <button onClick={() => { logout(); nav('/login'); }} className="text-[var(--fog)] hover:text-[var(--red)]">Sign out</button>
        </div>
      </div>
    </div>
  );
}

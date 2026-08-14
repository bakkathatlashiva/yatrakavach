import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import NavBar from './components/NavBar';
import Login from './pages/Login';
import Emergency from './pages/Emergency';
import ProviderDashboard from './pages/ProviderDashboard';
import AdminDashboard from './pages/AdminDashboard';

function Private({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'PROVIDER') return <Navigate to="/provider" replace />;
  return <Navigate to="/emergency" replace />;
}

function Shell() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/emergency" element={<Private roles={['USER', 'SUPER_ADMIN']}><Emergency /></Private>} />
        <Route path="/provider" element={<Private roles={['PROVIDER', 'SUPER_ADMIN']}><ProviderDashboard /></Private>} />
        <Route path="/admin" element={<Private roles={['SUPER_ADMIN']}><AdminDashboard /></Private>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}

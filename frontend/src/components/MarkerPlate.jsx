export default function MarkerPlate({ etaMinutes, distanceKm, status }) {
  const label = status === 'ARRIVED' ? 'ARRIVED' : etaMinutes != null ? `${etaMinutes} MIN` : '—';
  return (
    <div className="marker-plate rounded-lg px-4 py-3 flex items-center justify-between min-w-[180px]">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-[var(--amber)] font-mono">ETA</div>
        <div className="font-display text-3xl font-700 leading-none">{label}</div>
      </div>
      {distanceKm != null && (
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-[var(--amber)] font-mono">DIST</div>
          <div className="font-mono text-lg">{distanceKm} km</div>
        </div>
      )}
    </div>
  );
}

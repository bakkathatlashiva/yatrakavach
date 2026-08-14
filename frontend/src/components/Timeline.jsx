function timeOf(ts) {
  try {
    return new Date(ts.replace(' ', 'T') + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

export default function Timeline({ events }) {
  if (!events?.length) return <div className="text-[var(--fog)] text-sm">No events yet.</div>;
  return (
    <div className="space-y-0">
      {events.map((e, i) => (
        <div key={e.id || i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-[var(--amber)] mt-1.5" />
            {i < events.length - 1 && <div className="w-px flex-1 bg-[var(--steel-light)]" />}
          </div>
          <div className="pb-4">
            <div className="font-mono text-xs text-[var(--fog)]">{timeOf(e.timestamp)}</div>
            <div className="text-sm">{e.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

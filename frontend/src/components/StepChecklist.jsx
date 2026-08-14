const STEPS = [
  { key: 'REQUESTED', label: 'Request received' },
  { key: 'ASSIGNED', label: 'Provider assigned' },
  { key: 'ON_THE_WAY', label: 'Provider on the way' },
  { key: 'ARRIVED', label: 'Provider arrived' },
  { key: 'COMPLETED', label: 'Service completed' },
];
const ORDER = STEPS.map((s) => s.key);

export default function StepChecklist({ status }) {
  const currentIdx = ORDER.indexOf(status === 'ACCEPTED' ? 'ON_THE_WAY' : status);
  return (
    <div className="space-y-1.5">
      {STEPS.map((s, i) => {
        const done = i <= currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-2 text-sm">
            <span className={done ? 'text-[var(--green)]' : 'text-[var(--steel-light)]'}>{done ? '✓' : '○'}</span>
            <span className={done ? 'text-[var(--paper)]' : 'text-[var(--fog)]'}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

import { useState } from 'react';

const SERVICE_OPTIONS = {
  MECHANIC: ['GENERAL_REPAIR', 'ENGINE_REPAIR', 'BATTERY', 'TYRE', 'PUNCTURE', 'ELECTRICAL', 'OIL_FLUID', 'EMERGENCY_ROADSIDE_ASSISTANCE'],
  FUEL_PARTNER: ['EMERGENCY_FUEL_ASSISTANCE', 'DELIVERY_AUTHORIZED_PARTNER'],
  TOWING: ['FLATBED_TOW', 'WINCH_RECOVERY', 'ACCIDENT_RECOVERY'],
  EV_CHARGING: ['FAST_CHARGE', 'PORTABLE_CHARGE'],
  OTHER: ['GENERAL_ASSISTANCE'],
};

const FUEL_OPTIONS = ['PETROL', 'DIESEL', 'CNG', 'EV'];
const VEHICLE_OPTIONS = ['BIKE', 'CAR', 'SUV', 'VAN', 'TRUCK'];

// Pretty printing labels
const LABELS = {
  GENERAL_REPAIR: 'General Repair',
  ENGINE_REPAIR: 'Engine Repair',
  BATTERY: 'Battery',
  TYRE: 'Tyre',
  PUNCTURE: 'Puncture',
  ELECTRICAL: 'Electrical',
  OIL_FLUID: 'Oil / Fluid',
  EMERGENCY_ROADSIDE_ASSISTANCE: 'Emergency Roadside Assistance',
  EMERGENCY_FUEL_ASSISTANCE: 'Emergency Fuel Assistance / Available',
  DELIVERY_AUTHORIZED_PARTNER: 'Delivery / Assistance: Authorized Partner',
  FLATBED_TOW: 'Flatbed Tow',
  WINCH_RECOVERY: 'Winch Recovery',
  ACCIDENT_RECOVERY: 'Accident Recovery',
  FAST_CHARGE: 'Fast Charge',
  PORTABLE_CHARGE: 'Portable Charge',
  GENERAL_ASSISTANCE: 'General Assistance',
};

export default function ProviderForm({ initialType = 'MECHANIC', onSubmit, onCancel, provider }) {
  const [form, setForm] = useState(() => {
    if (provider) {
      return {
        name: provider.name || '',
        type: provider.type || initialType,
        ownerName: provider.ownerName || '',
        phone: provider.phone || '',
        whatsapp: provider.whatsapp || '',
        address: provider.address || '',
        state: provider.state || 'Telangana',
        district: provider.district || '',
        highway: provider.highway || '',
        latitude: provider.latitude != null ? String(provider.latitude) : '',
        longitude: provider.longitude != null ? String(provider.longitude) : '',
        services: provider.services || [],
        fuelTypes: provider.fuelTypes || [],
        vehicleTypes: provider.vehicleTypes || [],
        is247: !!provider.is247,
        operatingHours: provider.operatingHours || '',
      };
    }
    return {
      name: '',
      type: initialType,
      ownerName: '',
      phone: '',
      whatsapp: '',
      address: '',
      state: 'Telangana',
      district: '',
      highway: '',
      latitude: '',
      longitude: '',
      services: [],
      fuelTypes: [],
      vehicleTypes: [],
      is247: false,
      operatingHours: '',
    };
  });

  function toggle(field, val) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(val) ? f[field].filter((v) => v !== val) : [...f[field], val]
    }));
  }

  function submit(e) {
    e.preventDefault();
    onSubmit({
      ...form,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude)
    });
  }

  const input = "w-full mt-1 bg-[var(--steel)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--amber)] text-sm";
  const labelClass = "text-xs uppercase tracking-wider text-[var(--fog)]";

  // Dynamic names according to provider type
  const isMechanic = form.type === 'MECHANIC';
  const isFuel = form.type === 'FUEL_PARTNER';

  const nameLabel = isMechanic ? 'Garage Name' : isFuel ? 'Fuel Partner / Bunk Name' : 'Provider Name';
  const ownerLabel = isMechanic ? 'Owner Name' : isFuel ? 'Owner / Manager Name' : 'Owner Name';

  return (
    <form onSubmit={submit} className="bg-[var(--asphalt-2)] border border-[var(--steel)] rounded-xl p-5 space-y-4">
      <h3 className="font-display text-xl border-b border-[var(--steel)] pb-2 text-[var(--amber)]">
        {provider ? `Edit ${form.name}` : `Add ${form.type.replace('_', ' ')}`}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {!provider && (
          <div className="col-span-2">
            <label className={labelClass}>Provider Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, services: [] })} className={input}>
              {Object.keys(SERVICE_OPTIONS).map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
        )}
        
        <div className="col-span-2">
          <label className={labelClass}>{nameLabel}</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder={isMechanic ? "Shiva's Garage" : "Shiva's Bunk"} />
        </div>

        <div>
          <label className={labelClass}>{ownerLabel}</label>
          <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} className={input} placeholder="e.g. Shiva" />
        </div>

        <div>
          <label className={labelClass}>Phone Number</label>
          <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} placeholder="e.g. 9999922222" />
        </div>

        <div>
          <label className={labelClass}>WhatsApp Number</label>
          <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className={input} placeholder="e.g. 9999922222" />
        </div>

        <div>
          <label className={labelClass}>Highway / Road</label>
          <input value={form.highway} onChange={(e) => setForm({ ...form, highway: e.target.value })} className={input} placeholder="e.g. Bhadrachalam Highway (NH-30)" />
        </div>

        <div className="col-span-2">
          <label className={labelClass}>Address</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={input} placeholder="Near Bhadrachalam Highway, Demo Location" />
        </div>

        <div>
          <label className={labelClass}>State</label>
          <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={input} />
        </div>

        <div>
          <label className={labelClass}>District</label>
          <input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className={input} placeholder="Bhadradri Kothagudem" />
        </div>

        <div>
          <label className={labelClass}>Latitude</label>
          <input required type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className={input} placeholder="e.g. 17.6688" />
        </div>

        <div>
          <label className={labelClass}>Longitude</label>
          <input required type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className={input} placeholder="e.g. 80.8933" />
        </div>

        {isFuel && (
          <div className="col-span-2">
            <label className={labelClass}>Operating Hours</label>
            <input value={form.operatingHours} onChange={(e) => setForm({ ...form, operatingHours: e.target.value })} className={input} placeholder="e.g. 6:00 AM - 10:00 PM" />
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>Services</label>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {SERVICE_OPTIONS[form.type]?.map((s) => (
            <button type="button" key={s} onClick={() => toggle('services', s)}
              className={`text-xs px-2.5 py-1.5 rounded-full border transition-all duration-200 ${form.services.includes(s) ? 'bg-[var(--amber)] text-[var(--asphalt)] border-[var(--amber)] font-medium' : 'border-[var(--steel-light)] text-[var(--fog)] hover:border-[var(--fog)]'}`}>
              {form.services.includes(s) ? '✓ ' : ''}{LABELS[s] || s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {isFuel && (
        <div>
          <label className={labelClass}>Fuel Types</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {FUEL_OPTIONS.map((s) => (
              <button type="button" key={s} onClick={() => toggle('fuelTypes', s)}
                className={`text-xs px-2.5 py-1.5 rounded-full border transition-all duration-200 ${form.fuelTypes.includes(s) ? 'bg-[var(--amber)] text-[var(--asphalt)] border-[var(--amber)] font-medium' : 'border-[var(--steel-light)] text-[var(--fog)] hover:border-[var(--fog)]'}`}>
                {form.fuelTypes.includes(s) ? '✓ ' : ''}{s}
              </button>
            ))}
          </div>
        </div>
      )}

      {isMechanic && (
        <div>
          <label className={labelClass}>Vehicle Types</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {VEHICLE_OPTIONS.map((s) => (
              <button type="button" key={s} onClick={() => toggle('vehicleTypes', s)}
                className={`text-xs px-2.5 py-1.5 rounded-full border transition-all duration-200 ${form.vehicleTypes.includes(s) ? 'bg-[var(--amber)] text-[var(--asphalt)] border-[var(--amber)] font-medium' : 'border-[var(--steel-light)] text-[var(--fog)] hover:border-[var(--fog)]'}`}>
                {form.vehicleTypes.includes(s) ? '✓ ' : ''}{s}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
        <input type="checkbox" checked={form.is247} onChange={(e) => setForm({ ...form, is247: e.target.checked })}
          className="rounded border-[var(--steel-light)] text-[var(--amber)] focus:ring-[var(--amber)]" />
        24/7 Emergency Service
      </label>

      <div className="flex gap-2 pt-2 border-t border-[var(--steel)]">
        <button type="submit" className="bg-[var(--amber)] text-[var(--asphalt)] font-semibold rounded-lg px-4 py-2 text-sm hover:opacity-90 transition">
          {provider ? 'Save Changes' : 'Save Provider'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="bg-[var(--steel)] rounded-lg px-4 py-2 text-sm hover:bg-[var(--steel-light)] transition">Cancel</button>}
      </div>
    </form>
  );
}

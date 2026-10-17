"use client";

import { useEffect, useMemo, useState } from "react";

export type CountryDial = {
  iso: string;
  name: string;
  dial: string;
  flag: string;
};

/** Common dial codes with emoji flags (ISO 3166-1 alpha-2). */
export const COUNTRY_DIALS: CountryDial[] = [
  { iso: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { iso: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { iso: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { iso: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { iso: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
  { iso: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪" },
  { iso: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { iso: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { iso: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { iso: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { iso: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { iso: "BE", name: "Belgium", dial: "+32", flag: "🇧🇪" },
  { iso: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { iso: "AT", name: "Austria", dial: "+43", flag: "🇦🇹" },
  { iso: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪" },
  { iso: "NO", name: "Norway", dial: "+47", flag: "🇳🇴" },
  { iso: "DK", name: "Denmark", dial: "+45", flag: "🇩🇰" },
  { iso: "FI", name: "Finland", dial: "+358", flag: "🇫🇮" },
  { iso: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { iso: "PL", name: "Poland", dial: "+48", flag: "🇵🇱" },
  { iso: "CZ", name: "Czechia", dial: "+420", flag: "🇨🇿" },
  { iso: "RO", name: "Romania", dial: "+40", flag: "🇷🇴" },
  { iso: "HU", name: "Hungary", dial: "+36", flag: "🇭🇺" },
  { iso: "GR", name: "Greece", dial: "+30", flag: "🇬🇷" },
  { iso: "TR", name: "Türkiye", dial: "+90", flag: "🇹🇷" },
  { iso: "UA", name: "Ukraine", dial: "+380", flag: "🇺🇦" },
  { iso: "RU", name: "Russia", dial: "+7", flag: "🇷🇺" },
  { iso: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { iso: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { iso: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { iso: "LK", name: "Sri Lanka", dial: "+94", flag: "🇱🇰" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { iso: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { iso: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { iso: "KW", name: "Kuwait", dial: "+965", flag: "🇰🇼" },
  { iso: "BH", name: "Bahrain", dial: "+973", flag: "🇧🇭" },
  { iso: "OM", name: "Oman", dial: "+968", flag: "🇴🇲" },
  { iso: "IL", name: "Israel", dial: "+972", flag: "🇮🇱" },
  { iso: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { iso: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { iso: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { iso: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { iso: "GH", name: "Ghana", dial: "+233", flag: "🇬🇭" },
  { iso: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { iso: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽" },
  { iso: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { iso: "CL", name: "Chile", dial: "+56", flag: "🇨🇱" },
  { iso: "CO", name: "Colombia", dial: "+57", flag: "🇨🇴" },
  { iso: "PE", name: "Peru", dial: "+51", flag: "🇵🇪" },
  { iso: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { iso: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { iso: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { iso: "HK", name: "Hong Kong", dial: "+852", flag: "🇭🇰" },
  { iso: "TW", name: "Taiwan", dial: "+886", flag: "🇹🇼" },
  { iso: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { iso: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { iso: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭" },
  { iso: "VN", name: "Vietnam", dial: "+84", flag: "🇻🇳" },
  { iso: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { iso: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
];

const TZ_TO_ISO: Record<string, string> = {
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Amsterdam": "NL",
  "Europe/Rome": "IT",
  "Europe/Madrid": "ES",
  "Europe/Stockholm": "SE",
  "Europe/Warsaw": "PL",
  "Asia/Karachi": "PK",
  "Asia/Kolkata": "IN",
  "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA",
  "Asia/Singapore": "SG",
  "Asia/Tokyo": "JP",
  "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK",
  "Australia/Sydney": "AU",
  "Pacific/Auckland": "NZ",
  "Africa/Johannesburg": "ZA",
  "Africa/Lagos": "NG",
  "America/Sao_Paulo": "BR",
  "America/Mexico_City": "MX",
};

export function detectCountryIso(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_TO_ISO[tz]) return TZ_TO_ISO[tz];
  } catch {
    /* ignore */
  }
  try {
    const lang = (navigator.language || "").toUpperCase();
    const region = lang.includes("-") ? lang.split("-")[1] : "";
    if (region && COUNTRY_DIALS.some((c) => c.iso === region)) return region;
  } catch {
    /* ignore */
  }
  return "US";
}

export function formatE164(dial: string, national: string) {
  const digits = national.replace(/\D/g, "");
  if (!digits) return "";
  return `${dial}${digits}`;
}

export function PhoneCountryField({
  countryIso,
  nationalNumber,
  onCountryChange,
  onNationalChange,
  required,
  label = "Phone",
}: {
  countryIso: string;
  nationalNumber: string;
  onCountryChange: (iso: string) => void;
  onNationalChange: (value: string) => void;
  required?: boolean;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const selected = useMemo((): CountryDial => {
    return COUNTRY_DIALS.find((c) => c.iso === countryIso) ?? COUNTRY_DIALS[0]!;
  }, [countryIso]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return COUNTRY_DIALS;
    return COUNTRY_DIALS.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.dial.includes(needle) ||
        c.iso.toLowerCase().includes(needle),
    );
  }, [q]);

  useEffect(() => {
    if (!countryIso) onCountryChange(detectCountryIso());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="as-phone">
      <label className="as-label">{label}</label>
      <div className="as-phone__row">
        <div className={`as-phone__country${open ? " is-open" : ""}`}>
          <button
            type="button"
            className="as-phone__trigger"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="as-phone__flag" aria-hidden>
              {selected.flag}
            </span>
            <span className="as-phone__dial">{selected.dial}</span>
            <span className="as-phone__chev" aria-hidden>
              ▾
            </span>
          </button>
          {open ? (
            <div className="as-phone__menu" role="listbox">
              <input
                className="as-phone__search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search country"
                autoFocus
              />
              <ul>
                {filtered.map((c) => (
                  <li key={c.iso}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={c.iso === selected.iso}
                      onClick={() => {
                        onCountryChange(c.iso);
                        setOpen(false);
                        setQ("");
                      }}
                    >
                      <span aria-hidden>{c.flag}</span>
                      <strong>{c.name}</strong>
                      <em>{c.dial}</em>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <input
          className="as-input as-phone__national"
          type="tel"
          inputMode="tel"
          required={required}
          value={nationalNumber}
          onChange={(e) => onNationalChange(e.target.value)}
          placeholder="Phone number"
          autoComplete="tel-national"
        />
      </div>
    </div>
  );
}

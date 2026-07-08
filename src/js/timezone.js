/**
 * Timezone selector — single-select dropdown that tells the main clock
 * which timezone to display. Persists selection to localStorage.
 *
 * Emits a 'timezone-change' CustomEvent with detail { id, city }.
 */

import { t } from './i18n.js';

// Curated list of common timezones (IANA identifiers → city label)
const TZ_PRESETS = [
  { id: 'America/New_York',    city: 'New York' },
  { id: 'America/Chicago',     city: 'Chicago' },
  { id: 'America/Denver',      city: 'Denver' },
  { id: 'America/Los_Angeles', city: 'Los Angeles' },
  { id: 'America/Sao_Paulo',   city: 'São Paulo' },
  { id: 'Europe/London',       city: 'London' },
  { id: 'Europe/Paris',        city: 'Paris' },
  { id: 'Europe/Berlin',       city: 'Berlin' },
  { id: 'Europe/Moscow',       city: 'Moscow' },
  { id: 'Asia/Dubai',          city: 'Dubai' },
  { id: 'Asia/Kolkata',        city: 'Mumbai' },
  { id: 'Asia/Shanghai',       city: 'Shanghai' },
  { id: 'Asia/Tokyo',          city: 'Tokyo' },
  { id: 'Asia/Seoul',          city: 'Seoul' },
  { id: 'Asia/Singapore',      city: 'Singapore' },
  { id: 'Australia/Sydney',    city: 'Sydney' },
  { id: 'Pacific/Auckland',    city: 'Auckland' },
  { id: 'Pacific/Honolulu',    city: 'Honolulu' },
];

const STORAGE_KEY = 'crit-tomato-timezone';
const DEFAULT_TZ = { id: 'local', city: 'Local' };

export class TimezoneSelector {
  constructor() {
    this.selected = this.load();
    this.elSelect = document.getElementById('tz-select');
  }

  /** Load saved timezone from localStorage. */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Migrate old array format → fallback to local
        if (Array.isArray(parsed)) return DEFAULT_TZ;
        // Valid single-object format
        if (parsed && typeof parsed.id === 'string') {
          return { id: parsed.id, city: parsed.city || parsed.id };
        }
      }
    } catch { /* ignore corrupt data */ }
    return DEFAULT_TZ;
  }

  /** Save current selection to localStorage. */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.selected));
    } catch { /* ignore */ }
  }

  start() {
    this.populateOptions();
    this.elSelect.value = this.selected.id;
    this.elSelect.addEventListener('change', (e) => this.handleSelect(e));
  }

  /** Fill the <select> with preset options. */
  populateOptions() {
    // Remove all options except the first ("Local")
    while (this.elSelect.options.length > 1) {
      this.elSelect.remove(1);
    }

    // Update the "Local" option text for i18n
    this.elSelect.options[0].textContent = t('tz.local');

    // Add preset options
    for (const tz of TZ_PRESETS) {
      const opt = document.createElement('option');
      opt.value = tz.id;
      opt.textContent = tz.city;
      this.elSelect.appendChild(opt);
    }
  }

  handleSelect(e) {
    const select = e.target;
    if (select.value === 'local') {
      this.selected = DEFAULT_TZ;
    } else {
      const option = select.selectedOptions[0];
      const city = option ? option.textContent : select.value;
      this.selected = { id: select.value, city };
    }
    this.save();

    // Notify the rest of the app
    document.dispatchEvent(new CustomEvent('timezone-change', {
      detail: { id: this.selected.id, city: this.selected.city }
    }));
  }

  /** Get current selection. */
  getSelected() {
    return this.selected;
  }

  /** Re-populate on language switch. */
  refresh() {
    this.populateOptions();
    this.elSelect.value = this.selected.id;
  }

  destroy() {
    // No interval to clear
  }
}

/**
 * Local clock — updates every second, supports 12/24h toggle.
 * Supports remote timezone rendering via setTimezone().
 */
import { t, getLang } from './i18n.js';

export class Clock {
  constructor() {
    this.use24h = true;
    this.timer = null;
    this.currentTz = { id: 'local', city: 'Local' };

    this.elTime = document.getElementById('local-time');
    this.elDate = document.getElementById('local-date');
    this.elBtn = document.getElementById('btn-format');
    this.elIndicator = document.getElementById('tz-indicator');
  }

  start() {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);

    this.elBtn.addEventListener('click', () => {
      this.use24h = !this.use24h;
      this.updateFormatBtn();
      this.tick();
    });
  }

  /** Set the active timezone. `tzInfo` has shape { id: string, city: string }. */
  setTimezone(tzInfo) {
    this.currentTz = tzInfo;
    this.elIndicator.textContent = tzInfo.city;
    this.tick();
  }

  updateFormatBtn() {
    this.elBtn.textContent = this.use24h ? t('format.24h') : t('format.12h');
  }

  /** Re-render dynamic i18n text (called on language switch). */
  refresh() {
    this.updateFormatBtn();
    // Update indicator to i18n value if showing "Local"
    if (this.currentTz.id === 'local') {
      this.elIndicator.textContent = t('tz.local');
    }
    this.tick();
  }

  tick() {
    const now = new Date();
    if (this.currentTz.id === 'local') {
      this.elTime.textContent = this.formatTime(now);
      this.elDate.textContent = this.formatDate(now);
    } else {
      this.elTime.textContent = this.formatTzTime(now, this.currentTz.id);
      this.elDate.textContent = this.formatTzDate(now, this.currentTz.id);
    }
  }

  /* ---- Local time formatters ---- */

  formatTime(date) {
    let h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');

    if (this.use24h) {
      return `${String(h).padStart(2, '0')}:${m}:${s}`;
    }
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m}:${s} ${ampm}`;
  }

  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const locale = getLang() === 'zh-CN' ? 'zh-CN' : 'en-US';
    const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
    return `${y}/${m}/${d} ${weekday}`;
  }

  /* ---- Remote timezone formatters ---- */

  formatTzTime(date, tzId) {
    try {
      const opts = {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: !this.use24h, timeZone: tzId
      };
      return new Intl.DateTimeFormat('en-US', opts).format(date);
    } catch {
      return '--:--:--';
    }
  }

  formatTzDate(date, tzId) {
    try {
      // Extract Y/M/D in target timezone
      const y = parseInt(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: tzId }).format(date));
      const m = parseInt(new Intl.DateTimeFormat('en-US', { month: '2-digit', timeZone: tzId }).format(date));
      const d = parseInt(new Intl.DateTimeFormat('en-US', { day: '2-digit', timeZone: tzId }).format(date));
      const locale = getLang() === 'zh-CN' ? 'zh-CN' : 'en-US';
      const weekday = date.toLocaleDateString(locale, { weekday: 'long', timeZone: tzId });
      return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')} ${weekday}`;
    } catch {
      return '---';
    }
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
  }
}

/**
 * Crit Tomato — App entry point.
 * Initializes i18n, clock (with timezone switching), pomodoro timer, and window controls.
 *
 * Normal mode: full window (320×520) with clock, timezone selector, pomodoro.
 * Mini mode:  compact overlay (220×~80–140) — only time+date visible,
 *              controls fade in on hover.
 */
import { bindI18n, getLang, setLang } from './i18n.js';
import { Clock } from './clock.js';
import { TimezoneSelector } from './timezone.js';
import { Pomodoro } from './pomodoro.js';

class App {
  constructor() {
    this.isMiniMode = false;
    this.isPinned = true;
    this.clock = new Clock();
    this.timezones = new TimezoneSelector();
    this.pomodoro = new Pomodoro();
    this._pomoHandler = null;
    // Elements force-hidden in mini mode (restored on exit)
    this._miniHidden = [];
  }

  async init() {
    bindI18n();

    this.clock.start();
    this.timezones.start();
    this.pomodoro.start();

    // Sync clock to persisted timezone on startup
    this.clock.setTimezone(this.timezones.getSelected());

    // Listen for timezone changes from the dropdown
    document.addEventListener('timezone-change', (e) => {
      this.clock.setTimezone({ id: e.detail.id, city: e.detail.city });
    });

    this.setupWindowControls();
    this.setupLangToggle();
  }

  /* ---- Mini-mode ---- */

  async toggleMiniMode() {
    this.isMiniMode = !this.isMiniMode;

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();

      if (this.isMiniMode) {
        await this.enterMiniMode(win);
      } else {
        await this.exitMiniMode(win);
      }
    } catch (e) {
      console.error('toggleMiniMode Tauri API error:', e);
      // Fallback for browser dev — just toggle CSS
      document.body.classList.toggle('mini-mode', this.isMiniMode);
    }
  }

  async enterMiniMode(win) {
    const pomoActive = this.pomodoro.status !== 'idle';

    // Apply CSS class IMMEDIATELY (before any await)
    document.body.classList.add('mini-mode');
    document.getElementById('btn-minimize').textContent = '☰';

    // Hide all non-clock elements immediately (before window resize)
    // Pass pomoActive so pomodoro section is kept visible when timer is running
    this._hideNonClockElements(pomoActive);

    // Then shrink window (may fail but hiding already done)
    try {
      const height = pomoActive ? 270 : 100;
      await win.setSize({ type: 'Logical', width: 220, height });
      await win.setMinSize({ type: 'Logical', width: 140, height: 80 });
      await win.setResizable(false);
    } catch (e) {
      console.error('enterMiniMode window resize failed:', e);
    }

    // Show pomodoro in mini mode if running
    if (pomoActive) {
      document.getElementById('pomodoro').classList.add('mini-visible');
    }

    // Listen for pomodoro state changes
    this._pomoHandler = (e) => {
      const pomo = document.getElementById('pomodoro');
      if (e.detail.status !== 'idle') {
        pomo.classList.add('mini-visible');
        this._adjustMiniSize(win, 270);
      } else {
        pomo.classList.remove('mini-visible');
        this._adjustMiniSize(win, 100);
      }
    };
    document.addEventListener('pomodoro-state', this._pomoHandler);
  }

  /**
   * Hide all non-clock/time/date elements using inline styles.
   * Called from enterMiniMode BEFORE any async work.
   */
  _hideNonClockElements(pomoActive) {
    const clock = document.getElementById('main-clock');
    const keepVisible = ['.time', '.date'];
    if (clock) {
      const allDescendants = clock.querySelectorAll('*');
      for (const el of allDescendants) {
        const matches = keepVisible.some(sel => el.matches(sel));
        if (!matches) {
          el._miniPrevDisplay = el.style.display;
          el.style.display = 'none';
          this._miniHidden.push(el);
        }
      }
      // Hide sibling sections of #main-clock inside main
      const mainEl = clock.parentElement;
      if (mainEl) {
        for (const child of mainEl.children) {
          // Keep pomodoro section visible when timer is running
          if (child !== clock) {
            if (pomoActive && child.id === 'pomodoro') continue;
            child._miniPrevDisplay = child.style.display;
            child.style.display = 'none';
            this._miniHidden.push(child);
          }
        }
      }
    }

    // Force hide titlebar children except controls
    const titlebar = document.getElementById('titlebar');
    if (titlebar) {
      for (const child of titlebar.children) {
        if (!child.classList.contains('window-controls') && !child.classList.contains('app-name')) {
          child._miniPrevDisplay = child.style.display;
          child.style.display = 'none';
          this._miniHidden.push(child);
        }
      }
    }
  }

  async exitMiniMode(win) {
    // ── Restore DOM IMMEDIATELY (before any await) ──
    document.body.classList.remove('mini-mode');
    document.getElementById('btn-minimize').textContent = '─';
    document.getElementById('pomodoro').classList.remove('mini-visible');

    // Restore all force-hidden elements
    for (const el of this._miniHidden) {
      el.style.display = el._miniPrevDisplay || '';
    }
    this._miniHidden = [];

    // Remove pomodoro state listener
    if (this._pomoHandler) {
      document.removeEventListener('pomodoro-state', this._pomoHandler);
      this._pomoHandler = null;
    }

    // Then resize window back (may fail but DOM is already restored)
    try {
      await win.setSize({ type: 'Logical', width: 320, height: 590 });
      await win.setMinSize({ type: 'Logical', width: 0, height: 0 });
      await win.setResizable(true);
    } catch (e) {
      console.error('exitMiniMode window resize failed:', e);
    }
  }

  async _adjustMiniSize(win, h) {
    if (!this.isMiniMode) return;
    try {
      await win.setSize({ type: 'Logical', width: 220, height: h });
    } catch { /* ignore */ }
  }

  /* ---- Window Controls ---- */

  setupWindowControls() {
    const btnMin = document.getElementById('btn-minimize');
    const btnPin = document.getElementById('btn-pin');
    const btnSettings = document.getElementById('btn-settings');
    const settingsDropdown = document.querySelector('.settings-dropdown');

    // Toggle mini-mode
    btnMin.addEventListener('click', () => this.toggleMiniMode());

    // Toggle settings dropdown
    btnSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsDropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.settings-wrap')) {
        settingsDropdown.classList.remove('show');
      }
    });

    // Toggle always-on-top (pin)
    btnPin.addEventListener('click', async () => {
      this.isPinned = !this.isPinned;
      btnPin.style.opacity = this.isPinned ? '1' : '0.5';
      // Swap pin SVG: pinned vs unpinned
      btnPin.innerHTML = this.isPinned
        ? `<svg class="icon-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="7" r="2.5" fill="currentColor" stroke="none"/>
            <line x1="12" y1="9.5" x2="12" y2="22"/>
            <polyline points="5,14 12,9.5 19,14"/>
          </svg>`
        : `<svg class="icon-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="7" r="2.5" fill="currentColor" stroke="none"/>
            <line x1="12" y1="9.5" x2="12" y2="22"/>
            <line x1="2" y1="2" x2="22" y2="22"/>
          </svg>`;
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().setAlwaysOnTop(this.isPinned);
      } catch {
        console.log('Pin toggle (Tauri window API not available)');
      }
    });
  }

  setupLangToggle() {
    const btnLang = document.getElementById('btn-lang');
    btnLang.addEventListener('click', () => {
      const next = getLang() === 'zh-CN' ? 'en' : 'zh-CN';
      setLang(next);
      bindI18n();
      this.clock.refresh();
      this.timezones.refresh();
      this.pomodoro.refresh();
    });
  }
}

// Boot
const app = new App();
app.init();

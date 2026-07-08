/**
 * Crit Tomato — App entry point.
 * Initializes i18n, clock (with timezone switching), pomodoro timer, and window controls.
 *
 * Normal mode: full window (320×520) with clock, timezone selector, pomodoro.
 * Mini mode:  compact overlay (220×~80–140) — invisible until hover,
 *              shows clock (+ pomodoro if running).
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
        this.enterMiniMode(win);
      } else {
        this.exitMiniMode(win);
      }
    } catch {
      // Fallback for browser dev — just toggle CSS
      document.body.classList.toggle('mini-mode', this.isMiniMode);
    }
  }

  async enterMiniMode(win) {
    const pomoActive = this.pomodoro.status !== 'idle';

    // Shrink window
    const height = pomoActive ? 140 : 76;
    await win.setSize({ type: 'Logical', width: 220, height });
    await win.setResizable(false);

    document.body.classList.add('mini-mode');
    document.getElementById('btn-minimize').textContent = '☰';

    // Show pomodoro in mini mode if running (will only be visible on hover)
    if (pomoActive) {
      document.getElementById('pomodoro').classList.add('mini-visible');
    }

    // Listen for pomodoro state changes to toggle mini-visible & resize
    this._pomoHandler = (e) => {
      const pomo = document.getElementById('pomodoro');
      if (e.detail.status !== 'idle') {
        pomo.classList.add('mini-visible');
        this._adjustMiniSize(win, 140);
      } else {
        pomo.classList.remove('mini-visible');
        this._adjustMiniSize(win, 76);
      }
    };
    document.addEventListener('pomodoro-state', this._pomoHandler);
  }

  async exitMiniMode(win) {
    await win.setSize({ type: 'Logical', width: 320, height: 520 });
    await win.setResizable(true);

    document.body.classList.remove('mini-mode');
    document.getElementById('btn-minimize').textContent = '─';
    document.getElementById('pomodoro').classList.remove('mini-visible');

    if (this._pomoHandler) {
      document.removeEventListener('pomodoro-state', this._pomoHandler);
      this._pomoHandler = null;
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

    // Toggle mini-mode
    btnMin.addEventListener('click', () => this.toggleMiniMode());

    // Toggle always-on-top (pin)
    btnPin.addEventListener('click', async () => {
      this.isPinned = !this.isPinned;
      btnPin.textContent = this.isPinned ? '📌' : '📍';
      btnPin.style.opacity = this.isPinned ? '1' : '0.5';
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

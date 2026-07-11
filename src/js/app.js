/**
 * Crit Tomato — App entry point.
 * Initializes i18n, clock (with timezone switching), pomodoro timer, and window controls.
 *
 * Normal mode: full window (320×520) with clock, timezone selector, pomodoro.
 * Mini mode:  compact overlay (220×~80–140) — only time+date visible,
 *              controls fade in on hover.
 */
import { bindI18n, getLang, setLang, t } from './i18n.js';
import { Clock } from './clock.js';
import { TimezoneSelector } from './timezone.js';
import { Pomodoro } from './pomodoro.js';
import { isEnabled, enable, disable } from '@tauri-apps/plugin-autostart';

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
    this.setupSettings();
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

    // Close main settings modal if open
    document.getElementById('settings-modal').classList.remove('show');

    // Apply CSS class IMMEDIATELY (before any await)
    document.body.classList.add('mini-mode');
    document.getElementById('btn-minimize').textContent = '☰';

    // Hide all non-clock elements immediately (before window resize)
    // Pass pomoActive so pomodoro section is kept visible when timer is running
    this._hideNonClockElements(pomoActive);

    // Then shrink window (may fail but hiding already done)
    try {
      const height = pomoActive ? 280 : 110;
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
      const breakPopup = document.getElementById('break-popup');
      if (e.detail.status !== 'idle') {
        pomo.classList.add('mini-visible');
        this._adjustMiniSize(win, 280);
      } else {
        pomo.classList.remove('mini-visible');
        // 弹窗显示中不缩小窗口，保持和专注弹窗一样的大小
        if (!breakPopup || !breakPopup.classList.contains('show')) {
          this._adjustMiniSize(win, 110);
        }
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
    // Close mini settings modal if open
    document.getElementById('settings-modal-mini').classList.remove('show');

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
      await win.setSize({ type: 'Logical', width: 320, height: 592 });
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

    // Toggle mini-mode
    btnMin.addEventListener('click', () => this.toggleMiniMode());

    // Toggle always-on-top (pin)
    btnPin.addEventListener('click', async () => {
      this.isPinned = !this.isPinned;
      const pinImg = btnPin.querySelector('.icon-pin');
      if (pinImg) pinImg.classList.toggle('unpinned', !this.isPinned);
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().setAlwaysOnTop(this.isPinned);
      } catch {
        console.log('Pin toggle (Tauri window API not available)');
      }
    });
  }

  setupSettings() {
    const modal = document.getElementById('settings-modal');
    const btnLang = document.getElementById('btn-lang');
    const btnFormat = document.getElementById('btn-format');
    const btnAutostart = document.getElementById('btn-autostart');
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValue = document.getElementById('opacity-value');
    const focusInput = document.getElementById('focus-popup-text');
    const breakInput = document.getElementById('break-popup-text-input');

    // ── Modal open/close — leave panel to close (with delay to bridge gap) ──
    let modalCloseTimer = null;
    const btnGear = document.getElementById('btn-settings');
    btnGear.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isMiniMode) return;
      clearTimeout(modalCloseTimer);
      modal.classList.add('show');
    });
    btnGear.addEventListener('mouseenter', () => {
      if (this.isMiniMode) return;
      clearTimeout(modalCloseTimer);
    });
    btnGear.addEventListener('mouseleave', () => {
      if (this.isMiniMode) return;
      modalCloseTimer = setTimeout(() => {
        modal.classList.remove('show');
      }, 250);
    });
    modal.addEventListener('mouseenter', () => {
      clearTimeout(modalCloseTimer);
    });
    modal.addEventListener('mouseleave', () => {
      modalCloseTimer = setTimeout(() => {
        modal.classList.remove('show');
      }, 250);
    });

    // ── Mini settings modal (click gear to open, leave panel to close) ──
    const modalMini = document.getElementById('settings-modal-mini');
    const clockOpacitySlider = document.getElementById('clock-opacity-slider');
    const clockOpacityValue = document.getElementById('clock-opacity-value');
    let miniCloseTimer = null;

    // Click gear → toggle open/close
    btnGear.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.isMiniMode) return;
      if (modalMini.classList.contains('show')) {
        modalMini.classList.remove('show');
      } else {
        modalMini.classList.add('show');
      }
    });
    // Enter panel → stay open
    modalMini.addEventListener('mouseenter', () => {
      clearTimeout(miniCloseTimer);
    });
    // Leave panel → close
    modalMini.addEventListener('mouseleave', () => {
      miniCloseTimer = setTimeout(() => {
        modalMini.classList.remove('show');
      }, 250);
    });

    // ── Clock font opacity (mini mode) — 0=fully opaque, 100=fully transparent ──
    const clampAndApply = (v) => {
      let pct = parseInt(v, 10);
      if (isNaN(pct) || pct < 0) pct = 0;
      if (pct > 90) pct = 90;
      document.documentElement.style.setProperty('--mini-clock-opacity', String((100 - pct) / 100));
      clockOpacitySlider.value = pct;
      clockOpacityValue.value = pct;
      localStorage.setItem('crit-tomato-clock-opacity', String(pct));
    };
    const savedClockOpacity = localStorage.getItem('crit-tomato-clock-opacity') || '20';
    clockOpacitySlider.value = savedClockOpacity;
    clockOpacityValue.value = savedClockOpacity;
    clampAndApply(savedClockOpacity);
    // Slider → sync in real-time
    clockOpacitySlider.addEventListener('input', () => {
      const v = clockOpacitySlider.value;
      clockOpacityValue.value = v;
      clampAndApply(v);
    });
    // Number input → allow free typing, apply on blur/enter
    clockOpacityValue.addEventListener('change', () => {
      clampAndApply(clockOpacityValue.value);
    });
    clockOpacityValue.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clockOpacityValue.blur();
      }
    });
    // Block window drag on slider interaction
    clockOpacitySlider.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    // ── Language toggle ──
    const updateLangBtn = () => {
      btnLang.textContent = getLang() === 'zh-CN' ? '中文' : 'English';
    };
    updateLangBtn();
    btnLang.addEventListener('click', () => {
      const next = getLang() === 'zh-CN' ? 'en' : 'zh-CN';
      setLang(next);
      bindI18n();
      updateLangBtn();
      this.clock.refresh();
      this.timezones.refresh();
      this.pomodoro.refresh();
      // Refresh settings modal i18n bindings
      bindI18n(modal);
      bindI18n(modalMini);
    });

    // ── 24h format toggle (syncs with clock.js) ──
    // Clock.js already handles the click on btn-format, so the toggle works.
    // We just ensure the button text stays in sync via clock.refresh().

    // ── Auto-start toggle ──
    const updateAutostartBtn = (enabled) => {
      btnAutostart.textContent = enabled ? t('settings.on') : t('settings.off');
      btnAutostart.classList.toggle('on', enabled);
    };
    // Init — check current autostart state
    (async () => {
      try {
        const enabled = await isEnabled();
        updateAutostartBtn(enabled);
      } catch (e) {
        console.warn('Autostart init failed:', e);
      }
    })();
    btnAutostart.addEventListener('click', async () => {
      try {
        const enabled = await isEnabled();
        if (enabled) {
          await disable();
          updateAutostartBtn(false);
        } else {
          await enable();
          updateAutostartBtn(true);
        }
      } catch (e) {
        console.error('Autostart toggle failed:', e);
      }
    });

    // ── Opacity slider — 0=fully opaque, 100=fully transparent ──
    const clampAndApplyOpacity = (v) => {
      let pct = parseInt(v, 10);
      if (isNaN(pct) || pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      const opacity = (100 - pct) / 100;
      document.documentElement.style.setProperty('--bg-primary', `rgba(18, 18, 20, ${opacity})`);
      document.documentElement.style.setProperty('--bg-surface', `rgba(28, 28, 32, ${opacity * 0.76})`);
      opacitySlider.value = pct;
      opacityValue.value = pct;
      localStorage.setItem('crit-tomato-opacity', String(pct));
    };
    const savedOpacity = localStorage.getItem('crit-tomato-opacity') || '50';
    opacitySlider.value = savedOpacity;
    opacityValue.value = savedOpacity;
    clampAndApplyOpacity(savedOpacity);
    // Slider → sync in real-time
    opacitySlider.addEventListener('input', () => {
      const v = opacitySlider.value;
      opacityValue.value = v;
      clampAndApplyOpacity(v);
    });
    // Number input → free typing, apply on blur/enter
    opacityValue.addEventListener('change', () => {
      clampAndApplyOpacity(opacityValue.value);
    });
    opacityValue.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        opacityValue.blur();
      }
    });

    // ── Custom popup text ──
    const savedFocus = localStorage.getItem('crit-tomato-focus-text') || '';
    const savedBreak = localStorage.getItem('crit-tomato-break-text') || '';
    focusInput.value = savedFocus;
    breakInput.value = savedBreak;
    focusInput.addEventListener('input', () => {
      localStorage.setItem('crit-tomato-focus-text', focusInput.value.trim());
    });
    breakInput.addEventListener('input', () => {
      localStorage.setItem('crit-tomato-break-text', breakInput.value.trim());
    });
  }
}

// Boot
const app = new App();
app.init();

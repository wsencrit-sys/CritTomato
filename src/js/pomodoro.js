/**
 * Pomodoro timer — state machine with SVG ring progress.
 *
 * States: idle → running → paused → (complete) → break → idle
 *
 * Uses Web Audio API for beep sound + Tauri notification plugin when available.
 */

import { t } from './i18n.js';

const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // ≈ 326.73

export class Pomodoro {
  constructor() {
    // State
    this.status = 'idle';  // idle | running | paused | break
    this.workMinutes = 25;
    this.breakMinutes = 5;
    this.remainingSeconds = 25 * 60;
    this.totalSeconds = 25 * 60;
    this.tomatoCount = 0;
    this.timer = null;

    // DOM refs
    this.elDisplay = document.getElementById('pomo-display');
    this.elCircle = document.getElementById('pomo-circle');
    this.elLabel = document.getElementById('pomo-label');
    this.elStartBtn = document.getElementById('btn-pomo-start');
    this.elResetBtn = document.getElementById('btn-pomo-reset');
    this.elWorkInput = document.getElementById('work-minutes');
    this.elBreakInput = document.getElementById('break-minutes');
    this.elCount = document.getElementById('tomato-count');

    // Audio context (lazy)
    this.audioCtx = null;
  }

  start() {
    this.updateRing();
    this.updateDisplay();

    this.elStartBtn.addEventListener('click', () => this.toggle());
    this.elResetBtn.addEventListener('click', () => this.reset());
    this.elWorkInput.addEventListener('change', () => this.onSettingsChange());
    this.elBreakInput.addEventListener('change', () => this.onSettingsChange());
  }

  /* ---- Helpers ---- */

  /** Dispatch a custom event so App can react (e.g. mini-mode visibility). */
  _notifyState() {
    document.dispatchEvent(new CustomEvent('pomodoro-state', {
      detail: { status: this.status }
    }));
  }

  /* ---- State machine ---- */

  toggle() {
    switch (this.status) {
      case 'idle':
        this.startTimer();
        break;
      case 'running':
        this.pause();
        break;
      case 'paused':
        this.resume();
        break;
      case 'break':
        // Don't toggle break — must reset first
        break;
    }
  }

  startTimer() {
    this.status = this.status === 'break' ? 'break' : 'running';
    this.totalSeconds = this.remainingSeconds;

    this.elStartBtn.textContent = t('pomo.pause');
    this.elStartBtn.classList.add('pause');
    this.elLabel.textContent = this.status === 'break' ? t('pomo.break') : t('pomo.focus');
    this.elLabel.classList.add('running');
    if (this.status === 'break') {
      this.elLabel.classList.add('break-label');
      this.elCircle.classList.add('break');
    }

    this.elWorkInput.disabled = true;
    this.elBreakInput.disabled = true;

    this.timer = setInterval(() => this.tick(), 1000);
    this._notifyState();
  }

  pause() {
    this.status = 'paused';
    clearInterval(this.timer);
    this.timer = null;

    this.elStartBtn.textContent = t('pomo.resume');
    this.elStartBtn.classList.remove('pause');
    this.elLabel.textContent = t('pomo.paused');
    this.elLabel.classList.remove('running');
    this._notifyState();
  }

  resume() {
    this.status = 'running';
    this.timer = setInterval(() => this.tick(), 1000);

    this.elStartBtn.textContent = t('pomo.pause');
    this.elStartBtn.classList.add('pause');
    const isBreak = this.elLabel.classList.contains('break-label');
    this.elLabel.textContent = isBreak ? t('pomo.break') : t('pomo.focus');
    this.elLabel.classList.add('running');
    this._notifyState();
  }

  reset() {
    clearInterval(this.timer);
    this.timer = null;
    this.status = 'idle';

    this.workMinutes = Math.max(1, Math.min(120, parseInt(this.elWorkInput.value, 10) || 25));
    this.breakMinutes = Math.max(1, Math.min(60, parseInt(this.elBreakInput.value, 10) || 5));
    this.remainingSeconds = this.workMinutes * 60;
    this.totalSeconds = this.remainingSeconds;

    this.elStartBtn.textContent = t('pomo.start');
    this.elStartBtn.classList.remove('pause');
    this.elLabel.textContent = t('pomo.ready');
    this.elLabel.classList.remove('running', 'break-label');
    this.elCircle.classList.remove('break');
    this.elWorkInput.disabled = false;
    this.elBreakInput.disabled = false;

    this.updateDisplay();
    this.updateRing();
    this._notifyState();
  }

  onSettingsChange() {
    if (this.status === 'idle') {
      this.reset();
    }
  }

  /* ---- Tick ---- */

  tick() {
    if (this.remainingSeconds <= 0) {
      this.complete();
      return;
    }

    this.remainingSeconds--;
    this.updateDisplay();
    this.updateRing();
  }

  complete() {
    clearInterval(this.timer);
    this.timer = null;

    if (this.status === 'break') {
      // Break finished → idle
      this.status = 'idle';
      this.remainingSeconds = this.workMinutes * 60;
      this.totalSeconds = this.remainingSeconds;

      this.elStartBtn.textContent = t('pomo.start');
      this.elStartBtn.classList.remove('pause');
      this.elLabel.textContent = t('pomo.ready');
      this.elLabel.classList.remove('running', 'break-label');
      this.elCircle.classList.remove('break');
      this.elWorkInput.disabled = false;
      this.elBreakInput.disabled = false;

      this.beep(800, 0.15);
      this.notify(t('pomo.notify.break_title'), t('pomo.notify.break_body'));
      this._notifyState();
    } else {
      // Work session finished
      this.tomatoCount++;
      this.elCount.textContent = this.tomatoCount;

      this.status = 'break';
      this.remainingSeconds = this.breakMinutes * 60;
      this.totalSeconds = this.remainingSeconds;

      this.elCircle.classList.add('break');
      this.elLabel.textContent = t('pomo.break');
      this.elLabel.classList.add('running', 'break-label');
      this.elStartBtn.textContent = t('pomo.pause');

      this.beep(600, 0.1);
      setTimeout(() => this.beep(900, 0.2), 200);
      this.notify(
        t('pomo.notify.done_title'),
        t('pomo.notify.done_body', { count: this.tomatoCount, plural: this.tomatoCount > 1 ? 'es' : '' })
      );
      this._notifyState();
    }

    this.updateDisplay();
    this.updateRing();
  }

  /* ---- Display ---- */

  updateDisplay() {
    const m = Math.floor(this.remainingSeconds / 60);
    const s = this.remainingSeconds % 60;
    this.elDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  updateRing() {
    const fraction = this.totalSeconds > 0
      ? (this.totalSeconds - this.remainingSeconds) / this.totalSeconds
      : 0;
    const offset = RING_CIRCUMFERENCE * (1 - fraction);
    this.elCircle.style.strokeDasharray = String(RING_CIRCUMFERENCE);
    this.elCircle.style.strokeDashoffset = String(offset);
  }

  /* ---- Audio ---- */

  beep(freq = 800, duration = 0.15) {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch {
      // Audio not available — silently ignore
    }
  }

  /* ---- Notification ---- */

  async notify(title, body) {
    try {
      const mod = await import('@tauri-apps/plugin-notification');
      const granted = await mod.isPermissionGranted();
      if (!granted) {
        const permission = await mod.requestPermission();
        if (!permission) return;
      }
      mod.sendNotification({ title, body });
    } catch {
      // Tauri plugin not available (e.g. running in browser) — ignore
    }
  }

  /** Update all dynamic i18n text without resetting state. */
  refresh() {
    switch (this.status) {
      case 'idle':
        this.elStartBtn.textContent = t('pomo.start');
        this.elLabel.textContent = t('pomo.ready');
        break;
      case 'running':
        this.elStartBtn.textContent = t('pomo.pause');
        this.elLabel.textContent = this.elLabel.classList.contains('break-label')
          ? t('pomo.break') : t('pomo.focus');
        break;
      case 'paused':
        this.elStartBtn.textContent = t('pomo.resume');
        this.elLabel.textContent = t('pomo.paused');
        break;
      case 'break':
        this.elStartBtn.textContent = t('pomo.pause');
        this.elLabel.textContent = t('pomo.break');
        break;
    }
    // Also update the settings labels via the DOM binding
    const el = document.getElementById('pomo-label');
    if (el) {
      document.querySelectorAll('[data-i18n]').forEach(el2 => {
        const key = el2.getAttribute('data-i18n');
        if (key && key.startsWith('pomo.')) el2.textContent = t(key);
      });
    }
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
  }
}

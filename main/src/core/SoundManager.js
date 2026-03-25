// ═══════════════════════════════════════════════════
// NexusOS — Sound Manager (Web Audio API)
// ═══════════════════════════════════════════════════
import { storage } from './StorageManager.js';

class SoundManager {
  constructor() {
    this.ctx = null;
    this._vol = storage.get('volume') / 100;
  }

  _getCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this.ctx;
  }

  set volume(v) { this._vol = v / 100; storage.set('volume', v); }
  get volume() { return this._vol * 100; }

  _tone(freq, dur, type = 'sine', ramp = null) {
    if (this._vol === 0) return;
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (ramp) osc.frequency.linearRampToValueAtTime(ramp, ctx.currentTime + dur);
    gain.gain.setValueAtTime(this._vol * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  }

  _noise(dur) {
    if (this._vol === 0) return;
    const ctx = this._getCtx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 800;
    src.buffer = buf;
    gain.gain.setValueAtTime(this._vol * 0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(); src.stop(ctx.currentTime + dur);
  }

  windowOpen() { this._tone(220, 0.2, 'sine', 440); }
  windowClose() { this._tone(440, 0.15, 'sine', 220); }
  dockClick() { this._noise(0.05); }
  notification() {
    this._tone(523, 0.08); // C5
    setTimeout(() => this._tone(659, 0.08), 100); // E5
  }
  error() { this._tone(80, 0.1, 'sawtooth'); }
  loginSuccess() {
    this._tone(440, 0.1);
    setTimeout(() => this._tone(554, 0.1), 120);
    setTimeout(() => this._tone(659, 0.1), 240);
  }
  trashEmpty() { this._noise(0.3); }
}

export const sound = new SoundManager();

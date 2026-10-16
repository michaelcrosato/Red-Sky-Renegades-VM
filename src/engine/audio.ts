import type { Settings } from "./save";
/** Original synthesized score and foley: no external audio assets. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private noise!: AudioBuffer;
  private wind!: GainNode;
  private nextNote = 0;
  private note = 0;
  private settings: Settings;
  constructor(settings: Settings) {
    this.settings = settings;
  }
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.settings.volume;
      this.master.connect(c.destination);
      this.music = c.createGain();
      this.music.gain.value = this.settings.music;
      this.music.connect(this.master);
      this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const source = c.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 450;
      this.wind = c.createGain();
      this.wind.gain.value = 0.025;
      source.connect(filter);
      filter.connect(this.wind);
      this.wind.connect(this.master);
      source.start();
    } catch {
      this.ctx = null;
    }
  }
  configure(settings: Settings) {
    this.settings = settings;
    if (this.ctx) {
      this.master.gain.setTargetAtTime(
        settings.volume,
        this.ctx.currentTime,
        0.1,
      );
      this.music.gain.setTargetAtTime(
        settings.music,
        this.ctx.currentTime,
        0.1,
      );
    }
  }
  private tone(
    f: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    dest?: AudioNode,
  ) {
    if (!this.ctx) return;
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(volume, c.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g);
    g.connect(dest ?? this.master);
    o.start();
    o.stop(c.currentTime + duration + 0.02);
  }
  private hiss(duration: number, volume: number, f = 1800, pan = 0) {
    if (!this.ctx) return;
    const c = this.ctx,
      s = c.createBufferSource(),
      g = c.createGain(),
      filter = c.createBiquadFilter(),
      p = c.createStereoPanner();
    s.buffer = this.noise;
    filter.type = "lowpass";
    filter.frequency.value = f;
    g.gain.setValueAtTime(volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    p.pan.value = Math.max(-1, Math.min(1, pan));
    s.connect(filter);
    filter.connect(g);
    g.connect(p);
    p.connect(this.master);
    s.start();
    s.stop(c.currentTime + duration);
  }
  play(name: string, pan = 0) {
    if (!this.ctx || this.ctx.state !== "running") return;
    switch (name) {
      case "shot":
        this.hiss(0.27, 0.62, 2800, pan);
        this.tone(75, 0.18, 0.25, "triangle");
        break;
      case "enemyShot":
        this.hiss(0.2, 0.22, 1900, pan);
        this.tone(95, 0.12, 0.1, "triangle");
        break;
      case "hoof":
        this.hiss(0.055, 0.09, 750);
        this.tone(140, 0.045, 0.075, "triangle");
        break;
      case "step":
        this.hiss(0.065, 0.055, 900);
        break;
      case "reload":
        this.hiss(0.16, 0.11, 5000);
        this.tone(410, 0.08, 0.04, "square");
        break;
      case "empty":
      case "click":
        this.tone(220, 0.05, 0.035, "square");
        break;
      case "hit":
        this.hiss(0.09, 0.13, 1200);
        this.tone(70, 0.08, 0.12, "triangle");
        break;
      case "damage":
        this.tone(55, 0.2, 0.2, "sawtooth");
        break;
      case "whistle":
        this.tone(1200, 0.5, 0.08);
        setTimeout(() => this.tone(950, 0.4, 0.06), 240);
        break;
      case "pickup":
      case "tonic":
        this.tone(392, 0.2, 0.1, "triangle");
        setTimeout(() => this.tone(587, 0.4, 0.07, "triangle"), 100);
        break;
      case "mount":
        this.hiss(0.16, 0.08, 600);
        break;
      case "complete":
        [196, 261.63, 329.63, 392].forEach((f, i) =>
          setTimeout(() => this.tone(f, 1.6, 0.1, "triangle"), i * 180),
        );
        break;
    }
  }
  update(combat: boolean, rain: boolean) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const c = this.ctx;
    this.wind.gain.setTargetAtTime(rain ? 0.075 : 0.025, c.currentTime, 1);
    if (c.currentTime < this.nextNote) return;
    this.nextNote = c.currentTime + (combat ? 0.42 : 1.25);
    const melody = [
      146.83, 220, 261.63, 293.66, 220, 196, 174.61, 146.83, 0, 110, 146.83,
      196, 174.61, 0, 130.81, 146.83,
    ];
    const f = melody[this.note++ % melody.length];
    if (f) {
      this.tone(f, 1.7, 0.13, "triangle", this.music);
      this.tone(f * 2, 0.6, 0.035, "sine", this.music);
    }
    if (this.note % 4 === 0) this.tone(73.42, 3, 0.13, "sine", this.music);
  }
}

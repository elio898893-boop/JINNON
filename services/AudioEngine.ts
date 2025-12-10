// Singleton Audio Engine
class AudioEngine {
  private ctx: AudioContext | null = null;
  private tinnitusOsc: OscillatorNode | null = null;
  private tinnitusGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  
  // Buffers
  private birdBuffer: AudioBuffer | null = null;
  private windBuffer: AudioBuffer | null = null;
  private leavesBuffer: AudioBuffer | null = null;
  private waterBuffer: AudioBuffer | null = null;
  private rainBuffer: AudioBuffer | null = null;
  private insectBuffer: AudioBuffer | null = null;
  
  // Background Ambient State
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private droneNodes: AudioNode[] = []; // Track synth nodes

  // Piano State
  private pianoTimeout: number | null = null;
  private pianoNodes: Set<AudioNode> = new Set();

  // Dynamic Mixing State
  private activeSounds: Set<string> = new Set();
  private rainGainNode: GainNode | null = null;

  constructor() {
    // Lazy init
  }

  public init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.5;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Load the asset files
  public async loadAmbientTrack(): Promise<void> {
    this.init();
    if (!this.ctx) return;

    // Enhanced loader with logging
    const loadBuffer = async (filename: string): Promise<AudioBuffer | null> => {
        const pathsToTry = [`./${filename}`, `/${filename}`, filename];
        
        for (const path of pathsToTry) {
            try {
                const res = await fetch(path);
                if (res.ok) {
                    const arr = await res.arrayBuffer();
                    const decoded = await this.ctx!.decodeAudioData(arr);
                    console.log(`[AudioEngine] Loaded ${filename} successfully.`);
                    return decoded;
                }
            } catch (e) {
                // Ignore and try next path
            }
        }
        console.warn(`[AudioEngine] Failed to load ${filename}. Will use synth fallback.`);
        return null;
    };

    console.log("[AudioEngine] Starting asset loading...");

    // Corrected Mapping: specific files for specific buffers
    // Please ensure these files exist in your public folder
    this.birdBuffer = await loadBuffer('bird.mp3'); 
    this.windBuffer = await loadBuffer('wind.mp3');
    this.leavesBuffer = await loadBuffer('leaves.mp3'); 
    this.waterBuffer = await loadBuffer('water.mp3');
    this.rainBuffer = await loadBuffer('rain.mp3');
    this.insectBuffer = await loadBuffer('insect.mp3');
    
    console.log("[AudioEngine] Asset loading routine complete.");
  }

  // Phase 1: Tinnitus Matching
  public startTinnitusTone(frequency: number, vol: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    if (this.tinnitusOsc) {
      this.stopTinnitusTone();
    }

    this.tinnitusOsc = this.ctx.createOscillator();
    this.tinnitusGain = this.ctx.createGain();

    this.tinnitusOsc.type = 'sine';
    this.tinnitusOsc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    
    this.tinnitusGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.tinnitusGain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.1);

    this.tinnitusOsc.connect(this.tinnitusGain);
    this.tinnitusGain.connect(this.masterGain);
    this.tinnitusOsc.start();
  }

  public updateTinnitusFreq(frequency: number) {
    if (this.tinnitusOsc && this.ctx) {
      this.tinnitusOsc.frequency.setTargetAtTime(frequency, this.ctx.currentTime, 0.1);
    }
  }

  public stopTinnitusTone() {
    if (this.tinnitusGain && this.ctx) {
      this.tinnitusGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
    }
    if (this.tinnitusOsc) {
      this.tinnitusOsc.stop(this.ctx!.currentTime + 0.6);
      this.tinnitusOsc = null;
    }
  }

  // Phase 2: Start Background Atmosphere
  public startAmbientTrack(tinnitusFreq: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    // Stop existing if any
    if (this.ambientSource) {
      try { this.ambientSource.stop(); } catch(e){}
      this.ambientSource = null;
    }
    console.log("Garden atmosphere started.");
    
    // Note: Background drone is handled manually by toggleDrone logic now
  }

  // --- HARMONY: DRONE ---
  public toggleDrone(shouldPlay: boolean) {
      if (shouldPlay) this.startDrone();
      else this.stopDrone();
  }

  private startDrone() {
      if (this.droneNodes.length > 0) return;
      
      this.init();
      if (!this.ctx || !this.masterGain) return;

      const t = this.ctx.currentTime;
      const root = 98.00; // G2 (Deep, warm)
      
      const nodes: AudioNode[] = [];
      
      // Master Gain for Drone
      const droneMaster = this.ctx.createGain();
      droneMaster.gain.value = 0; // Start silent
      droneMaster.connect(this.masterGain);
      nodes.push(droneMaster);

      // --- LAYER 1: Main Body ---
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = root;
      
      const filter1 = this.ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.frequency.value = 350; // Muffled
      filter1.Q.value = 1;

      osc1.connect(filter1);
      filter1.connect(droneMaster);
      nodes.push(osc1, filter1);

      // --- LAYER 2: Detuned Texture ---
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = root;
      osc2.detune.value = 10; 
      
      const filter2 = this.ctx.createBiquadFilter();
      filter2.type = 'lowpass';
      filter2.frequency.value = 400;
      
      osc2.connect(filter2);
      filter2.connect(droneMaster);
      nodes.push(osc2, filter2);

      // --- LAYER 3: Sub Foundation ---
      const osc3 = this.ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.value = root / 2; // G1
      
      const subGain = this.ctx.createGain();
      subGain.gain.value = 0.4;
      
      osc3.connect(subGain);
      subGain.connect(droneMaster);
      nodes.push(osc3, subGain);

      // --- LFO ---
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.1; // 10s cycle
      
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 100; 

      lfo.connect(lfoGain);
      lfoGain.connect(filter1.frequency);
      lfoGain.connect(filter2.frequency);
      nodes.push(lfo, lfoGain);

      // Start
      osc1.start(t);
      osc2.start(t);
      osc3.start(t);
      lfo.start(t);

      // Fade In
      droneMaster.gain.linearRampToValueAtTime(0.06, t + 4.0); 

      this.droneNodes = nodes;
  }

  private stopDrone() {
      if (this.droneNodes.length > 0 && this.ctx) {
          const master = this.droneNodes[0] as GainNode;
          try {
             master.gain.cancelScheduledValues(this.ctx.currentTime);
             master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
             
             const nodesToStop = this.droneNodes; 
             setTimeout(() => {
                 nodesToStop.forEach(n => {
                     try { (n as any).stop?.(); } catch(e){}
                     n.disconnect();
                 });
             }, 1600);
          } catch(e) {
              console.warn("Error stopping drone", e);
          }
          this.droneNodes = [];
      }
  }

  // --- HARMONY: PIANO (Generative) ---
  public togglePiano(shouldPlay: boolean) {
      if (shouldPlay) this.startPiano();
      else this.stopPiano();
  }

  private startPiano() {
      if (this.pianoTimeout) return;
      this.init();
      this.playNextPianoNote();
  }

  private stopPiano() {
      if (this.pianoTimeout) {
          window.clearTimeout(this.pianoTimeout);
          this.pianoTimeout = null;
      }
  }

  private playNextPianoNote() {
      if (!this.ctx || !this.masterGain) return;
      
      // G Minor Pentatonic
      const scale = [196.00, 233.08, 261.63, 293.66, 349.23, 392.00, 466.16];
      const freq = scale[Math.floor(Math.random() * scale.length)];
      const velocity = 0.03 + Math.random() * 0.03; 

      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600 + Math.random() * 200; 
      filter.Q.value = 0.5;

      const gain = this.ctx.createGain();
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(velocity, t + 0.1); 
      gain.gain.exponentialRampToValueAtTime(0.001, t + 4.0); 

      osc.start(t);
      osc.stop(t + 4.5);
      
      const nodeRef = osc;
      nodeRef.onended = () => {
          nodeRef.disconnect();
          filter.disconnect();
          gain.disconnect();
      };

      const nextTime = 2000 + Math.random() * 3000;
      this.pianoTimeout = window.setTimeout(() => this.playNextPianoNote(), nextTime);
  }


  private createNoiseBuffer(): AudioBuffer {
      if (!this.ctx) throw new Error("No Context");
      const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      return buffer;
  }

  private updateRainDynamics() {
      if (!this.rainGainNode || !this.ctx) return;
      const now = this.ctx.currentTime;
      const othersPlaying = Array.from(this.activeSounds).some(t => t !== 'RAIN');
      const targetVol = othersPlaying ? 0.05 : 0.15;
      this.rainGainNode.gain.cancelScheduledValues(now);
      this.rainGainNode.gain.setTargetAtTime(targetVol, now, 0.5); 
  }

  // Phase 3: Interactions
  public playInteractionSound(type: 'BIRD' | 'WIND' | 'LEAVES' | 'WATER' | 'RAIN' | 'INSECT', tinnitusFreq: number, onEnded?: () => void): () => void {
    this.init();
    if (!this.ctx || !this.masterGain) return () => {};
    const t = this.ctx.currentTime;
    
    this.activeSounds.add(type);
    this.updateRainDynamics();

    let stopFn = () => {};
    let internalStop = () => {};

    const createSource = (buffer: AudioBuffer | null, loop: boolean = false) => {
        if (!this.ctx) return null;
        if (buffer) {
            const src = this.ctx.createBufferSource();
            src.buffer = buffer;
            src.loop = loop;
            return src;
        }
        return null;
    };

    const fadeInOut = (gainNode: GainNode, duration: number = 0, loop: boolean = false, fadeTime: number = 0.5, targetVol: number = 0.6) => {
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(targetVol, t + fadeTime);
        if (!loop && duration > 0) {
            gainNode.gain.setValueAtTime(targetVol, t + duration - fadeTime);
            gainNode.gain.linearRampToValueAtTime(0, t + duration);
        }
    };

    // Calculate pitch shifting based on tinnitus frequency match
    const calculatePitch = (baseFreq: number, aggressive: boolean = true) => {
        const ratio = tinnitusFreq / baseFreq;
        if (aggressive) {
            return Math.max(0.5, Math.min(2.5, ratio));
        } else {
            return Math.max(0.6, Math.min(1.8, Math.sqrt(ratio)));
        }
    };

    // --- INTERACTION LOGIC ---

    if (type === 'BIRD') {
        const src = createSource(this.birdBuffer);
        const rate = calculatePitch(8000, true); 
        
        if (src) {
             const gain = this.ctx.createGain();
             src.playbackRate.value = rate;
             src.connect(gain);
             gain.connect(this.masterGain);
             // Slightly louder for samples
             fadeInOut(gain, src.buffer!.duration / rate, false, 0.2, 0.7); 
             src.start(t);
             src.onended = () => {
                 this.activeSounds.delete(type);
                 this.updateRainDynamics();
                 if(onEnded) onEnded();
             };
             internalStop = () => { try { src.stop(this.ctx!.currentTime + 0.5); gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 0.5); } catch(e){} };
        } else {
             // Fallback: FM Synthesis for more realistic chirp
             const carrier = this.ctx.createOscillator();
             const modulator = this.ctx.createOscillator();
             const modGain = this.ctx.createGain();
             const mainGain = this.ctx.createGain();

             carrier.type = 'sine';
             carrier.frequency.setValueAtTime(2000, t);
             carrier.frequency.exponentialRampToValueAtTime(1200, t + 0.15);

             modulator.type = 'sine';
             modulator.frequency.value = 40;
             modGain.gain.value = 500;

             modulator.connect(modGain);
             modGain.connect(carrier.frequency);
             
             carrier.connect(mainGain);
             mainGain.connect(this.masterGain);

             mainGain.gain.setValueAtTime(0, t);
             mainGain.gain.linearRampToValueAtTime(0.1, t + 0.05);
             mainGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

             carrier.start(t);
             modulator.start(t);
             carrier.stop(t + 0.5);
             modulator.stop(t + 0.5);

             setTimeout(() => {
                 this.activeSounds.delete(type);
                 this.updateRainDynamics();
                 if(onEnded) onEnded();
             }, 500);
        }
    } 
    else if (type === 'LEAVES') {
        const src = createSource(this.leavesBuffer, true);
        const gain = this.ctx.createGain();
        const rate = calculatePitch(8000, false);
        
        if (src) {
             src.playbackRate.value = rate * (0.9 + Math.random() * 0.2); 
             src.connect(gain);
             src.start(t);
             gain.connect(this.masterGain);
             fadeInOut(gain, 0, true, 0.3, 0.6);
             internalStop = () => {
                const now = this.ctx!.currentTime;
                gain.gain.cancelScheduledValues(now);
                gain.gain.linearRampToValueAtTime(0, now + 0.6);
                if (src) src.stop(now + 0.7);
            };
        } else {
             // Fallback: Filtered Pink Noise
             const buffer = this.createNoiseBuffer();
             const noiseSrc = this.ctx.createBufferSource();
             noiseSrc.buffer = buffer;
             noiseSrc.loop = true;
             
             const filter = this.ctx.createBiquadFilter();
             filter.type = 'highpass';
             filter.frequency.value = 1200; 
             filter.Q.value = 1.0;

             // Dynamic LFO for rustling
             const lfo = this.ctx.createOscillator();
             lfo.frequency.value = 1.5;
             const lfoGain = this.ctx.createGain();
             lfoGain.gain.value = 300;
             lfo.connect(lfoGain);
             lfoGain.connect(filter.frequency);

             noiseSrc.connect(filter);
             filter.connect(gain);
             gain.connect(this.masterGain);
             
             noiseSrc.start(t);
             lfo.start(t);

             fadeInOut(gain, 0, true, 0.5, 0.15); // Quiet

             internalStop = () => { 
                 const now = this.ctx!.currentTime;
                 gain.gain.linearRampToValueAtTime(0, now + 0.5);
                 noiseSrc.stop(now + 0.6); 
                 lfo.stop(now + 0.6);
             }; 
        }
    }
    else if (type === 'WIND') {
        const src = createSource(this.windBuffer, true);
        const gain = this.ctx.createGain();
        const rate = calculatePitch(8000, false); 
        
        if (src) {
             src.playbackRate.value = rate;
             src.connect(gain);
             src.start(t);
             gain.connect(this.masterGain);
             fadeInOut(gain, 0, true, 1.0, 0.8);
             internalStop = () => {
                const now = this.ctx!.currentTime;
                gain.gain.cancelScheduledValues(now);
                gain.gain.linearRampToValueAtTime(0, now + 1.5);
                if (src) src.stop(now + 1.6);
            };
        } else {
             // Fallback: Lowpass noise with slow LFO
             const buffer = this.createNoiseBuffer();
             const noiseSrc = this.ctx.createBufferSource();
             noiseSrc.buffer = buffer;
             noiseSrc.loop = true;
             const filter = this.ctx.createBiquadFilter();
             filter.type = 'lowpass';
             filter.frequency.value = 300;
             filter.Q.value = 0.5;

             noiseSrc.connect(filter);
             filter.connect(gain);
             gain.connect(this.masterGain);
             noiseSrc.start(t);
             
             fadeInOut(gain, 0, true, 2.0, 0.25);
             internalStop = () => { 
                 const now = this.ctx!.currentTime;
                 gain.gain.linearRampToValueAtTime(0, now + 2.0);
                 noiseSrc.stop(now + 2.1); 
             };
        }
    }
    else if (type === 'WATER') {
        const src = createSource(this.waterBuffer, true);
        const gain = this.ctx.createGain();
        const rate = calculatePitch(8000, false);

        if (src) {
            src.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
            src.connect(gain);
            src.start(t);
            gain.connect(this.masterGain);
            fadeInOut(gain, 0, true, 1.5, 0.7); 
            internalStop = () => {
                const now = this.ctx!.currentTime;
                gain.gain.cancelScheduledValues(now);
                gain.gain.linearRampToValueAtTime(0, now + 1.5);
                if (src) src.stop(now + 1.6);
            };
        } else {
             // Fallback: Brown noise approx
             const buffer = this.createNoiseBuffer();
             const noiseSrc = this.ctx.createBufferSource();
             noiseSrc.buffer = buffer;
             noiseSrc.loop = true;
             
             const filter = this.ctx.createBiquadFilter();
             filter.type = 'lowpass';
             filter.frequency.value = 150; 
             
             noiseSrc.connect(filter);
             filter.connect(gain);
             gain.connect(this.masterGain);
             noiseSrc.start(t);
             
             fadeInOut(gain, 0, true, 2.0, 0.3);
             internalStop = () => { 
                 const now = this.ctx!.currentTime;
                 gain.gain.linearRampToValueAtTime(0, now + 2.0);
                 noiseSrc.stop(now + 2.1); 
             };
        }
    }
    else if (type === 'RAIN') {
        const src = createSource(this.rainBuffer, true);
        const gain = this.ctx.createGain();
        const rate = calculatePitch(8000, false);
        this.rainGainNode = gain;

        if (src) {
            src.playbackRate.value = rate;
            src.connect(gain);
            src.start(t);
            gain.connect(this.masterGain);
            
            const othersPlaying = Array.from(this.activeSounds).some(t => t !== 'RAIN');
            const startVol = othersPlaying ? 0.05 : 0.15;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(startVol, t + 0.8);

            internalStop = () => {
                const now = this.ctx!.currentTime;
                this.rainGainNode = null; 
                gain.gain.cancelScheduledValues(now);
                gain.gain.linearRampToValueAtTime(0, now + 0.8);
                if (src) src.stop(now + 0.9);
            };
        } else {
             // Fallback: Highpass noise
             const buffer = this.createNoiseBuffer();
             const noiseSrc = this.ctx.createBufferSource();
             noiseSrc.buffer = buffer;
             noiseSrc.loop = true;
             const filter = this.ctx.createBiquadFilter();
             filter.type = 'highpass';
             filter.frequency.value = 800; 
             
             noiseSrc.connect(filter);
             filter.connect(gain);
             gain.connect(this.masterGain);
             noiseSrc.start(t);
             
             // Volume logic same as sampled
             const othersPlaying = Array.from(this.activeSounds).some(t => t !== 'RAIN');
             const startVol = othersPlaying ? 0.03 : 0.08;
             gain.gain.setValueAtTime(0, t);
             gain.gain.linearRampToValueAtTime(startVol, t + 1.0);

             internalStop = () => { 
                 const now = this.ctx!.currentTime;
                 this.rainGainNode = null;
                 gain.gain.linearRampToValueAtTime(0, now + 1.0);
                 noiseSrc.stop(now + 1.1); 
             };
        }
    }
    else if (type === 'INSECT') {
        const src = createSource(this.insectBuffer, true);
        const gain = this.ctx.createGain();
        const rate = calculatePitch(8000, true);

        if (src) {
            src.playbackRate.value = rate;
            src.connect(gain);
            src.start(t);
            gain.connect(this.masterGain);
            fadeInOut(gain, 0, true, 0.3, 0.5); // Lower volume for shrill sounds
            
            internalStop = () => {
                const now = this.ctx!.currentTime;
                gain.gain.cancelScheduledValues(now);
                gain.gain.linearRampToValueAtTime(0, now + 0.5);
                if(src) src.stop(now + 0.6);
            };
        } else {
             // Fallback: Modulated High Sine
             const carrier = this.ctx.createOscillator();
             const modulator = this.ctx.createOscillator();
             const modGain = this.ctx.createGain();
             const mainGain = this.ctx.createGain();
             
             carrier.type = 'triangle';
             carrier.frequency.value = tinnitusFreq > 0 ? tinnitusFreq : 6000; 
             
             modulator.type = 'square';
             modulator.frequency.value = 30; // Faster buzz
             modGain.gain.value = 800;

             modulator.connect(modGain);
             modGain.connect(carrier.frequency);
             
             carrier.connect(mainGain);
             mainGain.connect(this.masterGain);
             
             carrier.start(t);
             modulator.start(t);

             fadeInOut(mainGain, 0, true, 0.5, 0.05); // Very quiet for synth insect
             
             internalStop = () => { 
                 const now = this.ctx!.currentTime;
                 mainGain.gain.linearRampToValueAtTime(0, now + 0.3);
                 carrier.stop(now + 0.4); 
                 modulator.stop(now + 0.4); 
             };
        }
    }

    // Wrapper stop function to handle state tracking
    stopFn = () => {
        internalStop();
        this.activeSounds.delete(type);
        this.updateRainDynamics(); 
    };

    return stopFn;
  }
}

export const audioEngine = new AudioEngine();
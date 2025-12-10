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

    const loadBuffer = async (path: string): Promise<AudioBuffer | null> => {
        try {
            const res = await fetch(path);
            if (res.ok) {
                const arr = await res.arrayBuffer();
                return await this.ctx!.decodeAudioData(arr);
            } else {
                console.warn(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
            }
        } catch (e) {
            console.warn(`Could not load ${path}`, e);
        }
        return null;
    };

    // Load all assets - REMOVED LEADING SLASHES for relative path resolution
    this.birdBuffer = await loadBuffer('ambient.mp3'); 
    this.windBuffer = await loadBuffer('wind.mp3');
    this.leavesBuffer = await loadBuffer('leaves.mp3'); 
    this.waterBuffer = await loadBuffer('water.mp3');
    this.rainBuffer = await loadBuffer('rain.mp3');
    this.insectBuffer = await loadBuffer('insect.mp3');
    
    console.log("Audio assets loaded (or attempted).");
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
    
    // Note: Drone is now manual
  }

  // --- HARMONY: DRONE ---
  public toggleDrone(shouldPlay: boolean) {
      if (shouldPlay) this.startDrone();
      else this.stopDrone();
  }

  private startDrone() {
      // Don't start duplicates
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

      // --- LAYER 1: Main Body (Sawtooth + LowPass) ---
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

      // --- LAYER 2: Detuned Texture (Sawtooth + LowPass) ---
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = root;
      osc2.detune.value = 10; // Slight detune for chorus effect
      
      const filter2 = this.ctx.createBiquadFilter();
      filter2.type = 'lowpass';
      filter2.frequency.value = 400;
      
      osc2.connect(filter2);
      filter2.connect(droneMaster);
      nodes.push(osc2, filter2);

      // --- LAYER 3: Sub Foundation (Sine) ---
      const osc3 = this.ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.value = root / 2; // G1
      
      const subGain = this.ctx.createGain();
      subGain.gain.value = 0.4;
      
      osc3.connect(subGain);
      subGain.connect(droneMaster);
      nodes.push(osc3, subGain);

      // --- LFO: Breathing Movement ---
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.1; // 10s cycle
      
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 100; // Modulate filter cutoff by +/- 100Hz

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
      droneMaster.gain.linearRampToValueAtTime(0.06, t + 4.0); // Target volume 0.06

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
      // Stop all active notes immediately (optional, or let them decay)
      // Letting them decay naturally is better for piano
  }

  private playNextPianoNote() {
      if (!this.ctx || !this.masterGain) return;
      
      // G Minor Pentatonic: G, Bb, C, D, F
      // Frequencies in 3rd and 4th octave for soft ambience
      const scale = [
          196.00, // G3
          233.08, // Bb3
          261.63, // C4
          293.66, // D4
          349.23, // F4
          392.00, // G4
          466.16  // Bb4
      ];

      // Select random note
      const freq = scale[Math.floor(Math.random() * scale.length)];
      // Velocity variation
      const velocity = 0.03 + Math.random() * 0.03; 

      const t = this.ctx.currentTime;
      
      // Synth Architecture: 
      // Triangle Wave (Filtered) -> Gain Envelope -> Reverb (Simulated by long release)
      
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      
      // Filter to make it sound "felted" (soft, muffled)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600 + Math.random() * 200; // Vary brightness slightly
      filter.Q.value = 0.5;

      const gain = this.ctx.createGain();
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      // Envelope
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(velocity, t + 0.1); // Soft attack
      gain.gain.exponentialRampToValueAtTime(0.001, t + 4.0); // Long decay/release

      osc.start(t);
      osc.stop(t + 4.5);
      
      // Cleanup
      const nodeRef = osc; // keep ref
      nodeRef.onended = () => {
          nodeRef.disconnect();
          filter.disconnect();
          gain.disconnect();
      };

      // Schedule next note
      // Random interval between 2s and 5s
      const nextTime = 2000 + Math.random() * 3000;
      this.pianoTimeout = window.setTimeout(() => this.playNextPianoNote(), nextTime);
  }


  // Helper to create noise buffer
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

  // --- DYNAMIC MIXING LOGIC ---
  private updateRainDynamics() {
      if (!this.rainGainNode || !this.ctx) return;
      
      const now = this.ctx.currentTime;
      // Check if any sound OTHER than rain is playing
      const othersPlaying = Array.from(this.activeSounds).some(t => t !== 'RAIN');
      
      // Base volume: 0.15
      // Ducked volume: 0.05 (Very quiet background)
      const targetVol = othersPlaying ? 0.05 : 0.15;
      
      // Smoothly transition volume
      this.rainGainNode.gain.cancelScheduledValues(now);
      this.rainGainNode.gain.setTargetAtTime(targetVol, now, 0.5); 
  }

  // Phase 3: Interactions
  // Returns a stop function
  public playInteractionSound(type: 'BIRD' | 'WIND' | 'LEAVES' | 'WATER' | 'RAIN' | 'INSECT', tinnitusFreq: number, onEnded?: () => void): () => void {
    this.init();
    if (!this.ctx || !this.masterGain) return () => {};
    const t = this.ctx.currentTime;
    
    // Track active sounds
    this.activeSounds.add(type);
    
    // Update Rain Ducking immediately when a new sound starts
    this.updateRainDynamics();

    let stopFn = () => {};
    let internalStop = () => {}; // Used to clean up without triggering recursion

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

    // Updated fadeInOut to accept targetVol
    const fadeInOut = (gainNode: GainNode, duration: number = 0, loop: boolean = false, fadeTime: number = 0.5, targetVol: number = 0.6) => {
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(targetVol, t + fadeTime);
        
        if (!loop && duration > 0) {
            gainNode.gain.setValueAtTime(targetVol, t + duration - fadeTime);
            gainNode.gain.linearRampToValueAtTime(0, t + duration);
        }
    };

    // Helper: Calculate frequency ratio
    // If tinnitus is 8000hz, and base is 8000hz, sounds play at 1.0x speed/pitch
    const calculatePitch = (baseFreq: number, aggressive: boolean = true) => {
        const ratio = tinnitusFreq / baseFreq;
        if (aggressive) {
            // Direct mapping for Tonal sounds (Birds, Insects)
            // Clamp to avoid extreme artifacts (0.5x to 2.5x)
            return Math.max(0.5, Math.min(2.5, ratio));
        } else {
            // Dampened mapping for Noise (Water, Wind)
            // Using Sqrt to make it less harsh.
            return Math.max(0.6, Math.min(1.8, Math.sqrt(ratio)));
        }
    };

    // --- INTERACTION LOGIC ---

    if (type === 'BIRD') {
        const src = createSource(this.birdBuffer);
        // BASE FREQ: 8000Hz (Per user request)
        const rate = calculatePitch(8000, true); 
        
        if (src) {
             const gain = this.ctx.createGain();
             src.playbackRate.value = rate;
             src.connect(gain);
             gain.connect(this.masterGain);
             fadeInOut(gain, src.buffer!.duration / rate); // Adjust duration for speed
             src.start(t);
             src.onended = () => {
                 this.activeSounds.delete(type);
                 this.updateRainDynamics();
                 if(onEnded) onEnded();
             };
             internalStop = () => { try { src.stop(this.ctx!.currentTime + 0.5); gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 0.5); } catch(e){} };
        } else {
             // Synth Fallback: MATCH FREQUENCY EXACTLY
             const osc = this.ctx.createOscillator();
             const gain = this.ctx.createGain();
             // Chirp around the tinnitus frequency
             osc.frequency.setValueAtTime(tinnitusFreq, t);
             osc.frequency.exponentialRampToValueAtTime(tinnitusFreq * 1.5, t + 0.1);
             gain.gain.setValueAtTime(0, t);
             gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
             gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
             osc.connect(gain);
             gain.connect(this.masterGain);
             osc.start(t);
             osc.stop(t + 0.5);
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
        // BASE FREQ: 8000Hz
        const rate = calculatePitch(8000, false);
        
        if (src) {
             src.playbackRate.value = rate * (0.9 + Math.random() * 0.2); // Add slight organic variance
             src.connect(gain);
             src.start(t);
        } else {
             // Synth Fallback
             const buffer = this.createNoiseBuffer();
             const noiseSrc = this.ctx.createBufferSource();
             noiseSrc.buffer = buffer;
             noiseSrc.loop = true;
             const filter = this.ctx.createBiquadFilter();
             filter.type = 'highpass';
             // Scale filter cuttoff based on tinnitus freq (Normalized to 8000Hz)
             filter.frequency.value = 900 * (tinnitusFreq / 8000); 
             noiseSrc.connect(filter);
             filter.connect(gain);
             noiseSrc.start(t);
             internalStop = () => { noiseSrc.stop(); }; 
        }

        gain.connect(this.masterGain);
        fadeInOut(gain, 0, true, 0.3);

        internalStop = () => {
            const now = this.ctx!.currentTime;
            gain.gain.cancelScheduledValues(now);
            gain.gain.linearRampToValueAtTime(0, now + 0.6);
            if (src) src.stop(now + 0.7);
        };
    }
    else if (type === 'WIND') {
        const src = createSource(this.windBuffer, true);
        const gain = this.ctx.createGain();
        // BASE FREQ: 8000Hz
        const rate = calculatePitch(8000, false); 
        
        if (src) {
             src.playbackRate.value = rate;
             src.connect(gain);
             src.start(t);
        } else {
             const buffer = this.createNoiseBuffer();
             const noiseSrc = this.ctx.createBufferSource();
             noiseSrc.buffer = buffer;
             noiseSrc.loop = true;
             const filter = this.ctx.createBiquadFilter();
             filter.type = 'lowpass';
             // Normalized to 8000Hz
             filter.frequency.value = 400 * (tinnitusFreq / 8000);
             noiseSrc.connect(filter);
             filter.connect(gain);
             noiseSrc.start(t);
             internalStop = () => { noiseSrc.stop(); };
        }

        gain.connect(this.masterGain);
        fadeInOut(gain, 0, true, 1.0);

        internalStop = () => {
            const now = this.ctx!.currentTime;
            gain.gain.cancelScheduledValues(now);
            gain.gain.linearRampToValueAtTime(0, now + 1.5);
            if (src) src.stop(now + 1.6);
        };
    }
    // --- WATER (Slow, Deep, Ocean-like) ---
    else if (type === 'WATER') {
        const src = createSource(this.waterBuffer, true);
        const gain = this.ctx.createGain();
        // BASE FREQ: 8000Hz
        const rate = calculatePitch(8000, false);

        if (src) {
            src.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
            src.connect(gain);
            src.start(t);
        } else {
             const buffer = this.createNoiseBuffer();
             const noiseSrc = this.ctx.createBufferSource();
             noiseSrc.buffer = buffer;
             noiseSrc.loop = true;
             const filter = this.ctx.createBiquadFilter();
             filter.type = 'lowpass';
             // Normalized to 8000Hz
             filter.frequency.value = 200 * (tinnitusFreq / 8000); 
             noiseSrc.connect(filter);
             filter.connect(gain);
             noiseSrc.start(t);
             internalStop = () => { noiseSrc.stop(); };
        }

        gain.connect(this.masterGain);
        fadeInOut(gain, 0, true, 1.5); 

        internalStop = () => {
            const now = this.ctx!.currentTime;
            gain.gain.cancelScheduledValues(now);
            gain.gain.linearRampToValueAtTime(0, now + 1.5);
            if (src) src.stop(now + 1.6);
        };
    }
    // --- RAIN (Constant, Gentle, Ducking Aware) ---
    else if (type === 'RAIN') {
        const src = createSource(this.rainBuffer, true);
        const gain = this.ctx.createGain();
        // BASE FREQ: 8000Hz
        const rate = calculatePitch(8000, false);
        
        // Store reference for dynamic ducking
        this.rainGainNode = gain;

        if (src) {
            src.playbackRate.value = rate;
            src.connect(gain);
            src.start(t);
        } else {
             const buffer = this.createNoiseBuffer();
             const noiseSrc = this.ctx.createBufferSource();
             noiseSrc.buffer = buffer;
             noiseSrc.loop = true;
             const filter = this.ctx.createBiquadFilter();
             filter.type = 'highpass';
             // Normalized to 8000Hz
             filter.frequency.value = 600 * (tinnitusFreq / 8000); 
             noiseSrc.connect(filter);
             filter.connect(gain);
             noiseSrc.start(t);
             internalStop = () => { noiseSrc.stop(); };
        }

        gain.connect(this.masterGain);
        
        // Check current context for initial volume
        const othersPlaying = Array.from(this.activeSounds).some(t => t !== 'RAIN');
        const startVol = othersPlaying ? 0.05 : 0.15; // Lower base volume

        // Manual fade in to support dynamic updates
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(startVol, t + 0.8);

        internalStop = () => {
            const now = this.ctx!.currentTime;
            // Prevent ducking updates from overriding stop fade
            this.rainGainNode = null; 
            gain.gain.cancelScheduledValues(now);
            gain.gain.linearRampToValueAtTime(0, now + 0.8);
            if (src) src.stop(now + 0.9);
        };
    }
    // --- INSECT (High, Erratic) ---
    else if (type === 'INSECT') {
        const src = createSource(this.insectBuffer, true);
        const gain = this.ctx.createGain();
        // BASE FREQ: 8000Hz
        const rate = calculatePitch(8000, true);

        if (src) {
            src.playbackRate.value = rate;
            src.connect(gain);
            src.start(t);
        } else {
             // Synth Fallback: Modulated Triangle Wave
             const carrier = this.ctx.createOscillator();
             const modulator = this.ctx.createOscillator();
             const modGain = this.ctx.createGain();
             carrier.type = 'triangle';
             
             // Match Tinnitus Freq
             carrier.frequency.value = tinnitusFreq; 
             
             modulator.type = 'square';
             modulator.frequency.value = 15;
             modGain.gain.value = 1000;
             modulator.connect(modGain);
             modGain.connect(carrier.frequency);
             carrier.connect(gain);
             carrier.start(t);
             modulator.start(t);
             internalStop = () => { carrier.stop(); modulator.stop(); };
        }
        
        gain.connect(this.masterGain);
        // BOOST VOLUME: 0.6 -> 1.2 to cut through mix
        fadeInOut(gain, 0, true, 0.3, 1.2);
        
        const originalInternal = internalStop;
        internalStop = () => {
            const now = this.ctx!.currentTime;
            gain.gain.cancelScheduledValues(now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            if(src) src.stop(now + 0.6);
            else setTimeout(originalInternal, 600);
        };
    }

    // Wrapper stop function to handle state tracking
    stopFn = () => {
        internalStop();
        this.activeSounds.delete(type);
        this.updateRainDynamics(); // Restore rain volume if it was the last other sound
    };

    return stopFn;
  }
}

export const audioEngine = new AudioEngine();
import React, { useState, useEffect, useRef } from 'react';
import { GardenScene } from './components/GardenScene';
import { TuningPanel } from './components/UI/TuningPanel';
import { AppMode, InteractionType } from './types';
import { audioEngine } from './services/AudioEngine';

// --- Preset Definitions ---
type Preset = {
  id: string;
  name: string;
  sounds: InteractionType[];
};

const PRESETS: Preset[] = [
  { id: 'forest', name: 'Quiet Forest', sounds: ['BIRD', 'LEAVES', 'INSECT'] },
  { id: 'rain', name: 'Rainy Shelter', sounds: ['RAIN', 'WATER', 'WIND'] },
  { id: 'ocean', name: 'Ocean Breeze', sounds: ['WATER', 'WIND', 'BIRD'] },
  { id: 'night', name: 'Summer Night', sounds: ['INSECT', 'WIND'] },
];

// --- Modal Component ---
const InfoModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode 
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8" onClick={onClose}>
      <div 
        className="max-w-md w-full bg-[#0a0a0a] border border-neutral-800 p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-[fadeIn_0.3s_ease-out]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-serif tracking-widest text-neutral-200 uppercase">{title}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="space-y-6 text-neutral-400 font-light leading-relaxed text-sm">
          {children}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.INTRO);
  const [frequency, setFrequency] = useState<number>(4500);
  const [isPlaying, setIsPlaying] = useState(false);

  // Audio State Management
  const [activeSounds, setActiveSounds] = useState<Set<InteractionType>>(new Set());
  const stopFns = useRef<Map<string, () => void>>(new Map());

  // Harmony State
  const [droneActive, setDroneActive] = useState(false);
  const [pianoActive, setPianoActive] = useState(false);

  // UI Modal State
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Initialize engine and load the asset file when the app loads
  useEffect(() => {
    const loadAudio = async () => {
        await audioEngine.loadAmbientTrack();
    };
    loadAudio();
  }, []);

  // --- Audio Logic ---

  // Sync Harmony Toggle State with AudioEngine
  useEffect(() => {
    audioEngine.toggleDrone(droneActive);
  }, [droneActive]);

  useEffect(() => {
    audioEngine.togglePiano(pianoActive);
  }, [pianoActive]);


  const toggleSound = (type: InteractionType) => {
    setActiveSounds(prev => {
      const next = new Set(prev);
      
      if (next.has(type)) {
        // STOP LOGIC
        const stop = stopFns.current.get(type);
        if (stop) stop();
        stopFns.current.delete(type);
        next.delete(type);
      } else {
        // START LOGIC
        const stop = audioEngine.playInteractionSound(type, frequency, () => {
            // Callback when sound ends naturally (e.g. non-looping)
            setActiveSounds(current => {
                const updated = new Set(current);
                updated.delete(type);
                stopFns.current.delete(type);
                return updated;
            });
        });
        stopFns.current.set(type, stop);
        next.add(type);
      }
      return next;
    });
  };

  const applyPreset = (preset: Preset) => {
    // 1. Identify sounds to stop (active but not in preset)
    activeSounds.forEach(sound => {
        if (!preset.sounds.includes(sound)) {
             const stop = stopFns.current.get(sound);
             if (stop) stop();
             stopFns.current.delete(sound);
        }
    });

    // 2. Identify sounds to start (in preset but not active)
    const newActiveSet = new Set<InteractionType>();
    
    // First, keep existing ones that are in the preset
    activeSounds.forEach(sound => {
        if (preset.sounds.includes(sound)) {
            newActiveSet.add(sound);
        }
    });

    // Then start new ones
    preset.sounds.forEach(sound => {
        if (!activeSounds.has(sound)) {
            const stop = audioEngine.playInteractionSound(sound, frequency, () => {
                setActiveSounds(current => {
                    const updated = new Set(current);
                    updated.delete(sound);
                    stopFns.current.delete(sound);
                    return updated;
                });
            });
            stopFns.current.set(sound, stop);
            newActiveSet.add(sound);
        }
    });

    setActiveSounds(newActiveSet);
  };

  const handleStart = () => {
    audioEngine.init();
    setMode(AppMode.TUNING);
  };

  const toggleTinnitusTone = () => {
    if (isPlaying) {
      audioEngine.stopTinnitusTone();
    } else {
      audioEngine.startTinnitusTone(frequency, 0.1);
    }
    setIsPlaying(!isPlaying);
  };

  const handleConfirmFrequency = () => {
    audioEngine.stopTinnitusTone();
    setIsPlaying(false);
    audioEngine.startAmbientTrack(frequency);
    setMode(AppMode.GARDEN);
  };

  useEffect(() => {
    if (isPlaying) {
      audioEngine.updateTinnitusFreq(frequency);
    }
  }, [frequency, isPlaying]);

  // --- Helper to check if current active sounds match a preset exactly ---
  const activePresetId = PRESETS.find(p => {
      if (p.sounds.length !== activeSounds.size) return false;
      return p.sounds.every(s => activeSounds.has(s));
  })?.id;

  const isModalOpen = showHelp || showAbout;

  return (
    <div className="w-full h-screen relative bg-[#050505] text-neutral-200 overflow-hidden">
      
      {/* Background Visuals */}
      <div className={`absolute inset-0 transition-opacity duration-[2000ms] ${mode === AppMode.INTRO ? 'opacity-0' : 'opacity-100'}`}>
        <GardenScene 
            frequency={frequency} 
            mode={mode} 
            activeSounds={activeSounds}
            onToggleSound={toggleSound}
            isModalOpen={isModalOpen}
        />
      </div>

      {/* Intro Screen */}
      {mode === AppMode.INTRO && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
          <div className="max-w-2xl text-center space-y-8 px-8 animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-serif tracking-[0.2em] text-neutral-100">
              Resonance Garden
            </h1>
            <div className="h-px w-24 bg-neutral-800 mx-auto"></div>
            <p className="text-neutral-500 font-light leading-relaxed text-sm md:text-base max-w-lg mx-auto">
              A visual landscape constructed from sound. <br/><br/>
              By matching your internal frequency, we transpose nature into a spectrum you can inhabit comfortably.
            </p>
            <button 
              onClick={handleStart}
              className="mt-12 px-10 py-3 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-500 transition-all duration-700 uppercase tracking-[0.3em] text-xs"
            >
              Begin Experience
            </button>
          </div>
        </div>
      )}

      {/* Tuning Interface */}
      {mode === AppMode.TUNING && (
        <TuningPanel 
          frequency={frequency}
          setFrequency={setFrequency}
          onConfirm={handleConfirmFrequency}
          isPlaying={isPlaying}
          togglePlay={toggleTinnitusTone}
        />
      )}

      {/* Garden Overlay UI */}
      {mode === AppMode.GARDEN && (
        <>
            {/* Top/Bottom UI */}
            {/* FIX: pointer-events-none added to container to prevent blocking canvas */}
            <div className={`absolute inset-0 z-10 pointer-events-none p-8 md:p-12 flex flex-col justify-between transition-opacity duration-500 ${isModalOpen ? 'opacity-0' : 'opacity-100'}`}>
            <header className="flex justify-between items-start opacity-0 animate-[fadeIn_2s_ease-out_forwards]">
                <h3 className="text-xs uppercase tracking-[0.2em] text-neutral-500">Resonance Garden</h3>
                <div className="text-right">
                <div className="text-xs text-neutral-600 tracking-widest uppercase mb-1">Matched Frequency</div>
                <div className="text-emerald-500/80 font-mono text-sm">{frequency} Hz</div>
                </div>
            </header>

            <footer className="text-center opacity-0 animate-[fadeIn_2s_ease-out_1s_forwards]">
                <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-600">
                The environment resonates at your frequency
                </p>
                <button 
                onClick={() => { setMode(AppMode.TUNING); }}
                className="pointer-events-auto mt-4 text-[10px] text-neutral-500 hover:text-emerald-400 transition-colors uppercase tracking-widest border-b border-transparent hover:border-emerald-900 pb-1"
                >
                Retune Frequency
                </button>
            </footer>
            </div>

            {/* LEFT BOTTOM - INFO & HELP CONTROLS */}
            <div className={`absolute bottom-10 left-8 md:left-12 z-30 pointer-events-auto flex gap-4 transition-opacity duration-500 ${isModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 animate-[fadeIn_2s_ease-out_1.5s_forwards]'}`}>
              <button 
                onClick={() => setShowHelp(true)}
                className="w-10 h-10 rounded-full border border-neutral-800 bg-black/40 backdrop-blur-md flex items-center justify-center text-neutral-500 hover:text-emerald-200 hover:border-emerald-500/50 hover:bg-black/60 transition-all duration-300 group"
                aria-label="How to use"
              >
                <span className="font-serif italic text-lg group-hover:scale-110 transition-transform">?</span>
              </button>
              <button 
                onClick={() => setShowAbout(true)}
                className="w-10 h-10 rounded-full border border-neutral-800 bg-black/40 backdrop-blur-md flex items-center justify-center text-neutral-500 hover:text-emerald-200 hover:border-emerald-500/50 hover:bg-black/60 transition-all duration-300 group"
                aria-label="About"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="group-hover:scale-110 transition-transform">
                   <circle cx="12" cy="12" r="10"></circle>
                   <line x1="12" y1="16" x2="12" y2="12"></line>
                   <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </button>
            </div>

            {/* RIGHT SIDEBAR - CONTROLS */}
            <div className={`absolute top-1/2 right-0 -translate-y-1/2 z-20 flex flex-col items-end pr-8 md:pr-12 transition-opacity duration-500 ${isModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto animate-[fadeIn_2s_ease-out_2s_forwards]'}`}>
                <div className="flex flex-col items-end gap-10">
                    
                    {/* SECTION 1: PRESETS */}
                    <div className="space-y-4 flex flex-col items-end">
                        <h4 className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 border-b border-neutral-800 pb-2 mb-2">Soundscapes</h4>
                        
                        {PRESETS.map((preset) => {
                            const isActive = activePresetId === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    onClick={() => applyPreset(preset)}
                                    className={`
                                        group flex items-center gap-4 transition-all duration-500 ease-out
                                        ${isActive ? 'translate-x-0' : 'translate-x-2 hover:translate-x-0'}
                                    `}
                                >
                                    <span className={`text-[10px] uppercase tracking-widest transition-colors duration-300 ${isActive ? 'text-emerald-200' : 'text-neutral-600 group-hover:text-neutral-400'}`}>
                                        {preset.name}
                                    </span>
                                    <div className={`
                                        w-2 h-2 rounded-full border transition-all duration-500
                                        ${isActive 
                                            ? 'bg-emerald-400 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' 
                                            : 'bg-transparent border-neutral-700 group-hover:border-neutral-500'
                                        }
                                    `}></div>
                                </button>
                            );
                        })}
                    </div>

                    {/* SECTION 2: HARMONY (Background Tones) */}
                    <div className="space-y-4 flex flex-col items-end">
                        <h4 className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 border-b border-neutral-800 pb-2 mb-2">Harmony</h4>
                        
                        {/* Cello Drone */}
                        <button
                            onClick={() => setDroneActive(!droneActive)}
                            className={`
                                group flex items-center gap-4 transition-all duration-500 ease-out
                                ${droneActive ? 'translate-x-0' : 'translate-x-2 hover:translate-x-0'}
                            `}
                        >
                             <span className={`text-[10px] uppercase tracking-widest transition-colors duration-300 ${droneActive ? 'text-amber-200' : 'text-neutral-600 group-hover:text-neutral-400'}`}>
                                Cello Drone
                            </span>
                             <div className={`
                                w-2 h-2 rounded-full border transition-all duration-500
                                ${droneActive 
                                    ? 'bg-amber-700 border-amber-600 shadow-[0_0_10px_rgba(180,83,9,0.5)]' 
                                    : 'bg-transparent border-neutral-700 group-hover:border-neutral-500'
                                }
                            `}></div>
                        </button>

                        {/* Piano */}
                        <button
                            onClick={() => setPianoActive(!pianoActive)}
                            className={`
                                group flex items-center gap-4 transition-all duration-500 ease-out
                                ${pianoActive ? 'translate-x-0' : 'translate-x-2 hover:translate-x-0'}
                            `}
                        >
                             <span className={`text-[10px] uppercase tracking-widest transition-colors duration-300 ${pianoActive ? 'text-indigo-200' : 'text-neutral-600 group-hover:text-neutral-400'}`}>
                                Ambient Piano
                            </span>
                             <div className={`
                                w-2 h-2 rounded-full border transition-all duration-500
                                ${pianoActive 
                                    ? 'bg-indigo-400 border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]' 
                                    : 'bg-transparent border-neutral-700 group-hover:border-neutral-500'
                                }
                            `}></div>
                        </button>
                    </div>

                    {/* Clear Button */}
                    <button
                        onClick={() => {
                            // Stop Presets
                            activeSounds.forEach(sound => {
                                const stop = stopFns.current.get(sound);
                                if(stop) stop();
                            });
                            stopFns.current.clear();
                            setActiveSounds(new Set());
                            
                            // Stop Harmony
                            setDroneActive(false);
                            setPianoActive(false);
                        }}
                        className={`
                            mt-2 text-[9px] uppercase tracking-widest text-neutral-700 hover:text-red-400 transition-colors
                            ${(activeSounds.size > 0 || droneActive || pianoActive) ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                        `}
                    >
                        Silence
                    </button>
                </div>
            </div>

            {/* MODALS */}
            <InfoModal 
              isOpen={showHelp} 
              onClose={() => setShowHelp(false)} 
              title="Garden Guide"
            >
               <div>
                 <h4 className="text-emerald-400 text-xs uppercase tracking-widest mb-2">Soundscapes</h4>
                 <p className="mb-4">
                   Curated audio environments (Forest, Rain, Ocean) designed to mask tinnitus frequencies. 
                   Select a preset from the menu or click objects in the 3D world to mix your own environment.
                 </p>
                 
                 <h4 className="text-amber-400 text-xs uppercase tracking-widest mb-2">Harmony</h4>
                 <p>
                   Musical anchors that provide deep emotional grounding. 
                   <strong className="text-neutral-300"> Cello Drone</strong> provides a steady, warm bass layer. 
                   <strong className="text-neutral-300"> Ambient Piano</strong> adds generative, calming melodies.
                   Use these to reduce the perceived harshness of the ringing.
                 </p>
               </div>
            </InfoModal>

            <InfoModal 
              isOpen={showAbout} 
              onClose={() => setShowAbout(false)} 
              title="About the Plan"
            >
               <p className="text-lg font-serif italic text-neutral-300 text-center px-4">
                 "This is a healing plan designed to relieve tinnitus through frequency resonance."
               </p>
            </InfoModal>
        </>
      )}
      
      {/* Global CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default App;
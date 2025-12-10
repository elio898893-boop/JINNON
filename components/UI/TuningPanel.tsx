import React, { useCallback, useRef, useState } from 'react';

interface TuningPanelProps {
  frequency: number;
  setFrequency: (val: number) => void;
  onConfirm: () => void;
  isPlaying: boolean;
  togglePlay: () => void;
}

export const TuningPanel: React.FC<TuningPanelProps> = ({ 
  frequency, 
  setFrequency, 
  onConfirm,
  isPlaying,
  togglePlay
}) => {
  // Configuration
  const MIN_FREQ = 4500;
  const MAX_FREQ = 10000;
  
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Helper: Convert linear slider position (0-1) to logarithmic frequency
  const toLogFreq = useCallback((position: number) => {
    // formula: f = min * (max/min)^position
    // Clamp position 0-1
    const clampedPos = Math.max(0, Math.min(1, position));
    return Math.round(MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, clampedPos));
  }, []);

  // Helper: Convert frequency to linear slider position (0-1) for UI rendering
  const fromLogFreq = useCallback((freq: number) => {
    // formula: position = log(freq/min) / log(max/min)
    const pos = Math.log(freq / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ);
    return Math.max(0, Math.min(1, pos));
  }, []);

  // Current slider position (0 to 1) based on frequency
  const sliderPos = fromLogFreq(frequency);

  const updateFrequencyFromEvent = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const width = rect.width;
    const percentage = x / width;
    setFrequency(toLogFreq(percentage));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFrequencyFromEvent(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateFrequencyFromEvent(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 bg-black/40 backdrop-blur-sm transition-all duration-1000">
      <div className="pointer-events-auto max-w-md w-full p-8 text-center space-y-12">
        
        {/* Header */}
        <div className="space-y-4">
          <h2 className="text-3xl font-light text-neutral-200 tracking-[0.2em] uppercase">Frequency Match</h2>
          <p className="text-neutral-400 font-light text-sm leading-relaxed">
            Adjust the slider until the tone matches the sound inside your ear. <br/>
            We will tune the environment to this frequency.
          </p>

          {/* Volume Warning */}
          <div className="flex items-center justify-center gap-2 text-amber-400/90 text-[10px] uppercase tracking-widest bg-amber-900/20 py-2 px-4 rounded-sm border border-amber-900/30 mx-auto w-fit shadow-[0_0_15px_rgba(245,158,11,0.1)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
               <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
               <line x1="12" y1="9" x2="12" y2="13"/>
               <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Caution: Lower volume before playing</span>
          </div>
        </div>

        {/* Slider Section */}
        <div className="space-y-8 relative py-6">
          
          {/* Interactive Container: Replaces Input for exact hit testing */}
          <div 
            ref={trackRef}
            className="relative w-full h-12 flex items-center cursor-pointer touch-none select-none group"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Track Line Background */}
            <div className="absolute w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                {/* Visual Filler */}
                <div 
                  className="h-full bg-emerald-700/50"
                  style={{ width: `${sliderPos * 100}%` }}
                />
            </div>

            {/* Thumb - using translate-x-1/2 ensures exact center alignment with the click point */}
            <div 
              className="absolute w-4 h-4 bg-emerald-100 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] transform -translate-x-1/2 transition-transform duration-100 ease-out group-active:scale-125"
              style={{ left: `${sliderPos * 100}%` }}
            />
          </div>
          
          {/* Labels */}
          <div className="flex justify-between text-xs text-neutral-500 font-mono tracking-widest -mt-4">
            <span>4.5kHz</span>
            <span className="text-emerald-400 text-base">{frequency} Hz</span>
            <span>10kHz</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-6 pt-4">
          <button 
            onClick={togglePlay}
            className="px-6 py-2 border border-neutral-700 text-neutral-300 hover:border-emerald-500/50 hover:text-emerald-100 transition-colors duration-300 text-sm uppercase tracking-widest"
          >
            {isPlaying ? 'Stop Tone' : 'Play Tone'}
          </button>
          
          <button 
            onClick={onConfirm}
            className="px-8 py-2 bg-emerald-900/20 border border-emerald-900/50 text-emerald-100 hover:bg-emerald-800/30 hover:border-emerald-500 transition-all duration-500 text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(6,78,59,0.2)]"
          >
            Enter Garden
          </button>
        </div>
      </div>
    </div>
  );
};
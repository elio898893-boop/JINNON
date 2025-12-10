import React from 'react';

export enum AppMode {
  INTRO = 'INTRO',
  TUNING = 'TUNING',
  GARDEN = 'GARDEN'
}

export interface AudioState {
  frequency: number; // Hz
  gain: number; // 0-1
  isPlaying: boolean;
}

export type InteractionType = 'BIRD' | 'WIND' | 'LEAVES' | 'WATER' | 'RAIN' | 'INSECT';

export interface SoundObjectProps {
  position: [number, number, number];
  color: string;
  type: InteractionType;
  onInteract: (type: string, position: [number, number, number]) => void;
}

// Augment global JSX.IntrinsicElements to satisfy TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Catch-all for R3F elements (mesh, group, points, etc.)
      [elemName: string]: any;
    }
  }
}

// Augment React's internal JSX namespace for React 18+ strict types
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
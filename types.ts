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

// Augment JSX.IntrinsicElements to satisfy TypeScript in environments
// where R3F types might not be automatically picked up.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      points: any;
      bufferGeometry: any;
      bufferAttribute: any;
      shaderMaterial: any;
      sphereGeometry: any;
      meshBasicMaterial: any;
      color: any;
      fog: any;
    }
  }
}
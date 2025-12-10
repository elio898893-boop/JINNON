import React, { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { ParticleField } from './Visuals/ParticleField';
import { InteractiveObject } from './Visuals/InteractiveObject';
import { TreeGrove } from './Visuals/TreeGrove';
import { WaterSurface } from './Visuals/WaterSurface';
import { ParticleArchitecture } from './Visuals/ParticleArchitecture';
import { BackgroundWaveform } from './Visuals/BackgroundWaveform';
import { BirdFlock } from './Visuals/BirdFlock';
import { RainParticles } from './Visuals/RainParticles';
import { LeafParticles } from './Visuals/LeafParticles';
import { InsectSwarm } from './Visuals/InsectSwarm';
import { AppMode, InteractionType } from '../types';

interface GardenSceneProps {
  frequency: number;
  mode: AppMode;
  activeSounds: Set<InteractionType>;
  onToggleSound: (type: InteractionType) => void;
  isModalOpen?: boolean;
}

// Helper to track mouse RAY direction
const MouseTracker = ({ rayRef }: { rayRef: React.MutableRefObject<THREE.Vector3> }) => {
  const { camera, pointer } = useThree();
  const vec = new THREE.Vector3();

  useFrame(() => {
    // Calculate direction from camera to mouse position in world space
    vec.set(pointer.x, pointer.y, 0.5);
    vec.unproject(camera);
    vec.sub(camera.position).normalize();
    
    // Smoothly update the ref to avoid jitter
    rayRef.current.lerp(vec, 0.1);
  });

  return null;
};

// Helper component to handle the transition logic using useFrame inside Canvas
const SceneContent: React.FC<GardenSceneProps> = ({ frequency, mode, activeSounds, onToggleSound, isModalOpen }) => {
  const controlsRef = useRef<any>(null);
  
  // Stores the NORMALIZED DIRECTION of the mouse ray from the camera
  const rayRef = useRef(new THREE.Vector3(0, 0, -1));
  
  return (
    <>
        <MouseTracker rayRef={rayRef} />

        <group position={[0, -1, 0]}>
          
          {/* 1. The Water Surface (Lowest Layer) - Reacts to WATER sound */}
          <WaterSurface 
            frequency={frequency} 
            mode={mode} 
            isActive={activeSounds.has('WATER')} 
          />

          {/* 2. The Ground Particles (Mid Layer - Floating above water) */}
          <ParticleField frequency={frequency} count={4000} mode={mode} rayRef={rayRef} />
          
          {/* 3. The Forest (Surrounding) - REACTS TO WIND */}
          {/* Increased count to 100 to fill the sides, creating a dense forest around the path */}
          <TreeGrove 
            frequency={frequency} 
            count={100} 
            mode={mode} 
            rayRef={rayRef}
            isWindActive={activeSounds.has('WIND')}
          />
          
          {/* 4. The Architecture (Background Anchor) */}
          <ParticleArchitecture frequency={frequency} position={[0, -0.5, -12]} mode={mode} rayRef={rayRef} />

          {/* 5. The Sky Waveform (Ambient Ring) - Now with mode prop */}
          <BackgroundWaveform frequency={frequency} position={[0, 8, 0]} mode={mode} />

          {/* 6. Background Bird Flock (New Ambient Life) */}
          <BirdFlock count={12} />

          {/* 7. Rain Particles (Conditional Visual) */}
          <RainParticles active={activeSounds.has('RAIN')} />

          {/* 8. Leaf Particles (Conditional Visual) */}
          <LeafParticles active={activeSounds.has('LEAVES')} />

          {/* 9. Insect Swarm (Conditional Visual) */}
          <InsectSwarm active={activeSounds.has('INSECT')} />

          {/* 10. Background Stars */}
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          {/* --- Interactive Elements --- */}
          {/* Always mount them, but control visibility inside the component via props and CSS delays */}
          <group>
            {/* -- BIRDS (Original) -- */}
            <InteractiveObject 
              position={[-5, 4, -4]} 
              type="BIRD" 
              label="Avian Resonance"
              scale={1.2}
              isPlaying={activeSounds.has('BIRD')}
              onToggle={() => onToggleSound('BIRD')}
              mode={mode}
              isUIHidden={isModalOpen}
            />
            
            {/* -- WIND (Original) -- */}
            <InteractiveObject 
              position={[-3, 1.5, -1]} 
              type="WIND" 
              label="Whispering Wind"
              isPlaying={activeSounds.has('WIND')}
              onToggle={() => onToggleSound('WIND')}
              mode={mode}
              isUIHidden={isModalOpen}
            />

            {/* -- NEW ELEMENTS -- */}
            
            {/* INSECT: Low to the ground, slight glow */}
            <InteractiveObject 
              position={[2.5, 0.8, 3.5]} 
              type="INSECT" 
              label="Summer Cicada"
              scale={0.6}
              isPlaying={activeSounds.has('INSECT')}
              onToggle={() => onToggleSound('INSECT')}
              mode={mode}
              isUIHidden={isModalOpen}
            />

            {/* LEAVES: Near trees (High Left) */}
            <InteractiveObject 
              position={[-6, 3, 2]} 
              type="LEAVES" 
              label="Rustling Leaves"
              scale={1.0}
              isPlaying={activeSounds.has('LEAVES')}
              onToggle={() => onToggleSound('LEAVES')}
              mode={mode}
              isUIHidden={isModalOpen}
            />

            {/* WATER: Near bottom/surface (Low Center) */}
            <InteractiveObject 
              position={[0, 0.5, 5]} 
              type="WATER" 
              label="Gentle Tide"
              scale={1.0}
              isPlaying={activeSounds.has('WATER')}
              onToggle={() => onToggleSound('WATER')}
              mode={mode}
              isUIHidden={isModalOpen}
            />

            {/* RAIN: High up in the sky */}
            <InteractiveObject 
              position={[2, 6, -5]} 
              type="RAIN" 
              label="Soft Rain"
              scale={1.0}
              isPlaying={activeSounds.has('RAIN')}
              onToggle={() => onToggleSound('RAIN')}
              mode={mode}
              isUIHidden={isModalOpen}
            />
          </group>
          
        </group>

        {/* Post Processing */}
        <EffectComposer enableNormalPass={false}>
          {/* Softer, wider bloom for dreaminess */}
          <Bloom 
            luminanceThreshold={0.2} 
            luminanceSmoothing={0.9} 
            height={300} 
            intensity={1.5} 
          />
          {/* Chromatic Aberration adds that ethereal lens/dream effect */}
          <ChromaticAberration 
            offset={[new THREE.Vector2(0.002, 0.002)]} 
            radialModulation={false}
            modulationOffset={0}
          />
          <Noise opacity={0.08} />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>

        <OrbitControls 
          makeDefault
          ref={controlsRef}
          minDistance={2}
          maxDistance={50}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
          enablePan={false}
          enableDamping={true}
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2 + 0.1} 
          minPolarAngle={Math.PI / 6} 
          enableZoom={true}
        />
    </>
  );
}

export const GardenScene: React.FC<GardenSceneProps> = (props) => {
  // Define dream colors
  const bgColor = '#050810'; // Deep Midnight Blue

  return (
    <Canvas
      camera={{ position: [0, 3, 12], fov: 50 }}
      dpr={[1, 2]} 
      gl={{ alpha: false, antialias: false }}
    >
      <color attach="background" args={[bgColor]} />
      {/* Dense fog for dream atmosphere */}
      <fog attach="fog" args={[bgColor, 5, 35]} /> 
      <Suspense fallback={null}>
        <SceneContent {...props} />
      </Suspense>
    </Canvas>
  );
};
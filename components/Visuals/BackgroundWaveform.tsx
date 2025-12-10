import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppMode } from '../../types';

const vertexShader = `
  uniform float uTime;
  uniform float uFrequency;
  uniform float uTransition; // 0 (Chaos) -> 1 (Order)
  
  attribute float aAngle;
  attribute float aRingIndex;
  attribute vec3 aRandom; // Random offset for chaos state
  
  varying float vOpacity;

  void main() {
    vec3 pos = position;
    
    // --- Structured Wave Logic (Order State) ---
    float freqFactor = 1.0 + (uFrequency / 4000.0);
    float theta = aAngle * (6.0 + freqFactor) + uTime * 0.5;
    float phaseShift = aRingIndex * 4.0; 
    
    float wave = sin(theta + phaseShift) + sin(theta * 0.7 - phaseShift);
    
    float envelope = 1.0 - abs(aRingIndex); 
    envelope = smoothstep(0.0, 1.0, envelope); 

    float amplitude = 2.5 + (uFrequency / 8000.0) * 1.5;
    
    // Apply Wave to Y
    pos.y += wave * amplitude * envelope;

    // --- TRANSITION LOGIC ---
    // Chaos State: explode the cylinder outwards and scatter vertically
    vec3 chaosPos = pos;
    
    // 1. Expand radius massively
    chaosPos.x *= 5.0 + aRandom.x * 2.0;
    chaosPos.z *= 5.0 + aRandom.z * 2.0;
    
    // 2. Vertical scatter (shatter the rings)
    chaosPos.y += (aRandom.y - 0.5) * 150.0;
    
    // 3. General noise
    chaosPos += (aRandom - 0.5) * 20.0;

    // Interpolate
    vec3 finalPos = mix(chaosPos, pos, uTransition);

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    gl_PointSize = 50.0 / -mvPosition.z;
    
    // --- Opacity Calculation ---
    float edgeFade = smoothstep(0.0, 0.2, 1.0 - abs(aRingIndex));
    float activeHighlight = 0.5 + 0.5 * smoothstep(0.0, 2.0, abs(wave));
    
    // During chaos, increase opacity slightly so they look like stars
    float chaosAlpha = 0.6;
    float orderAlpha = edgeFade * activeHighlight;
    
    vOpacity = mix(chaosAlpha, orderAlpha, uTransition);
  }
`;

const fragmentShader = `
  varying float vOpacity;

  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    float alpha = 1.0 - smoothstep(0.3, 0.5, r);
    
    vec3 color = vec3(0.9, 0.98, 1.0);
    
    gl_FragColor = vec4(color, alpha * vOpacity * 0.8); 
  }
`;

interface BackgroundWaveformProps {
  frequency: number;
  position?: [number, number, number];
  mode?: AppMode; // Make optional to match usage, though we will pass it
}

export const BackgroundWaveform: React.FC<BackgroundWaveformProps> = ({ 
  frequency, 
  position = [0, 0, 0],
  mode = AppMode.INTRO // Default
}) => {
  const mesh = useRef<THREE.Points>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uFrequency: { value: frequency },
    uTransition: { value: 0 }
  }), []);

  useFrame((state) => {
    if (mesh.current) {
      const mat = mesh.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.getElapsedTime();
      mat.uniforms.uFrequency.value = frequency;
      
      // Rotate the entire cylinder
      mesh.current.rotation.y = state.clock.getElapsedTime() * 0.05;

      // Handle Transition
      const target = mode === AppMode.GARDEN ? 1.0 : 0.0;
      // Very slow lerp for the "Giant Structure" feel (0.008)
      mat.uniforms.uTransition.value = THREE.MathUtils.lerp(
        mat.uniforms.uTransition.value, 
        target, 
        0.008 
      );
    }
  });

  const particles = useMemo(() => {
    const positions: number[] = [];
    const angles: number[] = [];
    const ringIndices: number[] = [];
    const randoms: number[] = [];
    
    const radius = 35;
    const height = 18;
    
    const numRings = 40;
    const pointsPerRing = 200;

    for (let r = 0; r < numRings; r++) {
      const ringPct = r / (numRings - 1); 
      const ringIndex = ringPct * 2.0 - 1.0; 
      
      const yBase = ringIndex * (height / 2);

      for (let p = 0; p < pointsPerRing; p++) {
        const anglePct = p / pointsPerRing;
        const angle = anglePct * Math.PI * 2;
        
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        positions.push(x, yBase, z);
        angles.push(angle);
        ringIndices.push(ringIndex);
        
        // Random values for chaos offset
        randoms.push(Math.random(), Math.random(), Math.random());
      }
    }

    return {
      positions: new Float32Array(positions),
      angles: new Float32Array(angles),
      ringIndices: new Float32Array(ringIndices),
      randoms: new Float32Array(randoms)
    };
  }, []);

  return (
    <points ref={mesh} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.positions.length / 3}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aAngle"
          count={particles.angles.length}
          array={particles.angles}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aRingIndex"
          count={particles.ringIndices.length}
          array={particles.ringIndices}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={particles.randoms.length / 3}
          array={particles.randoms}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
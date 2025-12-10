import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppMode } from '../../types';

const vertexShader = `
  uniform float uTime;
  uniform float uFrequency;
  uniform float uTransition; // 0 -> 1
  uniform float uActive;     // 0 -> 1 (Interaction intensity)
  
  varying float vElevation;
  varying float vDistance;

  void main() {
    vec3 pos = position;
    
    // 1. Base Gentle rolling waves
    float wave1 = sin(pos.x * 0.2 + uTime * 0.5);
    float wave2 = cos(pos.z * 0.15 + uTime * 0.3);
    float freqIntensity = uFrequency / 8000.0; 
    float ripple = sin(pos.x * 1.5 + uTime * 2.0) * cos(pos.z * 1.5 + uTime) * (0.1 + 0.1 * freqIntensity);

    // 2. Active Surge Layer (Triggered by interaction)
    // Deeper, slower, larger swells to simulate "breathing" ocean
    float swellX = sin(pos.x * 0.1 + uTime * 0.6);
    float swellZ = cos(pos.z * 0.08 + uTime * 0.4);
    // Combined swell creates rolling hills of water
    float deepSurge = swellX * swellZ * 2.0 * uActive;

    // Apply combined height
    pos.y += (wave1 + wave2) * 0.3 + ripple + deepSurge;
    
    // --- TRANSITION LOGIC ---
    // Chaos: Water is spread out vertically like heavy rain or mist
    vec3 chaosPos = pos;
    // Use position hash as random
    float rand = fract(sin(dot(pos.xz ,vec2(12.9898,78.233))) * 43758.5453);
    
    chaosPos.y += (rand - 0.5) * 15.0; // Spreads vertically -7 to 7
    chaosPos.x += (rand - 0.5) * 5.0;
    
    vec3 finalPos = mix(chaosPos, pos, uTransition);
    
    vElevation = pos.y; // Pass height to fragment for coloring
    vDistance = -modelViewMatrix[3][2]; 

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    gl_PointSize = 60.0 / -mvPosition.z;
  }
`;

const fragmentShader = `
  varying float vElevation;

  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    // Adjust color mix based on height
    // When surging, peaks get brighter/whiter (foam), troughs get darker (depth)
    float heightFactor = smoothstep(-1.5, 1.5, vElevation);
    
    vec3 deepBlue = vec3(0.0, 0.05, 0.3);
    vec3 brightCyan = vec3(0.2, 0.9, 1.0);
    vec3 finalColor = mix(deepBlue, brightCyan, heightFactor);

    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 2.0); 

    gl_FragColor = vec4(finalColor, glow * 0.7);
  }
`;

interface WaterSurfaceProps {
  frequency: number;
  mode: AppMode;
  isActive: boolean;
}

export const WaterSurface: React.FC<WaterSurfaceProps> = ({ frequency, mode, isActive }) => {
  const points = useRef<THREE.Points>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uFrequency: { value: frequency },
    uTransition: { value: 0 },
    uActive: { value: 0 }
  }), []);

  useFrame((state) => {
    if (points.current) {
      const material = points.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.getElapsedTime();
      material.uniforms.uFrequency.value = THREE.MathUtils.lerp(
        material.uniforms.uFrequency.value,
        frequency,
        0.05
      );
      
      const target = mode === AppMode.GARDEN ? 1.0 : 0.0;
      material.uniforms.uTransition.value = THREE.MathUtils.lerp(
        material.uniforms.uTransition.value, 
        target, 
        0.02 
      );

      // Smoothly ramp the surge effect up/down
      const targetActive = isActive ? 1.0 : 0.0;
      material.uniforms.uActive.value = THREE.MathUtils.lerp(
        material.uniforms.uActive.value,
        targetActive,
        0.03 // Slow, heavy water inertia
      );
    }
  });

  const particleData = useMemo(() => {
    const count = 5000;
    const positions = new Float32Array(count * 3);
    const size = 60; 
    
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * size;
      const z = (Math.random() - 0.5) * size;
      const y = 0; 

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    
    return positions;
  }, []);

  return (
    <points ref={points} position={[0, -2.5, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleData.length / 3}
          array={particleData}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial 
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
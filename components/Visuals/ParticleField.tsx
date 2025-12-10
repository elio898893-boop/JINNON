import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppMode } from '../../types';

// Custom shader for the organic, breathing particle effect
const vertexShader = `
  uniform float uTime;
  uniform float uFrequency; 
  uniform float uTransition; // 0 (chaos) -> 1 (order)
  uniform vec3 uMouseDir; // Mouse Ray Direction
  
  attribute float aScale;
  attribute vec3 aRandom;
  attribute float aType; 
  
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    
    // Organic wave movement (Order) - SLOWED DOWN for dreaminess (0.5 -> 0.3)
    float wave = sin(pos.x * 0.3 + uTime * 0.3) * cos(pos.z * 0.3 + uTime * 0.2) * 0.5;
    float jitter = sin(uTime * 10.0 + pos.y) * (uFrequency / 10000.0) * 0.05;
    pos.y += wave + jitter;
    
    // --- TRANSITION LOGIC ---
    vec3 chaosPos = pos;
    chaosPos.y += (aRandom.y * 20.0); 
    chaosPos.x += (aRandom.x - 0.5) * 10.0;
    chaosPos.z += (aRandom.z - 0.5) * 10.0;
    
    vec3 finalPos = mix(chaosPos, pos, uTransition);
    
    // --- RAY INTERACTION ---
    vec3 vCamToParticle = finalPos - cameraPosition;
    float t = dot(vCamToParticle, uMouseDir);
    vec3 closestPointOnRay = cameraPosition + uMouseDir * t;
    float dist = distance(finalPos, closestPointOnRay);
    
    float beamRadius = 2.5; // Radius
    float interactionStrength = smoothstep(beamRadius, 0.0, dist); 
    
    if (interactionStrength > 0.0) {
       vec3 pushDir = normalize(finalPos - closestPointOnRay);
       // Push mainly horizontally for ground cover
       pushDir.y *= 0.2; 
       
       // Fluid ripple
       float ripple = sin(dist * 6.0 - uTime * 12.0) * 0.3 + 1.0;
       
       // Reduced strength from 2.0 to 0.6 for subtle flow
       finalPos += pushDir * interactionStrength * 0.6 * ripple * uTransition;
    }

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    float sizeMultiplier = 1.0 + (aType * 1.5); 
    gl_PointSize = (aScale * sizeMultiplier) * (30.0 / -mvPosition.z);
    
    // --- Color Calculation ---
    // Shifted towards cooler/emerald tones for dream feel
    float depth = (pos.y + 2.0) / 4.0;
    vec3 grassColor = mix(vec3(0.02, 0.15, 0.15), vec3(0.4, 0.8, 0.7), depth + (sin(uTime * 0.5) * 0.1));
    vec3 flowerColor = mix(vec3(0.6, 0.1, 0.4), vec3(0.5, 0.8, 1.0), aRandom.x);
    vColor = mix(grassColor, flowerColor, aType);
    
    // Twinkle Effect: Breathing alpha based on time and random phase
    float twinkle = 0.7 + 0.3 * sin(uTime * 1.5 + aRandom.x * 20.0);

    // Simple distance fade
    float distToCam = length(mvPosition.xyz);
    float fade = 1.0 - smoothstep(10.0, 45.0, distToCam);
    
    vAlpha = fade * twinkle;
  }
`;

const fragmentShader = `
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Soft particle circle
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    // Standard glow
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);

    gl_FragColor = vec4(vColor, vAlpha * glow * 0.9);
  }
`;

interface ParticleFieldProps {
  count?: number;
  frequency: number; 
  mode: AppMode;
  rayRef?: React.MutableRefObject<THREE.Vector3>;
}

export const ParticleField: React.FC<ParticleFieldProps> = ({ count = 6000, frequency, mode, rayRef }) => {
  const mesh = useRef<THREE.Points>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uFrequency: { value: frequency },
    uTransition: { value: 0 },
    uMouseDir: { value: new THREE.Vector3(0, 0, -1) }
  }), []);

  // Update uniforms
  useFrame((state) => {
    if (mesh.current && mesh.current.material instanceof THREE.ShaderMaterial) {
      const mat = mesh.current.material;
      mat.uniforms.uTime.value = state.clock.getElapsedTime();
      mat.uniforms.uFrequency.value = THREE.MathUtils.lerp(
        mat.uniforms.uFrequency.value,
        frequency,
        0.1
      );
      
      const target = mode === AppMode.GARDEN ? 1.0 : 0.0;
      mat.uniforms.uTransition.value = THREE.MathUtils.lerp(
        mat.uniforms.uTransition.value, 
        target, 
        0.015 
      );
      
      if (rayRef) {
          mat.uniforms.uMouseDir.value.copy(rayRef.current);
      }
    }
  });

  const particles = useMemo(() => {
    const tempPositions = new Float32Array(count * 3);
    const tempScales = new Float32Array(count);
    const tempRandoms = new Float32Array(count * 3);
    const tempTypes = new Float32Array(count); 

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 50;
      const z = (Math.random() - 0.5) * 50;
      const y = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 2 - 2;

      tempPositions[i * 3] = x;
      tempPositions[i * 3 + 1] = y;
      tempPositions[i * 3 + 2] = z;

      tempScales[i] = Math.random() * 2.0 + 0.5;
      
      tempRandoms[i * 3] = Math.random();
      tempRandoms[i * 3 + 1] = Math.random();
      tempRandoms[i * 3 + 2] = Math.random();

      const isFlower = Math.random() > 0.96 && y > -2.5;
      tempTypes[i] = isFlower ? 1.0 : 0.0;
    }

    return { 
      positions: tempPositions, 
      scales: tempScales, 
      randoms: tempRandoms, 
      types: tempTypes 
    };
  }, [count]);

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.positions.length / 3}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aScale"
          count={particles.scales.length}
          array={particles.scales}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={particles.randoms.length / 3}
          array={particles.randoms}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aType"
          count={particles.types.length}
          array={particles.types}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
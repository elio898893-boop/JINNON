import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppMode } from '../../types';

// Shader for the trees (static glow + subtle wind sway)
const vertexShader = `
  uniform float uTime;
  uniform float uFrequency;
  uniform float uTransition; // 0 (chaos) -> 1 (order)
  uniform float uWindIntensity; // 0.0 -> 1.0 (Active Wind)
  uniform vec3 uMouseDir;

  attribute float aSize;
  attribute float aSway; 
  attribute vec3 aColor;
  attribute vec3 aRandomDir; // For explosion
  
  varying vec3 vColor;
  varying float vSwayAmount;

  void main() {
    vColor = aColor;
    vSwayAmount = aSway;
    vec3 pos = position;
    
    // --- WIND PHYSICS ---
    // 1. Base Ambient Sway (Always present)
    float baseStrength = 0.1 + (uFrequency / 10000.0) * 0.05;
    float ambientX = sin(uTime * 0.8 + pos.y * 0.5);
    float ambientZ = cos(uTime * 0.6 + pos.x * 0.5);
    
    // 2. Active Wind Gusts (Triggered by interaction)
    // We add a faster, more turbulent wave layer when uWindIntensity is high
    float gustStrength = uWindIntensity * 0.8; 
    float gustX = sin(uTime * 3.5 + pos.y * 1.5) * cos(uTime * 1.2); // Turbulent noise
    float gustZ = cos(uTime * 3.0 + pos.x * 1.0);
    
    // Combine forces
    float totalX = ambientX * baseStrength + gustX * gustStrength;
    float totalZ = ambientZ * baseStrength + gustZ * gustStrength;
    
    // Apply sway based on height (aSway attribute approximates flexibility)
    pos.x += totalX * aSway;
    pos.z += totalZ * aSway;
    
    // --- TRANSITION LOGIC ---
    vec3 chaosPos = pos + aRandomDir * 25.0;
    chaosPos.y += 10.0;
    vec3 finalPos = mix(chaosPos, pos, uTransition);

    // --- RAY INTERACTION ---
    vec3 vCamToParticle = finalPos - cameraPosition;
    float t = dot(vCamToParticle, uMouseDir);
    vec3 closestPointOnRay = cameraPosition + uMouseDir * t;
    float dist = distance(finalPos, closestPointOnRay);
    
    float beamRadius = 3.5;
    float interactionStrength = smoothstep(beamRadius, 0.0, dist); 
    
    if (interactionStrength > 0.0) {
       vec3 pushDir = normalize(finalPos - closestPointOnRay);
       pushDir.y += 0.2; 
       float shiver = sin(uTime * 40.0) * 0.05 * interactionStrength;
       finalPos += pushDir * interactionStrength * 0.4 * uTransition;
       finalPos.x += shiver;
    }

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    gl_PointSize = aSize * (100.0 / -mvPosition.z);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vSwayAmount;

  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    float alpha = smoothstep(0.5, 0.2, r);
    float flutter = 0.9 + 0.1 * sin(vSwayAmount * 10.0);
    
    gl_FragColor = vec4(vColor, alpha * 0.95 * flutter);
  }
`;

interface TreeGroveProps {
  frequency: number;
  count?: number; 
  mode: AppMode;
  rayRef?: React.MutableRefObject<THREE.Vector3>;
  isWindActive?: boolean;
}

export const TreeGrove: React.FC<TreeGroveProps> = ({ frequency, count = 25, mode, rayRef, isWindActive = false }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uFrequency: { value: frequency },
    uTransition: { value: 0 },
    uWindIntensity: { value: 0 },
    uMouseDir: { value: new THREE.Vector3(0, 0, -1) }
  }), []);

  useFrame((state) => {
    if (pointsRef.current) {
      const mat = pointsRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.getElapsedTime();
      mat.uniforms.uFrequency.value = frequency;

      // 1. Mode Transition (Intro -> Garden)
      const targetTransition = mode === AppMode.GARDEN ? 1.0 : 0.0;
      mat.uniforms.uTransition.value = THREE.MathUtils.lerp(
        mat.uniforms.uTransition.value, 
        targetTransition, 
        0.01 
      );

      // 2. Wind Interaction Transition
      const targetWind = isWindActive ? 1.0 : 0.0;
      mat.uniforms.uWindIntensity.value = THREE.MathUtils.lerp(
        mat.uniforms.uWindIntensity.value,
        targetWind,
        0.03 // Smooth buildup of wind speed
      );
      
      if (rayRef) {
          mat.uniforms.uMouseDir.value.copy(rayRef.current);
      }
    }
  });

  // Generate the forest geometry
  const { positions, sizes, sway, colors, randomDirs } = useMemo(() => {
    const allPositions: number[] = [];
    const allSizes: number[] = [];
    const allSway: number[] = [];
    const allColors: number[] = [];
    const allRandomDirs: number[] = [];

    const addPoint = (x: number, y: number, z: number, size: number, swayVal: number, color: [number, number, number]) => {
      allPositions.push(x, y, z);
      allSizes.push(size);
      allSway.push(swayVal);
      allColors.push(...color);
      
      // Random direction outward
      allRandomDirs.push((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5));
    };

    for (let i = 0; i < count; i++) {
      let validPosition = false;
      let rootX = 0;
      let rootZ = 0;
      let attempts = 0;

      while (!validPosition && attempts < 200) {
          // New Placement Logic: Cartesian Scatter
          // Spread widely in X (-45 to 45) and Z (-45 to 25)
          rootX = (Math.random() - 0.5) * 90;
          rootZ = (Math.random() - 0.5) * 70 - 10; 

          // Logic to define the "Road" and "Clearing"
          
          // 1. The Road: A strip along the Z axis (X=0)
          // Width approx 8 units (+-4)
          const isRoad = Math.abs(rootX) < 4.5;
          
          // 2. The Architecture Zone: A clearing around Z=-12
          // Wider than the road to frame the building
          const isBuildingClearing = Math.abs(rootX) < 14 && (rootZ > -20 && rootZ < -5);
          
          // 3. Camera Start Zone: Keep immediate view clear
          const isCameraStart = Math.abs(rootX) < 6 && rootZ > 8;

          if (!isRoad && !isBuildingClearing && !isCameraStart) {
              validPosition = true;
          }
          attempts++;
      }

      if (!validPosition) continue;

      const rootY = -2; 
      const treeHeight = 5 + Math.random() * 6;
      
      // 1. Trunk
      const trunkPoints = 60; 
      for (let j = 0; j < trunkPoints; j++) {
        const t = j / trunkPoints; 
        const y = rootY + t * treeHeight;
        const x = rootX + (Math.sin(y * 2.0) * 0.2) + (Math.random() - 0.5) * 0.15;
        const z = rootZ + (Math.cos(y * 2.0) * 0.2) + (Math.random() - 0.5) * 0.15;
        
        const lightness = 0.2 + Math.random() * 0.2; 
        const trunkColor: [number, number, number] = [
            0.25 * lightness + 0.1,
            0.20 * lightness + 0.1,
            0.18 * lightness + 0.1
        ];
        
        // Trunks sway less (t^2)
        addPoint(x, y, z, 0.4, t * t * 0.3, trunkColor);
      }

      // 2. Canopy
      const leafPoints = 600; 
      const canopyCenterY = rootY + treeHeight * 0.75;
      const canopyRadius = 1.8 + Math.random() * 2.5;

      for (let k = 0; k < leafPoints; k++) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = Math.pow(Math.random(), 0.5) * canopyRadius; 

        const lx = rootX + r * Math.sin(phi) * Math.cos(theta);
        const ly = canopyCenterY + r * Math.sin(phi) * Math.sin(theta) * 0.8; 
        const lz = rootZ + r * Math.cos(phi);

        const size = 0.4 + Math.random() * 0.35;

        const colorRand = Math.random();
        let c: [number, number, number];
        if (colorRand > 0.92) c = [0.8, 0.7, 0.3]; 
        else if (colorRand > 0.7) c = [0.45, 0.55, 0.25];
        else if (colorRand > 0.4) c = [0.1, 0.35, 0.25];
        else if (colorRand > 0.15) c = [0.05, 0.2, 0.25];
        else c = [0.02, 0.05, 0.1];

        // Leaves sway more (1.0 scale)
        addPoint(lx, ly, lz, size, 0.8 + Math.random() * 0.4, c);
      }
    }

    return {
      positions: new Float32Array(allPositions),
      sizes: new Float32Array(allSizes),
      sway: new Float32Array(allSway),
      colors: new Float32Array(allColors),
      randomDirs: new Float32Array(allRandomDirs)
    };
  }, [count]);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={sizes.length}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aSway"
          count={sway.length}
          array={sway}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aColor"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandomDir"
          count={randomDirs.length / 3}
          array={randomDirs}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending} 
      />
    </points>
  );
};
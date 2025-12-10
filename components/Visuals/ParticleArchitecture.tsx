import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppMode } from '../../types';

const vertexShader = `
  uniform float uTime;
  uniform float uFrequency;
  uniform float uTransition; // 0.0 (Chaos) -> 1.0 (Order)
  uniform vec3 uMouseDir; // Mouse Ray Direction
  
  attribute vec3 aColor;
  attribute vec3 aRandomDir; // Direction to explode from
  
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec3 targetPos = position;
    
    // Architectural Rigidity vs Resonance
    float jitterIntensity = (uFrequency / 8000.0) * 0.02;
    float jitter = sin(uTime * 30.0 + targetPos.x * 10.0) * jitterIntensity;
    
    targetPos.x += jitter;
    targetPos.z += jitter;
    
    // --- TRANSITION LOGIC ---
    vec3 chaosPos = targetPos + aRandomDir * 30.0;
    vec3 finalPos = mix(chaosPos, targetPos, uTransition);
    
    // --- RAY INTERACTION ---
    vec3 vCamToParticle = finalPos - cameraPosition;
    float t = dot(vCamToParticle, uMouseDir);
    vec3 closestPointOnRay = cameraPosition + uMouseDir * t;
    float dist = distance(finalPos, closestPointOnRay);
    float beamRadius = 3.0;
    float interactionStrength = smoothstep(beamRadius, 0.0, dist);
    
    if (interactionStrength > 0.0) {
       vec3 pushDir = normalize(finalPos - closestPointOnRay);
       float ripple = sin(dist * 5.0 - uTime * 10.0) * 0.2 + 0.8;
       finalPos += pushDir * interactionStrength * 0.3 * ripple * uTransition;
    }

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Particles are denser and slightly smaller to define sharp edges
    gl_PointSize = 35.0 / -mvPosition.z;
  }
`;

const fragmentShader = `
  uniform float uTime;
  varying vec3 vColor;

  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    // Standard soft glow
    float alpha = smoothstep(0.5, 0.3, r); 
    
    gl_FragColor = vec4(vColor, alpha * 0.8);
  }
`;

interface ParticleArchitectureProps {
  frequency: number;
  position?: [number, number, number];
  mode: AppMode;
  rayRef?: React.MutableRefObject<THREE.Vector3>;
}

export const ParticleArchitecture: React.FC<ParticleArchitectureProps> = ({ 
  frequency, 
  position = [0, 0, -15],
  mode,
  rayRef
}) => {
  const mesh = useRef<THREE.Points>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uFrequency: { value: frequency },
    uTransition: { value: 0 }, 
    uMouseDir: { value: new THREE.Vector3(0, 0, -1) }
  }), []);

  useFrame((state) => {
    if (mesh.current) {
      const mat = mesh.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.getElapsedTime();
      mat.uniforms.uFrequency.value = frequency;
      
      const target = mode === AppMode.GARDEN ? 1.0 : 0.0;
      mat.uniforms.uTransition.value = THREE.MathUtils.lerp(
        mat.uniforms.uTransition.value, 
        target, 
        0.008
      );
      
      if (rayRef) {
          mat.uniforms.uMouseDir.value.copy(rayRef.current);
      }
    }
  });

  const particles = useMemo(() => {
    // Increased count to accommodate new vegetation
    const count = 32000; 
    const positions: number[] = [];
    const colors: number[] = [];
    const randomDirs: number[] = [];
    
    // Colors based on the image
    const cBrickRed = new THREE.Color('#8a4b38'); // Terracotta/Brick
    const cStoneGrey = new THREE.Color('#d4d4d4'); // White/Grey Stone
    const cDarkVoid = new THREE.Color('#0a0505'); // Dark windows/shadows
    const cBushDark = new THREE.Color('#1a3320'); // Dark Foliage
    const cBushLight = new THREE.Color('#3d5c45'); // Lighter Foliage
    
    const addPoint = (x: number, y: number, z: number, color: THREE.Color) => {
      positions.push(x + (Math.random()-0.5)*0.05, y + (Math.random()-0.5)*0.05, z + (Math.random()-0.5)*0.05);
      
      const variance = (Math.random() - 0.5) * 0.1;
      colors.push(color.r + variance, color.g + variance, color.b + variance);
      
      // Random direction for explosion
      const rx = (Math.random() - 0.5);
      const ry = (Math.random() - 0.5);
      const rz = (Math.random() - 0.5);
      randomDirs.push(rx, ry, rz);
    };

    // --- PROCEDURAL GENERATION OF FACADE ---
    // 1. Main Wall Plane (Brick)
    for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * 14;
        const y = Math.random() * 9; // Base height
        const z = 0;
        
        const inDoor = Math.abs(x) < 2 && y < 3.5;
        const inWindow = Math.abs(x) < 1.5 && y > 4.5 && y < 7.5;
        const inNicheL = x > -5 && x < -3 && y < 3.5;
        const inNicheR = x > 3 && x < 5 && y < 3.5;

        if (!inDoor && !inWindow && !inNicheL && !inNicheR) {
            addPoint(x, y, z, cBrickRed);
        } else {
            if (Math.random() > 0.8) addPoint(x, y, z - 0.5, cDarkVoid);
        }
    }

    // 2. Columns (4 Doric-style pilasters) (Stone)
    const colX = [-5.5, -2.5, 2.5, 5.5];
    colX.forEach(cx => {
        for (let i = 0; i < 1500; i++) {
            const h = Math.random() * 8.5; // Column height
            const angle = Math.random() * Math.PI; // Half cylinder facing forward
            const r = 0.6;
            const x = cx + Math.cos(angle) * r;
            const z = Math.sin(angle) * r; // Protrude forward
            const y = h;
            addPoint(x, y, z, cStoneGrey);
        }
        for (let i = 0; i < 200; i++) {
             const x = cx + (Math.random()-0.5) * 1.6;
             const y = 8.5 + Math.random() * 0.5;
             const z = 0.6;
             addPoint(x, y, z, cStoneGrey);
        }
    });

    // 3. Pediment (Triangle Roof) (Brick with Stone trim)
    for (let i = 0; i < 4000; i++) {
        const x = (Math.random() - 0.5) * 15;
        const yBase = 9.0;
        const yApex = 13.5;
        const maxY = -0.6 * Math.abs(x) + yApex;
        const y = yBase + Math.random() * (maxY - yBase);
        
        if (y < maxY && y >= yBase) {
             const distToEdge = Math.min(Math.abs(y - yBase), Math.abs(y - maxY));
             const isTrim = distToEdge < 0.4;
             const isCrest = Math.abs(x) < 1 && y > 10.5 && y < 12;
             
             if (isCrest) addPoint(x, y, 0.5, cStoneGrey);
             else if (isTrim) addPoint(x, y, 0.2, cStoneGrey);
             else addPoint(x, y, 0, cBrickRed);
        }
    }
    
    // 4. Horizontal Cornice/Entablature (Stone)
    for (let i = 0; i < 1500; i++) {
        const x = (Math.random() - 0.5) * 15;
        const y = 8.5 + Math.random() * 0.5;
        const z = 0.7; // Sticks out most
        addPoint(x, y, z, cStoneGrey);
    }
    
    // 5. Stairs/Base
    for (let i = 0; i < 2000; i++) {
        const x = (Math.random() - 0.5) * 16;
        const y = -Math.random() * 1.5; // Downwards
        const z = Math.random() * 3; // Steps forward
        addPoint(x, y, z, cStoneGrey);
    }
    
    // 6. Side Vegetation
    for (let i = 0; i < 6000; i++) {
        const isRight = Math.random() > 0.5;
        const xBase = isRight ? 9 : -9;
        const x = xBase + (Math.random() - 0.5) * 6;
        const z = (Math.random() - 0.5) * 5; 
        const distFromCenter = Math.sqrt(Math.pow(x - xBase, 2) + Math.pow(z, 2));
        const maxHeight = Math.max(0, 3.5 - distFromCenter * 0.8);
        const y = Math.random() * maxHeight;
        
        if (y > 0.1) {
            const col = Math.random() > 0.6 ? cBushLight : cBushDark;
            addPoint(x, y, z + 1.0, col);
        }
    }

    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
      randomDirs: new Float32Array(randomDirs)
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
          attach="attributes-aColor"
          count={particles.colors.length / 3}
          array={particles.colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandomDir"
          count={particles.randomDirs.length / 3}
          array={particles.randomDirs}
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
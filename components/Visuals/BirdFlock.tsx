import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  uniform float uTime;
  
  attribute vec3 aBirdCenter; // The "home" center for this bird's flight path
  attribute vec3 aRandom;     // x: speed, y: phase, z: radius
  attribute float aWing;      // 0.0 = body, 1.0 = wing
  
  varying float vAlpha;

  void main() {
    vec3 localPos = position;
    
    // --- FLIGHT ANIMATION ---
    float speed = 0.3 + aRandom.x * 0.4;
    float t = uTime * speed + aRandom.y * 10.0;
    
    // Calculate bird's position in world space
    // Figure-8ish path around its center
    vec3 pathOffset = vec3(0.0);
    float radius = 5.0 + aRandom.z * 5.0;
    
    pathOffset.x = sin(t) * radius;
    pathOffset.z = cos(t * 0.7) * (radius * 0.8);
    pathOffset.y = sin(t * 1.3) * 2.0 + cos(t * 0.5) * 1.0;
    
    // Orientation Logic: Bird should face direction of movement
    // Derivative of position approx:
    vec3 vel = vec3(
       cos(t) * radius,
       0.0,
       -sin(t * 0.7) * 0.56 * radius 
    );
    float angleY = atan(vel.x, vel.z);
    
    // Rotate the local particles to face movement
    float c = cos(angleY);
    float s = sin(angleY);
    mat3 rotMat = mat3(
      c, 0.0, s,
      0.0, 1.0, 0.0,
      -s, 0.0, c
    );
    
    // --- WING FLAPPING ---
    if (aWing > 0.5) {
      // Flap speed
      float flapFreq = 10.0 + aRandom.x * 5.0;
      float flap = sin(t * flapFreq);
      
      // Flap motion: wings move up/down
      localPos.y += flap * (abs(localPos.x) * 0.5);
      // Wings tuck in slightly on upstroke
      localPos.x *= 1.0 - (flap * 0.1);
    }
    
    // Combine: Home + Path + Rotation(Local + Animation)
    vec3 finalPos = aBirdCenter + pathOffset + (rotMat * localPos);

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation - Reduced from 35.0 to 25.0 for finer particles
    gl_PointSize = 25.0 / -mvPosition.z;
    
    // Fade out based on distance to keep focus on center
    float dist = length(finalPos);
    vAlpha = smoothstep(60.0, 20.0, dist);
  }
`;

const fragmentShader = `
  varying float vAlpha;

  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    // Color: Teal/Cyan to match interactive birds
    vec3 color = vec3(0.3, 0.9, 0.8);
    
    // Soft particle
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);
    
    gl_FragColor = vec4(color, vAlpha * glow * 0.5);
  }
`;

interface BirdFlockProps {
  count?: number; // Number of birds
}

export const BirdFlock: React.FC<BirdFlockProps> = ({ count = 25 }) => {
  const mesh = useRef<THREE.Points>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame((state) => {
    if (mesh.current) {
      const mat = mesh.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  const particles = useMemo(() => {
    const pointsPerBird = 150; 
    const totalPoints = count * pointsPerBird;
    
    const positions = new Float32Array(totalPoints * 3);
    const birdCenters = new Float32Array(totalPoints * 3);
    const randoms = new Float32Array(totalPoints * 3);
    const wings = new Float32Array(totalPoints);
    
    // Global Scale Down for background birds
    const birdScale = 0.35; 

    for (let b = 0; b < count; b++) {
      // Each bird has a random "home" area in the sky
      const cx = (Math.random() - 0.5) * 40;
      const cy = 5 + Math.random() * 10; 
      const cz = (Math.random() - 0.5) * 30;
      
      const rSpeed = Math.random();
      const rPhase = Math.random();
      const rRadius = Math.random();

      for (let p = 0; p < pointsPerBird; p++) {
        const i = b * pointsPerBird + p;
        
        const r = Math.random();
        
        let lx, ly, lz;
        let isWing = 0.0;

        if (r < 0.3) {
            // Body
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const br = 0.15 * Math.cbrt(Math.random()); 
            
            lx = br * 0.6 * Math.sin(phi) * Math.cos(theta); 
            ly = br * 0.6 * Math.sin(phi) * Math.sin(theta); 
            lz = br * 2.5 * Math.cos(phi); 
        } else {
            // Wings
            isWing = 1.0;
            const wingSide = Math.random() > 0.5 ? 1 : -1;
            const span = Math.random(); 
            
            lx = (0.1 + span * 1.0) * wingSide;
            ly = Math.cos(span * Math.PI * 0.5) * 0.15 - 0.05;
            lz = Math.abs(lx) * 0.4 - 0.1 + (Math.random() * 0.1); 
        }

        // Apply scale
        positions[i*3] = lx * birdScale;
        positions[i*3+1] = ly * birdScale;
        positions[i*3+2] = lz * birdScale;

        birdCenters[i*3] = cx;
        birdCenters[i*3+1] = cy;
        birdCenters[i*3+2] = cz;
        
        randoms[i*3] = rSpeed;
        randoms[i*3+1] = rPhase;
        randoms[i*3+2] = rRadius;
        
        wings[i] = isWing;
      }
    }

    return {
      positions,
      birdCenters,
      randoms,
      wings
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
          attach="attributes-aBirdCenter"
          count={particles.birdCenters.length / 3}
          array={particles.birdCenters}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={particles.randoms.length / 3}
          array={particles.randoms}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aWing"
          count={particles.wings.length}
          array={particles.wings}
          itemSize={1}
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
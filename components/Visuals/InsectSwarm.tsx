import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  uniform float uTime;
  uniform float uOpacity;
  
  attribute float aSpeed;
  attribute float aPhase; 
  attribute vec3 aColor;
  
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec3 pos = position;
    
    // --- FLIGHT LOGIC ---
    // 1. Large slow drift (Meandering)
    float driftSpeed = uTime * 0.2 * aSpeed;
    pos.x += sin(driftSpeed + aPhase) * 1.5;
    pos.z += cos(driftSpeed * 0.8 + aPhase) * 1.5;
    
    // 2. Vertical Bobbing (Hovering) - Adjusted for lower altitude
    pos.y += sin(uTime * 2.0 + aPhase) * 0.2; // Reduced bobbing amplitude

    // 3. High Frequency Jitter (Buzzing insect feel)
    float buzz = uTime * 15.0;
    pos.x += sin(buzz) * 0.05;
    pos.y += cos(buzz * 0.9) * 0.05;
    pos.z += sin(buzz * 1.1) * 0.05;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    gl_PointSize = (20.0 + aSpeed * 10.0) / -mvPosition.z;
    
    vAlpha = uOpacity;
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    // Intense core glow
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 0.8); // Sharp glow

    gl_FragColor = vec4(vColor, vAlpha * glow);
  }
`;

interface InsectSwarmProps {
  active: boolean;
  count?: number;
}

export const InsectSwarm: React.FC<InsectSwarmProps> = ({ active, count = 120 }) => {
  const mesh = useRef<THREE.Points>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uOpacity: { value: 0 },
  }), []);

  useFrame((state) => {
    if (mesh.current) {
      const mat = mesh.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.getElapsedTime();
      
      const targetOpacity = active ? 1.0 : 0.0;
      mat.uniforms.uOpacity.value = THREE.MathUtils.lerp(
        mat.uniforms.uOpacity.value,
        targetOpacity,
        0.05 // Quick fade in/out for insects
      );
    }
  });

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    // Colors: Fluorescent Yellow & Red
    const cYellow = new THREE.Color('#CCFF00'); // Fluorescent Lime/Yellow
    const cRed = new THREE.Color('#FF2222');    // Bright Red

    for (let i = 0; i < count; i++) {
      // Low altitude distribution: Strictly ground level (0 to 1.5)
      const r = 4 + Math.random() * 20; // Spread out
      const theta = Math.random() * Math.PI * 2;
      
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = Math.random() * 1.5; // significantly lower than leaves

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      speeds[i] = 0.5 + Math.random() * 1.5; 
      phases[i] = Math.random() * Math.PI * 2;

      // 30% Red, 70% Yellow mix
      const color = Math.random() > 0.7 ? cRed : cYellow;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    return { positions, speeds, phases, colors };
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
          attach="attributes-aSpeed"
          count={particles.speeds.length}
          array={particles.speeds}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aPhase"
          count={particles.phases.length}
          array={particles.phases}
          itemSize={1}
        />
         <bufferAttribute
          attach="attributes-aColor"
          count={particles.colors.length / 3}
          array={particles.colors}
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
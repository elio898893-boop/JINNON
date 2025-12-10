import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  uniform float uTime;
  uniform float uHeight;
  uniform float uOpacity;
  
  attribute float aSpeed;
  attribute float aOffset; // For sway phase
  attribute vec3 aColor;   // Pre-assigned color
  
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec3 pos = position;
    
    // Fall animation
    float fallSpeed = aSpeed * 0.5; // Leaves fall slower than rain
    float fallOffset = uTime * fallSpeed;
    
    // Calculate current Y based on time loop
    // Start high, fall down
    float currentY = pos.y - fallOffset;
    pos.y = mod(currentY, uHeight) - 2.0; // Wrap range
    
    // --- DRIFT / SWAY LOGIC ---
    // Leaves flutter back and forth
    float swayFreq = 1.5;
    float swayAmp = 0.5;
    
    pos.x += sin(uTime * swayFreq + aOffset) * swayAmp;
    pos.z += cos(uTime * (swayFreq * 0.8) + aOffset) * swayAmp;
    
    // Spiral effect downwards
    pos.x += cos(pos.y * 0.5 + uTime) * 0.2;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    gl_PointSize = (25.0 + aOffset * 10.0) / -mvPosition.z;
    
    // Fade out near ground (-2.0) and top (uHeight - 2.0)
    float h = pos.y + 2.0; 
    float borderFade = smoothstep(0.0, 1.5, h) * (1.0 - smoothstep(uHeight - 4.0, uHeight, h));
    
    vAlpha = uOpacity * borderFade;
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    // Soft particle
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);

    gl_FragColor = vec4(vColor, vAlpha * glow);
  }
`;

interface LeafParticlesProps {
  active: boolean;
  count?: number;
}

export const LeafParticles: React.FC<LeafParticlesProps> = ({ active, count = 1500 }) => {
  const mesh = useRef<THREE.Points>(null);
  
  const heightRange = 15.0; 

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHeight: { value: heightRange },
    uOpacity: { value: 0 },
  }), []);

  useFrame((state) => {
    if (mesh.current) {
      const mat = mesh.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.getElapsedTime();
      
      const targetOpacity = active ? 0.9 : 0.0;
      mat.uniforms.uOpacity.value = THREE.MathUtils.lerp(
        mat.uniforms.uOpacity.value,
        targetOpacity,
        0.03 // Slower fade than rain for gentle feel
      );
    }
  });

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    // Color Palette
    const palette = [
        new THREE.Color('#FACC15'), // Yellow
        new THREE.Color('#A3E635'), // Yellow-Green (Lime)
        new THREE.Color('#4ADE80'), // Green
        new THREE.Color('#15803D'), // Dark Green
    ];

    for (let i = 0; i < count; i++) {
      // Spread wider than rain
      const radius = 8 + Math.random() * 20;
      const angle = Math.random() * Math.PI * 2;
      
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = Math.random() * heightRange; 

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      speeds[i] = 1.0 + Math.random() * 2.0; 
      offsets[i] = Math.random() * 10.0;

      // Assign random color from palette
      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    return { positions, speeds, offsets, colors };
  }, [count, heightRange]);

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
          attach="attributes-aOffset"
          count={particles.offsets.length}
          array={particles.offsets}
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
        blending={THREE.NormalBlending} // Normal blending for richer color
      />
    </points>
  );
};
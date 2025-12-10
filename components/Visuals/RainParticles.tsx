import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  uniform float uTime;
  uniform float uHeight;
  uniform float uOpacity;
  
  attribute float aSpeed;
  attribute float aRandom;
  
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    
    // Fall animation:
    // We use the initial Y position, subtract time * speed, 
    // and use modulo to wrap it within the height range [0, uHeight].
    float fallOffset = uTime * aSpeed;
    float currentY = pos.y - fallOffset;
    
    // Wrap logic: map result to range [-5, uHeight - 5] roughly
    pos.y = mod(currentY, uHeight) - 5.0; 
    
    // Slight wind effect based on fall speed
    pos.x -= sin(uTime * 0.5) * 0.2 * aSpeed;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Particles are smaller when further away
    gl_PointSize = (15.0 + aRandom * 10.0) / -mvPosition.z;
    
    // Fade out near the bottom (ground) and top (sky) to avoid popping
    float h = pos.y + 5.0; // normalize to 0..uHeight roughly
    float borderFade = smoothstep(0.0, 2.0, h) * (1.0 - smoothstep(uHeight - 4.0, uHeight, h));
    
    vAlpha = uOpacity * borderFade * (0.5 + aRandom * 0.5);
  }
`;

const fragmentShader = `
  varying float vAlpha;

  void main() {
    // Simple circular particle
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    // Rain Color: Light Blue / Cyan
    vec3 color = vec3(0.6, 0.8, 1.0);
    
    // Soft edge glow
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 2.0);

    gl_FragColor = vec4(color, vAlpha * glow);
  }
`;

interface RainParticlesProps {
  active: boolean;
  count?: number;
}

export const RainParticles: React.FC<RainParticlesProps> = ({ active, count = 3000 }) => {
  const mesh = useRef<THREE.Points>(null);
  
  const heightRange = 25.0; // How high the rain volume is

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHeight: { value: heightRange },
    uOpacity: { value: 0 }, // Controlled by JS for fade in/out
  }), []);

  useFrame((state) => {
    if (mesh.current) {
      const mat = mesh.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.getElapsedTime();
      
      // Smooth fade transition
      const targetOpacity = active ? 0.8 : 0.0;
      mat.uniforms.uOpacity.value = THREE.MathUtils.lerp(
        mat.uniforms.uOpacity.value,
        targetOpacity,
        0.05
      );
    }
  });

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const randoms = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spread evenly in X/Z, but random Y
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      const y = Math.random() * heightRange - 5.0; 

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      // Fall speed: some drops faster than others
      speeds[i] = 5.0 + Math.random() * 8.0; 
      
      randoms[i] = Math.random();
    }

    return { positions, speeds, randoms };
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
          attach="attributes-aRandom"
          count={particles.randoms.length}
          array={particles.randoms}
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
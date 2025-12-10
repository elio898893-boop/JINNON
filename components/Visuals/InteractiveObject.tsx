import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { AppMode, InteractionType } from '../../types';

// --- SHADERS FOR INTERACTIVE PARTICLES (BIRDS ONLY NOW) ---
const vertexShader = `
  uniform float uTime;
  uniform float uScale;
  uniform float uTransition; // 0 (chaos) -> 1 (order)
  
  attribute vec3 aRandom; // Random direction for chaos
  
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    
    // --- TRANSITION LOGIC ---
    // Chaos: Particles explode outwards
    vec3 chaosPos = pos + aRandom * 8.0; // Scatter range
    
    // Lerp between chaos and order
    vec3 finalPos = mix(chaosPos, pos, uTransition);

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    gl_PointSize = (40.0 * uScale) / -mvPosition.z;
    
    // Fade in alpha as they assemble
    vAlpha = smoothstep(0.0, 0.5, uTransition);
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  
  varying float vAlpha;

  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    // Soft particle
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);

    gl_FragColor = vec4(uColor, uOpacity * vAlpha * glow);
  }
`;

interface InteractiveObjectProps {
  position: [number, number, number];
  type: InteractionType;
  isPlaying: boolean;
  onToggle: () => void;
  label: string;
  scale?: number;
  mode: AppMode;
  isUIHidden?: boolean; // New prop to hide overlays
}

export const InteractiveObject: React.FC<InteractiveObjectProps> = ({ 
  position, 
  type, 
  isPlaying,
  onToggle,
  label,
  scale = 1.0,
  mode,
  isUIHidden = false
}) => {
  const group = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const [hovered, setHover] = useState(false);
  
  const handleClick = () => {
    if (!isUIHidden) {
      onToggle();
    }
  };

  // Only BIRDS are rendered as living particle systems now
  const isLiving = type === 'BIRD';

  // --- UNIFORMS & ANIMATION ---
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uTransition: { value: 0 },
    uColor: { value: new THREE.Color('#a8d8b9') },
    uScale: { value: scale },
    uOpacity: { value: 0.8 }
  }), [scale]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // 1. Group Movement (Float/Rotate)
    if (group.current) {
      // Float animation
      const floatAmp = (mode === AppMode.GARDEN) ? (isPlaying ? 0.2 : 0.1) : 0.05;
      const targetY = position[1] + Math.sin(t + position[0]) * floatAmp;
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, targetY, 0.1);
      
      // Rotations - Living things rotate more naturally
      if (isLiving) {
         group.current.rotation.z = Math.sin(t * 2) * 0.05;
         group.current.rotation.y = Math.sin(t * 0.5) * 0.2; 
      }
    }

    // 2. Shader Updates (Living particles)
    if (isLiving && pointsRef.current) {
      const mat = pointsRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = t;

      const targetTransition = mode === AppMode.GARDEN ? 1.0 : 0.0;
      mat.uniforms.uTransition.value = THREE.MathUtils.lerp(
        mat.uniforms.uTransition.value, 
        targetTransition, 
        0.015
      );

      // Color Logic
      const baseColor = new THREE.Color("#a8d8b9");
      const activeColor = new THREE.Color("#5eead4"); // Teal for Birds
      
      const targetColor = isPlaying 
        ? activeColor
        : (hovered ? new THREE.Color("#ffffff") : baseColor);
      
      mat.uniforms.uColor.value.lerp(targetColor, 0.1);
      mat.uniforms.uOpacity.value = isPlaying ? 1.0 : 0.8;
    }
  });

  // --- PARTICLE GENERATION ---
  const particleCount = type === 'BIRD' ? 400 : 0; 
  const particleData = useMemo(() => {
    if (!isLiving) return { positions: new Float32Array(0), randoms: new Float32Array(0) };

    const positions = new Float32Array(particleCount * 3);
    const randoms = new Float32Array(particleCount * 3);

    for(let i=0; i<particleCount; i++) {
        const r = Math.random();
        let x, y, z;

        if (type === 'BIRD') {
            // Bird Shape
            if (r < 0.25) { // Body
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const br = 0.15 * Math.cbrt(Math.random()); 
                x = br * 0.6 * Math.sin(phi) * Math.cos(theta); 
                y = br * 0.6 * Math.sin(phi) * Math.sin(theta); 
                z = br * 2.5 * Math.cos(phi); 
            } else { // Wings
                const wingSide = Math.random() > 0.5 ? 1 : -1;
                const span = Math.random(); 
                x = (0.1 + span * 1.2) * wingSide;
                y = Math.cos(span * Math.PI * 0.5) * 0.2 - 0.1;
                z = Math.abs(x) * 0.5 - 0.2 + (Math.random() * 0.1); 
                const scatter = 0.05;
                x += (Math.random() - 0.5) * scatter;
                y += (Math.random() - 0.5) * scatter;
                z += (Math.random() - 0.5) * scatter;
            }
        } 

        positions[i*3] = x;
        positions[i*3+1] = y;
        positions[i*3+2] = z;
        
        randoms[i*3] = (Math.random() - 0.5);
        randoms[i*3+1] = (Math.random() - 0.5);
        randoms[i*3+2] = (Math.random() - 0.5);
    }
    return { positions, randoms };
  }, [type, particleCount, isLiving]);


  const isGardenActive = mode === AppMode.GARDEN;
  const showIcon = !isLiving; // WIND, LEAVES, WATER, RAIN, INSECT

  // Icon mapping
  const renderIcon = () => {
    switch(type) {
        case 'WIND': return (
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-colors duration-300 ${isPlaying ? 'text-emerald-300' : 'text-neutral-400 group-hover:text-emerald-200'}`}>
                <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
             </svg>
        );
        case 'LEAVES': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-colors duration-300 ${isPlaying ? 'text-emerald-300' : 'text-neutral-400 group-hover:text-emerald-200'}`}>
               <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
            </svg>
        );
        case 'WATER': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-colors duration-300 ${isPlaying ? 'text-cyan-300' : 'text-neutral-400 group-hover:text-cyan-200'}`}>
               <path d="M2 12h20"/><path d="M2 16h20"/><path d="M2 8h20"/><path d="M2 12c5.523 0 10 4.477 10 10"/><path d="M2 12c5.523 0 10-4.477 10-10"/><path d="M22 12c-5.523 0-10 4.477-10 10"/><path d="M22 12c-5.523 0-10-4.477-10-10"/>
            </svg>
        );
        case 'RAIN': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-colors duration-300 ${isPlaying ? 'text-blue-300' : 'text-neutral-400 group-hover:text-blue-200'}`}>
               <path d="M8 19v2"/><path d="M8 13v2"/><path d="M16 19v2"/><path d="M16 13v2"/><path d="M12 21v2"/><path d="M12 15v2"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>
            </svg>
        );
        case 'INSECT': return (
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-colors duration-300 ${isPlaying ? 'text-lime-300' : 'text-neutral-400 group-hover:text-lime-200'}`}>
                <path d="M8 11V6a4 4 0 0 1 8 0v5" /> 
                <path d="M12 22a6 6 0 0 1-6-6V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7a6 6 0 0 1-6 6z" />
                <path d="M18 11h2" /><path d="M4 11h2" />
                <path d="M18 16h2" /><path d="M4 16h2" />
            </svg>
        );
        default: return null;
    }
  }

  // Determine styling based on type
  const activeGlowClass = (() => {
    if (type === 'WATER') return 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.4)]';
    if (type === 'RAIN') return 'border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.4)]';
    if (type === 'INSECT') return 'border-lime-400 shadow-[0_0_30px_rgba(163,230,53,0.4)]';
    return 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)]';
  })();
    
  const activePingClass = (() => {
    if (type === 'WATER') return 'border-cyan-500/30';
    if (type === 'RAIN') return 'border-blue-500/30';
    if (type === 'INSECT') return 'border-lime-500/30';
    return 'border-emerald-500/30';
  })();

  // Background hover colors
  const hoverClass = (() => {
    if (type === 'INSECT') return 'hover:border-lime-500/50 hover:bg-black/60';
    if (type === 'WATER') return 'hover:border-cyan-500/50 hover:bg-black/60';
    if (type === 'RAIN') return 'hover:border-blue-500/50 hover:bg-black/60';
    return 'hover:border-emerald-500/50 hover:bg-black/60';
  })();

  return (
    <group 
      ref={group} 
      position={position} 
      onClick={isLiving ? (e) => { e.stopPropagation(); handleClick(); } : undefined}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* 1. LIVING (Bird Only): Particles */}
      {isLiving && (
        <>
            <points ref={pointsRef}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={particleCount}
                        array={particleData.positions}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-aRandom"
                        count={particleCount}
                        array={particleData.randoms}
                        itemSize={3}
                    />
                </bufferGeometry>
                <shaderMaterial
                    vertexShader={vertexShader}
                    fragmentShader={fragmentShader}
                    uniforms={uniforms}
                    transparent
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </points>
            
            {/* Hit Area */}
            {isGardenActive && !isUIHidden && (
              <mesh visible={false}>
                  <sphereGeometry args={[1.2 * scale, 8, 8]} />
                  <meshBasicMaterial transparent opacity={0} />
              </mesh>
            )}
        </>
      )}

      {/* 2. ICON (Wind/Leaves/Water/Rain/Insect): HTML Overlay - HIDDEN WHEN MODAL OPEN */}
      {showIcon && !isUIHidden && (
        <Html 
          position={[0, 0, 0]} 
          center 
          distanceFactor={15} 
          style={{ pointerEvents: 'auto' }}
        >
            <div 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    handleClick(); 
                }}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                className={`
                    group relative flex items-center justify-center w-12 h-12 rounded-full border 
                    backdrop-blur-md transition-all duration-1000 ease-out cursor-pointer overflow-hidden
                    ${isGardenActive ? 'opacity-100 delay-[2500ms]' : 'opacity-0 scale-50 pointer-events-none'}
                    ${isPlaying 
                        ? `bg-black/60 ${activeGlowClass} scale-110` 
                        : `bg-black/40 border-white/10 hover:scale-105 ${hoverClass}`
                    }
                `}
            >
                {renderIcon()}

                {isPlaying && (
                    <div className={`absolute inset-0 rounded-full border ${activePingClass} animate-ping`} />
                )}
            </div>
        </Html>
      )}

      {/* Label - ALSO HIDDEN WHEN MODAL OPEN */}
      {!isUIHidden && (
          <Html 
            position={[0, showIcon ? 0.8 : (0.8 * scale), 0]} 
            center 
            distanceFactor={10} 
            style={{ pointerEvents: 'none' }}
            zIndexRange={[0, 0]}
          >
            <div 
                className={`
                    transition-all duration-700 ease-out flex flex-col items-center
                    ${isGardenActive ? 'delay-[2800ms]' : 'opacity-0'} 
                    ${(hovered || isPlaying) && isGardenActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                `}
            >
               <div className={`w-px h-8 bg-gradient-to-b from-transparent ${isPlaying ? 'via-teal-200/80 to-teal-100' : 'via-emerald-200/50 to-emerald-100'} mb-2`}></div>
               <span className={`text-[9px] tracking-[0.3em] uppercase font-serif whitespace-nowrap bg-black/60 backdrop-blur-md px-4 py-2 border rounded-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-colors duration-500
                 ${isPlaying ? 'text-teal-50 border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.4)]' : 'text-emerald-50 border-white/5'}
               `}>
                {isPlaying ? 'Playing' : label}
              </span>
            </div>
          </Html>
      )}
    </group>
  );
};
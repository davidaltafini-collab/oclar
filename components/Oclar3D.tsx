import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, useGLTF } from '@react-three/drei';

type ModelProps = {
  url: string;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  intensity?: number;
  floatIntensity?: number;
  floatSpeed?: number;
  dragSensitivity?: number;
  isDraggingRef: React.MutableRefObject<boolean>;
  externalRotationY: React.MutableRefObject<number>;
  onLoaded?: () => void;
};

function Model({
  url,
  autoRotate = true,
  autoRotateSpeed = 0.006,
  intensity = 0.18,
  floatIntensity = 0.08,
  floatSpeed = 0.8,
  dragSensitivity = 0.005,
  isDraggingRef,
  externalRotationY,
  onLoaded
}: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { gl } = useThree();
  
  const [hasLoaded, setHasLoaded] = useState(false);
  const animationProgress = useRef(0);

  // Setup fundal transparent
  useEffect(() => {
    gl.setClearColor(0x000000, 0);
  }, [gl]);

  // Setup Materiale
  useEffect(() => {
    cloned.traverse((obj: any) => {
      if (obj?.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material?.map) obj.material.map.colorSpace = THREE.SRGBColorSpace;
      }
    });
    
    setTimeout(() => {
      setHasLoaded(true);
      onLoaded?.();
    }, 100);
  }, [cloned, onLoaded]);

  useFrame(({ mouse, clock }) => {
    if (!group.current) return;

    // Animație de intrare (slide up + fade in)
    if (!hasLoaded || animationProgress.current < 1) {
      animationProgress.current = Math.min(animationProgress.current + 0.025, 1);
      
      const eased = 1 - Math.pow(1 - animationProgress.current, 3);
      
      const startY = -2;
      const targetFloatY = 0;
      
      group.current.position.y = THREE.MathUtils.lerp(startY, targetFloatY, eased);
      
      // Fade in
      group.current.traverse((obj: any) => {
        if (obj?.isMesh && obj.material) {
          obj.material.transparent = true;
          obj.material.opacity = eased;
        }
      });
      
      return;
    }

    // 1. Floating Effect
    const t = clock.getElapsedTime();
    const floatY = Math.sin(t * floatSpeed) * floatIntensity;
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.08);

    // 2. Mouse Tilt
    if (!isDraggingRef.current) {
      const targetX = mouse.y * intensity;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x, 
        targetX, 
        0.06
      );
    } else {
       group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.2);
    }

    // 3. Rotație
    if (autoRotate && !isDraggingRef.current) {
      externalRotationY.current += autoRotateSpeed;
    }
    
    group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y, 
        externalRotationY.current, 
        0.15
    );
  });

  return (
    <group ref={group}>
      <primitive object={cloned} />
    </group>
  );
}

function Loader() {
  return null;
}

export const Oclar3D: React.FC<{
  url?: string;
  className?: string;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  intensity?: number;
  floatIntensity?: number;
  floatSpeed?: number;
  dragSensitivity?: number;
}> = ({
  url = '/models/oclar.glb',
  className = '',
  autoRotate = true,
  autoRotateSpeed = 0.006,
  intensity = 0.18,
  floatIntensity = 0.08,
  floatSpeed = 0.8,
  dragSensitivity = 0.005,
}) => {
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0 });
  const externalRotationY = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastPosRef.current = { x: e.clientX };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    
    const deltaX = e.clientX - lastPosRef.current.x;
    externalRotationY.current += deltaX * (dragSensitivity || 0.005);
    lastPosRef.current = { x: e.clientX };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className={`relative ${className}`}
      style={{
        touchAction: 'pan-y',
        cursor: isDraggingRef.current ? 'grabbing' : 'grab',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ 
          antialias: true, 
          alpha: true, 
          powerPreference: 'high-performance',
        }}
        camera={{ fov: 45, near: 0.1, far: 2000, position: [0, 0, 3.5] }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} castShadow />
        <directionalLight position={[-6, 3, -2]} intensity={0.8} />

        <Suspense fallback={<Loader />}>
          <Environment preset="city" />
          <Model
            url={url}
            autoRotate={autoRotate}
            autoRotateSpeed={autoRotateSpeed}
            intensity={intensity}
            floatIntensity={floatIntensity}
            floatSpeed={floatSpeed}
            dragSensitivity={dragSensitivity}
            isDraggingRef={isDraggingRef}
            externalRotationY={externalRotationY}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');
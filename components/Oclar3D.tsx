import React, { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Html, useGLTF, useEnvironment } from '@react-three/drei';

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
};

function Model({
  url,
  autoRotate = true,
  autoRotateSpeed = 0.006,
  intensity = 0.18,
  floatIntensity = 0.08,
  floatSpeed = 0.8,
  isDraggingRef,
  externalRotationY
}: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  
  // Încărcăm textura de mediu separat pentru a o injecta manual în materiale
  const envMap = useEnvironment({ preset: 'city' });
  
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((obj: any) => {
      if (obj?.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          // FIX CORE: Injectăm mediul și oprim scrierea în depth buffer pentru a evita negrul
          obj.material.envMap = envMap;
          obj.material.transparent = true;
          obj.material.opacity = 0;
          obj.material.depthWrite = false; 
          obj.material.needsUpdate = true;
        }
      }
    });
    return c;
  }, [scene, envMap]);

  const appear = useRef(0);

  useLayoutEffect(() => {
    if (group.current) {
      group.current.position.y = -0.3;
    }
  }, []);

  useFrame(({ mouse, clock }) => {
    if (!group.current) return;

    // 1. Appear Animation (Slide + Fade)
    if (appear.current < 1) {
      appear.current = THREE.MathUtils.lerp(appear.current, 1, 0.06);
      group.current.position.y = THREE.MathUtils.lerp(-0.3, 0, appear.current);

      cloned.traverse((obj: any) => {
        if (obj?.isMesh && obj.material) {
          obj.material.opacity = appear.current;
          
          // Când e aproape gata, activăm depthWrite înapoi pentru randare corectă
          if (appear.current > 0.95) {
            obj.material.depthWrite = true;
            obj.material.transparent = false;
          }
        }
      });
    }

    // 2. Floating Effect
    const t = clock.getElapsedTime();
    if (appear.current > 0.95) {
      const floatY = Math.sin(t * floatSpeed) * floatIntensity;
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.08);
    }

    // 3. Mouse Tilt
    if (!isDraggingRef.current) {
      const targetX = mouse.y * intensity;
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.06);
    } else {
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.2);
    }

    // 4. Rotation Logic
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
  return (
    <Html center>
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 border-4 border-neutral-200 border-t-brand-yellow rounded-full animate-spin" />
      </div>
    </Html>
  );
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
      style={{ touchAction: 'pan-y', cursor: 'grab' }}
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
            outputColorSpace: THREE.SRGBColorSpace 
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
            isDraggingRef={isDraggingRef}
            externalRotationY={externalRotationY}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');
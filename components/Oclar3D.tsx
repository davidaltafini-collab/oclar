import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
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
  ready: boolean;
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
  ready
}: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // 🔹 progres animatie intrare (0 → 1)
  const appearProgress = useRef(0);

  // === MATERIAL SETUP (pastrat + fake poster + fade) ===
  useEffect(() => {
    cloned.traverse((obj: any) => {
      if (obj?.isMesh && obj.material) {
        obj.castShadow = true;
        obj.receiveShadow = true;

        if (obj.material.map) {
          obj.material.map.colorSpace = THREE.SRGBColorSpace;
        }

        // fake poster: fara reflexii initial
        obj.material.envMapIntensity = ready ? 1 : 0;

        // fade initial
        obj.material.transparent = true;
        obj.material.opacity = ready ? 0 : 0;
        obj.material.needsUpdate = true;
      }
    });

    // pozitie initiala (jos)
    if (group.current && !ready) {
      group.current.position.y = -0.35;
    }
  }, [cloned, ready]);

  useFrame(({ mouse, clock }) => {
    if (!group.current) return;

    // === ENTRY ANIMATION (o singura data) ===
    if (ready && appearProgress.current < 1) {
      appearProgress.current = THREE.MathUtils.lerp(
        appearProgress.current,
        1,
        0.08
      );

      // slide up
      group.current.position.y = THREE.MathUtils.lerp(
        -0.35,
        0,
        appearProgress.current
      );

      // fade-in material
      cloned.traverse((obj: any) => {
        if (obj?.isMesh && obj.material) {
          obj.material.opacity = appearProgress.current;
        }
      });
    }

    // dupa ce animatia s-a terminat, revenim la materiale solide
    if (appearProgress.current >= 0.99) {
      cloned.traverse((obj: any) => {
        if (obj?.isMesh && obj.material) {
          obj.material.transparent = false;
          obj.material.opacity = 1;
        }
      });
    }

    // === FLOATING (pastrat identic) ===
    const t = clock.getElapsedTime();
    const floatY = Math.sin(t * floatSpeed) * floatIntensity;
    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      floatY,
      0.08
    );

    // === MOUSE TILT (pastrat identic) ===
    if (!isDraggingRef.current) {
      const targetX = mouse.y * intensity;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        targetX,
        0.06
      );
    } else {
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        0,
        0.2
      );
    }

    // === ROTATIE AUTO + MANUAL (pastrat) ===
    if (autoRotate && !isDraggingRef.current && ready) {
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

  const [ready, setReady] = useState(false);

  // 🔹 idle + fallback Safari
  useEffect(() => {
    let id: number;

    if ('requestIdleCallback' in window) {
      id = (window as any).requestIdleCallback(() => setReady(true));
      return () => (window as any).cancelIdleCallback?.(id);
    } else {
      const timeout = setTimeout(() => setReady(true), 100);
      return () => clearTimeout(timeout);
    }
  }, []);

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
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 45, near: 0.1, far: 2000, position: [0, 0, 3.5] }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} castShadow />
        <directionalLight position={[-6, 3, -2]} intensity={0.8} />

        <Suspense fallback={null}>
          {ready && <Environment preset="city" />}
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
            ready={ready}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, useGLTF } from '@react-three/drei';

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

  // progres animatie aparitie
  const appear = useRef(0);

  useEffect(() => {
    cloned.traverse((obj: any) => {
      if (obj?.isMesh && obj.material) {
        obj.castShadow = true;
        obj.receiveShadow = true;

        if (obj.material.map) {
          obj.material.map.colorSpace = THREE.SRGBColorSpace;
        }

        obj.material.transparent = true;
        obj.material.opacity = 0;
      }
    });

    if (group.current) {
      group.current.position.y = -0.3;
    }
  }, [cloned]);

  useFrame(({ mouse, clock }) => {
    if (!group.current) return;

    // === APPEAR ANIMATION ===
    if (ready && appear.current < 1) {
      appear.current = THREE.MathUtils.lerp(appear.current, 1, 0.08);

      group.current.position.y = THREE.MathUtils.lerp(
        -0.3,
        0,
        appear.current
      );

      cloned.traverse((obj: any) => {
        if (obj?.isMesh && obj.material) {
          obj.material.opacity = appear.current;
        }
      });
    }

    if (appear.current > 0.98) {
      cloned.traverse((obj: any) => {
        if (obj?.isMesh && obj.material) {
          obj.material.opacity = 1;
          obj.material.transparent = false;
        }
      });
    }

    // === FLOATING ===
    const t = clock.getElapsedTime();
    const floatY = Math.sin(t * floatSpeed) * floatIntensity;
    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      floatY,
      0.08
    );

    // === MOUSE TILT ===
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

    // === ROTATION ===
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

export const Oclar3D = ({
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

  useEffect(() => {
    const timeout = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(timeout);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastPosRef.current = { x: e.clientX };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    externalRotationY.current +=
      (e.clientX - lastPosRef.current.x) * dragSensitivity;
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
            ready={ready}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');

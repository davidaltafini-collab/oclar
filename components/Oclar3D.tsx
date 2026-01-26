import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  onReady: () => void;
};

function Model({
  url,
  autoRotate = true,
  autoRotateSpeed = 0.006,
  intensity = 0.18,
  floatIntensity = 0.08,
  floatSpeed = 0.8,
  isDraggingRef,
  externalRotationY,
  onReady
}: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  
  // Clonăm scena pentru a evita conflicte dacă folosim modelul în mai multe locuri
  const cloned = useMemo(() => scene.clone(true), [scene]);
  
  const appear = useRef(0);
  const [isInitialized, setIsInitialized] = useState(false);

  useLayoutEffect(() => {
    if (group.current) {
      group.current.position.y = -0.3;
      group.current.visible = false; // Îl ținem invizibil la început
    }

    cloned.traverse((obj: any) => {
      if (obj?.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;

        if (obj.material) {
          obj.material.transparent = true;
          obj.material.opacity = 0;
          // Forțăm materialul să fie pregătit
          obj.material.needsUpdate = true;
        }
      }
    });

    // Mic delay pentru a permite Environment-ului să se încarce complet în memorie
    const timer = setTimeout(() => {
      setIsInitialized(true);
      onReady();
    }, 100);

    return () => clearTimeout(timer);
  }, [cloned, onReady]);

  useFrame(({ mouse, clock }) => {
    if (!group.current || !isInitialized) return;

    // Afișăm obiectul doar după ce inițializarea e gata
    group.current.visible = true;

    // 0. Animație de apariție (Fade + Slide Up)
    if (appear.current < 1) {
      appear.current = THREE.MathUtils.lerp(appear.current, 1, 0.06);
      group.current.position.y = THREE.MathUtils.lerp(-0.3, 0, appear.current);

      cloned.traverse((obj: any) => {
        if (obj?.isMesh && obj.material) {
          obj.material.opacity = appear.current;
        }
      });

      if (appear.current > 0.98) {
        cloned.traverse((obj: any) => {
          if (obj?.isMesh && obj.material) {
            obj.material.opacity = 1;
            obj.material.transparent = false;
          }
        });
      }
    }

    // 1. Plutire (doar după ce a apărut)
    if (appear.current > 0.9) {
      const t = clock.getElapsedTime();
      const floatY = Math.sin(t * floatSpeed) * floatIntensity;
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.08);
    }

    // 2. Mouse Tilt (când nu se face drag)
    if (!isDraggingRef.current) {
      const targetX = mouse.y * intensity;
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.06);
    } else {
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
    }

    // 3. Rotație Automată + Manuală
    if (autoRotate && !isDraggingRef.current) {
      externalRotationY.current += autoRotateSpeed;
    }

    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      externalRotationY.current,
      0.1
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
  const [isLoaded, setIsLoaded] = useState(false);

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
      className={`relative transition-opacity duration-700 ease-out ${className} ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        touchAction: 'pan-y',
        cursor: 'grab',
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
          toneMapping: THREE.ACESFilmicToneMapping 
        }}
        camera={{ fov: 45, near: 0.1, far: 1000, position: [0, 0, 3.5] }}
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
            onReady={() => setIsLoaded(true)}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');
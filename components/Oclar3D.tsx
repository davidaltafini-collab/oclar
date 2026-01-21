import React, { Suspense, useEffect, useMemo, useRef } from 'react';
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
  // Refs primite de la părinte pentru control
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
  dragSensitivity = 0.005,
  isDraggingRef,
  externalRotationY
}: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  
  // Stare internă pentru tilt (înclinare pe X)
  const tiltRef = useRef(0);

  // Setup Materiale
  useEffect(() => {
    cloned.traverse((obj: any) => {
      if (obj?.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material?.map) obj.material.map.colorSpace = THREE.SRGBColorSpace;
      }
    });
  }, [cloned]);

  useFrame(({ mouse, clock }) => {
    if (!group.current) return;

    // 1. Floating Effect (Plutire sus-jos)
    const t = clock.getElapsedTime();
    const floatY = Math.sin(t * floatSpeed) * floatIntensity;
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.08);

    // 2. Mouse Tilt (doar când nu faci drag)
    if (!isDraggingRef.current) {
      // Pe mobil mouse.y e 0 de obicei, pe desktop face tilt fin
      const targetX = mouse.y * intensity;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x, 
        targetX, 
        0.06
      );
    } else {
       // Reset tilt la 0 când tragi, pentru stabilitate
       group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.2);
    }

    // 3. Rotație (Auto + Manual)
    // Dacă nu tragem, adăugăm viteza automată la valoarea noastră de referință
    if (autoRotate && !isDraggingRef.current) {
      externalRotationY.current += autoRotateSpeed;
    }
    
    // Aplicăm rotația calculată (fie de auto, fie de drag din părinte)
    // Folosim lerp pentru o oprire fină
    group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y, 
        externalRotationY.current, 
        0.15 // Factor de smoothing
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
  // Aceste refs trăiesc în afara canvas-ului pentru a păstra starea între randări
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0 });
  const externalRotationY = useRef(0); // Ținem minte rotația totală aici

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastPosRef.current = { x: e.clientX };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    // NU resetăm rotația. Continuăm de unde a rămas auto-rotate-ul.
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    
    const deltaX = e.clientX - lastPosRef.current.x;
    
    // Adăugăm diferența de mișcare la rotația totală
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
        touchAction: 'pan-y', // ESENȚIAL: Permite scroll vertical, blochează orizontal pt drag
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
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        // Am pus camera mai aproape (Z=3.5) ca să se vadă mare
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
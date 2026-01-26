import React, { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, useGLTF, useEnvironment } from '@react-three/drei';

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
  onModelReady: () => void;
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
  onModelReady
}: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const envMap = useEnvironment({ preset: 'city' });
  const [isCompiled, setIsCompiled] = useState(false);
  const appear = useRef(0);

  // 1. Pregătire Materiale (Sincronizare cu Environment)
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((obj: any) => {
      if (obj?.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          // Forțăm reflexiile și eliminăm artefactele de adâncime
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

  // 2. Verificăm când motorul a făcut prima randare (Pre-warm)
  useFrame((state) => {
    if (!group.current) return;

    // Așteptăm 2 cadre pentru ca GPU să compileze shaderele
    if (!isCompiled) {
      if (state.clock.elapsedTime > 0.1) {
        setIsCompiled(true);
        onModelReady();
      }
      return; 
    }

    // 3. Animație Apariție (Slide up + Fade)
    if (appear.current < 1) {
      appear.current = THREE.MathUtils.lerp(appear.current, 1, 0.05);
      group.current.position.y = THREE.MathUtils.lerp(-0.4, 0, appear.current);
      
      cloned.traverse((obj: any) => {
        if (obj.isMesh && obj.material) {
          obj.material.opacity = appear.current;
          if (appear.current > 0.9) obj.material.depthWrite = true;
        }
      });
    }

    // 4. Plutire (după apariție)
    const t = state.clock.getElapsedTime();
    if (appear.current > 0.8) {
      const floatY = Math.sin(t * floatSpeed) * floatIntensity;
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.08);
    }

    // 5. Mouse Tilt (doar când nu este drag)
    if (!isDraggingRef.current) {
      const targetX = state.mouse.y * intensity;
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.06);
      if (autoRotate) externalRotationY.current += autoRotateSpeed;
    } else {
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.15);
    }

    // 6. Rotație Y (Manuală + Automată)
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      externalRotationY.current,
      0.15
    );
  });

  return (
    <group ref={group} visible={isCompiled}>
      <primitive object={cloned} />
    </group>
  );
}

export const Oclar3D: React.FC<any> = ({
  url = '/models/oclar.glb',
  className = '',
  dragSensitivity = 0.005,
  ...props
}) => {
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0 });
  const externalRotationY = useRef(0);
  const [showCanvas, setShowCanvas] = useState(false);

  // Drag Handlers (Păstrate exact ca în original)
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
      className={`relative w-full h-full transition-opacity duration-1000 ${className} ${
        showCanvas ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ touchAction: 'none', cursor: 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ 
          antialias: true, 
          alpha: true, 
          powerPreference: 'high-performance',
          outputColorSpace: THREE.SRGBColorSpace // Esențial pentru culori albe corecte
        }}
        camera={{ fov: 45, position: [0, 0, 3.5] }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} castShadow />
        
        <Suspense fallback={null}>
          <Environment preset="city" />
          <Model
            url={url}
            {...props}
            isDraggingRef={isDraggingRef}
            externalRotationY={externalRotationY}
            onModelReady={() => setShowCanvas(true)}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');
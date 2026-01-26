import React, { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const cloned = useMemo(() => scene.clone(true), [scene]);
  
  const appear = useRef(0);
  const frameCount = useRef(0); // Contor pentru cadre
  const [shouldStartAnim, setShouldStartAnim] = useState(false);

  useLayoutEffect(() => {
    // 1. Pregătim modelul în stare invizibilă
    if (group.current) {
      group.current.position.y = -0.5;
      group.current.visible = false;
    }

    cloned.traverse((obj: any) => {
      if (obj?.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          obj.material.transparent = true;
          obj.material.opacity = 0;
          obj.material.needsUpdate = true;
        }
      }
    });
  }, [cloned]);

  useFrame((state) => {
    if (!group.current) return;

    // 2. Așteptăm exact 15 cadre înainte de a arăta orice
    // Asta îi dă GPU-ului timp să încarce Environment preset "city"
    if (frameCount.current < 15) {
      frameCount.current++;
      return; 
    }

    if (!shouldStartAnim) {
      setShouldStartAnim(true);
      onReady(); // Anunțăm părintele că poate face fade-in la Canvas
    }

    group.current.visible = true;

    // 3. Animația de apariție (Slide + Fade)
    if (appear.current < 1) {
      appear.current = THREE.MathUtils.lerp(appear.current, 1, 0.05);
      group.current.position.y = THREE.MathUtils.lerp(-0.5, 0, appear.current);

      cloned.traverse((obj: any) => {
        if (obj?.isMesh && obj.material) {
          obj.material.opacity = appear.current;
        }
      });

      if (appear.current > 0.98) {
        cloned.traverse((obj: any) => {
          if (obj?.isMesh && obj.material) {
            obj.material.transparent = false;
          }
        });
      }
    }

    // 4. Efect de plutire
    const t = state.clock.getElapsedTime();
    if (appear.current > 0.8) {
      const floatY = Math.sin(t * floatSpeed) * floatIntensity;
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.05);
    }

    // 5. Rotație și Tilt
    if (!isDraggingRef.current) {
      const targetX = state.mouse.y * intensity;
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.06);
      if (autoRotate) externalRotationY.current += autoRotateSpeed;
    } else {
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
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

export const Oclar3D: React.FC<any> = ({
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
  const externalRotationY = useRef(0);
  const [isReady, setIsReady] = useState(false);

  // Handlers pentru Drag
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    externalRotationY.current += e.movementX * dragSensitivity;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className={`relative w-full h-full transition-opacity duration-1000 ${className} ${
        isReady ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ touchAction: 'none', cursor: 'grab', background: 'transparent' }}
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
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace 
        }}
        camera={{ fov: 45, position: [0, 0, 3.5] }}
      >
        <ambientLight intensity={0.7} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        <Suspense fallback={null}>
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
            onReady={() => setIsReady(true)}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');
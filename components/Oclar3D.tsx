import React, { Suspense, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, useGLTF, useEnvironment } from '@react-three/drei';

type ModelProps = {
  url: string;
  autoRotateSpeed?: number;
  intensity?: number;
  floatIntensity?: number;
  floatSpeed?: number;
  isDraggingRef: React.MutableRefObject<boolean>;
  externalRotationY: React.MutableRefObject<number>;
  envTexture: THREE.Texture; // Primim textura de mediu direct
};

function Model({
  url,
  autoRotateSpeed = 0.006,
  intensity = 0.18,
  floatIntensity = 0.08,
  floatSpeed = 0.8,
  isDraggingRef,
  externalRotationY,
  envTexture
}: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const appear = useRef(0);

  // CORE FIX 1: Modificăm materialele în memorie ÎNAINTE de prima randare
  const preparedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        // Injectăm manual textura de mediu pentru a nu aștepta propagarea automată
        if (obj.material) {
          obj.material.envMap = envTexture;
          obj.material.transparent = true;
          obj.material.opacity = 0;
          obj.material.depthWrite = false; // Previne silueta neagră peste fundal
          obj.material.needsUpdate = true;
        }
      }
    });
    return cloned;
  }, [scene, envTexture]);

  useFrame((state) => {
    if (!group.current) return;

    // CORE FIX 2: Animație bazată pe delta time pentru consistență
    if (appear.current < 1) {
      appear.current = THREE.MathUtils.lerp(appear.current, 1, 0.07);
      group.current.position.y = THREE.MathUtils.lerp(-0.4, 0, appear.current);
      
      preparedScene.traverse((obj: any) => {
        if (obj.isMesh && obj.material) {
          obj.material.opacity = appear.current;
          if (appear.current > 0.95) {
            obj.material.depthWrite = true;
            // Nu scoatem transparenta complet imediat pentru a evita "snap" vizual
          }
        }
      });
    }

    // Plutire
    const t = state.clock.getElapsedTime();
    const floatY = Math.sin(t * floatSpeed) * floatIntensity;
    if (appear.current > 0.8) {
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.1);
    }

    // Rotație (identic cu logica ta, optimizată)
    if (!isDraggingRef.current) {
      const targetX = state.mouse.y * intensity;
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.06);
      externalRotationY.current += autoRotateSpeed;
    }
    
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, externalRotationY.current, 0.1);
  });

  return (
    <group ref={group}>
      <primitive object={preparedScene} />
    </group>
  );
}

// Componentă intermediară care forțează așteptarea Environment-ului
function SceneContent(props: any) {
  // CORE FIX 3: Încărcăm Environment-ul ca și textură înainte de a randa modelul
  const envTexture = useEnvironment({ preset: 'city' });

  return (
    <>
      <Environment map={envTexture} />
      <Model {...props} envTexture={envTexture} />
    </>
  );
}

export const Oclar3D: React.FC<any> = ({
  url = '/models/oclar.glb',
  className = '',
  dragSensitivity = 0.005,
  ...rest
}) => {
  const isDraggingRef = useRef(false);
  const externalRotationY = useRef(0);

  return (
    <div 
      className={`relative w-full h-full ${className}`} 
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        isDraggingRef.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (isDraggingRef.current) externalRotationY.current += e.movementX * dragSensitivity;
      }}
      onPointerUp={(e) => {
        isDraggingRef.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }}
    >
      <Canvas
        shadows
        gl={{ 
          antialias: true, 
          alpha: true, 
          powerPreference: 'high-performance',
          outputColorSpace: THREE.SRGBColorSpace 
        }}
        camera={{ fov: 45, position: [0, 0, 3.5] }}
      >
        <ambientLight intensity={0.5} />
        <Suspense fallback={null}>
          <SceneContent 
            url={url} 
            isDraggingRef={isDraggingRef} 
            externalRotationY={externalRotationY} 
            {...rest} 
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');
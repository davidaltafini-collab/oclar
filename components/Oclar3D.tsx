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
  // Adăugat prop pentru a opri rotația când nu e nevoie
  isDraggingRef: React.MutableRefObject<boolean>;
};

function FitCameraToObject({ target }: { target: THREE.Object3D }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(target);
    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    if (!sphere) return;
    const cam = camera as THREE.PerspectiveCamera;
    const fov = cam.fov * (Math.PI / 180);
    const distance = sphere.radius / Math.sin(fov / 2);
    cam.position.set(center.x, center.y, center.z + distance * 1.15);
    cam.lookAt(center);
  }, [camera, size, target]);
  return null;
}

function Model({
  url,
  autoRotate = true,
  autoRotateSpeed = 0.006,
  intensity = 0.18,
  floatIntensity = 0.08,
  floatSpeed = 0.8,
  dragSensitivity = 0.005,
  isDraggingRef
}: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  
  // Stare internă pentru rotație
  const rotationRef = useRef({ x: 0, y: 0 });

  // Material setup
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

    // 1. Floating Effect
    const t = clock.getElapsedTime();
    const floatY = Math.sin(t * floatSpeed) * floatIntensity;
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.08);

    // 2. Mouse Tilt (doar pe desktop, când nu faci drag)
    if (!isDraggingRef.current) {
      const targetX = mouse.y * intensity;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x, 
        rotationRef.current.x + targetX, 
        0.06
      );
    } else {
       // Reset tilt la drag
       group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, rotationRef.current.x, 0.2);
    }

    // 3. Auto Rotate (doar dacă nu faci drag)
    if (autoRotate && !isDraggingRef.current) {
      rotationRef.current.y += autoRotateSpeed;
    }
    
    // Aplicarea rotației calculate din drag (din componenta părinte)
    // Nota: Aici citim rotația direct din group.current.rotation.y care e modificată de evenimentele de pe Canvas
    // DAR, pentru simplitate, în varianta asta, evenimentele de drag vor modifica direct rotația grupului în părinte sau aici.
    
    // Corecție: Logică de drag e gestionată extern sau prin events pe mesh. 
    // Voi simplifica: vom lăsa Canvas-ul să gestioneze rotația prin props, dar pentru a păstra codul tău de fizică,
    // vom citi rotația "target" setată de drag handlers.
  });

  return (
    <group ref={group}>
      <primitive object={cloned} />
      <FitCameraToObject target={cloned} />
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
  const lastPosRef = useRef({ x: 0, y: 0 });
  const modelGroupRef = useRef<THREE.Group>(null); // Referință la grupul modelului pentru rotație directă

  // Handlers atașați direct pe DIV-ul container, nu pe window global
  const handlePointerDown = (e: React.PointerEvent) => {
    // Permitem scroll-ul paginii, dar capturăm intenția de interacțiune
    isDraggingRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !modelGroupRef.current) return;
    
    const deltaX = e.clientX - lastPosRef.current.x;
    // const deltaY = e.clientY - lastPosRef.current.y; // Opțional: rotație pe X

    // Rotim modelul direct
    modelGroupRef.current.rotation.y += deltaX * dragSensitivity;
    
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Wrapper component to access the scene inside Canvas
  const ModelWrapper = () => {
    const { scene } = useThree();
    // Găsim grupul modelului în scenă pentru a-l roti manual din eventurile de mai sus
    // O abordare mai curată e să folosim o referință externă, dar fiind în Canvas separat...
    
    // TRUC: Pentru a conecta eventurile HTML de logica ThreeJS fără ref global complex:
    // Folosim o componentă internă care ascultă mișcările mouse-ului doar pe canvas
    
    useFrame(() => {
        // Logică de rotație automată aplicată direct aici
        if (modelGroupRef.current && !isDraggingRef.current && autoRotate) {
             modelGroupRef.current.rotation.y += autoRotateSpeed;
        }
    });

    return (
        <group ref={modelGroupRef}>
             <Model 
                url={url} 
                autoRotate={false} // Gestionăm rotația aici sus
                intensity={intensity}
                floatIntensity={floatIntensity}
                floatSpeed={floatSpeed}
                dragSensitivity={dragSensitivity}
                isDraggingRef={isDraggingRef} // Pasăm ref-ul jos
             />
        </group>
    )
  }

  return (
    <div
      className={`relative ${className}`}
      // Important: Eliminăm height fix calculat. Lăsăm părintele să decidă.
      style={{
        touchAction: 'pan-y', // Permite scroll vertical, blochează orizontal pentru interacțiune
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
        camera={{ fov: 35, near: 0.1, far: 2000, position: [0, 0, 5] }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} castShadow />
        <directionalLight position={[-6, 3, -2]} intensity={0.55} />

        <Suspense fallback={<Loader />}>
          <Environment preset="city" />
          <ModelWrapper />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');
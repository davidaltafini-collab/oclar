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
    cam.near = distance / 100;
    cam.far = distance * 100;
    cam.aspect = size.width / size.height;
    cam.updateProjectionMatrix();
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
}: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  
  // Refs pentru rotație și drag
  const rotationRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Configurare materiale
  useEffect(() => {
    cloned.traverse((obj: any) => {
      if (obj?.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          if (obj.material.map) obj.material.map.colorSpace = THREE.SRGBColorSpace;
          obj.material.needsUpdate = true;
        }
      }
    });
  }, [cloned]);

  // LOGICA NOUĂ DE DRAG - FĂRĂ GLITCH
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      // Oprim auto-rotate temporar când userul interacționează
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      
      // Calculăm delta sincron pentru a evita "teleportarea"
      const deltaX = e.clientX - lastPosRef.current.x;
      const deltaY = e.clientY - lastPosRef.current.y;
      
      // Actualizăm rotația țintă
      rotationRef.current.y += deltaX * dragSensitivity;
      rotationRef.current.x += deltaY * dragSensitivity;
      
      // Actualizăm ultima poziție imediat
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    // Adăugăm listenerii pe window pentru a prinde drag-ul chiar dacă ieșim din canvas
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragSensitivity]);

  useFrame(({ mouse, clock }) => {
    if (!group.current) return;

    // Efect de plutire (Floating)
    const t = clock.getElapsedTime();
    const floatY = Math.sin(t * floatSpeed) * floatIntensity;
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.08);

    // Tilt pe axa X (Sus/Jos)
    if (!isDraggingRef.current) {
      // Când nu tragem, se uită ușor după mouse
      const targetX = mouse.y * intensity;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x, 
        rotationRef.current.x + targetX, 
        0.06
      );
    } else {
      // Când tragem, răspunde instant la deget
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        rotationRef.current.x,
        0.5 
      );
    }

    // Auto Rotate + Drag pe axa Y (Stânga/Dreapta)
    if (autoRotate && !isDraggingRef.current) {
      rotationRef.current.y += autoRotateSpeed;
    }
    
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      rotationRef.current.y,
      isDraggingRef.current ? 0.5 : 0.1
    );
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
      <div className="flex items-center gap-3 pointer-events-none select-none">
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
  return (
    <div
      className={`relative ${className}`} // Am scos w-full h-full obligatoriu, îl ia din className
      style={{
        touchAction: 'none', // Critic pentru mobil: previne scroll-ul paginii când rotești ochelarii
        cursor: 'grab',
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]} // Optimizare performanță pixel ratio
        gl={{ 
          antialias: true, 
          alpha: true, 
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true
        }}
        camera={{ fov: 35, near: 0.1, far: 2000, position: [0, 0, 5] }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} castShadow />
        <directionalLight position={[-6, 3, -2]} intensity={0.55} />

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
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');
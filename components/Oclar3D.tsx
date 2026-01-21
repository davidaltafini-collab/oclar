import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
  
  // Manual rotation state for drag
  const rotationRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

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

  // Handle pointer events for drag
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      
      const deltaX = e.clientX - lastPosRef.current.x;
      const deltaY = e.clientY - lastPosRef.current.y;
      
      rotationRef.current.y += deltaX * dragSensitivity;
      rotationRef.current.x += deltaY * dragSensitivity;
      
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

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

    // Floating
    const t = clock.getElapsedTime();
    const floatY = Math.sin(t * floatSpeed) * floatIntensity;
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.08);

    // Mouse reactive tilt (only when not dragging)
    if (!isDraggingRef.current) {
      const targetX = mouse.y * intensity;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x, 
        rotationRef.current.x + targetX, 
        0.06
      );
    } else {
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        rotationRef.current.x,
        0.1
      );
    }

    // Auto rotate + drag rotation
    if (autoRotate && !isDraggingRef.current) {
      rotationRef.current.y += autoRotateSpeed;
    }
    
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      rotationRef.current.y,
      isDraggingRef.current ? 0.2 : 0.1
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
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 border-4 border-neutral-200 border-t-brand-yellow rounded-full animate-spin" />
        <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Loading 3D...</span>
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
  const containerRef = useRef<HTMLDivElement>(null);
  // FIXED viewport height - calculate once and never change
  const [fixedHeight, setFixedHeight] = useState<number | null>(null);

  useEffect(() => {
    // Calculate viewport height ONCE on mount
    const vh = window.innerHeight;
    setFixedHeight(vh);
  }, []);

  if (!fixedHeight) return null; // Wait for calculation

  return (
    <div
      ref={containerRef}
      className={`w-full ${className}`}
      style={{
        height: `${fixedHeight}px`, // Use fixed pixel value, not vh
        touchAction: 'pan-y',
        cursor: 'grab',
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ 
          antialias: true, 
          alpha: true, 
          powerPreference: 'high-performance' 
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
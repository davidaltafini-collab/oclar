import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, OrbitControls, useGLTF } from '@react-three/drei';

type ModelProps = {
  url: string;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  enableOrbit?: boolean;
  intensity?: number;
  floatIntensity?: number;
  floatSpeed?: number;
  allowTouchOrbit?: boolean;
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
  enableOrbit = true,
  intensity = 0.18,
  floatIntensity = 0.08,
  floatSpeed = 0.8,
  allowTouchOrbit = true,
}: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);

  const cloned = useMemo(() => scene.clone(true), [scene]);

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

  useFrame(({ mouse, clock }) => {
    if (!group.current) return;

    const t = clock.getElapsedTime();
    const floatY = Math.sin(t * floatSpeed) * floatIntensity;
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.08);

    const targetX = mouse.y * intensity;
    const targetY = mouse.x * intensity;

    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.06);

    if (autoRotate) {
      group.current.rotation.y += autoRotateSpeed;
    }

    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, group.current.rotation.y + targetY * 0.0, 0.0);
  });

  return (
    <group ref={group}>
      <primitive object={cloned} />
      <FitCameraToObject target={cloned} />

      {enableOrbit && allowTouchOrbit && (
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          rotateSpeed={0.7}
          dampingFactor={0.08}
          enableDamping
        />
      )}
    </group>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 border-4 border-neutral-200 border-t-black rounded-full animate-spin" />
        <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Loading 3D...</span>
      </div>
    </Html>
  );
}

/**
 * SIMPLIFIED: Only activate orbit on strong horizontal swipe (3x ratio)
 * Never block vertical scroll
 */
function useTouchDirectionLock(containerRef: React.RefObject<HTMLDivElement>) {
  const [allowTouchOrbit, setAllowTouchOrbit] = useState(false);
  
  const stateRef = useRef({
    startX: 0,
    startY: 0,
    decided: false,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      stateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        decided: false,
      };
      setAllowTouchOrbit(false);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (stateRef.current.decided) return;
      
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - stateRef.current.startX);
      const dy = Math.abs(touch.clientY - stateRef.current.startY);

      // Need 20px movement to decide
      if (dx < 20 && dy < 20) return;

      // Horizontal needs to be 3x stronger than vertical
      if (dx > dy * 3) {
        stateRef.current.decided = true;
        setAllowTouchOrbit(true);
        e.preventDefault();
      } else {
        stateRef.current.decided = true;
        // Vertical = let scroll happen naturally
      }
    };

    const onTouchEnd = () => {
      stateRef.current.decided = false;
      setAllowTouchOrbit(false);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart as any);
      el.removeEventListener('touchmove', onTouchMove as any);
      el.removeEventListener('touchend', onTouchEnd as any);
    };
  }, []);

  return allowTouchOrbit;
}

export const Oclar3D: React.FC<{
  url?: string;
  className?: string;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  enableOrbit?: boolean;
  intensity?: number;
  floatIntensity?: number;
  floatSpeed?: number;
}> = ({
  url = '/models/oclar.glb',
  className = '',
  autoRotate = true,
  autoRotateSpeed = 0.006,
  enableOrbit = true,
  intensity = 0.18,
  floatIntensity = 0.08,
  floatSpeed = 0.8,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const allowTouchOrbit = useTouchDirectionLock(containerRef);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{
        touchAction: 'pan-y',
      }}
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
          <Model
            url={url}
            autoRotate={autoRotate}
            autoRotateSpeed={autoRotateSpeed}
            enableOrbit={enableOrbit}
            intensity={intensity}
            floatIntensity={floatIntensity}
            floatSpeed={floatSpeed}
            allowTouchOrbit={allowTouchOrbit}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');
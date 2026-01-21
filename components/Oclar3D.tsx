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
  const orbitRef = useRef<any>(null);

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

  // Disable/enable OrbitControls based on touch mode
  useEffect(() => {
    if (orbitRef.current) {
      orbitRef.current.enabled = allowTouchOrbit;
    }
  }, [allowTouchOrbit]);

  useFrame(({ mouse, clock }) => {
    if (!group.current) return;

    // Floating animation - smooth and consistent
    const t = clock.getElapsedTime();
    const targetFloatY = Math.sin(t * floatSpeed) * floatIntensity;
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, targetFloatY, 0.05);

    // Mouse reactive rotation (desktop only) - very subtle
    if (!('ontouchstart' in window)) {
      const targetX = mouse.y * intensity * 0.5;
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.04);
    }

    // Auto rotate - smooth and consistent
    if (autoRotate) {
      group.current.rotation.y += autoRotateSpeed;
    }
  });

  return (
    <group ref={group}>
      <primitive object={cloned} />
      <FitCameraToObject target={cloned} />

      {enableOrbit && (
        <OrbitControls
          ref={orbitRef}
          enablePan={false}
          enableZoom={false}
          rotateSpeed={0.5}
          dampingFactor={0.1}
          enableDamping
          enabled={allowTouchOrbit}
        />
      )}
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

/**
 * Enhanced touch direction lock:
 * - Vertical scroll (up/down) => page scroll (disable orbit)
 * - Horizontal swipe (left/right) => 3D model interaction (enable orbit, prevent scroll)
 */
function useTouchDirectionLock(containerRef: React.RefObject<HTMLDivElement>) {
  const [allowTouchOrbit, setAllowTouchOrbit] = useState(false);
  
  const state = useRef<{
    tracking: boolean;
    decided: boolean;
    mode: 'scroll' | 'orbit' | null;
    x0: number;
    y0: number;
    pointerId: number | null;
  }>({
    tracking: false,
    decided: false,
    mode: null,
    x0: 0,
    y0: 0,
    pointerId: null,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      // Only for touch/pen
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') {
        setAllowTouchOrbit(false);
        return;
      }

      state.current = {
        tracking: true,
        decided: false,
        mode: null,
        x0: e.clientX,
        y0: e.clientY,
        pointerId: e.pointerId,
      };

      // Default: assume vertical scroll until proven otherwise
      setAllowTouchOrbit(false);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!state.current.tracking || state.current.pointerId !== e.pointerId) return;

      const dx = e.clientX - state.current.x0;
      const dy = e.clientY - state.current.y0;

      if (!state.current.decided) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        
        // Increased threshold for better detection - 12px minimum movement
        const THRESHOLD = 12;

        if (adx < THRESHOLD && ady < THRESHOLD) return;

        // Decide direction - clear horizontal bias needed
        state.current.decided = true;
        
        // Horizontal needs to be 1.5x stronger than vertical to activate orbit
        if (adx > ady * 1.5) {
          state.current.mode = 'orbit';
          setAllowTouchOrbit(true);
        } else {
          state.current.mode = 'scroll';
          setAllowTouchOrbit(false);
        }
      }

      // Prevent default ONLY for horizontal orbit mode
      if (state.current.mode === 'orbit') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (state.current.pointerId !== e.pointerId) return;
      
      state.current.tracking = false;
      state.current.decided = false;
      state.current.mode = null;
      state.current.pointerId = null;
      
      // Reset to scroll mode
      setAllowTouchOrbit(false);
    };

    // Use capture phase for better control
    el.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true });
    el.addEventListener('pointermove', onPointerMove, { passive: false, capture: true });
    el.addEventListener('pointerup', onPointerEnd, { passive: true, capture: true });
    el.addEventListener('pointercancel', onPointerEnd, { passive: true, capture: true });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown as any, { capture: true } as any);
      el.removeEventListener('pointermove', onPointerMove as any, { capture: true } as any);
      el.removeEventListener('pointerup', onPointerEnd as any, { capture: true } as any);
      el.removeEventListener('pointercancel', onPointerEnd as any, { capture: true } as any);
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
        // Allow vertical scrolling, prevent horizontal on container
        touchAction: 'pan-y',
        // Prevent unwanted transforms during scroll
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ 
          antialias: true, 
          alpha: true, 
          powerPreference: 'high-performance',
          // Prevent flickering on mobile
          preserveDrawingBuffer: false,
        }}
        camera={{ fov: 35, near: 0.1, far: 2000, position: [0, 0, 5] }}
        // Prevent canvas from interfering with scroll
        style={{ touchAction: 'none' }}
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
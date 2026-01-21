import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, OrbitControls, useGLTF } from '@react-three/drei';

type ModelProps = {
  url: string; // ex: "/models/oclar.glb"
  autoRotate?: boolean;
  autoRotateSpeed?: number; // rad/frame-ish feel (we use small values)
  enableOrbit?: boolean;
  intensity?: number; // mouse reactiveness
  floatIntensity?: number; // in world units
  floatSpeed?: number; // speed factor
  allowTouchOrbit?: boolean; // controlled by touch-direction-lock
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

  // clone scene so we don't mutate cached gltf
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // improve material quality (safe)
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

  // float + rotate + gentle mouse react
  useFrame(({ mouse, clock }) => {
    if (!group.current) return;

    // floating
    const t = clock.getElapsedTime();
    const floatY = Math.sin(t * floatSpeed) * floatIntensity;
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.08);

    // mouse reactive rotation (desktop) - subtle
    const targetX = mouse.y * intensity; // invers
    const targetY = mouse.x * intensity;

    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.06);

    // auto rotate always
    if (autoRotate) {
      group.current.rotation.y += autoRotateSpeed;
    }

    // when user interacts via OrbitControls (touch/drag), OrbitControls will rotate the camera.
    // We still keep a slight lerp towards mouse for premium "alive" feel.
    // No extra code needed; allowTouchOrbit controls OrbitControls rendering below.
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
 * Touch direction lock:
 * - vertical swipe => let page scroll (do NOT preventDefault, disable orbit)
 * - horizontal swipe => interact with model (preventDefault, enable orbit)
 */
function useTouchDirectionLock(containerRef: React.RefObject<HTMLDivElement>) {
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

  const [allowTouchOrbit, setAllowTouchOrbit] = React.useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Important: allow the browser to handle vertical scrolling
    // We will only preventDefault when we detect horizontal intent.
    // NOTE: must set passive:false for pointermove when we want to preventDefault.
    const onPointerDown = (e: PointerEvent) => {
      // only touch / pen for this lock
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;

      state.current.tracking = true;
      state.current.decided = false;
      state.current.mode = null;
      state.current.x0 = e.clientX;
      state.current.y0 = e.clientY;
      state.current.pointerId = e.pointerId;

      // default: let scroll happen until proven horizontal
      setAllowTouchOrbit(false);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!state.current.tracking) return;
      if (state.current.pointerId !== e.pointerId) return;

      const dx = e.clientX - state.current.x0;
      const dy = e.clientY - state.current.y0;

      // ignore tiny movement
      if (!state.current.decided) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const TH = 6;

        if (adx < TH && ady < TH) return;

        state.current.decided = true;
        state.current.mode = adx > ady ? 'orbit' : 'scroll';
        setAllowTouchOrbit(state.current.mode === 'orbit');
      }

      if (state.current.mode === 'orbit') {
        // block page scroll ONLY when user intent is horizontal
        e.preventDefault();
      }
      // if scroll => do nothing, browser scrolls normally
    };

    const onPointerUp = (e: PointerEvent) => {
      if (state.current.pointerId !== e.pointerId) return;
      state.current.tracking = false;
      state.current.decided = false;
      state.current.mode = null;
      state.current.pointerId = null;

      // reset: don't steal scroll unless user starts a new horizontal gesture
      setAllowTouchOrbit(false);
    };

    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', onPointerUp, { passive: true });
    el.addEventListener('pointercancel', onPointerUp, { passive: true });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown as any);
      el.removeEventListener('pointermove', onPointerMove as any);
      el.removeEventListener('pointerup', onPointerUp as any);
      el.removeEventListener('pointercancel', onPointerUp as any);
    };
  }, [containerRef]);

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
    // IMPORTANT: no background, no rounded by default here -> "no container look"
    // You control styling from the parent via className.
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{
        // This is critical for mobile:
        // - allow vertical pan to scroll page
        // - still allow horizontal gestures for orbit
        touchAction: 'pan-y',
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 35, near: 0.1, far: 2000, position: [0, 0, 5] }}
      >
        {/* lights */}
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

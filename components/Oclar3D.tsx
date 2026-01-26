import React, {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, useGLTF } from '@react-three/drei';

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
  ready: boolean;
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
  externalRotationY,
  ready
}: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // progres animatie aparitie (0 → 1)
  const appear = useRef(0);

  // IMPORTANT: useLayoutEffect ca sa NU existe frame initial “negru”
  useLayoutEffect(() => {
    // pozitie initiala (jos) pentru slide
    if (group.current) {
      group.current.position.y = -0.3;
    }

    // setam materialele invizibile INAINTE de primul paint
    cloned.traverse((obj: any) => {
      if (obj?.isMesh && obj.material) {
        obj.castShadow = true;
        obj.receiveShadow = true;

        if (obj.material.map) {
          obj.material.map.colorSpace = THREE.SRGBColorSpace;
        }

        obj.material.transparent = true;
        obj.material.opacity = 0;
        obj.material.needsUpdate = true;
      }
    });
  }, [cloned]);

  useFrame(({ mouse, clock }) => {
    if (!group.current) return;

    // === APPEAR ANIMATION ===
    if (ready && appear.current < 1) {
      appear.current = THREE.MathUtils.lerp(appear.current, 1, 0.08);

      // slide up (doar pana apare complet)
      group.current.position.y = THREE.MathUtils.lerp(-0.3, 0, appear.current);

      // fade-in material
      cloned.traverse((obj: any) => {
        if (obj?.isMesh && obj.material) {
          obj.material.opacity = appear.current;
        }
      });
    }

    // dupa ce animatia s-a terminat, revenim la materiale solide (performanta)
    if (appear.current >= 0.99) {
      cloned.traverse((obj: any) => {
        if (obj?.isMesh && obj.material) {
          obj.material.opacity = 1;
          obj.material.transparent = false;
        }
      });
    }

    // === FLOATING ===
    // NU aplicam floating pana nu s-a terminat animatia de aparitie,
    // altfel “trage” modelul si iti strica slide-ul.
    if (appear.current >= 0.99) {
      const t = clock.getElapsedTime();
      const floatY = Math.sin(t * floatSpeed) * floatIntensity;
      group.current.position.y = THREE.MathUtils.lerp(
        group.current.position.y,
        floatY,
        0.08
      );
    }

    // === MOUSE TILT ===
    if (!isDraggingRef.current) {
      const targetX = mouse.y * intensity;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        targetX,
        0.06
      );
    } else {
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        0,
        0.2
      );
    }

    // === ROTATION ===
    if (autoRotate && !isDraggingRef.current && ready) {
      externalRotationY.current += autoRotateSpeed;
    }

    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      externalRotationY.current,
      0.15
    );
  });

  return (
    <group ref={group}>
      <primitive object={cloned} />
    </group>
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
  const lastPosRef = useRef({ x: 0 });
  const externalRotationY = useRef(0);

  const [ready, setReady] = useState(false);

  // timing safe (Safari-friendly)
  useEffect(() => {
    let id: number;

    if ('requestIdleCallback' in window) {
      id = (window as any).requestIdleCallback(() => setReady(true));
      return () => (window as any).cancelIdleCallback?.(id);
    } else {
      const timeout = setTimeout(() => setReady(true), 50);
      return () => clearTimeout(timeout);
    }
  }, []);

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
      className={`relative ${className}`}
      style={{ touchAction: 'pan-y', cursor: 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 45, near: 0.1, far: 2000, position: [0, 0, 3.5] }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} castShadow />
        <directionalLight position={[-6, 3, -2]} intensity={0.8} />

        <Suspense fallback={null}>
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
            ready={ready}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');

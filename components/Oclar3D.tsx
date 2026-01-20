import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';

type ModelProps = {
  url: string;
  autoRotate?: boolean;
  enableOrbit?: boolean;
  intensity?: number;
};

function FitCameraToObject({ target }: { target: THREE.Object3D }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(target);
    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());

    if (!sphere) return;

    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
    const distance = sphere.radius / Math.sin(fov / 2);

    camera.position.set(center.x, center.y, center.z + distance * 1.15);
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    camera.lookAt(center);

    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  }, [camera, size, target]);

  return null;
}

function Model({ url, autoRotate = false, enableOrbit = false, intensity = 0.22 }: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);

  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    cloned.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;

        if (obj.material?.map) {
          obj.material.map.colorSpace = THREE.SRGBColorSpace;
        }
        if (obj.material) obj.material.needsUpdate = true;
      }
    });
  }, [cloned]);

  useFrame(({ mouse, clock }) => {
  if (!group.current) return;

  // plutire (sus-jos) + micro tilt
  const t = clock.getElapsedTime();
  const floatY = Math.sin(t * 0.8) * 0.08;
  const floatX = Math.sin(t * 0.6) * 0.02;

  group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, floatY, 0.06);
  group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, floatX + mouse.y * intensity, 0.06);

  // auto rotate constant, chiar fara mouse
  if (autoRotate) {
    group.current.rotation.y += 0.006; // daca e prea rapid, scade la 0.003 / 0.002
  }

  // mouse influence subtil (se adauga peste auto-rotate)
  group.current.rotation.y = THREE.MathUtils.lerp(
    group.current.rotation.y,
    group.current.rotation.y + mouse.x * intensity,
    0.02
  );
});

  return (
    <group ref={group}>
      <primitive object={cloned} />
      <FitCameraToObject target={cloned} />

      {enableOrbit && (
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          rotateSpeed={0.6}
          dampingFactor={0.08}
          enableDamping
          // limite anti-"fuga"
          minPolarAngle={Math.PI * 0.35}
          maxPolarAngle={Math.PI * 0.65}
          minAzimuthAngle={-Math.PI * 0.35}
          maxAzimuthAngle={Math.PI * 0.35}
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

export const Oclar3D: React.FC<{
  url?: string;
  className?: string;
  autoRotate?: boolean;
  enableOrbit?: boolean;
  intensity?: number;
}> = ({
  url = '/models/oclar.glb',
  className = '',
  autoRotate = true,
  enableOrbit = true,
  intensity = 0.22,
}) => {
  return (
    <div className={`w-full ${className}`} style={{ background: 'transparent' }}>
      <Canvas
        // PERF: dpr mai mic => mai rapid/mai stabil pe desktop
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 35, near: 0.1, far: 2000, position: [0, 0, 5] }}
      >
        {/* lights - fara Environment preset (care e greu la download) */}
        <ambientLight intensity={0.9} />
        <directionalLight position={[6, 10, 6]} intensity={1.0} />
        <directionalLight position={[-6, 3, -2]} intensity={0.45} />

        <Suspense fallback={<Loader />}>
          <Model url={url} autoRotate={autoRotate} enableOrbit={enableOrbit} intensity={intensity} />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');

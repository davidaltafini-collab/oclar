import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, OrbitControls, useGLTF } from '@react-three/drei';

type ModelProps = {
  url: string;                // ex: "/models/oclar.glb"
  autoRotate?: boolean;       // default false
  enableOrbit?: boolean;      // default false (doar daca vrei drag)
  intensity?: number;         // cat de "reactiv" e la mouse
};

function FitCameraToObject({ target }: { target: THREE.Object3D }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(target);
    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());

    if (!sphere) return;

    // Camera distance based on FOV and bounding sphere
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
    const distance = sphere.radius / Math.sin(fov / 2);

    camera.position.set(center.x, center.y, center.z + distance * 1.15);
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    camera.lookAt(center);

    // handle resize aspect
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  }, [camera, size, target]);

  return null;
}

function Model({ url, autoRotate = false, enableOrbit = false, intensity = 0.35 }: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);

  // clone scene so we don't mutate cached gltf
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // improve material quality a bit (safe)
  useEffect(() => {
    cloned.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;

        if (obj.material) {
          // ensure correct color space for textures
          if (obj.material.map) obj.material.map.colorSpace = THREE.SRGBColorSpace;
          obj.material.needsUpdate = true;
        }
      }
    });
  }, [cloned]);

  // mouse reactive rotation
  useFrame(({ mouse }) => {
    if (!group.current) return;

    // smooth follow
    const targetX = mouse.y * intensity;  // invers (mouse up -> tilt down)
    const targetY = mouse.x * intensity;

    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.08);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, 0.08);

    if (autoRotate) {
      group.current.rotation.y += 0.003;
    }
  });

  return (
    <group ref={group}>
      <primitive object={cloned} />
      <FitCameraToObject target={cloned} />
      {enableOrbit && (
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

export const Oclar3D: React.FC<{
  url?: string;
  className?: string;
  autoRotate?: boolean;
  enableOrbit?: boolean;
  intensity?: number;
}> = ({
  url = '/models/oclar.glb',
  className = '',
  autoRotate = false,
  enableOrbit = false,
  intensity = 0.35,
}) => {
  return (
    <div className={`w-full aspect-[4/5] rounded-3xl overflow-hidden bg-neutral-50 ${className}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 35, near: 0.1, far: 2000, position: [0, 0, 5] }}
      >
        {/* lights */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} castShadow />
        <directionalLight position={[-6, 3, -2]} intensity={0.55} />

        {/* environment (nice reflections) */}
        <Suspense fallback={<Loader />}>
          <Environment preset="city" />
          <Model url={url} autoRotate={autoRotate} enableOrbit={enableOrbit} intensity={intensity} />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/oclar.glb');

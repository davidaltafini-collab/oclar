import React, { useState } from 'react';

interface Oclar3DProps {
  url?: string;
  className?: string;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  intensity?: number;
}

export const Oclar3D: React.FC<Oclar3DProps> = ({
  className = '',
  autoRotate = true,
  autoRotateSpeed = 0.004,
  intensity = 0.4,
}) => {
  const [loaded, setLoaded] = useState(false);

  const params = new URLSearchParams({
    model:       'oclar.glb',
    bg:          'transparent',
    autorotate:  autoRotate ? '1' : '0',
    speed:       String(autoRotateSpeed),
    intensity:   String(intensity),
  });

  return (
    <div
      className={`relative ${className}`}
      style={{
        opacity: loaded ? 1 : 0,
        transform: loaded ? 'translateY(0px)' : 'translateY(24px)',
        transition: 'opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <iframe
        src={`https://modele3d.com/viewer.php?${params}`}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          display: 'block',
        }}
        allow="accelerometer; gyroscope"
        scrolling="no"
        onLoad={() => setLoaded(true)}
        title="Oclar 3D Model"
      />
    </div>
  );
};
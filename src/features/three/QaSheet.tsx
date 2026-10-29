import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';

declare global {
  interface Window {
    __bioQA?: {
      sheet: (opts?: { cols?: number; size?: number; polar?: number }) => string;
      /** Advance the render loop `n` frames ~`ms` apart (works while the browser throttles rAF). */
      step: (n: number, ms?: number) => Promise<number>;
    };
  }
}

/**
 * Dev-only QA hook (never mounted in production): renders the current scene from 8 azimuths
 * (0°, 45° … 315° around the orbit target) into one contact sheet and restores the camera.
 */
export default function QaSheet({ controls }: { controls: React.RefObject<OrbitImpl | null> }) {
  const { gl, scene, camera, advance } = useThree();
  useEffect(() => {
    window.__bioQA = {
      step: async (n, ms = 33) => {
        const t0 = performance.now();
        for (let i = 0; i < n; i++) {
          await new Promise((r) => setTimeout(r, ms));
          advance(performance.now());
        }
        return performance.now() - t0;
      },
      sheet: ({ cols = 4, size = 220, polar } = {}) => {
        const c = controls.current;
        const target = c ? c.target.clone() : new THREE.Vector3();
        const saved = camera.position.clone();
        const off = saved.clone().sub(target);
        const sph = new THREE.Spherical().setFromVector3(off);
        if (polar !== undefined) sph.phi = polar;
        const out = document.createElement('canvas');
        const src = gl.domElement;
        const h = Math.round((size * src.height) / src.width);
        out.width = cols * size;
        out.height = Math.ceil(8 / cols) * h;
        const ctx = out.getContext('2d')!;
        ctx.font = 'bold 14px sans-serif';
        for (let i = 0; i < 8; i++) {
          const s = sph.clone();
          s.theta = sph.theta + (i * Math.PI) / 4;
          camera.position.copy(new THREE.Vector3().setFromSpherical(s).add(target));
          camera.lookAt(target);
          gl.render(scene, camera);
          const x = (i % cols) * size;
          const y = Math.floor(i / cols) * h;
          ctx.drawImage(src, x, y, size, h);
          ctx.fillStyle = '#ffd34d';
          ctx.fillText(`${i * 45}°`, x + 6, y + 18);
        }
        camera.position.copy(saved);
        camera.lookAt(target);
        c?.update();
        return out.toDataURL('image/jpeg', 0.85);
      },
    };
    return () => {
      delete window.__bioQA;
    };
  }, [gl, scene, camera, controls, advance]);
  return null;
}

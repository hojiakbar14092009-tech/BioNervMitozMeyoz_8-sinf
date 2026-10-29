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
      /** Hotspot id → tappable screen area (px² sampled) and the most central client point that hits it. */
      /** Camera position relative to the orbit target, and its distance. */
      cam: () => { off: [number, number, number]; dist: number };
      /** Normalised screen bounds [x0, y0, x1, y1] of everything tappable (0…1 = inside the canvas). */
      extent: (grid?: number) => [number, number, number, number] | null;
      targets: (grid?: number) => Record<string, { area: number; x: number; y: number }>;
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
    let lastExtent: [number, number, number, number] | null = null;
    window.__bioQA = {
      cam: () => {
        const o = camera.position.clone().sub(controls.current?.target ?? new THREE.Vector3());
        return { off: o.toArray() as [number, number, number], dist: o.length() };
      },
      extent: (grid = 10) => {
        window.__bioQA!.targets(grid); // the scan records the bounds
        return lastExtent;
      },
      targets: (grid = 12) => {
        const rect = gl.domElement.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        const hits: Record<string, [number, number][]> = {};
        let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
        const shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent));
        for (let y = grid / 2; y < rect.height; y += grid)
          for (let x = grid / 2; x < rect.width; x += grid) {
            ray.setFromCamera(new THREE.Vector2((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1), camera);
            for (const h of ray.intersectObjects(scene.children, true)) {
              if (!shown(h.object)) continue;
              const u = h.object.userData;
              const id: string | null | undefined = u.partOf && h.face ? u.partOf(h.face.a) : u.part;
              if (!id) continue; // like R3F, objects without a handler don't take the tap
              if (u.passThrough && ray.intersectObjects(scene.children, true).some((k) => k.distance > h.distance && k.object !== h.object && k.object.userData.part && shown(k.object))) continue;
              (hits[id] ??= []).push([x, y]);
              [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
              break;
            }
          }
        lastExtent = x0 === Infinity ? null : [x0 / rect.width, y0 / rect.height, x1 / rect.width, y1 / rect.height];
        return Object.fromEntries(
          Object.entries(hits).map(([id, pts]) => {
            const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
            const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
            const [bx, by] = pts.reduce((b, p) => (Math.hypot(p[0] - cx, p[1] - cy) < Math.hypot(b[0] - cx, b[1] - cy) ? p : b));
            return [id, { area: pts.length * grid * grid, x: rect.left + bx, y: rect.top + by }];
          }),
        );
      },
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

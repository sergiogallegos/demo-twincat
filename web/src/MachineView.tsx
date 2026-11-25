import { useEffect, useRef, useState } from 'react';
import { loadVendorMeshes } from './vendorModel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Frame } from './model';

export function MachineView({
  frame,
  reset,
}: {
  frame: Frame | null;
  reset: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(frame);
  const update = useRef<() => void>(() => {});
  const home = useRef<() => void>(() => {});
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    latest.current = frame;
    update.current();
  }, [frame]);

  useEffect(() => {
    home.current();
  }, [reset]);

  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }

    let disposed = false;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2, 2, 1, -1, 0.01, 50);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minZoom = 0.75;
    controls.maxZoom = 2.8;
    controls.maxPolarAngle = Math.PI / 2.05;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xffffff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setAnimationLoop(null);
    container.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xaebbc1, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(-3, 6, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xd3e8ff, 1.4);
    rim.position.set(4, 3, -2);
    scene.add(rim);
    const draw = () => {
      if (!disposed) renderer.render(scene, camera);
    };
    controls.addEventListener('change', draw);

    home.current = () => {
      camera.position.set(1.85, 2.15, 5.2);
      camera.zoom = 1;
      controls.target.set(0, 0.7, 0);
      camera.updateProjectionMatrix();
      controls.update();
      draw();
    };
    home.current();

    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      const aspect = width / height;
      const half = Math.max(0.84, 1.74 / aspect);
      Object.assign(camera, {
        left: -half * aspect,
        right: half * aspect,
        top: half,
        bottom: -half,
      });
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      draw();
    });
    resize.observe(container);

    let model: THREE.Group | undefined;
    function release(group: THREE.Group) {
      const materials = new Set<THREE.Material>();
      group.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          for (const mat of Array.isArray(node.material)
            ? node.material
            : [node.material])
            materials.add(mat);
        }
      });
      materials.forEach((mat) => mat.dispose());
    }

    new GLTFLoader().load(
      '/cell.glb',
      (result) => {
        if (disposed) {
          release(result.scene);
          return;
        }
        model = result.scene;
        scene.add(model);
        void loadVendorMeshes(model)
          .then(draw)
          .catch(() => {
            /* The native proxy remains visible. */
          });
        const carrier = model.getObjectByName('TrackCarrier');
        const shuttle = model.getObjectByName('PlanarShuttle');
        const feedRoll = model.getObjectByName('FeedRoll');

        const moving: { node: THREE.Object3D; station: number; y: number }[] =
          [];
        const cargo: {
          node: THREE.Object3D;
          station: number;
          origin: THREE.Vector3;
        }[] = [];
        model.traverse((node) => {
          const actuator = /^Moving(\d)_/.exec(node.name);
          const carton = /^Cargo(\d)_/.exec(node.name);
          if (actuator)
            moving.push({
              node,
              station: Number(actuator[1]) + 1,
              y: node.position.y,
            });
          if (carton)
            cargo.push({
              node,
              station: Number(carton[1]) + 1,
              origin: node.position.clone(),
            });
        });
        update.current = () => {
          const value = latest.current;
          const devices = value?.devices;
          if (carrier)
            carrier.position.x = -1.12 + (devices?.trackMm ?? 0) / 1000;
          if (feedRoll) feedRoll.rotation.y = (devices?.feedMm ?? 0) / 25;
          if (shuttle) {
            shuttle.position.x = 1.12 + (devices?.planarXmm ?? 0) / 1000;
            shuttle.position.z = -(devices?.planarYmm ?? 0) / 1000;
          }
          const progress = value
            ? Math.min(value.phase, 200 - value.phase) / 100
            : 0;
          moving.forEach(({ node, station, y }) => {
            node.position.y =
              y -
              (station === value?.station
                ? [0.26, 0.17, 0.17, 0.17, 0.17][station - 1] * progress
                : 0);
          });
          // Material changes follow the measured outstroke and stay latched on return.
          const formed = Math.min(1, (value?.phase ?? 0) / 100);
          cargo.forEach(({ node, station, origin }) => {
            node.visible = station === value?.station;
            if (!node.visible) return;
            node.position.x = origin.x;
            node.position.z = origin.z;
            if (!value?.manual && station < 5 && devices) {
              node.position.x += (devices.trackMm - (station - 1) * 560) / 1000;
            }
            if (station === 2 && /_Side_|_End_/.test(node.name)) {
              node.scale.y = Math.max(0.075, formed);
              node.position.y = origin.y - 0.053 * (1 - node.scale.y);
            }
            if (station === 3 && node.name.endsWith('_Product')) {
              node.position.y = origin.y + 0.15 * (1 - formed);
            }
            if (station === 4 && /_Lid|_Tape/.test(node.name)) {
              node.rotation.x = ((1 - formed) * Math.PI) / 2;
              node.position.y = origin.y + 0.078 * (1 - formed);
            }
            if (!value?.manual && station === 5 && devices) {
              node.position.x = origin.x + devices.planarXmm / 1000;
              node.position.z = origin.z - devices.planarYmm / 1000;
            }
          });
          draw();
        };
        update.current();
        setAvailable(true);
      },
      undefined,
      () => setAvailable(false),
    );

    return () => {
      disposed = true;
      resize.disconnect();
      controls.dispose();
      if (model) release(model);
      renderer.dispose();
      renderer.domElement.remove();
      update.current = () => {};
      home.current = () => {};
    };
  }, []);

  return (
    <div
      className="scene"
      ref={host}
      role="img"
      aria-label="Five pneumatic station gantries. Drag to orbit the machine."
    >
      {!available && (
        <img
          className="poster"
          src="/cell.png"
          alt="Rendered carton cell assembly"
        />
      )}
      <span className="viewport-caption">
        {available ? 'Drag to orbit · Scroll to zoom' : 'Assembly render'}
      </span>
    </div>
  );
}

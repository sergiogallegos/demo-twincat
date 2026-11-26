import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { LineFrame } from './model';
import { pose } from './lineLayout';

const views = {
  'Whole cell': {
    target: [-0.53, 0.89, -0.02],
    eye: [-0.39, 0.46, 1],
    width: 4.85,
    height: 2.64,
  },
  'Operator panel': {
    target: [1.19, 1.56, 0.85],
    eye: [0.25, 0.14, 1],
    width: 1.46,
    height: 1.09,
  },
  'Insert tooling': {
    target: [0.18, 0.96, 0.405],
    eye: [-0.75, 0.53, 1],
    width: 1.03,
    height: 0.61,
  },
  'Vision table': {
    target: [-2.04, 0.89, -0.66],
    eye: [-0.69, 0.68, 1],
    width: 1.37,
    height: 0.87,
  },
} as const;
type View = keyof typeof views;

function heading(slot: number) {
  if (slot <= 3) return 0;
  if (slot <= 5) return ((slot - 3) * Math.PI) / 2;
  if (slot <= 8) return Math.PI;
  return Math.PI + ((slot - 8) * Math.PI) / 2;
}

export function LineScene({ line }: { line: LineFrame }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(line);
  const [status, setStatus] = useState<'loading' | 'ready' | 'static'>(
    'loading',
  );
  const [view, setView] = useState<View>('Whole cell');
  const [cutaway, setCutaway] = useState(false);
  const cutawayRef = useRef(false);
  const chooseView = useRef<(key: View) => void>(() => {});
  latest.current = line;

  useEffect(() => {
    const mount = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setStatus('static');
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2, 2, 1, -1, 0.02, 30);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.minZoom = 0.45;
    controls.maxZoom = 9;
    const studio = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const reflection = pmrem.fromScene(studio, 0.045);
    scene.environment = reflection.texture;
    scene.environmentIntensity = 0.86;
    pmrem.dispose();
    studio.dispose();
    const sun = new THREE.DirectionalLight(0xfff4df, 2.2);
    sun.position.set(-2, 5, 3);
    sun.target.position.set(-0.5, 0.4, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -2.6,
      right: 2.6,
      top: 2,
      bottom: -2,
      near: 0.1,
      far: 12,
    });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.004;
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.ShadowMaterial({ opacity: 0.2 }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.006;
    shadowPlane.receiveShadow = true;
    scene.add(
      shadowPlane,
      sun,
      sun.target,
      new THREE.HemisphereLight(0xf3f8fc, 0x819197, 0.95),
    );
    let current: View = 'Whole cell';
    function fit() {
      const { width, height } = views[current];
      const aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
      const h = Math.max(height, width / aspect) / 2;
      camera.left = -h * aspect;
      camera.right = h * aspect;
      camera.top = h;
      camera.bottom = -h;
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.updateProjectionMatrix();
    }
    chooseView.current = (key) => {
      current = key;
      const { target, eye } = views[key];
      controls.target.fromArray(target);
      camera.position
        .fromArray(eye)
        .normalize()
        .multiplyScalar(5)
        .add(controls.target);
      camera.zoom = 1;
      controls.update();
      fit();
    };
    chooseView.current('Whole cell');
    const resize = new ResizeObserver(fit);
    resize.observe(mount);
    let alive = true;
    let model: THREE.Object3D | undefined;
    function disposeModel(root: THREE.Object3D) {
      root.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          for (const material of [node.material].flat()) material.dispose();
        }
      });
    }
    new GLTFLoader().load(
      '/continuous-line.glb',
      (asset) => {
        if (!alive) {
          disposeModel(asset.scene);
          return;
        }
        model = asset.scene;
        scene.add(model);
        const moving = (name: string) => {
          const node = asset.scene.getObjectByName(name)!;
          return { node, rest: node.position.clone() };
        };
        const guards = model.children.filter((group) =>
          /^(Guard|Operator|LocalControls|SignalTower)/.test(group.name),
        );
        for (const group of model.children) {
          const fixed =
            !/^(Box|Mover|ServoZ|Tool|Guard|Operator|LocalControls|SignalTower|ClampJaw)/.test(
              group.name,
            );
          group.traverse((node) => {
            if (node instanceof THREE.Mesh) {
              node.castShadow = fixed;
              node.receiveShadow = true;
            }
          });
        }
        renderer.shadowMap.needsUpdate = true;
        const jaw = moving('ClampJaw');
        const carriers = Array.from({ length: 16 }, (_, i) => {
          const tag = String(i + 1).padStart(2, '0');
          return { mover: moving('Mover' + tag), carton: moving('Box' + tag) };
        });
        const heads = Array.from({ length: 8 }, (_, i) => [
          moving('ServoZ' + (i + 1)),
          moving('Tool' + (i + 1)),
        ]);
        setStatus('ready');
        renderer.setAnimationLoop(() => {
          for (const group of guards) group.visible = !cutawayRef.current;
          const frame = latest.current;
          jaw.node.position.z = jaw.rest.z + frame.clampMm / 1000;
          carriers.forEach(({ mover, carton }, i) => {
            const [x, y] = pose(i, frame);
            for (const { node } of [mover, carton]) {
              node.position.x = x / 1000;
              node.position.z = -y / 1000;
              if (i < 10)
                node.rotation.y =
                  heading(((i + frame.index) % 10) + frame.travel / 1000) -
                  heading(i);
            }
            carton.node.visible = frame.products[i] !== 0;
          });
          heads.forEach((pair, i) => {
            pair.forEach(({ node, rest }, j) => {
              node.position.copy(rest);
              if (i === 5) node.position.x -= frame.camX[i] / 1000;
              else node.position.z += ((i < 4 ? -1 : 1) * frame.camX[i]) / 1000;
              if (j === 1) node.position.y -= frame.camZ[i] / 1000;
            });
          });
          renderer.render(scene, camera);
        });
      },
      undefined,
      () => {
        if (alive) setStatus('static');
      },
    );
    return () => {
      alive = false;
      renderer.setAnimationLoop(null);
      controls.dispose();
      resize.disconnect();
      if (model) disposeModel(model);
      sun.shadow.dispose();
      disposeModel(shadowPlane);
      reflection.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="line-stage">
      <div
        className="line-scene"
        ref={host}
        aria-label="Continuous carton line, 3D assembly"
      >
        {status !== 'ready' && (
          <img
            src="/continuous-line.png"
            alt="Original machine assembly with perimeter tooling and a planar inspection table"
          />
        )}
      </div>
      <div className="scene-tools">
        {status === 'ready' ? (
          <>
            <div role="group" aria-label="Camera views">
              {(Object.keys(views) as View[]).map((key) => (
                <button
                  key={key}
                  aria-pressed={view === key}
                  onClick={() => {
                    chooseView.current(key);
                    setView(key);
                    cutawayRef.current =
                      key === 'Insert tooling' || key === 'Vision table';
                    setCutaway(cutawayRef.current);
                  }}
                >
                  {key}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={cutaway}
                onClick={() => {
                  cutawayRef.current = !cutawayRef.current;
                  setCutaway(cutawayRef.current);
                }}
              >
                Cutaway
              </button>
            </div>
            <small>Drag to orbit · Scroll or pinch to zoom</small>
          </>
        ) : (
          <small role="status">
            {status === 'loading'
              ? 'Loading interactive assembly…'
              : 'Static assembly view'}
          </small>
        )}
      </div>
    </div>
  );
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function loadVendorMeshes(): Promise<THREE.Group | null> {
  if (new URLSearchParams(location.search).get('cad') === 'proxy') return null;
  const response = await fetch('/api/model');
  if (!response.ok || !(await response.json()).available) return null;
  const detail = await new GLTFLoader().loadAsync('/vendor/components.glb');
  return detail.scene;
}

export function installVendorMeshes(model: THREE.Group, detail: THREE.Group) {
  const mounts: Record<string, string[]> = {
    'feed-motor': ['FeedServo'],
    'track-mover': ['TrackCarrier'],
    'sort-tile': [
      'PlanarTile',
      'PlanarTile_0_1',
      'PlanarTile_1_0',
      'PlanarTile_1_1',
    ],
    'sort-mover': ['PlanarShuttle'],
    camera: ['SealCamera'],
  };

  for (const [source, targets] of Object.entries(mounts)) {
    const drawing = detail.getObjectByName(source);
    if (!drawing) continue;
    for (const name of targets) {
      const proxy = model.getObjectByName(name);
      if (!(proxy instanceof THREE.Mesh)) continue;
      const copy = drawing.clone();
      copy.position.set(0, 0, 0);
      if (source === 'feed-motor') copy.rotation.x = Math.PI / 2;
      if (source === 'track-mover') copy.rotation.y = Math.PI / 2;
      proxy.add(copy);
      proxy.material = new THREE.MeshBasicMaterial({ visible: false });
    }
  }
}

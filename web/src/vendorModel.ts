import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Optional STEP meshes use metres and share the proxy origin at each mounting point.
export async function loadVendorMeshes(model: THREE.Group) {
  if (new URLSearchParams(location.search).get('cad') !== 'detail') return;
  const response = await fetch('/api/model');
  if (!response.ok || !(await response.json()).available) return;

  const detail = await new GLTFLoader().loadAsync('/vendor/components.glb');
  const anchors: Record<string, string> = {
    'feed-motor': 'FeedServo',
    'track-mover': 'TrackCarrier',
    'sort-tile': 'PlanarTile',
    'sort-mover': 'PlanarShuttle',
    camera: 'SealCamera',
  };
  for (const [source, target] of Object.entries(anchors)) {
    const drawing = detail.scene.getObjectByName(source);
    const proxy = model.getObjectByName(target);
    if (!drawing || !(proxy instanceof THREE.Mesh)) continue;

    // Keep the moving parent transform while replacing only its rendering geometry.
    const copy = drawing.clone();
    copy.position.set(0, 0, 0);
    proxy.add(copy);
    proxy.material = new THREE.MeshBasicMaterial({ visible: false });
  }
}

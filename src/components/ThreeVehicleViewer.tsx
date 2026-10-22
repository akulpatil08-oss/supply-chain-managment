import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Plane, Ship, Truck, Eye, RotateCw, ZoomIn, Box, Sparkles, Navigation, Layers } from 'lucide-react';

interface ThreeVehicleViewerProps {
  vehicleType: 'air' | 'sea' | 'road';
  status: string;
  speed: string;
  temperature: string;
  trackingNumber: string;
  progressPct: number;
}

export default function ThreeVehicleViewer({
  vehicleType: initialType = 'air',
  status,
  speed,
  temperature,
  trackingNumber,
  progressPct
}: ThreeVehicleViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeVehicle, setActiveVehicle] = useState<'air' | 'sea' | 'road'>(initialType);
  const [viewMode, setViewMode] = useState<'realistic' | 'wireframe'>('realistic');
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [camDistance, setCamDistance] = useState<number>(1);

  // Sync with prop when prop changes
  useEffect(() => {
    setActiveVehicle(initialType);
  }, [initialType]);

  // Keep mutable references for animation loop
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const vehicleGroupRef = useRef<THREE.Group | null>(null);
  const movingPartsRef = useRef<{
    turbines?: THREE.Mesh[];
    wheels?: THREE.Mesh[];
    wakeMesh?: THREE.Mesh;
    roadStripe?: THREE.Mesh;
  }>({});
  const isPointerDownRef = useRef<boolean>(false);
  const prevPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotTargetRef = useRef<{ x: number; y: number }>({ x: 0.25, y: -0.6 });
  const rotCurrentRef = useRef<{ x: number; y: number }>({ x: 0.25, y: -0.6 });
  const animFrameIdRef = useRef<number>(0);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL guard as per ThreeJS Skill
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 380;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1329);
    scene.fog = new THREE.FogExp2(0x0a1329, 0.04);
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 3.5, 9);
    camera.lookAt(0, 0.5, 0);
    cameraRef.current = camera;

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Studio Environment Lighting
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Studio 3-Point Light Rig
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
    keyLight.position.set(6, 9, 6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    fillLight.position.set(-6, 4, -4);
    scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.8);
    scene.add(hemiLight);

    // Ground Contact Shadow Plane
    const shadowGeo = new THREE.PlaneGeometry(14, 14);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.01;
    scene.add(shadowMesh);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(16, 16, 0x0284c7, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // 5. Construct Procedural 3D Vehicles Group (3-12 parts)
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);
    vehicleGroupRef.current = masterGroup;

    // Pointers tracking for orbital drag
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isPointerDownRef.current = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      prevPointerRef.current = { x: clientX, y: clientY };
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isPointerDownRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - prevPointerRef.current.x;
      const dy = clientY - prevPointerRef.current.y;

      rotTargetRef.current.y += dx * 0.008;
      rotTargetRef.current.x = Math.max(-0.6, Math.min(0.9, rotTargetRef.current.x + dy * 0.008));

      prevPointerRef.current = { x: clientX, y: clientY };
    };

    const onPointerUp = () => {
      isPointerDownRef.current = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    domEl.addEventListener('touchstart', onPointerDown);
    window.addEventListener('touchmove', onPointerMove);
    window.addEventListener('touchend', onPointerUp);

    // 6. Animation Render Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth exponential damping on rotation
      if (isRotating && !isPointerDownRef.current) {
        rotTargetRef.current.y += delta * 0.45;
      }

      rotCurrentRef.current.x = THREE.MathUtils.damp(rotCurrentRef.current.x, rotTargetRef.current.x, 8, delta);
      rotCurrentRef.current.y = THREE.MathUtils.damp(rotCurrentRef.current.y, rotTargetRef.current.y, 8, delta);

      if (masterGroup) {
        masterGroup.rotation.x = rotCurrentRef.current.x;
        masterGroup.rotation.y = rotCurrentRef.current.y;

        // Subtle vehicle dynamic animations
        if (activeVehicle === 'air') {
          // Jet flight banking & subtle elevation floating
          masterGroup.position.y = 1.0 + Math.sin(elapsed * 2.5) * 0.12;
          masterGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.08;

          // Spin turbine fan blades
          movingPartsRef.current.turbines?.forEach(turb => {
            turb.rotation.z += delta * 25;
          });
        } else if (activeVehicle === 'sea') {
          // Ocean vessel roll and heave in waves
          masterGroup.position.y = 0.4 + Math.sin(elapsed * 1.8) * 0.08;
          masterGroup.rotation.z = Math.sin(elapsed * 1.2) * 0.04;
          masterGroup.rotation.x = rotCurrentRef.current.x + Math.cos(elapsed * 1.4) * 0.03;

          if (movingPartsRef.current.wakeMesh) {
            movingPartsRef.current.wakeMesh.rotation.z += delta * 0.2;
          }
        } else if (activeVehicle === 'road') {
          // Truck suspension rumble & rolling wheels
          masterGroup.position.y = 0.5 + Math.sin(elapsed * 18) * 0.008;

          movingPartsRef.current.wheels?.forEach(wheel => {
            wheel.rotation.x += delta * 14;
          });

          if (movingPartsRef.current.roadStripe) {
            movingPartsRef.current.roadStripe.position.z = (elapsed * 6) % 2 - 1;
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      domEl.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      renderer.dispose();
    };
  }, []);

  // Rebuild 3D Model when activeVehicle or viewMode changes
  useEffect(() => {
    const group = vehicleGroupRef.current;
    if (!group) return;

    // Clear old children
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
    }
    movingPartsRef.current = {};

    const wire = viewMode === 'wireframe';

    if (activeVehicle === 'air') {
      // ==========================================
      // ✈️ 3D BOEING 777F AIR CARGO JET (8 PARTS)
      // ==========================================
      const whiteMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        metalness: 0.35,
        roughness: 0.2,
        wireframe: wire
      });
      const orangeMat = new THREE.MeshStandardMaterial({
        color: 0xf77f00,
        metalness: 0.6,
        roughness: 0.25,
        wireframe: wire
      });
      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.8,
        roughness: 0.3,
        wireframe: wire
      });
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        metalness: 0.9,
        roughness: 0.1,
        wireframe: wire
      });

      // 1. Main Fuselage
      const fuselageGeo = new THREE.CylinderGeometry(0.55, 0.5, 4.8, 24);
      fuselageGeo.rotateX(Math.PI / 2);
      const fuselage = new THREE.Mesh(fuselageGeo, whiteMat);
      fuselage.castShadow = true;
      group.add(fuselage);

      // 2. Aerodynamic Cockpit Nose
      const noseGeo = new THREE.ConeGeometry(0.55, 1.2, 24);
      noseGeo.rotateX(-Math.PI / 2);
      const nose = new THREE.Mesh(noseGeo, whiteMat);
      nose.position.z = 3.0;
      group.add(nose);

      // 3. Cockpit Glass Canopy Visor
      const visorGeo = new THREE.BoxGeometry(0.65, 0.2, 0.4);
      const visor = new THREE.Mesh(visorGeo, glassMat);
      visor.position.set(0, 0.35, 2.7);
      group.add(visor);

      // 4. Swept Main Wings (Left & Right)
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(3.4, -1.2);
      wingShape.lineTo(3.2, -1.8);
      wingShape.lineTo(0, -0.6);
      wingShape.closePath();

      const extrudeSettings = { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02 };
      const rightWingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
      rightWingGeo.rotateX(Math.PI / 2);
      const rightWing = new THREE.Mesh(rightWingGeo, orangeMat);
      rightWing.position.set(0.4, 0, 0.6);
      rightWing.castShadow = true;
      group.add(rightWing);

      const leftWingGeo = rightWingGeo.clone();
      leftWingGeo.scale(-1, 1, 1);
      const leftWing = new THREE.Mesh(leftWingGeo, orangeMat);
      leftWing.position.set(-0.4, 0, 0.6);
      leftWing.castShadow = true;
      group.add(leftWing);

      // 5. Dual High-Bypass Jet Turbines with Spinning Blades
      const turbines: THREE.Mesh[] = [];
      [-1.6, 1.6].forEach(xOffset => {
        const podGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.1, 16);
        podGeo.rotateX(Math.PI / 2);
        const pod = new THREE.Mesh(podGeo, darkMat);
        pod.position.set(xOffset, -0.42, 0.4);
        group.add(pod);

        // Pylon bracket to wing
        const pylonGeo = new THREE.BoxGeometry(0.08, 0.3, 0.5);
        const pylon = new THREE.Mesh(pylonGeo, darkMat);
        pylon.position.set(xOffset, -0.2, 0.4);
        group.add(pylon);

        // Spinning Turbine Fan Blades
        const bladeGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 8);
        bladeGeo.rotateX(Math.PI / 2);
        const bladeMesh = new THREE.Mesh(bladeGeo, glassMat);
        bladeMesh.position.set(xOffset, -0.42, 0.9);
        group.add(bladeMesh);
        turbines.push(bladeMesh);
      });
      movingPartsRef.current.turbines = turbines;

      // 6. Vertical Tail Fin with Aegis Branding
      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0);
      finShape.lineTo(0.3, 1.4);
      finShape.lineTo(-0.7, 1.3);
      finShape.lineTo(-1.2, 0);
      finShape.closePath();
      const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: false });
      finGeo.rotateY(Math.PI / 2);
      const fin = new THREE.Mesh(finGeo, orangeMat);
      fin.position.set(-0.04, 0.45, -2.2);
      group.add(fin);

      // 7. Horizontal Stabilizers
      const stabGeo = new THREE.BoxGeometry(2.4, 0.05, 0.6);
      const stab = new THREE.Mesh(stabGeo, whiteMat);
      stab.position.set(0, 0.5, -2.4);
      group.add(stab);

      // 8. Flashing Navigation Wingtip Beacons
      const beaconGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const redBeaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const greenBeaconMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const leftBeacon = new THREE.Mesh(beaconGeo, redBeaconMat);
      leftBeacon.position.set(-3.7, 0, -0.7);
      group.add(leftBeacon);

      const rightBeacon = new THREE.Mesh(beaconGeo, greenBeaconMat);
      rightBeacon.position.set(3.7, 0, -0.7);
      group.add(rightBeacon);

    } else if (activeVehicle === 'sea') {
      // ==========================================
      // 🚢 3D OCEAN CARGO CONTAINER VESSEL (9 PARTS)
      // ==========================================
      const hullMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.3, wireframe: wire });
      const deckMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.35, wireframe: wire });
      const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf77f00, metalness: 0.3, roughness: 0.4, wireframe: wire });
      const tealMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.2, roughness: 0.5, wireframe: wire });
      const blueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.2, roughness: 0.5, wireframe: wire });
      const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.2, roughness: 0.2, wireframe: wire });

      // 1. Lower Ship Hull with flared bow
      const hullShape = new THREE.Shape();
      hullShape.moveTo(-0.9, -2.6);
      hullShape.lineTo(0.9, -2.6);
      hullShape.lineTo(0.9, 1.8);
      hullShape.lineTo(0, 3.2); // Bow peak
      hullShape.lineTo(-0.9, 1.8);
      hullShape.closePath();

      const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.1 });
      hullGeo.rotateX(Math.PI / 2);
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.y = 0.5;
      hull.castShadow = true;
      group.add(hull);

      // 2. Weather Deck
      const deckGeo = new THREE.BoxGeometry(1.6, 0.15, 4.6);
      const deck = new THREE.Mesh(deckGeo, deckMat);
      deck.position.set(0, 0.55, 0);
      group.add(deck);

      // 3. Multi-Colored Stacked 40ft TEU Cargo Containers
      const containerMats = [orangeMat, tealMat, blueMat];
      const rows = 5;
      const stacks = 3;
      for (let r = 0; r < rows; r++) {
        for (let s = 0; s < stacks; s++) {
          const cGeo = new THREE.BoxGeometry(0.38, 0.35, 0.65);
          const mat = containerMats[(r + s) % containerMats.length];
          const containerMesh = new THREE.Mesh(cGeo, mat);
          containerMesh.position.set(
            (s - 1) * 0.44,
            0.8 + Math.floor(r % 2) * 0.35,
            -1.2 + r * 0.72
          );
          containerMesh.castShadow = true;
          group.add(containerMesh);
        }
      }

      // 4. Multi-Deck Navigation Bridge & Quarters
      const bridgeGeo = new THREE.BoxGeometry(1.2, 1.1, 0.8);
      const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
      bridge.position.set(0, 1.2, -1.9);
      bridge.castShadow = true;
      group.add(bridge);

      // 5. Radar Mast & Antenna
      const mastGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.9, 8);
      const mast = new THREE.Mesh(mastGeo, hullMat);
      mast.position.set(0, 2.1, -1.9);
      group.add(mast);

      // 6. Animated Water Wake
      const wakeGeo = new THREE.RingGeometry(1.4, 3.2, 32);
      const wakeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide
      });
      const wakeMesh = new THREE.Mesh(wakeGeo, wakeMat);
      wakeMesh.rotation.x = -Math.PI / 2;
      wakeMesh.position.y = 0.02;
      group.add(wakeMesh);
      movingPartsRef.current.wakeMesh = wakeMesh;

    } else if (activeVehicle === 'road') {
      // ==========================================
      // 🚛 3D COLD-CHAIN HIGHWAY REEFER RIG (8 PARTS)
      // ==========================================
      const cabMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5, roughness: 0.25, wireframe: wire });
      const trailerMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.3, roughness: 0.2, wireframe: wire });
      const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf77f00, metalness: 0.6, roughness: 0.3, wireframe: wire });
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1, wireframe: wire });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.1, wireframe: wire });

      // 1. Truck Driver Tractor Cab
      const cabGeo = new THREE.BoxGeometry(1.3, 1.4, 1.5);
      const cab = new THREE.Mesh(cabGeo, cabMat);
      cab.position.set(0, 0.9, 1.8);
      cab.castShadow = true;
      group.add(cab);

      // 2. Tinted Windshield Glass
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, metalness: 0.9, roughness: 0.1, wireframe: wire });
      const windGeo = new THREE.BoxGeometry(1.15, 0.55, 0.1);
      const windMesh = new THREE.Mesh(windGeo, glassMat);
      windMesh.position.set(0, 1.15, 2.56);
      group.add(windMesh);

      // 3. Chrome Front Grille & Headlights
      const grillGeo = new THREE.BoxGeometry(0.9, 0.45, 0.1);
      const grill = new THREE.Mesh(grillGeo, chromeMat);
      grill.position.set(0, 0.5, 2.56);
      group.add(grill);

      // 4. Insulated Reefer Container Trailer
      const trailerGeo = new THREE.BoxGeometry(1.35, 1.6, 3.8);
      const trailer = new THREE.Mesh(trailerGeo, trailerMat);
      trailer.position.set(0, 1.1, -0.85);
      trailer.castShadow = true;
      group.add(trailer);

      // 5. Refrigeration Cooling Unit on Nose of Trailer
      const reeferUnitGeo = new THREE.BoxGeometry(0.8, 0.6, 0.35);
      const reeferUnit = new THREE.Mesh(reeferUnitGeo, orangeMat);
      reeferUnit.position.set(0, 1.5, 1.1);
      group.add(reeferUnit);

      // 6. Dual-Axle Rotating Heavy Rubber Wheels (6 wheels)
      const wheels: THREE.Mesh[] = [];
      const wheelPositions: [number, number, number][] = [
        [-0.7, 0.35, 1.8], [0.7, 0.35, 1.8],    // Front cab
        [-0.7, 0.35, -1.8], [0.7, 0.35, -1.8],  // Rear trailer 1
        [-0.7, 0.35, -2.4], [0.7, 0.35, -2.4],  // Rear trailer 2
      ];

      wheelPositions.forEach(([x, y, z]) => {
        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMesh = new THREE.Mesh(wheelGeo, tireMat);
        wheelMesh.position.set(x, y, z);
        wheelMesh.castShadow = true;
        group.add(wheelMesh);
        wheels.push(wheelMesh);
      });
      movingPartsRef.current.wheels = wheels;

      // 7. Moving Highway Stripe
      const roadGeo = new THREE.BoxGeometry(0.12, 0.02, 1.6);
      const roadMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const roadStripe = new THREE.Mesh(roadGeo, roadMat);
      roadStripe.position.set(0, 0.01, 0);
      group.add(roadStripe);
      movingPartsRef.current.roadStripe = roadStripe;
    }
  }, [activeVehicle, viewMode]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-[#1d2f65] bg-[#0c152e] shadow-2xl flex flex-col">
      {/* Top 3D Vehicle HUD Overlay */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="bg-[#050a18]/90 backdrop-blur border border-[#1d2f65] px-3 py-1.5 rounded-xl shadow flex items-center space-x-2 pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">3D Delivery Telematics</div>
            <div className="text-xs font-bold text-white flex items-center space-x-1.5">
              <span>{trackingNumber}</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 font-mono rounded">
                {progressPct}% COMPLETE
              </span>
            </div>
          </div>
        </div>

        {/* View mode toggle & auto-rotate */}
        <div className="flex items-center space-x-1.5 pointer-events-auto">
          <button
            onClick={() => setViewMode(prev => prev === 'realistic' ? 'wireframe' : 'realistic')}
            className="bg-[#050a18]/90 hover:bg-[#142045] border border-[#1d2f65] text-xs px-2.5 py-1.5 rounded-lg text-slate-200 transition shadow flex items-center space-x-1"
            title="Toggle Wireframe CAD Blueprint"
          >
            <Box className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-mono">{viewMode === 'realistic' ? 'PBR Shader' : 'CAD Wireframe'}</span>
          </button>
          <button
            onClick={() => setIsRotating(prev => !prev)}
            className={`border text-xs px-2.5 py-1.5 rounded-lg transition shadow flex items-center space-x-1 ${
              isRotating ? 'bg-[#050a18]/90 border-cyan-500/50 text-cyan-400' : 'bg-[#050a18]/90 border-[#1d2f65] text-slate-400'
            }`}
            title="Toggle Continuous 3D Orbital Rotation"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono">{isRotating ? 'Rotating' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* WebGL Canvas Container */}
      <div
        ref={mountRef}
        className="w-full h-80 sm:h-96 cursor-grab active:cursor-grabbing select-none"
        title="Click and drag to orbit 360° in 3D space"
      />

      {/* Bottom Consolidated Vehicle Controls (Zero Viewport Occlusion) */}
      <div className="p-3 bg-[#050a18]/95 border-t border-[#1d2f65] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Vehicle Switcher */}
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-400 text-[11px] font-mono mr-1 hidden sm:inline">3D Fleet:</span>
          <button
            onClick={() => setActiveVehicle('air')}
            className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center space-x-1.5 ${
              activeVehicle === 'air'
                ? 'bg-[#f77f00] text-white shadow ring-2 ring-[#f77f00]/40'
                : 'bg-[#0c152e] text-slate-300 hover:bg-[#142045] border border-[#1d2f65]'
            }`}
          >
            <Plane className="w-3.5 h-3.5" />
            <span>Air Cargo (777F)</span>
          </button>
          <button
            onClick={() => setActiveVehicle('sea')}
            className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center space-x-1.5 ${
              activeVehicle === 'sea'
                ? 'bg-[#f77f00] text-white shadow ring-2 ring-[#f77f00]/40'
                : 'bg-[#0c152e] text-slate-300 hover:bg-[#142045] border border-[#1d2f65]'
            }`}
          >
            <Ship className="w-3.5 h-3.5" />
            <span>Ocean Cargo (TEU)</span>
          </button>
          <button
            onClick={() => setActiveVehicle('road')}
            className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center space-x-1.5 ${
              activeVehicle === 'road'
                ? 'bg-[#f77f00] text-white shadow ring-2 ring-[#f77f00]/40'
                : 'bg-[#0c152e] text-slate-300 hover:bg-[#142045] border border-[#1d2f65]'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Reefer Hauler</span>
          </button>
        </div>

        {/* Real-time Telemetry Readout */}
        <div className="flex items-center space-x-3 text-slate-300 font-mono text-[11px]">
          <div>
            <span className="text-slate-400 font-sans">Speed: </span>
            <span className="text-emerald-400 font-bold">{speed}</span>
          </div>
          <div className="h-3 w-px bg-[#1d2f65]"></div>
          <div>
            <span className="text-slate-400 font-sans">Cargo Temp: </span>
            <span className="text-cyan-400 font-bold">{temperature}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

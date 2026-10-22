import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Plane,
  Ship,
  Truck,
  RotateCw,
  Eye,
  X,
  Compass,
  Maximize2,
  Minimize2,
  Box,
  Layers,
  MapPin,
  Clock,
  Gauge,
  Navigation,
  Crosshair,
  CheckCircle,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Thermometer,
  Zap,
  QrCode
} from 'lucide-react';
import { AWBShipmentRecord } from '../data/awbShipments.ts';
import ScannableQRCode from './ScannableQRCode.tsx';

interface Map3DVehicleOverlayProps {
  shipment: AWBShipmentRecord | null;
  onClose?: () => void;
  onLocateOnMap?: (coords: [number, number]) => void;
  allCarriers?: { id: string; name: string; mode: 'air' | 'sea' | 'road'; awbNumber?: string }[];
  onSelectCarrierId?: (id: string) => void;
}

type CameraPreset = 'orbit' | 'chase' | 'top';

export default function Map3DVehicleOverlay({
  shipment,
  onClose,
  onLocateOnMap,
  allCarriers,
  onSelectCarrierId
}: Map3DVehicleOverlayProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [camPreset, setCamPreset] = useState<CameraPreset>('orbit');

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const vehicleGroupRef = useRef<THREE.Group | null>(null);
  const movingPartsRef = useRef<{
    turbines?: THREE.Mesh[];
    wheels?: THREE.Mesh[];
    wakeMesh?: THREE.Mesh;
    radarMast?: THREE.Mesh;
    roadStripe?: THREE.Mesh;
  }>({});

  const isPointerDownRef = useRef<boolean>(false);
  const prevPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotTargetRef = useRef<{ x: number; y: number }>({ x: 0.22, y: -0.55 });
  const rotCurrentRef = useRef<{ x: number; y: number }>({ x: 0.22, y: -0.55 });
  const animFrameIdRef = useRef<number>(0);

  // Apply camera preset positioning
  const applyCameraPreset = useCallback((preset: CameraPreset) => {
    setCamPreset(preset);
    const camera = cameraRef.current;
    if (!camera) return;

    if (preset === 'orbit') {
      rotTargetRef.current = { x: 0.22, y: -0.55 };
      camera.position.set(0, 2.6, 6.2);
      camera.lookAt(0, 0.2, 0);
    } else if (preset === 'chase') {
      // Rear chase/cockpit angle looking forward along trajectory
      rotTargetRef.current = { x: 0.1, y: 0 };
      camera.position.set(0, 1.8, -5.5);
      camera.lookAt(0, 0.4, 2);
    } else if (preset === 'top') {
      // Direct orthographic top-down satellite angle
      rotTargetRef.current = { x: Math.PI / 2 - 0.05, y: 0 };
      camera.position.set(0, 7.5, 0.1);
      camera.lookAt(0, 0, 0);
    }
  }, []);

  // WebGL 3D Scene Initialization
  useEffect(() => {
    if (isMinimized) return;
    const container = mountRef.current;
    if (!container || !shipment) return;

    // Detect software WebGL guard
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 210;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060e24);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 80);
    camera.position.set(0, 2.6, 6.2);
    camera.lookAt(0, 0.2, 0);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and tone mapping
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSoftwareGl ? 1 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting & Reflection Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment()).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.9);
    sunLight.position.set(6, 12, 6);
    scene.add(sunLight);

    const cyanRim = new THREE.DirectionalLight(0x06b6d4, 1.4);
    cyanRim.position.set(-6, -2, -6);
    scene.add(cyanRim);

    const orangeFill = new THREE.DirectionalLight(0xf77f00, 1.0);
    orangeFill.position.set(4, -4, 4);
    scene.add(orangeFill);

    const ambient = new THREE.AmbientLight(0x1a294d, 1.0);
    scene.add(ambient);

    // 5. Build Procedural 3D Model matching shipment mode
    const vGroup = new THREE.Group();
    movingPartsRef.current = {};

    if (shipment.mode === 'air') {
      // ==========================================
      // BOEING 777F FREIGHTER CARGO AIRCRAFT
      // ==========================================
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.3, wireframe });
      const bellyMat = new THREE.MeshStandardMaterial({ color: 0x0c152e, roughness: 0.35, metalness: 0.5, wireframe });
      const wingMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.4, wireframe });
      const engineMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.7, wireframe });
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.1, metalness: 0.9, wireframe });
      const orangeAccent = new THREE.MeshStandardMaterial({ color: 0xf77f00, roughness: 0.2, metalness: 0.1, wireframe });
      const cockpitGlass = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9, wireframe });

      // Fuselage (Cylinder)
      const fuseGeom = new THREE.CylinderGeometry(0.55, 0.5, 4.6, 24);
      fuseGeom.rotateX(Math.PI / 2);
      const fuselage = new THREE.Mesh(fuseGeom, bodyMat);
      vGroup.add(fuselage);

      // Belly Casing
      const bellyGeom = new THREE.CylinderGeometry(0.56, 0.51, 3.2, 24, 1, false, 0, Math.PI);
      bellyGeom.rotateX(Math.PI / 2);
      bellyGeom.rotateZ(Math.PI);
      const belly = new THREE.Mesh(bellyGeom, bellyMat);
      vGroup.add(belly);

      // Aerodynamic Nose Cone
      const noseGeom = new THREE.ConeGeometry(0.55, 1.1, 24);
      noseGeom.rotateX(-Math.PI / 2);
      const nose = new THREE.Mesh(noseGeom, bodyMat);
      nose.position.z = 2.85;
      vGroup.add(nose);

      // Cockpit Window Band
      const glassGeom = new THREE.CylinderGeometry(0.56, 0.56, 0.4, 24, 1, false, Math.PI * 0.3, Math.PI * 0.4);
      glassGeom.rotateX(Math.PI / 2);
      const cockpit = new THREE.Mesh(glassGeom, cockpitGlass);
      cockpit.position.set(0, 0.1, 2.2);
      vGroup.add(cockpit);

      // Swept Main Wings
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(3.4, -1.3);
      wingShape.lineTo(3.4, -1.6);
      wingShape.lineTo(0.4, -0.6);
      wingShape.lineTo(-0.4, -0.6);
      wingShape.lineTo(-3.4, -1.6);
      wingShape.lineTo(-3.4, -1.3);
      wingShape.closePath();
      const wingExt = new THREE.ExtrudeGeometry(wingShape, { depth: 0.08, bevelEnabled: false });
      wingExt.rotateX(Math.PI / 2);
      const wings = new THREE.Mesh(wingExt, wingMat);
      wings.position.set(0, 0, 0.3);
      vGroup.add(wings);

      // Winglets with safety colors
      const wingletGeom = new THREE.BoxGeometry(0.06, 0.38, 0.28);
      const wlRight = new THREE.Mesh(wingletGeom, orangeAccent);
      wlRight.position.set(3.4, 0.22, -1.05);
      const wlLeft = new THREE.Mesh(wingletGeom, orangeAccent);
      wlLeft.position.set(-3.4, 0.22, -1.05);
      vGroup.add(wlRight, wlLeft);

      // Twin GE90 Turbofans with animated 3D spin blades
      movingPartsRef.current.turbines = [];
      [-1.4, 1.4].forEach(xOffset => {
        const podGeom = new THREE.CylinderGeometry(0.32, 0.3, 1.3, 20);
        podGeom.rotateX(Math.PI / 2);
        const pod = new THREE.Mesh(podGeom, engineMat);
        pod.position.set(xOffset, -0.4, 0.3);

        const hubGeom = new THREE.ConeGeometry(0.12, 0.35, 12);
        hubGeom.rotateX(-Math.PI / 2);
        const hub = new THREE.Mesh(hubGeom, bladeMat);
        hub.position.z = 0.65;
        pod.add(hub);

        const fanGroup = new THREE.Group();
        fanGroup.position.z = 0.55;
        for (let i = 0; i < 8; i++) {
          const bladeG = new THREE.BoxGeometry(0.04, 0.22, 0.01);
          bladeG.rotateZ((i * Math.PI) / 4);
          const blade = new THREE.Mesh(bladeG, bladeMat);
          fanGroup.add(blade);
        }
        pod.add(fanGroup);
        movingPartsRef.current.turbines?.push(fanGroup as unknown as THREE.Mesh);
        vGroup.add(pod);
      });

      // Vertical Tail Fin
      const tailFinShape = new THREE.Shape();
      tailFinShape.moveTo(0, 0);
      tailFinShape.lineTo(0, 1.4);
      tailFinShape.lineTo(-0.7, 1.4);
      tailFinShape.lineTo(-1.3, 0);
      tailFinShape.closePath();
      const finExt = new THREE.ExtrudeGeometry(tailFinShape, { depth: 0.06, bevelEnabled: false });
      const vertFin = new THREE.Mesh(finExt, orangeAccent);
      vertFin.position.set(-0.03, 0.5, -1.4);
      vGroup.add(vertFin);

      // Horizontal Stabilizers
      const hStabShape = new THREE.Shape();
      hStabShape.moveTo(0, 0);
      hStabShape.lineTo(1.3, -0.6);
      hStabShape.lineTo(1.3, -0.8);
      hStabShape.lineTo(-1.3, -0.8);
      hStabShape.lineTo(-1.3, -0.6);
      hStabShape.closePath();
      const hStabExt = new THREE.ExtrudeGeometry(hStabShape, { depth: 0.05, bevelEnabled: false });
      hStabExt.rotateX(Math.PI / 2);
      const hStab = new THREE.Mesh(hStabExt, wingMat);
      hStab.position.set(0, 0.45, -2.0);
      vGroup.add(hStab);

      // Flight Level Elevation Ring on Ground
      const ringGeom = new THREE.RingGeometry(2.0, 2.1, 32);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true, transparent: true, opacity: 0.35 });
      const groundRing = new THREE.Mesh(ringGeom, ringMat);
      groundRing.position.y = -1.6;
      vGroup.add(groundRing);

    } else if (shipment.mode === 'sea') {
      // ==========================================
      // ULTRA-LARGE CONTAINER VESSEL
      // ==========================================
      const hullMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.3, wireframe });
      const keelMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4, metalness: 0.2, wireframe });
      const deckMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.1, wireframe });
      const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.4, wireframe });
      const radarMat = new THREE.MeshStandardMaterial({ color: 0xf77f00, roughness: 0.2, metalness: 0.8, wireframe });

      // Lower Hull (Red Keel)
      const keelGeom = new THREE.BoxGeometry(1.6, 0.5, 5.0);
      const keel = new THREE.Mesh(keelGeom, keelMat);
      keel.position.y = -0.35;
      vGroup.add(keel);

      // Upper Hull (Black/Charcoal)
      const hullGeom = new THREE.BoxGeometry(1.7, 0.6, 5.2);
      const hull = new THREE.Mesh(hullGeom, hullMat);
      hull.position.y = 0.2;
      vGroup.add(hull);

      // Pointed Bow
      const bowGeom = new THREE.ConeGeometry(0.85, 1.4, 4);
      bowGeom.rotateX(Math.PI / 2);
      bowGeom.rotateY(Math.PI / 4);
      const bow = new THREE.Mesh(bowGeom, hullMat);
      bow.position.set(0, 0.2, 2.9);
      vGroup.add(bow);

      // Weather Deck
      const deckGeom = new THREE.BoxGeometry(1.6, 0.1, 5.0);
      const deck = new THREE.Mesh(deckGeom, deckMat);
      deck.position.y = 0.55;
      vGroup.add(deck);

      // Container Stacks (Multi-Colored TEUs)
      const containerColors = [0x0284c7, 0xf97316, 0x10b981, 0x8b5cf6, 0xf43f5e, 0xfacc15];
      for (let row = -1.6; row <= 1.4; row += 0.7) {
        for (let col = -0.48; col <= 0.48; col += 0.48) {
          for (let tier = 0; tier < 3; tier++) {
            const cColor = containerColors[Math.abs(Math.round(row * 3 + col * 5 + tier)) % containerColors.length];
            const cMat = new THREE.MeshStandardMaterial({ color: cColor, roughness: 0.5, metalness: 0.2, wireframe });
            const cGeom = new THREE.BoxGeometry(0.42, 0.26, 0.62);
            const box = new THREE.Mesh(cGeom, cMat);
            box.position.set(col, 0.72 + tier * 0.28, row);
            vGroup.add(box);
          }
        }
      }

      // Stern Accommodation Bridge
      const bridgeGeom = new THREE.BoxGeometry(1.3, 1.1, 0.75);
      const bridge = new THREE.Mesh(bridgeGeom, bridgeMat);
      bridge.position.set(0, 1.1, -1.9);
      vGroup.add(bridge);

      // Radar Scanner Mast
      const mastGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
      const mast = new THREE.Mesh(mastGeom, bridgeMat);
      mast.position.set(0, 1.9, -1.9);

      const scannerGeom = new THREE.BoxGeometry(0.5, 0.06, 0.06);
      const scanner = new THREE.Mesh(scannerGeom, radarMat);
      scanner.position.y = 0.3;
      mast.add(scanner);
      vGroup.add(mast);
      movingPartsRef.current.radarMast = scanner;

      // Ocean Water Ripple Mesh
      const wakeGeom = new THREE.PlaneGeometry(3.6, 7.5, 12, 12);
      wakeGeom.rotateX(-Math.PI / 2);
      const wakeMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, wireframe: true, transparent: true, opacity: 0.4 });
      const wake = new THREE.Mesh(wakeGeom, wakeMat);
      wake.position.y = -0.55;
      vGroup.add(wake);
      movingPartsRef.current.wakeMesh = wake;

    } else {
      // ==========================================
      // HEAVY-DUTY REEFER HIGHWAY TRUCK
      // ==========================================
      const cabMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.4, wireframe });
      const trailerMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.2, wireframe });
      const chassisMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.5, wireframe });
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1, metalness: 0.9, wireframe });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8, metalness: 0.1, wireframe });
      const reeferUnitMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.2, metalness: 0.8, wireframe });

      // Truck Tractor Cab
      const cabGeom = new THREE.BoxGeometry(1.3, 1.4, 1.5);
      const cab = new THREE.Mesh(cabGeom, cabMat);
      cab.position.set(0, 0.9, 1.5);
      vGroup.add(cab);

      // Wind Deflector Aero Fairing
      const deflectorGeom = new THREE.ConeGeometry(0.85, 0.6, 4);
      deflectorGeom.rotateY(Math.PI / 4);
      const deflector = new THREE.Mesh(deflectorGeom, cabMat);
      deflector.position.set(0, 1.85, 1.4);
      vGroup.add(deflector);

      // Front Chrome Grille
      const grilleGeom = new THREE.BoxGeometry(0.9, 0.6, 0.1);
      const grille = new THREE.Mesh(grilleGeom, chromeMat);
      grille.position.set(0, 0.65, 2.26);
      vGroup.add(grille);

      // Refrigerated Cargo Box Trailer (53ft)
      const trailerGeom = new THREE.BoxGeometry(1.4, 1.6, 3.8);
      const trailer = new THREE.Mesh(trailerGeom, trailerMat);
      trailer.position.set(0, 1.15, -1.1);
      vGroup.add(trailer);

      // Thermo King Reefer Unit with status LED
      const reeferGeom = new THREE.BoxGeometry(0.8, 0.7, 0.3);
      const reefer = new THREE.Mesh(reeferGeom, reeferUnitMat);
      reefer.position.set(0, 1.45, 0.9);
      vGroup.add(reefer);

      // Chassis Rails
      const chassisGeom = new THREE.BoxGeometry(1.1, 0.2, 5.0);
      const chassis = new THREE.Mesh(chassisGeom, chassisMat);
      chassis.position.set(0, 0.3, 0.2);
      vGroup.add(chassis);

      // 10 Chrome Wheels with tread
      movingPartsRef.current.wheels = [];
      const wheelPositions: [number, number, number][] = [
        [-0.72, 0.35, 1.6], [0.72, 0.35, 1.6],     // Steer Axle
        [-0.72, 0.35, 0.4], [0.72, 0.35, 0.4],     // Drive Axle 1
        [-0.72, 0.35, -0.4], [0.72, 0.35, -0.4],   // Drive Axle 2
        [-0.72, 0.35, -2.1], [0.72, 0.35, -2.1],   // Trailer Tandem 1
        [-0.72, 0.35, -2.7], [0.72, 0.35, -2.7],   // Trailer Tandem 2
      ];

      wheelPositions.forEach(([x, y, z]) => {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(x, y, z);

        const tireGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.24, 16);
        tireGeom.rotateZ(Math.PI / 2);
        const tire = new THREE.Mesh(tireGeom, tireMat);
        wheelGroup.add(tire);

        const rimGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.26, 12);
        rimGeom.rotateZ(Math.PI / 2);
        const rim = new THREE.Mesh(rimGeom, chromeMat);
        wheelGroup.add(rim);

        vGroup.add(wheelGroup);
        movingPartsRef.current.wheels?.push(wheelGroup as unknown as THREE.Mesh);
      });

      // Asphalt Road Surface with Dashed Centerline
      const roadGeom = new THREE.PlaneGeometry(2.4, 7.0);
      roadGeom.rotateX(-Math.PI / 2);
      const roadMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9, metalness: 0.1 });
      const road = new THREE.Mesh(roadGeom, roadMat);
      road.position.y = -0.02;
      vGroup.add(road);

      const stripeGeom = new THREE.PlaneGeometry(0.12, 1.2);
      stripeGeom.rotateX(-Math.PI / 2);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const stripe = new THREE.Mesh(stripeGeom, stripeMat);
      stripe.position.set(0, 0.01, 0);
      vGroup.add(stripe);
      movingPartsRef.current.roadStripe = stripe;
    }

    scene.add(vGroup);
    vehicleGroupRef.current = vGroup;

    // 6. Interactive Orbit Touch/Mouse Handlers
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

      rotTargetRef.current.y += dx * 0.012;
      rotTargetRef.current.x = Math.max(-0.6, Math.min(1.1, rotTargetRef.current.x + dy * 0.012));

      prevPointerRef.current = { x: clientX, y: clientY };
    };

    const onPointerUp = () => {
      isPointerDownRef.current = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // 7. Animation Loop with subtle kinetic physics
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Exponential damping
      rotCurrentRef.current.x += (rotTargetRef.current.x - rotCurrentRef.current.x) * 0.12;
      rotCurrentRef.current.y += (rotTargetRef.current.y - rotCurrentRef.current.y) * 0.12;

      if (isRotating && !isPointerDownRef.current && camPreset === 'orbit') {
        rotTargetRef.current.y += 0.008;
      }

      if (vehicleGroupRef.current) {
        vehicleGroupRef.current.rotation.x = rotCurrentRef.current.x;
        vehicleGroupRef.current.rotation.y = rotCurrentRef.current.y;

        // Subtle kinetic animations per vehicle mode
        if (shipment.mode === 'air') {
          // Jet banking & elevation floating
          vehicleGroupRef.current.position.y = 0.15 + Math.sin(elapsed * 2.2) * 0.1;
          vehicleGroupRef.current.rotation.z = Math.sin(elapsed * 1.4) * 0.06;

          // Spin turbine fan blades
          movingPartsRef.current.turbines?.forEach(fan => {
            fan.rotation.z += delta * 24;
          });
        } else if (shipment.mode === 'sea') {
          // Ocean heave and pitch
          vehicleGroupRef.current.position.y = 0.02 + Math.sin(elapsed * 1.5) * 0.07;
          vehicleGroupRef.current.rotation.z = Math.sin(elapsed * 1.0) * 0.04;
          vehicleGroupRef.current.rotation.x = rotCurrentRef.current.x + Math.cos(elapsed * 1.2) * 0.03;

          // Rotate radar mast
          if (movingPartsRef.current.radarMast) {
            movingPartsRef.current.radarMast.rotation.y += delta * 3.5;
          }
          if (movingPartsRef.current.wakeMesh) {
            movingPartsRef.current.wakeMesh.position.z = (elapsed * 0.4) % 0.8 - 0.4;
          }
        } else if (shipment.mode === 'road') {
          // Rolling wheels & moving road stripes
          movingPartsRef.current.wheels?.forEach(wheel => {
            wheel.rotation.x += delta * 12;
          });
          vehicleGroupRef.current.position.y = 0.02 + Math.abs(Math.sin(elapsed * 16)) * 0.015;

          if (movingPartsRef.current.roadStripe) {
            movingPartsRef.current.roadStripe.position.z = (elapsed * 5) % 2 - 1;
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler via ResizeObserver
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      dom.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      dom.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      renderer.dispose();
      scene.clear();
    };
  }, [shipment, wireframe, isRotating, isMinimized, camPreset]);

  if (!shipment) return null;

  // Handle locate click
  const handleLocate = () => {
    if (onLocateOnMap) {
      onLocateOnMap(shipment.currentCoords);
    }
  };

  // Minimized pill state
  if (isMinimized) {
    return (
      <div
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        className="absolute bottom-3 right-3 z-[450] pointer-events-auto bg-[#0c152e]/95 backdrop-blur-xl border border-cyan-500/70 shadow-2xl rounded-2xl p-2.5 flex items-center space-x-2 text-xs select-none max-w-sm"
      >
        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold">
          {shipment.mode === 'air' ? '✈️' : shipment.mode === 'sea' ? '🚢' : '🚛'}
        </div>
        <div className="truncate">
          <div className="font-bold text-white flex items-center space-x-1">
            <span>{shipment.carrierId}</span>
            <span className="text-[10px] text-cyan-400 font-mono">[{shipment.awbNumber}]</span>
          </div>
          <div className="text-[10px] text-slate-300 font-mono">
            {shipment.currentCoords[0].toFixed(2)}°N, {shipment.currentCoords[1].toFixed(2)}°E • {shipment.speed}
          </div>
        </div>

        <div className="flex items-center space-x-1 flex-shrink-0">
          <button
            onClick={handleLocate}
            title="Locate Vehicle on Map"
            className="p-1 rounded-lg bg-[#142045] hover:bg-cyan-500/30 text-cyan-300 border border-[#1d2f65] transition"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMinimized(false)}
            title="Expand 3D Model View"
            className="p-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-500/50 transition flex items-center space-x-0.5 px-2"
          >
            <Maximize2 className="w-3 h-3" />
            <span className="text-[10px] font-bold">3D</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close 3D Overlay"
              className="p-1 rounded-lg bg-[#142045] text-slate-400 hover:text-white border border-[#1d2f65]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Expanded Floating 3D Overlay
  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      className="absolute bottom-3 right-3 z-[450] pointer-events-auto w-[360px] sm:w-[390px] max-w-[calc(100vw-24px)] bg-[#0c152e]/95 backdrop-blur-2xl border-2 border-cyan-500/80 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-200 select-none"
    >
      {/* Top Header Card */}
      <div className="p-2.5 sm:p-3 bg-gradient-to-r from-cyan-950/80 via-[#142045] to-[#0c152e] border-b border-[#1d2f65] flex items-center justify-between">
        <div className="flex items-center space-x-2 truncate">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-300 flex-shrink-0">
            {shipment.mode === 'air' ? <Plane className="w-4 h-4" /> : shipment.mode === 'sea' ? <Ship className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
          </div>
          <div className="truncate">
            <div className="flex items-center space-x-1.5">
              <span className="text-[9px] uppercase font-mono font-extrabold text-cyan-400 tracking-wider">3D GPS MODEL OVERLAY</span>
              <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                LIVE
              </span>
            </div>
            <h4 className="text-xs font-bold text-white font-mono truncate">
              {shipment.awbNumber} • <span className="text-slate-300 font-sans font-medium">{shipment.carrierId}</span>
            </h4>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          <button
            onClick={handleLocate}
            title="Center Map on this Vehicle"
            className="p-1.5 rounded-lg bg-[#050a18] hover:bg-cyan-500/30 text-cyan-400 border border-[#1d2f65] transition"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setWireframe(prev => !prev)}
            title="Toggle CAD Wireframe"
            className={`p-1.5 rounded-lg border text-xs transition ${
              wireframe ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400' : 'bg-[#050a18] text-slate-400 border-[#1d2f65] hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsRotating(prev => !prev)}
            title="Toggle Continuous Spin"
            className={`p-1.5 rounded-lg border text-xs transition ${
              isRotating ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400' : 'bg-[#050a18] text-slate-400 border-[#1d2f65] hover:text-white'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            title="Minimize Overlay"
            className="p-1.5 rounded-lg bg-[#050a18] text-slate-400 hover:text-white border border-[#1d2f65] transition"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close 3D Overlay"
              className="p-1.5 rounded-lg bg-[#050a18] text-slate-400 hover:text-red-400 border border-[#1d2f65] transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3D WebGL Canvas Viewport */}
      <div className="relative h-44 sm:h-48 w-full bg-[#060e24] cursor-grab active:cursor-grabbing select-none overflow-hidden">
        <div ref={mountRef} className="w-full h-full" />

        {/* Dynamic GPS Coordinates HUD */}
        <div className="absolute top-2 left-2 pointer-events-none bg-[#050a18]/85 backdrop-blur-md border border-cyan-500/40 rounded-lg px-2 py-0.5 text-[10px] font-mono text-cyan-300 flex items-center space-x-1 shadow">
          <MapPin className="w-3 h-3 text-[#f77f00]" />
          <span>{shipment.currentCoords[0].toFixed(4)}°N, {shipment.currentCoords[1].toFixed(4)}°E</span>
        </div>

        {/* Altitude & Heading Azimuth Pill */}
        <div className="absolute top-2 right-2 pointer-events-none bg-[#050a18]/85 backdrop-blur-md border border-[#1d2f65] rounded-lg px-2 py-0.5 text-[10px] font-mono text-slate-200 flex items-center space-x-1 shadow">
          <Compass className="w-3 h-3 text-cyan-400" />
          <span>HDG {shipment.headingDegrees}° • {shipment.altitudeMeters > 0 ? `${shipment.altitudeMeters.toLocaleString()}m` : 'Sea Level'}</span>
        </div>

        {/* View Angle Presets Pill Bar */}
        <div className="absolute bottom-2 left-2 flex items-center space-x-1 z-10 bg-[#050a18]/80 backdrop-blur border border-[#1d2f65] rounded-lg p-0.5">
          <button
            onClick={() => applyCameraPreset('orbit')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
              camPreset === 'orbit' ? 'bg-[#f77f00] text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Orbit
          </button>
          <button
            onClick={() => applyCameraPreset('chase')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
              camPreset === 'chase' ? 'bg-[#f77f00] text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Chase
          </button>
          <button
            onClick={() => applyCameraPreset('top')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
              camPreset === 'top' ? 'bg-[#f77f00] text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Top
          </button>
        </div>

        {/* Drag Hint */}
        <div className="absolute bottom-2 right-2 pointer-events-none text-[9px] text-slate-400/80 font-mono bg-[#050a18]/60 px-1.5 py-0.5 rounded">
          🖱️ 360° Drag Orbit
        </div>
      </div>

      {/* Shipment Telematics & Specs Card */}
      <div className="p-2.5 sm:p-3 bg-[#0c152e] space-y-2 text-xs border-t border-[#1d2f65]">
        {/* Metric Badges */}
        <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
          <div className="bg-[#050a18] p-1.5 rounded-xl border border-[#1d2f65]">
            <span className="text-[9px] text-slate-400 block font-sans">Speed</span>
            <span className="text-emerald-400 font-bold block truncate">{shipment.speed}</span>
          </div>
          <div className="bg-[#050a18] p-1.5 rounded-xl border border-[#1d2f65]">
            <span className="text-[9px] text-slate-400 block font-sans">Cold-Chain</span>
            <span className="text-cyan-300 font-bold block">{shipment.cargoTemp}</span>
          </div>
          <div className="bg-[#050a18] p-1.5 rounded-xl border border-[#1d2f65]">
            <span className="text-[9px] text-slate-400 block font-sans">Arrival (ETA)</span>
            <span className="text-[#f77f00] font-bold block truncate">{shipment.eta}</span>
          </div>
        </div>

        {/* Corridor Info */}
        <div className="bg-[#050a18]/90 p-2 rounded-xl border border-[#1d2f65] text-[11px] space-y-1">
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Route Corridor:</span>
            <span className="font-bold text-white font-mono">{shipment.origin.code} ➔ {shipment.destination.code}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Payload Manifest:</span>
            <span className="font-medium text-slate-200 truncate max-w-[190px]">{shipment.product}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Vessel / Model:</span>
            <span className="text-cyan-400 font-mono font-bold truncate max-w-[190px]">{shipment.vehicleName}</span>
          </div>

          {/* Real Scannable Air Waybill Smart QR Code */}
          <div className="flex items-center space-x-2 pt-1.5 border-t border-[#1d2f65]">
            <ScannableQRCode
              value={`https://aegischain.live/track/${shipment.awbNumber}?carrier=${shipment.carrierId}&lat=${shipment.currentCoords[0]}&lng=${shipment.currentCoords[1]}&heading=${shipment.headingDegrees}&speed=${encodeURIComponent(shipment.speed)}`}
              size={48}
              label={shipment.awbNumber}
              sublabel={`${shipment.vehicleName} • GPS: ${shipment.currentCoords[0].toFixed(3)}°N, ${shipment.currentCoords[1].toFixed(3)}°E`}
              className="flex-shrink-0"
            />
            <div className="text-[10px] space-y-0.5 text-slate-300 min-w-0">
              <div className="font-bold text-white flex items-center space-x-1">
                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Scannable Digital AWB</span>
              </div>
              <p className="text-slate-400 text-[9px] leading-tight">
                Scan with any smartphone camera to view live cargo manifest & GPS proof.
              </p>
            </div>
          </div>
        </div>

        {/* Fleet Vehicle Switcher */}
        {allCarriers && allCarriers.length > 0 && onSelectCarrierId && (
          <div className="pt-0.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mb-1">
              <span>Switch 3D Carrier View:</span>
              <span className="font-mono text-cyan-400">{allCarriers.length} Connected</span>
            </div>
            <div className="flex space-x-1 overflow-x-auto pb-0.5">
              {allCarriers.map(c => {
                const isSelected = c.id === shipment.carrierId;
                const icon = c.mode === 'air' ? '✈️' : c.mode === 'sea' ? '🚢' : '🚛';
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelectCarrierId(c.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center space-x-1 whitespace-nowrap transition ${
                      isSelected
                        ? 'bg-[#f77f00] text-white shadow ring-1 ring-[#f77f00]'
                        : 'bg-[#050a18] text-slate-300 hover:bg-[#142045] border border-[#1d2f65]'
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{c.id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

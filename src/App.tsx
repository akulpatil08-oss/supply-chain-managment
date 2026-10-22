import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as L from 'leaflet';
import {
  ShieldAlert,
  Cpu,
  Activity,
  Play,
  Minus,
  X,
  Info,
  Plus,
  Sparkles,
  Navigation,
  Phone,
  Crosshair,
  CheckCircle,
  Fingerprint,
  Scan,
  Wifi,
  UserCheck,
  Server,
  AlertTriangle,
  AlertOctagon,
  Camera,
  PlusCircle,
  Zap,
  Box,
  CloudLightning,
  MapPin,
  Check,
  GitMerge,
  ShieldCheck,
  Wind,
  Layers,
  Globe,
  Sliders,
  PhoneCall,
  Headset,
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  Timer,
  Gauge,
  FastForward,
  ArrowRight,
  Code2,
  PackageCheck,
  Bot,
  Search
} from 'lucide-react';
import AIAssistantWidget from './components/AIAssistantWidget.tsx';
import DeveloperIntegrationModal from './components/DeveloperIntegrationModal.tsx';
import UniversalSearchModal from './components/UniversalSearchModal.tsx';
import Map3DVehicleOverlay from './components/Map3DVehicleOverlay.tsx';
import ScannableQRCode from './components/ScannableQRCode.tsx';
import { AWBShipmentRecord, INITIAL_AWB_DATABASE, getAWBShipment } from './data/awbShipments.ts';

// ==========================================
// TYPES & DATA STRUCTURES
// ==========================================
export interface RiskFactors {
  weather: { name: string; score: number; max: number; detail: string };
  route: { name: string; score: number; max: number; detail: string };
  cargo: { name: string; score: number; max: number; detail: string };
  trust: { name: string; score: number; max: number; detail: string };
}

export interface Carrier {
  id: string;
  awbNumber: string;
  mode: 'air' | 'sea' | 'road';
  name: string;
  hubId: string;
  product: string;
  origin: string;
  dest: string;
  status: 'on_time' | 'at_risk' | 'disrupted';
  risk: number;
  riskFactors: RiskFactors;
  riskJustification: string;
  coords: [number, number];
  headingDegrees: number;
  altitudeMeters: number;
  captain: string;
  manifest: string;
  connectedShipmentId: string;
  interconnectDesc: string;
  path: [number, number][];
  detourPath: [number, number][];
  cause: string;
  solution: string;
  delay: string;
  fuel: string;
  tele: {
    temp: string;
    alt: string;
    shock: string;
    speed: string;
  };
}

export interface Hub {
  id: string;
  name: string;
  coords: [number, number];
  type: string;
  connecting: string;
  status: string;
  berths: string;
  dwell: string;
}

export interface Hazard {
  id: string;
  center: [number, number];
  radius: number;
  name: string;
  metricName: string;
  currentMetric: string;
  currentValue: number;
  thresholdLimit: string;
  thresholdValue: number;
  isBreached: boolean;
  affectedCarrierId: string;
  color: string;
  detail: string;
}

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  color: 'emerald' | 'red' | 'cyan' | 'orange' | 'amber';
}

const SUPPORT_PHONE = "9353086392";
const CARTO_KEY = "cb1_4oqe_1_e5924c9747d319d1bd433727";

// ==========================================
// REAL-TIME DISTANCE & ETA CALCULATION HELPERS
// ==========================================
export function haversineDistanceKm(c1: [number, number], c2: [number, number]): number {
  const R = 6371; // Earth radius in km
  const dLat = ((c2[0] - c1[0]) * Math.PI) / 180;
  const dLon = ((c2[1] - c1[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1[0] * Math.PI) / 180) *
      Math.cos((c2[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function parseSpeedToKmH(speedStr: string): number {
  if (!speedStr) return 65;
  if (speedStr.includes('Mach')) {
    const mach = parseFloat(speedStr.replace(/[^0-9.]/g, '')) || 0.82;
    return Math.round(mach * 1062); // Jet cruise speed in km/h
  }
  if (speedStr.includes('Knots')) {
    const knots = parseFloat(speedStr.replace(/[^0-9.]/g, '')) || 19.5;
    return Math.round(knots * 1.852); // Nautical knots to km/h
  }
  const kmh = parseFloat(speedStr.replace(/[^0-9.]/g, '')) || 65;
  return Math.round(kmh);
}

export function calculateRouteDistanceAndProgress(
  currentCoords: [number, number],
  activePath: [number, number][]
): { totalKm: number; directKm: number; progressPct: number } {
  if (!activePath || activePath.length === 0) {
    return { totalKm: 0, directKm: 0, progressPct: 0 };
  }
  const destCoords = activePath[activePath.length - 1];
  const directKm = haversineDistanceKm(currentCoords, destCoords);

  // Total planned route distance along entire path
  let totalRouteKm = 0;
  for (let i = 0; i < activePath.length - 1; i++) {
    totalRouteKm += haversineDistanceKm(activePath[i], activePath[i + 1]);
  }
  if (totalRouteKm <= 0) totalRouteKm = directKm || 1;

  // Find closest waypoint index to currentCoords
  let closestIdx = 0;
  let minD = Infinity;
  for (let i = 0; i < activePath.length; i++) {
    const d = haversineDistanceKm(currentCoords, activePath[i]);
    if (d < minD) {
      minD = d;
      closestIdx = i;
    }
  }

  // Calculate distance from current position forward to remaining waypoints
  let remainingKm = 0;
  if (closestIdx < activePath.length - 1) {
    remainingKm += haversineDistanceKm(currentCoords, activePath[closestIdx + 1]);
    for (let i = closestIdx + 1; i < activePath.length - 1; i++) {
      remainingKm += haversineDistanceKm(activePath[i], activePath[i + 1]);
    }
  } else {
    remainingKm = directKm;
  }

  remainingKm = Math.max(remainingKm, directKm);

  if (directKm < 5) {
    remainingKm = 0;
  }

  const completedKm = Math.max(0, totalRouteKm - remainingKm);
  const progressPct = Math.min(100, Math.max(0, Math.round((completedKm / totalRouteKm) * 100)));

  return {
    totalKm: Math.round(remainingKm * 10) / 10,
    directKm: Math.round(directKm * 10) / 10,
    progressPct
  };
}

export function formatEstimatedArrivalTime(now: Date, secondsRemaining: number): {
  fullDisplay: string;
  shortTime: string;
  windowDisplay: string;
} {
  if (secondsRemaining <= 0) {
    return {
      fullDisplay: 'Arrived at Destination Hub',
      shortTime: 'In Port / Dock',
      windowDisplay: 'Immediate Berth Access'
    };
  }

  const target = new Date(now.getTime() + secondsRemaining * 1000);
  const isSameDay =
    now.getFullYear() === target.getFullYear() &&
    now.getMonth() === target.getMonth() &&
    now.getDate() === target.getDate();

  const isTomorrow =
    target.getDate() === now.getDate() + 1 &&
    target.getMonth() === target.getMonth() &&
    target.getFullYear() === now.getFullYear();

  const timeStr = target.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const shortTimeStr = target.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  let dayPrefix = '';
  if (isSameDay) {
    dayPrefix = 'Today, ';
  } else if (isTomorrow) {
    dayPrefix = 'Tomorrow, ';
  } else {
    dayPrefix = target.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ';
  }

  const windowEnd = new Date(target.getTime() + 30 * 60 * 1000);
  const windowEndStr = windowEnd.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return {
    fullDisplay: `${dayPrefix}${timeStr}`,
    shortTime: `${dayPrefix}${shortTimeStr}`,
    windowDisplay: `${shortTimeStr} - ${windowEndStr}`
  };
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

// ==========================================
// INITIAL DATA SEEDS
// ==========================================
const INITIAL_HUBS: Hub[] = [
  {
    id: "BLR",
    name: "Bengaluru Intermodal Hub (Air-Road)",
    coords: [13.1986, 77.7066],
    type: "Air-Highway Gateway",
    connecting: "AC-AIR-501 ➔ AC-ROD-104",
    status: "Operational (0.8ms Sync)",
    berths: "Gate 1-4 Reefer Docks",
    dwell: "42 mins avg"
  },
  {
    id: "MAA",
    name: "Chennai Port Maritime Terminal",
    coords: [13.0827, 80.3200],
    type: "Deep-Sea Port Gateway",
    connecting: "AC-SEA-701 ➔ AC-ROD-415",
    status: "Berth 4 Priority Clear",
    berths: "Berth 4 Container Wharf",
    dwell: "1.2 hrs avg"
  },
  {
    id: "BOM",
    name: "Mumbai Nhava Sheva (JNPT) Terminal",
    coords: [18.9300, 72.8200],
    type: "Container & Chemical Gateway",
    connecting: "AC-SEA-903 ➔ AC-ROD-309",
    status: "Hazmat Gate Scheduled",
    berths: "Berth 2 Chemical Pier",
    dwell: "2.4 hrs avg"
  }
];

const INITIAL_HAZARDS: Hazard[] = [
  {
    id: "haz-bengal",
    center: [9.5, 88.5],
    radius: 340000,
    name: "Bay of Bengal Super Cyclone",
    metricName: "Ocean Swell Height",
    currentMetric: "4.8 m",
    currentValue: 4.8,
    thresholdLimit: "3.5 m",
    thresholdValue: 3.5,
    isBreached: true,
    affectedCarrierId: "AC-SEA-701",
    color: "#ef4444",
    detail: "Tropical swell height (4.8m) exceeds IMO vessel structural tolerance limit (3.5m)."
  },
  {
    id: "haz-redsea",
    center: [20.0, 39.0],
    radius: 350000,
    name: "Red Sea Volcanic Plume (FL360)",
    metricName: "Silicate Ash Density",
    currentMetric: "85 mg/m³",
    currentValue: 85,
    thresholdLimit: "60 mg/m³",
    thresholdValue: 60,
    isBreached: true,
    affectedCarrierId: "AC-AIR-501",
    color: "#ef4444",
    detail: "Airborne ash density exceeds turbine engine safe filtration limits."
  },
  {
    id: "haz-hubballi",
    center: [15.3647, 75.1240],
    radius: 48000,
    name: "Hubballi Flash Flood Basin",
    metricName: "Culvert Water Inundation",
    currentMetric: "2.8 m",
    currentValue: 2.8,
    thresholdLimit: "1.5 m",
    thresholdValue: 1.5,
    isBreached: true,
    affectedCarrierId: "AC-ROD-104",
    color: "#f59e0b",
    detail: "Water overflow over NH-48 culvert exceeds truck chassis clearance."
  }
];

const INITIAL_FLEET: Carrier[] = [
  {
    id: "AC-AIR-501",
    awbNumber: "098-4729104",
    mode: "air",
    name: "Boeing 777-F Cargo",
    hubId: "BLR",
    product: "Lithium Avionics & Vaccines (850 kg)",
    origin: "Frankfurt (FRA)",
    dest: "Bengaluru (BLR)",
    status: "disrupted",
    risk: 84,
    riskFactors: {
      weather: { name: "Volcanic Ash & Atmospheric Swells", score: 38, max: 40, detail: "Doppler radar confirms dense silicate ash cloud over Red Sea crossing FL360 airway." },
      route: { name: "Airway Corridor Restriction", score: 22, max: 25, detail: "Direct flight waypoint closed by regional aviation authorities." },
      cargo: { name: "Cargo Sensitivity (Lithium & Pharma)", score: 18, max: 20, detail: "Cold-chain vaccine payload requires cabin thermal regulation within 2-8°C." },
      trust: { name: "Party Escrow & Intermediary Trust", score: 6, max: 15, detail: "1st-party hardware passkey bound; no proxy anomaly detected." }
    },
    riskJustification: "Composite risk driven by FL360 volcanic ash plume (38/40). Jet turbine glassification danger mandates immediate detour over Arabian Gulf.",
    coords: [25.2, 55.3],
    headingDegrees: 118,
    altitudeMeters: 10972,
    captain: "Cmdr. Hans Meyer • LH-782",
    manifest: "Lithium Avionics & Vaccines (Cold-Chain)",
    connectedShipmentId: "AC-ROD-104",
    interconnectDesc: "Transfers Biopharma vaccine payload at Bengaluru Hub to connecting Reefer Truck AC-ROD-104 for Mumbai delivery.",
    path: [[50.0379, 8.5622], [36.0, 36.0], [25.2, 55.3], [13.1986, 77.7066]],
    detourPath: [[50.0379, 8.5622], [41.0, 44.0], [29.0, 48.0], [20.0, 68.0], [13.1986, 77.7066]],
    cause: "Red Sea Volcanic Ash Plume (Airway FL360 closed)",
    solution: "Divert flight corridor via Northern Arabian Gulf waypoint. Prevents jet turbine abrasion.",
    delay: "4.5 hrs",
    fuel: "+$2,400 (Net save ₹28L)",
    tele: { temp: "4.1°C", alt: "36,000 ft", shock: "0.2 G", speed: "Mach 0.82" }
  },
  {
    id: "AC-ROD-104",
    awbNumber: "125-8849201",
    mode: "road",
    name: "Volvo FH Reefer Rig",
    hubId: "BLR",
    product: "Biopharma Vaccine Cartridges (Connecting Feeder)",
    origin: "Bengaluru Hub",
    dest: "Mumbai Terminal",
    status: "on_time",
    risk: 22,
    riskFactors: {
      weather: { name: "Local Precipitation & Rainfall", score: 6, max: 40, detail: "Open-Meteo reports light drizzle (2mm/h) along Davanagere stretch." },
      route: { name: "Highway Culvert Clearance", score: 5, max: 25, detail: "NH-48 corridor flowing nominally with no active road blocks." },
      cargo: { name: "Cold-Chain Reefer Stability", score: 8, max: 20, detail: "Chamber telemetry stable at 3.8°C with dry ice backup intact." },
      trust: { name: "Driver Credential & Escrow", score: 3, max: 15, detail: "Verified driver KA-01-EQ-9801 verified on GPS cabin telematics." }
    },
    riskJustification: "Nominal baseline parameters across the highway corridor. No immediate mitigation necessary.",
    coords: [15.3647, 75.1240],
    headingDegrees: 334,
    altitudeMeters: 620,
    captain: "Ramesh Kumar • KA-01-EQ-9801",
    manifest: "Vaccine Cartridges (Handoff from AC-AIR-501)",
    connectedShipmentId: "AC-AIR-501",
    interconnectDesc: "Feeder Truck waiting at BLR Intermodal Hub. Dock release auto-synchronized with inbound AC-AIR-501.",
    path: [
      [13.1986, 77.7066], // Bengaluru Hub (Devanahalli)
      [13.2250, 77.4520], // Nelamangala Expressway Junction
      [13.3409, 77.1010], // Tumakuru NH-48 Bypass
      [13.7447, 76.9077], // Sira
      [13.9450, 76.6190], // Hiriyur Bypass
      [14.2251, 76.3980], // Chitradurga Fortress Junction
      [14.4644, 75.9218], // Davanagere NH-48 Tollway
      [14.6231, 75.6239], // Ranebennur Bypass
      [14.7967, 75.4024], // Haveri Bridge
      [14.9856, 75.2530], // Bankapur Toll Plaza
      [15.3647, 75.1240], // Hubballi Bypass (Hazard Basin)
      [15.4589, 75.0078], // Dharwad Tollway
      [15.5977, 74.7899], // Kittur
      [15.8497, 74.4977], // Belagavi (Belgaum) Highway
      [16.2625, 74.4842], // Sankeshwar
      [16.4023, 74.3820], // Nipani Karnataka/Maharashtra Border
      [16.5762, 74.3160], // Kagal Industrial Corridor
      [16.7050, 74.2433], // Kolhapur NH-48 Bypass
      [17.2885, 74.1831], // Karad Krishna River Crossing
      [17.6805, 73.9995], // Satara Bypass
      [18.1362, 73.9820], // Shirwal
      [18.3512, 73.8540], // Khed Shivapur Toll Plaza
      [18.5204, 73.8567], // Pune Katraj / Chandani Chowk Bypass
      [18.7214, 73.7128], // Dehu Road (Mumbai-Pune Expressway)
      [18.7557, 73.4091], // Lonavala / Khandala Bhor Ghat
      [18.7891, 73.3440], // Khopoli Expressway Toll Plaza
      [18.9894, 73.1175], // Panvel / Kalamboli Junction
      [18.9300, 72.8200]  // Mumbai JNPT Terminal
    ],
    detourPath: [
      [13.1986, 77.7066], // Bengaluru Hub
      [13.2250, 77.4520], // Nelamangala
      [13.3409, 77.1010], // Tumakuru
      [13.7447, 76.9077], // Sira
      [14.2251, 76.3980], // Chitradurga NH-50 Divergence
      [14.9042, 76.3871], // Kudligi Junction
      [15.2689, 76.3909], // Hosapete Bypass
      [15.3456, 76.1550], // Koppal Logistics Corridor (NH-50)
      [15.7592, 76.2001], // Kushtagi Highway
      [15.9620, 76.1280], // Ilkal Flyover
      [16.0590, 76.0550], // Hungund Tollway
      [16.8302, 75.7100], // Vijayapura (Bijapur) Bypass
      [17.6599, 75.9064], // Solapur NH-65 Junction
      [17.8188, 75.6515], // Mohol
      [18.1150, 75.0320], // Indapur
      [18.5080, 73.9260], // Pune Hadapsar Bypass
      [18.7214, 73.7128], // Mumbai-Pune Expressway Start
      [18.7557, 73.4091], // Lonavala Ghat
      [18.9894, 73.1175], // Panvel
      [18.9300, 72.8200]  // Mumbai JNPT Terminal
    ],
    cause: "Hubballi NH-48 flash flood hazard",
    solution: "Detour via NH-50 Koppal corridor with verified re-icing dry ice stop.",
    delay: "8.5 hrs",
    fuel: "+₹2,400 (Net save ₹1.4L)",
    tele: { temp: "3.8°C", alt: "620m Elev", shock: "0.4 G", speed: "68 km/h" }
  },
  {
    id: "AC-SEA-701",
    mode: "sea",
    name: "MV Pacific Titan (8,400 TEU)",
    hubId: "MAA",
    product: "Semiconductor Wafers & Sensors",
    origin: "Singapore Port",
    dest: "Chennai Port",
    status: "at_risk",
    risk: 68,
    riskFactors: {
      weather: { name: "Bay of Bengal Ocean Swell", score: 32, max: 40, detail: "Wave heights reaching 4.8m due to severe cyclonic depression near Nicobar." },
      route: { name: "Strait of Malacca Nautical Channel", score: 18, max: 25, detail: "Dense vessel queue causing slow-steaming advisory." },
      cargo: { name: "Vibration-Sensitive Microchips", score: 12, max: 20, detail: "Excessive vessel roll angle threatens delicate quartz crystal pallets." },
      trust: { name: "Carrier Escrow & Lloyd's Registry", score: 6, max: 15, detail: "Vessel IMO 9821045 fully accredited; escrow active." }
    },
    riskJustification: "Elevated sea swell (4.8m exceeds 3.5m safety limit) mandates detour south of Sri Lanka deep ocean trench.",
    awbNumber: "312-6401925",
    coords: [4.10, 99.80],
    headingDegrees: 298,
    altitudeMeters: 0,
    captain: "Capt. Tan Wei • IMO 9821045",
    manifest: "Semiconductor Microchips (Reefer Containers)",
    connectedShipmentId: "AC-ROD-415",
    interconnectDesc: "Discharges 40ft reefer boxes at Chennai Port Gateway, transshipping onto Express Hauler AC-ROD-415.",
    path: [
      [1.26, 103.82], [1.22, 103.65], [1.45, 103.15], [2.50, 101.60],
      [4.10, 99.80], [5.30, 97.60], [6.00, 95.00], [8.50, 90.00],
      [10.80, 84.50], [13.0827, 80.3200]
    ],
    detourPath: [
      [1.26, 103.82], [1.22, 103.65], [1.45, 103.15], [2.50, 101.60],
      [4.10, 99.80], [5.30, 97.60], [6.00, 95.00], [4.50, 92.00],
      [4.00, 86.00], [4.80, 80.50], [6.50, 82.50], [9.50, 82.50],
      [12.20, 81.20], [13.0827, 80.3200]
    ],
    cause: "Bay of Bengal Super Cyclone with 4.8m swells (Breached limit: 3.5m)",
    solution: "Detour nautical lane south of Galle (Sri Lanka) deep trench to bypass gale center.",
    delay: "36.0 hrs",
    fuel: "+$3,200 (Net save ₹42L)",
    tele: { temp: "18.2°C", alt: "Sea Level", shock: "1.1 G", speed: "19.5 Knots" }
  },
  {
    id: "AC-ROD-415",
    awbNumber: "176-3910482",
    mode: "road",
    name: "Express Freightliner",
    hubId: "MAA",
    product: "Lithium & Silicon Modules",
    origin: "Chennai Port Gateway",
    dest: "Bengaluru Tech Park",
    status: "on_time",
    risk: 15,
    riskFactors: {
      weather: { name: "Regional Weather Radar", score: 4, max: 40, detail: "Dry road surface across NH-48 artery." },
      route: { name: "Express Toll Corridor", score: 4, max: 25, detail: "Fastag priority lane verified; 0 delays." },
      cargo: { name: "Shock / Packaging Integrity", score: 4, max: 20, detail: "Air-ride suspension maintaining <0.3G vibration." },
      trust: { name: "Driver Identity Attestation", score: 3, max: 15, detail: "Driver FIDO2 key authenticated on terminal dock." }
    },
    riskJustification: "Optimal highway telemetry. Zero-threat status verified.",
    coords: [12.9165, 79.1325],
    headingDegrees: 262,
    altitudeMeters: 310,
    captain: "K. Murugan • TN-02-CE-8812",
    manifest: "Semiconductor Modules (Connecting from AC-SEA-701)",
    connectedShipmentId: "AC-SEA-701",
    interconnectDesc: "Awaiting container discharge at Chennai Berth 4. Directly feeding Bengaluru assembly lines.",
    path: [
      [13.0827, 80.3200], // Chennai Port Gateway
      [13.0694, 80.1748], // Koyambedu / Maduravoyal Flyover
      [13.0489, 80.0932], // Poonamallee Highway
      [12.9675, 79.9436], // Sriperumbudur Industrial Hub
      [12.8342, 79.7036], // Kanchipuram Bypass (NH-48)
      [12.9298, 79.3582], // Walajapet Tollway
      [12.9272, 79.3330], // Ranipet
      [12.9165, 79.1325], // Vellore Katpadi Bypass
      [12.8710, 78.9320], // Pallikonda Toll Plaza
      [12.7904, 78.7166], // Ambur Leather Corridor
      [12.6825, 78.6140], // Vaniyambadi Bypass
      [12.6020, 78.5200], // Natrampalli
      [12.5266, 78.2140], // Krishnagiri Toll Plaza
      [12.7409, 77.8253], // Hosur SIPCOT Industrial Corridor
      [12.7845, 77.7712], // Attibele Border Checkpost
      [12.8452, 77.6602], // Electronic City Elevated Tollway
      [12.9172, 77.6228], // Silk Board / ORR
      [13.1986, 77.7066]  // Bengaluru Tech Park Hub
    ],
    detourPath: [
      [13.0827, 80.3200], // Chennai Port
      [13.1432, 79.9079], // Thiruvallur Bypass
      [13.1784, 79.6105], // Tiruttani
      [13.3300, 79.5850], // Nagari Highway
      [13.2172, 79.1003], // Chittoor (NH-75)
      [13.2005, 78.7533], // Palamaner Ghat Road
      [13.1642, 78.3948], // Mulbagal
      [13.1367, 78.1291], // Kolar Four-Lane Highway
      [13.0712, 77.7983], // Hoskote Highway Junction
      [13.1986, 77.7066]  // Bengaluru Tech Park Hub
    ],
    cause: "Corridor Nominal",
    solution: "Express green corridor activated across NH-48 bypass.",
    delay: "0.0 hrs",
    fuel: "Nominal",
    tele: { temp: "22.1°C", alt: "310m Elev", shock: "0.3 G", speed: "72 km/h" }
  },
  {
    id: "AC-SEA-903",
    awbNumber: "440-1092837",
    mode: "sea",
    name: "MV Gulf Pioneer Tanker",
    hubId: "BOM",
    product: "Polymers & Chemical Intermediates",
    origin: "Dubai (Jebel Ali)",
    dest: "Mumbai (Nhava Sheva)",
    status: "on_time",
    risk: 24,
    riskFactors: {
      weather: { name: "Arabian Sea Doppler Radar", score: 8, max: 40, detail: "Moderate breeze with 1.2m calm sea swells." },
      route: { name: "Strait of Hormuz Clearance", score: 8, max: 25, detail: "Anchorage refueling queue operating on schedule." },
      cargo: { name: "Chemical Tank Pressurization", score: 5, max: 20, detail: "Inert gas nitrogen blanketing pressure nominal." },
      trust: { name: "Terminal Escrow Security", score: 3, max: 15, detail: "Port JNPT berth allocation confirmed." }
    },
    riskJustification: "Nominal shipping lane across northern Arabian Sea.",
    coords: [25.60, 57.20],
    headingDegrees: 132,
    altitudeMeters: 0,
    captain: "Capt. Rashid Al-Maktoum • IMO 9745512",
    manifest: "Polymer Chemical Drums (18 TEU)",
    connectedShipmentId: "AC-ROD-309",
    interconnectDesc: "Unloads chemical tanks at Mumbai JNPT dock, transferring directly to Chemical Hauler AC-ROD-309.",
    path: [
      [25.01, 55.06], [25.35, 55.15], [26.15, 56.10], [26.40, 56.45],
      [25.60, 57.20], [24.80, 58.60], [24.00, 60.00], [21.50, 65.00],
      [19.20, 71.50], [18.93, 72.82]
    ],
    detourPath: [
      [25.01, 55.06], [25.35, 55.15], [26.15, 56.10], [26.40, 56.45],
      [24.50, 59.50], [19.80, 64.00], [17.50, 70.00], [18.93, 72.82]
    ],
    cause: "Hormuz Strait Bunker queue",
    solution: "Clearance scheduled at outer anchorage.",
    delay: "2.0 hrs",
    fuel: "Nominal",
    tele: { temp: "26.4°C", alt: "Sea Level", shock: "0.6 G", speed: "16.8 Knots" }
  },
  {
    id: "AC-ROD-309",
    awbNumber: "588-7204910",
    mode: "road",
    name: "Hazardous Tanker Unit",
    hubId: "BOM",
    product: "Industrial Chemical Solution",
    origin: "Mumbai JNPT Hub",
    dest: "Ahmedabad Industrial Park",
    status: "on_time",
    risk: 19,
    riskFactors: {
      weather: { name: "Coastal Highway Weather", score: 5, max: 40, detail: "Clear conditions across Mumbai-Gujarat highway." },
      route: { name: "Western Freight Expressway", score: 6, max: 25, detail: "Minimal traffic congestion along Surat bypass." },
      cargo: { name: "Hazardous Chemical Safety", score: 5, max: 20, detail: "Emergency shutoff valve telemetry armed." },
      trust: { name: "Depot Inspector Attestation", score: 3, max: 15, detail: "Hazmat cargo pass verified." }
    },
    riskJustification: "Nominal highway conditions with low volatility index.",
    coords: [20.5992, 72.9342],
    headingDegrees: 4,
    altitudeMeters: 45,
    captain: "Vikram Jadhav • MH-04-AZ-2019",
    manifest: "Specialty Chemicals (Connecting from AC-SEA-903)",
    connectedShipmentId: "AC-SEA-903",
    interconnectDesc: "Receives raw chemical consignment landed at Nhava Sheva. Dispatches via Western Freight Expressway.",
    path: [
      [18.9300, 72.8200], // Mumbai JNPT Hub
      [19.0330, 73.0297], // Navi Mumbai Palm Beach Road
      [19.2600, 72.9780], // Thane / Ghodbunder Road
      [19.4259, 72.8225], // Vasai-Virar Flyover
      [19.7431, 72.9120], // Manor NH-48 Tollway
      [20.1245, 72.9189], // Talasari Maharashtra/Gujarat Border
      [20.3893, 72.9106], // Vapi Industrial Hub
      [20.5992, 72.9342], // Valsad Highway
      [20.9500, 72.9320], // Navsari NH-48 Bypass
      [21.2680, 72.9560], // Surat Kamrej Junction
      [21.6264, 73.0019], // Ankleshwar Chemical Corridor
      [21.7051, 72.9959], // Bharuch Golden Bridge / Narmada
      [22.0520, 73.1200], // Karjan Toll Plaza
      [22.3072, 73.1812], // Vadodara (Baroda) Highway Junction
      [22.5645, 72.9289], // Anand (Amul Expressway)
      [22.6916, 72.8634], // Nadiad Bypass
      [23.0225, 72.5714]  // Ahmedabad Industrial Park
    ],
    detourPath: [
      [18.9300, 72.8200], // Mumbai JNPT
      [19.2600, 72.9780], // Thane
      [19.7431, 72.9120], // Manor
      [19.9700, 72.7300], // Dahanu Coastal Corridor
      [20.1800, 72.7600], // Umbergaon
      [20.4000, 72.8500], // Daman Bypass
      [20.5992, 72.9342], // Valsad
      [21.1702, 72.8311], // Surat Hazira Port Expressway
      [21.7100, 72.6000], // Dahej Petroleum Corridor
      [22.0500, 72.8000], // Jambusar
      [22.2400, 73.0800], // Padra Bypass
      [22.3072, 73.1812], // Vadodara
      [22.6916, 72.8634], // Nadiad
      [23.0225, 72.5714]  // Ahmedabad Industrial Park
    ],
    cause: "Expressway Clear",
    solution: "Hazard sensors armed, pressure nominal.",
    delay: "0.0 hrs",
    fuel: "Nominal",
    tele: { temp: "24.0°C", alt: "45m Elev", shock: "0.2 G", speed: "64 km/h" }
  }
];

export default function App() {
  const [fleet, setFleet] = useState<Carrier[]>(INITIAL_FLEET);
  const [hazards, setHazards] = useState<Hazard[]>(INITIAL_HAZARDS);
  const [hubs] = useState<Hub[]>(INITIAL_HUBS);

  const [selectedId, setSelectedId] = useState<string>("AC-AIR-501");
  const [activeTab, setActiveTab] = useState<'map' | 'idcard' | 'cargo' | 'awb'>('map');
  const [activeRole, setActiveRole] = useState<'manager' | 'driver'>('manager');
  const [hubFilter, setHubFilter] = useState<string>('all');
  const [isDevGuideOpen, setIsDevGuideOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [show3DMapOverlay, setShow3DMapOverlay] = useState<boolean>(true);
  
  // Real-Time Dynamic ETA State
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);

  // Live Clock Interval for dynamic Real-Time ETA calculation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Global Command Palette Shortcut: Cmd/Ctrl + K or /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Banner & Auto-Reroute states
  const [autoBanner, setAutoBanner] = useState<{
    show: boolean;
    title: string;
    desc: string;
    hazardId?: string;
    carrierId?: string;
  }>({
    show: false,
    title: "",
    desc: ""
  });

  // 3rd-Party Tamper Shield
  const [isThirdPartyBlocked, setIsThirdPartyBlocked] = useState<boolean>(false);
  const [isScanningBiometrics, setIsScanningBiometrics] = useState<boolean>(false);
  const [biometricStatus, setBiometricStatus] = useState<string>("Physical thumbprint registered on device");

  // HUD Controls
  const [isHudMinimized, setIsHudMinimized] = useState<boolean>(false);
  const [isHudHidden, setIsHudHidden] = useState<boolean>(false);
  const [showHazards, setShowHazards] = useState<boolean>(true);
  const [isAnimatingRoute, setIsAnimatingRoute] = useState<boolean>(false);

  // Modals
  const [universalModal, setUniversalModal] = useState<{
    isOpen: boolean;
    type: 'carrier' | 'hub' | 'hazard';
    id: string;
  }>({ isOpen: false, type: 'carrier', id: 'AC-AIR-501' });

  const [riskModalCarrierId, setRiskModalCarrierId] = useState<string | null>(null);
  const [isAddShipmentOpen, setIsAddShipmentOpen] = useState<boolean>(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Map references
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const polylinesRef = useRef<{ [key: string]: L.Polyline }>({});
  const oldPolylinesRef = useRef<{ [key: string]: L.Polyline }>({});
  const hubMarkersRef = useRef<L.Marker[]>([]);
  const hazardLayersRef = useRef<L.Circle[]>([]);

  // Current selected carrier
  const currentCarrier = fleet.find(c => c.id === selectedId) || fleet[0];

  // Active AWB Record linked to the selected carrier with real-time coordinates
  const activeAWBRecord = useMemo<AWBShipmentRecord | null>(() => {
    if (!currentCarrier) return null;
    const lookupId = currentCarrier.awbNumber || currentCarrier.id;
    const found = getAWBShipment(lookupId);
    if (found) {
      return {
        ...found,
        currentCoords: currentCarrier.coords,
        headingDegrees: currentCarrier.headingDegrees ?? found.headingDegrees,
        altitudeMeters: currentCarrier.altitudeMeters ?? found.altitudeMeters,
      };
    }
    return null;
  }, [currentCarrier]);

  // Dynamic Real-Time Estimated Arrival Calculations
  const baseSpeedKmH = parseSpeedToKmH(currentCarrier.tele.speed);
  const currentEffectiveSpeed = Math.max(15, Math.round(baseSpeedKmH * speedMultiplier));
  const routeStats = calculateRouteDistanceAndProgress(currentCarrier.coords, currentCarrier.path);
  const remainingKm = routeStats.totalKm;
  const travelSeconds = currentEffectiveSpeed > 0 ? Math.round((remainingKm / currentEffectiveSpeed) * 3600) : 0;
  const etaFormatted = formatEstimatedArrivalTime(currentTime, travelSeconds);
  const durationFormatted = formatDuration(travelSeconds);

  const addToast = (title: string, message: string, color: ToastItem['color'] = 'cyan') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, color }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // ----------------------------------------------------
  // LEAFLET MAP INITIALIZATION & UPDATE
  // ----------------------------------------------------
  useEffect(() => {
    if (mapRef.current) return;

    try {
      const map = L.map('leaflet-map', {
        preferCanvas: true,
        zoomControl: true,
        fadeAnimation: false,
        markerZoomAnimation: true
      }).setView([18.0, 76.0], 5);

      const tileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`;
      L.tileLayer(tileUrl, {
        subdomains: 'abcd',
        maxZoom: 18,
        attribution: '&copy; CARTO &copy; OpenStreetMap'
      }).addTo(map);

      mapRef.current = map;
    } catch (e) {
      console.error("Leaflet init error:", e);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Hubs on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    hubMarkersRef.current.forEach(m => map.removeLayer(m));
    hubMarkersRef.current = [];

    hubs.forEach(hub => {
      const hubIcon = L.divIcon({
        className: 'custom-hub-icon',
        html: `
          <div style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center;">
            <div class="hub-pulse" style="position:absolute;"></div>
            <div style="width:14px;height:14px;background:#06b6d4;border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 0 10px #06b6d4;"></div>
            <div style="position:absolute;top:-4px;right:-4px;background:#050a18;color:#06b6d4;border:1px solid #06b6d4;border-radius:50%;width:14px;height:14px;font-size:9px;font-weight:bold;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.5);">ℹ</div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const m = L.marker(hub.coords, { icon: hubIcon, zIndexOffset: 250 }).addTo(map);

      m.on('click', () => {
        openUniversalInspector('hub', hub.id);
      });

      hubMarkersRef.current.push(m);
    });
  }, [hubs]);

  // Update Hazards on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    hazardLayersRef.current.forEach(h => map.removeLayer(h));
    hazardLayersRef.current = [];

    if (!showHazards) return;

    hazards.forEach(haz => {
      const circle = L.circle(haz.center, {
        radius: haz.radius,
        color: haz.color,
        fillColor: haz.color,
        fillOpacity: 0.22,
        weight: 2,
        dashArray: '6, 6'
      }).addTo(map);

      circle.on('click', () => {
        openUniversalInspector('hazard', haz.id);
      });

      hazardLayersRef.current.push(circle);
    });
  }, [hazards, showHazards]);

  // Update Carriers on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean existing markers and routes
    Object.keys(markersRef.current).forEach(id => {
      if (markersRef.current[id]) map.removeLayer(markersRef.current[id]);
    });
    markersRef.current = {};

    Object.keys(polylinesRef.current).forEach(id => {
      if (polylinesRef.current[id]) map.removeLayer(polylinesRef.current[id]);
    });
    polylinesRef.current = {};

    fleet.forEach(item => {
      const isVisible = hubFilter === 'all' || item.hubId === hubFilter;
      if (!isVisible) return;

      const isSel = item.id === selectedId;
      const color = isSel
        ? '#f77f00'
        : item.status === 'disrupted'
        ? '#ef4444'
        : item.status === 'at_risk'
        ? '#f59e0b'
        : '#10b981';

      // Polyline
      const poly = L.polyline(item.path, {
        color: color,
        weight: isSel ? 5 : 3.5,
        dashArray: item.mode === 'air' ? '6, 8' : undefined,
        opacity: isSel ? 1 : 0.75
      }).addTo(map);
      polylinesRef.current[item.id] = poly;

      // Icon
      const glyph = item.mode === 'air' ? '✈️' : item.mode === 'sea' ? '🚢' : '🚛';
      const bg = item.status === 'disrupted' ? '#ef4444' : item.status === 'at_risk' ? '#f59e0b' : '#10b981';
      const ring = isSel ? 'border:3px solid #f77f00;box-shadow:0 0 16px #f77f00;' : 'border:2px solid #ffffff;';

      const icon = L.divIcon({
        className: 'custom-carrier-icon',
        html: `
          <div style="position:relative;width:36px;height:36px;">
            <div style="width:36px;height:36px;background:${bg};${ring}border-radius:10px;box-shadow:0 6px 14px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;">
              ${glyph}
            </div>
            <div style="position:absolute;top:-4px;right:-4px;background:#050a18;color:#06b6d4;border:1.5px solid #06b6d4;border-radius:50%;width:14px;height:14px;font-size:9px;font-weight:bold;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.6);">ℹ</div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker(item.coords, {
        icon: icon,
        zIndexOffset: isSel ? 1000 : 400
      }).addTo(map);

      marker.on('click', () => {
        handleSelectCarrier(item.id);
      });

      markersRef.current[item.id] = marker;
    });
  }, [fleet, hubFilter, selectedId]);

  // Handle Tab Switch resize
  useEffect(() => {
    if (activeTab === 'map' && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 200);
    }
  }, [activeTab]);

  // Select Carrier function
  const handleSelectCarrier = (id: string) => {
    setSelectedId(id);
    const item = fleet.find(c => c.id === id);
    if (!item) return;

    if (mapRef.current) {
      const zoom = item.mode === 'air' ? 5 : item.mode === 'sea' ? 6 : 7;
      mapRef.current.flyTo(item.coords, zoom, { duration: 1 });
    }
  };

  // ----------------------------------------------------
  // AUTONOMOUS HAZARD THRESHOLD BREACH ENGINE
  // ----------------------------------------------------
  const triggerHazardLimitBreach = (hazardId: string = "haz-bengal") => {
    const hazard = hazards.find(h => h.id === hazardId) || hazards[0];
    const carrier = fleet.find(c => c.id === hazard.affectedCarrierId);

    if (!carrier) return;

    // Set carrier active
    handleSelectCarrier(carrier.id);

    // Trigger Autonomous Notification Banner
    setAutoBanner({
      show: true,
      title: `CRITICAL LIMIT EXCEEDED: ${hazard.name} (${hazard.currentMetric} vs Limit ${hazard.thresholdLimit})`,
      desc: `Physical limit exceeded safe envelope. Aegis Autonomous AI applied detour with zero human latency. Dock sync & escort secured.`,
      hazardId: hazard.id,
      carrierId: carrier.id
    });

    // Execute Autonomous Detour Animation immediately
    executeDetourAnimation(carrier.id);

    addToast(
      "AUTONOMOUS SELF-REROUTE EXECUTED",
      `Hazard threshold breached (${hazard.currentMetric} > ${hazard.thresholdLimit}). ${carrier.id} diverted automatically!`,
      "emerald"
    );
  };

  // ----------------------------------------------------
  // SMOOTH DETOUR ANIMATION ENGINE
  // ----------------------------------------------------
  const executeDetourAnimation = (carrierId: string) => {
    if (isThirdPartyBlocked) {
      addToast(
        "Tamper Blocked",
        `3rd-Party interference active! Escrow held. Call Helpline ${SUPPORT_PHONE}.`,
        "red"
      );
      return;
    }

    const item = fleet.find(x => x.id === carrierId);
    if (!item || isAnimatingRoute) return;

    setIsAnimatingRoute(true);

    const map = mapRef.current;
    if (map) {
      // 1. Draw old path in translucent dashed red
      if (oldPolylinesRef.current[item.id]) {
        map.removeLayer(oldPolylinesRef.current[item.id]);
      }
      oldPolylinesRef.current[item.id] = L.polyline(item.path, {
        color: '#ef4444',
        weight: 3,
        dashArray: '4, 8',
        opacity: 0.55
      }).addTo(map);

      // 2. Draw new detour polyline
      if (polylinesRef.current[item.id]) {
        map.removeLayer(polylinesRef.current[item.id]);
      }
      polylinesRef.current[item.id] = L.polyline(item.detourPath, {
        color: '#f77f00',
        weight: 5,
        opacity: 1
      }).addTo(map);
    }

    const targetPath = item.detourPath;
    let step = 0;
    const totalSteps = targetPath.length;

    const interval = setInterval(() => {
      if (step < totalSteps) {
        const nextCoord = targetPath[step];
        const updatedCoord: [number, number] = [nextCoord[0], nextCoord[1]];

        // Update carrier coordinate in state
        setFleet(prev =>
          prev.map(c => {
            if (c.id === carrierId) {
              return {
                ...c,
                coords: updatedCoord
              };
            }
            return c;
          })
        );

        if (markersRef.current[carrierId]) {
          markersRef.current[carrierId].setLatLng(updatedCoord);
        }

        step++;
      } else {
        clearInterval(interval);
        setIsAnimatingRoute(false);

        // Finalize state
        setFleet(prev =>
          prev.map(c => {
            if (c.id === carrierId) {
              return {
                ...c,
                status: 'on_time',
                risk: 14,
                path: targetPath,
                riskFactors: {
                  ...c.riskFactors,
                  weather: { ...c.riskFactors.weather, score: 4 },
                  route: { ...c.riskFactors.route, score: 4 }
                }
              };
            }
            if (c.id === item.connectedShipmentId) {
              return {
                ...c,
                delay: "0.0 hrs (Synced)"
              };
            }
            return c;
          })
        );

        addToast(
          "Reroute Executed!",
          `${item.id} navigated onto detour corridor. Hazard evaded, dock arrival synced!`,
          "emerald"
        );
      }
    }, 450);
  };

  // ----------------------------------------------------
  // UNIVERSAL INSPECTOR OPENER
  // ----------------------------------------------------
  const openUniversalInspector = (type: 'carrier' | 'hub' | 'hazard', id: string) => {
    setUniversalModal({ isOpen: true, type, id });
  };

  // ----------------------------------------------------
  // 1-CLICK 3RD-PARTY BLOCK TOGGLE
  // ----------------------------------------------------
  const toggleThirdPartyBlock = () => {
    if (!isThirdPartyBlocked) {
      setIsThirdPartyBlocked(true);
      setBiometricStatus("Proxy IP Replay Attempt Intercepted! DPoP Token Revoked.");
      addToast(
        "3rd-Party Tamper Blocked",
        `Unauthorized proxy attempt intercepted! Escrow frozen. Call Helpline ${SUPPORT_PHONE}.`,
        "red"
      );
    } else {
      performBiometricScan();
    }
  };

  // Biometric scan simulation
  const performBiometricScan = () => {
    setIsScanningBiometrics(true);
    setBiometricStatus("Scanning hardware Secure Enclave & FaceID...");

    setTimeout(() => {
      setIsScanningBiometrics(false);
      setIsThirdPartyBlocked(false);
      setBiometricStatus("Touch ID / FaceID Liveness Authenticated (FIDO2 Level 3)");
      addToast(
        "Biometrics Authenticated",
        "1st-Party hardware attestation confirmed. Dispatch and escrow active.",
        "emerald"
      );
    }, 850);
  };

  // ----------------------------------------------------
  // NEW SHIPMENT SUBMISSION
  // ----------------------------------------------------
  const handleAddNewShipment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const id = (formData.get('id') as string).trim();
    const product = (formData.get('product') as string).trim();
    const mode = formData.get('mode') as 'air' | 'sea' | 'road';
    const qty = (formData.get('qty') as string).trim();
    const driver = (formData.get('driver') as string).trim();

    const originRaw = (formData.get('origin') as string).split('|');
    const originName = originRaw[0];
    const originCoords: [number, number] = [parseFloat(originRaw[1].split(',')[0]), parseFloat(originRaw[1].split(',')[1])];
    const hubId = originRaw[2];

    const destRaw = (formData.get('dest') as string).split('|');
    const destName = destRaw[0];
    const destCoords: [number, number] = [parseFloat(destRaw[1].split(',')[0]), parseFloat(destRaw[1].split(',')[1])];

    const midLat = (originCoords[0] + destCoords[0]) / 2;
    const midLng = (originCoords[1] + destCoords[1]) / 2;

    const newCarrier: Carrier = {
      id,
      awbNumber: `AWB-${mode.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
      mode,
      name: `${product.slice(0, 18)} Unit`,
      hubId,
      product,
      origin: originName,
      dest: destName,
      status: 'on_time',
      risk: 15,
      riskFactors: {
        weather: { name: "Corridor Weather Radar", score: 4, max: 40, detail: "Nominal atmospheric telemetry." },
        route: { name: "Transit Waypoints", score: 4, max: 25, detail: "Free of chokepoints." },
        cargo: { name: "Cargo Thresholds", score: 4, max: 20, detail: "Safe handling margins." },
        trust: { name: "Merchant Escrow", score: 3, max: 15, detail: "Carrier validated." }
      },
      riskJustification: "Nominal deployment into verified hub network.",
      coords: [midLat, midLng],
      headingDegrees: Math.floor(Math.random() * 360),
      altitudeMeters: mode === 'air' ? 10500 : mode === 'sea' ? 0 : 500,
      captain: driver,
      manifest: `${product} (${qty})`,
      connectedShipmentId: "AC-ROD-104",
      interconnectDesc: `Connected at ${hubId} gateway. Autonomous dock handoff active.`,
      path: [originCoords, [midLat, midLng], destCoords],
      detourPath: [originCoords, [midLat + 0.8, midLng + 0.8], destCoords],
      cause: "Corridor Nominal",
      solution: "Direct corridor clear.",
      delay: "0.0 hrs",
      fuel: "Nominal",
      tele: {
        temp: "4.0°C",
        alt: mode === 'air' ? '32,000 ft' : 'Sea Level',
        shock: "0.2 G",
        speed: mode === 'air' ? 'Mach 0.80' : '65 km/h'
      }
    };

    setFleet(prev => [newCarrier, ...prev]);
    setIsAddShipmentOpen(false);
    handleSelectCarrier(id);
    addToast("Shipment Deployed!", `${id} connected to ${hubId} gateway pipeline.`, "emerald");
  };

  // Zoom Helpers
  const zoomTo = (region: 'global' | 'india') => {
    if (!mapRef.current) return;
    if (region === 'india') {
      mapRef.current.flyTo([16.5, 76.5], 6, { duration: 1 });
    } else {
      mapRef.current.flyTo([18.0, 76.0], 4, { duration: 1 });
    }
  };

  const requestUserLocation = () => {
    if (navigator.geolocation && mapRef.current) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          L.marker(coords, {
            icon: L.divIcon({ className: 'custom-carrier-icon', html: '<div class="live-gps-dot"></div>' })
          }).addTo(mapRef.current!);
          mapRef.current?.flyTo(coords, 8);
          addToast("GPS Locked", "Your live telematics location pinned on map.", "cyan");
        },
        () => addToast("GPS Info", "Using hub central coordinates.", "amber")
      );
    }
  };

  // Cargo Camera Capture
  const handlePhotoCaptured = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      addToast("Customs Seal Verified", "Barcode & seal cryptographic signature validated via Edge AI.", "emerald");
    }
  };

  return (
    <div className="bg-[#050a18] text-slate-100 min-h-screen flex flex-col antialiased selection:bg-[#f77f00] selection:text-white">

      {/* ================= AUTONOMOUS HAZARD EVASION NOTIFICATION BANNER ================= */}
      {autoBanner.show && (
        <div className="bg-gradient-to-r from-red-600 via-[#f77f00] to-amber-500 text-white px-4 py-2.5 z-50 shadow-2xl flex items-center justify-between transition-all duration-300">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 rounded-lg bg-black/40 animate-pulse">
              <AlertOctagon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase tracking-widest font-black bg-black/40 px-2 py-0.5 rounded">
                  SELF-THINKING DECISION
                </span>
                <span className="text-xs font-bold">{autoBanner.title}</span>
              </div>
              <p className="text-[11px] text-white/95 leading-tight">{autoBanner.desc}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => {
                if (autoBanner.carrierId) setRiskModalCarrierId(autoBanner.carrierId);
              }}
              className="bg-white text-slate-900 font-bold text-xs px-3 py-1 rounded-lg shadow hover:bg-slate-100 transition flex items-center space-x-1"
            >
              <Info className="w-3.5 h-3.5 text-[#f77f00]" />
              <span>Inspect Metrics</span>
            </button>
            <button
              onClick={() => setAutoBanner(prev => ({ ...prev, show: false }))}
              className="text-white/80 hover:text-white p-1"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= TOP HEADER (USER-FRIENDLY & CLEAN) ================= */}
      <header className="bg-[#0c152e]/95 backdrop-blur border-b border-[#1d2f65] sticky top-0 z-40 px-3 sm:px-5 py-2.5 flex items-center justify-between shadow-lg">
        {/* Left: Brand Identity */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#f77f00] to-[#fcbf49] flex items-center justify-center text-white font-black shadow-lg shadow-[#f77f00]/20 flex-shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base tracking-wider text-white">
                AEGIS<span className="text-[#f77f00]">CHAIN</span>
              </span>
              <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#06b6d4]/15 text-cyan-300 border border-[#06b6d4]/30">
                Autonomous Multimodal AI
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden md:block">
              Intelligent Self-Rerouting • Real-Time ETA • Zero-Trust Digital ID
            </p>
          </div>
        </div>

        {/* Center: Live Pipeline Indicators */}
        <div className="hidden xl:flex items-center space-x-3 bg-[#050a18]/80 px-4 py-1.5 rounded-xl border border-[#1d2f65] text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-slate-400">Gateways:</span>
            <span className="font-bold text-white font-mono">{hubs.length} Active</span>
          </div>
          <div className="h-3 w-px bg-[#1d2f65]"></div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-400">Fleet:</span>
            <span className="font-bold text-white font-mono">{fleet.length} Units</span>
          </div>
          <div className="h-3 w-px bg-[#1d2f65]"></div>
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#f77f00]" />
            <span className="text-slate-400">Loss Prevented:</span>
            <span className="font-bold text-emerald-400 font-mono">₹68.4L</span>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Universal Spotlight Search Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="bg-[#050a18] hover:bg-[#142045] border border-cyan-500/50 hover:border-cyan-400 text-slate-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs flex items-center space-x-2 transition shadow group"
            title="Search any option, carrier, gateway, hazard, or action in AegisChain (⌘K)"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="hidden md:inline font-medium text-slate-300">Search...</span>
            <kbd className="hidden lg:inline-flex items-center text-[10px] font-mono text-cyan-400 bg-[#0c152e] border border-[#1d2f65] px-1 rounded">
              ⌘K
            </kbd>
          </button>

          {/* Quick 1-Click Auto-Evasion Trigger */}
          <button
            onClick={() => triggerHazardLimitBreach("haz-bengal")}
            className="bg-gradient-to-r from-red-600/30 to-[#f77f00]/30 hover:from-red-600/40 hover:to-[#f77f00]/40 border border-[#f77f00]/50 text-[#f77f00] text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition shadow"
            title="Simulate hazard limit breach to trigger instant detour evasion"
          >
            <Wind className="w-3.5 h-3.5 text-[#f77f00]" />
            <span className="hidden sm:inline">Test Auto-Reroute</span>
            <span className="sm:hidden">Auto-Detour</span>
          </button>

          {/* 3rd-Party Tamper Shield Toggle */}
          <button
            onClick={toggleThirdPartyBlock}
            className={`border text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition shadow ${
              isThirdPartyBlocked
                ? 'bg-red-600 hover:bg-red-700 text-white border-red-400 animate-pulse'
                : 'bg-[#142045] hover:bg-[#1d2f65] border-[#1d2f65] text-amber-300'
            }`}
            title="Toggle 3rd-party proxy & intermediary tamper protection"
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${isThirdPartyBlocked ? 'text-white' : 'text-amber-400'}`} />
            <span className="hidden md:inline">{isThirdPartyBlocked ? '3rd-Party Blocked' : 'Shield Tamper'}</span>
          </button>

          {/* Add Shipment Button */}
          <button
            onClick={() => setIsAddShipmentOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition shadow"
            title="Deploy new shipment to connected multimodal network"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Shipment</span>
          </button>

          {/* Developer Integration Guide */}
          <button
            onClick={() => setIsDevGuideOpen(true)}
            className="bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 text-indigo-300 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition shadow"
            title="Hackathon Developer Integration Guide (Express backend, 3D WebGL, Mod-7 AWB)"
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-300" />
            <span className="hidden sm:inline">Dev Guide</span>
          </button>

          {/* Disruption Simulator Button */}
          <button
            onClick={() => setIsSimulatorOpen(true)}
            className="bg-[#f77f00]/20 hover:bg-[#f77f00]/30 border border-[#f77f00]/50 text-[#f77f00] text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center space-x-1"
            title="Open what-if disruption scenarios"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Simulate</span>
          </button>

          {/* 24/7 Helpline Quick-Dial */}
          <a
            href={`tel:${SUPPORT_PHONE}`}
            className="bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 text-blue-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition shadow"
            title={`24/7 Central Dispatch Helpline: ${SUPPORT_PHONE}`}
          >
            <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-mono font-bold hidden lg:inline">{SUPPORT_PHONE}</span>
            <span className="text-[11px] font-mono lg:hidden">Help</span>
          </a>

          {/* Friendly Role Switcher */}
          <div className="bg-[#050a18] p-0.5 rounded-lg border border-[#1d2f65] flex text-xs">
            <button
              onClick={() => {
                setActiveRole('manager');
                setActiveTab('map');
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                activeRole === 'manager' ? 'bg-[#0c152e] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ops Manager
            </button>
            <button
              onClick={() => {
                setActiveRole('driver');
                setActiveTab('idcard');
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                activeRole === 'driver' ? 'bg-[#0c152e] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Commander
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN WORKSPACE ================= */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* DESKTOP SIDEBAR (CLEAN, FRIENDLY NAVIGATION) */}
        <aside className="w-64 bg-[#0c152e] border-r border-[#1d2f65] flex-col justify-between hidden lg:flex flex-shrink-0 z-20">
          <div className="p-3.5 space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-2">Workspace Navigation</p>
              
              {/* Quick Spotlight Search button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium bg-[#050a18] hover:bg-[#142045] border border-cyan-500/40 text-slate-300 hover:text-white transition mb-2 shadow group"
              >
                <span className="flex items-center space-x-2">
                  <Search className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>Search Options...</span>
                </span>
                <kbd className="text-[10px] font-mono text-cyan-400 bg-[#0c152e] border border-[#1d2f65] px-1.5 py-0.5 rounded">
                  ⌘K
                </kbd>
              </button>

              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('map')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition shadow ${
                    activeTab === 'map'
                      ? 'bg-[#f77f00] text-white'
                      : 'text-slate-300 hover:bg-[#142045] hover:text-white'
                  }`}
                >
                  <span className="flex items-center space-x-2.5">
                    <Layers className="w-4 h-4" />
                    <span>Live Map & Detour</span>
                  </span>
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                </button>

                <button
                  onClick={() => setActiveTab('idcard')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                    activeTab === 'idcard'
                      ? 'bg-[#f77f00] text-white'
                      : 'text-slate-300 hover:bg-[#142045] hover:text-white'
                  }`}
                >
                  <span className="flex items-center space-x-2.5">
                    <Fingerprint className="w-4 h-4 text-cyan-400" />
                    <span>Virtual Digital ID</span>
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    isThirdPartyBlocked ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {isThirdPartyBlocked ? 'FROZEN' : '1st POK'}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('cargo')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                    activeTab === 'cargo'
                      ? 'bg-[#f77f00] text-white'
                      : 'text-slate-300 hover:bg-[#142045] hover:text-white'
                  }`}
                >
                  <span className="flex items-center space-x-2.5">
                    <Camera className="w-4 h-4 text-[#f77f00]" />
                    <span>Cargo Camera AI</span>
                  </span>
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                </button>

                <button
                  onClick={() => setActiveTab('awb')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                    activeTab === 'awb'
                      ? 'bg-[#f77f00] text-white shadow-lg'
                      : 'text-slate-300 hover:bg-[#142045] hover:text-white'
                  }`}
                >
                  <span className="flex items-center space-x-2.5">
                    <Box className="w-4 h-4 text-cyan-400" />
                    <span>3D AWB Tracking</span>
                  </span>
                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                    3D
                  </span>
                </button>
              </nav>
            </div>

            {/* Gateway Filter with clean indicators */}
            <div className="bg-[#050a18]/90 border border-[#1d2f65] rounded-xl p-2.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-300 font-bold text-[11px]">
                <span>Gateway Filter:</span>
                <span className="text-cyan-400 font-mono">3 Hubs</span>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setHubFilter('all');
                    zoomTo('global');
                    addToast("Network View", "Displaying all interconnected global routes.", "cyan");
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg font-medium flex items-center justify-between transition ${
                    hubFilter === 'all' ? 'bg-[#0c152e] text-white border border-[#06b6d4]' : 'bg-[#050a18] text-slate-300 hover:bg-[#0c152e]'
                  }`}
                >
                  <span>🌐 Entire Global Web</span>
                  <span className="text-[10px] text-slate-400 font-mono">{fleet.length} Carriers</span>
                </button>
                {hubs.map(h => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setHubFilter(h.id);
                      if (mapRef.current) {
                        mapRef.current.flyTo(h.coords, 6, { duration: 1 });
                      }
                      addToast(`Hub Filter: ${h.id}`, `Filtered pipeline through ${h.name}.`, "emerald");
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg font-medium flex items-center justify-between border border-[#1d2f65]/60 transition ${
                      hubFilter === h.id ? 'bg-[#142045] text-cyan-300 border-[#06b6d4]' : 'bg-[#050a18] hover:bg-[#0c152e] text-slate-300'
                    }`}
                  >
                    <span className="flex items-center space-x-1.5 truncate">
                      <span>{h.id === 'BLR' ? '✈️/🚛' : '🚢/🚛'}</span>
                      <span className="truncate">{h.name.split(' ')[0]}</span>
                    </span>
                    <span className="text-[9px] text-cyan-400 font-mono flex-shrink-0">{h.id}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Resilience Meter */}
            <div className="bg-[#050a18]/80 border border-[#1d2f65] rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-300 font-semibold block mb-0.5">Pipeline Resilience Index</span>
              <div className="text-2xl font-black font-mono text-emerald-400">92%</div>
              <p className="text-[9px] text-cyan-400 font-mono mt-0.5">Autonomous Protocol Active</p>
            </div>

            {/* Dispatch Helpline */}
            <div className="bg-gradient-to-br from-blue-950/40 to-[#0c152e] border border-blue-500/30 rounded-xl p-2.5 text-xs space-y-1">
              <span className="font-bold text-white flex items-center space-x-1.5 text-[11px]">
                <Headset className="w-3.5 h-3.5 text-cyan-400" />
                <span>Central Dispatch Helpline</span>
              </span>
              <p className="text-[10px] text-slate-400">For escrow unlocks or route manual sign-off:</p>
              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="block w-full text-center bg-blue-600/40 hover:bg-blue-600/60 border border-blue-400/50 text-white font-mono font-bold py-1 rounded-lg transition"
              >
                📞 {SUPPORT_PHONE}
              </a>
            </div>
          </div>
        </aside>

        {/* ================= MAIN CONTENT ================= */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative pb-16 lg:pb-0">

          {/* ================= 1. TAB: INTERACTIVE MAP & AI DECISION ENGINE ================= */}
          {activeTab === 'map' && (
            <section className="flex-1 flex flex-col lg:flex-row h-full min-h-[500px]">
              
              {/* Live Map Container */}
              <div className="flex-1 relative flex flex-col min-h-[460px] h-[520px] lg:h-full">
                <div id="leaflet-map" className="w-full h-full"></div>

                {/* 3D Vehicle Simulation Overlay directly anchored on GPS coordinates */}
                {show3DMapOverlay && activeAWBRecord && (
                  <Map3DVehicleOverlay
                    shipment={activeAWBRecord}
                    onClose={() => setShow3DMapOverlay(false)}
                    onTrackInAWBHub={() => setActiveTab('awb')}
                  />
                )}

                {/* Map Floating Control Toolbar */}
                <div className="absolute top-3 right-3 z-[500] flex space-x-1.5">
                  <button
                    onClick={() => {
                      setShow3DMapOverlay(prev => !prev);
                      addToast(
                        "3D Model Overlay",
                        !show3DMapOverlay ? "3D vehicle WebGL simulation enabled." : "3D vehicle overlay minimized.",
                        "cyan"
                      );
                    }}
                    className={`border text-xs px-2.5 py-1 rounded-lg shadow font-medium flex items-center space-x-1 transition ${
                      show3DMapOverlay
                        ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-400'
                        : 'bg-[#050a18]/90 text-slate-500 border-[#1d2f65]'
                    }`}
                    title="Toggle 3D Vehicle WebGL GPS Model Overlay"
                  >
                    <Box className="w-3 h-3 text-cyan-400" />
                    <span>🎮 3D Overlay</span>
                  </button>

                  <button
                    onClick={() => setIsHudHidden(prev => !prev)}
                    className={`border text-xs px-2.5 py-1 rounded-lg shadow font-medium flex items-center space-x-1 transition ${
                      !isHudHidden
                        ? 'bg-[#0c152e]/90 hover:bg-[#142045] text-cyan-400 border-[#1d2f65]'
                        : 'bg-[#050a18]/90 text-slate-500 border-[#1d2f65]'
                    }`}
                  >
                    <Navigation className="w-3 h-3 text-cyan-400" />
                    <span>🧭 Telematics</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowHazards(prev => !prev);
                      addToast("Hazard Overlay", !showHazards ? "Cyclone, Ash & Flood hazard zones enabled." : "Hazard overlay hidden.", "cyan");
                    }}
                    className={`border text-xs px-2.5 py-1 rounded-lg shadow font-medium flex items-center space-x-1 transition ${
                      showHazards
                        ? 'bg-[#0c152e]/90 hover:bg-[#142045] text-amber-300 border-[#1d2f65]'
                        : 'bg-[#050a18]/90 text-slate-500 border-[#1d2f65]'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Hazards</span>
                  </button>

                  <button
                    onClick={() => zoomTo('global')}
                    className="bg-[#0c152e]/90 hover:bg-[#142045] text-[#f77f00] border border-[#1d2f65] text-xs px-2.5 py-1 rounded-lg shadow font-semibold"
                  >
                    🌐 Global
                  </button>
                  <button
                    onClick={() => zoomTo('india')}
                    className="bg-[#0c152e]/90 hover:bg-[#142045] text-white border border-[#1d2f65] text-xs px-2.5 py-1 rounded-lg shadow font-semibold"
                  >
                    🇮🇳 India
                  </button>
                </div>

                {/* ================= USER-FRIENDLY TELEMATICS HUD WITH REAL-TIME ETA ================= */}
                <div className="absolute top-3 left-3 z-[500] pointer-events-auto transition-all duration-300">
                  {!isHudHidden ? (
                    <div className="bg-[#0c152e]/95 backdrop-blur-md border border-[#1d2f65] p-3 rounded-2xl shadow-2xl max-w-xs text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white flex items-center space-x-1.5 truncate">
                          <Navigation className="w-3.5 h-3.5 text-[#f77f00]" />
                          <span>Route Telematics</span>
                        </span>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            onClick={() => openUniversalInspector('carrier', currentCarrier.id)}
                            title="Inspect Carrier Specs"
                            className="text-slate-400 hover:text-cyan-400 p-1 rounded hover:bg-[#142045] transition"
                          >
                            <Info className="w-3.5 h-3.5 text-cyan-400" />
                          </button>
                          <button
                            onClick={requestUserLocation}
                            title="My GPS"
                            className="text-[9px] bg-[#1d2f65] hover:bg-[#142045] text-cyan-400 px-1.5 py-0.5 rounded flex items-center space-x-0.5"
                          >
                            <Crosshair className="w-3 h-3" />
                            <span>GPS</span>
                          </button>
                          <button
                            onClick={() => setIsHudMinimized(prev => !prev)}
                            title={isHudMinimized ? "Expand" : "Minimize"}
                            className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#142045] transition"
                          >
                            {isHudMinimized ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setIsHudHidden(true)}
                            title="Remove from map"
                            className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-[#142045] transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {!isHudMinimized && (
                        <div className="space-y-2">
                          <div className="bg-[#050a18]/90 p-2 rounded-xl border border-[#1d2f65] text-[11px] space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Carrier Tracked:</span>
                              <span className="font-mono text-[#f77f00] font-bold">{currentCarrier.id}</span>
                            </div>
                            {currentCarrier.awbNumber && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400">Linked AWB:</span>
                                <button
                                  onClick={() => setShow3DMapOverlay(true)}
                                  title="View 3D WebGL Vehicle at GPS coordinates"
                                  className="font-mono text-cyan-300 font-bold hover:underline flex items-center space-x-1"
                                >
                                  <span>{currentCarrier.awbNumber}</span>
                                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 rounded">3D</span>
                                </button>
                              </div>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Dynamic Coords:</span>
                              <span className="font-mono text-cyan-400 font-bold">
                                {currentCarrier.coords[0].toFixed(3)}° N, {currentCarrier.coords[1].toFixed(3)}° E
                              </span>
                            </div>
                            {/* Real-Time Estimated Arrival on HUD */}
                            <div className="flex justify-between items-center pt-0.5 border-t border-[#1d2f65]/60">
                              <span className="text-slate-400 flex items-center space-x-1">
                                <Clock className="w-3 h-3 text-[#f77f00]" />
                                <span>Estimated Arrival:</span>
                              </span>
                              <span className="font-mono text-cyan-300 font-bold">
                                {etaFormatted.shortTime}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Remaining Route:</span>
                              <span className="font-mono text-emerald-400 font-bold">
                                {remainingKm.toLocaleString()} km ({durationFormatted})
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-300 pt-0.5">
                            <span>Security State:</span>
                            <span className={`font-mono font-bold flex items-center space-x-1 ${isThirdPartyBlocked ? 'text-red-400' : 'text-emerald-400'}`}>
                              {isThirdPartyBlocked ? <AlertTriangle className="w-3 h-3 text-red-400" /> : <CheckCircle className="w-3 h-3 text-emerald-400" />}
                              <span>{isThirdPartyBlocked ? '3rd-Party Quarantined' : '1st Person Validated'}</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsHudHidden(false)}
                      className="bg-[#0c152e]/95 hover:bg-[#142045] text-cyan-400 border border-[#1d2f65] px-3 py-1.5 rounded-xl shadow-xl text-xs font-semibold flex items-center space-x-1.5 transition"
                    >
                      <Navigation className="w-3.5 h-3.5 text-[#f77f00]" />
                      <span>Show Telematics & ETA</span>
                      <span className="text-[9px] bg-[#050a18] px-1.5 py-0.5 rounded text-slate-300 font-mono">Expand</span>
                    </button>
                  )}
                </div>

                {/* Bottom Carrier Quick Selector Chips */}
                <div className="absolute bottom-3 left-3 right-3 z-[500] pointer-events-none">
                  <div className="bg-[#0c152e]/95 backdrop-blur border border-[#1d2f65] p-2 rounded-2xl shadow-2xl flex items-center space-x-2 overflow-x-auto pointer-events-auto">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 hidden sm:inline whitespace-nowrap">
                      Select Carrier:
                    </span>
                    <div className="flex space-x-2">
                      {fleet.map(item => {
                        const isSel = item.id === selectedId;
                        const icon = item.mode === 'air' ? '✈️' : item.mode === 'sea' ? '🚢' : '🚛';
                        return (
                          <div key={item.id} className="flex items-center space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => handleSelectCarrier(item.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                                isSel
                                  ? 'bg-[#f77f00] text-white shadow ring-2 ring-[#f77f00]/50'
                                  : 'bg-[#050a18] text-slate-300 hover:bg-[#142045] border border-[#1d2f65]'
                              }`}
                            >
                              <span>{icon}</span>
                              <span className="font-mono font-bold">{item.id}</span>
                              <span className="text-[10px] text-cyan-400 font-mono">[{item.hubId}]</span>
                            </button>
                            <button
                              onClick={() => openUniversalInspector('carrier', item.id)}
                              className="p-1.5 rounded bg-[#050a18] hover:bg-[#142045] text-cyan-400 border border-[#1d2f65] text-[10px]"
                              title={`Inspect ${item.id} Specifications`}
                            >
                              <Info className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side Panel: AI Decision Engine & Real-Time Estimated Arrival */}
              <div className="w-full lg:w-96 bg-[#0c152e] border-t lg:border-t-0 lg:border-l border-[#1d2f65] flex flex-col p-3.5 space-y-3 overflow-y-auto max-h-[620px] lg:max-h-full">
                
                {/* AI REAL-TIME DECISION CARD */}
                <div className={`bg-gradient-to-b from-[#142045] to-[#0c152e] border-2 rounded-2xl p-3.5 space-y-3 shadow-xl transition-all ${
                  currentCarrier.status === 'disrupted' ? 'border-[#f77f00]' : 'border-emerald-500'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <span className="p-1 rounded-lg bg-[#f77f00] text-white shadow">
                        <Cpu className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">AI Decision Engine</span>
                    </div>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${
                      currentCarrier.status === 'disrupted'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {currentCarrier.status === 'disrupted' ? 'DETOUR READY' : 'CORRIDOR CLEAR'}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-extrabold text-white text-sm">
                        {currentCarrier.id} ({currentCarrier.name})
                      </h4>
                      
                      {/* Explanatory Risk Badge Button */}
                      <button
                        onClick={() => setRiskModalCarrierId(currentCarrier.id)}
                        className="group flex items-center space-x-1 bg-[#050a18]/90 hover:bg-[#1d2f65]/80 border border-[#1d2f65] px-2 py-0.5 rounded-lg transition"
                        title="Click to inspect risk breakdown"
                      >
                        <span className={`text-xs font-mono font-bold group-hover:text-amber-300 ${
                          currentCarrier.risk > 70 ? 'text-red-400' : currentCarrier.risk > 35 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          Risk: {currentCarrier.risk}/100
                        </span>
                        <Info className="w-3 h-3 text-slate-400 group-hover:text-amber-300" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">{currentCarrier.cause}</p>
                  </div>

                  {/* ================= REAL-TIME 'ESTIMATED ARRIVAL' CALCULATOR ================= */}
                  <div className="bg-[#050a18]/95 border border-[#1d2f65] rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#f77f00]" />
                        <span>AI Estimated Arrival Calculator</span>
                      </span>
                      <span className="flex items-center space-x-1 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>REAL-TIME DYNAMIC</span>
                      </span>
                    </div>

                    {/* Prominent ETA Display Card */}
                    <div className="bg-[#0c152e] p-2.5 rounded-xl border border-[#1d2f65]/80 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Estimated Arrival (ETA)</div>
                        <div className="text-base font-black font-mono text-cyan-300 tracking-tight flex items-center space-x-1.5 mt-0.5">
                          <span>{etaFormatted.fullDisplay}</span>
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1 mt-0.5">
                          <Timer className="w-3 h-3 text-emerald-400" />
                          <span>Remaining: {durationFormatted}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-mono">Distance to {currentCarrier.dest.split(' ')[0]}</div>
                        <div className="text-base font-bold font-mono text-white">
                          {remainingKm.toLocaleString()} <span className="text-xs text-slate-400 font-normal">km</span>
                        </div>
                        <div className="text-[9px] text-cyan-400 font-mono">
                          {(remainingKm * 0.539957).toFixed(0)} NM remaining
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar from Current Position to Destination Hub */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span className="truncate max-w-[120px]">{currentCarrier.origin.split(' ')[0]}</span>
                        <span className="text-cyan-400 font-bold">{routeStats.progressPct}% Journey Complete</span>
                        <span className="truncate max-w-[120px] text-right">{currentCarrier.dest.split(' ')[0]}</span>
                      </div>
                      <div className="w-full bg-[#050a18] rounded-full h-2 overflow-hidden border border-[#1d2f65]">
                        <div
                          className="bg-gradient-to-r from-blue-500 via-[#f77f00] to-emerald-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${routeStats.progressPct}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* User-Friendly Dynamic Velocity Controls */}
                    <div className="bg-[#0c152e]/60 p-2 rounded-lg border border-[#1d2f65]/60 space-y-1.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-300 flex items-center space-x-1">
                          <Gauge className="w-3 h-3 text-[#f77f00]" />
                          <span>Current Telemetry Speed:</span>
                        </span>
                        <span className="font-mono font-bold text-white">
                          {currentEffectiveSpeed} km/h <span className="text-slate-400 text-[9px]">({currentCarrier.tele.speed})</span>
                        </span>
                      </div>

                      {/* Interactive Velocity Throttle Slider */}
                      <div className="flex items-center space-x-2 pt-0.5">
                        <span className="text-[9px] text-slate-400 whitespace-nowrap">Throttle:</span>
                        <div className="flex-1 flex items-center space-x-1.5">
                          <input
                            type="range"
                            min="0.6"
                            max="1.5"
                            step="0.05"
                            value={speedMultiplier}
                            onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
                            className="w-full accent-[#f77f00] h-1.5 bg-[#050a18] rounded-lg cursor-pointer"
                            title={`Speed multiplier: ${(speedMultiplier * 100).toFixed(0)}%`}
                          />
                          <span className="text-[10px] font-mono text-cyan-400 font-bold w-10 text-right">
                            {(speedMultiplier * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Quick Throttle Presets */}
                      <div className="grid grid-cols-3 gap-1 pt-0.5">
                        <button
                          onClick={() => setSpeedMultiplier(0.8)}
                          className={`px-1.5 py-1 rounded text-[9px] font-mono transition border ${
                            Math.abs(speedMultiplier - 0.8) < 0.05
                              ? 'bg-[#142045] text-amber-300 border-amber-400/50'
                              : 'bg-[#050a18] text-slate-400 hover:text-white border-[#1d2f65]'
                          }`}
                        >
                          -20% Swell
                        </button>
                        <button
                          onClick={() => setSpeedMultiplier(1.0)}
                          className={`px-1.5 py-1 rounded text-[9px] font-mono transition border ${
                            Math.abs(speedMultiplier - 1.0) < 0.05
                              ? 'bg-[#142045] text-cyan-300 border-cyan-400/50'
                              : 'bg-[#050a18] text-slate-400 hover:text-white border-[#1d2f65]'
                          }`}
                        >
                          Cruise (1.0x)
                        </button>
                        <button
                          onClick={() => setSpeedMultiplier(1.2)}
                          className={`px-1.5 py-1 rounded text-[9px] font-mono transition border ${
                            Math.abs(speedMultiplier - 1.2) < 0.05
                              ? 'bg-[#142045] text-emerald-300 border-emerald-400/50'
                              : 'bg-[#050a18] text-slate-400 hover:text-white border-[#1d2f65]'
                          }`}
                        >
                          +20% Express
                        </button>
                      </div>
                    </div>

                    {/* Connecting Hub Handoff Sync Window */}
                    <div className="flex items-center justify-between text-[10px] text-slate-300 pt-0.5 border-t border-[#1d2f65]/60">
                      <span className="flex items-center space-x-1">
                        <GitMerge className="w-3 h-3 text-cyan-400" />
                        <span>Dock Berth Window:</span>
                      </span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {etaFormatted.windowDisplay}
                      </span>
                    </div>
                  </div>

                  {/* Interconnected Feeder Link Box */}
                  <div className="bg-[#050a18]/95 border border-[#1d2f65] rounded-xl p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-cyan-400 flex items-center space-x-1">
                        <GitMerge className="w-3 h-3" />
                        <span>Handoff Pipeline Link:</span>
                      </span>
                      <span className="text-emerald-400 font-mono text-[9px]">DOCK SYNCED</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{currentCarrier.interconnectDesc}</p>
                  </div>

                  {/* Live AI Solution & Trajectory Details */}
                  <div className="bg-[#050a18]/90 p-2.5 rounded-xl border border-[#1d2f65] text-xs space-y-1">
                    <span className="text-[#f77f00] font-bold text-[11px] block">Live Detour Trajectory:</span>
                    <p className="text-slate-200 text-[11px]">{currentCarrier.solution}</p>
                    <div className="grid grid-cols-2 gap-1 text-[10px] font-mono pt-1 text-slate-400 border-t border-[#1d2f65]/60">
                      <div>Delay Avoided: <strong className="text-emerald-400">{currentCarrier.delay}</strong></div>
                      <div>Extra Fuel: <strong className="text-slate-200">{currentCarrier.fuel}</strong></div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2 pt-1">
                    <button
                      disabled={isAnimatingRoute}
                      onClick={() => executeDetourAnimation(currentCarrier.id)}
                      className={`flex-1 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg flex items-center justify-center space-x-1.5 transition transform active:scale-95 ${
                        isAnimatingRoute
                          ? 'bg-slate-700 opacity-60 cursor-not-allowed'
                          : 'bg-gradient-to-r from-[#f77f00] to-amber-500 hover:from-amber-600 hover:to-[#f77f00]'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isAnimatingRoute ? 'Executing Waypoints...' : 'Approve & Animate Reroute'}</span>
                    </button>
                    <button
                      onClick={() => addToast("Deferred", "Carrier continues on baseline corridor buffer.", "amber")}
                      className="bg-[#142045] hover:bg-[#1d2f65] text-slate-300 py-2 px-3 rounded-xl text-xs border border-[#1d2f65]"
                    >
                      Ignore
                    </button>
                  </div>
                </div>

                {/* CARRIER TELEMETRY PANEL WITH INFO BUTTON */}
                <div className="bg-[#142045]/40 border border-[#1d2f65] rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white uppercase flex items-center space-x-1.5">
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Live Telemetry Gauges</span>
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono text-[#f77f00] text-xs font-bold">{currentCarrier.id}</span>
                      <button
                        onClick={() => openUniversalInspector('carrier', currentCarrier.id)}
                        className="p-1 rounded bg-[#050a18] hover:bg-[#1d2f65] text-cyan-400 transition"
                        title="Inspect Full Telemetry & Thresholds"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs">
                    <div className="bg-[#050a18] p-2 rounded-xl border border-[#1d2f65]">
                      <div className="text-[9px] text-slate-400 font-sans">Cargo Temp</div>
                      <div className="text-emerald-400 font-bold">{currentCarrier.tele.temp}</div>
                    </div>
                    <div className="bg-[#050a18] p-2 rounded-xl border border-[#1d2f65]">
                      <div className="text-[9px] text-slate-400 font-sans">Altitude / Elev</div>
                      <div className="text-cyan-400 font-bold">{currentCarrier.tele.alt}</div>
                    </div>
                    <div className="bg-[#050a18] p-2 rounded-xl border border-[#1d2f65]">
                      <div className="text-[9px] text-slate-400 font-sans">Vibration / Swell</div>
                      <div className="text-slate-200 font-bold">{currentCarrier.tele.shock}</div>
                    </div>
                    <div className="bg-[#050a18] p-2 rounded-xl border border-[#1d2f65]">
                      <div className="text-[9px] text-slate-400 font-sans">Velocity</div>
                      <div className="text-slate-200 font-bold">{currentCarrier.tele.speed}</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-300 pt-1 border-t border-[#1d2f65] space-y-0.5">
                    <div>Manifest: <strong className="text-white">{currentCarrier.manifest}</strong></div>
                    <div>Commander / Driver: <strong className="text-slate-200">{currentCarrier.captain}</strong></div>
                  </div>
                </div>

              </div>
            </section>
          )}

          {/* ================= 2. TAB: VIRTUAL DIGITAL ID CARD ================= */}
          {activeTab === 'idcard' && (
            <section className="flex-1 p-4 lg:p-6 space-y-6 max-w-4xl mx-auto w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1d2f65]">
                <div>
                  <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
                    <Fingerprint className="w-5 h-5 text-cyan-400" />
                    <span>Decentralized Virtual Identity Card (Zero-Trust Party Auth)</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Cryptographic hardware passkey, FIDO2 biometric binding, and 3rd-party proxy containment
                  </p>
                </div>
                <a
                  href={`tel:${SUPPORT_PHONE}`}
                  className="text-xs bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 text-blue-300 font-mono font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition self-start sm:self-auto"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Support: {SUPPORT_PHONE}</span>
                </a>
              </div>

              <div className="flex justify-center">
                <div
                  className={`w-full max-w-lg border-2 rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4 transition-all duration-500 ${
                    isThirdPartyBlocked
                      ? 'border-red-500 bg-red-950/70 shadow-red-900/40'
                      : 'id-card-holo border-cyan-500/60 shadow-cyan-900/30'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow ${
                        isThirdPartyBlocked ? 'bg-red-600' : 'bg-gradient-to-tr from-cyan-500 to-blue-600'
                      }`}>
                        {isThirdPartyBlocked ? <AlertTriangle className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-extrabold">
                          AEGISCHAIN SECURE ID
                        </div>
                        <h3 className="text-lg font-black text-white tracking-wide">
                          {currentCarrier.captain.split('•')[0].trim()}
                        </h3>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {currentCarrier.id} • {currentCarrier.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                        isThirdPartyBlocked
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {isThirdPartyBlocked ? 'TAMPER INTERCEPTED' : '1ST-PARTY VALIDATED'}
                      </span>
                      <div className="text-[9px] text-slate-400 font-mono mt-1">FIDO2 LEVEL 3</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <div className="w-11 h-8 rounded bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300/80 shadow flex items-center justify-around px-1">
                      <div className="w-2 h-4 border-r border-amber-800/60"></div>
                      <div className="w-2 h-4 border-r border-amber-800/60"></div>
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] font-mono text-cyan-400">
                      <Wifi className="w-4 h-4 rotate-90" />
                      <span>NFC / HARDWARE ATTESTED</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-1">
                    <div className="bg-[#050a18]/70 p-2.5 rounded-xl border border-[#1d2f65]">
                      <span className="text-[10px] text-slate-400 font-sans block">Decentralized DID</span>
                      <span className="text-cyan-300 font-bold text-[11px] truncate block">
                        did:aegis:fido2:{currentCarrier.id.toLowerCase()}:enclave
                      </span>
                    </div>
                    <div className="bg-[#050a18]/70 p-2.5 rounded-xl border border-[#1d2f65]">
                      <span className="text-[10px] text-slate-400 font-sans block">mTLS Proof Hash</span>
                      <span className="text-emerald-400 font-bold text-[11px] truncate block">
                        SHA256: 4f82...99bc
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#050a18]/90 border border-[#1d2f65] rounded-2xl p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative w-10 h-10 rounded-xl bg-[#0c152e] flex items-center justify-center text-cyan-400 border border-cyan-500/40 overflow-hidden">
                        <Fingerprint className="w-6 h-6" />
                        <div className="scan-line absolute left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Biometric Passkey Liveness</div>
                        <div className={`text-[10px] ${isThirdPartyBlocked ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                          {biometricStatus}
                        </div>
                      </div>
                    </div>
                    <button
                      disabled={isScanningBiometrics}
                      onClick={performBiometricScan}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow transition flex items-center space-x-1"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>{isScanningBiometrics ? 'Verifying...' : 'Verify Now'}</span>
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-1 border-t border-[#1d2f65]/60">
                    <span>
                      Authority:{' '}
                      <strong className={isThirdPartyBlocked ? 'text-red-400' : 'text-white'}>
                        {isThirdPartyBlocked ? 'LOCKED (Escrow Held)' : 'Full Autonomous Reroute & Sign'}
                      </strong>
                    </span>
                    <span>Valid Session: 04:59:12</span>
                  </div>
                </div>
              </div>

              {/* 3-Party Architecture Explanation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-[#0c152e] border border-[#1d2f65] p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white flex items-center space-x-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <span>1st Person (Subject)</span>
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      isThirdPartyBlocked ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {isThirdPartyBlocked ? 'SUSPENDED' : 'AUTHORIZED'}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    The genuine credential owner operating from their physical hardware Secure Enclave. Possesses unexportable private keys.
                  </p>
                </div>

                <div className="bg-[#0c152e] border border-[#1d2f65] p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white flex items-center space-x-1.5">
                      <Server className="w-4 h-4 text-blue-400" />
                      <span>2nd Person (Platform)</span>
                    </span>
                    <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold">
                      mTLS GATEWAY
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    AegisChain Central Control Tower validating cryptographic DPoP tokens, mutual TLS handshakes, and smart contract escrow releases.
                  </p>
                </div>

                <div className="bg-[#0c152e] border border-[#1d2f65] p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white flex items-center space-x-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span>3rd Person (Interference)</span>
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      isThirdPartyBlocked ? 'bg-red-500 text-white' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {isThirdPartyBlocked ? 'TAMPER INTERCEPTED' : 'ELIMINATED'}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    External proxies, Man-in-the-Middle token sniffers, or fraudulent freight brokers attempting unauthorized reroutes.
                  </p>
                  <button
                    onClick={toggleThirdPartyBlock}
                    className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 py-1.5 rounded-xl border border-red-500/40 font-semibold transition text-[11px]"
                  >
                    {isThirdPartyBlocked ? 'Unlock Escrow Security' : 'Toggle 3rd-Party Proxy Block'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ================= 3. TAB: CARGO CAMERA AI ================= */}
          {activeTab === 'cargo' && (
            <section className="flex-1 p-4 lg:p-6 space-y-4 max-w-4xl mx-auto w-full">
              <div className="flex items-center justify-between pb-2 border-b border-[#1d2f65]">
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Camera className="w-5 h-5 text-[#f77f00]" />
                  <span>Camera Cargo & Customs Seal Verification</span>
                </h2>
                <span className="text-xs text-cyan-400 font-mono">Carrier: {currentCarrier.id}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#0c152e] border border-[#1d2f65] p-3.5 rounded-xl space-y-2">
                  <div className="flex justify-between font-bold text-white">
                    <span>Origin Gate Scan</span>
                    <span className="text-emerald-400 font-mono">SEAL INTACT</span>
                  </div>
                  <img
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80"
                    alt="Cargo"
                    className="w-full h-44 object-cover rounded-lg border border-[#1d2f65]"
                  />
                  <p className="text-[11px] text-slate-300">
                    Customs security tag #AIR-981 verified against electronic airway bill.
                  </p>
                </div>

                <div className="bg-[#0c152e] border border-[#1d2f65] p-3.5 rounded-xl space-y-2">
                  <div className="flex justify-between font-bold text-white">
                    <span>Destination Dock Scan</span>
                    <span className="text-amber-400 font-mono">AWAITING CAMERA</span>
                  </div>
                  <div className="w-full h-44 bg-[#050a18] rounded-lg border-2 border-dashed border-[#1d2f65] flex flex-col items-center justify-center p-2 text-center">
                    <Camera className="w-8 h-8 text-slate-500 mb-1" />
                    <span className="text-[11px] text-slate-400">Snap delivery proof or barcode</span>
                    <label className="mt-2 bg-[#f77f00] hover:bg-[#d96e00] text-white py-1.5 px-3 rounded-lg font-bold cursor-pointer transition">
                      <span>Open Camera / Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handlePhotoCaptured}
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Captures high-res photos to perform tamper proofing on thermal-insulated pharmaceutical containers.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ================= 4. TAB: 3D AWB VEHICLE TRACKING HUB ================= */}
          {activeTab === 'awb' && (
            <AWBTrackingHub onOpenDevGuide={() => setIsDevGuideOpen(true)} />
          )}

        </main>

        {/* Mobile Friendly Bottom Nav Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c152e]/95 backdrop-blur-md border-t border-[#1d2f65] grid grid-cols-4 py-2 px-1 text-center">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center py-1 transition ${
              activeTab === 'map' ? 'text-[#f77f00]' : 'text-slate-400'
            }`}
          >
            <Layers className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-medium">Map</span>
          </button>
          <button
            onClick={() => setActiveTab('awb')}
            className={`flex flex-col items-center justify-center py-1 transition relative ${
              activeTab === 'awb' ? 'text-[#f77f00]' : 'text-cyan-400'
            }`}
          >
            <Box className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-medium">3D AWB</span>
            <span className="absolute top-0 right-6 w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          </button>
          <button
            onClick={() => setActiveTab('idcard')}
            className={`flex flex-col items-center justify-center py-1 transition ${
              activeTab === 'idcard' ? 'text-[#f77f00]' : 'text-slate-400'
            }`}
          >
            <Fingerprint className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-medium">Digital ID</span>
          </button>
          <button
            onClick={() => setActiveTab('cargo')}
            className={`flex flex-col items-center justify-center py-1 transition ${
              activeTab === 'cargo' ? 'text-[#f77f00]' : 'text-slate-400'
            }`}
          >
            <Camera className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-medium">Cargo AI</span>
          </button>
        </div>
      </div>

      {/* ================= MODAL 1: UNIVERSAL ENTITY INSPECTOR (FOR ALL ICONS) ================= */}
      {universalModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c152e] border-2 border-cyan-500 rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-[#1d2f65] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-extrabold">
                  {universalModal.type === 'carrier'
                    ? 'CARRIER TELEMETRY SPECIFICATION'
                    : universalModal.type === 'hub'
                    ? 'INTERMODAL GATEWAY SPECIFICATION'
                    : 'PHYSICAL HAZARD & SAFETY THRESHOLDS'}
                </span>
                <h3 className="text-base font-extrabold text-white flex items-center space-x-1.5">
                  <span>Inspector: {universalModal.id}</span>
                </h3>
              </div>
              <button
                onClick={() => setUniversalModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Entity Content */}
            <div className="space-y-3 text-xs">
              {universalModal.type === 'carrier' && (() => {
                const item = fleet.find(x => x.id === universalModal.id) || fleet[0];
                const stats = calculateRouteDistanceAndProgress(item.coords, item.path);
                const spd = parseSpeedToKmH(item.tele.speed);
                const durSec = spd > 0 ? Math.round((stats.totalKm / spd) * 3600) : 0;
                const etaObj = formatEstimatedArrivalTime(currentTime, durSec);

                return (
                  <>
                    <div className="bg-[#050a18]/90 p-3 rounded-2xl border border-[#1d2f65] space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Voyage / Corridor:</span>
                        <span className="text-white font-bold font-mono">{item.origin} ➔ {item.dest}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Carrier Commander:</span>
                        <span className="text-cyan-400 font-bold font-mono">{item.captain}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Manifest Payload:</span>
                        <span className="text-slate-200 font-mono">{item.manifest}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Current Velocity:</span>
                        <span className="text-emerald-400 font-mono font-bold">{item.tele.speed}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-[#1d2f65]">
                        <span className="text-slate-400 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-[#f77f00]" />
                          <span>Estimated Arrival (ETA):</span>
                        </span>
                        <span className="text-cyan-300 font-mono font-bold">{etaObj.fullDisplay}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Remaining Route Distance:</span>
                        <span className="text-emerald-400 font-mono font-bold">{stats.totalKm.toLocaleString()} km</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center font-mono">
                      <div className="bg-[#050a18] p-2 rounded-xl border border-[#1d2f65]">
                        <div className="text-[9px] text-slate-400 font-sans">Cargo Temp</div>
                        <div className="text-emerald-400 font-bold">{item.tele.temp}</div>
                      </div>
                      <div className="bg-[#050a18] p-2 rounded-xl border border-[#1d2f65]">
                        <div className="text-[9px] text-slate-400 font-sans">Current Risk</div>
                        <div className="text-red-400 font-bold">{item.risk} / 100</div>
                      </div>
                    </div>
                    <div className="bg-[#050a18]/80 p-2.5 rounded-xl border border-[#1d2f65]">
                      <span className="text-[#f77f00] font-bold block mb-1">🔗 Intermodal Pipeline Handoff:</span>
                      <p className="text-slate-300 text-[11px]">{item.interconnectDesc}</p>
                    </div>
                  </>
                );
              })()}

              {universalModal.type === 'hub' && (() => {
                const hub = hubs.find(h => h.id === universalModal.id) || hubs[0];
                return (
                  <>
                    <div className="bg-[#050a18]/90 p-3 rounded-2xl border border-[#1d2f65] space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Gateway Classification:</span>
                        <span className="text-cyan-400 font-bold">{hub.type}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Berth / Bay Capacity:</span>
                        <span className="text-white font-mono font-bold">{hub.berths}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Average Transfer Dwell:</span>
                        <span className="text-emerald-400 font-mono font-bold">{hub.dwell}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Dock Synchronization:</span>
                        <span className="text-emerald-400 font-mono">{hub.status}</span>
                      </div>
                    </div>
                    <div className="bg-[#050a18]/80 p-2.5 rounded-xl border border-[#1d2f65]">
                      <span className="text-cyan-400 font-bold block mb-1">Synchronized Feeder Link:</span>
                      <p className="text-slate-300 font-mono text-[11px]">{hub.connecting}</p>
                    </div>
                  </>
                );
              })()}

              {universalModal.type === 'hazard' && (() => {
                const haz = hazards.find(h => h.id === universalModal.id) || hazards[0];
                return (
                  <>
                    <div className="bg-[#050a18]/90 p-3 rounded-2xl border border-[#1d2f65] space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Measured Metric:</span>
                        <span className="text-amber-300 font-bold">{haz.metricName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Critical Safety Limit:</span>
                        <span className="text-emerald-400 font-mono font-bold">{haz.thresholdLimit}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Current Measured Value:</span>
                        <span className="text-red-400 font-mono font-bold">{haz.currentMetric} (BREACHED)</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Affected Trajectory:</span>
                        <span className="text-[#f77f00] font-mono font-bold">{haz.affectedCarrierId}</span>
                      </div>
                    </div>
                    <div className="bg-red-950/40 p-2.5 rounded-xl border border-red-500/50">
                      <span className="text-red-400 font-bold block mb-1">Physical Safety Assessment:</span>
                      <p className="text-slate-200 text-[11px]">{haz.detail}</p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t border-[#1d2f65]">
              <button
                onClick={() => setUniversalModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-[#142045] text-slate-200 py-2 rounded-xl text-xs font-semibold border border-[#1d2f65]"
              >
                Dismiss
              </button>
              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 text-blue-300 font-mono font-bold py-2 px-3 rounded-xl text-xs flex items-center space-x-1"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{SUPPORT_PHONE}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: EXPLAINABLE AI RISK PARAMETER BREAKDOWN ================= */}
      {riskModalCarrierId && (() => {
        const item = fleet.find(x => x.id === riskModalCarrierId) || fleet[0];
        const factors = item.riskFactors;
        const factorKeys: (keyof RiskFactors)[] = ['weather', 'route', 'cargo', 'trust'];
        const colors = { weather: 'bg-blue-500', route: 'bg-amber-500', cargo: 'bg-purple-500', trust: 'bg-emerald-500' };

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0c152e] border-2 border-cyan-500 rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-[#1d2f65] pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-extrabold">
                    EXPLAINABLE AI ENGINE
                  </span>
                  <h3 className="text-base font-extrabold text-white flex items-center space-x-1.5">
                    <span>Risk Breakdown: {item.id} ({item.name})</span>
                  </h3>
                </div>
                <button
                  onClick={() => setRiskModalCarrierId(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#050a18]/90 border border-[#1d2f65] rounded-2xl p-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs text-slate-400 font-medium">Combined Composite Risk:</span>
                  <div className="text-2xl font-black font-mono">{item.risk} / 100</div>
                  <span className={`text-[10px] font-mono font-bold ${
                    item.risk > 70 ? 'text-red-400' : item.risk > 35 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {item.risk > 70 ? 'CRITICAL SEVERITY (Detour Required)' : 'NOMINAL SEVERITY'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">Post-Reroute Estimate</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">➔ 14 / 100</span>
                  <span className="text-[9px] text-emerald-400 block">(-{Math.max(0, item.risk - 14)} pts avoided)</span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {factorKeys.map(key => {
                  const f = factors[key];
                  const pct = Math.round((f.score / f.max) * 100);
                  return (
                    <div key={key} className="bg-[#050a18]/70 border border-[#1d2f65] rounded-xl p-3 space-y-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-white flex items-center space-x-1.5">
                          {key === 'weather' && <CloudLightning className="w-3.5 h-3.5 text-blue-400" />}
                          {key === 'route' && <MapPin className="w-3.5 h-3.5 text-amber-400" />}
                          {key === 'cargo' && <Box className="w-3.5 h-3.5 text-purple-400" />}
                          {key === 'trust' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                          <span>{f.name}</span>
                        </span>
                        <span className="font-mono font-bold text-slate-200">{f.score} / {f.max} pts</span>
                      </div>
                      <div className="w-full bg-[#0c152e] rounded-full h-2 overflow-hidden">
                        <div className={`${colors[key]} h-full rounded-full transition-all duration-700`} style={{ width: `${pct}%` }}></div>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">{f.detail}</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-[#142045]/40 border border-[#1d2f65] rounded-xl p-3 text-[11px] text-slate-300 space-y-1">
                <span className="font-bold text-cyan-400 block flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Algorithmic Weighting Justification:</span>
                </span>
                <p className="leading-relaxed">{item.riskJustification}</p>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => {
                    setRiskModalCarrierId(null);
                    executeDetourAnimation(item.id);
                  }}
                  className="flex-1 bg-gradient-to-r from-[#f77f00] to-amber-500 text-white font-bold py-2 rounded-xl text-xs shadow flex items-center justify-center space-x-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Detour to Drop Risk</span>
                </button>
                <a
                  href={`tel:${SUPPORT_PHONE}`}
                  className="bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 text-blue-300 font-mono font-bold py-2 px-3 rounded-xl text-xs flex items-center space-x-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Helpline</span>
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= MODAL 3: ADD SHIPMENT ================= */}
      {isAddShipmentOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c152e] border-2 border-emerald-500 rounded-2xl max-w-lg w-full p-4 space-y-3 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#1d2f65] pb-2">
              <div className="flex items-center space-x-2 text-emerald-400">
                <PlusCircle className="w-5 h-5" />
                <h3 className="text-sm font-extrabold text-white">Deploy New Carrier to Connected Network</h3>
              </div>
              <button
                onClick={() => setIsAddShipmentOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewShipment} className="space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Shipment Reference ID:</label>
                  <input
                    type="text"
                    name="id"
                    defaultValue="AC-AIR-990"
                    required
                    className="w-full bg-[#050a18] border border-[#1d2f65] rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Freight Mode:</label>
                  <select name="mode" className="w-full bg-[#050a18] border border-[#1d2f65] rounded-lg p-2 text-white">
                    <option value="air">Air Cargo Flight ✈️</option>
                    <option value="sea">Maritime Ocean Vessel 🚢</option>
                    <option value="road">Interstate Highway Truck 🚛</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Cargo Manifest / Payload Description:</label>
                <input
                  type="text"
                  name="product"
                  defaultValue="Semiconductor Wafers / Cold-Chain Vaccines"
                  required
                  className="w-full bg-[#050a18] border border-[#1d2f65] rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Origin Gateway:</label>
                  <select name="origin" className="w-full bg-[#050a18] border border-[#1d2f65] rounded-lg p-2 text-white">
                    <option value="Frankfurt Airport, DE|50.0379,8.5622|BLR">Frankfurt Airport [BLR Link]</option>
                    <option value="Singapore Port, SG|1.2600,103.8200|MAA">Singapore Keppel Port [MAA Link]</option>
                    <option value="Dubai Jebel Ali, AE|25.0100,55.0600|BOM">Dubai Jebel Ali Basin [BOM Link]</option>
                    <option value="Bengaluru Hub, IN|13.1986,77.7066|BLR">Bengaluru Hub [BLR]</option>
                    <option value="Chennai Port, IN|13.0827,80.3200|MAA">Chennai Gateway [MAA]</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Destination Gateway:</label>
                  <select name="dest" className="w-full bg-[#050a18] border border-[#1d2f65] rounded-lg p-2 text-white">
                    <option value="Bengaluru Hub, IN|13.1986,77.7066|BLR">Bengaluru Hub [BLR]</option>
                    <option value="Chennai Port, IN|13.0827,80.3200|MAA">Chennai Port [MAA]</option>
                    <option value="Mumbai Nhava Sheva, IN|18.9300,72.8200|BOM">Mumbai Terminal [BOM]</option>
                    <option value="Koppal Logistics, IN|15.3400,76.1500|BLR">Koppal Logistics Hub</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Quantity / Volume:</label>
                  <input
                    type="text"
                    name="qty"
                    defaultValue="1,200 kg (2 TEU)"
                    required
                    className="w-full bg-[#050a18] border border-[#1d2f65] rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Commander / Captain / Driver:</label>
                  <input
                    type="text"
                    name="driver"
                    defaultValue="Capt. Liam Ross • Carrier Unit 88"
                    required
                    className="w-full bg-[#050a18] border border-[#1d2f65] rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold py-2.5 rounded-xl shadow transition flex items-center justify-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Deploy to Connected Pipeline</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: SIMULATOR ================= */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c152e] border-2 border-[#f77f00] rounded-2xl max-w-md w-full p-4 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1d2f65] pb-2">
              <h3 className="font-bold text-white text-sm flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-[#f77f00]" />
                <span>What-If Disruption Simulator</span>
              </h3>
              <button
                onClick={() => setIsSimulatorOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <button
                onClick={() => {
                  setIsSimulatorOpen(false);
                  triggerHazardLimitBreach("haz-bengal");
                }}
                className="w-full text-left p-2.5 rounded-xl bg-red-950/40 hover:bg-red-950/60 border border-[#f77f00] flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-[#f77f00]">🌊 Cyclone Hazard Limit Breach (Swell &gt; 3.5m)</div>
                  <p className="text-[10px] text-slate-300">Triggers instantaneous autonomous nautical self-rerouting.</p>
                </div>
                <span className="font-bold text-[#f77f00]">Breach ➔</span>
              </button>

              <button
                onClick={() => {
                  setIsSimulatorOpen(false);
                  toggleThirdPartyBlock();
                }}
                className="w-full text-left p-2.5 rounded-xl bg-red-950/40 hover:bg-red-950/60 border border-red-500/50 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-red-400">🛡️ Security: 3rd-Party Proxy Session Tamper</div>
                  <p className="text-[10px] text-slate-300">Simulate unauthorized broker altering route; locks smart escrow.</p>
                </div>
                <span className="font-bold text-red-400">Trigger ➔</span>
              </button>

              <button
                onClick={() => {
                  setIsSimulatorOpen(false);
                  triggerHazardLimitBreach("haz-redsea");
                }}
                className="w-full text-left p-2.5 rounded-xl bg-[#050a18] hover:bg-[#142045] border border-[#1d2f65] flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-cyan-400">✈️ Air Cargo: Red Sea Volcanic Ash Plume</div>
                  <p className="text-[10px] text-slate-400">Forces Boeing 777F detour; synchronizes connecting truck.</p>
                </div>
                <span className="font-bold text-[#f77f00]">Trigger ➔</span>
              </button>

              <button
                onClick={() => {
                  setIsSimulatorOpen(false);
                  triggerHazardLimitBreach("haz-hubballi");
                }}
                className="w-full text-left p-2.5 rounded-xl bg-[#050a18] hover:bg-[#142045] border border-[#1d2f65] flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-amber-400">🚛 Highway Reefer: Hubballi Flash Flood</div>
                  <p className="text-[10px] text-slate-400">Detours vaccine truck via NH-50 Koppal corridor.</p>
                </div>
                <span className="font-bold text-[#f77f00]">Trigger ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST NOTIFICATIONS ================= */}
      <div className="fixed top-16 right-4 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm">
        {toasts.map(toast => {
          const borderClass =
            toast.color === 'emerald'
              ? 'border-emerald-500'
              : toast.color === 'red'
              ? 'border-red-500'
              : toast.color === 'orange'
              ? 'border-[#f77f00]'
              : toast.color === 'amber'
              ? 'border-amber-400'
              : 'border-cyan-500';

          return (
            <div
              key={toast.id}
              className={`p-3 rounded-2xl border ${borderClass} bg-[#0c152e] text-xs text-white shadow-2xl pointer-events-auto transition-all`}
            >
              <div className="font-bold">{toast.title}</div>
              <div className="text-[11px] text-slate-300">{toast.message}</div>
            </div>
          );
        })}
      </div>

      {/* ================= UNIVERSAL SPOTLIGHT SEARCH MODAL ================= */}
      <UniversalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigateTab={tab => setActiveTab(tab)}
        onSelectCarrier={id => handleSelectCarrier(id)}
        onSelectHub={id => {
          setHubFilter(id);
          const hub = hubs.find(h => h.id === id);
          if (hub && mapRef.current) {
            mapRef.current.flyTo(hub.coords, 6, { duration: 1 });
          }
        }}
        onSelectHazard={id => openUniversalInspector('hazard', id)}
        onOpenDevGuide={() => setIsDevGuideOpen(true)}
        onOpenAddShipment={() => setIsAddShipmentOpen(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onToggleThirdPartyBlock={toggleThirdPartyBlock}
        onTriggerHazardLimitBreach={triggerHazardLimitBreach}
        onZoom={zoomTo}
        onToggleHud={() => setIsHudHidden(prev => !prev)}
        onToggleHazards={() => setShowHazards(prev => !prev)}
        fleet={fleet}
        hubs={hubs}
        hazards={hazards}
        isThirdPartyBlocked={isThirdPartyBlocked}
        supportPhone={SUPPORT_PHONE}
      />

      {/* ================= FLOATING AI ASSISTANT WIDGET ================= */}
      <AIAssistantWidget
        onOpenDevGuide={() => setIsDevGuideOpen(true)}
        onOpenAWBHub={() => setActiveTab('awb')}
      />

      {/* ================= DEVELOPER HACKATHON INTEGRATION MODAL ================= */}
      <DeveloperIntegrationModal
        isOpen={isDevGuideOpen}
        onClose={() => setIsDevGuideOpen(false)}
      />

    </div>
  );
}

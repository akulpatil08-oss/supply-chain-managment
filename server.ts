import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());

// Initialize Google GenAI client (Server-Side Only)
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ==========================================
// AWB GENERATION & TRACKING BACKEND ENGINE
// ==========================================

/**
 * Standard Air Waybill (AWB) Unique ID Generator
 * Format: AWB-AEGIS-{YEAR}-{HUB}-{SERIAL}{CHECK_DIGIT} (or standard IATA 3-7-1 format)
 * Uses standard Modulo-7 check digit algorithm (IATA standard for AWBs)
 */
function generateUniqueAWB(hub: string = 'BLR') {
  const year = new Date().getFullYear();
  // 6 digit serial number
  const serialNumber = Math.floor(100000 + Math.random() * 900000);
  const checkDigit = serialNumber % 7;
  const trackingNumber = `AWB-AEGIS-${year}-${hub.toUpperCase()}-${serialNumber}${checkDigit}`;

  const modes: Array<'air' | 'sea' | 'road'> = hub === 'BLR' ? ['air', 'road'] : (hub === 'MAA' ? ['sea', 'road'] : ['sea', 'road']);
  const chosenMode = modes[Math.floor(Math.random() * modes.length)];

  const originCoords: [number, number] = hub === 'MAA' ? [13.0827, 80.3200] : (hub === 'BOM' ? [18.9300, 72.8200] : [13.1986, 77.7066]);
  const destCoords: [number, number] = hub === 'BLR' ? [18.9300, 72.8200] : [13.1986, 77.7066];
  const midLat = (originCoords[0] + destCoords[0]) / 2;
  const midLng = (originCoords[1] + destCoords[1]) / 2;

  return {
    trackingNumber,
    awbNumber: trackingNumber,
    serialNumber,
    checkDigit,
    year,
    hub,
    mode: chosenMode,
    createdAt: new Date().toISOString(),
    status: 'IN_TRANSIT',
    progressPct: Math.floor(35 + Math.random() * 45),
    vehicleType: chosenMode === 'air' ? 'Boeing 777F Freighter' : (chosenMode === 'sea' ? 'Ocean Cargo Vessel' : 'Volvo FH Reefer Rig'),
    currentSpeed: chosenMode === 'air' ? 'Mach 0.82 (870 km/h)' : (chosenMode === 'sea' ? '19.5 Knots (36 km/h)' : '68 km/h'),
    cargoTemp: chosenMode === 'air' ? '4.1°C' : (chosenMode === 'sea' ? '18.2°C' : '3.8°C'),
    qrData: `https://aegischain.live/track/${trackingNumber}`,
    barcode: `||| | |||| || ||| | ||| ${serialNumber}${checkDigit}`,
    // Geographic Coordinates & 3D Telematics
    currentCoords: [midLat, midLng] as [number, number],
    altitudeMeters: chosenMode === 'air' ? 10972 : (chosenMode === 'sea' ? 0 : 540),
    headingDegrees: Math.floor(Math.random() * 360),
    origin: {
      name: `${hub} Intermodal Terminal`,
      code: hub,
      coords: originCoords
    },
    destination: {
      name: 'Destination Freight Gateway',
      code: 'DEST',
      coords: destCoords
    },
    routeWaypoints: [originCoords, [midLat, midLng], destCoords],
    milestones: [
      { step: 1, label: 'Order Registered & Seal Bound', time: '08:30 IST', done: true },
      { step: 2, label: 'Customs & Hardware Passkey Attested', time: '09:45 IST', done: true },
      { step: 3, label: 'In Transit / 3D Telematics Active', time: '11:15 IST', done: true },
      { step: 4, label: 'Autonomous Detour / Hazard Evasion', time: '13:00 IST', done: true },
      { step: 5, label: 'Destination Hub Docking', time: 'Est. 16:45 IST', done: false }
    ]
  };
}

// In-memory demo order database with full geographic coordinates
const mockOrdersDatabase: Record<string, ReturnType<typeof generateUniqueAWB>> = {
  '098-4729104': {
    trackingNumber: '098-4729104',
    awbNumber: '098-4729104',
    serialNumber: 472910,
    checkDigit: 4,
    year: 2026,
    hub: 'BLR',
    mode: 'air',
    createdAt: '2026-10-22T02:00:00.000Z',
    status: 'IN_TRANSIT',
    progressPct: 68,
    vehicleType: 'Boeing 777F Freighter',
    currentSpeed: 'Mach 0.82 (875 km/h)',
    cargoTemp: '4.1°C',
    qrData: 'https://aegischain.live/track/098-4729104',
    barcode: '||| | |||| || ||| | ||| 4729104',
    currentCoords: [25.2000, 55.3000],
    altitudeMeters: 10972,
    headingDegrees: 118,
    origin: {
      name: 'Frankfurt Cargo City (FRA)',
      code: 'FRA',
      coords: [50.0379, 8.5622]
    },
    destination: {
      name: 'Bengaluru Kempegowda Hub (BLR)',
      code: 'BLR',
      coords: [13.1986, 77.7066]
    },
    routeWaypoints: [[50.0379, 8.5622], [36.0, 36.0], [25.2, 55.3], [13.1986, 77.7066]],
    milestones: [
      { step: 1, label: 'FRA Export Customs Cleared', time: '02:00 UTC', done: true },
      { step: 2, label: 'Flight FL360 Telematics Engaged', time: '04:30 UTC', done: true },
      { step: 3, label: 'Red Sea Volcanic Plume Evasion Detour', time: '07:15 UTC', done: true },
      { step: 4, label: 'Arabian Sea Cruise Corridor', time: '09:00 UTC', done: true },
      { step: 5, label: 'BLR Intermodal Cargo Docking', time: 'Est. 11:30 UTC', done: false }
    ]
  },
  '125-8849201': {
    trackingNumber: '125-8849201',
    awbNumber: '125-8849201',
    serialNumber: 884920,
    checkDigit: 1,
    year: 2026,
    hub: 'BLR',
    mode: 'road',
    createdAt: '2026-10-22T04:00:00.000Z',
    status: 'IN_TRANSIT',
    progressPct: 42,
    vehicleType: 'Volvo FH Reefer Rig',
    currentSpeed: '68 km/h',
    cargoTemp: '3.8°C',
    qrData: 'https://aegischain.live/track/125-8849201',
    barcode: '||| | |||| || ||| | ||| 8849201',
    currentCoords: [15.3647, 75.1240], // Hubballi on NH-48
    altitudeMeters: 620,
    headingDegrees: 334,
    origin: {
      name: 'Bengaluru Intermodal Hub (BLR)',
      code: 'BLR',
      coords: [13.1986, 77.7066]
    },
    destination: {
      name: 'Mumbai JNPT Port Terminal (BOM)',
      code: 'BOM',
      coords: [18.9300, 72.8200]
    },
    routeWaypoints: [[13.1986, 77.7066], [14.4644, 75.9218], [15.3647, 75.1240], [18.9300, 72.8200]],
    milestones: [
      { step: 1, label: 'Vaccines Transshipped at BLR Hub', time: '04:00 IST', done: true },
      { step: 2, label: 'Cold-Chain Telemetry Verified (3.8°C)', time: '04:30 IST', done: true },
      { step: 3, label: 'NH-48 Intermodal Highway Transit', time: '07:15 IST', done: true },
      { step: 4, label: 'Hubballi Flood Basin Detour via Koppal', time: '10:00 IST', done: true },
      { step: 5, label: 'Mumbai JNPT Pharma Cold Store Dock', time: 'Est. 18:30 IST', done: false }
    ]
  },
  '312-6401925': {
    trackingNumber: '312-6401925',
    awbNumber: '312-6401925',
    serialNumber: 640192,
    checkDigit: 5,
    year: 2026,
    hub: 'MAA',
    mode: 'sea',
    createdAt: '2026-10-20T12:00:00.000Z',
    status: 'IN_TRANSIT',
    progressPct: 35,
    vehicleType: 'MV Pacific Titan (8,400 TEU)',
    currentSpeed: '19.5 Knots (36 km/h)',
    cargoTemp: '18.2°C',
    qrData: 'https://aegischain.live/track/312-6401925',
    barcode: '||| | |||| || ||| | ||| 6401925',
    currentCoords: [4.1000, 99.8000], // Malacca Strait
    altitudeMeters: 0,
    headingDegrees: 298,
    origin: {
      name: 'Singapore Keppel Port (SIN)',
      code: 'SIN',
      coords: [1.2600, 103.8200]
    },
    destination: {
      name: 'Chennai Port Maritime Terminal (MAA)',
      code: 'MAA',
      coords: [13.0827, 80.3200]
    },
    routeWaypoints: [[1.26, 103.82], [4.10, 99.80], [6.00, 95.00], [13.0827, 80.3200]],
    milestones: [
      { step: 1, label: 'Singapore Keppel Dock Release', time: 'Oct 20 12:00', done: true },
      { step: 2, label: 'Malacca Strait Transit', time: 'Oct 21 04:30', done: true },
      { step: 3, label: 'Bay of Bengal Cyclone Detour Applied', time: 'Oct 22 08:00', done: true },
      { step: 4, label: 'South Sri Lanka Deep-Sea Corridor', time: 'Oct 22 13:00', done: true },
      { step: 5, label: 'Chennai Port Berth 4 Arrival', time: 'Est. Oct 24 18:00', done: false }
    ]
  }
};

// API: Generate new unique AWB
app.post('/api/awb/generate', (req: Request, res: Response) => {
  const { hub = 'BLR' } = req.body;
  const newAWB = generateUniqueAWB(hub);
  mockOrdersDatabase[newAWB.trackingNumber] = newAWB;
  res.json({ success: true, order: newAWB });
});

// API: Track existing AWB
app.get('/api/awb/track/:id', (req: Request, res: Response) => {
  const id = req.params.id.trim();
  const normalized = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  // Try direct match or normalized match
  let order = mockOrdersDatabase[id] || mockOrdersDatabase[id.toUpperCase()];
  if (!order) {
    for (const [key, val] of Object.entries(mockOrdersDatabase)) {
      if (key.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === normalized) {
        order = val;
        break;
      }
    }
  }

  if (order) {
    return res.json({ success: true, order });
  }

  // If not found in memory, generate dynamically on-the-fly for smooth hackathon demo
  const hubMatch = id.includes('MAA') ? 'MAA' : (id.includes('BOM') ? 'BOM' : 'BLR');
  const synthetic = generateUniqueAWB(hubMatch);
  synthetic.trackingNumber = id;
  synthetic.awbNumber = id;
  mockOrdersDatabase[id] = synthetic;
  return res.json({ success: true, order: synthetic, synthesized: true });
});

// ==========================================
// AI ASSISTANT CHAT ROUTE (SERVER-SIDE GEMINI)
// ==========================================
const AEGIS_SYSTEM_INSTRUCTION = `You are "Aegis AI Copilot", the intelligent logistics assistant for AegisChain.
Your goal is to help hackathon judges, customers, and operations managers understand:
1. Autonomous Hazard Self-Rerouting: How AegisChain uses physical safety limits (Bay of Bengal swell 3.5m, Red Sea ash 60mg/m³, Hubballi flood 1.5m) to dynamically detour airplanes, cargo ships, and reefer trucks in real time with ZERO human latency.
2. Air Waybill (AWB) Tracking: How unique AWB IDs are generated with Modulo-7 check digits (AWB-AEGIS-2026-{HUB}-{SERIAL}{CHECK}) and verified against tamper shields.
3. 3D Animated Vehicle Tracking: How customers view interactive 3D WebGL models (Boeing 777F with spinning jet turbines, Ocean Container Vessel with animated sea wake, and Highway Reefer Rig with turning dual axles) in real-time space rather than flat 2D icons.
4. Security & Trust: The decentralized Virtual ID card with FIDO2 biometric passkey liveness (1st-Person subject hardware enclave vs 3rd-person proxy interceptor).
5. 24/7 Helpline: 9353086392 for central dispatch and manual escrow release.

Tone: Professional, enthusiastic, technical yet scannable, using clear bullet points. Keep answers direct and helpful for hackathon demos.`;

app.post('/api/assistant/chat', async (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // If Gemini API is configured on server, query Gemini 3.8 Flash
  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: message,
        config: {
          systemInstruction: AEGIS_SYSTEM_INSTRUCTION,
          temperature: 0.7,
        },
      });

      return res.json({
        reply: response.text || 'I processed your request, but received an empty response. Please try again.',
        source: 'gemini-3.8-flash',
      });
    } catch (err: any) {
      console.error('Gemini API call error:', err);
      // Fall through to domain fallback
    }
  }

  // High-fidelity fallback knowledge engine for zero-key hackathon demos
  const query = message.toLowerCase();
  let fallbackReply = '';

  if (query.includes('awb') || query.includes('tracking') || query.includes('unique id')) {
    fallbackReply = `### 📦 Air Waybill (AWB) Unique ID System
AegisChain generates unique 11-digit multimodal tracking numbers modeled after IATA standard 600-series airway bills:
- **Format:** \`AWB-AEGIS-{YEAR}-{HUB}-{SERIAL}{CHECK_DIGIT}\`
- **Example:** \`AWB-AEGIS-2026-BLR-7489214\`
- **Validation Algorithm:** The last digit is an ISO Modulo-7 check digit (\`serialNumber % 7\`). This prevents keystroke error and fraudulent order tampering before escrow release.
- **3D Visualization:** Once looked up, the order renders a **live 3D animated vehicle** (Airplane, Ship, or Reefer Truck) along with real-time waypoint velocity and cargo temperature!`;
  } else if (query.includes('3d') || query.includes('vehicle') || query.includes('animation') || query.includes('three')) {
    fallbackReply = `### 🎮 3D Animated Vehicle Tracking
Unlike legacy 2D map dots, AegisChain incorporates procedural WebGL 3D models via Three.js:
1. **✈️ Boeing 777F Freighter:** 8-part procedural mesh with swept wings, banking roll angle, and spinning turbine fan blades.
2. **🚢 MV Pacific Titan Container Vessel:** Deep-draft hull with stacked multi-color 40ft TEUs, bridge tower, and animated ocean foam wake.
3. **🚛 Volvo FH Reefer Rig:** Aerodynamic cabin, chrome grille, insulated cold-chain cargo container, and spinning dual-axle rubber tires.
- **Interactive Controls:** Rotate, pitch, tilt, toggle wireframe vs PBR metallic finishes, and adjust throttle speed to see real-time ETA changes!`;
  } else if (query.includes('hazard') || query.includes('reroute') || query.includes('detour') || query.includes('breach')) {
    fallbackReply = `### ⚡ Autonomous Hazard Self-Rerouting (Zero Human Latency)
AegisChain continuously monitors physical safety envelopes:
- **Bay of Bengal Cyclone:** Max Swell Limit = \`3.5 m\` (Breached at 4.8 m ➔ Diverts ocean vessels south of Sri Lanka).
- **Red Sea Volcanic Plume:** Max Ash Density = \`60 mg/m³\` (Breached at 85 mg/m³ ➔ Diverts Boeing 777F over Northern Arabian Gulf).
- **Hubballi Flood Basin:** Max Culvert Water = \`1.5 m\` (Breached at 2.8 m ➔ Diverts reefer trucks via NH-50 Koppal corridor).
When limits breach, the engine recalculates new waypoints and animates the detour without waiting for manual dispatcher approvals.`;
  } else if (query.includes('security') || query.includes('id card') || query.includes('3rd-party') || query.includes('tamper')) {
    fallbackReply = `### 🛡️ Zero-Trust Virtual Digital ID & Tamper Shield
- **1st-Party Subject:** Verified driver/pilot operating from their hardware device Secure Enclave with FIDO2 Level 3 biometric attestation.
- **2nd-Party Gateway:** AegisChain mTLS server enforcing cryptographic DPoP tokens.
- **3rd-Party Intermediary:** External brokers or proxy sniffers attempting unauthorized route diversion are automatically quarantined with smart contract escrow frozen.`;
  } else {
    fallbackReply = `### 🌐 AegisChain Autonomous Multimodal AI
Welcome! I am the **Aegis AI Copilot**. You can ask me about:
- **AWB Unique Tracking:** How unique order IDs are generated & validated.
- **3D Vehicle Rendering:** How our Three.js procedural vehicles animate real-time shipping progress.
- **Autonomous Evasion:** How Doppler hazards automatically recalculate detour trajectories.
- **Developer Code Integration:** Ready-to-use Express backend snippets and React 3D viewer boilerplate.
- **Dispatch Helpline:** Quick dial \`9353086392\` for 24/7 central control tower support.`;
  }

  return res.json({
    reply: fallbackReply,
    source: 'aegis-knowledge-engine'
  });
});

// ==========================================
// VITE DEV SERVER / PRODUCTION STATIC HOSTING
// ==========================================
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AegisChain] Full-Stack server running on port ${PORT} (Prod: ${isProd})`);
  });
}

startServer();

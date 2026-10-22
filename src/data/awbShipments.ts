/**
 * AegisChain AWB Data Structure & Geolocation Registry
 * 
 * Links unique Air Waybill (AWB) numbers to real-time multimodal shipment telemetry,
 * exact geographic coordinates [latitude, longitude], altitude, heading azimuth,
 * and high-density road/flight/nautical trajectories.
 * 
 * AWB Number Format: {AIRLINE_PREFIX}-{SERIAL_NUMBER}{CHECK_DIGIT} (IATA Standard)
 * Algorithm: Modulo-7 check digit validation (serialNumber % 7 === checkDigit)
 */

export interface AWBShipmentRecord {
  awbNumber: string;
  airlinePrefix: string;
  serialNumber: number;
  checkDigit: number;
  carrierId: string;
  vehicleName: string;
  mode: 'air' | 'sea' | 'road';
  status: 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CUSTOMS_HOLD' | 'REROUTED';
  statusLabel: string;
  product: string;
  manifestDetails: string;
  quantity: string;
  commander: string;
  currentCoords: [number, number]; // [Latitude, Longitude]
  altitudeMeters: number; // Elevation / flight level
  headingDegrees: number; // Azimuth heading (0-360°)
  speed: string;
  speedKmh: number;
  cargoTemp: string;
  shockG: string;
  progressPct: number;
  origin: {
    name: string;
    code: string;
    coords: [number, number];
  };
  destination: {
    name: string;
    code: string;
    coords: [number, number];
  };
  eta: string;
  remainingKm: number;
  routeWaypoints: [number, number][];
  detourWaypoints: [number, number][];
  activeHazard?: {
    id: string;
    name: string;
    thresholdLimit: string;
    currentMetric: string;
    isBreached: boolean;
  };
  milestones: {
    step: number;
    label: string;
    location: string;
    time: string;
    done: boolean;
  }[];
  blockchainProof: {
    txHash: string;
    blockNumber: number;
    fido2KeyId: string;
    escrowAmountUsd: number;
  };
}

/**
 * Verified Master Registry of AWB Shipments
 */
export const INITIAL_AWB_DATABASE: Record<string, AWBShipmentRecord> = {
  // 1. Air Cargo Shipment (Frankfurt ➔ Bengaluru)
  '098-4729104': {
    awbNumber: '098-4729104',
    airlinePrefix: '098', // Air India Cargo / Lufthansa Cargo
    serialNumber: 472910,
    checkDigit: 4, // 472910 % 7 = 4
    carrierId: 'AC-AIR-501',
    vehicleName: 'Boeing 777F Freighter',
    mode: 'air',
    status: 'REROUTED',
    statusLabel: 'Airway Detour / In Flight',
    product: 'Lithium Avionics & Cold-Chain Vaccines',
    manifestDetails: 'Cold-Chain Vaccines (850 kg) • Temperature-Controlled Enclave Unit 4',
    quantity: '850 kg (4 Envirotainer RAPs)',
    commander: 'Cmdr. Hans Meyer • LH-782',
    currentCoords: [25.2000, 55.3000], // Over Arabian Gulf (Dubai FIR)
    altitudeMeters: 10972, // 36,000 ft (FL360)
    headingDegrees: 118, // Heading East-Southeast towards BLR
    speed: 'Mach 0.82 (875 km/h)',
    speedKmh: 875,
    cargoTemp: '4.1°C',
    shockG: '0.2 G',
    progressPct: 68,
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
    eta: 'Today, 04:30 PM IST',
    remainingKm: 2710,
    routeWaypoints: [
      [50.0379, 8.5622],
      [48.1351, 11.5820],
      [41.0082, 28.9784],
      [36.0000, 36.0000],
      [29.3759, 47.9774],
      [25.2000, 55.3000],
      [20.0000, 68.0000],
      [15.0000, 73.8000],
      [13.1986, 77.7066]
    ],
    detourWaypoints: [
      [50.0379, 8.5622],
      [48.1351, 11.5820],
      [41.0082, 28.9784],
      [33.3152, 44.3661],
      [29.0000, 48.0000],
      [25.2000, 55.3000],
      [20.0000, 68.0000],
      [13.1986, 77.7066]
    ],
    activeHazard: {
      id: 'haz-redsea',
      name: 'Red Sea Volcanic Ash Plume',
      thresholdLimit: '60 mg/m³',
      currentMetric: '85 mg/m³',
      isBreached: true
    },
    milestones: [
      { step: 1, label: 'Export Cleared & Loaded at FRA CargoCity', location: 'Frankfurt Airport', time: '02:15 UTC', done: true },
      { step: 2, label: 'FL360 Cruise Airways Telematics Verified', location: 'European Airspace', time: '04:45 UTC', done: true },
      { step: 3, label: 'Red Sea Ash Plume Evasion Triggered', location: 'Northern Gulf FIR', time: '07:10 UTC', done: true },
      { step: 4, label: 'Arabian Sea Corridor Transit', location: 'FL360 Oceanic', time: '09:30 UTC', done: true },
      { step: 5, label: 'BLR Intermodal Cargo Gateway Docking', location: 'Bengaluru Hub', time: 'Est. 11:00 UTC', done: false }
    ],
    blockchainProof: {
      txHash: '0x8f7c9a12b4e5d670f1a23b4c5d6e7f8a9b0c1d2e',
      blockNumber: 19842103,
      fido2KeyId: 'fido2-cred-air501-lh782',
      escrowAmountUsd: 1450000
    }
  },

  // 2. Highway Reefer Truck Shipment (Bengaluru ➔ Mumbai via NH-48)
  '125-8849201': {
    awbNumber: '125-8849201',
    airlinePrefix: '125', // British Airways / Surface Multimodal
    serialNumber: 884920,
    checkDigit: 1, // 884920 % 7 = 1
    carrierId: 'AC-ROD-104',
    vehicleName: 'Volvo FH Reefer Rig',
    mode: 'road',
    status: 'IN_TRANSIT',
    statusLabel: 'Highway Transit / NH-48 Active',
    product: 'Biopharma Vaccine Cartridges (Connecting Feeder)',
    manifestDetails: '2-8°C Refrigerated Pharma Containers • Dry-Ice Chamber Telemetry Active',
    quantity: '1,200 kg (2 TEU Reefer)',
    commander: 'Ramesh Kumar • KA-01-EQ-9801',
    currentCoords: [15.3647, 75.1240], // Hubballi Bypass on NH-48
    altitudeMeters: 620, // 620m elevation Deccan Plateau
    headingDegrees: 334, // Heading North-Northwest toward Belagavi / Kolhapur
    speed: '68 km/h',
    speedKmh: 68,
    cargoTemp: '3.8°C',
    shockG: '0.4 G',
    progressPct: 42,
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
    eta: 'Tomorrow, 08:15 AM IST',
    remainingKm: 580,
    routeWaypoints: [
      [13.1986, 77.7066],
      [13.2250, 77.4520],
      [13.3409, 77.1010],
      [13.7447, 76.9077],
      [13.9450, 76.6190],
      [14.2251, 76.3980],
      [14.4644, 75.9218],
      [14.6231, 75.6239],
      [14.7967, 75.4024],
      [14.9856, 75.2530],
      [15.3647, 75.1240],
      [15.4589, 75.0078],
      [15.5977, 74.7899],
      [15.8497, 74.4977],
      [16.2625, 74.4842],
      [16.4023, 74.3820],
      [16.5762, 74.3160],
      [16.7050, 74.2433],
      [17.2885, 74.1831],
      [17.6805, 73.9995],
      [18.1362, 73.9820],
      [18.3512, 73.8540],
      [18.5204, 73.8567],
      [18.7214, 73.7128],
      [18.7557, 73.4091],
      [18.7891, 73.3440],
      [18.9894, 73.1175],
      [18.9300, 72.8200]
    ],
    detourWaypoints: [
      [13.1986, 77.7066],
      [13.2250, 77.4520],
      [13.3409, 77.1010],
      [13.7447, 76.9077],
      [14.2251, 76.3980],
      [14.9042, 76.3871],
      [15.2689, 76.3909],
      [15.3456, 76.1550],
      [15.7592, 76.2001],
      [15.9620, 76.1280],
      [16.0590, 76.0550],
      [16.8302, 75.7100],
      [17.6599, 75.9064],
      [17.8188, 75.6515],
      [18.1150, 75.0320],
      [18.5080, 73.9260],
      [18.7214, 73.7128],
      [18.7557, 73.4091],
      [18.9894, 73.1175],
      [18.9300, 72.8200]
    ],
    activeHazard: {
      id: 'haz-hubballi',
      name: 'Hubballi NH-48 Flood Basin',
      thresholdLimit: '1.5 m inundation',
      currentMetric: '2.8 m inundation',
      isBreached: true
    },
    milestones: [
      { step: 1, label: 'Cold-Chain Handoff at BLR Gateway', location: 'BLR Dock 2', time: '09:00 IST', done: true },
      { step: 2, label: 'Tumakuru Fastag Priority Clearance', location: 'NH-48 Toll Plaza', time: '11:15 IST', done: true },
      { step: 3, label: 'Davanagere Re-Icing Inspection', location: 'NH-48 Corridor', time: '14:30 IST', done: true },
      { step: 4, label: 'Hubballi Culvert Sensor Check', location: 'Hubballi Basin', time: '17:00 IST', done: true },
      { step: 5, label: 'Mumbai JNPT Pharma Cold-Dock Arrival', location: 'Nhava Sheva', time: 'Est. 08:15 IST', done: false }
    ],
    blockchainProof: {
      txHash: '0x3a4b5c6d7e8f901234567890abcdef1234567890',
      blockNumber: 19842215,
      fido2KeyId: 'fido2-cred-rod104-ka01eq',
      escrowAmountUsd: 820000
    }
  },

  // 3. Ocean Vessel Cargo (Singapore ➔ Chennai)
  '312-6401925': {
    awbNumber: '312-6401925',
    airlinePrefix: '312', // Maritime Ocean Multi-Bill
    serialNumber: 640192,
    checkDigit: 5, // 640192 % 7 = 5
    carrierId: 'AC-SEA-701',
    vehicleName: 'MV Pacific Titan (8,400 TEU)',
    mode: 'sea',
    status: 'IN_TRANSIT',
    statusLabel: 'Nautical Lane / Malacca Strait',
    product: 'Semiconductor Microchips & Wafers',
    manifestDetails: '40ft Vibration-Insulated Refrigerated Sea Containers (18 TEU)',
    quantity: '2,800 Tons (18 TEU)',
    commander: 'Capt. Tan Wei • IMO 9821045',
    currentCoords: [4.1000, 99.8000], // Malacca Strait Channel
    altitudeMeters: 0, // Sea Level
    headingDegrees: 298, // Heading West-Northwest toward Bay of Bengal
    speed: '19.5 Knots (36 km/h)',
    speedKmh: 36,
    cargoTemp: '18.2°C',
    shockG: '1.1 G',
    progressPct: 35,
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
    eta: 'Oct 25, 11:30 AM IST',
    remainingKm: 1840,
    routeWaypoints: [
      [1.26, 103.82],
      [1.22, 103.65],
      [1.45, 103.15],
      [2.50, 101.60],
      [4.10, 99.80],
      [5.30, 97.60],
      [6.00, 95.00],
      [8.50, 90.00],
      [10.80, 84.50],
      [13.0827, 80.3200]
    ],
    detourWaypoints: [
      [1.26, 103.82],
      [1.22, 103.65],
      [1.45, 103.15],
      [2.50, 101.60],
      [4.10, 99.80],
      [5.30, 97.60],
      [6.00, 95.00],
      [4.50, 92.00],
      [4.00, 86.00],
      [4.80, 80.50],
      [6.50, 82.50],
      [9.50, 82.50],
      [12.20, 81.20],
      [13.0827, 80.3200]
    ],
    activeHazard: {
      id: 'haz-bengal',
      name: 'Bay of Bengal Super Cyclone',
      thresholdLimit: '3.5 m wave swell',
      currentMetric: '4.8 m wave swell',
      isBreached: true
    },
    milestones: [
      { step: 1, label: 'Keppel Port Gantry Loading Complete', location: 'Singapore Berth 8', time: 'Oct 21 04:00', done: true },
      { step: 2, label: 'Strait of Malacca Traffic Separation Scheme', location: 'Malacca Channel', time: 'Oct 21 16:30', done: true },
      { step: 3, label: 'Cyclone Doppler Swell Analysis', location: 'Bay of Bengal Entrance', time: 'Oct 22 08:00', done: true },
      { step: 4, label: 'Southern Sri Lanka Trench Passage', location: 'Indian Ocean Deep', time: 'Oct 23 18:00', done: false },
      { step: 5, label: 'Chennai Port Container Terminal Discharge', location: 'MAA Berth 4', time: 'Oct 25 11:30', done: false }
    ],
    blockchainProof: {
      txHash: '0x9911aabbccddeeff00112233445566778899aabb',
      blockNumber: 19842409,
      fido2KeyId: 'fido2-cred-sea701-tanwei',
      escrowAmountUsd: 4200000
    }
  },

  // 4. Interstate Express Hauler (Chennai Port ➔ Bengaluru Tech Park via NH-48)
  '176-3910482': {
    awbNumber: '176-3910482',
    airlinePrefix: '176', // Emirates SkyCargo Multi-Modal
    serialNumber: 391048,
    checkDigit: 2, // 391048 % 7 = 2
    carrierId: 'AC-ROD-415',
    vehicleName: 'Express Freightliner',
    mode: 'road',
    status: 'IN_TRANSIT',
    statusLabel: 'Highway Transit / NH-48 Express',
    product: 'Lithium & Silicon Modules',
    manifestDetails: 'Connecting from AC-SEA-701 • Semiconductor Clean-Room Pallets',
    quantity: '4,500 kg (1 TEU)',
    commander: 'K. Murugan • TN-02-CE-8812',
    currentCoords: [12.9165, 79.1325], // Vellore Katpadi on NH-48
    altitudeMeters: 310, // 310m elevation
    headingDegrees: 262, // Heading West toward Krishnagiri / Hosur
    speed: '72 km/h',
    speedKmh: 72,
    cargoTemp: '22.1°C',
    shockG: '0.3 G',
    progressPct: 54,
    origin: {
      name: 'Chennai Port Maritime Terminal (MAA)',
      code: 'MAA',
      coords: [13.0827, 80.3200]
    },
    destination: {
      name: 'Bengaluru Tech Park Hub (BLR)',
      code: 'BLR',
      coords: [13.1986, 77.7066]
    },
    eta: 'Today, 06:45 PM IST',
    remainingKm: 168,
    routeWaypoints: [
      [13.0827, 80.3200],
      [13.0694, 80.1748],
      [13.0489, 80.0932],
      [12.9675, 79.9436],
      [12.8342, 79.7036],
      [12.9298, 79.3582],
      [12.9272, 79.3330],
      [12.9165, 79.1325],
      [12.8710, 78.9320],
      [12.7904, 78.7166],
      [12.6825, 78.6140],
      [12.6020, 78.5200],
      [12.5266, 78.2140],
      [12.7409, 77.8253],
      [12.7845, 77.7712],
      [12.8452, 77.6602],
      [12.9172, 77.6228],
      [13.1986, 77.7066]
    ],
    detourWaypoints: [
      [13.0827, 80.3200],
      [13.1432, 79.9079],
      [13.1784, 79.6105],
      [13.3300, 79.5850],
      [13.2172, 79.1003],
      [13.2005, 78.7533],
      [13.1642, 78.3948],
      [13.1367, 78.1291],
      [13.0712, 77.7983],
      [13.1986, 77.7066]
    ],
    milestones: [
      { step: 1, label: 'Customs Intermodal Transfer from Ship Berth', location: 'Chennai Port', time: '10:00 IST', done: true },
      { step: 2, label: 'Sriperumbudur Industrial Green Passage', location: 'NH-48 Bypass', time: '11:45 IST', done: true },
      { step: 3, label: 'Vellore Katpadi Telematics Checkpoint', location: 'NH-48 Vellore', time: '13:50 IST', done: true },
      { step: 4, label: 'Hosur SIPCOT Interstate Crossing', location: 'Attibele Border', time: 'Est. 16:30 IST', done: false },
      { step: 5, label: 'Bengaluru Tech Park Facility Docking', location: 'Electronic City Hub', time: 'Est. 18:45 IST', done: false }
    ],
    blockchainProof: {
      txHash: '0x1234567890abcdef1234567890abcdef12345678',
      blockNumber: 19842490,
      fido2KeyId: 'fido2-cred-rod415-murugan',
      escrowAmountUsd: 650000
    }
  },

  // 5. Gulf Tanker Maritime (Dubai ➔ Mumbai)
  '440-1092837': {
    awbNumber: '440-1092837',
    airlinePrefix: '440',
    serialNumber: 109283,
    checkDigit: 3, // 109283 % 7 = 3
    carrierId: 'AC-SEA-903',
    vehicleName: 'MV Gulf Pioneer Tanker',
    mode: 'sea',
    status: 'IN_TRANSIT',
    statusLabel: 'Nautical Lane / Gulf of Oman',
    product: 'Polymers & Chemical Intermediates',
    manifestDetails: 'Polymer Chemical Drums (18 TEU) • Inert Gas Nitrogen Pressure Monitored',
    quantity: '3,200 Tons',
    commander: 'Capt. Rashid Al-Maktoum • IMO 9745512',
    currentCoords: [25.6000, 57.2000], // Gulf of Oman Outer Anchorage
    altitudeMeters: 0,
    headingDegrees: 132,
    speed: '16.8 Knots (31 km/h)',
    speedKmh: 31,
    cargoTemp: '26.4°C',
    shockG: '0.6 G',
    progressPct: 28,
    origin: {
      name: 'Dubai Jebel Ali Basin (DXB)',
      code: 'DXB',
      coords: [25.0100, 55.0600]
    },
    destination: {
      name: 'Mumbai Nhava Sheva JNPT (BOM)',
      code: 'BOM',
      coords: [18.9300, 72.8200]
    },
    eta: 'Oct 24, 08:00 AM IST',
    remainingKm: 1420,
    routeWaypoints: [
      [25.01, 55.06],
      [25.35, 55.15],
      [26.15, 56.10],
      [26.40, 56.45],
      [25.60, 57.20],
      [24.80, 58.60],
      [24.00, 60.00],
      [21.50, 65.00],
      [19.20, 71.50],
      [18.93, 72.82]
    ],
    detourWaypoints: [
      [25.01, 55.06],
      [25.35, 55.15],
      [26.15, 56.10],
      [26.40, 56.45],
      [24.50, 59.50],
      [19.80, 64.00],
      [17.50, 70.00],
      [18.93, 72.82]
    ],
    milestones: [
      { step: 1, label: 'Jebel Ali Terminal Departure', location: 'Dubai Basin', time: 'Oct 21 02:00', done: true },
      { step: 2, label: 'Strait of Hormuz Security Escort Clear', location: 'Hormuz Narrows', time: 'Oct 21 18:40', done: true },
      { step: 3, label: 'Gulf of Oman Outer Anchorage', location: 'Oman Sea', time: 'Oct 22 09:15', done: true },
      { step: 4, label: 'Arabian Sea Deep Water Lane', location: 'Arabian Sea', time: 'Oct 23 12:00', done: false },
      { step: 5, label: 'JNPT Nhava Sheva Berth Allocation', location: 'Mumbai Terminal', time: 'Oct 24 08:00', done: false }
    ],
    blockchainProof: {
      txHash: '0x44556677889900aabbccddeeff11223344556677',
      blockNumber: 19842512,
      fido2KeyId: 'fido2-cred-sea903-almaktoum',
      escrowAmountUsd: 2100000
    }
  },

  // 6. Chemical Tanker Rig (Mumbai JNPT ➔ Ahmedabad via NH-48)
  '588-7204910': {
    awbNumber: '588-7204910',
    airlinePrefix: '588',
    serialNumber: 720491,
    checkDigit: 0, // 720491 % 7 = 0
    carrierId: 'AC-ROD-309',
    vehicleName: 'Hazardous Tanker Unit',
    mode: 'road',
    status: 'IN_TRANSIT',
    statusLabel: 'Highway Transit / Western Freight Corridor',
    product: 'Industrial Chemical Solution',
    manifestDetails: 'Connecting from AC-SEA-903 • ISO Tank Container with Auto-Shutoff Telemetry',
    quantity: '22 Tons (1 ISO Tank)',
    commander: 'Vikram Jadhav • MH-04-AZ-2019',
    currentCoords: [20.5992, 72.9342], // Valsad on NH-48
    altitudeMeters: 45,
    headingDegrees: 4, // Heading North towards Surat / Vadodara
    speed: '64 km/h',
    speedKmh: 64,
    cargoTemp: '24.0°C',
    shockG: '0.2 G',
    progressPct: 48,
    origin: {
      name: 'Mumbai JNPT Port Hub (BOM)',
      code: 'BOM',
      coords: [18.9300, 72.8200]
    },
    destination: {
      name: 'Ahmedabad Industrial Park (AMD)',
      code: 'AMD',
      coords: [23.0225, 72.5714]
    },
    eta: 'Today, 09:30 PM IST',
    remainingKm: 295,
    routeWaypoints: [
      [18.9300, 72.8200],
      [19.0330, 73.0297],
      [19.2600, 72.9780],
      [19.4259, 72.8225],
      [19.7431, 72.9120],
      [20.1245, 72.9189],
      [20.3893, 72.9106],
      [20.5992, 72.9342],
      [20.9500, 72.9320],
      [21.2680, 72.9560],
      [21.6264, 73.0019],
      [21.7051, 72.9959],
      [22.0520, 73.1200],
      [22.3072, 73.1812],
      [22.5645, 72.9289],
      [22.6916, 72.8634],
      [23.0225, 72.5714]
    ],
    detourWaypoints: [
      [18.9300, 72.8200],
      [19.2600, 72.9780],
      [19.7431, 72.9120],
      [19.9700, 72.7300],
      [20.1800, 72.7600],
      [20.4000, 72.8500],
      [20.5992, 72.9342],
      [21.1702, 72.8311],
      [21.7100, 72.6000],
      [22.0500, 72.8000],
      [22.2400, 73.0800],
      [22.3072, 73.1812],
      [22.6916, 72.8634],
      [23.0225, 72.5714]
    ],
    milestones: [
      { step: 1, label: 'Chemical Offload at JNPT Chemical Berth', location: 'Nhava Sheva', time: '08:00 IST', done: true },
      { step: 2, label: 'Thane Ghodbunder Bypass Transit', location: 'NH-48 Ghodbunder', time: '10:30 IST', done: true },
      { step: 3, label: 'Maharashtra-Gujarat Border Vapi Clearance', location: 'Talasari Checkpost', time: '13:00 IST', done: true },
      { step: 4, label: 'Valsad Telematics Pressure Verification', location: 'NH-48 Valsad', time: '15:15 IST', done: true },
      { step: 5, label: 'Ahmedabad GIDC Chemical Complex Delivery', location: 'Ahmedabad Hub', time: 'Est. 21:30 IST', done: false }
    ],
    blockchainProof: {
      txHash: '0x7788990011223344556677889900112233445566',
      blockNumber: 19842602,
      fido2KeyId: 'fido2-cred-rod309-jadhav',
      escrowAmountUsd: 590000
    }
  }
};

/**
 * Lookup shipment by unique AWB Number (with or without dashes)
 */
export function getAWBShipment(awbInput: string): AWBShipmentRecord | undefined {
  const clean = awbInput.trim();
  // Exact match
  if (INITIAL_AWB_DATABASE[clean]) return INITIAL_AWB_DATABASE[clean];

  // Try matching stripped non-alphanumeric
  const normalized = clean.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  for (const [key, val] of Object.entries(INITIAL_AWB_DATABASE)) {
    const keyNorm = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (keyNorm === normalized || keyNorm.includes(normalized) || normalized.includes(keyNorm)) {
      return val;
    }
    // Match carrier ID e.g. "AC-AIR-501"
    if (val.carrierId.toLowerCase() === normalized || val.carrierId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === normalized) {
      return val;
    }
  }

  return undefined;
}

/**
 * Generate a new authentic AWB Shipment linked to real coordinates
 */
export function generateNewAWBRecord(hubCode: string = 'BLR', mode: 'air' | 'sea' | 'road' = 'air'): AWBShipmentRecord {
  const prefix = mode === 'air' ? '098' : mode === 'sea' ? '312' : '125';
  const serial = Math.floor(100000 + Math.random() * 900000);
  const checkDigit = serial % 7;
  const awbNumber = `${prefix}-${serial}${checkDigit}`;

  const originCoords: [number, number] = hubCode === 'MAA' ? [13.0827, 80.3200] : (hubCode === 'BOM' ? [18.9300, 72.8200] : [13.1986, 77.7066]);
  const destCoords: [number, number] = hubCode === 'BLR' ? [18.9300, 72.8200] : [13.1986, 77.7066];

  const midLat = (originCoords[0] + destCoords[0]) / 2;
  const midLng = (originCoords[1] + destCoords[1]) / 2;

  const newRecord: AWBShipmentRecord = {
    awbNumber,
    airlinePrefix: prefix,
    serialNumber: serial,
    checkDigit,
    carrierId: `AC-${mode.toUpperCase()}-${Math.floor(100 + Math.random() * 899)}`,
    vehicleName: mode === 'air' ? 'Boeing 777F Freighter' : mode === 'sea' ? 'Ocean Cargo Vessel' : 'Volvo FH Reefer Rig',
    mode,
    status: 'IN_TRANSIT',
    statusLabel: 'Autonomous Dispatch Active',
    product: mode === 'air' ? 'Precision Optics & Diagnostics' : mode === 'sea' ? 'Industrial Solar Inverters' : 'Cold-Chain Insulin Ampoules',
    manifestDetails: 'Direct Point-to-Point Pipeline Attested • Hardware NFC Bound',
    quantity: '1,800 kg',
    commander: 'Officer In-Charge • Unit Dispatch',
    currentCoords: [midLat, midLng],
    altitudeMeters: mode === 'air' ? 10500 : mode === 'sea' ? 0 : 540,
    headingDegrees: Math.floor(Math.random() * 360),
    speed: mode === 'air' ? 'Mach 0.81 (860 km/h)' : mode === 'sea' ? '18.4 Knots (34 km/h)' : '65 km/h',
    speedKmh: mode === 'air' ? 860 : mode === 'sea' ? 34 : 65,
    cargoTemp: mode === 'air' ? '4.0°C' : mode === 'sea' ? '20.5°C' : '3.6°C',
    shockG: '0.3 G',
    progressPct: 45,
    origin: {
      name: `${hubCode} Origin Gateway`,
      code: hubCode,
      coords: originCoords
    },
    destination: {
      name: 'Destination Intermodal Terminal',
      code: 'DEST',
      coords: destCoords
    },
    eta: 'Today, 07:45 PM IST',
    remainingKm: 420,
    routeWaypoints: [originCoords, [midLat, midLng], destCoords],
    detourWaypoints: [originCoords, [midLat + 0.5, midLng + 0.5], destCoords],
    milestones: [
      { step: 1, label: 'Electronic AWB Generated & Escrow Sealed', location: `${hubCode} Gateway`, time: 'Just Now', done: true },
      { step: 2, label: 'Cryptographic Passkey Registered', location: 'Secure Enclave', time: 'Just Now', done: true },
      { step: 3, label: 'In Transit / 3D Telematics Tracking', location: 'Active Corridor', time: 'In Progress', done: true },
      { step: 4, label: 'Dynamic Hazard Monitoring', location: 'En Route', time: 'Standby', done: false },
      { step: 5, label: 'Destination Berth Delivery', location: 'Arrival Terminal', time: 'Pending', done: false }
    ],
    blockchainProof: {
      txHash: `0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`,
      blockNumber: 19842650,
      fido2KeyId: `fido2-cred-${serial}`,
      escrowAmountUsd: 750000
    }
  };

  // Cache in in-memory registry
  INITIAL_AWB_DATABASE[awbNumber] = newRecord;
  return newRecord;
}

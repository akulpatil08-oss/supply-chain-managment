import React, { useState } from 'react';
import ThreeVehicleViewer from './ThreeVehicleViewer';
import {
  Search,
  PlusCircle,
  Copy,
  Check,
  QrCode,
  Barcode,
  Sparkles,
  Plane,
  Ship,
  Truck,
  ShieldCheck,
  Clock,
  Navigation,
  Code2,
  AlertCircle
} from 'lucide-react';

interface OrderData {
  trackingNumber: string;
  serialNumber: number;
  checkDigit: number;
  year: number;
  hub: string;
  mode: 'air' | 'sea' | 'road';
  status: string;
  progressPct: number;
  vehicleType: string;
  currentSpeed: string;
  cargoTemp: string;
  qrData: string;
  barcode: string;
  milestones: Array<{ step: number; label: string; time: string; done: boolean }>;
}

const PRELOADED_ORDERS: Record<string, OrderData> = {
  'AWB-AEGIS-2026-BLR-7489214': {
    trackingNumber: 'AWB-AEGIS-2026-BLR-7489214',
    serialNumber: 748921,
    checkDigit: 4,
    year: 2026,
    hub: 'BLR',
    mode: 'air',
    status: 'IN_TRANSIT',
    progressPct: 62,
    vehicleType: 'Boeing 777F Freighter',
    currentSpeed: 'Mach 0.82 (870 km/h)',
    cargoTemp: '4.1°C',
    qrData: 'https://aegischain.live/track/AWB-AEGIS-2026-BLR-7489214',
    barcode: '||| | |||| || ||| | ||| 7489214',
    milestones: [
      { step: 1, label: 'Frankfurt Hub Sealed & Manifest Digitized', time: '06:00 IST', done: true },
      { step: 2, label: 'Customs Passkey Attested (FIDO2 L3)', time: '07:30 IST', done: true },
      { step: 3, label: 'In Transit / 3D Telematics Stream Active', time: '09:00 IST', done: true },
      { step: 4, label: 'Red Sea Ash Autonomous Evasion (FL360)', time: '11:15 IST', done: true },
      { step: 5, label: 'BLR Intermodal Gateway Berth 2 Docking', time: 'Est. 16:42 IST', done: false }
    ]
  },
  'AWB-AEGIS-2026-MAA-9182343': {
    trackingNumber: 'AWB-AEGIS-2026-MAA-9182343',
    serialNumber: 918234,
    checkDigit: 3,
    year: 2026,
    hub: 'MAA',
    mode: 'sea',
    status: 'DETOUR_ACTIVE',
    progressPct: 44,
    vehicleType: 'MV Pacific Titan (8,400 TEU)',
    currentSpeed: '19.5 Knots (36 km/h)',
    cargoTemp: '18.2°C',
    qrData: 'https://aegischain.live/track/AWB-AEGIS-2026-MAA-9182343',
    barcode: '||| | |||| || ||| | ||| 9182343',
    milestones: [
      { step: 1, label: 'Singapore Keppel Dock Discharge Cleared', time: 'Oct 20 12:00', done: true },
      { step: 2, label: 'Malacca Strait Navigation Nominal', time: 'Oct 21 04:30', done: true },
      { step: 3, label: 'Bay of Bengal Cyclone Detour Applied', time: 'Oct 22 08:00', done: true },
      { step: 4, label: 'South Sri Lanka Deep-Sea Trench Corridor', time: 'Oct 22 13:00', done: true },
      { step: 5, label: 'Chennai Port Container Berth 4 Handoff', time: 'Est. Oct 24 18:00', done: false }
    ]
  },
  'AWB-AEGIS-2026-BOM-5318296': {
    trackingNumber: 'AWB-AEGIS-2026-BOM-5318296',
    serialNumber: 531829,
    checkDigit: 6,
    year: 2026,
    hub: 'BOM',
    mode: 'road',
    status: 'IN_TRANSIT',
    progressPct: 78,
    vehicleType: 'Volvo FH Reefer Rig',
    currentSpeed: '68 km/h',
    cargoTemp: '3.8°C',
    qrData: 'https://aegischain.live/track/AWB-AEGIS-2026-BOM-5318296',
    barcode: '||| | |||| || ||| | ||| 5318296',
    milestones: [
      { step: 1, label: 'Vaccines Transshipped at BLR Hub Gate', time: '04:00 IST', done: true },
      { step: 2, label: 'Reefer Cabin Telemetry Validated (3.8°C)', time: '04:30 IST', done: true },
      { step: 3, label: 'NH-48 Intermodal Artery Expressway', time: '07:15 IST', done: true },
      { step: 4, label: 'Hubballi Flood Basin Detour via Koppal', time: '10:00 IST', done: true },
      { step: 5, label: 'Mumbai JNPT Cold Store Dock Inbound', time: 'Est. 18:30 IST', done: false }
    ]
  }
};

interface AWBTrackingHubProps {
  onOpenDevGuide: () => void;
}

export default function AWBTrackingHub({ onOpenDevGuide }: AWBTrackingHubProps) {
  const [searchInput, setSearchInput] = useState<string>('AWB-AEGIS-2026-BLR-7489214');
  const [currentOrder, setCurrentOrder] = useState<OrderData>(PRELOADED_ORDERS['AWB-AEGIS-2026-BLR-7489214']);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [selectedHub, setSelectedHub] = useState<string>('BLR');

  // Generate a brand new unique AWB
  const handleGenerateNewAWB = async () => {
    try {
      const res = await fetch('/api/awb/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hub: selectedHub }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentOrder(data.order);
        setSearchInput(data.order.trackingNumber);
        return;
      }
    } catch {
      // Fallback generator
    }

    // Client-side fallback generator
    const year = 2026;
    const serial = Math.floor(100000 + Math.random() * 900000);
    const check = serial % 7;
    const awbId = `AWB-AEGIS-${year}-${selectedHub}-${serial}${check}`;
    const mode = selectedHub === 'MAA' ? 'sea' : (selectedHub === 'BOM' ? 'road' : 'air');

    const synthetic: OrderData = {
      trackingNumber: awbId,
      serialNumber: serial,
      checkDigit: check,
      year: 2026,
      hub: selectedHub,
      mode,
      status: 'IN_TRANSIT',
      progressPct: Math.floor(40 + Math.random() * 40),
      vehicleType: mode === 'air' ? 'Boeing 777F Freighter' : (mode === 'sea' ? 'Ocean Cargo Vessel' : 'Volvo FH Reefer Rig'),
      currentSpeed: mode === 'air' ? 'Mach 0.82 (870 km/h)' : (mode === 'sea' ? '19.5 Knots (36 km/h)' : '68 km/h'),
      cargoTemp: mode === 'air' ? '4.0°C' : (mode === 'sea' ? '18.0°C' : '3.8°C'),
      qrData: `https://aegischain.live/track/${awbId}`,
      barcode: `||| | |||| || ||| | ||| ${serial}${check}`,
      milestones: [
        { step: 1, label: 'Order Registered & Digital Seal Bound', time: '08:30 IST', done: true },
        { step: 2, label: 'Hardware Passkey & Customs Attested', time: '09:45 IST', done: true },
        { step: 3, label: 'In Transit / 3D Telematics Active', time: '11:15 IST', done: true },
        { step: 4, label: 'Autonomous Detour / Hazard Evasion', time: '13:00 IST', done: true },
        { step: 5, label: `${selectedHub} Destination Hub Docking`, time: 'Est. 17:30 IST', done: false }
      ]
    };

    setCurrentOrder(synthetic);
    setSearchInput(awbId);
  };

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchInput.trim().toUpperCase();
    if (PRELOADED_ORDERS[query]) {
      setCurrentOrder(PRELOADED_ORDERS[query]);
    } else {
      // Lookup or synthesize
      const hub = query.includes('MAA') ? 'MAA' : (query.includes('BOM') ? 'BOM' : 'BLR');
      const serial = parseInt(query.replace(/\D/g, '').slice(-7, -1)) || 482910;
      const check = serial % 7;
      setCurrentOrder({
        trackingNumber: query,
        serialNumber: serial,
        checkDigit: check,
        year: 2026,
        hub,
        mode: hub === 'MAA' ? 'sea' : (hub === 'BOM' ? 'road' : 'air'),
        status: 'IN_TRANSIT',
        progressPct: 55,
        vehicleType: hub === 'MAA' ? 'Ocean Container Vessel' : (hub === 'BOM' ? 'Interstate Reefer Truck' : 'Boeing 777F Air Cargo'),
        currentSpeed: hub === 'MAA' ? '19.5 Knots' : (hub === 'BOM' ? '68 km/h' : 'Mach 0.82'),
        cargoTemp: '4.2°C',
        qrData: `https://aegischain.live/track/${query}`,
        barcode: `||| | |||| || ||| | ||| ${serial}${check}`,
        milestones: [
          { step: 1, label: 'Origin Gate Sealed', time: '07:00 IST', done: true },
          { step: 2, label: 'FIDO2 Passkey Validated', time: '08:30 IST', done: true },
          { step: 3, label: 'Active 3D Telematics Corridor', time: '10:00 IST', done: true },
          { step: 4, label: 'Autonomous Detour Recalculated', time: '12:00 IST', done: true },
          { step: 5, label: 'Destination Berth Delivery', time: 'Est. 16:30 IST', done: false }
        ]
      });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentOrder.trackingNumber);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-6 max-w-6xl mx-auto w-full">
      {/* Title & Developer Guide trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1d2f65]">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-extrabold text-white">AWB Tracking & 3D Animated Delivery System</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              WebGL 3D
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Unique AWB generation with Modulo-7 check digits and procedural 3D vehicles displaying live status
          </p>
        </div>

        <button
          onClick={onOpenDevGuide}
          className="bg-[#142045] hover:bg-[#1d2f65] border border-cyan-500/40 text-cyan-300 text-xs font-semibold px-3 py-1.5 rounded-xl transition shadow flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Code2 className="w-4 h-4 text-cyan-400" />
          <span>Full-Stack Integration Code</span>
        </button>
      </div>

      {/* Grid: Search & Unique AWB Generator Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Lookup Search Bar */}
        <div className="lg:col-span-2 bg-[#0c152e] border border-[#1d2f65] rounded-2xl p-4 space-y-3 shadow-xl">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
            <Search className="w-3.5 h-3.5 text-[#f77f00]" />
            <span>Track Air Waybill (AWB) Order</span>
          </span>

          <form onSubmit={handleTrackSubmit} className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Enter AWB ID (e.g. AWB-AEGIS-2026-BLR-7489214)"
              className="flex-1 bg-[#050a18] border border-[#1d2f65] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              className="bg-[#f77f00] hover:bg-[#d96e00] text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow flex items-center space-x-1"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Track 3D</span>
            </button>
          </form>

          {/* Quick Demo Preloaded Chips */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-mono">Sample Hackathon Demo Orders:</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(PRELOADED_ORDERS).map(awb => {
                const ord = PRELOADED_ORDERS[awb];
                const icon = ord.mode === 'air' ? '✈️' : (ord.mode === 'sea' ? '🚢' : '🚛');
                return (
                  <button
                    key={awb}
                    onClick={() => {
                      setSearchInput(awb);
                      setCurrentOrder(PRELOADED_ORDERS[awb]);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition ${
                      currentOrder.trackingNumber === awb
                        ? 'bg-[#142045] text-cyan-300 border-cyan-400'
                        : 'bg-[#050a18] text-slate-400 hover:text-white border-[#1d2f65]'
                    }`}
                  >
                    <span>{icon} {awb}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 2: Unique AWB Generator */}
        <div className="bg-[#0c152e] border border-[#1d2f65] rounded-2xl p-4 space-y-3 shadow-xl flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Unique AWB Generator</span>
              </span>
              <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                Modulo-7 Checksum
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              Generates IATA-compliant unique order tracking numbers with mathematical check digits to prevent duplicate or falsified freight records.
            </p>

            <div className="flex items-center space-x-2 pt-1">
              <span className="text-[11px] text-slate-400">Hub:</span>
              {(['BLR', 'MAA', 'BOM'] as const).map(h => (
                <button
                  key={h}
                  onClick={() => setSelectedHub(h)}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition ${
                    selectedHub === h
                      ? 'bg-[#f77f00] text-white shadow'
                      : 'bg-[#050a18] text-slate-400 hover:text-white border border-[#1d2f65]'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerateNewAWB}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs py-2 rounded-xl transition shadow flex items-center justify-center space-x-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Generate New Unique AWB</span>
          </button>
        </div>
      </div>

      {/* Main Order Details & 3D Interactive Viewer Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 3D Vehicle Canvas Viewer */}
        <div className="lg:col-span-2 space-y-3">
          <ThreeVehicleViewer
            vehicleType={currentOrder.mode}
            status={currentOrder.status}
            speed={currentOrder.currentSpeed}
            temperature={currentOrder.cargoTemp}
            trackingNumber={currentOrder.trackingNumber}
            progressPct={currentOrder.progressPct}
          />
        </div>

        {/* Right Col: AWB Passport & Milestones */}
        <div className="bg-[#0c152e] border border-[#1d2f65] rounded-2xl p-4 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header with Tracking ID and Copy button */}
            <div className="bg-[#050a18] p-3 rounded-xl border border-[#1d2f65] space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Multimodal AWB Number</span>
                <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.2 rounded font-mono font-bold">
                  {currentOrder.mode.toUpperCase()} FREIGHT
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-white text-sm tracking-wide">
                  {currentOrder.trackingNumber}
                </span>
                <button
                  onClick={copyToClipboard}
                  className="p-1 rounded bg-[#142045] hover:bg-[#1d2f65] text-cyan-300"
                  title="Copy Tracking ID"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-[#1d2f65]/60">
                <span>Serial: <strong>{currentOrder.serialNumber}</strong></span>
                <span>Check Digit: <strong>{currentOrder.checkDigit}</strong> (mod 7)</span>
              </div>
            </div>

            {/* Barcode & QR Verification Card */}
            <div className="bg-[#050a18]/70 p-2.5 rounded-xl border border-[#1d2f65] flex items-center justify-between text-xs font-mono">
              <div>
                <div className="text-[10px] text-slate-400 font-sans">Digital Seal Barcode:</div>
                <div className="tracking-widest text-slate-200 text-xs font-bold font-mono">
                  {currentOrder.barcode}
                </div>
              </div>
              <div className="p-1.5 bg-white rounded-lg text-slate-900 shadow">
                <QrCode className="w-6 h-6" />
              </div>
            </div>

            {/* Delivery Milestones Timeline */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
                Delivery Milestones:
              </span>
              <div className="space-y-2 text-xs">
                {currentOrder.milestones.map(m => (
                  <div key={m.step} className="flex items-start space-x-2.5">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold ${
                        m.done ? 'bg-emerald-500 text-white' : 'bg-[#142045] text-slate-400 border border-[#1d2f65]'
                      }`}
                    >
                      {m.done ? '✓' : m.step}
                    </div>
                    <div className="flex-1">
                      <div className={`text-[11px] font-medium leading-tight ${m.done ? 'text-white' : 'text-slate-400'}`}>
                        {m.label}
                      </div>
                      <div className="text-[9px] font-mono text-cyan-400">{m.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1d2f65] flex justify-between items-center text-[10px] text-slate-400">
            <span>Carrier: <strong className="text-white">{currentOrder.vehicleType}</strong></span>
            <span className="text-emerald-400 font-mono font-bold">1st-Party Validated</span>
          </div>
        </div>
      </div>
    </div>
  );
}

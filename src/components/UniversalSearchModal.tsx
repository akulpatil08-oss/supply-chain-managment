import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  X,
  Layers,
  Fingerprint,
  Camera,
  Box,
  Code2,
  Zap,
  ShieldAlert,
  PhoneCall,
  Navigation,
  Globe,
  AlertTriangle,
  PlusCircle,
  ArrowRight,
  ExternalLink,
  Flame,
  Truck,
  Plane,
  Ship,
  Sparkles,
  CornerDownLeft
} from 'lucide-react';
import { Carrier, Hub, Hazard } from '../App.tsx';

export interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'map' | 'idcard' | 'cargo' | 'awb') => void;
  onSelectCarrier: (carrierId: string) => void;
  onSelectHub: (hubId: string) => void;
  onSelectHazard: (hazardId: string) => void;
  onOpenDevGuide: () => void;
  onOpenAddShipment: () => void;
  onOpenSimulator: () => void;
  onToggleThirdPartyBlock: () => void;
  onTriggerHazardLimitBreach: (hazardId: string) => void;
  onZoom: (target: 'global' | 'india') => void;
  onToggleHud: () => void;
  onToggleHazards: () => void;
  fleet: Carrier[];
  hubs: Hub[];
  hazards: Hazard[];
  isThirdPartyBlocked: boolean;
  supportPhone: string;
}

interface SearchItem {
  id: string;
  category: 'Navigation' | 'Shipments' | 'Gateways' | 'Hazards' | 'Actions & Tools';
  title: string;
  subtitle: string;
  tag?: string;
  tagColor?: string;
  icon: React.ReactNode;
  action: () => void;
}

export default function UniversalSearchModal({
  isOpen,
  onClose,
  onNavigateTab,
  onSelectCarrier,
  onSelectHub,
  onSelectHazard,
  onOpenDevGuide,
  onOpenAddShipment,
  onOpenSimulator,
  onToggleThirdPartyBlock,
  onTriggerHazardLimitBreach,
  onZoom,
  onToggleHud,
  onToggleHazards,
  fleet,
  hubs,
  hazards,
  isThirdPartyBlocked,
  supportPhone
}: UniversalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Build searchable catalogue
  const allItems: SearchItem[] = useMemo(() => {
    const list: SearchItem[] = [
      // 1. Navigation
      {
        id: 'nav-map',
        category: 'Navigation',
        title: 'Live Global Map & Detour Trajectory',
        subtitle: 'Interactive Leaflet world map with telematics & hazard routing',
        tag: 'Main View',
        tagColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        icon: <Layers className="w-4 h-4 text-orange-400" />,
        action: () => onNavigateTab('map')
      },
      {
        id: 'nav-awb',
        category: 'Navigation',
        title: '3D AWB Vehicle Tracking Hub',
        subtitle: 'Unique IATA Modulo-7 ID generation & interactive WebGL 3D animated vehicles',
        tag: '3D WebGL',
        tagColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        icon: <Box className="w-4 h-4 text-cyan-400" />,
        action: () => onNavigateTab('awb')
      },
      {
        id: 'nav-idcard',
        category: 'Navigation',
        title: 'Virtual Digital ID Card & Biometric Passkey',
        subtitle: 'Hardware Enclave FIDO2 cryptographic attestation and 3rd-party anti-tamper',
        tag: 'Security',
        tagColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        icon: <Fingerprint className="w-4 h-4 text-emerald-400" />,
        action: () => onNavigateTab('idcard')
      },
      {
        id: 'nav-cargo',
        category: 'Navigation',
        title: 'Cargo Camera AI & Customs Seal Scan',
        subtitle: 'Computer vision proof-of-delivery & tamper inspection for cold-chain containers',
        tag: 'AI Vision',
        tagColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        icon: <Camera className="w-4 h-4 text-purple-400" />,
        action: () => onNavigateTab('cargo')
      },
      {
        id: 'nav-devguide',
        category: 'Navigation',
        title: 'Developer Integration Guide',
        subtitle: 'Express backend code, Mod-7 AWB algorithm, Three.js 3D boilerplate',
        tag: 'Hackathon SDK',
        tagColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
        icon: <Code2 className="w-4 h-4 text-indigo-400" />,
        action: () => onOpenDevGuide()
      },

      // 2. Actions & Tools
      {
        id: 'act-breach-bengal',
        category: 'Actions & Tools',
        title: '⚡ Breach Cyclone Limit (Autonomous Nautical Evasion)',
        subtitle: 'Swell > 3.5m triggers instant autonomous detour around Sri Lanka trench',
        tag: 'Auto-Reroute',
        tagColor: 'bg-red-500/20 text-red-400 border-red-500/30',
        icon: <Zap className="w-4 h-4 text-amber-400" />,
        action: () => {
          onNavigateTab('map');
          onTriggerHazardLimitBreach('haz-bengal');
        }
      },
      {
        id: 'act-breach-redsea',
        category: 'Actions & Tools',
        title: '✈️ Breach Red Sea Volcanic Ash (FL360 Plume Evasion)',
        subtitle: 'Ash density > 60 mg/m³ reroutes Boeing 777F flight corridor to Persian Gulf',
        tag: 'Auto-Reroute',
        tagColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        icon: <Plane className="w-4 h-4 text-cyan-400" />,
        action: () => {
          onNavigateTab('map');
          onTriggerHazardLimitBreach('haz-redsea');
        }
      },
      {
        id: 'act-breach-hubballi',
        category: 'Actions & Tools',
        title: '🚛 Breach Hubballi Flood Basin (NH-50 Highway Detour)',
        subtitle: 'Inundation > 1.5m diverts Reefer Truck AC-ROD-104 via Koppal bypass',
        tag: 'Road Detour',
        tagColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        icon: <Truck className="w-4 h-4 text-amber-400" />,
        action: () => {
          onNavigateTab('map');
          onTriggerHazardLimitBreach('haz-hubballi');
        }
      },
      {
        id: 'act-toggle-tamper',
        category: 'Actions & Tools',
        title: isThirdPartyBlocked ? '🔓 Unlock 3rd-Party Tamper Shield' : '🛡️ Lock Escrow (Simulate 3rd-Party Interference)',
        subtitle: 'Demonstrates zero-trust cryptographic lock against unauthorized proxy brokers',
        tag: isThirdPartyBlocked ? 'LOCKED' : 'NOMINAL',
        tagColor: isThirdPartyBlocked ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300',
        icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
        action: () => onToggleThirdPartyBlock()
      },
      {
        id: 'act-new-shipment',
        category: 'Actions & Tools',
        title: 'Deploy New Shipment Carrier',
        subtitle: 'Add new flight, container vessel, or highway hauler to the connected graph',
        tag: 'Freight Dispatch',
        tagColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        icon: <PlusCircle className="w-4 h-4 text-emerald-400" />,
        action: () => onOpenAddShipment()
      },
      {
        id: 'act-simulator',
        category: 'Actions & Tools',
        title: 'What-If Disruption Scenario Simulator',
        subtitle: 'Test volcanic ash, super cyclones, flood inundations, and token replay attacks',
        tag: 'Simulation',
        tagColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        icon: <Zap className="w-4 h-4 text-orange-400" />,
        action: () => onOpenSimulator()
      },
      {
        id: 'act-zoom-global',
        category: 'Actions & Tools',
        title: 'Zoom to Global Shipping Overview',
        subtitle: 'Fly map view to see Europe-Asia-India international logistics web',
        tag: 'Map View',
        icon: <Globe className="w-4 h-4 text-cyan-400" />,
        action: () => {
          onNavigateTab('map');
          onZoom('global');
        }
      },
      {
        id: 'act-zoom-india',
        category: 'Actions & Tools',
        title: 'Zoom to India Intermodal Highway Corridors',
        subtitle: 'Focus camera on NH-48 Bengaluru-Chennai-Mumbai national logistics arteries',
        tag: 'Map View',
        icon: <Navigation className="w-4 h-4 text-emerald-400" />,
        action: () => {
          onNavigateTab('map');
          onZoom('india');
        }
      },
      {
        id: 'act-toggle-hud',
        category: 'Actions & Tools',
        title: 'Toggle Route Telematics HUD',
        subtitle: 'Show or minimize live velocity, dynamic coordinates, and real-time ETA card',
        tag: 'HUD Widget',
        icon: <Navigation className="w-4 h-4 text-[#f77f00]" />,
        action: () => {
          onNavigateTab('map');
          onToggleHud();
        }
      },
      {
        id: 'act-toggle-hazards',
        category: 'Actions & Tools',
        title: 'Toggle Weather & Environmental Hazard Zones',
        subtitle: 'Show/hide Doppler cyclone, volcanic ash plume, and highway flood radiuses',
        tag: 'Layer Filter',
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
        action: () => {
          onNavigateTab('map');
          onToggleHazards();
        }
      },
      {
        id: 'act-helpline',
        category: 'Actions & Tools',
        title: `Call 24/7 Central Dispatch Helpline (${supportPhone})`,
        subtitle: 'Instant phone dial for manual route clearances and smart contract escrow unlocks',
        tag: 'Support 24/7',
        tagColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        icon: <PhoneCall className="w-4 h-4 text-blue-400" />,
        action: () => {
          window.location.href = `tel:${supportPhone}`;
        }
      }
    ];

    // Add Shipments
    fleet.forEach(c => {
      const modeIcon = c.mode === 'air' ? <Plane className="w-4 h-4 text-cyan-400" /> : c.mode === 'sea' ? <Ship className="w-4 h-4 text-blue-400" /> : <Truck className="w-4 h-4 text-amber-400" />;
      list.push({
        id: `carrier-${c.id}`,
        category: 'Shipments',
        title: `${c.id} • ${c.name}`,
        subtitle: `${c.origin} ➔ ${c.dest} • ${c.product} (${c.tele.speed}, ${c.tele.temp})`,
        tag: `${c.mode.toUpperCase()} • Risk ${c.risk}/100`,
        tagColor: c.status === 'disrupted' ? 'bg-red-500/20 text-red-400 border-red-500/30' : c.status === 'at_risk' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        icon: modeIcon,
        action: () => {
          onNavigateTab('map');
          onSelectCarrier(c.id);
        }
      });
    });

    // Add Gateways / Hubs
    hubs.forEach(h => {
      list.push({
        id: `hub-${h.id}`,
        category: 'Gateways',
        title: `${h.id} Gateway • ${h.name}`,
        subtitle: `${h.type} • Capacity: ${h.berths} • Avg Dwell: ${h.dwell}`,
        tag: h.status,
        tagColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        icon: <Globe className="w-4 h-4 text-cyan-400" />,
        action: () => {
          onNavigateTab('map');
          onSelectHub(h.id);
        }
      });
    });

    // Add Hazards
    hazards.forEach(hz => {
      list.push({
        id: `hazard-${hz.id}`,
        category: 'Hazards',
        title: `${hz.name} (Limit: ${hz.thresholdLimit})`,
        subtitle: `Current: ${hz.currentMetric} • Affects ${hz.affectedCarrierId} • ${hz.detail}`,
        tag: hz.isBreached ? 'LIMIT BREACHED' : 'MONITORING',
        tagColor: hz.isBreached ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        icon: <Flame className="w-4 h-4 text-red-400" />,
        action: () => {
          onNavigateTab('map');
          onSelectHazard(hz.id);
        }
      });
    });

    return list;
  }, [fleet, hubs, hazards, isThirdPartyBlocked, supportPhone, onNavigateTab, onSelectCarrier, onSelectHub, onSelectHazard, onOpenDevGuide, onOpenAddShipment, onOpenSimulator, onToggleThirdPartyBlock, onTriggerHazardLimitBreach, onZoom, onToggleHud, onToggleHazards]);

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = allItems;
    if (activeCategory !== 'All') {
      result = result.filter(item => item.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.tag && item.tag.toLowerCase().includes(q))
      );
    }
    return result;
  }, [allItems, activeCategory, query]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1 < filteredItems.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : Math.max(0, filteredItems.length - 1)));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  const categories = ['All', 'Navigation', 'Shipments', 'Gateways', 'Hazards', 'Actions & Tools'];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 md:p-12 animate-fadeIn">
      <div
        className="w-full max-w-2xl bg-[#0c152e] border-2 border-cyan-500/70 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh] transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[#1d2f65] flex items-center space-x-3 bg-[#050a18]/90">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
            <Search className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search any carrier, 3D tracking, highway route, gateway hub, hazard limit, or action..."
            className="flex-1 bg-transparent text-white placeholder-slate-400 text-sm sm:text-base outline-none font-medium"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-[#142045] border border-[#1d2f65] rounded-lg">
              <span>ESC</span>
            </kbd>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-[#142045] transition flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="px-4 py-2.5 bg-[#081024] border-b border-[#1d2f65]/60 flex items-center space-x-1.5 overflow-x-auto scrollbar-none text-xs">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setSelectedIndex(0);
              }}
              className={`px-3 py-1 rounded-xl font-medium transition whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-cyan-500 text-black font-bold shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-[#142045]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm">No options matching <strong className="text-white font-mono">"{query}"</strong></p>
              <p className="text-xs text-slate-400">Try searching for "3D", "AWB", "Boeing", "NH-48", "Cyclone", "Escrow", or "Helpline".</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition border ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-950/60 to-[#142045] border-cyan-500/80 shadow-md'
                      : 'border-transparent hover:bg-[#142045]/60'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-[#050a18] text-slate-300 border border-[#1d2f65]'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                          {item.title}
                        </span>
                        {item.tag && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold border flex-shrink-0 ${
                            item.tagColor || 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {item.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 hidden sm:inline">
                      {item.category}
                    </span>
                    <div className={`p-1 rounded-lg ${isSelected ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-600'}`}>
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-4 py-2.5 bg-[#050a18] border-t border-[#1d2f65] flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-[#0c152e] border border-[#1d2f65] rounded text-slate-300">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-[#0c152e] border border-[#1d2f65] rounded text-slate-300">↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-[#0c152e] border border-[#1d2f65] rounded text-slate-300">↵</kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-[#0c152e] border border-[#1d2f65] rounded text-slate-300">ESC</kbd>
              <span>Dismiss</span>
            </span>
          </div>
          <span className="text-cyan-400 font-semibold hidden sm:inline">
            AegisChain Universal Spotlight
          </span>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  X,
  Minus,
  Sparkles,
  Code2,
  Box,
  Zap,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
  Maximize2,
  Minimize2,
  ExternalLink,
  ShieldCheck,
  Compass,
  ArrowRight
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  timestamp: string;
  actions?: {
    label: string;
    action: () => void;
  }[];
}

interface AIAssistantWidgetProps {
  onOpenDevGuide: () => void;
  onOpenAWBHub: () => void;
}

const QUICK_PROMPTS = [
  { label: '📦 How are unique AWB IDs generated?', prompt: 'Explain how unique AWB IDs and Modulo-7 check digits are generated for shipments.' },
  { label: '🎮 Why 3D vehicle tracking instead of 2D?', prompt: 'Explain the technical and user benefits of 3D animated vehicle models over traditional 2D map dots.' },
  { label: '⚡ How does autonomous hazard rerouting work?', prompt: 'How does AegisChain detect physical hazard limits and reroute carriers with zero human latency?' },
  { label: '💻 Show full-stack backend integration code', prompt: 'Show me the Express backend API code for AWB tracking and Gemini assistant integration.' },
  { label: '🛡️ Explain 3rd-party proxy tamper protection', prompt: 'How does the hardware FIDO2 passkey protect against 3rd-party route tampering and escrow theft?' }
];

export default function AIAssistantWidget({ onOpenDevGuide, onOpenAWBHub }: AIAssistantWidgetProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `👋 **Welcome to Aegis AI Copilot!**\n\nI can explain our **autonomous hazard rerouting engine**, generate authentic **IATA Modulo-7 AWB tracking numbers**, demonstrate **3D vehicle telematics**, or provide copy-pasteable **backend integration code** for your hackathon site.\n\n*What would you like to explore?*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: [
        { label: '📦 3D AWB Tracker', action: () => onOpenAWBHub() },
        { label: '💻 Developer Guide', action: () => onOpenDevGuide() }
      ]
    }
  ]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReset = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        text: `Conversation cleared. Ask me anything about AegisChain's **multimodal logistics graph**, **3D WebGL models**, or **full-stack integration**!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          { label: '📦 3D AWB Tracker', action: () => onOpenAWBHub() },
          { label: '💻 Developer Guide', action: () => onOpenDevGuide() }
        ]
      }
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiReply = data.reply || "I've processed your request. Let me know if you need code snippets or telematics verification!";
        
        const aiMsg: ChatMessage = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          text: aiReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions: [
            { label: '📦 3D AWB Tracker', action: () => onOpenAWBHub() },
            { label: '💻 Developer Guide', action: () => onOpenDevGuide() }
          ]
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error('API response failed');
      }
    } catch {
      // Smart local fallback responses for offline or hackathon sandbox demos
      setTimeout(() => {
        let fallbackText = '';
        const q = query.toLowerCase();

        if (q.includes('awb') || q.includes('unique id') || q.includes('check digit') || q.includes('generate')) {
          fallbackText = `### 📦 Authentic IATA Modulo-7 AWB Engine\n\nEach order is assigned an authentic Air Waybill number with an embedded mathematical check digit:\n\n- **Formula**: \`checkDigit = serialNumber % 7\`\n- **Format**: \`098-4729104\` (Prefix \`098\`, serial \`472910\`, check digit \`4\` because 472910 % 7 = 4)\n- **Verification**: Prevents typo errors, duplicate freight bills, and fraudulent tampering.\n- **Data Linkage**: Every AWB links directly to live **GPS coordinates**, **altitude**, **compass heading**, and cold-chain temperature telemetry!`;
        } else if (q.includes('3d') || q.includes('vehicle') || q.includes('visual') || q.includes('2d')) {
          fallbackText = `### 🎮 3D WebGL Telematics vs Flat 2D Dots\n\nTraditional logistics apps show flat, lifeless 2D dots that tell customers nothing about physical vehicle state. AegisChain replaces them with **interactive Three.js 3D models**:\n\n- **✈️ Boeing 777F**: Real-time turbine spinning, aerodynamic roll banking, flight altitude (FL360).\n- **🚢 Ocean Cargo Vessel**: Dual-hull displacement with animated hydrodynamic ocean wake and colored container TEUs.\n- **🚛 Volvo FH Reefer Rig**: Dual-axle rotating rubber wheels, refrigeration unit telemetry, and road surface alignment.\n- **360° Inspection**: Customers can orbit, inspect CAD wireframes, and verify cold-chain safety.`;
        } else if (q.includes('code') || q.includes('backend') || q.includes('integration') || q.includes('express')) {
          fallbackText = `### 💻 Full-Stack Integration Architecture\n\nAegisChain is built as a complete full-stack web app:\n\n1. **Express Backend (\`server.ts\`)**: Exposes \`/api/awb/generate\`, \`/api/awb/track/:id\`, and \`/api/assistant/chat\` (Gemini 3.8 Flash).\n2. **React + Three.js Frontend**: Renders \`ThreeVehicleViewer\` and \`Map3DVehicleOverlay\` with PBR lighting and ACES tone mapping.\n3. **Developer Guide**: Click the **Developer Guide** action below to view full copyable snippets!`;
        } else if (q.includes('hazard') || q.includes('reroute') || q.includes('autonomous')) {
          fallbackText = `### ⚡ Autonomous Hazard Self-Rerouting (Zero Human Latency)\n\nInstead of waiting hours for human dispatcher sign-offs, AegisChain continuously benchmarks physical safety thresholds:\n\n- **Bay of Bengal Cyclone**: Wave Swell limit = **3.5m** (Current: 4.8m ➔ Detour around Sri Lanka trench)\n- **Red Sea Volcanic Plume**: Ash density limit = **60 mg/m³** (Current: 85 mg/m³ ➔ Detour via Northern Gulf)\n- **Hubballi Flood Basin**: Culvert inundation = **1.5m** (Current: 2.8m ➔ Detour via NH-50 Koppal highway)`;
        } else {
          fallbackText = `### 🛡️ AegisChain Multimodal AI Platform\n\nAegisChain safeguards high-value supply chains through autonomous hazard evasion, 3D animated delivery status, and tamper-proof FIDO2 hardware passkeys. Ask me any specific technical question or explore the 3D tracker!`;
        }

        const fallbackMsg: ChatMessage = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions: [
            { label: '📦 Open 3D AWB Tracker', action: () => onOpenAWBHub() },
            { label: '💻 View Developer Guide', action: () => onOpenDevGuide() }
          ]
        };
        setMessages(prev => [...prev, fallbackMsg]);
      }, 350);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button (Bottom-Right) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 bg-gradient-to-r from-cyan-500 via-blue-600 to-[#f77f00] hover:opacity-95 text-white p-3.5 rounded-2xl shadow-[0_12px_36px_rgba(6,182,212,0.45)] flex items-center space-x-2.5 transition transform hover:scale-105 active:scale-95 border border-cyan-400/40 group"
          title="Open Aegis AI Copilot"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-300 animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-300"></span>
          </div>
          <span className="text-xs font-bold font-mono tracking-wide hidden sm:inline">Ask AI Copilot</span>
          <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded font-mono font-bold text-cyan-200">
            AI
          </span>
        </button>
      )}

      {/* Expanded Modern Chat Window */}
      {isOpen && (
        <div className={`fixed z-50 bg-[#0c152e]/95 backdrop-blur-xl border-2 border-cyan-500/70 rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-xs transition-all duration-300 ${
          isExpanded
            ? 'inset-3 sm:inset-10 md:inset-16 max-w-4xl mx-auto'
            : 'bottom-4 right-3 sm:right-5 w-[94vw] sm:w-[420px] h-[580px] max-h-[88vh]'
        }`}>
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-[#050a18] via-[#0e1b3d] to-[#050a18] p-3.5 border-b border-[#1d2f65] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-[0_0_12px_rgba(6,182,212,0.5)] flex-shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-white flex items-center space-x-2">
                  <span>Aegis AI Copilot</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>ONLINE</span>
                  </span>
                </div>
                <div className="text-[10px] text-cyan-400/80 font-mono">
                  Autonomous Logistics & Full-Stack Guide
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={handleReset}
                title="Clear Conversation"
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-[#142045] transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(prev => !prev)}
                title={isExpanded ? 'Restore Size' : 'Maximize Window'}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-[#142045] transition hidden sm:inline-block"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize Copilot"
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-[#142045] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#081024]/70">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center space-x-1.5 mb-1 text-[10px] text-slate-400 font-mono">
                  {msg.role === 'assistant' ? (
                    <>
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span className="text-cyan-400 font-bold">Aegis AI</span>
                    </>
                  ) : (
                    <span>You</span>
                  )}
                  <span>• {msg.timestamp}</span>
                </div>

                <div
                  className={`relative group max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed transition shadow ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-tr-none'
                      : 'bg-[#0f1d42] border border-[#1d2f65] text-slate-100 rounded-tl-none shadow-md'
                  }`}
                >
                  {/* Markdown formatting simulation */}
                  <div className="space-y-2 whitespace-pre-wrap font-sans">
                    {msg.text.split('\n\n').map((paragraph, i) => {
                      if (paragraph.startsWith('### ')) {
                        return <h4 key={i} className="font-extrabold text-cyan-300 text-sm mt-1 mb-1">{paragraph.replace('### ', '')}</h4>;
                      }
                      if (paragraph.startsWith('- ')) {
                        return (
                          <ul key={i} className="list-disc pl-4 space-y-1 text-slate-200">
                            {paragraph.split('\n').map((bullet, bi) => (
                              <li key={bi}>{bullet.replace(/^- /, '')}</li>
                            ))}
                          </ul>
                        );
                      }
                      return <p key={i}>{paragraph}</p>;
                    })}
                  </div>

                  {/* Copy Button for Assistant responses */}
                  {msg.role === 'assistant' && (
                    <div className="mt-2 pt-2 border-t border-[#1d2f65]/60 flex items-center justify-between text-[10px]">
                      <div className="flex flex-wrap gap-1.5">
                        {msg.actions?.map((act, ai) => (
                          <button
                            key={ai}
                            onClick={act.action}
                            className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-lg font-mono font-semibold transition flex items-center space-x-1"
                          >
                            <span>{act.label}</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        title="Copy message"
                        className="text-slate-400 hover:text-white p-1 rounded transition ml-auto flex items-center space-x-1"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-start space-x-2">
                <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 flex-shrink-0 animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-[#0f1d42] border border-[#1d2f65] p-3 rounded-2xl rounded-tl-none text-xs text-cyan-300 flex items-center space-x-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  <span>Synthesizing response via Gemini 3.8 Flash...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Question Chips */}
          <div className="px-3 py-2 bg-[#050a18] border-t border-[#1d2f65] flex items-center space-x-1.5 overflow-x-auto scrollbar-none text-[11px] flex-shrink-0">
            <span className="text-[10px] text-slate-400 font-mono font-bold flex-shrink-0">Suggestions:</span>
            {QUICK_PROMPTS.map((q, idx) => (
              <button
                key={idx}
                disabled={isLoading}
                onClick={() => handleSendMessage(q.prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-[#142045] hover:bg-cyan-950/60 border border-[#1d2f65] hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300 transition text-[11px] font-medium"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Input Box Bar */}
          <div className="p-3 bg-[#050a18] border-t border-[#1d2f65] flex items-center space-x-2 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              placeholder="Ask anything about AWB IDs, 3D tracking, code..."
              disabled={isLoading}
              className="flex-1 bg-[#0c152e] border border-[#1d2f65] focus:border-cyan-400 rounded-xl px-3 py-2 text-white placeholder-slate-400 text-xs outline-none transition"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputValue.trim()}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-white p-2 rounded-xl transition shadow flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useState } from 'react';
import { X, Code2, Copy, Check, Server, Layout, Box, Sparkles, Terminal } from 'lucide-react';

interface DeveloperIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DeveloperIntegrationModal({ isOpen, onClose }: DeveloperIntegrationModalProps) {
  const [activeTab, setActiveTab] = useState<'backend' | 'awb' | 'three' | 'widget'>('backend');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const BACKEND_EXPRESS_CODE = `// server.ts - Full-Stack Express Backend for Hackathon
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(express.json());

// 1. Initialize Gemini SDK on Server-Side Only
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: { 'User-Agent': 'aistudio-build' },
  },
});

// 2. AI Assistant Endpoint
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: message,
      config: {
        systemInstruction: \`You are an AI assistant for a multimodal logistics hackathon app. 
Help users track shipments, explain AWB IDs, and describe 3D delivery status.\`,
        temperature: 0.7,
      },
    });
    res.json({ reply: response.text });
  } catch (error) {
    res.status(500).json({ error: 'AI Assistant processing failed' });
  }
});

// 3. Unique AWB Order Generator (Modulo-7 Check Digit)
app.post('/api/awb/generate', (req, res) => {
  const { hub = 'BLR' } = req.body;
  const year = new Date().getFullYear();
  const serial = Math.floor(100000 + Math.random() * 900000);
  const checkDigit = serial % 7; // IATA standard check digit
  const trackingNumber = \`AWB-AEGIS-\${year}-\${hub.toUpperCase()}-\${serial}\${checkDigit}\`;

  res.json({
    success: true,
    order: {
      trackingNumber,
      serial,
      checkDigit,
      status: 'IN_TRANSIT',
      progressPct: 45
    }
  });
});

app.listen(3000, () => console.log('Backend running on http://localhost:3000'));`;

  const AWB_ALGORITHM_CODE = `/**
 * Air Waybill (AWB) Unique ID Generation Algorithm
 * Follows the standard IATA Modulo-7 check digit rule
 */
export function generateUniqueAWB(hub: string = 'BLR') {
  const year = new Date().getFullYear();
  // 1. Generate 6-digit random sequential serial number
  const serialNumber = Math.floor(100000 + Math.random() * 900000);
  
  // 2. Compute Modulo-7 check digit
  // (Prevents transcription and barcode scanning errors)
  const checkDigit = serialNumber % 7;

  // 3. Assemble composite tracking identifier
  const trackingNumber = \`AWB-AEGIS-\${year}-\${hub.toUpperCase()}-\${serialNumber}\${checkDigit}\`;

  return {
    trackingNumber,
    serialNumber,
    checkDigit,
    isValid: (serialNumber % 7) === checkDigit
  };
}

// Verification function
export function verifyAWBChecksum(awbString: string): boolean {
  const parts = awbString.split('-');
  const lastSection = parts[parts.length - 1]; // e.g. "7489214"
  const serial = parseInt(lastSection.slice(0, -1), 10);
  const check = parseInt(lastSection.slice(-1), 10);
  return (serial % 7) === check;
}`;

  const THREEJS_VEHICLE_CODE = `// ThreeVehicleViewer.tsx - 3D Animated Vehicle Display (Three.js WebGL)
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export default function ThreeVehicleViewer({ vehicleType = 'air' }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1329);
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 0, 0);

    // 2. High-Performance PBR Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // 3. Studio Reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // 4. Procedural 3D Airplane (Fuselage, Wings, Turbines)
    const airplane = new THREE.Group();
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.3, roughness: 0.2 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf77f00, metalness: 0.5, roughness: 0.3 });

    // Fuselage
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4.5, 24), whiteMat);
    fuselage.rotation.x = Math.PI / 2;
    airplane.add(fuselage);

    // Wings
    const wing = new THREE.Mesh(new THREE.BoxGeometry(7, 0.08, 1.2), orangeMat);
    airplane.add(wing);

    scene.add(airplane);

    // 5. Render Loop with Dynamic Banking
    let frameId = 0;
    const animate = (time: number) => {
      frameId = requestAnimationFrame(animate);
      airplane.rotation.y = time * 0.0006;
      airplane.position.y = Math.sin(time * 0.002) * 0.15;
      airplane.rotation.z = Math.sin(time * 0.0015) * 0.08;
      renderer.render(scene, camera);
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
    };
  }, [vehicleType]);

  return <div ref={mountRef} className="w-full h-80 rounded-2xl overflow-hidden" />;
}`;

  const FRONTEND_WIDGET_CODE = `// AIAssistantWidget.tsx - Frontend React Widget
import React, { useState } from 'react';
import { Bot, Send, X } from 'lucide-react';

export function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! Ask me any question about AWB tracking or delivery status.' }
  ]);
  const [input, setInput] = useState('');

  const sendQuery = async (queryText: string) => {
    const text = queryText || input;
    if (!text.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');

    const res = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="fixed bottom-5 right-5 p-3.5 bg-orange-500 rounded-full text-white shadow-xl">
        <Bot className="w-6 h-6" />
      </button>

      {isOpen && (
        <div className="fixed bottom-5 right-5 w-80 h-96 bg-slate-900 border border-slate-700 rounded-2xl flex flex-col p-3 text-xs">
          <div className="flex justify-between font-bold text-white border-b border-slate-800 pb-2">
            <span>Aegis AI Copilot</span>
            <button onClick={() => setIsOpen(false)}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {messages.map((m, i) => (
              <div key={i} className={\`p-2 rounded-xl \${m.role === 'user' ? 'bg-orange-600 text-white ml-auto' : 'bg-slate-800 text-slate-200'}\`}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask a question..." className="flex-1 bg-slate-800 p-2 rounded-lg text-white" />
            <button onClick={() => sendQuery(input)} className="bg-orange-500 p-2 rounded-lg text-white"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}`;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#0c152e] border-2 border-cyan-500 rounded-3xl max-w-4xl w-full p-5 space-y-4 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#1d2f65] pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-extrabold">
                HACKATHON DEVELOPER GUIDE
              </span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">
                FULL-STACK BLUEPRINT
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white flex items-center space-x-2 mt-0.5">
              <Terminal className="w-4 h-4 text-[#f77f00]" />
              <span>AI Assistant, AWB Generator & 3D Vehicle Integration</span>
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#142045]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex space-x-2 border-b border-[#1d2f65] pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('backend')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs flex items-center space-x-1.5 transition ${
              activeTab === 'backend' ? 'bg-[#f77f00] text-white shadow' : 'bg-[#050a18] text-slate-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>1. Express Backend (Gemini)</span>
          </button>
          <button
            onClick={() => setActiveTab('awb')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs flex items-center space-x-1.5 transition ${
              activeTab === 'awb' ? 'bg-[#f77f00] text-white shadow' : 'bg-[#050a18] text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>2. AWB Unique ID (Mod 7)</span>
          </button>
          <button
            onClick={() => setActiveTab('three')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs flex items-center space-x-1.5 transition ${
              activeTab === 'three' ? 'bg-[#f77f00] text-white shadow' : 'bg-[#050a18] text-slate-400 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5 text-cyan-400" />
            <span>3. Three.js 3D Vehicles</span>
          </button>
          <button
            onClick={() => setActiveTab('widget')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs flex items-center space-x-1.5 transition ${
              activeTab === 'widget' ? 'bg-[#f77f00] text-white shadow' : 'bg-[#050a18] text-slate-400 hover:text-white'
            }`}
          >
            <Layout className="w-3.5 h-3.5 text-purple-400" />
            <span>4. React UI Widget</span>
          </button>
        </div>

        {/* Code View Area */}
        <div className="flex-1 overflow-y-auto space-y-2 bg-[#050a18] p-4 rounded-2xl border border-[#1d2f65]">
          <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono pb-2 border-b border-[#1d2f65]">
            <span>
              {activeTab === 'backend' && 'server.ts (Node.js / Express + @google/genai SDK)'}
              {activeTab === 'awb' && 'awbGenerator.ts (IATA Modulo-7 Mathematical Algorithm)'}
              {activeTab === 'three' && 'ThreeVehicleViewer.tsx (Procedural 3D WebGL Mesh)'}
              {activeTab === 'widget' && 'AIAssistantWidget.tsx (React Frontend Component)'}
            </span>
            <button
              onClick={() => {
                const code =
                  activeTab === 'backend'
                    ? BACKEND_EXPRESS_CODE
                    : activeTab === 'awb'
                    ? AWB_ALGORITHM_CODE
                    : activeTab === 'three'
                    ? THREEJS_VEHICLE_CODE
                    : FRONTEND_WIDGET_CODE;
                handleCopy(code, activeTab);
              }}
              className="bg-[#142045] hover:bg-[#1d2f65] text-cyan-300 px-2.5 py-1 rounded-lg border border-cyan-500/30 flex items-center space-x-1 text-[11px]"
            >
              {copiedKey === activeTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === activeTab ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          <pre className="font-mono text-[11px] text-slate-200 overflow-x-auto p-2 leading-relaxed">
            <code>
              {activeTab === 'backend' && BACKEND_EXPRESS_CODE}
              {activeTab === 'awb' && AWB_ALGORITHM_CODE}
              {activeTab === 'three' && THREEJS_VEHICLE_CODE}
              {activeTab === 'widget' && FRONTEND_WIDGET_CODE}
            </code>
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1d2f65] text-[11px] text-slate-400">
          <span>Powered by <strong>Google GenAI</strong> (gemini-3.8-flash) &amp; <strong>Three.js WebGL</strong></span>
          <button
            onClick={onClose}
            className="bg-[#142045] hover:bg-[#1d2f65] text-white font-semibold px-4 py-1.5 rounded-xl border border-[#1d2f65]"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, ExternalLink, Check, Copy, Sparkles, Smartphone, Download } from 'lucide-react';

interface ScannableQRCodeProps {
  value: string;
  size?: number;
  label?: string;
  sublabel?: string;
  showModalOnClick?: boolean;
  className?: string;
}

export default function ScannableQRCode({
  value,
  size = 110,
  label,
  sublabel,
  showModalOnClick = true,
  className = ''
}: ScannableQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(value, {
      width: Math.max(size * 2, 240),
      margin: 1.5,
      color: {
        dark: '#050a18',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then(url => {
        if (isMounted) setDataUrl(url);
      })
      .catch(err => {
        console.error('Failed to generate scannable QR Code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-code-${Date.now()}.png`;
    a.click();
  };

  return (
    <>
      <div
        onClick={() => showModalOnClick && setIsModalOpen(true)}
        className={`group relative flex flex-col items-center justify-center p-2 rounded-2xl bg-white border border-cyan-400/50 shadow-lg cursor-pointer transition hover:scale-105 hover:shadow-cyan-500/30 ${className}`}
        title="Click to expand full scannable QR code"
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="Scannable QR Code"
            width={size}
            height={size}
            className="rounded-lg object-contain select-none"
          />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center bg-slate-100 rounded-lg animate-pulse text-slate-400"
          >
            <QrCode className="w-8 h-8" />
          </div>
        )}

        {label && (
          <span className="text-[10px] font-mono font-bold text-slate-900 mt-1 truncate max-w-full text-center">
            {label}
          </span>
        )}

        {/* Hover Hint Overlay */}
        <div className="absolute inset-0 bg-[#050a18]/80 backdrop-blur-[2px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-mono p-1 text-center pointer-events-none">
          <Smartphone className="w-5 h-5 text-cyan-400 mb-0.5" />
          <span className="font-bold text-cyan-300">Scan with Phone</span>
          <span className="text-[9px] text-slate-300">Tap to expand</span>
        </div>
      </div>

      {/* Expanded Modal for Phone Scanning */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#0c152e] border-2 border-cyan-400 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-[0_24px_64px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-extrabold block">
                AEGISCHAIN SCANNABLE SMART TAG
              </span>
              <h3 className="text-base font-extrabold text-white mt-0.5">
                {label || 'Live QR Code Verification'}
              </h3>
              {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
            </div>

            {/* High-Resolution QR Code */}
            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-2xl shadow-2xl border-4 border-cyan-400/40">
                {dataUrl && (
                  <img
                    src={dataUrl}
                    alt="High-Res Scannable QR Code"
                    width={220}
                    height={220}
                    className="rounded-lg object-contain"
                  />
                )}
              </div>
            </div>

            {/* Scan Guidance */}
            <div className="bg-[#050a18] p-3 rounded-2xl border border-[#1d2f65] text-xs text-slate-300 space-y-1">
              <div className="flex items-center justify-center space-x-1.5 text-cyan-300 font-bold">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Open your smartphone camera</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Point your camera lens at the code to instantly verify live electronic airway bill & cryptographic FIDO2 proof.
              </p>
            </div>

            {/* Encoded String & Copy Action */}
            <div className="bg-[#142045]/60 p-2.5 rounded-xl border border-[#1d2f65] flex items-center justify-between text-left">
              <div className="truncate mr-2">
                <span className="text-[9px] uppercase font-mono text-slate-400 block">Encoded Content</span>
                <span className="text-xs font-mono font-bold text-emerald-400 truncate block">
                  {value}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-[#050a18] hover:bg-cyan-500/20 text-cyan-300 border border-[#1d2f65] transition flex items-center space-x-1 flex-shrink-0"
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="text-[10px] font-mono">{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Actions */}
            <div className="flex space-x-2 pt-1">
              <button
                onClick={handleDownload}
                className="flex-1 bg-[#142045] hover:bg-[#1d2f65] border border-cyan-500/30 text-white font-semibold py-2 rounded-xl text-xs transition flex items-center justify-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Download PNG</span>
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-5 rounded-xl text-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

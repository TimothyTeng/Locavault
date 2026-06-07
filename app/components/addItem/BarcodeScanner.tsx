import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  onDetect: (raw: string, format?: string) => void;
  onClose: () => void;
};

const NATIVE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "itf",
  "data_matrix",
  "qr_code",
];

/**
 * Camera barcode scanner.
 * - Uses the native BarcodeDetector when available (Chrome/Android/Edge).
 * - Falls back to a dynamically-imported ZXing reader (iOS Safari etc.).
 * - Always offers manual barcode entry.
 *
 * Decoding is 100% local — nothing leaves the device here. (Product lookup,
 * done by the caller, sends only the barcode number.)
 */
export function BarcodeScanner({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const firedRef = useRef(false);

  // Keep the latest callback without restarting the camera each render
  const onDetectRef = useRef(onDetect);
  useEffect(() => {
    onDetectRef.current = onDetect;
  });

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let zxingControls: { stop: () => void } | null = null;
    let rafId = 0;

    const fire = (raw: string, format?: string) => {
      if (firedRef.current || cancelled) return;
      firedRef.current = true;
      onDetectRef.current(raw, format);
    };

    const start = async () => {
      const video = videoRef.current;
      if (!video) return;

      const BD = (globalThis as any).BarcodeDetector;
      try {
        if (BD) {
          // ── Native fast path ──
          const detector = new BD({ formats: NATIVE_FORMATS });
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          if (cancelled) return;
          video.srcObject = stream;
          await video.play();

          const tick = async () => {
            if (cancelled || firedRef.current) return;
            try {
              const codes = await detector.detect(video);
              if (codes?.length) {
                fire(codes[0].rawValue, codes[0].format);
                return;
              }
            } catch {
              /* transient detect errors are fine */
            }
            rafId = requestAnimationFrame(tick);
          };
          rafId = requestAnimationFrame(tick);
        } else {
          // ── ZXing fallback (loaded only when needed) ──
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (cancelled) return;
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromVideoDevice(
            undefined,
            video,
            (result) => {
              if (result) fire(result.getText());
            },
          );
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(
          e?.name === "NotAllowedError"
            ? "Camera permission denied. You can type the barcode below."
            : "Couldn't start the camera. Type the barcode below instead.",
        );
      }
    };

    start();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      try {
        zxingControls?.stop();
      } catch {
        /* ignore */
      }
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const submitManual = () => {
    const code = manual.replace(/\s/g, "");
    if (code) onDetect(code);
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 h-12 border-b border-slate-100 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">
            Scan barcode
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M1 1l8 8M9 1L1 9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Camera view */}
        <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!error && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-3/4 h-1/3 border-2 border-white/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-[11px] font-mono text-white/90">{error}</p>
            </div>
          )}
        </div>

        {/* Manual fallback */}
        <div className="px-4 py-3 border-t border-slate-100 flex flex-col gap-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Or enter it manually
          </p>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitManual()}
              inputMode="numeric"
              placeholder="Barcode number"
              className="flex-1 px-3 py-2 text-[12px] font-mono border border-slate-300 rounded-md focus:outline-none focus:border-slate-500"
            />
            <button
              onClick={submitManual}
              disabled={!manual.trim()}
              className="px-3 py-2 rounded-md bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 hover:bg-slate-700 transition-colors"
            >
              Use
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

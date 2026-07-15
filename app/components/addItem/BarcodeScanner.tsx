import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ScanLine, Check } from "lucide-react";
import { CloseButton } from "~/components/common/CloseButton";

export type BatchCode = { code: string; qty: number };

type Props = {
  onDetect: (raw: string, format?: string) => void;
  onClose: () => void;
  /** When provided, a "Keep scanning" toggle appears; batch decodes queue here. */
  onBatch?: (codes: BatchCode[]) => void;
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

// Minimal shape of the native BarcodeDetector API (absent from TS's DOM lib).
type DetectedBarcode = { rawValue: string; format: string };
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};

// Ignore a re-read of the same code within this window (camera sees it every frame).
const DEDUPE_MS = 1500;

/**
 * Camera barcode scanner.
 * - Uses the native BarcodeDetector when available (Chrome/Android/Edge).
 * - Falls back to a dynamically-imported ZXing reader (iOS Safari etc.).
 * - Always offers manual barcode entry.
 * - **Batch mode** (when `onBatch` is set): a "Keep scanning" toggle keeps the
 *   camera open and queues each decode (dedupe by code, qty++ on a repeat scan),
 *   so a whole shop can be captured in one session and bulk-added on "Done".
 *
 * Decoding is 100% local — nothing leaves the device here. (Product lookup,
 * done by the caller, sends only the barcode number.)
 */
export function BarcodeScanner({ onDetect, onClose, onBatch }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [batch, setBatch] = useState(false);
  const [queue, setQueue] = useState<BatchCode[]>([]);
  const [pulse, setPulse] = useState(false);
  const firedRef = useRef(false);

  // Live refs so the camera loop reads current state without restarting.
  const batchRef = useRef(batch);
  const lastRef = useRef<{ code: string; t: number }>({ code: "", t: 0 });
  useEffect(() => {
    batchRef.current = batch;
  }, [batch]);

  const onDetectRef = useRef(onDetect);
  useEffect(() => {
    onDetectRef.current = onDetect;
  });

  const enqueue = (raw: string) => {
    const code = raw.replace(/\s/g, "");
    if (!code) return;
    const now = Date.now();
    // Same code seen again too soon → it's the same physical item still in frame.
    if (lastRef.current.code === code && now - lastRef.current.t < DEDUPE_MS)
      return;
    lastRef.current = { code, t: now };
    setPulse(true);
    setTimeout(() => setPulse(false), 180);
    setQueue((prev) => {
      const i = prev.findIndex((q) => q.code === code);
      if (i === -1) return [...prev, { code, qty: 1 }];
      const copy = [...prev];
      copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
      return copy;
    });
  };

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let zxingControls: { stop: () => void } | null = null;
    let rafId = 0;

    const handle = (raw: string, format?: string) => {
      if (cancelled) return;
      if (batchRef.current) {
        enqueue(raw);
        return; // keep the camera running
      }
      if (firedRef.current) return;
      firedRef.current = true;
      onDetectRef.current(raw, format);
    };

    const start = async () => {
      const video = videoRef.current;
      if (!video) return;

      const BD = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor })
        .BarcodeDetector;
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
            if (cancelled || (!batchRef.current && firedRef.current)) return;
            try {
              const codes = await detector.detect(video);
              if (codes?.length) handle(codes[0].rawValue, codes[0].format);
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
              if (result) handle(result.getText());
            },
          );
        }
      } catch (e) {
        if (cancelled) return;
        const denied =
          e instanceof DOMException && e.name === "NotAllowedError";
        setError(
          denied
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

  const totalScanned = queue.reduce((n, q) => n + q.qty, 0);

  const submitManual = () => {
    const code = manual.replace(/\s/g, "");
    if (!code) return;
    if (batch) {
      enqueue(code);
      setManual("");
    } else {
      onDetect(code);
    }
  };

  const finishBatch = () => {
    if (queue.length && onBatch) onBatch(queue);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 h-12 border-b border-slate-100 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">
            Scan barcode
          </span>
          <CloseButton
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all"
          />
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
              <div
                className={`w-3/4 h-1/3 rounded-lg border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)] transition-colors ${
                  pulse ? "border-emerald-400" : "border-white/80"
                }`}
              />
            </div>
          )}
          {batch && totalScanned > 0 && (
            <div className="absolute right-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
              {totalScanned} scanned
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-[11px] font-mono text-white/90">{error}</p>
            </div>
          )}
        </div>

        {/* Batch toggle + queue (only when the caller supports bulk add) */}
        {onBatch && (
          <div className="border-t border-slate-100 px-4 py-3">
            <label className="flex cursor-pointer items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <ScanLine size={13} /> Keep scanning
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={batch}
                onClick={() => setBatch((b) => !b)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  batch ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    batch ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>

            {batch && queue.length > 0 && (
              <div className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {queue.map((q) => (
                  <span
                    key={q.code}
                    className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600"
                  >
                    {q.code.slice(-6)}
                    {q.qty > 1 && (
                      <span className="font-bold text-emerald-600">
                        ×{q.qty}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {batch && (
              <button
                onClick={finishBatch}
                disabled={!queue.length}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
              >
                <Check size={13} /> Add {totalScanned || ""} item
                {totalScanned === 1 ? "" : "s"}
              </button>
            )}
          </div>
        )}

        {/* Manual fallback */}
        <div className="px-4 py-3 border-t border-slate-100 flex flex-col gap-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            {batch ? "Or type a code to queue" : "Or enter it manually"}
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
              {batch ? "Queue" : "Use"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

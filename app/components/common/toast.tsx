import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRevalidator } from "react-router";
import { Check, AlertTriangle, Info, X } from "lucide-react";

export type ToastKind = "error" | "success" | "info";
type Toast = { id: number; message: string; kind: ToastKind };

const ToastCtx = createContext<(message: string, kind?: ToastKind) => void>(
  () => {},
);

/** Fire a transient toast: `const toast = useToast(); toast("Saved", "success")`. */
export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );

  const push = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = (idRef.current += 1);
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[calc(100vw-2rem)] max-w-xs flex-col gap-2 font-mono">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

const STYLES: Record<ToastKind, { ring: string; icon: React.ReactNode }> = {
  error: {
    ring: "border-red-200",
    icon: <AlertTriangle size={14} className="shrink-0 text-red-500" />,
  },
  success: {
    ring: "border-emerald-200",
    icon: <Check size={14} className="shrink-0 text-emerald-600" />,
  },
  info: {
    ring: "border-slate-200",
    icon: <Info size={14} className="shrink-0 text-slate-400" />,
  },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const s = STYLES[toast.kind];
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2 rounded-lg border ${s.ring} bg-white px-3 py-2 shadow-lg`}
    >
      {s.icon}
      <span className="flex-1 text-[12px] leading-snug text-slate-700">
        {toast.message}
      </span>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="text-slate-300 transition-colors hover:text-slate-600"
      >
        <X size={13} />
      </button>
    </div>
  );
}

/**
 * Watch a fetcher and, when a mutation settles as failed (`data.ok === false`,
 * produced by the action error wrapper), show an error toast and revalidate so
 * the optimistic UI rolls back to server truth. Pass a default message for the
 * common case.
 */
export function useFetcherFailureToast(
  fetcher: { state: string; data: unknown },
  message = "Something went wrong — your change wasn't saved.",
) {
  const toast = useToast();
  const { revalidate } = useRevalidator();
  const prevState = useRef(fetcher.state);

  useEffect(() => {
    if (prevState.current !== "idle" && fetcher.state === "idle") {
      const data = fetcher.data as { ok?: boolean; error?: string } | undefined;
      if (data && data.ok === false) {
        toast(data.error || message, "error");
        revalidate();
      }
    }
    prevState.current = fetcher.state;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);
}

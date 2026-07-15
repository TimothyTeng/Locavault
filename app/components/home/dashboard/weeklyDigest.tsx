import { useNavigate } from "react-router";
import { TrendingDown, Clock, ChefHat, Pill, Sparkles } from "lucide-react";
import type { Digest } from "#types/dashboardTypes";

/**
 * The habit anchor: one calm "this week" line summarising what's worth opening
 * the app for — running low, expiring, dose courses ending, recipes you can cook.
 * Pure aggregation over data the dashboard loader already computes; each segment
 * only appears when it has something to say. When everything's quiet it shows a
 * reassuring all-clear instead of vanishing.
 */
export function WeeklyDigest({ digest }: { digest: Digest }) {
  const navigate = useNavigate();
  const { low, expiring, cookable, doseEnding } = digest;
  const anything = low + expiring + cookable + doseEnding > 0;

  const segs: {
    key: string;
    icon: typeof TrendingDown;
    text: string;
    className: string;
    onClick?: () => void;
  }[] = [];
  if (low > 0)
    segs.push({
      key: "low",
      icon: TrendingDown,
      text: `${low} running low`,
      className: "text-amber-700",
    });
  if (expiring > 0)
    segs.push({
      key: "expiring",
      icon: Clock,
      text: `${expiring} expiring`,
      className: "text-rose-700",
    });
  if (doseEnding > 0)
    segs.push({
      key: "dose",
      icon: Pill,
      text: `${doseEnding} dose course${doseEnding !== 1 ? "s" : ""} ending`,
      className: "text-blue-700",
      onClick: () => navigate("/reminders"),
    });
  if (cookable > 0)
    segs.push({
      key: "cook",
      icon: ChefHat,
      text: `cook ${cookable} recipe${cookable !== 1 ? "s" : ""}`,
      className: "text-emerald-700",
    });

  return (
    <div className="lv-dash-attn mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        <Sparkles size={13} className="text-slate-300" />
        This week
      </div>
      {anything ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-medium">
          {segs.map((s) => {
            const Icon = s.icon;
            const body = (
              <span className={`flex items-center gap-1.5 ${s.className}`}>
                <Icon size={14} />
                {s.text}
              </span>
            );
            return s.onClick ? (
              <button
                key={s.key}
                onClick={s.onClick}
                className="rounded-md transition-opacity hover:opacity-70"
              >
                {body}
              </button>
            ) : (
              <span key={s.key}>{body}</span>
            );
          })}
        </div>
      ) : (
        <p className="text-[13px] text-slate-400">
          All caught up — nothing running low or expiring. 🌿
        </p>
      )}
    </div>
  );
}

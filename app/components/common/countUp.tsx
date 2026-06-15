import { useEffect, useRef } from "react";
import gsap from "gsap";

/** Animates a number from 0 → value with a GSAP tween. */
export function CountUp({
  value,
  className,
  duration = 0.8,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { n: 0 };
    const tween = gsap.to(obj, {
      n: value,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = String(Math.round(obj.n));
      },
    });
    return () => {
      tween.kill();
    };
  }, [value, duration]);
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}

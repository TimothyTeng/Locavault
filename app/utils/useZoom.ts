import { useState, useEffect, useRef } from "react";

export function useZoom(min = 0.5, max = 3) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let lastDist: number | null = null;

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(max, Math.max(min, z - e.deltaY * 0.001)));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => Math.min(max, z + 0.1));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(min, z - 0.1));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dist = getDistance(e.touches);
      if (lastDist !== null) {
        const delta = dist - lastDist;
        setZoom((z) => Math.min(max, Math.max(min, z + delta * 0.005)));
      }
      lastDist = dist;
    };

    const handleTouchEnd = () => { lastDist = null; };

    const el = containerRef.current;
    el?.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [min, max]);

  return { zoom, setZoom, containerRef };
}
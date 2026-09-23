import { useEffect, useRef } from "react";

type LogoStamp = {
  x: number;
  y: number;
  size: number;
  rotation: number;
  alpha: number;
};

const STAMPS: LogoStamp[] = [
  { x: 0.09, y: 0.14, size: 74, rotation: -0.12, alpha: 0.1 },
  { x: 0.86, y: 0.22, size: 92, rotation: 0.08, alpha: 0.08 },
  { x: 0.18, y: 0.39, size: 62, rotation: 0.15, alpha: 0.07 },
  { x: 0.76, y: 0.46, size: 78, rotation: -0.1, alpha: 0.09 },
  { x: 0.08, y: 0.64, size: 88, rotation: 0.1, alpha: 0.07 },
  { x: 0.9, y: 0.72, size: 66, rotation: -0.16, alpha: 0.09 },
  { x: 0.34, y: 0.86, size: 72, rotation: -0.06, alpha: 0.07 },
  { x: 0.67, y: 0.91, size: 98, rotation: 0.12, alpha: 0.06 },
];

export function LukaDynamicAtmosphere({ contained = false }: { contained?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    const logo = new Image();
    let width = 0;
    let height = 0;

    const draw = () => {
      if (!logo.complete || !logo.naturalWidth) return;

      const isDark = document.documentElement.classList.contains("dark");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      context.clearRect(0, 0, width, height);
      context.globalAlpha = 1;

      for (const stamp of STAMPS) {
        const size = Math.min(stamp.size, Math.max(52, width * 0.075));
        const x = width * stamp.x;
        const y = height * stamp.y;

        context.save();
        context.translate(x, y);
        context.rotate(stamp.rotation);
        context.globalAlpha = isDark ? stamp.alpha * 1.35 : stamp.alpha;
        context.shadowColor = isDark ? "#5eead455" : "#14b8a633";
        context.shadowBlur = 18;
        context.drawImage(logo, -size / 2, -size / 2, size, size);
        context.restore();
      }

      context.globalAlpha = 1;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bounds = contained
        ? canvas.parentElement?.getBoundingClientRect()
        : undefined;
      width = bounds?.width ?? window.innerWidth;
      height = bounds?.height ?? window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    logo.onload = draw;
    logo.src = "/Luka.png";
    resize();
    window.addEventListener("resize", resize);

    const parentResizeObserver = contained && canvas.parentElement
      ? new ResizeObserver(resize)
      : undefined;

    if (parentResizeObserver && canvas.parentElement) {
      parentResizeObserver.observe(canvas.parentElement);
    }

    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      window.removeEventListener("resize", resize);
      parentResizeObserver?.disconnect();
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={contained ? "pointer-events-none absolute inset-0 z-0 h-full w-full" : "luka-dynamic-atmosphere"}
      aria-hidden="true"
    />
  );
}

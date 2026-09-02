/* ────────────────────────────────────────────────────────────
   NOVA 动效 hooks —— 零依赖，全部基于原生 API
   useCountUp / useReveal / useStagger / useTilt / useMagnetic
   ──────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

const smoothOut = (t: number) => 1 - Math.pow(1 - t, 4);

/** 数字滚动：值变化时从旧值平滑滚动到新值 */
export function useCountUp(target: number, duration = 900): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const value = Math.round(from + (target - from) * smoothOut(t));
      setDisplay(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}

/** 入场揭示：元素进入视口时追加 className（默认 .is-in） */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
): { ref: RefObject<T | null>; revealed: boolean } {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            el.classList.add('is-in');
            io.disconnect();
          }
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px', ...options },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, revealed };
}

/** 级联序号：给容器子元素注入 --i，配合 .stagger 使用 */
export function useStagger<T extends HTMLElement = HTMLDivElement>(): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    Array.from(el.children).forEach((child, index) => {
      (child as HTMLElement).style.setProperty('--i', String(index));
    });
  });
  return ref;
}

/** 3D 倾斜 + 高光跟随（鼠标悬停时卡片微倾斜） */
export function useTilt<T extends HTMLElement = HTMLDivElement>(maxDeg = 6) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches) return;

    let raf = 0;
    const onMove = (event: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        el.style.transform =
          `perspective(900px) rotateX(${(0.5 - py) * maxDeg}deg) rotateY(${(px - 0.5) * maxDeg}deg) translateY(-2px)`;
        el.style.setProperty('--glare-x', `${px * 100}%`);
        el.style.setProperty('--glare-y', `${py * 100}%`);
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = '';
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [maxDeg]);

  return ref;
}

/** 磁吸按钮：指针靠近时轻微吸附 */
export function useMagnetic<T extends HTMLElement = HTMLButtonElement>(strength = 0.22) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches) return;

    let raf = 0;
    const onMove = (event: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = '';
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [strength]);

  return ref;
}

/** 生成一组星尘粒子的内联样式（工作台环境光用） */
export function makeStardust(count: number, seed = 7): CSSProperties[] {
  const palette = ['#6366f1', '#22d3ee', '#a855f7', '#f472b6'];
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return Array.from({ length: count }, (_, i) => ({
    '--x': `${rand() * 100}%`,
    '--y': `${rand() * 100}%`,
    '--s': `${2 + rand() * 2.5}px`,
    '--c': palette[i % palette.length],
    '--o': `${0.12 + rand() * 0.22}`,
    '--t': `${3 + rand() * 4}s`,
    '--dt': `${10 + rand() * 12}s`,
    '--d': `${rand() * 6}s`,
    '--dx': `${(rand() - 0.5) * 90}px`,
    '--dy': `${(rand() - 0.5) * 60}px`,
    position: 'absolute',
  }) as CSSProperties);
}

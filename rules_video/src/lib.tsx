import React from 'react';
export const ramp = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));
export const ease = (x: number) => x * x * (3 - 2 * x);
export const R = (p: number, a: number, b: number) => ease(ramp(p, a, b));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export type Pal = {bg: string; ink: string; a: string; b: string; c: string; dim: string; panel: string};

export const Txt: React.FC<{x: number; y: number; s: string; size?: number; color: string; w?: number; align?: 'left' | 'center' | 'right'; o?: number; bold?: boolean}> = ({x, y, s, size = 34, color, w = 700, align = 'center', o = 1, bold}) => (
  <div style={{position: 'absolute', left: align === 'center' ? x - w / 2 : align === 'left' ? x : x - w, top: y - size * 0.6, width: w, textAlign: align, fontSize: size, color, opacity: o, fontWeight: bold ? 700 : 400, lineHeight: 1.15, fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif'}}>{s}</div>
);
export const Rect: React.FC<{x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; r?: number; o?: number; children?: React.ReactNode; rot?: number}> = ({x, y, w, h, fill = 'none', stroke, sw = 4, r = 8, o = 1, children, rot = 0}) => (
  <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, background: fill, border: stroke ? `${sw}px solid ${stroke}` : undefined, borderRadius: r, opacity: o, transform: `rotate(${rot}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif'}}>{children}</div>
);
export const Dot: React.FC<{x: number; y: number; r?: number; fill: string; o?: number; stroke?: string}> = ({x, y, r = 14, fill, o = 1, stroke}) => (
  <div style={{position: 'absolute', left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: r, background: fill, opacity: o, border: stroke ? `4px solid ${stroke}` : undefined, boxSizing: 'border-box'}} />
);
export const Bar: React.FC<{x: number; y: number; w: number; h?: number; v: number; color: string; back: string; label?: string; lc?: string; o?: number; val?: string}> = ({x, y, w, h = 36, v, color, back, label, lc = '#fff', o = 1, val}) => (
  <div style={{opacity: o}}>
    <Rect x={x + w / 2} y={y} w={w} h={h} fill={back} r={6} />
    <div style={{position: 'absolute', left: x, top: y - h / 2, width: Math.max(0, w * Math.min(1, v)), height: h, background: color, borderRadius: 6}} />
    {label && <Txt x={x} y={y - h - 8} s={label} size={28} color={lc} w={w} align="left" />}
    {val && <Txt x={x + w} y={y - h - 8} s={val} size={30} color={lc} w={200} align="right" bold />}
  </div>
);
export const Arrow: React.FC<{x1: number; y1: number; x2: number; y2: number; p: number; color: string; sw?: number; dash?: boolean}> = ({x1, y1, x2, y2, p, color, sw = 8, dash}) => {
  const ex = x1 + (x2 - x1) * p, ey = y1 + (y2 - y1) * p, ang = Math.atan2(y2 - y1, x2 - x1), L = 28;
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}} width={1920} height={1080}>
      <line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={sw} strokeDasharray={dash ? '20 12' : undefined} />
      {p > 0.02 && <polygon fill={color} points={`${ex},${ey} ${ex - L * Math.cos(ang - 0.45)},${ey - L * Math.sin(ang - 0.45)} ${ex - L * Math.cos(ang + 0.45)},${ey - L * Math.sin(ang + 0.45)}`} />}
    </svg>
  );
};
export const Poly: React.FC<{pts: [number, number][]; p: number; color: string; sw?: number; fill?: string}> = ({pts, p, color, sw = 8}) => {
  const d = 'M' + pts.map((q) => q.join(',')).join(' L');
  return <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}><path d={d} fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} /></svg>;
};
export const Dial: React.FC<{x: number; y: number; r?: number; v: number; label: string; color: string; track: string; ink: string}> = ({x, y, r = 80, v, label, color, track, ink}) => {
  const a0 = 135, sweep = 270, ang = a0 + sweep * v;
  const pt = (a: number, rr: number) => [x + rr * Math.cos((a * Math.PI) / 180), y + rr * Math.sin((a * Math.PI) / 180)];
  const arc = (a1: number, a2: number) => { const [sx, sy] = pt(a1, r), [ex, ey] = pt(a2, r); return `M${sx},${sy} A${r},${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${ex},${ey}`; };
  const [nx, ny] = pt(ang, r - 14);
  return (
    <>
      <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}>
        <path d={arc(a0, a0 + sweep)} stroke={track} strokeWidth={14} fill="none" strokeLinecap="round" />
        {v > 0.01 && <path d={arc(a0, ang)} stroke={color} strokeWidth={14} fill="none" strokeLinecap="round" />}
        <line x1={x} y1={y} x2={nx} y2={ny} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        <circle cx={x} cy={y} r={9} fill={ink} />
      </svg>
      <Txt x={x} y={y + r + 30} s={label} size={26} color={ink} w={r * 2.6} />
    </>
  );
};
export const Card: React.FC<{x: number; y: number; w?: number; h?: number; flip: number; front: string; back: string; cf: string; cb: string; tf?: string; tb?: string; size?: number}> = ({x, y, w = 200, h = 270, flip, front, back, cf, cb, tf = '#fff', tb = '#fff', size = 30}) => {
  const f = flip < 0.5; const sx = Math.abs(1 - 2 * flip);
  return (
    <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, transform: `scaleX(${Math.max(0.02, sx)})`}}>
      <Rect x={w / 2} y={h / 2} w={w} h={h} fill={f ? cf : cb} r={14}><div style={{color: f ? tf : tb, fontSize: size, textAlign: 'center', padding: 12, fontWeight: 600}}>{f ? front : back}</div></Rect>
    </div>
  );
};
export const Pill: React.FC<{x: number; y: number; s: string; fill: string; color: string; w?: number; size?: number; o?: number; stroke?: string}> = ({x, y, s, fill, color, w = 220, size = 28, o = 1, stroke}) => (
  <Rect x={x} y={y} w={w} h={size * 2} fill={fill} r={size} o={o} stroke={stroke} sw={4}><span style={{color, fontSize: size, fontWeight: 600}}>{s}</span></Rect>
);

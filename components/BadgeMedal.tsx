import React, { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';
import { GLYPHS } from '@/constants/badgeGlyphs';
import type { BadgeShape } from '@/lib/badges';

/** Rengi açar (amt > 0) ya da koyulaştırır (amt < 0). */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  const r = ch((n >> 16) & 255); const g = ch((n >> 8) & 255); const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const CX = 50; const CY = 44;
const ring = (n: number, rOuter: number, rInner: number | null) => Array.from({ length: n * (rInner ? 2 : 1) }, (_, i) => {
  const step = rInner ? i / 2 : i;
  const a = (-90 + (360 / n) * step) * Math.PI / 180;
  const r = rInner && i % 2 ? rInner : rOuter;
  return `${(CX + r * Math.cos(a)).toFixed(1)},${(CY + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');
const HEX = ring(6, 40, null);
const BURST = ring(12, 43, 36);

/**
 * Rozet madalyası. Şekil kademeyle değişir: ilk kademeler yuvarlak, ortadakiler altıgen, en üsttekiler yıldız (sarmal) madalya.
 * Aynı şekil içindeki sıra, madalyanın altındaki noktalarla (1-4) gösterilir. Ortadaki simge her rozete özel çizimdir
 * (constants/badgeGlyphs.ts, anahtar = rozet kimliği). Kilitli rozet gri ve kilitli çizilir.
 * size küçükse (rozet adının yanındaki ufak simge) kurdele ve noktalar çizilmez, çizgi kalınlaşır.
 */
export function BadgeMedal({ color, icon, shape = 'circle', pips = 1, earned = true, size = 96 }: { color: string; icon: string; shape?: BadgeShape; pips?: number; earned?: boolean; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const detail = size >= 56;
  const base = earned ? color : '#aeb4be';
  const light = shade(base, 0.38); const dark = shade(base, -0.28); const edge = shade(base, -0.4);
  const viewBox = detail ? '0 0 100 100' : '8 4 84 84';
  const shapeProps = { fill: `url(#o${id})`, stroke: edge, strokeWidth: 1.6, strokeLinejoin: 'round' as const };
  // Simge, iç dairenin içine 24x24'lük alan olarak yerleşir.
  const box = detail ? 34 : 40;
  const gScale = box / 24;
  const parts = GLYPHS[earned ? icon : 'lock'] ?? GLYPHS.star;
  const sw = detail ? 2 : 2.9;
  const ink = earned ? '#ffffff' : '#6b7280';
  return <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox={viewBox}>
      <Defs>
        <LinearGradient id={`o${id}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={light} /><Stop offset="0.55" stopColor={base} /><Stop offset="1" stopColor={dark} /></LinearGradient>
        <LinearGradient id={`i${id}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={shade(base, -0.12)} /><Stop offset="1" stopColor={shade(base, 0.22)} /></LinearGradient>
      </Defs>
      {detail ? <>
        <Polygon points="28,72 47,78 39,99 31,91 20,96" fill={dark} stroke={edge} strokeWidth={1.2} strokeLinejoin="round" />
        <Polygon points="72,72 53,78 61,99 69,91 80,96" fill={dark} stroke={edge} strokeWidth={1.2} strokeLinejoin="round" />
      </> : null}
      {shape === 'circle' ? <Circle cx={CX} cy={CY} r={38} {...shapeProps} /> : shape === 'hex' ? <Polygon points={HEX} {...shapeProps} /> : <Polygon points={BURST} {...shapeProps} />}
      <Circle cx={CX} cy={CY} r={27} fill={`url(#i${id})`} stroke="#ffffff" strokeOpacity={earned ? 0.6 : 0.8} strokeWidth={2} />
      <Path d="M 27 30 Q 38 15 56 17" stroke="#ffffff" strokeOpacity={0.4} strokeWidth={3} strokeLinecap="round" fill="none" />
      <G transform={`translate(${CX - box / 2} ${CY - box / 2 - (detail ? 1 : 0)}) scale(${gScale})`}>
        {parts.map((p, i) => <Path key={i} d={p.d} fill={p.fill ? ink : 'none'} stroke={ink} strokeWidth={p.w ?? sw} strokeLinecap="round" strokeLinejoin="round" />)}
      </G>
      {detail && earned ? Array.from({ length: pips }, (_, i) => <Circle key={i} cx={CX + (i - (pips - 1) / 2) * 8} cy={CY + 21} r={2.4} fill="#ffffff" fillOpacity={0.95} />) : null}
    </Svg>
  </View>;
}

/**
 * Rozet simgeleri: her rozetin kendine ait vektör çizimi (24x24 alan, beyaz).
 * Anahtar = rozet kimliği (lib/badges.ts). Çizimler react-native-svg Path ile çizilir (components/BadgeMedal.tsx).
 * Resim dosyası yoktur; uygulama büyümez, her ekranda net durur.
 */
export interface GlyphPart { d: string; fill?: boolean; w?: number }

const r2 = (n: number) => Math.round(n * 100) / 100;
const S = (d: string, w?: number): GlyphPart => ({ d, w });
const F = (d: string): GlyphPart => ({ d, fill: true });

/** Yalnızca mutlak M/L/C/Z komutlu yolları dönüştürür (yay komutu içeren yollara uygulanmaz). */
function xf(d: string, fn: (x: number, y: number) => [number, number]) {
  let out = '';
  d.replace(/([MLCZ])([^MLCZ]*)/g, (_m: string, c: string, args: string) => {
    const nums = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    const pts: string[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) { const [x, y] = fn(nums[i], nums[i + 1]); pts.push(`${r2(x)} ${r2(y)}`); }
    out += c + pts.join(' ');
    return '';
  });
  return out;
}
const mir = (d: string) => xf(d, (x, y) => [24 - x, y]);
const rot = (d: string, deg: number, cx = 12, cy = 12) => {
  const a = (deg * Math.PI) / 180; const c = Math.cos(a); const s = Math.sin(a);
  return xf(d, (x, y) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
};

const circ = (cx: number, cy: number, r: number) => `M${r2(cx - r)} ${cy}a${r} ${r} 0 1 0 ${r2(2 * r)} 0a${r} ${r} 0 1 0 ${r2(-2 * r)} 0Z`;
const pt = (cx: number, cy: number, r: number, deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
const star = (cx: number, cy: number, n: number, ro: number, ri: number, rotDeg = -90) => {
  const pts = Array.from({ length: n * 2 }, (_, i) => { const [x, y] = pt(cx, cy, i % 2 ? ri : ro, rotDeg + (180 / n) * i); return `${r2(x)} ${r2(y)}`; });
  return `M${pts.join('L')}Z`;
};
const poly = (cx: number, cy: number, n: number, r: number, rotDeg = -90) => {
  const pts = Array.from({ length: n }, (_, i) => { const [x, y] = pt(cx, cy, r, rotDeg + (360 / n) * i); return `${r2(x)} ${r2(y)}`; });
  return `M${pts.join('L')}Z`;
};
const spokes = (cx: number, cy: number, n: number, r1: number, r2_: number, rotDeg = -90) => Array.from({ length: n }, (_, i) => {
  const a = pt(cx, cy, r1, rotDeg + (360 / n) * i); const b = pt(cx, cy, r2_, rotDeg + (360 / n) * i);
  return `M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`;
}).join('');

/** Alev: 24 alanında 2..21 arası; s ölçek, (cx, cy) merkez. */
const FLAME = 'M12 2C13 6 18 9 18 14.5C18 18 15.5 21 12 21C8.5 21 6 18 6 14.5C6 11.5 7.5 9.8 9 8C9.3 9.8 10.2 10.6 11 10.8C11 7 10.4 4.6 12 2Z';
const flame = (s: number, cx: number, cy: number) => xf(FLAME, (x, y) => [x * s + cx - 12 * s, y * s + cy - 12 * s]);

const SHIELD = 'M12 2.8L19.5 5.6V11.5C19.5 16.5 16.3 19.8 12 21.5C7.7 19.8 4.5 16.5 4.5 11.5V5.6Z';
const WING = 'M10 12C8.5 9 5.5 7.5 2 8C3.5 9.5 4 10.5 4 11.5C3 11.8 2.5 12.3 2 13C4 13.5 5.5 13.6 6.5 14C6 15 5.5 15.5 5 16.5C7.5 16.5 9.5 15.5 10 14.5Z';

export const GLYPHS: Record<string, GlyphPart[]> = {
  // 1. Çalışma süresi: denizci
  hours_1: [S(circ(12, 5, 2.3)), S('M12 7.3V21M8 11H16M4.5 14.5C5 18.5 8.3 21 12 21C15.7 21 19 18.5 19.5 14.5')], // çapa
  hours_5: [S(circ(12, 12, 6.6)), F(circ(12, 12, 1.8)), S(spokes(12, 12, 8, 1.8, 10.8))], // dümen
  hours_15: [S(circ(12, 12, 9.5)), F('M12 5.5L14.6 12H9.4Z'), S('M14.6 12L12 18.5L9.4 12')], // pusula
  hours_40: [S('M9 21L10.3 10H13.7L15 21ZM7 21H17M9.6 15.5H14.4M10.2 10V6.8H13.8V10M2.5 7.5H8M16 7.5H21.5'), F('M9.3 6.8L12 3.6L14.7 6.8Z')], // fener
  hours_80: [S('M5.5 14C5.5 9.5 8.5 7 12 7C15.5 7 18.5 9.5 18.5 14'), F('M3.5 14H20.5C20.5 17 17 18.5 12 18.5C7 18.5 3.5 17 3.5 14Z'), F(circ(12, 10.8, 1.5))], // kaptan şapkası
  hours_150: [S('M12 3.5L20 10L12 20.5L4 10ZM4 10H20M9 10L12 3.5M15 10L12 3.5M9 10L12 20.5M15 10L12 20.5')], // safir
  hours_300: [F(star(12, 7, 5, 4.6, 1.9)), S('M5 13.5H19M5 17H19M5 20.5H19')], // amiral
  hours_500: [S(circ(12, 12, 10)), F(star(12, 12, 4, 8.4, 2.2)), S(spokes(12, 12, 4, 5.2, 7.4, -45))], // pusula gülü

  // 2. Seri: ateş
  streak_3: [F(flame(0.78, 12, 12.5)), F(circ(19, 5.5, 1)), F(circ(5, 7, 0.9))], // kibrit alevi / kıvılcım
  streak_7: [F(flame(0.55, 12, 7.5)), F('M8 13.5H16L14.5 16.5H9.5Z'), S('M12 16.5V21.5')], // meşale
  streak_14: [F(flame(0.62, 12, 9.5)), S('M5 20L19 16M19 20L5 16')], // kamp ateşi
  streak_30: [S(flame(1, 12, 12)), F(flame(0.45, 12, 16.2))], // alev
  streak_60: [S('M4.5 21V11C4.5 6.5 8 3.5 12 3.5C16 3.5 19.5 6.5 19.5 11V21M2.5 21H21.5'), F(flame(0.5, 12, 15.5))], // ocak
  streak_100: [S('M3 21L8.5 10H15.5L21 21ZM12 7.5V3.5M8.5 7L6.5 4M15.5 7L17.5 4'), F(circ(12, 15.2, 1.4))], // volkan
  streak_150: [F(circ(12, 12, 4.3)), S(spokes(12, 12, 8, 7, 10.5))], // güneş

  // 3. Maraton: tek oturum
  marathon_25: [S(circ(12, 13.5, 7.5)), S('M10 2.8H14M12 2.8V6M12 13.5V9.5M18.2 7.3L19.6 5.9')], // kronometre
  marathon_40: [S('M6 17C6.8 15.5 7.5 13.5 7.5 11A4.5 4.5 0 0 1 16.5 11C16.5 13.5 17.2 15.5 18 17ZM12 3.5V6.5M10 20A2 2 0 0 0 14 20')], // zil
  marathon_60: [F(WING), F(mir(WING)), S(circ(12, 12, 3.2))], // kanatlı
  marathon_90: [S('M9 20.5C4.5 18.5 3 12.5 5.5 6'), S(mir('M9 20.5C4.5 18.5 3 12.5 5.5 6')), F(star(12, 11.5, 5, 5, 2.1))], // çelenk
  marathon_120: [S(circ(12, 12, 10)), F('M13.2 4L6.5 13H11.2L10.5 20L17.5 10.8H12.6Z')], // elektrik
  marathon_150: [S(SHIELD), S('M8 9.5C9.3 8 10.7 11 12 9.5C13.3 8 14.7 11 16 9.5M8 13.3C9.3 11.8 10.7 14.8 12 13.3C13.3 11.8 14.7 14.8 16 13.3')], // kalkan
  marathon_180: [S('M12 12C13.8 9 19.5 8 19.5 12C19.5 16 13.8 15 12 12C10.2 9 4.5 8 4.5 12C4.5 16 10.2 15 12 12Z', 2.4), F(star(19.5, 5, 4, 3.4, 0.9))], // sonsuzluk

  // 4. Odak oturumu: zanaat
  sessions_1: [F(rot('M5.5 5L18.5 5L18.5 10L5.5 10Z', 35)), S(rot('M12 10L12 21', 35), 2.8)], // çekiç
  sessions_10: [S(circ(12, 4.2, 1.6)), S('M12 5.8L6 20.5M12 5.8L18 20.5M8.5 14.5H15.5')], // pergel
  sessions_25: [F('M3 8H20V10C20 11.5 18.3 12 16.5 12H15.3L16.3 15.5H18.5V19.5H5.5V15.5H7.7L8.7 12H8C5 12 3 10.5 3 8Z')], // örs
  sessions_50: [S(poly(12, 12, 4, 9.5, -90), 1.8), S(poly(12, 12, 4, 9.5, -45), 1.8), F(circ(12, 12, 2.2))], // sekizgen yıldız
  sessions_100: [S('M12 6.5C9.8 5 6.2 4.6 3 5.6V18.8C6.2 17.8 9.8 18.2 12 19.7C14.2 18.2 17.8 17.8 21 18.8V5.6C17.8 4.6 14.2 5 12 6.5ZM12 6.5V19.7')], // açık kitap
  sessions_200: [S('M10 3.5H14M12 3.5V5.5M8.5 8V18H15.5V8'), F('M8.2 8L9.5 5.5H14.5L15.8 8Z'), F('M7.5 18H16.5V20.5H7.5Z'), F(flame(0.42, 12, 13.2))], // kandil
  sessions_350: [F(star(12, 12, 8, 10.5, 4.2))], // kutup yıldızı

  // 5. Denemeler: rütbe
  exams_1: [S('M6 15.5L12 9.5L18 15.5', 3)],
  exams_3: [S('M6 11.5L12 5.5L18 11.5M6 18.5L12 12.5L18 18.5', 2.6)],
  exams_5: [S('M6 9.5L12 4.5L18 9.5M6 15.5L12 10.5L18 15.5M6 21.5L12 16.5L18 21.5', 2.4)],
  exams_10: [F(star(12, 10.5, 5, 7, 2.9)), S('M5 20H19', 2.6)], // teğmen: 1 yıldız
  exams_20: [F(star(7.2, 10.5, 5, 5.4, 2.2)), F(star(16.8, 10.5, 5, 5.4, 2.2)), S('M4 20H20', 2.6)], // yüzbaşı: 2 yıldız
  exams_30: [F('M14.5 4A8.5 8.5 0 1 0 14.5 20A12 12 0 0 1 14.5 4Z'), F(star(17, 12, 5, 3.4, 1.4))], // ay-yıldız

  // 6. Yanlışlarla yüzleşme: dedektif
  wrongs_5: [S(circ(10.5, 10.5, 6.5)), S('M15.3 15.3L21 21', 3), S('M8.6 8.8C8.6 6.6 12.4 6.6 12.4 8.9C12.4 10.4 10.5 10.5 10.5 12.2'), F(circ(10.5, 14.3, 0.7))], // büyüteç + ?
  wrongs_15: [S('M3 6.5L9 4.5L15 6.5L21 4.5V17.5L15 19.5L9 17.5L3 19.5ZM9 4.5V17.5M15 6.5V19.5')], // harita
  wrongs_30: [S(circ(10.5, 10.5, 6.5)), S('M15.3 15.3L21 21', 3), S('M7.4 10.7L9.8 13L13.8 8.4')], // büyüteç + tik
  wrongs_60: [S('M6 3H14L19 8V21H6ZM14 3V8H19M9.2 14.5L11.6 16.8L15.6 12.2')], // dosya + onay
  wrongs_100: [S(star(12, 12, 12, 10.6, 8.8), 1.6), S(circ(11, 11, 3.4)), S('M13.6 13.6L16.8 16.8', 2.6)], // mühür + büyüteç
  wrongs_150: [S(SHIELD), S('M13.5 5L10.8 10.2L14 12.5L11 18.5', 1.8)], // çatlak kalkan

  // 7. Çözülen soru: dağ
  solved_50: [S('M2 20C6 10.5 15 8.5 22 20ZM8.5 20C9.5 17.2 13.8 16.2 14.8 13.5'), F(circ(17.5, 5.5, 1.5))], // yamaç
  solved_250: [S('M8.5 21.5C8.5 18 15.5 18 15.5 14.5C15.5 11 8.5 11.5 8.5 8C8.5 6 10 4.5 12 3', 2.6)], // patika
  solved_500: [S('M3.5 12.5L12 5L20.5 12.5M6 11V19.5H18V11M10.3 19.5V14.8H13.7V19.5M2 19.5H22')], // yayla evi
  solved_1000: [S('M3.5 20.5L12 8.5L20.5 20.5ZM12 8.5V2.8'), F('M12 2.8L17.2 4.8L12 6.8Z')], // tepe + bayrak
  solved_2500: [S('M2 20L8.5 8.5L13 16L15.8 12.2L22 20ZM5.8 13.2L7.2 14.4L8.5 12.8L9.8 14.4L11.2 13.2')], // karlı dağ
  solved_5000: [S('M3.5 21L13 6.5L20.5 21ZM13 6.5V2M9.8 12L11.4 13.2L13 11.6L14.6 13L16.2 11.8'), F('M13 2L18.5 3.8L13 5.6Z')], // zirve bayrağı
  solved_7500: [S('M2 20L11 5.5L15 11.5L17 9L22 20Z'), F(circ(19, 4.5, 2.1))], // everest + güneş
  solved_10000: [S('M3 21L12 9.5L21 21Z'), F(star(12, 4.6, 4, 4.3, 1.1))], // zirve + yıldız

  // 8. Zaman ve disiplin
  time_early1: [S('M2.5 19H21.5M6.5 19A5.5 5.5 0 0 1 17.5 19M12 9V6M5.2 12.2L7.2 14.2M18.8 12.2L16.8 14.2')], // doğan güneş
  time_weekend1: [S('M4.5 4.5L16 16', 2.6), S('M11.5 17.5L17.5 11.5'), S('M16 16L19.5 19.5'), F(circ(20.5, 20.5, 1.3)), S(mir('M4.5 4.5L16 16'), 2.6), S(mir('M11.5 17.5L17.5 11.5')), S(mir('M16 16L19.5 19.5')), F(circ(3.5, 20.5, 1.3))], // çapraz kılıç
  time_early5: [S('M21 12.8A9 9 0 1 1 11.2 3A7 7 0 0 0 21 12.8Z'), F(star(18.5, 5.5, 4, 3.2, 0.9))], // ay + yıldız
  time_month20: [F('M5 3.5H19V6.5H5Z'), F('M5 17.5H19V20.5H5Z'), S('M8.5 6.5V17.5M12 6.5V17.5M15.5 6.5V17.5')], // sütun

  // 9. Koleksiyon
  social_pin1: [F('M9 3H15L14.2 9C16.4 10 18 11.4 18 13.5H6C6 11.4 7.6 10 9.8 9Z'), S('M12 13.5V21')], // raptiye
  social_own10: [S('M4 11.5V8.5C4 6 7.5 4.5 12 4.5C16.5 4.5 20 6 20 8.5V11.5M4 11.5H20V20H4Z'), F('M10.3 12.5H13.7V16.5H10.3Z')], // sandık
  social_own25: [S('M7 3.5H17V10C17 13.2 14.8 15.5 12 15.5C9.2 15.5 7 13.2 7 10ZM7 5.5H4V7.5C4 9.5 5.5 10.5 7.2 10.8M17 5.5H20V7.5C20 9.5 18.5 10.5 16.8 10.8M12 15.5V18.5'), F('M8 18.5H16V20.8H8Z'), F(star(12, 9.2, 5, 2.8, 1.1))], // kupa

  // Kilitli rozet ve eksik anahtar için yedekler
  lock: [F('M6 11H18V20H6Z'), S('M8.5 11V8A3.5 3.5 0 0 1 15.5 8V11')],
  star: [F(star(12, 12, 5, 9.5, 4))],
};

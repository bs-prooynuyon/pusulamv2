import { QuestionLog, WrongQuestion } from '@/types/planim';

/** Madalya renkleri (katalogdaki gibi): bronz, bakır, gümüş, altın, safir, mor, turkuaz vb. */
export const PALETTE: Record<string, string> = {
  bronze: '#a8683a', copper: '#c27a42', silver: '#8f9aa8', gold: '#dcab25', yellow: '#eeb800', sapphire: '#2f7fe0', purple: '#7b4fd6',
  turquoise: '#22b4c8', emerald: '#2a9d63', green: '#4f9a4a', orange: '#e8692a', red: '#d23f3f', maroon: '#9b2b3f', ice: '#4c95c9', khaki: '#6f8a3a',
};

/** Profilde adının yanında gösterilecek rozet sayısı. Ücretsiz kullanıcıda 1; premium gelince yalnızca bu sayı yükseltilir. */
export const MAX_PINNED = 1;
/** Seçili rozet listesini izin verilen sayıya indirir (en son seçilen kalır). */
export const capPinned = (ids: string[]) => ids.slice(-MAX_PINNED);

export type BadgeShape = 'circle' | 'hex' | 'burst';
/**
 * Kategorideki sıraya göre madalya şekli ve altındaki nokta sayısı: ilk kademeler yuvarlak, ortadakiler altıgen, en üstteki 1-2 rozet yıldız madalya.
 * Noktalar şeklin içindeki sırayı gösterir (en fazla 4).
 */
function shapeOf(i: number, n: number): { shape: BadgeShape; pips: number } {
  const burst = n >= 6 ? 2 : 1;
  const hexStart = n - burst - (n >= 6 ? 2 : 1);
  if (i < hexStart) return { shape: 'circle', pips: Math.min(4, i + 1) };
  if (i < n - burst) return { shape: 'hex', pips: Math.min(4, i - hexStart + 1) };
  return { shape: 'burst', pips: Math.min(4, i - (n - burst) + 1) };
}

/** metric: bu rozetin kendi sayacı (yoksa kategorinin sayacı). id: verilmezse "<kategori>_<hedef>". */
interface TierDef { goal: number; title: string; color: string; icon?: string; metric?: string; id?: string; unit?: string; desc?: string }
interface CategoryDef { id: string; title: string; unit: string; desc: (goal: number) => string; tiers: TierDef[] }

/** Her kategori bir "blok"tur; kademeler sağa kaydırınca açılır. Hedefler LGS'ye kalan süreye göre ulaşılabilir tutuldu. Toplam 56 rozet. */
const T = (goal: number, title: string, color: string): TierDef => ({ goal, title, color });
const CATEGORIES: CategoryDef[] = [
  { id: 'hours', title: 'Çalışma süresi', unit: 'saat', desc: (g) => `Toplam ${g} saat odaklan.`, tiers: [
    T(1, 'Miço', 'bronze'), T(5, 'Tayfa', 'copper'), T(15, 'Dümenci', 'silver'), T(40, 'Kılavuz', 'silver'),
    T(80, 'Kaptan', 'gold'), T(150, 'Usta Kaptan', 'sapphire'), T(300, 'Amiral', 'purple'), T(500, 'Pusula Efsanesi', 'turquoise'),
  ] },
  { id: 'streak', title: 'Seri', unit: 'gün', desc: (g) => `${g} gün art arda çalış.`, tiers: [
    T(3, 'Kıvılcım', 'bronze'), T(7, 'Meşale', 'silver'), T(14, 'Ateş', 'orange'), T(30, 'Alev', 'gold'),
    T(60, 'Ocak', 'red'), T(100, 'Volkan', 'purple'), T(150, 'Güneş', 'yellow'),
  ] },
  { id: 'marathon', title: 'Maraton', unit: 'dakika', desc: (g) => `Tek oturumda ${g} dakika çalış.`, tiers: [
    T(25, 'Yürüyüşçü', 'bronze'), T(40, 'Koşucu', 'silver'), T(60, 'Yarışçı', 'silver'), T(90, 'Maratoncu', 'gold'),
    T(120, 'Ultra Maratoncu', 'emerald'), T(150, 'Demir Nefes', 'sapphire'), T(180, 'Sonsuz Nefes', 'purple'),
  ] },
  { id: 'sessions', title: 'Odak oturumu', unit: 'oturum', desc: (g) => `${g} odak oturumu tamamla.`, tiers: [
    T(1, 'Çırak', 'bronze'), T(10, 'Kalfa', 'silver'), T(25, 'Usta', 'gold'), T(50, 'Ahi', 'emerald'),
    T(100, 'Üstat', 'sapphire'), T(200, 'Pir', 'purple'), T(350, 'Kutup Yıldızı', 'turquoise'),
  ] },
  { id: 'exams', title: 'Denemeler', unit: 'deneme', desc: (g) => `${g} deneme sonucu ekle.`, tiers: [
    T(1, 'Deneme Eri', 'khaki'), T(3, 'Deneme Onbaşısı', 'silver'), T(5, 'Deneme Çavuşu', 'silver'),
    T(10, 'Deneme Teğmeni', 'gold'), T(20, 'Deneme Yüzbaşısı', 'sapphire'), T(30, 'Deneme Albayı', 'maroon'),
  ] },
  { id: 'wrongs', title: 'Yanlışlarla yüzleşme', unit: 'yanlış', desc: (g) => `${g} yanlış soruyu anla.`, tiers: [
    T(5, 'Meraklı', 'bronze'), T(15, 'İzci', 'green'), T(30, 'Dedektif', 'silver'),
    T(60, 'Müfettiş', 'gold'), T(100, 'Başmüfettiş', 'purple'), T(150, 'Hatasız Yol', 'turquoise'),
  ] },
  { id: 'solved', title: 'Çözülen soru', unit: 'soru', desc: (g) => `Toplam ${g.toLocaleString('tr-TR')} soru çöz.`, tiers: [
    T(50, 'Yamaç', 'green'), T(250, 'Patika', 'silver'), T(500, 'Yayla', 'silver'), T(1000, 'Tepe', 'gold'),
    T(2500, 'Dağ', 'ice'), T(5000, 'Zirve', 'sapphire'), T(7500, 'Everest', 'purple'), T(10000, 'Pusula Zirvesi', 'turquoise'),
  ] },
  // Özel zamanlar: her rozetin kendi sayacı var. Gece çalışması ödüllendirilmez (uyku saatlerini korumak için).
  { id: 'time', title: 'Zaman ve disiplin', unit: 'oturum', desc: (g) => `${g}`, tiers: [
    { id: 'time_early1', goal: 1, metric: 'early', unit: 'oturum', title: 'Erken Kuş', color: 'yellow', desc: 'Sabah 05:00 ile 09:00 arasında başlayan bir oturum tamamla.' },
    { id: 'time_weekend1', goal: 1, metric: 'weekend', unit: 'oturum', title: 'Hafta Sonu Savaşçısı', color: 'red', desc: 'Cumartesi ya da pazar günü bir oturum tamamla.' },
    { id: 'time_early5', goal: 5, metric: 'early', unit: 'oturum', title: 'Seher Vakti', color: 'purple', desc: '5 kez sabah 05:00 ile 09:00 arasında oturum başlat.' },
    { id: 'time_month20', goal: 20, metric: 'monthDays', unit: 'gün', title: 'Disiplin Abidesi', color: 'emerald', desc: 'Aynı takvim ayında 20 farklı gün çalış.' },
  ] },
  // Koleksiyon: rozet sayısına ve profilde gösterilen rozete bağlı.
  { id: 'social', title: 'Koleksiyon', unit: 'rozet', desc: (g) => `${g}`, tiers: [
    { id: 'social_pin1', goal: 1, metric: 'pinned', unit: 'rozet', title: 'İlk Sabitleme', color: 'bronze', desc: 'Bir rozet tak: adının yanında göster.' },
    { id: 'social_own10', goal: 10, metric: 'collected', unit: 'rozet', title: 'Rozet Avcısı', color: 'silver', desc: '10 rozet kazan.' },
    { id: 'social_own25', goal: 25, metric: 'collected', unit: 'rozet', title: 'Koleksiyoncu', color: 'gold', desc: '25 rozet kazan.' },
  ] },
];

const tierId = (c: CategoryDef, t: TierDef) => t.id ?? `${c.id}_${t.goal}`;
const tierDesc = (c: CategoryDef, t: TierDef) => t.desc ?? c.desc(t.goal);

export interface BadgeTier { id: string; title: string; desc: string; /** simge anahtarı = rozet kimliği (constants/badgeGlyphs.ts) */ icon: string; color: string; shape: BadgeShape; pips: number; goal: number; earned: boolean; progress: number; hint: string }
export interface BadgeCategory { id: string; title: string; unit: string; value: number; tiers: BadgeTier[]; earnedCount: number }

/** Herhangi bir rozet kimliğinden (örn. "hours_15") görünümünü bulur; başkasının rozetini çizmek için. */
export const BADGE_INDEX: Record<string, { title: string; icon: string; color: string; shape: BadgeShape; pips: number; desc: string; category: string }> = {};
CATEGORIES.forEach((c) => c.tiers.forEach((t, i) => { const id = tierId(c, t); BADGE_INDEX[id] = { title: t.title, icon: id, color: PALETTE[t.color], ...shapeOf(i, c.tiers.length), desc: tierDesc(c, t), category: c.title }; }));
export const TOTAL_BADGES = Object.keys(BADGE_INDEX).length;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Şimdiye kadarki en uzun ardışık çalışma günü sayısı. */
export function bestStreak(sessions: { date: string }[]) {
  const days = [...new Set(sessions.map((s) => dayKey(new Date(s.date))))]
    .map((k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); })
    .sort((a, b) => a - b);
  let best = 0; let run = 0; let prev = 0;
  for (const t of days) { run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
  return best;
}

/** Oturumun başladığı an (kayıtlı tarih bitiş anıdır). */
const startOf = (s: { date: string; durationMinutes: number }) => new Date(new Date(s.date).getTime() - s.durationMinutes * 60000);

/** Bir takvim ayında en çok kaç farklı gün çalışıldı. */
function bestMonthDays(sessions: { date: string }[]) {
  const months = new Map<string, Set<number>>();
  sessions.forEach((s) => { const d = new Date(s.date); const k = `${d.getFullYear()}-${d.getMonth()}`; (months.get(k) ?? months.set(k, new Set()).get(k)!).add(d.getDate()); });
  return [...months.values()].reduce((m, set) => Math.max(m, set.size), 0);
}

interface Input { sessions: { date: string; durationMinutes: number }[]; exams: unknown[]; wrongs: WrongQuestion[]; questionLogs?: QuestionLog[]; /** Profilde gösterilmek üzere seçilen rozet kimlikleri */ pinned?: string[] }

/** Rozetler tamamen telefondaki verilerden hesaplanır. */
export function computeBadgeCategories({ sessions, exams, wrongs, questionLogs = [], pinned = [] }: Input): BadgeCategory[] {
  const total = sessions.reduce((s, x) => s + x.durationMinutes, 0);
  const values: Record<string, number> = {
    hours: Math.floor(total / 60),
    streak: bestStreak(sessions),
    marathon: sessions.reduce((m, x) => Math.max(m, x.durationMinutes), 0),
    sessions: sessions.length,
    exams: exams.length,
    wrongs: wrongs.filter((w) => w.understood === true).length,
    solved: questionLogs.reduce((s, l) => s + (l.solved || 0), 0),
    early: sessions.filter((x) => { const h = startOf(x).getHours(); return h >= 5 && h < 9; }).length,
    weekend: sessions.filter((x) => { const d = startOf(x).getDay(); return d === 0 || d === 6; }).length,
    monthDays: bestMonthDays(sessions),
    pinned: capPinned(pinned.filter((id) => BADGE_INDEX[id])).length,
    collected: 0,
  };
  const build = (c: CategoryDef): BadgeCategory => {
    const value = values[c.id] ?? 0;
    const tiers = c.tiers.map((t, i): BadgeTier => {
      const v = t.metric ? values[t.metric] ?? 0 : value;
      const unit = t.unit ?? c.unit;
      const id = tierId(c, t);
      return { id, title: t.title, desc: tierDesc(c, t), icon: id, color: PALETTE[t.color], ...shapeOf(i, c.tiers.length), goal: t.goal,
        earned: v >= t.goal, progress: Math.min(1, v / t.goal), hint: `${Math.min(v, t.goal)} / ${t.goal} ${unit}` };
    });
    return { id: c.id, title: c.title, unit: c.unit, value, tiers, earnedCount: tiers.filter((t) => t.earned).length };
  };
  // Koleksiyon rozetleri diğer kategorilerde kazanılan rozet sayısına bağlıdır; önce onlar hesaplanır.
  const others = CATEGORIES.filter((c) => c.id !== 'social').map(build);
  values.collected = others.reduce((n, c) => n + c.earnedCount, 0);
  const social = build(CATEGORIES.find((c) => c.id === 'social')!);
  return [...others, social];
}

export const earnedBadgeIds = (cats: BadgeCategory[]) => cats.flatMap((c) => c.tiers.filter((t) => t.earned).map((t) => t.id));

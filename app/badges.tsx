import { Feather } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BadgeMedal } from '@/components/BadgeMedal';
import { Card, Header, Screen } from '@/components/PlanimUI';
import { usePlanim } from '@/context/PlanimContext';
import { useColors } from '@/hooks/useColors';
import { BadgeCategory, BadgeTier, capPinned, computeBadgeCategories, earnedBadgeIds, MAX_PINNED, TOTAL_BADGES } from '@/lib/badges';

/** Bir blok: kategori başlığı + sağa kaydırınca açılan kademeler (örn. 10 gün → 100 gün). */
function CategoryBlock({ cat, pinned, onTogglePin }: { cat: BadgeCategory; pinned: string[]; onTogglePin: (id: string) => void }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  // Açılışta şu anki hedefe (ilk kazanılmamış kademe) git; hepsi kazanıldıysa sonuncuya.
  const firstOpen = cat.tiers.findIndex((t) => !t.earned);
  const start = firstOpen === -1 ? cat.tiers.length - 1 : firstOpen;
  const [index, setIndex] = useState(start);
  const ref = useRef<ScrollView>(null);

  const page = (t: BadgeTier) => {
    const isPinned = pinned.includes(t.id);
    return <View key={t.id} style={{ width, alignItems: 'center', gap: 6, paddingHorizontal: 8 }}>
      <BadgeMedal color={t.color} icon={t.icon} shape={t.shape} pips={t.pips} earned={t.earned} size={112} />
      <Text style={{ color: colors.foreground, fontWeight: '800', fontSize: 16, textAlign: 'center' }}>{t.title}</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17, textAlign: 'center' }}>{t.desc}</Text>
      {t.earned
        ? <Pressable onPress={() => onTogglePin(t.id)} style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: isPinned ? colors.primary : colors.muted }}>
          <Feather name={isPinned ? 'check' : 'user'} size={13} color={isPinned ? colors.primaryForeground : colors.primary} />
          <Text style={{ color: isPinned ? colors.primaryForeground : colors.primary, fontWeight: '800', fontSize: 12 }}>{isPinned ? 'Adımın yanında görünüyor' : 'Adımın yanında göster'}</Text>
        </Pressable>
        : <View style={{ alignSelf: 'stretch', gap: 4, marginTop: 4 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}><View style={{ height: 6, width: `${Math.round(t.progress * 100)}%`, borderRadius: 3, backgroundColor: t.color }} /></View>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: 'center' }}>{t.hint}</Text>
        </View>}
    </View>;
  };

  return <Card style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.foreground, fontWeight: '800', fontSize: 15 }}>{cat.title}</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '700' }}>{cat.earnedCount} / {cat.tiers.length}</Text>
    </View>
    <View onLayout={(e) => { const w = e.nativeEvent.layout.width; if (w && w !== width) { setWidth(w); setTimeout(() => ref.current?.scrollTo({ x: index * w, animated: false }), 0); } }}>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} nestedScrollEnabled
        onMomentumScrollEnd={(e) => { if (width) setIndex(Math.round(e.nativeEvent.contentOffset.x / width)); }}>
        {width ? cat.tiers.map(page) : <View style={{ width: 1, height: 160 }} />}
      </ScrollView>
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
      {cat.tiers.map((t, i) => <View key={t.id} style={{ width: i === index ? 16 : 7, height: 7, borderRadius: 4, backgroundColor: i === index ? t.color : t.earned ? `${t.color}88` : colors.border }} />)}
    </View>
    <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: 'center' }}>Sağa kaydır: sıradaki rozet →</Text>
  </Card>;
}

export default function BadgesScreen() {
  const { sessions, exams, wrongs, questionLogs, settings, updateSettings } = usePlanim();
  const cats = computeBadgeCategories({ sessions, exams, wrongs, questionLogs, pinned: settings.pinnedBadges });
  const earnedIds = earnedBadgeIds(cats);
  const pinned = capPinned((settings.pinnedBadges ?? []).filter((id) => earnedIds.includes(id)));
  const toggle = (id: string) => {
    const next = pinned.includes(id) ? pinned.filter((x) => x !== id) : capPinned([...pinned, id]);
    updateSettings({ pinnedBadges: next });
  };
  return <Screen>
    <Header eyebrow="Emeklerin burada" title="Rozetlerim" subtitle={`${earnedIds.length} / ${TOTAL_BADGES} rozet kazandın. Beğendiğin ${MAX_PINNED} rozeti adının yanında göster; arkadaşların ve sınıfın görür (${pinned.length}/${MAX_PINNED}). Başka bir rozeti seçersen eskisinin yerine geçer.`} />
    {cats.map((c) => <CategoryBlock key={c.id} cat={c} pinned={pinned} onTogglePin={toggle} />)}
  </Screen>;
}

import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BadgeMedal } from '@/components/BadgeMedal';
import { useColors } from '@/hooks/useColors';
import { BADGE_INDEX, capPinned } from '@/lib/badges';
import { fetchBadges, UserBadges as Data } from '@/lib/badgeCloud';

export function BadgeDot({ id, size = 18 }: { id: string; size?: number }) {
  const info = BADGE_INDEX[id];
  if (!info) return null;
  return <BadgeMedal color={info.color} icon={info.icon} shape={info.shape} pips={info.pips} size={size} />;
}

/**
 * Bir kişinin adının yanında seçtiği rozet (MAX_PINNED kadar). Dokununca kazandığı tüm rozetler isimleriyle açılır.
 * Rozeti olmayan ya da öğretmen gibi hiç rozet yayınlamamış kişide hiçbir şey çizmez.
 */
export function UserBadges({ uid, size = 18, expandable = true }: { uid: string; size?: number; expandable?: boolean }) {
  const colors = useColors();
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { let alive = true; if (uid) fetchBadges(uid).then((d) => { if (alive) setData(d); }); return () => { alive = false; }; }, [uid]);
  const earned = data ? data.earned.filter((id) => BADGE_INDEX[id]) : [];
  if (!data || !earned.length) return null;
  const chips = capPinned(data.pinned.filter((id) => earned.includes(id)));
  return <View style={{ alignSelf: 'flex-start' }}>
    <Pressable disabled={!expandable} onPress={() => setOpen((v) => !v)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {chips.map((id) => <BadgeDot key={id} id={id} size={size} />)}
      <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '800' }}>{chips.length ? '' : '🏅 '}{earned.length} rozet</Text>
    </Pressable>
    {open ? <View style={{ marginTop: 6, padding: 10, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 6, minWidth: 200 }}>
      {earned.map((id) => <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BadgeDot id={id} size={22} />
        <View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '800' }}>{BADGE_INDEX[id].title}</Text><Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{BADGE_INDEX[id].desc}</Text></View>
      </View>)}
    </View> : null}
  </View>;
}

/** Bir kişinin güncel adı: profilinden okunur (ad değişince eski mesajlarda da yeni ad görünür); profil yoksa mesajdaki ad kullanılır. */
export function useLiveName(uid: string, fallback: string) {
  const [name, setName] = useState('');
  useEffect(() => { let alive = true; if (uid) fetchBadges(uid).then((d) => { if (alive) setName(d.name); }); return () => { alive = false; }; }, [uid]);
  return name || fallback;
}
export function LiveName({ uid, fallback, style }: { uid: string; fallback: string; style?: object }) {
  const name = useLiveName(uid, fallback);
  return <Text style={style}>{name}</Text>;
}

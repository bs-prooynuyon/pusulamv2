import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Card, Header, Screen } from '@/components/PlanimUI';
import { usePlanim } from '@/context/PlanimContext';
import { useColors } from '@/hooks/useColors';
import { groupMembers, memberLabel, myGroups, openDm } from '@/lib/chat';
import { cloudConfigured } from '@/lib/cloud';

interface Teacher { id: string; name: string; label: string; branch: string }

/** Öğrencinin sınıf ve okul gruplarındaki öğretmenler, branşlarına göre. Birine dokununca onunla birebir sohbet açılır; anlamadığı soru için ders adı hazır yazılır. */
export default function AskTeacherScreen() {
  const colors = useColors();
  const { settings } = usePlanim();
  const { subject } = useLocalSearchParams<{ subject?: string }>();
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [filter, setFilter] = useState(String(subject ?? ''));
  const [busy, setBusy] = useState('');
  const ready = settings.signedIn && cloudConfigured();

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    (async () => {
      const found = new Map<string, Teacher>();
      for (const g of (await myGroups()).filter((x) => x.kind === 'class' || x.kind === 'school')) {
        for (const m of await groupMembers(g.id).catch(() => [])) {
          if (!(m.role === 'teacher' || m.user_id === g.owner_id && g.kind === 'class')) continue;
          if (!found.has(m.user_id)) found.set(m.user_id, { id: m.user_id, name: m.user_name, label: memberLabel(m, g.kind, true), branch: m.branch });
        }
      }
      if (alive) setTeachers([...found.values()]);
    })().catch(() => { if (alive) setTeachers([]); });
    return () => { alive = false; };
  }, [ready]);

  const branches = [...new Set((teachers ?? []).map((t) => t.branch).filter(Boolean))];
  const shown = (teachers ?? []).filter((t) => !filter || t.branch === filter);
  const ask = async (t: Teacher) => {
    setBusy(t.id);
    try {
      const r = await openDm(t.id, t.name, settings.studentName || 'Öğrenci');
      const draft = `Merhaba hocam, ${filter ? `${filter} dersinden ` : ''}bir soruyu anlamadım. Yardımcı olabilir misiniz?`;
      router.push(`/chat-room?id=${r.id}&name=${encodeURIComponent(t.name)}&kind=dm&owner=&code=&draft=${encodeURIComponent(draft)}` as never);
    } catch (e) { Alert.alert('Sohbet açılamadı', e instanceof Error ? e.message : 'Tekrar dener misin?'); } finally { setBusy(''); }
  };

  return <Screen>
    <Pressable onPress={() => router.back()} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}><Feather name="chevron-left" size={20} color={colors.mutedForeground} /><Text style={{ color: colors.mutedForeground, fontSize: 15, fontWeight: '700' }}>Geri dön</Text></Pressable>
    <Header eyebrow="Anlamadığın soru" title="Hocana sor" subtitle="Branşa göre öğretmenini seç, birebir sohbet açılır. Soruyu yazarak anlat." />
    {!ready ? <Card><Text style={{ color: colors.foreground, lineHeight: 21 }}>Öğretmene yazmak için hesabınla giriş yapman ve sınıf ya da okul grubuna katılman gerekiyor.</Text></Card> : null}
    {ready && teachers === null ? <ActivityIndicator color={colors.primary} /> : null}
    {branches.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{['', ...branches].map((b) => <Pressable key={b || 'all'} onPress={() => setFilter(b)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: filter === b ? colors.primary : colors.card, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: filter === b ? colors.primaryForeground : colors.foreground, fontWeight: '700', fontSize: 12 }}>{b || 'Hepsi'}</Text></Pressable>)}</View> : null}
    {teachers && teachers.length === 0 ? <Card><Text style={{ color: colors.foreground, lineHeight: 21 }}>Gruplarında branşı belli bir öğretmen görünmüyor. Sohbet ekranından okul grubuna ya da sınıfa katılırsan öğretmenlerini burada görürsün.</Text></Card> : null}
    {teachers && teachers.length > 0 && shown.length === 0 ? <Card><Text style={{ color: colors.foreground, lineHeight: 21 }}>{filter} branşında öğretmen bulunamadı. Hepsini görmek için “Hepsi”ne dokun.</Text></Card> : null}
    {shown.map((t) => <Pressable key={t.id} disabled={!!busy} onPress={() => ask(t)}><Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><Feather name="user-check" size={20} color={colors.primary} /></View>
      <View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontWeight: '800', fontSize: 16 }}>{t.name}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>{t.label}</Text></View>
      {busy === t.id ? <ActivityIndicator color={colors.primary} /> : <Feather name="message-circle" size={20} color={colors.primary} />}
    </View></Card></Pressable>)}
  </Screen>;
}

import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlanim } from '@/context/PlanimContext';
import { useColors } from '@/hooks/useColors';
import { clearChatForMe, getGroupInfo, GMember, groupMembers, KIND_LABEL, leaveGroup, memberLabel, openDm, renameGroup, setGroupPhoto } from '@/lib/chat';
import type { Group } from '@/lib/chat';
import { getUserId } from '@/lib/cloud';
import { pickProfilePhoto } from '@/lib/photo';

const PALETTE = ['#2f6fd0', '#7a4fd0', '#1f9d74', '#d0782f', '#c24b7a'];
const colorOf = (name: string) => PALETTE[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];
const GREEN = '#008069';

/** Grup bilgisi (WhatsApp'taki gibi): fotoğraf, ad, üyeler, sohbeti temizle, gruptan ayrıl. Ad ve fotoğrafı grubu kuran değiştirir. */
export default function GroupInfoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings } = usePlanim();
  const { id, name, kind, owner, code } = useLocalSearchParams<{ id: string; name?: string; kind?: string; owner?: string; code?: string }>();
  const k = (kind ?? 'student') as Group['kind'];
  const [myId, setMyId] = useState('');
  const [title, setTitle] = useState(String(name ?? ''));
  const [photo, setPhoto] = useState('');
  const [members, setMembers] = useState<GMember[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const isOwner = !!owner && owner === myId;
  /** Kurucu yalnızca sınıf ve öğrenci gruplarında ad/fotoğraf değiştirir ve üye çıkarır. */
  const canManage = isOwner && (k === 'class' || k === 'student');

  const load = useCallback(async () => {
    try { setMembers(await groupMembers(id)); } catch { /* çevrimdışı */ }
  }, [id]);
  useEffect(() => {
    getUserId().then(setMyId).catch(() => undefined);
    getGroupInfo(id).then((g) => { if (g) { if (g.name) setTitle(g.name); setPhoto(g.photo); } }).catch(() => undefined);
    load();
  }, [id, load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { Alert.alert('Olmadı', e instanceof Error ? e.message : 'Tekrar dener misin?'); } finally { setBusy(false); }
  };
  const saveName = () => run(async () => { const t = await renameGroup({ id, kind: k, code: code || null }, draft); setTitle(t); setEditing(false); });
  const changePhoto = () => run(async () => { const p = await pickProfilePhoto(); if (p) { await setGroupPhoto(id, p); setPhoto(p); } });
  const removePhoto = () => run(async () => { await setGroupPhoto(id, ''); setPhoto(''); });
  const clearChat = () => Alert.alert('Sohbet temizlensin mi?', 'Bu telefondaki eski mesajlar gizlenir. Diğer kişilerde ve grupta mesajlar durur.', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Temizle', style: 'destructive', onPress: () => run(async () => { await clearChatForMe(id); router.back(); }) },
  ]);
  const leave = () => Alert.alert('Gruptan ayrılınsın mı?', undefined, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Ayrıl', style: 'destructive', onPress: () => run(async () => { await leaveGroup(id, myId, k); router.replace('/chat' as never); }) },
  ]);
  /** Üyeye dokununca onunla birebir sohbet açılır. */
  const startDm = async (m: GMember) => {
    try { const r = await openDm(m.user_id, m.user_name, settings.studentName || 'Ben'); router.push(`/chat-room?id=${r.id}&name=${encodeURIComponent(m.user_name)}&kind=dm&owner=${myId}&code=` as never); }
    catch (e) { Alert.alert('Sohbet açılamadı', e instanceof Error ? e.message : 'Tekrar dener misin?'); }
  };
  const kick = (m: GMember) => Alert.alert(`${m.user_name} gruptan çıkarılsın mı?`, undefined, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Çıkar', style: 'destructive', onPress: () => run(async () => { await leaveGroup(id, m.user_id, k); await load(); }) },
  ]);

  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: colors.card };
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 10, paddingTop: insets.top + 10, backgroundColor: GREEN }}>
      <Pressable onPress={() => router.back()} hitSlop={10}><Feather name="arrow-left" size={22} color="#fff" /></Pressable>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>Grup bilgisi</Text>
    </View>
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 10 }}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 22, backgroundColor: colors.card }}>
        <Pressable disabled={!canManage || busy} onPress={changePhoto}>
          {photo ? <Image source={{ uri: photo }} style={{ width: 110, height: 110, borderRadius: 55 }} />
            : <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: colorOf(title), alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 44, fontWeight: '800' }}>{(title.trim()[0] ?? '?').toLocaleUpperCase('tr')}</Text></View>}
          {canManage ? <View style={{ position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' }}><Feather name="camera" size={17} color="#fff" /></View> : null}
        </Pressable>
        {canManage && photo ? <Pressable onPress={removePhoto} disabled={busy}><Text style={{ color: colors.destructive, fontWeight: '700' }}>Fotoğrafı kaldır</Text></Pressable> : null}
        {editing ? <View style={{ alignSelf: 'stretch', paddingHorizontal: 20, gap: 8 }}>
          <TextInput value={draft} onChangeText={setDraft} maxLength={60} autoFocus placeholder="Grup adı" placeholderTextColor={colors.mutedForeground} style={{ borderBottomWidth: 2, borderBottomColor: GREEN, color: colors.foreground, fontSize: 20, paddingVertical: 6, textAlign: 'center' }} />
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
            <Pressable onPress={() => setEditing(false)} style={{ paddingVertical: 8, paddingHorizontal: 18 }}><Text style={{ color: colors.mutedForeground, fontWeight: '700' }}>Vazgeç</Text></Pressable>
            <Pressable onPress={saveName} disabled={busy || !draft.trim()} style={{ paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: GREEN, opacity: busy || !draft.trim() ? 0.5 : 1 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Kaydet</Text></Pressable>
          </View>
        </View> : <Pressable disabled={!canManage} onPress={() => { setDraft(title); setEditing(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 }}>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
          {canManage ? <Feather name="edit-2" size={16} color={colors.mutedForeground} /> : null}
        </Pressable>}
        <Text style={{ color: colors.mutedForeground }}>{KIND_LABEL[k] ?? 'Grup'} · {members.length} üye</Text>
      </View>

      {code ? <View style={row}>
        <Feather name="key" size={20} color={colors.mutedForeground} />
        <View><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Davet kodu</Text><Text selectable style={{ color: colors.foreground, fontWeight: '800', fontSize: 18, letterSpacing: 2 }}>{code}</Text></View>
      </View> : null}

      <View>
        <Text style={{ color: colors.mutedForeground, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 8 }}>{members.length} ÜYE</Text>
        {members.map((m) => <Pressable key={m.user_id} disabled={m.user_id === myId} onPress={() => startDm(m)} style={[row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colorOf(m.user_name), alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>{(m.user_name.trim()[0] ?? '?').toLocaleUpperCase('tr')}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 16 }}>{m.user_id === myId ? `${m.user_name} (Sen)` : m.user_name}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{m.user_id === owner ? 'Grubu kuran' : memberLabel(m, kind)}</Text>
          </View>
          {m.user_id !== myId ? <Feather name="message-circle" size={18} color={colors.primary} /> : null}
          {canManage && m.user_id !== myId ? <Pressable onPress={() => kick(m)} disabled={busy} hitSlop={8}><Text style={{ color: colors.destructive, fontWeight: '800' }}>Çıkar</Text></Pressable> : null}
        </Pressable>)}
      </View>

      <Pressable onPress={clearChat} disabled={busy} style={row}><Feather name="trash" size={20} color={colors.destructive} /><Text style={{ color: colors.destructive, fontWeight: '700', fontSize: 16 }}>Sohbeti temizle</Text></Pressable>
      <Pressable onPress={leave} disabled={busy || !myId} style={row}><Feather name="log-out" size={20} color={colors.destructive} /><Text style={{ color: colors.destructive, fontWeight: '700', fontSize: 16 }}>Gruptan ayrıl</Text></Pressable>
      {settings.role === 'teacher' && k === 'school' ? <Text style={{ color: colors.mutedForeground, fontSize: 12, paddingHorizontal: 16 }}>Okul grubunda öğretmenler yönetici sayılır: herkesin mesajını, mesaja basılı tutarak silebilirsin. Görevin (müdür, müdür yardımcısı) ve branşın üyeler listesinde görünür.</Text> : null}
    </ScrollView>
  </View>;
}

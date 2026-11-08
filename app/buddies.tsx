import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { Card, Field, Header, PrimaryButton, Screen, SectionTitle } from '@/components/PlanimUI';
import { usePlanim } from '@/context/PlanimContext';
import { BadgeDot, UserBadges } from '@/components/UserBadges';
import { useColors } from '@/hooks/useColors';
import { capPinned } from '@/lib/badges';
import { cloudConfigured } from '@/lib/cloud';
import { createRoom, joinRoom, ROOM_SIZES, RoomInvite, subscribeRoomInvites } from '@/lib/rooms';
import { acceptRequest, claimUsername, declineRequest, FriendRequest, myFriends, myProfile, Profile, publishWeekly, removeFriend, sendFriendRequest, subscribeIncoming, weekMinutesOf } from '@/lib/friends';

const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} sa ${m % 60} dk` : `${m} dk`);

/** Kullanıcı adı, arkadaş istekleri ve arkadaşlar arasında haftalık çalışma sıralaması. */
export default function BuddiesScreen() {
  const colors = useColors();
  const { settings, sessions, updateSettings } = usePlanim();
  const [me, setMe] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [roomInvites, setRoomInvites] = useState<RoomInvite[]>([]);
  /** Kurulmakta olan sınıf odası: masa sayısı, öğretmen izni, seçilen arkadaşlar. */
  const [draft, setDraft] = useState<{ cap: number; teacher: boolean; open: boolean; picked: string[] } | null>(null);
  const [uname, setUname] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const online = cloudConfigured() && settings.signedIn;
  const myMinutes = weekMinutesOf(sessions);

  const load = useCallback(async () => {
    if (!online) { setLoaded(true); return; }
    try {
      const p = await myProfile();
      setMe(p);
      if (p) { await publishWeekly(myMinutes).catch(() => undefined); setFriends(await myFriends()); }
    } catch (e) { Alert.alert('Yüklenemedi', e instanceof Error ? e.message : 'Tekrar dener misin?'); }
    setLoaded(true);
  }, [online, myMinutes]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!online) return undefined;
    let off: (() => void) | undefined; let alive = true;
    subscribeIncoming(setIncoming).then((u) => { if (alive) off = u; else u(); }).catch(() => undefined);
    return () => { alive = false; off?.(); };
  }, [online]);

  useEffect(() => {
    if (!online) return undefined;
    let off: (() => void) | undefined; let alive = true;
    subscribeRoomInvites(setRoomInvites, settings.role).then((u) => { if (alive) off = u; else u(); }).catch(() => undefined);
    return () => { alive = false; off?.(); };
  }, [online]);

  const study = (roomId: string, host: boolean) => router.push(`/study-mode?minutes=45&room=${roomId}${host ? '&host=1' : ''}` as never);
  const isTeacher = settings.role === 'teacher';
  /** Kurucunun seçebileceği arkadaş sayısı: kendisi bir masa tutar; öğretmen izni varsa ayrıca bir yer açılır. Öğretmen kuruyorsa tüm masalar öğrencinindir. */
  const maxPick = (cap: number, teacher: boolean) => (isTeacher ? cap : cap - 1 + (teacher ? 1 : 0));
  const openDraft = (p: Profile) => setDraft({ cap: 6, teacher: false, open: true, picked: [p.uid] });
  const startRoom = () => run(async () => {
    if (!draft) return;
    const { id, failed } = await createRoom(draft.picked, settings.studentName || me?.name || 'Arkadaşın', draft.cap, isTeacher || draft.teacher, draft.open);
    setDraft(null);
    if (failed) Alert.alert('Bazı arkadaşlar eklenemedi', `${failed} kişi odaya eklenemedi. Oda yine kuruldu; arkadaşların "Çalışma odası daveti" bölümünden kendisi de katılabilir.`);
    study(id, true);
  });

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) Alert.alert(ok); } catch (e) { Alert.alert('Olmadı', e instanceof Error ? e.message : 'Tekrar dener misin?'); } finally { setBusy(false); }
  };

  if (!online) return <Screen>
    <Header eyebrow="Birlikte daha güçlü" title="Arkadaşlar" subtitle="Kullanıcı adı seçmek ve arkadaş eklemek için hesapla giriş yapman gerekir." />
  </Screen>;

  const board = [{ uid: 'me', username: me?.username ?? '', name: 'Sen', weekMinutes: myMinutes }, ...friends].sort((a, b) => b.weekMinutes - a.weekMinutes);

  return <Screen>
    <Header eyebrow="Birlikte daha güçlü" title="Arkadaşlar" subtitle="Kullanıcı adınla arkadaş ekle, bu hafta kimin daha çok çalıştığını gör." />

    {!me && loaded ? <Card tone="lavender">
      <Text style={{ color: colors.foreground, fontWeight: '800' }}>Önce bir kullanıcı adı seç</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>Arkadaşların ve öğretmenin seni bu adla bulur. Küçük harf, rakam ve _ kullanabilirsin (3–20 karakter).</Text>
      <Field label="Kullanıcı adı" value={uname} onChangeText={setUname} placeholder="örn. elif_08" keyboardType="email" />
      <PrimaryButton label="Kullanıcı adını kaydet" icon="check" disabled={busy || !uname.trim()} onPress={() => run(async () => { await claimUsername(uname, settings.studentName); setUname(''); await load(); })} />
    </Card> : null}

    {me ? <>
      <Card>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '700' }}>KULLANICI ADIN</Text>
        <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: '800' }}>@{me.username}</Text>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, color: colors.foreground, fontWeight: '700' }}>Odada fotoğrafımı göster</Text>
          <Switch value={!settings.hideRoomPhoto} onValueChange={(v) => updateSettings({ hideRoomPhoto: !v })} />
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }}>Kapatırsan çalışma odasında fotoğrafın yerine adının baş harfi görünür.</Text>
      </Card>

      {draft ? <Card tone="lavender">
        <Text style={{ color: colors.foreground, fontWeight: '800', fontSize: 16 }}>Sınıf odası kur</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Kaç öğrencilik sınıf?</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {ROOM_SIZES.map((n) => <Pressable key={n} onPress={() => setDraft({ ...draft, cap: n, picked: draft.picked.slice(0, maxPick(n, draft.teacher)) })} style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: draft.cap === n ? colors.primary : colors.card }}>
            <Text style={{ color: draft.cap === n ? colors.primaryForeground : colors.foreground, fontWeight: '800' }}>{n} kişi</Text>
          </Pressable>)}
        </View>
        {!isTeacher ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, color: colors.foreground, fontWeight: '700' }}>Öğretmen katılabilir (ayrıca bir yer açılır)</Text>
          <Switch value={draft.teacher} onValueChange={(v) => setDraft({ ...draft, teacher: v, picked: draft.picked.slice(0, maxPick(draft.cap, v)) })} />
        </View> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, color: colors.foreground, fontWeight: '700' }}>Tüm arkadaşlarım odayı görüp katılabilsin</Text>
          <Switch value={draft.open} onValueChange={(v) => setDraft({ ...draft, open: v })} />
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>İstersen belli arkadaşlarını ayrıca davet et ({draft.picked.length}/{maxPick(draft.cap, draft.teacher)})</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {friends.map((f) => {
            const on = draft.picked.includes(f.uid);
            const full = !on && draft.picked.length >= maxPick(draft.cap, draft.teacher);
            return <Pressable key={f.uid} disabled={full} onPress={() => setDraft({ ...draft, picked: on ? draft.picked.filter((x) => x !== f.uid) : [...draft.picked, f.uid] })} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, opacity: full ? 0.4 : 1, backgroundColor: on ? colors.primary : colors.card }}>
              <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontWeight: '700' }}>{f.name || f.username}</Text>
            </Pressable>;
          })}
        </View>
        <PrimaryButton label="Odayı kur ve başla" icon="book-open" disabled={busy || (draft.picked.length === 0 && !draft.open)} onPress={startRoom} />
        <PrimaryButton label="Vazgeç" icon="x" secondary onPress={() => setDraft(null)} />
      </Card> : null}

      {roomInvites.length ? <SectionTitle title="Çalışma odası daveti" /> : null}
      {roomInvites.map((r) => <Card key={r.id} tone="lavender">
        <Text style={{ color: colors.foreground, fontWeight: '800' }}>{r.joined ? `${r.host_name} seni birlikte çalışmaya çağırıyor` : `${r.host_name} bir çalışma odası açtı`}</Text>
        {!r.joined ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{r.seats_left} boş yer var</Text> : null}
        <PrimaryButton label="Katıl ve çalışmaya başla" icon="book-open" disabled={busy} onPress={() => run(async () => { if (!r.joined) await joinRoom(r.id); study(r.id, false); })} />
      </Card>)}

      {incoming.length ? <SectionTitle title="Gelen istekler" /> : null}
      {incoming.map((r) => <Card key={r.id} tone="pink">
        <Text style={{ color: colors.foreground, fontWeight: '800' }}>{r.from_name || r.from_username} (@{r.from_username}) sana arkadaşlık isteği gönderdi</Text>
        <PrimaryButton label="Kabul et" icon="check" disabled={busy} onPress={() => run(async () => { await acceptRequest(r); await load(); })} />
        <PrimaryButton label="Reddet" icon="x" secondary disabled={busy} onPress={() => run(() => declineRequest(r.id))} />
      </Card>)}

      <SectionTitle title="Arkadaş ekle" />
      <Card>
        <Field label="Arkadaşının kullanıcı adı" value={target} onChangeText={setTarget} placeholder="örn. ahmet_34" keyboardType="email" />
        <PrimaryButton label="İstek gönder" icon="user-plus" disabled={busy || !target.trim()} onPress={() => run(async () => { await sendFriendRequest(target, settings.studentName); setTarget(''); }, 'İstek gönderildi. Kabul edince arkadaş olursunuz.')} />
      </Card>

      <SectionTitle title="Bu haftanın sıralaması" />
      {friends.length === 0 ? <Text style={{ color: colors.mutedForeground }}>Henüz arkadaşın yok. Kullanıcı adıyla istek gönder; kabul edince sıralamada görünür.</Text> : null}
      <Card>
        {board.map((p, i) => <View key={p.uid} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
          <Text style={{ width: 24, color: i === 0 ? colors.warning : colors.mutedForeground, fontWeight: '800', fontSize: 16 }}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: p.uid === 'me' ? '800' : '700' }}>{p.uid === 'me' ? 'Sen' : p.name || p.username}</Text>
            {p.uid !== 'me' && p.username ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>@{p.username}</Text> : null}
            {p.uid !== 'me' ? <UserBadges uid={p.uid} size={16} /> : <View style={{ flexDirection: 'row', gap: 4 }}>{capPinned(settings.pinnedBadges ?? []).map((id) => <BadgeDot key={id} id={id} size={16} />)}</View>}
          </View>
          <Text style={{ color: colors.foreground, fontWeight: '800' }}>{fmt(p.weekMinutes)}</Text>
          {p.uid !== 'me' ? <Pressable hitSlop={8} disabled={busy} onPress={() => openDraft(p)}><Feather name="book-open" size={17} color={colors.primary} /></Pressable> : null}
          {p.uid !== 'me' ? <Pressable hitSlop={8} onPress={() => Alert.alert('Arkadaşlıktan çıkarılsın mı?', p.name || p.username, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Çıkar', style: 'destructive', onPress: () => run(async () => { await removeFriend(p.uid); await load(); }) }])}><Feather name="user-x" size={16} color={colors.mutedForeground} /></Pressable> : null}
        </View>)}
      </Card>
      <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 16 }}>Kitap simgesi sınıf odası kurar: masa sayısını seçer, arkadaşlarını (istersen öğretmeni) davet edersin; odada profil fotoğrafın görünür, kapatabilirsin. Sıralama pazartesiden başlar. Arkadaşların senin adını ve bu haftaki toplam çalışma süreni görür; başka bir şey görmezler.</Text>
    </> : null}
  </Screen>;
}

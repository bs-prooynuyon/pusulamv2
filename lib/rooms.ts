import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from '@react-native-firebase/firestore';
import { getUserId } from '@/lib/cloud';
import { myFriends } from '@/lib/friends';
import { db } from '@/lib/firebase';

/**
 * Birlikte çalışma odası. İki arkadaş aynı anda çalışma modundayken birbirinin durumunu görür.
 * rooms/{id} → { uids, hostUid, hostName, status }, rooms/{id}/presence/{uid} → { name, state, updatedAt }.
 * Oda yalnızca kabul edilmiş arkadaşlar arasında açılabilir (firestore.rules).
 */
const now = () => new Date().toISOString();
const ROOM_TTL = 3 * 3600000;
const STALE = 90000;

export interface RoomInvite { id: string; host_name: string; /** true: zaten odadayım; false: arkadaşımın açık odası, katılabilirim */ joined: boolean; seats_left: number }
export interface RoomInfo { capacity: number; allowTeacher: boolean; hostUid: string }
export type RoomRole = 'student' | 'teacher';
export interface Mate { uid: string; name: string; state: 'studying' | 'break' | 'left'; fresh: boolean; role: RoomRole }
/** Sınıfa seçilebilecek öğrenci sayıları (masa sayısı). */
export const ROOM_SIZES = [4, 6, 8];

/**
 * Sınıf odası kurar. capacity: öğrenci masası sayısı (4/6/8), allowTeacher: öğretmen için ayrıca bir yer açılır,
 * openToFriends: arkadaşların hepsi odayı görüp boş yer varsa kendisi katılabilir (oda dolu olmak zorunda değil).
 * Seçilen arkadaşlar ayrıca davet edilir; biri eklenemezse oda yine kurulur, eklenemeyenlerin sayısı döner.
 */
export async function createRoom(friendUids: string[], hostName: string, capacity: number, allowTeacher: boolean, openToFriends: boolean): Promise<{ id: string; failed: number }> {
  const uid = await getUserId();
  const size = ROOM_SIZES.includes(capacity) ? capacity : 6;
  const ref = doc(collection(db(), 'rooms'));
  try { await setDoc(ref, { uids: [uid], hostUid: uid, hostName: hostName.slice(0, 40), status: 'open', createdAt: now(), capacity: size, allowTeacher, openToFriends }); } catch (e) {
    throw new Error(`Oda açılamadı (${(e as { code?: string })?.code ?? 'hata'}). Firestore kuralları son sürümle yayınlandı mı?`);
  }
  const members = [uid];
  let failed = 0;
  for (const f of friendUids.slice(0, size)) {
    try { await updateDoc(ref, { uids: [...members, f] }); members.push(f); } catch { failed += 1; }
  }
  return { id: ref.id, failed };
}

/** Arkadaşımın açık odasına kendim katılırım (boş yer yoksa ya da oda kapandıysa hata verir). */
export async function joinRoom(roomId: string): Promise<void> {
  const uid = await getUserId();
  const ref = doc(db(), 'rooms', roomId);
  const r = (await getDoc(ref)).data() as { uids?: string[]; capacity?: number; allowTeacher?: boolean; status?: string } | undefined;
  if (!r || r.status !== 'open') throw new Error('Bu oda artık açık değil.');
  const uids = r.uids ?? [];
  if (uids.includes(uid)) return;
  if (uids.length >= Number(r.capacity ?? 6) + (r.allowTeacher ? 1 : 0)) throw new Error('Oda dolu.');
  try { await updateDoc(ref, { uids: [...uids, uid] }); } catch { throw new Error('Katılamadın: oda dolmuş ya da değişmiş olabilir, tekrar dene.'); }
}

export async function getRoomInfo(roomId: string): Promise<RoomInfo | null> {
  const d = (await getDoc(doc(db(), 'rooms', roomId))).data() as { capacity?: number; allowTeacher?: boolean; hostUid?: string } | undefined;
  if (!d) return null;
  return { capacity: ROOM_SIZES.includes(Number(d.capacity)) ? Number(d.capacity) : 6, allowTeacher: !!d.allowTeacher, hostUid: String(d.hostUid ?? '') };
}

/** Bana gelen açık oda davetleri (3 saatten eski ve kapanmış odalar sayılmaz). */
type RoomDoc = { status?: string; hostUid?: string; hostName?: string; createdAt?: string; allowTeacher?: boolean; openToFriends?: boolean; capacity?: number; uids?: string[] };

/**
 * Bana açılan odalar: davet edildiklerim + arkadaşlarımın "arkadaşlarıma göster" açık, boş yeri olan odaları.
 * Arkadaş odalarını okuyamazsam (kural/bağlantı) o kısım sessizce atlanır, davetler yine çalışır.
 */
export async function subscribeRoomInvites(onData: (r: RoomInvite[]) => void, role?: string): Promise<() => void> {
  const uid = await getUserId();
  const mine = new Map<string, RoomDoc>();
  const open = new Map<string, Map<string, RoomDoc>>();
  const emit = () => {
    const all = new Map<string, { joined: boolean; r: RoomDoc }>();
    open.forEach((m) => m.forEach((r, id) => { if (r.openToFriends) all.set(id, { joined: false, r }); }));
    mine.forEach((r, id) => all.set(id, { joined: true, r }));
    onData([...all.entries()]
      .filter(([, v]) => !(role === 'teacher' && !v.r.allowTeacher)) // öğretmene kapalı odalar öğretmene gösterilmez
      .filter(([, v]) => v.r.status === 'open' && v.r.hostUid !== uid && Date.now() - new Date(v.r.createdAt ?? 0).getTime() < ROOM_TTL)
      .map(([id, v]) => ({ id, host_name: v.r.hostName ?? 'Arkadaşın', joined: v.joined, seats_left: Number(v.r.capacity ?? 6) + (v.r.allowTeacher ? 1 : 0) - (v.r.uids?.length ?? 0) }))
      .filter((x) => x.joined || x.seats_left > 0));
  };
  const offs: (() => void)[] = [onSnapshot(query(collection(db(), 'rooms'), where('uids', 'array-contains', uid)),
    (snap) => { mine.clear(); snap.docs.forEach((d) => mine.set(d.id, d.data() as RoomDoc)); emit(); },
    () => { mine.clear(); emit(); })];
  try {
    const friends = (await myFriends()).slice(0, 25);
    friends.forEach((f) => offs.push(onSnapshot(query(collection(db(), 'rooms'), where('hostUid', '==', f.uid)),
      (snap) => { const m = new Map<string, RoomDoc>(); snap.docs.forEach((d) => m.set(d.id, d.data() as RoomDoc)); open.set(f.uid, m); emit(); },
      () => { open.delete(f.uid); emit(); })));
  } catch { /* arkadaş listesi alınamadı: yalnızca davetler gösterilir */ }
  return () => offs.forEach((o) => o());
}

export const closeRoom = (roomId: string) => updateDoc(doc(db(), 'rooms', roomId), { status: 'closed' });

export async function publishPresence(roomId: string, name: string, state: 'studying' | 'break' | 'left', role: RoomRole = 'student') {
  const uid = await getUserId();
  await setDoc(doc(db(), 'rooms', roomId, 'presence', uid), { name: name.slice(0, 40), state, role, updatedAt: Date.now() });
}

/** Odadaki diğer kişilerin durumunu canlı dinler. */
export async function subscribePresence(roomId: string, onData: (m: Mate[]) => void): Promise<() => void> {
  const uid = await getUserId();
  return onSnapshot(collection(db(), 'rooms', roomId, 'presence'),
    (snap) => onData(snap.docs.filter((d) => d.id !== uid).map((d) => {
      const r = d.data();
      return { uid: d.id, name: String(r.name ?? 'Arkadaşın'), state: (r.state === 'break' || r.state === 'left') ? r.state as 'break' | 'left' : 'studying' as const, fresh: Date.now() - Number(r.updatedAt ?? 0) < STALE, role: (r.role === 'teacher' ? 'teacher' : 'student') as RoomRole };
    })),
    () => onData([]));
}

/** Profil fotoğrafını (küçük base64) odaya bir kez yazar; yalnızca odadakiler görür, oda silinince silinir. */
export async function publishPhoto(roomId: string, photo: string) {
  if (!photo || photo.length > 350000) return;
  const uid = await getUserId();
  await setDoc(doc(db(), 'rooms', roomId, 'photos', uid), { photo, updatedAt: Date.now() });
}

/** Odadaki kişilerin fotoğrafları: { uid: base64 }. */
export async function subscribePhotos(roomId: string, onData: (p: Record<string, string>) => void): Promise<() => void> {
  return onSnapshot(collection(db(), 'rooms', roomId, 'photos'),
    (snap) => {
      const out: Record<string, string> = {};
      snap.docs.forEach((d) => { const v = d.data().photo; if (typeof v === 'string') out[d.id] = v; });
      onData(out);
    },
    () => onData({}));
}

/** Odayı ve altındaki durum kayıtlarını, fotoğrafları siler. */
async function deleteRoomFully(roomId: string) {
  for (const sub of ['presence', 'photos']) {
    const snap = await getDocs(collection(db(), 'rooms', roomId, sub));
    await Promise.all(snap.docs.map((x) => deleteDoc(x.ref)));
  }
  await deleteDoc(doc(db(), 'rooms', roomId));
}

export async function leaveRoom(roomId: string, name: string, isHost: boolean) {
  try { await publishPresence(roomId, name, 'left'); } catch { /* yoksay */ }
  if (isHost) { try { await closeRoom(roomId); } catch { /* yoksay */ } }
  // Odada çalışmaya devam eden başka kimse kalmadıysa oda ve içindeki durum kayıtları sunucudan silinir (yer kaplamasın).
  try {
    const uid = await getUserId();
    const snap = await getDocs(collection(db(), 'rooms', roomId, 'presence'));
    const othersActive = snap.docs.some((d) => d.id !== uid && d.data().state !== 'left' && Date.now() - Number(d.data().updatedAt ?? 0) < STALE);
    // Kendi fotoğrafımı odadan hemen kaldır (oda başkaları için açık kalsa bile).
    try { await deleteDoc(doc(db(), 'rooms', roomId, 'photos', uid)); } catch { /* yoksay */ }
    if (othersActive) return;
    await deleteRoomFully(roomId);
  } catch { /* silinemezse bir sonraki açılışta cleanupRooms siler */ }
}
export async function roomHasMembers(roomId: string) { return (await getDocs(collection(db(), 'rooms', roomId, 'presence'))).size; }

/** Kapanmış ya da 3 saatten eski odaları (ve içindeki durum kayıtlarını) siler. Uygulama açılırken çağrılır. */
export async function cleanupRooms() {
  const uid = await getUserId();
  const snap = await getDocs(query(collection(db(), 'rooms'), where('uids', 'array-contains', uid)));
  for (const d of snap.docs) {
    const r = d.data() as { status?: string; createdAt?: string };
    const old = Date.now() - new Date(r.createdAt ?? 0).getTime() >= ROOM_TTL;
    if (r.status !== 'closed' && !old) continue;
    try {
      await deleteRoomFully(d.id);
    } catch { /* yetki ya da bağlantı yoksa sonraki açılışta tekrar denenir */ }
  }
}

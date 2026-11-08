import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where, writeBatch } from '@react-native-firebase/firestore';
import { InviteRow, joinClass, removeInvite } from '@/lib/classes';
import { getUserId } from '@/lib/cloud';
import { db } from '@/lib/firebase';

export interface Group { id: string; kind: 'class' | 'school' | 'student' | 'dm'; name: string; code: string | null; owner_id: string | null }
export interface Msg { id: string; group_id: string; sender_id: string; sender_name: string; body: string; created_at: string }
export interface GMember { group_id: string; user_id: string; user_name: string; role: 'teacher' | 'student' | ''; /** öğretmenin görevi (Müdür, Müdür Yardımcısı…) */ title: string; /** öğretmenin branşı */ branch: string }

export const KIND_LABEL: Record<Group['kind'], string> = { class: 'Sınıf grubu', school: 'Okul grubu', student: 'Öğrenci grubu', dm: 'Birebir sohbet' };

/** Okul adını yazım farklarından arındırır: "Atatürk Ortaokulu" ve "ataturk  ortaokulu" aynı grup olsun. */
export const schoolKey = (city: string, district: string, school: string) => [city, district, school].map((s) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]/g, '')).join('|');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const now = () => new Date().toISOString();

/** Hata hangi adımda olduğunu söylesin: "[üyelik kontrolü] permission-denied" gibi. */
const at = async <T,>(label: string, p: Promise<T>): Promise<T> => {
  try { return await p; } catch (e) { throw new Error(`[${label}] ${(e as { code?: string })?.code ?? (e instanceof Error ? e.message : 'hata')}`); }
};

/** Yeni üyelik kayıtlarına yazılır: gruplarda üyenin yanında "öğretmen / öğrenci" görünsün. */
let curRole: 'teacher' | 'student' | '' = '';
/** Öğretmenin görevi ve branşı: yeni üyelik kayıtlarına yazılır (öğrenci boş bırakır). */
let curBranch = '';
let curTitle = '';
const card = () => (curRole === 'teacher' ? { title: curTitle, branch: curBranch } : {});
export const setMyCard = (branch: string, title: string) => { curBranch = branch; curTitle = title; };

export async function syncRole(role: string, name: string, branch = '', title = '') {
  const uid = await getUserId();
  curRole = role === 'teacher' ? 'teacher' : role === 'student' ? 'student' : '';
  setMyCard(branch, title);
  await setDoc(doc(db(), 'users', uid), { role, name, ...(curRole === 'teacher' ? { branch, title } : {}) }, { merge: true });
  // Eski üyelik kayıtlarında rol yok; kendi kayıtlarımı bir kez tamamla (kural yüklenmediyse sessizce atlanır).
  if (!curRole) return;
  try {
    const mine = await getDocs(query(collection(db(), 'groupMembers'), where('userId', '==', uid)));
    await Promise.all(mine.docs.filter((d) => d.data().role !== curRole).map((d) => updateDoc(d.ref, { role: curRole }).catch(() => undefined)));
  } catch { /* yoksay */ }
}

interface MemberDoc { groupId: string; userId: string; userName: string; kind: Group['kind']; name: string; code: string | null; ownerId: string | null; joinedAt: string; role?: string | null; title?: string; branch?: string }

export async function myGroups(): Promise<Group[]> {
  const uid = await getUserId();
  const snap = await at('grupları yükleme', getDocs(query(collection(db(), 'groupMembers'), where('userId', '==', uid))));
  return snap.docs.map((d) => d.data() as MemberDoc)
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    .map((m) => ({ id: m.groupId, kind: m.kind, name: m.name, code: m.code ?? null, owner_id: m.ownerId ?? null }));
}

export async function createGroup(name: string, userName: string, asKind?: 'dm'): Promise<string> {
  const uid = await getUserId();
  const profile = await getDoc(doc(db(), 'users', uid));
  const kind: Group['kind'] = asKind ?? (profile.data()?.role === 'teacher' ? 'class' : 'student');
  const gid = doc(collection(db(), 'groups')).id;
  const title = name.slice(0, 60);
  let lastError: unknown;
  for (let i = 0; i < 5; i += 1) {
    const code = makeCode();
    const batch = writeBatch(db());
    batch.set(doc(db(), 'groups', gid), { kind, name: title, code, ownerId: uid, schoolKey: null, createdAt: now() });
    batch.set(doc(db(), 'groupCodes', code), { groupId: gid, name: title, kind, ownerId: uid });
    batch.set(doc(db(), 'groupMembers', `${gid}_${uid}`), { groupId: gid, userId: uid, userName, kind, name: title, code, ownerId: uid, joinedAt: now(), role: curRole || null, ...card() } satisfies MemberDoc);
    try { await at('grup kurma', batch.commit()); return gid; } catch (e) { lastError = e; }
  }
  throw lastError instanceof Error ? lastError : new Error('Grup kurulamadı. Tekrar dener misin?');
}

export async function joinGroup(code: string, userName: string): Promise<string> {
  const uid = await getUserId();
  const c = code.trim().toUpperCase();
  const found = await at('kod arama', getDoc(doc(db(), 'groupCodes', c)));
  if (!found.exists()) throw new Error('Grup kodu bulunamadı');
  const g = found.data() as { groupId: string; name: string; kind: Group['kind']; ownerId: string | null };
  const ref = doc(db(), 'groupMembers', `${g.groupId}_${uid}`);
  if ((await at('üyelik kontrolü', getDoc(ref))).exists()) return g.groupId;
  if (g.kind === 'dm') {
    const inside = await at('birebir üye sayımı', getDocs(query(collection(db(), 'groupMembers'), where('groupId', '==', g.groupId))));
    if (inside.size >= 2) throw new Error('Bu birebir sohbet dolu.');
  }
  await at('gruba katılma', setDoc(ref, { groupId: g.groupId, userId: uid, userName, kind: g.kind, name: g.name, code: c, ownerId: g.ownerId ?? null, joinedAt: now(), role: curRole || null, ...card() } satisfies MemberDoc));
  return g.groupId;
}

export async function joinSchoolGroup(key: string, name: string, userName: string): Promise<string> {
  const uid = await getUserId();
  const gid = `school_${key.replace(/[^a-z0-9|]/g, '').replace(/\|/g, '_')}`;
  const title = name.slice(0, 80);
  const ref = doc(db(), 'groupMembers', `${gid}_${uid}`);
  if ((await at('okul üyelik kontrolü', getDoc(ref))).exists()) return gid;
  const batch = writeBatch(db());
  if (!(await at('okul grubu kontrolü', getDoc(doc(db(), 'groups', gid)))).exists()) batch.set(doc(db(), 'groups', gid), { kind: 'school', name: title, code: null, ownerId: null, schoolKey: key, createdAt: now() });
  batch.set(ref, { groupId: gid, userId: uid, userName, kind: 'school', name: title, code: null, ownerId: null, joinedAt: now(), role: curRole || null, ...card() } satisfies MemberDoc);
  try { await batch.commit(); } catch {
    // İki kişi aynı anda ilk kez girerse biri çakışır; bir kez daha dene.
    await at('okul grubuna katılma', setDoc(ref, { groupId: gid, userId: uid, userName, kind: 'school', name: title, code: null, ownerId: null, joinedAt: now(), role: curRole || null, ...card() } satisfies MemberDoc));
  }
  return gid;
}

/**
 * Gruptan ayrılır / çıkarılır. Sınıf grubunun kimliği sınıf kimliğiyle aynıdır; bu yüzden
 * sınıf üyeliği de silinir ve öğretmenin öğrenci takibi o öğrenci için sona erer.
 */
export const leaveGroup = async (groupId: string, userId: string, kind?: Group['kind']) => {
  await deleteDoc(doc(db(), 'groupMembers', `${groupId}_${userId}`));
  if (kind === 'class') { try { await deleteDoc(doc(db(), 'members', `${groupId}_${userId}`)); } catch { /* sınıf üyeliği zaten yok */ } }
};

export async function groupMembers(groupId: string): Promise<GMember[]> {
  const snap = await getDocs(query(collection(db(), 'groupMembers'), where('groupId', '==', groupId)));
  return snap.docs.map((d) => { const m = d.data() as MemberDoc; return { group_id: m.groupId, user_id: m.userId, user_name: m.userName, role: m.role === 'teacher' ? 'teacher' as const : m.role === 'student' ? 'student' as const : '' as const, title: m.title ?? '', branch: m.branch ?? '' }; });
}

const toMsg = (groupId: string, id: string, d: Record<string, unknown>): Msg => ({ id, group_id: groupId, sender_id: String(d.senderId ?? ''), sender_name: String(d.senderName ?? ''), body: String(d.body ?? ''), created_at: String(d.createdAt ?? now()) });

/** Mesajları canlı dinler: yalnızca yeni mesajlar okunur (kota dostu). Dönen fonksiyon dinlemeyi bırakır. */
export function subscribeMessages(groupId: string, onData: (messages: Msg[]) => void, onError?: (e: unknown) => void) {
  const q = query(collection(db(), 'groups', groupId, 'messages'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => toMsg(groupId, d.id, d.data())).reverse()), (e) => onError?.(e));
}

export async function sendMessage(groupId: string, senderId: string, senderName: string, body: string) {
  await at('mesaj gönderme', addDoc(collection(db(), 'groups', groupId, 'messages'), { senderId, senderName, body, createdAt: now() }));
}
export const deleteMessage = (m: Msg) => deleteDoc(doc(db(), 'groups', m.group_id, 'messages', m.id));

export interface ReportRow { id: string; message_id: string | null; sender_name: string | null; body: string | null; reason: string; created_at: string }
export const REPORT_REASONS = ['Hakaret / zorbalık', 'Uygunsuz içerik', 'Spam / reklam', 'Diğer'];
/**
 * Şikayet iki yere yazılır: grubun kendi listesine (grubu kuran görür) ve tek bir `reports` koleksiyonuna.
 * Uygulama yöneticisi Firebase > Firestore > `reports` koleksiyonunda tüm şikayetleri tek yerden görür.
 */
export async function reportMessage(m: Msg, reporterId: string, reason: string, groupName = '') {
  const data = { messageId: m.id, groupId: m.group_id, groupName, reporterId, senderId: m.sender_id, senderName: m.sender_name, body: m.body.slice(0, 500), reason, createdAt: now() };
  const batch = writeBatch(db());
  batch.set(doc(collection(db(), 'groups', m.group_id, 'reports')), data);
  batch.set(doc(collection(db(), 'reports')), data);
  await batch.commit();
}
/** Yalnızca grubu kuran kişi okuyabilir (Firestore kuralı); diğerleri için hata verir. */
export async function groupReports(groupId: string): Promise<ReportRow[]> {
  const snap = await getDocs(query(collection(db(), 'groups', groupId, 'reports'), orderBy('createdAt', 'desc'), limit(30)));
  return snap.docs.map((d) => { const r = d.data(); return { id: d.id, message_id: r.messageId ?? null, sender_name: r.senderName ?? null, body: r.body ?? null, reason: String(r.reason), created_at: String(r.createdAt) }; });
}
export const sendFeedback = (userId: string, category: string, body: string) => addDoc(collection(db(), 'feedback'), { userId, category, body, createdAt: now() });

export interface BlockRow { blocked_id: string; blocked_name: string | null }
export async function myBlocks(): Promise<BlockRow[]> {
  const uid = await getUserId();
  const snap = await getDocs(collection(db(), 'users', uid, 'blocks'));
  return snap.docs.map((d) => ({ blocked_id: d.id, blocked_name: (d.data().blockedName as string) ?? null }));
}
export const blockUser = (blockerId: string, userId: string, name: string) => setDoc(doc(db(), 'users', blockerId, 'blocks', userId), { blockedName: name, createdAt: now() });
export const unblockUser = async (blockerId: string, userId: string) => { await deleteDoc(doc(db(), 'users', blockerId, 'blocks', userId)); };

// ----- Sınıf = sohbet grubu. Öğretmen sınıf kurunca arka planda hem sınıf (takip, rapor, program) hem sohbet grubu oluşur; ikisi aynı kodu ve aynı kimliği taşır. -----

/** Öğretmen: sınıf + sohbet grubunu tek seferde kurar. Dönen değer sınıfın (ve sohbet grubunun) kimliğidir. */
export async function createClassGroup(name: string, teacherName: string): Promise<string> {
  const uid = await getUserId();
  const id = doc(collection(db(), 'groups')).id;
  const title = name.slice(0, 60);
  let lastError: unknown;
  for (let i = 0; i < 5; i += 1) {
    const code = makeCode();
    const batch = writeBatch(db());
    batch.set(doc(db(), 'classes', id), { teacherId: uid, name: title, code, createdAt: now() });
    batch.set(doc(db(), 'classCodes', code), { classId: id, name: title, teacherId: uid });
    batch.set(doc(db(), 'groups', id), { kind: 'class', name: title, code, ownerId: uid, schoolKey: null, createdAt: now() });
    batch.set(doc(db(), 'groupCodes', code), { groupId: id, name: title, kind: 'class', ownerId: uid });
    batch.set(doc(db(), 'groupMembers', `${id}_${uid}`), { groupId: id, userId: uid, userName: teacherName, kind: 'class', name: title, code, ownerId: uid, joinedAt: now(), role: curRole || null, ...card() } satisfies MemberDoc);
    try { await at('sınıf kurma', batch.commit()); return id; } catch (e) { lastError = e; }
  }
  throw lastError instanceof Error ? lastError : new Error('Sınıf kurulamadı. Tekrar dener misin?');
}

/** Öğrenci: tek kodla hem sohbet grubuna hem (varsa) sınıfa girer. Okul / öğrenci grubu / birebir kodları da buradan çalışır. */
export async function joinByCode(code: string, userName: string): Promise<string> {
  const c = code.trim().toUpperCase();
  const [g, k] = await Promise.all([
    at('kod arama', getDoc(doc(db(), 'groupCodes', c))),
    at('sınıf kodu arama', getDoc(doc(db(), 'classCodes', c))),
  ]);
  if (!g.exists() && !k.exists()) throw new Error('Kod bulunamadı');
  // Aynı kod hem bir gruba hem başka bir sınıfa aitse (çok düşük ihtimal) yalnızca gruba katıl.
  const sameClass = k.exists() && (!g.exists() || (g.data() as { groupId: string }).groupId === (k.data() as { classId: string }).classId);
  let gid = g.exists() ? await joinGroup(c, userName) : '';
  if (sameClass) { const cid = await joinClass(c, userName); gid = gid || cid; }
  return gid;
}

/** Öğrenci: e-posta davetini kabul eder; sınıfa ve sınıf sohbetine birlikte girer. */
export async function acceptInvite(inv: InviteRow, userName: string) {
  await joinByCode(inv.code, userName);
  await removeInvite(inv.id);
}

/**
 * Eski sürümde kurulmuş sınıfların sohbet grubu yoktur. Öğretmen sohbeti açınca eksik gruplar, sınıfın kendi kodu ve kimliğiyle
 * tamamlanır. Sınıf başına tek okuma yapılır; grubu olanlara dokunulmaz.
 */
export async function ensureClassGroups(teacherName: string) {
  const uid = await getUserId();
  const mine = await getDocs(query(collection(db(), 'classes'), where('teacherId', '==', uid)));
  for (const d of mine.docs) {
    const c = d.data() as { name: string; code: string };
    try {
      if ((await getDoc(doc(db(), 'groupMembers', `${d.id}_${uid}`))).exists()) continue;
      const batch = writeBatch(db());
      batch.set(doc(db(), 'groups', d.id), { kind: 'class', name: c.name, code: c.code, ownerId: uid, schoolKey: null, createdAt: now() });
      batch.set(doc(db(), 'groupCodes', c.code), { groupId: d.id, name: c.name, kind: 'class', ownerId: uid });
      batch.set(doc(db(), 'groupMembers', `${d.id}_${uid}`), { groupId: d.id, userId: uid, userName: teacherName, kind: 'class', name: c.name, code: c.code, ownerId: uid, joinedAt: now(), role: curRole || null, ...card() } satisfies MemberDoc);
      await batch.commit();
    } catch { /* bu sınıf şimdilik atlanır; sohbet açılışında yeniden denenir */ }
  }
}

/** Öğrenci: katıldığı sınıfların sohbet grubuna henüz girmediyse (eski sınıflar) girer. Grup henüz kurulmadıysa sessizce geçer. */
export async function syncClassGroups(userName: string) {
  const uid = await getUserId();
  const joined = await getDocs(query(collection(db(), 'members'), where('studentId', '==', uid)));
  for (const d of joined.docs) {
    const m = d.data() as { classId: string; className: string; code: string; teacherId: string };
    try {
      const ref = doc(db(), 'groupMembers', `${m.classId}_${uid}`);
      if ((await getDoc(ref)).exists()) continue;
      const gc = await getDoc(doc(db(), 'groupCodes', m.code));
      if (!gc.exists() || (gc.data() as { groupId: string }).groupId !== m.classId) continue;
      await setDoc(ref, { groupId: m.classId, userId: uid, userName, kind: 'class', name: m.className, code: m.code, ownerId: m.teacherId, joinedAt: now(), role: curRole || null, ...card() } satisfies MemberDoc);
    } catch { /* sohbet grubu henüz yok ya da kural izin vermedi; bir sonraki açılışta yeniden denenir */ }
  }
}

// ----- Grup bilgisi: ad, fotoğraf, sohbeti kendimden temizleme -----
export interface GroupInfo { name: string; photo: string }
export async function getGroupInfo(groupId: string): Promise<GroupInfo | null> {
  const d = (await getDoc(doc(db(), 'groups', groupId))).data() as { name?: string; photo?: string } | undefined;
  return d ? { name: String(d.name ?? ''), photo: typeof d.photo === 'string' ? d.photo : '' } : null;
}

/**
 * Grubu kuran adı değiştirir. Ad grubun kendisine, üyelik kayıtlarına (sohbet listesi) ve davet koduna yazılır;
 * sınıf grubunda sınıfın adı da güncellenir. Öğrencilerin sınıf kayıtlarındaki eski ad bir sonraki katılışta yenilenir.
 */
export async function renameGroup(g: { id: string; kind: Group['kind']; code: string | null }, newName: string): Promise<string> {
  const title = newName.trim().slice(0, 60);
  if (!title) throw new Error('Grup adı boş olamaz.');
  const members = await at('üyeleri okuma', getDocs(query(collection(db(), 'groupMembers'), where('groupId', '==', g.id))));
  const batch = writeBatch(db());
  batch.update(doc(db(), 'groups', g.id), { name: title });
  members.docs.forEach((d) => batch.update(d.ref, { name: title }));
  if (g.code) batch.update(doc(db(), 'groupCodes', g.code), { name: title });
  await at('grup adını değiştirme', batch.commit());
  if (g.kind === 'class') {
    try {
      const b2 = writeBatch(db());
      b2.update(doc(db(), 'classes', g.id), { name: title });
      if (g.code) b2.update(doc(db(), 'classCodes', g.code), { name: title });
      await b2.commit();
    } catch { /* sınıf kaydı güncellenemedi; sohbet adı yine de değişti */ }
  }
  return title;
}

/** Grup fotoğrafı (küçük base64). Boş metin fotoğrafı kaldırır. */
export async function setGroupPhoto(groupId: string, photo: string) {
  if (photo.length > 380000) throw new Error('Fotoğraf çok büyük, daha küçük bir tane seç.');
  await at('grup fotoğrafı', updateDoc(doc(db(), 'groups', groupId), { photo }));
}

const clearKey = (groupId: string) => `pusulam_chatclear_${groupId}`;
/** "Sohbeti temizle": yalnızca bu telefonda, bu andan önceki mesajlar gizlenir; başkalarında ve sunucuda mesajlar durur. */
export const clearChatForMe = (groupId: string) => AsyncStorage.setItem(clearKey(groupId), now());
export const getClearedAt = async (groupId: string) => (await AsyncStorage.getItem(clearKey(groupId))) ?? '';

/**
 * Adım, branşın ya da görevin değişince sunucudaki kayıtlarını günceller: profil (mesajlardaki ad buradan okunur), sohbet üyelikleri
 * (üye listesi, birebir sohbet başlığı, öğretmen etiketi) ve sınıf üyelikleri. Eski mesajların kendi metni değişmez; ekranda güncel ad gösterilir
 * (components/UserBadges.tsx LiveName).
 */
export async function syncMyName(name: string, branch = '', title = '') {
  const n = name.trim().slice(0, 40);
  if (!n) return;
  setMyCard(branch, title);
  const uid = await getUserId();
  await setDoc(doc(db(), 'profiles', uid), { name: n, ...(curRole === 'teacher' ? { branch, title } : {}) }, { merge: true });
  const mine = await getDocs(query(collection(db(), 'groupMembers'), where('userId', '==', uid)));
  for (const d of mine.docs) {
    const m = d.data() as MemberDoc;
    const patch: Record<string, string> = {};
    if (m.userName !== n) patch.userName = n;
    if (curRole === 'teacher') { if ((m.title ?? '') !== title) patch.title = title; if ((m.branch ?? '') !== branch) patch.branch = branch; }
    if (Object.keys(patch).length) { try { await updateDoc(d.ref, patch); } catch { /* kurallar henüz yayınlanmadıysa atlanır */ } }
  }
  const cls = await getDocs(query(collection(db(), 'members'), where('studentId', '==', uid)));
  for (const d of cls.docs) { if ((d.data() as { studentName?: string }).studentName !== n) { try { await updateDoc(d.ref, { studentName: n }); } catch { /* kurallar henüz yayınlanmadıysa atlanır */ } } }
}

/** Üyenin yanında görünen etiket: öğretmen için görev ve branş (okul grubunda "Yönetici"), öğrenci için "öğrenci". */
export function memberLabel(m: Pick<GMember, 'role' | 'title' | 'branch'>, kind?: string, teacherRow = false) {
  if (m.role === 'teacher' || teacherRow) return [kind === 'school' ? 'Yönetici' : '', m.title || 'Öğretmen', m.branch].filter(Boolean).join(' · ');
  return m.role === 'student' ? 'öğrenci' : '';
}

/** İki kişi arasındaki birebir sohbetin sabit kimliği: aynı iki kişi için hep aynı sohbet açılır. */
const dmId = (a: string, b: string) => `dm_${[a, b].sort().join('_')}`;

/**
 * Bir kişiyle birebir sohbeti açar (yoksa kurar) ve ekrana gidecek bilgileri döndürür. İki tarafın üyelik kaydı birlikte yazılır;
 * karşı taraf sohbeti kendi listesinde görür. Başkasının adı o an elimizdeki addır, kendisi uygulamayı açınca güncellenir.
 */
export async function openDm(otherId: string, otherName: string, myName: string): Promise<{ id: string; title: string }> {
  const me = await getUserId();
  if (otherId === me) throw new Error('Kendinle sohbet açamazsın.');
  const gid = dmId(me, otherId);
  const title = otherName.slice(0, 60) || 'Birebir sohbet';
  const mine = doc(db(), 'groupMembers', `${gid}_${me}`);
  if ((await at('sohbet kontrolü', getDoc(mine))).exists()) return { id: gid, title };
  const base = { groupId: gid, kind: 'dm' as const, code: null, ownerId: me, joinedAt: now() };
  const memberFor = (userId: string, userName: string, groupTitle: string): MemberDoc => ({ ...base, userId, userName, name: groupTitle, role: userId === me ? curRole || null : null, ...(userId === me ? card() : {}) });
  try {
    const batch = writeBatch(db());
    batch.set(doc(db(), 'groups', gid), { kind: 'dm', name: title, code: null, ownerId: me, schoolKey: null, createdAt: now() });
    batch.set(mine, memberFor(me, myName, title));
    batch.set(doc(db(), 'groupMembers', `${gid}_${otherId}`), memberFor(otherId, otherName, myName.slice(0, 60) || 'Birebir sohbet'));
    await at('sohbet kurma', batch.commit());
  } catch {
    // Sohbet daha önce kurulmuş (karşı taraf kurmuş ya da ben ayrılmışım): yalnızca kendi üyeliğimi yaz.
    await at('sohbete katılma', setDoc(mine, memberFor(me, myName, title)));
  }
  return { id: gid, title };
}

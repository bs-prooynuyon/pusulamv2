import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Image, Text, View } from 'react-native';
import type { RoomRole } from '@/lib/rooms';

/** Sınıftaki bir kişi: kendim ya da odadaki biri. */
export interface Seat { uid: string; name: string; photo?: string; state: 'studying' | 'break' | 'left'; fresh: boolean; role: RoomRole; me?: boolean }

const FLOOR = '#f3e7d3';
const BOARD = '#2f4a3c';
const DESK = '#c8955a';
const DESK_EDGE = '#9a6b3a';
const INK = '#3b2a1a';
const PALETTE = ['#c0392b', '#d35400', '#8e44ad', '#16a085', '#2980b9', '#b7950b', '#c2185b', '#00897b'];
const colorOf = (s: string) => PALETTE[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];

/** Profil fotoğrafı; yoksa isim baş harfi. Çerçeve rengi durumu gösterir. */
function Person({ seat, size }: { seat: Seat; size: number }) {
  const ring = !seat.fresh ? '#9aa0a6' : seat.state === 'break' ? '#e08a00' : '#2e9e5b';
  const box = { width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: ring, overflow: 'hidden' as const };
  if (seat.photo) return <Image source={{ uri: seat.photo }} style={box} />;
  return <View style={[box, { backgroundColor: colorOf(seat.name), alignItems: 'center', justifyContent: 'center' }]}>
    <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{(seat.name.trim()[0] ?? '?').toLocaleUpperCase('tr')}</Text>
  </View>;
}

function Desk({ seat, wide }: { seat?: Seat; wide?: boolean }) {
  const label = !seat ? '' : seat.me ? 'Sen' : seat.name;
  const status = !seat ? '' : !seat.fresh ? 'bağlantı yok' : seat.state === 'break' ? 'molada' : 'çalışıyor';
  return <View style={{ alignItems: 'center', opacity: seat && (seat.state === 'break' || !seat.fresh) ? 0.75 : 1 }}>
    <View style={{ height: 52, justifyContent: 'flex-end' }}>
      {seat ? <Person seat={seat} size={wide ? 52 : 46} /> : <Feather name="user" size={22} color="#c9b79c" />}
    </View>
    <View style={{ marginTop: -8, width: wide ? 120 : '90%', height: 24, borderRadius: 6, backgroundColor: seat ? DESK : '#dccdb4', borderBottomWidth: 4, borderBottomColor: seat ? DESK_EDGE : '#c9b79c' }} />
    <Text numberOfLines={1} style={{ color: INK, fontWeight: '800', fontSize: 12, marginTop: 4, maxWidth: '95%' }}>{label || 'boş'}</Text>
    {status ? <Text style={{ color: '#6b5a45', fontSize: 11 }}>{status}</Text> : null}
  </View>;
}

/**
 * Yukarıdan bakılan sade bir sınıf: önde tahta ve öğretmen masası, altında öğrenci sıraları.
 * capacity: öğrenci masası sayısı; allowTeacher: öğretmen masası gösterilsin mi.
 */
export function ClassRoomView({ seats, capacity, allowTeacher }: { seats: Seat[]; capacity: number; allowTeacher: boolean }) {
  const here = seats.filter((s) => s.state !== 'left');
  const teacher = here.find((s) => s.role === 'teacher');
  const students = here.filter((s) => s.role !== 'teacher');
  const desks = Math.max(capacity, students.length);
  const cols = desks <= 4 ? 2 : desks <= 6 ? 3 : 4;
  const cells: (Seat | undefined)[] = Array.from({ length: desks }, (_, i) => students[i]);
  return <View style={{ alignSelf: 'stretch', backgroundColor: FLOOR, borderRadius: 16, padding: 12, gap: 10 }}>
    <View style={{ backgroundColor: BOARD, borderRadius: 8, paddingVertical: 6, alignItems: 'center' }}>
      <Text style={{ color: '#e8f1ea', fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>BİRLİKTE ÇALIŞMA SINIFI</Text>
    </View>
    {allowTeacher || teacher ? <View style={{ alignItems: 'center' }}>
      <Desk seat={teacher} wide />
      {!teacher ? <Text style={{ color: '#6b5a45', fontSize: 11, marginTop: -2 }}>Öğretmen masası</Text> : null}
    </View> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {cells.map((s, i) => <View key={s?.uid ?? `bos-${i}`} style={{ width: `${100 / cols}%`, paddingVertical: 6 }}><Desk seat={s} /></View>)}
    </View>
  </View>;
}

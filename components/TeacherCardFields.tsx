import React from 'react';
import { Text, View } from 'react-native';
import { SelectBox } from '@/components/SelectBox';
import { useColors } from '@/hooks/useColors';
import { TEACHER_BRANCHES, TEACHER_TITLES } from '@/types/planim';

/** Öğretmen için branş ve görev seçimi. Branş, öğrencinin anlamadığı soruyu ilgili hocasına sorabilmesi için; görev, okul grubundaki yönetici etiketi için. */
export function TeacherCardFields({ branch, title, onBranch, onTitle }: { branch: string; title: string; onBranch: (v: string) => void; onTitle: (v: string) => void }) {
  const colors = useColors();
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '700' }}>Branşın</Text>
    <SelectBox placeholder="Branş seç" value={branch} options={TEACHER_BRANCHES} onSelect={onBranch} />
    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '700' }}>Görevin</Text>
    <SelectBox placeholder="Görev seç" value={title} options={TEACHER_TITLES} onSelect={onTitle} />
    <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }}>Branşın öğrencilere görünür; anlamadıkları soruyu branşına göre sana sorabilirler. Okul grubunda yönetici olarak görünürsün.</Text>
  </View>;
}

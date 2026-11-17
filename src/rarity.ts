// Kelangkaan foto di claw machine: common, epic, legendary.
// Diatur lewat `rarity` di tiap foto pada config.ts (tanpa `rarity` = common).
import { config } from './config'

export type RarityFoto = 'common' | 'epic' | 'legendary'

type FotoCfg = { src: string; caption: string; rarity?: RarityFoto; legendary?: boolean }
export const fotos = config.foto as readonly FotoCfg[]

/** `legendary: true` (format lama) tetap dihitung legendary. */
export const rarityFoto = (i: number): RarityFoto => fotos[i]?.rarity ?? (fotos[i]?.legendary ? 'legendary' : 'common')

/**
 * Peluang berhasil mencapit per percobaan + jaminan (pity): kalau gagal terus,
 * percobaan ke-`pity` pasti berhasil. Makin langka, makin susah.
 */
export const RARITY: Record<RarityFoto, { label: string; judul: string; peluang: number; pity: number }> = {
  common: { label: 'COMMON', judul: 'Dapet!', peluang: 0.45, pity: 3 },
  epic: { label: 'EPIC', judul: 'EPIC!', peluang: 0.3, pity: 4 },
  legendary: { label: 'LEGENDARY', judul: 'LEGENDARY!', peluang: 0.18, pity: 5 },
}

/** Fisher–Yates: urutan acak yang adil. */
export function acak<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

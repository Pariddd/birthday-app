// ============================================================
//  KARTU DOA — isi kapsul claw machine setelah 8 foto terkumpul.
//  Ubah teksnya sesukamu. rarity: 'common' | 'rare' | 'legendary'
//  Kartu legendary selalu keluar paling terakhir.
// ============================================================

export type Rarity = 'common' | 'rare' | 'legendary'

// Kartu doa rahasia: terbuka saat skor Lari Cupcake mencapai SKOR_DOA_GAME
export const SKOR_DOA_GAME = 500
export const DOA_GAME = 'Semoga kamu sekuat cupcake ini: jatuh berkali-kali, tetap bangun, tetap manis. Selamat ulang tahun!'

export const KARTU_DOA: { teks: string; rarity: Rarity }[] = [
  { rarity: 'common', teks: 'Semoga tahun ini rezekimu lancar, kayak alasan kamu telat.' },
  { rarity: 'common', teks: 'Semoga skincare-mu bekerja dan dompetmu tetap utuh.' },
  { rarity: 'common', teks: 'Semoga kamu nggak overthinking jam 2 pagi lagi. (Atau minimal ajak aku.)' },
  { rarity: 'common', teks: 'Semoga semua chat yang kamu tunggu dibalas cepat.' },
  { rarity: 'rare', teks: 'Semoga semua yang kamu perjuangkan diam-diam, satu per satu jadi nyata tahun ini.' },
  { rarity: 'rare', teks: 'Semoga kamu makin berani jadi diri sendiri. Versi kamu yang aneh itu justru yang terbaik.' },
  {
    rarity: 'legendary',
    teks: 'Makasih udah jadi teman yang bikin hari-hari biasa jadi nggak biasa. Semoga kamu selalu dikelilingi orang yang sayang sama kamu — setidaknya satu sudah pasti: aku.',
  },
]

// ============================================================
//  KARTU DOA — isi kapsul claw machine setelah 8 foto terkumpul.
//  Ubah teksnya sesukamu. rarity: 'common' | 'rare' | 'legendary'
//  Kartu legendary selalu keluar paling terakhir.
// ============================================================

export type Rarity = "common" | "rare" | "legendary";

// Kartu doa rahasia: terbuka saat skor Lari Cupcake mencapai SKOR_DOA_GAME
export const SKOR_DOA_GAME = 300;
export const DOA_GAME =
  "Semoga dilla sekuat cupcake ini: jatuh berkali-kali, tetap bangun, tetap manis. Selamat ulang tahun!";

export const KARTU_DOA: { teks: string; rarity: Rarity }[] = [
  {
    rarity: "common",
    teks: "Semoga sempronya dan skripsinya lancar dan ga ganti judul lagi.",
  },
  {
    rarity: "common",
    teks: "Semoga dilla mau ketemu farid lagi bukan terakhir hari ini yyaa.",
  },
  {
    rarity: "common",
    teks: "Semoga embegenya enakk teruss yaa dan ga ganti mapel infor lagii.",
  },
  {
    rarity: "common",
    teks: "Semoga semua whistlist yang dilla tunggu tercapai cepat.",
  },
  {
    rarity: "rare",
    teks: "Semoga kita bisa mountain date secepatnya.",
  },
  {
    rarity: "rare",
    teks: "Semoga ga juspren teruss kita yakann.",
  },
  {
    rarity: "legendary",
    teks: "Makasih udah jadi teman yang bikin hari-hari biasa jadi nggak biasa. Semoga kamu selalu dikelilingi orang yang sayang sama kamu — setidaknya satu sudah pasti: farid.",
  },
];

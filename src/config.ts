// ============================================================
//  SEMUA YANG PERLU KAMU UBAH ADA DI FILE INI.
//  Foto: taruh di public/photos/ dengan nama yang sama seperti di bawah.
//  Lagu: taruh di public/audio/lagu.mp3 (kalau tidak ada, website tetap jalan tanpa musik).
// ============================================================

export const config = {
  nama: "Dilla",
  pengirim: "Parid",

  // Tanggal lahir (dipakai untuk kunci, hitung umur, dan lilin angka)
  lahir: { tahun: 2005, bulan: 11, tanggal: 13 },

  // Tanggal kalian mulai kenal (format 'YYYY-MM-DD'). Isi null untuk menyembunyikan barisnya.
  kenalSejak: null as string | null,

  // Nomor WhatsApp kamu, format internasional tanpa + atau 0 di depan. Contoh: '6281234567890'
  nomorWhatsApp: "6289518008735",
  pesanBalasan: "Makasih Giftnya Fariddd!! 😭🎂",

  musik: "/audio/lagu.mp3",

  // 8 foto untuk claw machine & album. Urutan = urutan foto keluar dari kapsul.
  // Foto dengan legendary: true selalu keluar paling terakhir dan berbingkai emas.
  foto: [
    {
      src: "/photos/foto-8.jpeg",
      caption: "Caption foto 1 — ganti dengan cerita di balik foto ini.",
    },
    { src: "/photos/foto-2.jpeg", caption: "Caption foto 2" },
    { src: "/photos/foto-3.jpeg", caption: "Caption foto 3" },
    { src: "/photos/foto-4.jpeg", caption: "Caption foto 4" },
    { src: "/photos/foto-5.jpeg", caption: "Caption foto 5" },
    { src: "/photos/foto-6.jpeg", caption: "Caption foto 6" },
    { src: "/photos/foto-7.jpeg", caption: "Caption foto 7" },
    {
      src: "/photos/foto-1.jpeg",
      caption: "Foto paling berkesan. Tulis pesan paling tulusmu di sini.",
      legendary: true,
    },
  ],

  // Memory match memakai 4 foto ini (index 0–7 dari daftar foto di atas)
  fotoMemory: [0, 1, 2, 3],

  // Tebak foto blur: index foto, 3 pilihan, dan index jawaban yang benar (0, 1, atau 2)
  tebakFoto: [
    {
      foto: 4,
      pilihan: ["Pilihan momen A", "Pilihan momen B", "Pilihan momen C"],
      benar: 0,
    },
    {
      foto: 5,
      pilihan: ["Pilihan momen A", "Pilihan momen B", "Pilihan momen C"],
      benar: 1,
    },
    {
      foto: 6,
      pilihan: ["Pilihan momen A", "Pilihan momen B", "Pilihan momen C"],
      benar: 2,
    },
    {
      foto: 2,
      pilihan: ["Pilihan momen A", "Pilihan momen B", "Pilihan momen C"],
      benar: 0,
    },
  ],

  // Surat penutup. Setiap item = satu paragraf.
  surat: [
    "Selamat ulang tahun yang ke-21!",
    "Nggak kerasa ya, kamu sudah resmi masuk umur yang katanya “harus mulai dewasa”. Tenang, aku nggak berharap banyak kok.",
    "Makasih udah jadi teman yang seru, yang bisa diajak ketawa soal hal-hal nggak penting, dan tetap ada waktu hal-hal penting.",
    "Semoga di umur ini kamu makin bahagia, makin berani ngejar yang kamu mau, dan selalu dikelilingi orang-orang baik.",
    "Jangan lupa traktirannya.",
  ],

  // 3 pesan rahasia: (1) ketuk kue 5x di scene lilin, (2) tahan lama foto di album, (3) bintang kecil di lobi arcade
  pesanRahasia: [
    "Pesan rahasia #1: kamu nemu ini berarti kamu iseng. Persis kayak yang aku kira.",
    "Pesan rahasia #2: dari semua foto ini, aku paling suka yang kamu ketawa sampai matanya hilang.",
    "Pesan rahasia #3: bonus 3 koin! Pakai buat capit foto yang belum dapet.",
  ],

  koinAwal: 5,
};

export type Foto = (typeof config.foto)[number] & { legendary?: boolean };

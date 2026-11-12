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
      src: "/photos/foto-1.jpeg",
      caption: "bunganya seindah orangnyaa yaa",
    },
    {
      src: "/photos/foto-2.jpeg",
      caption: "foto dilla pertama yang gasekali liat dan farid edit",
    },
    { src: "/photos/foto-3.jpeg", caption: "foto dilla sebelum dianter balik" },
    {
      src: "/photos/foto-4.jpeg",
      caption: "after photobooth ga ekspek baguss bangett hasilnyaa",
    },
    {
      src: "/photos/foto-5.jpeg",
      caption: "first time fotbar lucuu jugaa",
    },
    { src: "/photos/foto-6.jpeg", caption: "pap dari acara maulid pas ppl" },
    {
      src: "/photos/foto-7.jpeg",
      caption: "pap ketika dilla suka dengan cahaya ilahi",
    },
    {
      src: "/photos/foto-8.jpeg",
      caption:
        "sukaa banget first time diajarin gaya sama dilla dan hasilnya cakepp dehh",
      legendary: true,
    },
  ],

  // Memory match memakai 4 foto ini (index 0–7 dari daftar foto di atas)
  fotoMemory: [0, 1, 2, 3],

  // Tebak foto blur: index foto, 3 pilihan, dan index jawaban yang benar (0, 1, atau 2)
  tebakFoto: [
    {
      foto: 4,
      pilihan: ["Depan 33 Billiard", "Di kopi kenangan", "di gacoan"],
      benar: 0,
    },
    {
      foto: 1,
      pilihan: [
        "Depan toko buket bunga",
        "Lagi nunggu reda hujan didepan 33 billiard",
        "di gacoan",
      ],
      benar: 1,
    },
    {
      foto: 6,
      pilihan: [
        "foto pas di rumah",
        "foto pas disekolah sma",
        "Maulid Nabi di mts samahani",
      ],
      benar: 2,
    },
    {
      foto: 8,
      pilihan: ["di gacoan", "di lobby 33 billiard", "di kopi kenangan"],
      benar: 1,
    },
  ],

  // Surat penutup. Setiap item = satu paragraf.
  surat: [
    "Selamat ulang tahun yang ke-21!",
    "Nggak kerasa yaa, dilla udah resmi masuk umur yang katanya “harus mulai dewasa”.",
    "Makasih yaa udah jadi mau jadi kawan ngobrol farid yang seru walau farid pengen lebih sihh hehehe, yang bisa diajak ngobrol atau cerita tentang hal-hal random, dan tetap ada waktu hal-hal penting.",
    "Semoga di umur ini dilla makin bahagia, makin berani ngejar yang dilla mau, dan selalu dikelilingi orang-orang baik, serta diberikan kemudahan, kelancaran skripsinya dan tugas kuliah dilla truss  semoga cantik dilla awet truss yaa, sehat selalu, dan makin sukses di segala hal yang dilla lakukan.",
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

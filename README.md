# Website Ulang Tahun Dilla

Website kejutan ulang tahun interaktif: kunci tanggal lahir, kado, fakta umur, warnai kue, tulis umur dengan sparkler, tiup lilin lewat mikrofon, surat, lalu arcade bonus (claw machine, album, photobooth, memory match, tebak foto).

**Stack:** Vite + Svelte 5 + TypeScript, GSAP (animasi), canvas-confetti. Font di-host sendiri (@fontsource), tanpa backend.

## Menjalankan di laptop

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`. Saat mode dev, kamu bisa lompat ke scene mana pun untuk mengecek tampilan:
`http://localhost:5173/?scene=lilin` (nama scene: `kunci, kado, umur, warnai, sparkler, lilin, surat, arcade, claw, album, photobooth, memory, tebak`).

Untuk mengulang dari awal saat testing: buka DevTools → Application → Local Storage → hapus `ulangtahun-dilla-v1`.

## Yang perlu kamu ganti

Semua isi ada di **`src/config.ts`**:

| Isi | Lokasi |
|---|---|
| Nama, tanggal lahir | `nama`, `lahir` |
| Tanggal mulai kenal (opsional) | `kenalSejak: '2022-08-15'`, atau `null` untuk menyembunyikan |
| Nomor WhatsApp untuk tombol balas | `nomorWhatsApp: '6281234567890'` (tanpa `+` / `0` di depan) |
| 8 foto + caption | `foto` (urutan = urutan keluar dari claw machine; `legendary: true` keluar terakhir) |
| Pilihan jawaban tebak foto | `tebakFoto` |
| Isi surat | `surat` (satu item = satu paragraf) |
| 3 pesan rahasia | `pesanRahasia` |

**Foto:** timpa file `public/photos/foto-1.jpg` … `foto-8.jpg` dengan fotomu (nama file sama). Sebaiknya potret, sisi panjang ±1200 px, di bawah 400 KB per foto supaya cepat dibuka di data seluler.

**Lagu:** taruh file MP3 di `public/audio/lagu.mp3`. Kalau tidak ada, website tetap jalan tanpa musik (efek suara tetap ada karena dibuat langsung di browser).

## Deploy ke Vercel

1. Push folder ini ke repo GitHub (private juga bisa).
2. Di Vercel: **Add New → Project →** pilih repo. Framework otomatis terdeteksi sebagai Vite.
3. Deploy sekali untuk mendapatkan alamatnya, misal `https://untuk-dilla.vercel.app`.
4. **Supaya preview link WhatsApp muncul:** Settings → Environment Variables → tambah `VITE_SITE_URL` = `https://untuk-dilla.vercel.app` (tanpa `/` di akhir), lalu **Redeploy**. WhatsApp butuh alamat gambar lengkap untuk menampilkan kartu preview.
5. Cek preview dengan mengirim link ke chat dirimu sendiri dulu. WhatsApp menyimpan cache preview, jadi pastikan sudah benar sebelum dikirim ke Dilla.

Tips: pakai nama project yang tidak membocorkan isi, misalnya `surat-untuk-dilla`.

## Catatan kompatibilitas

- **iPhone (Safari) & Android (Chrome)**: musik, mikrofon, dan kamera hanya dimulai setelah ada ketukan (aturan browser). Semuanya butuh HTTPS, dan Vercel sudah otomatis HTTPS.
- **Mikrofon ditolak / tidak ada**: tombol *Tiup manual* selalu tersedia.
- **Laptop**: tampil sebagai halaman buku di tengah layar. Seret korek & sparkler pakai mouse.
- **Progres tersimpan** di perangkat (localStorage). Setelah surat selesai dibaca, tombol **Daftar isi** muncul untuk lompat ke scene mana pun.
- **Privasi**: photobooth memproses foto sepenuhnya di HP; tidak ada yang diunggah. Kunci tanggal lahir hanya gimmick (bisa dilihat dari kode), jadi jangan taruh informasi sensitif di website ini.

## Struktur

```
src/
  config.ts            ← isi yang kamu ganti
  App.svelte           ← stage, topbar, daftar isi, transisi scene
  lib/state.svelte.ts  ← progres + simpan ke localStorage
  lib/audio.ts         ← musik + efek suara (Web Audio)
  lib/mic.ts           ← deteksi tiupan (RMS frekuensi rendah)
  lib/fx.ts            ← confetti, animasi garis doodle, long-press
  components/          ← Cake, Prize, Photo, Icon, Toast, ArcadeHeader
  scenes/              ← satu file per scene
public/
  photos/  audio/  og.png  favicon.svg
```

# Website Ulang Tahun Dilla

Website kejutan ulang tahun interaktif: kunci tanggal lahir, kado, fakta umur, warnai kue, tulis umur dengan sparkler, tiup lilin lewat mikrofon, surat, lalu arcade bonus (claw machine, album, photobooth, memory match, tebak foto).

Setelah ultah: **Ruang Kita** (dua arah Dilla ⇄ Farid) — Kotak Surat, Album Kenangan bersama, Kapsul Waktu (waktu buka dipilih sendiri), Tantang Farid di Lari Cupcake, progres tersimpan di cloud, dan notifikasi Web Push.

**Stack:** Vite + Svelte 5 + TypeScript, GSAP, canvas-confetti, @fontsource. Server: Vercel Functions (`api/`), Upstash Redis (data), Vercel Blob privat (foto album), Web Push (VAPID).

## Menjalankan di laptop

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`. Saat mode dev, kamu bisa lompat ke scene mana pun untuk mengecek tampilan:
`http://localhost:5173/?scene=lilin` (nama scene: `kunci, kado, umur, warnai, sparkler, lilin, surat, arcade, claw, album, photobooth, memory, tebak`).

Untuk mengulang dari awal saat testing: buka DevTools → Application → Local Storage → hapus `ulangtahun-dilla-v1`.

**Ruang Kita saat dev** jalan tanpa akun apa pun: data disimpan di folder `.data/` (otomatis, sudah di-.gitignore). Kata sandi mode Farid saat dev: `farid-dev`. Untuk mencoba notifikasi saat dev, buat `.env.local`:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:emailkamu@gmail.com
```

(kunci dibuat dengan `npx web-push generate-vapid-keys`). Mulai ulang Ruang Kita saat dev = hapus folder `.data/`.

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

## Menyalakan Ruang Kita di Vercel (gratis, tanpa kartu kredit)

Semua langkah di dashboard project Vercel kamu. Lakukan **sebelum** Dilla membuka Ruang Kita.

1. **Database — Upstash Redis:** tab **Storage → Create Database → Upstash (Redis)** → paket **Free** → hubungkan ke project ini. Variabel `KV_REST_API_URL` & `KV_REST_API_TOKEN` (atau `UPSTASH_REDIS_REST_*`) otomatis ditambahkan.
2. **Foto album — Vercel Blob:** **Storage → Create → Blob** → pilih akses **Private** → hubungkan ke project. (`BLOB_READ_WRITE_TOKEN` otomatis ditambahkan.)
3. **Kunci notifikasi:** di laptop jalankan `npx web-push generate-vapid-keys`, lalu salin hasilnya.
4. **Settings → Environment Variables**, tambahkan (Production):

   | Nama | Isi |
   |---|---|
   | `APP_SECRET` | string acak ≥ 32 karakter (PowerShell: `[Convert]::ToBase64String((1..48 \| % {Get-Random -Max 256}))`, atau `openssl rand -base64 48`) |
   | `ADMIN_PASSWORD` | kata sandi mode Farid (≥ 8 karakter, jangan sama dengan password lain) |
   | `VAPID_PUBLIC_KEY` | dari langkah 3 |
   | `VAPID_PRIVATE_KEY` | dari langkah 3 (**rahasia**) |
   | `VAPID_SUBJECT` | `mailto:emailkamu@gmail.com` |
   | `CRON_SECRET` | string acak ≥ 16 karakter (cron harian: 00:05 WIB ucapan ultah + kabar kapsul, 20:05 WIB pengingat Taman Kita) |

5. **Redeploy** (Deployments → ⋯ → Redeploy).
6. Di HP-mu: buka website → Arcade → **Ruang Kita** → *Aku Farid* → masuk → nyalakan notifikasi.
7. Kirim ke Dilla: "cek Arcade, ada Ruang Kita". Dia membuat PIN sendiri saat pertama masuk; kamu dapat notifikasi saat PIN dibuat.

**iPhone:** notifikasi web hanya jalan kalau website dipasang ke layar utama (Safari → Bagikan → *Tambah ke Layar Utama*, iOS 16.4+). Panduannya muncul di tombol notifikasi.

### Keamanan (yang perlu kamu tahu)

- Surat, album, kapsul, dan skor hanya bisa diakses dengan token login (PIN Dilla / kata sandi Farid). Foto album tersimpan **private** dan hanya disajikan lewat `/api/foto` dengan token per foto.
- PIN di-hash (scrypt), salah 10× berturut-turut → login PIN terkunci 1 jam + kamu dapat notifikasi. PIN yang gampang ditebak (tanggal lahir, 1234, 0000) ditolak.
- Kapsul waktu dikunci di **server**: isi surat tidak pernah dikirim ke penerima sebelum waktu buka yang dipilih penulisnya (1 menit s.d. 10 tahun ke depan). Penulis masih bisa mengubah/menghapus sebelum terbuka; setelah terbuka, kapsul tersegel permanen.
- Notifikasi kapsul: saat dititipkan (berisi tanggal bukanya), lalu oleh cron harian 00:05 WIB untuk kapsul yang terbuka hari itu. Cron paket Hobby hanya sekali sehari, jadi notifikasi tidak tepat di menit bukanya.
- Celah yang tersisa: siapa pun yang memegang link bisa *membuat PIN duluan* sebelum Dilla. Karena itu kamu dapat notifikasi saat PIN dibuat; kalau bukan Dilla, buka **Ruang Kita → nama kamu → Reset PIN Dilla**.
- Taman Kita (streak): tanaman tumbuh di hari Dilla **dan** Farid sama-sama mengirim surat/foto/album/kapsul (hari WIB). 8 tahap (biji → pohon legendaris di 100 hari). Pelindung 🛡️ didapat tiap 7 hari (maks. 2) dan otomatis menutup hari yang terlewat. Riwayat disimpan per hari di key `streak:hari`; streak selalu dihitung ulang dari riwayat itu.
- Kuota gratis: Upstash 500 ribu perintah/bulan, Blob 1 GB. Album dibatasi 400 foto (dikompres ±300–500 KB di HP sebelum upload).

## Catatan kompatibilitas

- **iPhone (Safari) & Android (Chrome)**: musik, mikrofon, dan kamera hanya dimulai setelah ada ketukan (aturan browser). Semuanya butuh HTTPS, dan Vercel sudah otomatis HTTPS.
- **Mikrofon ditolak / tidak ada**: tombol *Tiup manual* selalu tersedia.
- **Laptop**: tampil sebagai halaman buku di tengah layar. Seret korek & sparkler pakai mouse.
- **Progres tersimpan** di perangkat (localStorage), dan ikut tersimpan di cloud setelah Dilla masuk Ruang Kita. Setelah surat selesai dibaca, tombol **Daftar isi** muncul untuk lompat ke scene mana pun.
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
  lib/ruang.svelte.ts  ← login Ruang Kita, panggilan API, sinkron progres, Web Push
  components/          ← Cake, Prize, Photo, Icon, Toast, ArcadeHeader, RuangGate, NotifToggle, AkunSheet
  scenes/              ← satu file per scene (Kotak, Kenangan, Kapsul = Ruang Kita)
api/                   ← Vercel Functions: auth, pesan, progres, skor, kapsul, album, foto, push
server/                ← kode bersama server: kv (Redis/file), blob, auth (token+PIN), push, http
public/
  photos/  audio/  og.png  favicon.svg  sw.js  manifest.webmanifest  icon-*.png
vercel.json            ← cron ucapan ultah + header service worker
```

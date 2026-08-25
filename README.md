# Novira

**Dashboard pemantauan kebersihan kota berbasis CCTV untuk pemerintah daerah.**

![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00?logo=svelte)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![Postgres](https://img.shields.io/badge/Postgres-16-4169E1?logo=postgresql)

Novira mengubah jaringan CCTV yang sudah terpasang di kota menjadi sensor kebersihan otomatis. Sampah liar yang menumpuk di jalanan terdeteksi saat muncul, dihitung berapa lama dibiarkan, dan ditindaklanjuti melalui alur kerja yang terukur — dari deteksi, penugasan petugas, hingga bukti pembersihan.

Repositori ini berisi **aplikasi web** (dashboard admin + halaman publik) yang dipakai oleh operator DLH, petugas lapangan, dan pimpinan daerah. Sisi deteksi (model YOLOv8 pada aliran RTSP) adalah layanan terpisah yang terhubung lewat API.

## Daftar Isi

- [Apa yang dilakukan](#apa-yang-dilakukan)
- [Alur kerja](#alur-kerja)
- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Struktur proyek](#struktur-proyek)
- [Menjalankan aplikasi](#menjalankan-aplikasi)
- [Akun demo](#akun-demo)
- [Perintah penting](#perintah-penting)
- [Pengujian](#pengujian)
- [Deployment](#deployment)
- [Keamanan](#keamanan)

## Apa yang dilakukan

Kota umumnya baru tahu ada penumpukan sampah setelah warga melapor, dan tidak ada catatan berapa lama sampah dibiarkan. Novira menjawabnya dengan memanfaatkan kamera yang sudah ada:

| Masalah                                | Kondisi lama                      | Dengan Novira                           |
| -------------------------------------- | --------------------------------- | --------------------------------------- |
| Titik pembuangan liar tidak terlihat   | Patroli manual / menunggu laporan | Deteksi 24/7 dari CCTV yang ada         |
| Durasi sampah menumpuk tidak terukur   | Tidak tercatat                    | Timer otomatis per penumpukan (SLA)     |
| Kinerja petugas tidak terukur          | Laporan manual                    | Rekap waktu tanggap per wilayah         |
| Kebersihan wilayah tidak terbandingkan | Penilaian Adipura tahunan         | Skor kebersihan real-time per kelurahan |

Data kamera di-seed dari **stream CCTV publik asli** milik Pemerintah Kota Bandung (ATCS `pelindung.bandung.go.id`) sehingga pemantauan langsung bisa dicoba tanpa kamera fisik sendiri. Cakupannya **290 kamera di 27 dari 30 kecamatan** Kota Bandung.

> Daftar mentah pemda berisi 377 kamera. Setiap stream diuji satu per satu dan **hanya yang benar-benar mengudara** yang di-seed — 85 kamera menjawab HTTP 404 (masih terdaftar tetapi perangkatnya sudah mati) dan 2 kamera lainnya secara administratif berada di Kota Cimahi. Kamera mati sengaja tidak dimasukkan karena wilayahnya akan tampak "bersih" padahal sebenarnya tidak terpantau sama sekali.

## Alur kerja

```
 CCTV kota ─────────┐                 ┌───── Warga lapor (foto + GPS)
 deteksi penumpukan │                 │      dapat kode LPR-XXXXXX
                    │                 ▼
                    │        Pindai AI + cek duplikat (150 m / 48 jam)
                    │                 │
                    │                 ▼
                    │        Antrian triase operator
                    │        (rekomendasi AI + reputasi pelapor)
                    │                 │
                    │                 ▼ diverifikasi manusia
                    ▼                 │
        ┌───────────┴─────────────────┘
        ▼
  INSIDEN — skor prioritas 0–100 + timer SLA berjalan
        │
        ├──► 12 jam belum selesai ──► ingatkan operator
        ├──► 24 jam ────────────────► eskalasi Kepala Seksi
        └──► 48 jam ────────────────► eskalasi Kepala Dinas
        │
        ▼
  Petugas ditugaskan ──► selesai + foto bukti ──► status SELESAI
        │
        ├──► Skor kebersihan & laporan wilayah ter-update
        ├──► Arsip skor harian ──► tren antarwaktu
        └──► Titik kronis ──► usulan intervensi (TPS / jadwal / penindakan)
```

Pelapor memantau seluruh rantai itu lewat kode laporannya di `/lacak`, tanpa perlu membuat akun.

**Prinsip yang dipegang:** AI menyaring, manusia memutuskan. Tidak ada jalur di sistem ini yang mengubah laporan warga menjadi valid atau ditolak secara otomatis — model hanya mengisi kolom rekomendasi, dan setiap perubahan status berasal dari aksi operator yang tercatat di audit log. Detektornya dilatih pada citra CCTV jalan, sedangkan foto warga diambil dari ponsel pada jarak dan sudut yang sangat berbeda, sehingga akurasinya tidak layak dijadikan hakim tunggal.

## Fitur

**Publik**

- Landing page dengan informasi layanan.
- Formulir lapor sampah: unggah foto/video (max 5 MB / 20 MB), deteksi lokasi GPS otomatis, data pelapor opsional.
- **Kode pelacakan laporan** — tiap laporan mendapat kode (mis. `LPR-7K2M9Q`); pelapor memantau perkembangannya di `/lacak` tanpa perlu akun. Halaman ini sengaja tidak menampilkan nama/nomor pelapor, karena kodenya sering dibagikan lewat pesan singkat.

**Pemantauan & operasional**

- **Pemantauan CCTV langsung** — stream HLS/MP4 asli, hingga 4 umpan berdampingan, filter per kota. Stream non-CORS diproksi server-side dengan pinning sertifikat, timeout, dan dukungan range request.
- **Insiden & Alert** — daftar deteksi penumpukan sampah: lokasi, durasi, status SLA, keparahan; tindakan tugaskan petugas, tandai selesai dengan bukti foto, riwayat selesai.
- **Skor prioritas 0–100 yang bisa dijelaskan** — antrian kerja diurutkan bukan sekadar berdasar jenis sampah, tapi gabungan jenis × durasi dibiarkan × sensitivitas lokasi (sungai, sekolah, pasar, fasilitas kesehatan) × riwayat kekambuhan titik × jumlah laporan warga yang menguatkan. Setiap skor disertai rincian faktornya di antarmuka dan tersimpan di database, sehingga pertanyaan "kenapa insiden ini prioritas 87" selalu bisa dijawab baris per baris.
- **Triase laporan masyarakat** — laporan warga dipindai otomatis (endpoint `/detect/image` pLitter), dicek terhadap laporan lain di radius 150 m/48 jam untuk mencegah duplikat, lalu masuk antrian dengan rekomendasi `SANGAT MUNGKIN VALID` / `PERLU TINJAUAN` / `KEMUNGKINAN SPAM`. Operator memverifikasi satu klik dan laporan **naik menjadi insiden resmi** dengan timer SLA yang berjalan sejak warga melapor.
- **Reputasi pelapor** — akurasi laporan sebelumnya (dikunci pada nomor telepon ternormalisasi) ikut menentukan prioritas triase. Laporan duplikat tidak menurunkan reputasi — melaporkan masalah nyata yang kebetulan sudah dilaporkan orang lain bukan kesalahan pelapor.
- **Eskalasi SLA berjenjang** — 12 jam mengingatkan operator, 24 jam naik ke kepala seksi, 48 jam naik ke kepala dinas & walikota. Berjalan otomatis tiap jam, monoton (tidak mengirim notifikasi ganda), dan tercatat di audit log.
- **Peta titik rawan** — peta Leaflet/OpenStreetMap interaktif berisi 290 kamera (dikelompokkan otomatis agar terbaca) dan insiden terbuka, dengan ukuran lingkaran mengikuti skor prioritas dan popup berisi detail beserta tautan ke insidennya. Ubin peta mengikuti tema terang/gelap. Insiden tanpa koordinat sengaja **tidak** digambar di titik perkiraan — penanda di lokasi keliru lebih berbahaya daripada tidak ada penanda, karena petugas akan dikirim ke sana.
- **Peringkat wilayah** — skor kebersihan 0–100 per kelurahan (jumlah insiden, rata-rata durasi, tren mingguan).
- **Petugas lapangan** — daftar dan status kesiapan petugas.

**Manajemen & pelaporan**

- **Kamera CCTV** — registri 290 kamera Kota Bandung beserta kecamatan, kelurahan, koordinat, status, dan URL stream. Kecamatan/kelurahan diturunkan lewat reverse geocoding koordinat ke batas administratif OpenStreetMap, karena data sumber pemda tidak menyertakannya.
- **Laporan wilayah** — agregasi bertingkat provinsi → kabupaten/kota → kecamatan → kelurahan, dengan filter dan ekspor.
- **Dashboard eksekutif** — ringkasan KPI untuk kepala dinas/walikota.
  - **Titik kronis** — lokasi yang berulang kali dibersihkan lalu kotor lagi, masing-masing disertai usulan intervensi beserta alasannya (tambah TPS bila siklusnya jam-jaman, ubah jadwal angkut bila harian, pengawasan & penindakan bila polanya disengaja).
  - **Jam rawan & usulan jadwal patroli** — distribusi jam kemunculan sampah per kecamatan, dengan usulan jendela patroli 3 jam. Kecamatan dengan kurang dari 5 laporan sengaja tidak diusulkan karena polanya belum bisa dibedakan dari kebetulan.
  - **Arsip skor harian** — snapshot skor kebersihan tiap kecamatan disimpan tiap malam, sehingga tren antarwaktu dihitung dari data nyata. Selama arsipnya belum cukup panjang, aplikasi menyatakan datanya belum ada alih-alih menampilkan `+0.0%` yang menyesatkan.
- **Manajemen pengguna & peran** — RBAC: `admin`, `operator`, `kepala_seksi`, `kepala_dinas`, `walikota`, `petugas_lapangan`.
- **Notifikasi** — notifikasi global/per-user dengan tanda belum dibaca.
- **Audit log** — jejak aktivitas sistem.
- **Pengaturan** — profil, notifikasi, mode pemeliharaan.

## Teknologi

| Lapisan    | Pilihan                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| Framework  | SvelteKit 2 + Svelte 5 (runes API)                                      |
| Styling    | Tailwind CSS v4 + shadcn-svelte                                         |
| Database   | PostgreSQL (Neon) via Drizzle ORM                                       |
| Otentikasi | Session berbasis cookie; Argon2id untuk password, token di-hash SHA-256 |
| Chart      | LayerChart (D3)                                                         |
| Peta       | Leaflet + markercluster, ubin OpenStreetMap/CARTO                       |
| Testing    | Vitest (unit), Playwright (E2E)                                         |

## Struktur proyek

```
src/
├── lib/
│   ├── components/        # UI (shadcn) + komponen aplikasi (sidebar, CCTV player, tabel insiden)
│   ├── server/            # Kode server-only: auth, database, upload, seam data domain
│   │   ├── db/            # Skema Drizzle, seed, migrasi
│   │   └── novira/        # Satu-satunya pintu masuk data operasional (kamera, insiden, dll.)
│   ├── types/             # Tipe data domain
│   └── utils/             # Helper (export CSV/JSON, dll.)
├── routes/
│   ├── (public)/          # Landing page, form lapor sampah, pelacakan laporan
│   ├── (auth)/            # Login, registrasi, reset password, lock screen
│   └── dashboard/(app)/   # Aplikasi admin (dilindungi guard otentikasi & RBAC)
└── hooks.server.ts        # Validasi session di setiap request
```

File pengujian ditempatkan di sebelah kode yang diuji (mis. `users/users.test.ts`).

## Menjalankan aplikasi

**Prasyarat:** Node.js 20+, pnpm, dan satu database PostgreSQL (bisa gratis di [Neon](https://neon.tech)).

```bash
# 1. Pasang dependensi
pnpm install

# 2. Siapkan environment
cp .env.example .env

# 3. Isi variabel di .env
#    DATABASE_URL=postgres://user:password@host/db?sslmode=require
#    ORIGIN=http://localhost:5173

# 4. Buat skema tabel di database
pnpm db:push

# 5. Seed data contoh (kamera CCTV publik, pengguna, insiden, dll.)
pnpm db:seed

# 6. Jalankan
pnpm dev
```

Buka **http://localhost:5173** — halaman publik dan dashboard siap dicoba.

## Akun demo

Setelah `pnpm db:seed`, akun berikut tersedia (kecuali disebut, password `password123`):

| Username       | Password          | Peran            | Keterangan                                                               |
| -------------- | ----------------- | ---------------- | ------------------------------------------------------------------------ |
| `demo`         | `NoviraDemo2026!` | operator         | Akun publik untuk demo; form login terisi otomatis bila `DEMO_MODE=true` |
| `admin`        | `password123`     | admin            | Akses penuh (pengguna, peran, database, audit, pengaturan)               |
| `operator`     | `password123`     | operator         | Ruang kendali operasional                                                |
| `kepala_seksi` | `password123`     | kepala_seksi     | Operasional + laporan                                                    |
| `kepala_dinas` | `password123`     | kepala_dinas     | Masuk langsung ke dashboard eksekutif                                    |
| `walikota`     | `password123`     | walikota         | Masuk langsung ke dashboard eksekutif                                    |
| `petugas`      | `password123`     | petugas_lapangan | Tampilan petugas                                                         |

**Mode demo:** set `DEMO_MODE=true` di `.env` — form login terisi otomatis, dan admin mendapat tab **Demo** di Pengaturan untuk me-reset data ke kondisi awal.

> Catatan data: kamera diambil dari tabel database (290 stream CCTV publik Kota Bandung yang sudah diverifikasi aktif). Insiden, skor wilayah, petugas, dan laporan masyarakat adalah data contoh — termasuk sepasang laporan yang sengaja berdekatan (±40 m) agar deteksi duplikat terlihat bekerja.

## Perintah penting

| Perintah           | Fungsi                          |
| ------------------ | ------------------------------- |
| `pnpm dev`         | Server pengembangan             |
| `pnpm build`       | Build produksi (adapter-node)   |
| `pnpm preview`     | Pratinjau hasil build           |
| `pnpm check`       | Pemeriksaan tipe (svelte-check) |
| `pnpm db:push`     | Dorong skema ke database        |
| `pnpm db:generate` | Buat migrasi dari skema         |
| `pnpm db:studio`   | GUI Drizzle Studio              |
| `pnpm db:seed`     | Seed data contoh                |
| `pnpm test`        | Unit test (Vitest)              |
| `pnpm test:e2e`    | E2E test (Playwright)           |
| `pnpm lint`        | ESLint                          |
| `pnpm format`      | Prettier (tulis otomatis)       |

## Pengujian

- **Unit test** (`pnpm test`) — menguji load & action server tiap route; memakai database Postgres in-memory (PGlite) sehingga tidak butuh database sungguhan.
- **E2E** (`pnpm test:e2e`) — navigasi antarmuka dengan Playwright; server otomatis dibangun dan dijalankan dari konfigurasi (`pnpm build && pnpm preview`).

## Deployment

Build dengan adapter-node:

```bash
pnpm build
node build
```

Variabel environment yang diperlukan saat produksi: `DATABASE_URL`, `ORIGIN` (URL publik aplikasi), opsional `DEMO_MODE`. Sesuai kebutuhan pilot pemerintah daerah, aplikasi dapat di-deploy on-premise (Docker/VPS) atau di platform Node mana pun.

## Keamanan

- Password di-hash Argon2id; tidak pernah disimpan plaintext.
- Session token acak disimpan di cookie; database hanya menyimpan hash SHA-256-nya — kebocoran database tidak bisa dipakai memalsukan session.
- Akses halaman dijaga server-side (guard RBAC), bukan hanya di tampilan.
- Unggahan file divalidasi jenis dan ukurannya; nama file diacak.
- Sistem ini bukan sistem pengenalan wajah — bukti visual hanya alat verifikasi penanganan untuk petugas berwenang.

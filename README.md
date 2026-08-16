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

Data kamera di-seed dari **stream CCTV publik asli** (ATCS kota Bandung, Surabaya, Klaten, Tangerang, Palembang, dll.) sehingga pemantauan langsung bisa dicoba tanpa kamera fisik sendiri.

## Alur kerja

```
 CCTV kota ──► deteksi penumpukan sampah
                  │
                  ▼
        Insiden muncul di dashboard ──► timer SLA 24 jam berjalan
                  │
                  ▼
        Petugas ditugaskan (via laporan / notifikasi)
                  │
                  ▼
        Tandai selesai + unggah foto bukti ──► status SELESAI
                  │
                  ▼
        Skor kebersihan & laporan wilayah ter-update
```

Warga juga bisa melapor melalui **halaman publik** (foto/video + lokasi GPS); laporan masuk ke dashboard untuk diverifikasi dan ditindaklanjuti petugas.

## Fitur

**Publik**

- Landing page dengan informasi layanan.
- Formulir lapor sampah: unggah foto/video (max 5 MB / 20 MB), deteksi lokasi GPS otomatis, data pelapor opsional.

**Pemantauan & operasional**

- **Pemantauan CCTV langsung** — stream HLS/MP4 asli, hingga 4 umpan berdampingan, filter per kota. Stream non-CORS diproksi server-side dengan pinning sertifikat, timeout, dan dukungan range request.
- **Insiden & Alert** — daftar deteksi penumpukan sampah: lokasi, durasi, status SLA, keparahan; tindakan tugaskan petugas, tandai selesai dengan bukti foto, riwayat selesai.
- **Peta titik rawan** — hotspot penumpukan berdasarkan frekuensi insiden.
- **Peringkat wilayah** — skor kebersihan 0–100 per kelurahan (jumlah insiden, rata-rata durasi, tren mingguan).
- **Laporan masyarakat** — verifikasi dan tindak lanjut laporan warga.
- **Petugas lapangan** — daftar dan status kesiapan petugas.

**Manajemen & pelaporan**

- **Kamera CCTV** — registri kamera beserta status dan URL stream.
- **Laporan wilayah** — agregasi bertingkat provinsi → kabupaten/kota → kecamatan → kelurahan, dengan filter dan ekspor.
- **Dashboard eksekutif** — ringkasan KPI untuk kepala dinas/walikota.
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
│   ├── (public)/          # Landing page & form lapor sampah
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

> Catatan data: kamera diambil dari tabel database (stream CCTV publik). Insiden, skor wilayah, dan petugas adalah data contoh; perubahan status insiden berlaku selama proses server berjalan.

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

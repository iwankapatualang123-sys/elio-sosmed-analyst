# Status Pembangunan vs Blueprint

Peta item `Catatan_Update_Blueprint.md` → status. ✅ selesai · 🟡 sebagian · ⬜ belum.
Terakhir diperbarui: 2026-07-09.

## Inti (sudah jalan penuh)

| Area | Status | Catatan |
|---|---|---|
| Database Supabase (§13) | ✅ | tabel + RLS `can_access_account` + trigger profil |
| `lib/tiktok/parser.js` (§19,§25) | ✅ | tervalidasi 7/7 file export asli |
| `lib/tiktok/sync.js` (upsert dedup) | ✅ | RLS-aware, tervalidasi tulis DB nyata (253 baris) |
| `lib/tiktok/metrics.js` (§3,§5) | ✅ | engagement, ranking, hashtag, growth, jam terbaik |
| `lib/tiktok/upload.js` (§19) | ✅ | bongkar zip bersarang, deteksi cabang, notif ringkasan |
| Auth email/password + 3 role (§13) | ✅ | login, proteksi rute, ganti password, mata password |
| Dashboard (§4) | ✅ | KPI, ranking cabang, grafik, heatmap, pemilih cabang |
| Halaman Data + tabel per aspek | ✅ | filter bulan + search/sort/pagination |
| Insight otomatis 4 aspek (§5) | ✅ | formula + AI Groq (fallback aman) |
| Laporan Excel per cabang (§7) | ✅ | data + insight, download .xlsx |
| Laporan infografis per akun (§8) | ✅ | halaman cetak → Simpan PDF |
| Tema teal 3D + Poppins (§11,§23) | ✅ | kartu/tombol 3D, header branded, ikon Lucide |
| PWA installable + offline (§11) | ✅ | manifest, service worker, ikon, safe-area |
| Best posting heatmap (§21A) | ✅ | jam × hari |
| Arsip cabang (§21D) | ✅ | toggle is_active di /settings |
| Manajemen user & cabang (§21D) | ✅ | admin atur role, akses, cabang |
| Reduce motion (§21E,§22) | ✅ | di globals.css |

## Sebagian (perlu dilengkapi)

| Item | Status | Yang kurang |
|---|---|---|
| Komponen tabel standar (§20) | 🟡 | search/sort/pagination ✅; belum: filter tanggal/kolom, column visibility, download per tabel, clickable row, loading/error state |
| Loading state (§22) | 🟡 | upload ada teks langkah; belum: progress bar + step indicator + animasi centang, skeleton/shimmer saat load |
| AI Groq (§18) | 🟡 | jalan via Next API route (lokal); produksi idealnya Supabase Edge Function |
| Laporan Semua Cabang (§9) | 🟡 | ada ranking di dashboard; belum: PDF tabular multi-cabang + sheet Excel "Ringkasan Semua Cabang" |
| Status Naik/Stabil/Turun (§25) | 🟡 | default ±5%; ambang resmi belum dikonfirmasi |
| Analisis hashtag (§21A) | 🟡 | dihitung & dipakai insight; belum: halaman khusus/hashtag cloud/tren |
| Kategori/tag cabang (§21D) | 🟡 | kolom `kategori` bisa diisi; belum: grup/filter apple-to-apple |
| Navigasi (§11) | 🟡 | pakai top-nav responsif; blueprint minta sidebar (desktop) + bottom-nav (mobile) |
| Offline mode (§21E) | 🟡 | SW cache dasar; belum diuji penuh untuk skenario lapangan |

## Belum dibangun

**Data & Analitik (§21A):** goals/target per cabang · anotasi data · forecasting · content calendar · perbandingan periode fleksibel (UI).

**Kolaborasi (§21B):** log aktivitas/audit trail* · komentar internal · assignment tugas · approval workflow · manajemen periode lengkap/parsial. *(direkomendasikan prioritas)*

**Notifikasi (§21C):** viral alert · anomaly alert · reminder upload · export terjadwal · push notification PWA. (tabel `notifikasi` ada tapi belum dipakai app ini)

**Manajemen (§21D):** onboarding/tutorial · bulk action · template laporan custom.

**Pengalaman (§21E):** dark mode · multi-bahasa · global search lintas cabang.

**Keamanan (§21F):** session timeout · backup berkala · rate limit upload · 2FA admin.

**Ekspansi (§14,§25):** migrasi `tiktok_accounts`→`social_accounts` (platform generik) · Instagram · TikTok oEmbed thumbnail.

## Butuh keputusan/aksi Anda (non-kode)

- ⬜ Deploy ke Vercel (§24) — akun Anda
- ⬜ Ganti password admin sementara (`ElioAdmin#2026`)
- ⬜ Leaked Password Protection (§25) — **N/A di paket Free** (fitur Pro); pakai min-length sebagai gantinya
- ⬜ Konfirmasi lisensi Freepik untuk aset desain (§25)
- ⬜ (opsional) Groq Edge Function untuk produksi (§18)

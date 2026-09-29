-- Akun IG RESMI tiap outlet. Dipakai sebagai PENGAMAN saat upload konten IG:
-- postingan yang username-nya = akun resmi OUTLET LAIN akan ditolak (tidak nyasar),
-- dan penanda kolaborasi (is_collab) dihitung dari akun resmi ini, bukan dari
-- tebakan "akun terbanyak di file" (yang bisa salah bila file mayoritas outlet lain).
ALTER TABLE `tiktok_accounts` ADD COLUMN `ig_username` VARCHAR(255) NULL;

-- Migration: kolom link konten tayang (diisi tim setelah upload). Dipakai untuk
-- memverifikasi status: cocokkan posted_url dgn video_link/video_id dari report
-- TikTok Studio (tiktok_content) -> "Verified", selain itu "Not verified".
-- Diterapkan ke project msisofuggqoodlwjqxzw 2026-07-09.
alter table public.content_plans add column if not exists posted_url text;

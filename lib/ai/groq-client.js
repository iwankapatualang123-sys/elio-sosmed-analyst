// File: lib/ai/groq-client.js
// Wrapper generik pemanggil Groq API (platform-agnostic, blueprint bagian 18).
// KEAMANAN: key dibaca dari env server (GROQ_API_KEY) — TIDAK boleh NEXT_PUBLIC_*.
// Di produksi idealnya lewat Supabase Edge Function; untuk lokal, route server
// Next sudah cukup (key tetap di server). Modul ESM (server-only).

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Model default. Catatan: llama-3.3-70b-versatile & llama-3.1-8b-instant DI-DEPRECATE
// Groq per 17 Juni 2026. Pakai model produksi terkini; override via env GROQ_MODEL.
// Cek daftar terbaru: https://console.groq.com/docs/models
const DEFAULT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

// Fungsi: isGroqConfigured — cek apakah key tersedia.
export function isGroqConfigured() {
  return !!process.env.GROQ_API_KEY;
}

// Fungsi: groqChat
// Kirim prompt ke Groq, kembalikan teks jawaban. Melempar Error kalau tidak
// dikonfigurasi / gagal. Input: prompt string + options. Output (async): string.
export async function groqChat(prompt, options = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY belum diset.");
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: options.model || DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: options.temperature ?? 0.5,
      max_tokens: options.maxTokens ?? 400,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Groq error ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

// Model VISION (multimodal) Groq — untuk membaca gambar (mis. screenshot Pemirsa IG).
// Nama model vision Groq berubah-ubah; override via env GROQ_VISION_MODEL.
const DEFAULT_VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

// Fungsi: groqChatVision
// Kirim 1 gambar (data URL base64) + instruksi teks ke model vision Groq, kembalikan
// teks jawaban. Dipakai untuk mengekstrak angka dari screenshot. Melempar Error bila
// tidak dikonfigurasi/gagal. Input: dataUrl 'data:image/...;base64,...', prompt, options.
export async function groqChatVision(dataUrl, prompt, options = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY belum diset.");
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: options.model || DEFAULT_VISION_MODEL,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      }],
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 900,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Groq vision error ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

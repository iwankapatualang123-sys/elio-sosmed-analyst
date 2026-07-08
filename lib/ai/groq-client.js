// File: lib/ai/groq-client.js
// Wrapper generik pemanggil Groq API (platform-agnostic, blueprint bagian 18).
// KEAMANAN: key dibaca dari env server (GROQ_API_KEY) — TIDAK boleh NEXT_PUBLIC_*.
// Di produksi idealnya lewat Supabase Edge Function; untuk lokal, route server
// Next sudah cukup (key tetap di server). Modul ESM (server-only).

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Model default — perlu diverifikasi ketersediaannya saat implementasi (bisa berubah).
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

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

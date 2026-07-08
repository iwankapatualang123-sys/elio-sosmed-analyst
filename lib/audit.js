// File: lib/audit.js
// Helper pencatatan audit trail (blueprint bagian 21B). Menyisipkan baris ke
// activity_log lewat client Supabase terikat sesi (RLS: user hanya bisa insert
// atas namanya sendiri). Kegagalan log TIDAK boleh menggagalkan aksi utama.

// Fungsi: logActivity
// Input: supabase client, { action, entity?, detail? }. Output (async): void.
export async function logActivity(supabase, { action, entity = null, detail = null }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity_log").insert({
      user_id: user.id,
      user_email: user.email,
      action,
      entity,
      detail,
    });
  } catch {
    // Diamkan — audit gagal tidak boleh mengganggu alur utama.
  }
}

// File: components/BranchRow.jsx
// Satu baris tabel Cabang/Akun TikTok di Pengaturan (client): mode lihat vs mode
// edit-inline (nama/username/kategori), + toggle arsip + hapus PERMANEN (dengan
// konfirmasi ketik nama cabang — aksi ini menghapus SEMUA data terkait via cascade).

"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import Button from "@/components/Button";
import { updateBranch, deleteBranch, toggleBranchActive } from "@/app/settings/actions";

export default function BranchRow({ branch }) {
  const [editing, setEditing] = useState(false);
  const [nama, setNama] = useState(branch.nama_cabang);
  const [username, setUsername] = useState(branch.tiktok_username);
  const [kategori, setKategori] = useState(branch.kategori || "");
  const [pending, startTransition] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("id", branch.id);
    fd.set("nama_cabang", nama);
    fd.set("tiktok_username", username);
    fd.set("kategori", kategori);
    startTransition(async () => {
      await updateBranch(fd);
      setEditing(false);
    });
  }

  function cancel() {
    setNama(branch.nama_cabang);
    setUsername(branch.tiktok_username);
    setKategori(branch.kategori || "");
    setEditing(false);
  }

  function toggleActive() {
    const fd = new FormData();
    fd.set("id", branch.id);
    fd.set("next", String(!branch.is_active));
    startTransition(() => toggleBranchActive(fd));
  }

  function remove() {
    const typed = window.prompt(
      `PERINGATAN: ini akan menghapus PERMANEN cabang "${branch.nama_cabang}" beserta SEMUA data terkait ` +
      `(konten, rencana konten, riwayat follower, target, anotasi). Tindakan ini TIDAK BISA dibatalkan.\n\n` +
      `Kalau memang yakin, ketik ulang nama cabang persis untuk konfirmasi:`,
    );
    if (typed === null) return; // batal
    if (typed !== branch.nama_cabang) {
      window.alert("Nama tidak cocok. Penghapusan dibatalkan.");
      return;
    }
    const fd = new FormData();
    fd.set("id", branch.id);
    fd.set("confirmName", typed);
    startTransition(() => deleteBranch(fd));
  }

  if (editing) {
    return (
      <tr className="border-t" style={{ borderColor: "rgba(0,60,68,.1)", background: "rgba(0,102,116,.04)" }}>
        <td className="py-2 pr-3">
          <input value={nama} onChange={(e) => setNama(e.target.value)} className="input-3d !min-h-0 !py-1.5 text-sm" placeholder="Nama cabang" />
        </td>
        <td className="py-2 pr-3">
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="input-3d !min-h-0 !py-1.5 text-sm" placeholder="username" />
        </td>
        <td className="py-2 pr-3">
          <input value={kategori} onChange={(e) => setKategori(e.target.value)} className="input-3d !min-h-0 !py-1.5 text-sm" placeholder="kategori (opsional)" />
        </td>
        <td className="py-2 pr-3 text-xs" style={{ color: "var(--ink-soft)" }}>{branch.is_active ? "Aktif" : "Nonaktif"}</td>
        <td className="py-2 pr-3">
          <div className="flex items-center gap-1.5">
            <Button type="button" onClick={save} disabled={pending || !nama.trim() || !username.trim()} className="!min-h-0 !px-3 !py-1.5 text-xs">
              <Check size={13} /> Simpan
            </Button>
            <Button type="button" variant="ghost" onClick={cancel} disabled={pending} className="!min-h-0 !px-3 !py-1.5 text-xs">
              <X size={13} /> Batal
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t" style={{ borderColor: "rgba(0,60,68,.1)" }}>
      <td className="py-2 pr-3 font-medium text-ink">{branch.nama_cabang}</td>
      <td className="py-2 pr-3">@{branch.tiktok_username}</td>
      <td className="py-2 pr-3">{branch.kategori || "-"}</td>
      <td className="py-2 pr-3">{branch.is_active ? "Aktif" : "Nonaktif"}</td>
      <td className="py-2 pr-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="ghost" onClick={() => setEditing(true)} disabled={pending} className="!min-h-0 !px-3 !py-1 text-xs">
            <Pencil size={12} /> Edit
          </Button>
          <Button type="button" variant="ghost" onClick={toggleActive} disabled={pending} className="!min-h-0 !px-3 !py-1 text-xs">
            {branch.is_active ? "Nonaktifkan" : "Aktifkan"}
          </Button>
          <Button type="button" variant="danger" onClick={remove} disabled={pending} className="!min-h-0 !px-3 !py-1 text-xs" title="Hapus permanen — tidak bisa dibatalkan">
            <Trash2 size={12} /> Hapus
          </Button>
        </div>
      </td>
    </tr>
  );
}

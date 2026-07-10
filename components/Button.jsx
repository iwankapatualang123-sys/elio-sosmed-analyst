// File: components/Button.jsx
// Tombol 3D reusable (blueprint bagian 23). Varian: primary (teal), success (hijau),
// ghost (putih), danger (merah — aksi hapus permanen). Aman dipakai di server & client
// component (tanpa hook).

// Fungsi: Button
// Input: props { variant, className, ...rest }. Output: elemen <button> bergaya 3D.
export default function Button({ variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "btn btn-primary",
    success: "btn btn-success",
    ghost: "btn btn-ghost",
    danger: "btn btn-danger",
  };
  const cls = variants[variant] || variants.primary;
  return <button className={`${cls} ${className}`} {...props} />;
}

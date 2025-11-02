// src/utils/roles.js
export function isEmprendedor(user) {
  if (!user) return false;
  const rolCompat = String(user.rol || "").toLowerCase();
  const arr = Array.isArray(user.roles)
    ? user.roles.map(r => (typeof r === "string" ? r.toLowerCase() : String(r?.nombre || "").toLowerCase()))
    : [];
  return (
    rolCompat === "emprendedor" ||
    arr.includes("emprendedor") ||
    !!user.es_emprendedor ||
    !!user.is_emprendedor
  );
}

export function isAdmin(user) {
  if (!user) return false;
  const rolCompat = String(user.rol || "").toLowerCase();
  const arr = Array.isArray(user.roles)
    ? user.roles.map(r => (typeof r === "string" ? r.toLowerCase() : String(r?.nombre || "").toLowerCase()))
    : [];
  return rolCompat === "admin" || arr.includes("admin");
}

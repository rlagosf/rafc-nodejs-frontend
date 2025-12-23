// src/services/auth.js
import api, { setToken, clearToken } from "./api";

export async function login(nombre_usuario, password) {
  try {
    const { data } = await api.post("/auth/login", { nombre_usuario, password });
    if (data?.rafc_token) setToken(data.rafc_token);
    return data;
  } catch (err) {
    console.error("[RAFC] Error en login:", err?.message || err);
    throw err;
  }
}

export function logout() {
  // ✅ logout local inmediato, sin esperar nada
  clearToken();
  try {
    localStorage.removeItem("user_info");
  } catch {}
}

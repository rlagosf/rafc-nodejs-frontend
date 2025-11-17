// src/services/auth.js
import api, { setToken, clearToken } from './api';

export async function login(nombre_usuario, password) {
  try {
    const { data } = await api.post('/auth/login', { nombre_usuario, password });
    if (data?.rafc_token) setToken(data.rafc_token);
    return data; // { ok, rafc_token, rol_id, user }
  } catch (err) {
    console.error('[RAFC] Error en login:', err?.message || err);
    throw err; // deja que el componente lo maneje
  }
}

export function logout() {
  clearToken();
}

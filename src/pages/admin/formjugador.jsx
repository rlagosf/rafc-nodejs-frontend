// src/pages/admin/formjugador.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import api, { getToken, clearToken } from '../../services/api';
import IsLoading from '../../components/isLoading';
import { jwtDecode } from 'jwt-decode';

/* ───────── Helpers robustos ───────── */
const asList = (raw) => {
  if (!raw) return [];
  const d = raw?.data ?? raw;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.results)) return d.results;
  if (Array.isArray(d?.roles)) return d.roles;
  return [];
};

// intenta varias rutas y variantes con / y sin /
const tryGetList = async (paths) => {
  const variants = [];
  for (const p of paths) {
    variants.push(p);
    variants.push(p.endsWith('/') ? p.slice(0, -1) : `${p}/`);
  }
  const uniq = [...new Set(variants)];
  for (const url of uniq) {
    try {
      const r = await api.get(url);
      const arr = asList(r);
      if (arr.length >= 0) return arr; // devolver aunque esté vacío
    } catch (e) {
      const st = e?.status ?? e?.response?.status;
      if (st === 401 || st === 403) throw e;
    }
  }
  return [];
};

// trim a todo string
const trimStrings = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
};

// '' → undefined (para no mandar claves innecesarias)
const emptyToUndef = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === '' ? undefined : v;
  }
  return out;
};

export default function FormJugador() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  // 🔸 Estado del formulario
  const [formData, setFormData] = useState({
    nombre_jugador: '',
    rut_jugador: '',
    fecha_nacimiento: '',
    edad: '',
    telefono: '',
    email: '',
    posicion_id: '',
    categoria_id: '',
    estado_id: '',
    talla_polera: '',
    talla_short: '',
    establec_educ_id: '',
    prevision_medica_id: '',
    nombre_apoderado: '',
    rut_apoderado: '',
    telefono_apoderado: '',
    peso: '',
    estatura: '',
    observaciones: '',
    sucursal_id: ''
  });

  // 🔸 Listas para selects
  const [posiciones, setPosiciones] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [estados, setEstados] = useState([]);
  const [establecimientos, setEstablecimientos] = useState([]);
  const [previsiones, setPrevisiones] = useState([]);
  const [sucursales, setSucursales] = useState([]);

  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);        // carga de catálogos
  const [isSubmitting, setIsSubmitting] = useState(false); // envío de formulario

  /* ───────── Validación de token ───────── */
  useEffect(() => {
    try {
      const token = getToken();
      if (!token) throw new Error('no-token');

      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded?.exp && decoded.exp < now) throw new Error('expired');

      const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
      const rol = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;
      if (![1, 2].includes(rol)) navigate('/admin', { replace: true });
    } catch {
      clearToken();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  /* ───────── Cargar catálogos (resistente) ───────── */
  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [
          _pos,
          _cat,
          _estados,
          _edu,
          _prev,
          _suc
        ] = await Promise.all([
          tryGetList(['/posiciones', '/posicion']),
          tryGetList(['/categorias', '/categoria']),
          tryGetList(['/estado', '/estados']),
          tryGetList(['/establecimientos-educ']),
          tryGetList(['/prevision-medica']),
          tryGetList(['/sucursales-real', '/sucursales'])
        ]);

        if (!alive) return;

        // Normalización mínima: {id, nombre}
        const norm = (arr, idKeys = ['id'], nameKeys = ['nombre', 'descripcion']) =>
          (Array.isArray(arr) ? arr : [])
            .map(x => {
              const idKey = idKeys.find(k => x?.[k] != null);
              const nameKey = nameKeys.find(k => typeof x?.[k] === 'string');
              const id = x?.[idKey];
              const nombre = x?.[nameKey];
              return {
                id: Number(id),
                nombre: String(nombre ?? '').trim() || String(id ?? '').trim()
              };
            })
            .filter(e => Number.isFinite(e.id));

        setPosiciones(norm(_pos, ['id', 'posicion_id']));
        setCategorias(norm(_cat, ['id', 'categoria_id']));
        setEstados(norm(_estados, ['id', 'estado_id']));
        setEstablecimientos(norm(_edu, ['id', 'establec_educ_id']));
        setPrevisiones(norm(_prev, ['id', 'prevision_medica_id']));
        setSucursales(norm(_suc, ['id'])); // sucursales_real.id

        const allEmpty = [_pos, _cat, _estados, _edu, _prev, _suc]
          .every(arr => !Array.isArray(arr) || arr.length === 0);
        if (allEmpty) setError('❌ No se pudieron cargar los datos de selección');
      } catch (err) {
        const st = err?.status ?? err?.response?.status;
        if (st === 401 || st === 403) {
          clearToken();
          navigate('/login', { replace: true });
          return;
        }
        setError('❌ No se pudieron cargar los datos de selección');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [navigate]);

  /* ───────── Autoselección si hay una sola opción ───────── */
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      posicion_id: (!prev.posicion_id && posiciones.length === 1) ? String(posiciones[0].id) : prev.posicion_id,
      categoria_id: (!prev.categoria_id && categorias.length === 1) ? String(categorias[0].id) : prev.categoria_id,
      estado_id: (!prev.estado_id && estados.length === 1) ? String(estados[0].id) : prev.estado_id,
      establec_educ_id: (!prev.establec_educ_id && establecimientos.length === 1) ? String(establecimientos[0].id) : prev.establec_educ_id,
      prevision_medica_id: (!prev.prevision_medica_id && previsiones.length === 1) ? String(previsiones[0].id) : prev.prevision_medica_id,
      sucursal_id: (!prev.sucursal_id && sucursales.length === 1) ? String(sucursales[0].id) : prev.sucursal_id,
    }));
  }, [posiciones, categorias, estados, establecimientos, previsiones, sucursales]);

  /* ───────── Helpers ───────── */
  const calcEdad = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd) return '';
    const hoy = new Date();
    const nac = new Date(yyyy_mm_dd);
    if (Number.isNaN(nac.getTime())) return '';
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return String(Math.max(0, edad));
  };

  /* ───────── Manejador de cambios ───────── */
  const handleChange = ({ target: { name, value } }) => {
    // Sanitizadores
    const onlyInt = (v) => (/^\d*$/.test(v) ? v : formData[name]);
    const onlyPhone = (v) => (/^\+?\d*$/.test(v) ? v : formData[name]);
    const onlyNum = (v) => (/^\d*([.]\d{0,2})?$/.test(v) ? v : formData[name]);

    if (name === 'rut_jugador' || name === 'rut_apoderado') value = onlyInt(value).slice(0, 8);
    if (name === 'edad') value = onlyInt(value).slice(0, 3);
    if (name === 'telefono' || name === 'telefono_apoderado') value = onlyPhone(value).slice(0, 15);
    if (name === 'peso') value = onlyNum(value).slice(0, 6);
    if (name === 'estatura') value = onlyInt(value).slice(0, 3);

    if (name === 'fecha_nacimiento') {
      const edadAuto = calcEdad(value);
      setFormData((prev) => ({ ...prev, [name]: value, edad: edadAuto }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /* ───────── Enviar ───────── */
  const enviarJugador = async (e) => {
    e.preventDefault();
    setMensaje('');
    setError('');

    // Valida suave (sólo lo imprescindible)
    const edadNum = Number(formData.edad || '0');
    if (formData.edad && (edadNum < 5 || edadNum > 100)) {
      return setError('La edad debe estar entre 5 y 100 años si la indicas');
    }

    // acepta +569..., o 9–11 dígitos sin +
    if (formData.telefono) {
      const okTel = /^\+\d{9,15}$/.test(formData.telefono) || /^\d{9,11}$/.test(formData.telefono);
      if (!okTel) return setError('Teléfono inválido: usa +569... o 9–11 dígitos.');
    }

    if (formData.rut_apoderado && !/^\d{7,8}$/.test(formData.rut_apoderado)) {
      return setError('El RUT del apoderado debe ser de 7 u 8 dígitos (sin DV).');
    }

    if ([formData.posicion_id, formData.categoria_id, formData.estado_id].some((v) => !v))
      return setError('Debes seleccionar posición, categoría y estado');

    try {
      setIsSubmitting(true);

      // Limpieza previa
      const cleaned = trimStrings(formData);

      const payload = emptyToUndef({
        ...cleaned,
        rut_jugador: cleaned.rut_jugador ? Number(cleaned.rut_jugador) : undefined,
        rut_apoderado: cleaned.rut_apoderado ? Number(cleaned.rut_apoderado) : undefined,
        edad: cleaned.edad ? edadNum : undefined,
        posicion_id: cleaned.posicion_id ? Number(cleaned.posicion_id) : undefined,
        categoria_id: cleaned.categoria_id ? Number(cleaned.categoria_id) : undefined,
        estado_id: cleaned.estado_id ? Number(cleaned.estado_id) : undefined,
        establec_educ_id: cleaned.establec_educ_id ? Number(cleaned.establec_educ_id) : undefined,
        prevision_medica_id: cleaned.prevision_medica_id ? Number(cleaned.prevision_medica_id) : undefined,
        sucursal_id: cleaned.sucursal_id ? Number(cleaned.sucursal_id) : undefined,
        // fecha_nacimiento: llega como yyyy-mm-dd del input date → backend ya lo coerciona
      });

      console.debug('POST /jugadores payload →', payload);
      const res = await api.post('/jugadores', payload);

      const body = res?.data || {};
      setMensaje(`✅ Jugador registrado: ${body?.nombre_jugador || cleaned.nombre_jugador || (body?.id ? `ID ${body.id}` : 'OK')}`);
      setFormData({
        nombre_jugador: '',
        rut_jugador: '',
        fecha_nacimiento: '',
        edad: '',
        telefono: '',
        email: '',
        posicion_id: '',
        categoria_id: '',
        estado_id: '',
        talla_polera: '',
        talla_short: '',
        establec_educ_id: '',
        prevision_medica_id: '',
        nombre_apoderado: '',
        rut_apoderado: '',
        telefono_apoderado: '',
        peso: '',
        estatura: '',
        observaciones: '',
        sucursal_id: ''
      });
    } catch (err) {
      // Soporta error normalizado (api.js) y crudo (axios)
      const st = err?.status ?? err?.response?.status ?? 0;
      const data = err?.data ?? err?.response?.data ?? null;
      const text = err?.request?.responseText;
      const msg = data?.message ?? err?.message ?? (text ? String(text).slice(0, 300) : 'Error');
      const field = data?.field;
      const detail = data?.detail ?? data?.sqlMessage ?? data?.sql;

      if (st === 401 || st === 403) {
        clearToken();
        return navigate('/login', { replace: true });
      }

      if (!data && st === 500) {
        setError('❌ Error 500 sin cuerpo de respuesta (revisar logs del backend).');
      } else if (field) {
        setError(`${msg} (campo: ${field})`);
      } else {
        setError(msg);
      }

      console.warn('❌ Backend /jugadores error (raw):', { st, data, detail, text, err });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ───────── Clases ───────── */
  const c = {
    fondo: darkMode ? 'bg-[#111827] text-white' : 'bg-white text-[#1d0b0b]',
    tarjeta: darkMode ? 'bg-[#1f2937] text-white' : 'bg-white text-[#1d0b0b]',
    input:
      (darkMode
        ? 'bg-[#1f2937] text-white border border-gray-600 placeholder-gray-400'
        : 'bg-white text-black border border-gray-300 placeholder-gray-500') + ' w-full box-border'
  };

  if (isLoading) return <IsLoading />;

  /* ───────── Render ───────── */
  return (
    <div className={`${c.fondo} px-4 pt-4 pb-16 font-realacademy`}>
      {/* Breadcrumb eliminado (lo maneja el layout) */}

      <h2 className="text-2xl font-bold mb-4 text-center">Registrar Jugador</h2>

      <div className={`${c.tarjeta} shadow-lg rounded-2xl p-4 sm:p-6 w-full max-w-full md:max-w-2xl mx-auto`}>
        {error && (
          <div className="mb-4 p-3 rounded border border-red-400 text-red-600 bg-red-50">
            {error}
          </div>
        )}

        <form onSubmit={enviarJugador} className="grid md:grid-cols-1 lg:grid-cols-1 gap-4 text-sm">
          {/* Inputs simples */}
          {[
            ['nombre_jugador', 'Nombre', true],
            ['rut_jugador', 'RUT (sin puntos ni guion ni dígito verificador)', true],
            ['fecha_nacimiento', 'Fecha de Nacimiento', false, 'date'],
            ['edad', 'Edad', false],
            ['telefono', 'Teléfono (+56... o 9–11 dígitos)', false],
            ['email', 'Correo', false, 'email'],
            ['talla_polera', 'Talla Polera'],
            ['talla_short', 'Talla Short'],
            ['nombre_apoderado', 'Nombre Apoderado'],
            ['rut_apoderado', 'RUT Apoderado (sin puntos ni guion ni dígito verificador)'],
            ['telefono_apoderado', 'Teléfono Apoderado (+56...)'],
            ['peso', 'Peso (kg)'],
            ['estatura', 'Estatura (cm)']
          ].map(([name, placeholder, req, type = 'text']) => (
            <input
              key={name}
              name={name}
              type={type}
              value={formData[name]}
              onChange={handleChange}
              placeholder={placeholder}
              required={!!req}
              className={`${c.input} p-2 rounded`}
            />
          ))}

          {/* Selects */}
          <select
            name="posicion_id"
            value={formData.posicion_id}
            onChange={handleChange}
            required
            className={`${c.input} p-2 rounded`}
          >
            <option value="">Posición</option>
            {posiciones.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>

          <select
            name="categoria_id"
            value={formData.categoria_id}
            onChange={handleChange}
            required
            className={`${c.input} p-2 rounded`}
          >
            <option value="">Categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>

          <select
            name="estado_id"
            value={formData.estado_id}
            onChange={handleChange}
            required
            className={`${c.input} p-2 rounded`}
          >
            <option value="">Estado</option>
            {estados.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>

          <select
            name="establec_educ_id"
            value={formData.establec_educ_id}
            onChange={handleChange}
            className={`${c.input} p-2 rounded`}
          >
            <option value="">Establecimiento Educacional</option>
            {establecimientos.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>

          <select
            name="prevision_medica_id"
            value={formData.prevision_medica_id}
            onChange={handleChange}
            className={`${c.input} p-2 rounded`}
          >
            <option value="">Previsión Médica</option>
            {previsiones.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>

          {/* Sucursal */}
          <select
            name="sucursal_id"
            value={formData.sucursal_id}
            onChange={handleChange}
            className={`${c.input} p-2 rounded`}
          >
            <option value="">Sucursal</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>

          {/* Observaciones */}
          <textarea
            name="observaciones"
            value={formData.observaciones}
            onChange={handleChange}
            placeholder="Observaciones"
            className={`${c.input} col-span-full p-2 rounded h-24 resize-none`}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className={`col-span-full ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''} bg-blue-600 text-white py-2 rounded hover:bg-blue-700`}
          >
            {isSubmitting ? 'Guardando…' : 'Guardar'}
          </button>
        </form>

        {mensaje && <p className="text-green-500 mt-4 text-center">{mensaje}</p>}
      </div>
    </div>
  );
}

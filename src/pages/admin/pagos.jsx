import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import api, { getToken, clearToken } from '../../services/api';
import IsLoading from '../../components/isLoading';
import { jwtDecode } from 'jwt-decode';
import { useMobileAutoScrollTop } from '../../hooks/useMobileScrollTop';

export default function Pagos() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // RUT desde state o query (?rut=)
  const selectedRut =
    location.state?.rut ||
    new URLSearchParams(location.search).get('rut') ||
    '';

  // Ruta de retorno
  const backTo = location.state?.from || '/admin/gestionar-pagos';
  const currentPath = location.pathname + location.search;

  // ✅ Asegura breadcrumb: Inicio / Gestionar pagos / Registrar pago
  useEffect(() => {
    const prev = Array.isArray(location.state?.breadcrumb)
      ? location.state.breadcrumb
      : null;

    // Si no hay breadcrumbs, setear ambos por defecto
    if (!prev) {
      const breadcrumbs = [
        { label: 'Gestionar pagos', to: '/admin/gestionar-pagos' },
        { label: 'Registrar pago', to: currentPath }
      ];
      navigate(currentPath, {
        replace: true,
        state: {
          ...(location.state || {}),
          breadcrumb: breadcrumbs,
          from: backTo,
          rut: selectedRut
        }
      });
      return;
    }

    // Si existe, garantizar último = "Registrar pago" sin duplicar
    const last = prev[prev.length - 1];
    if (!last || last.label !== 'Registrar pago') {
      const updated = [...prev, { label: 'Registrar pago', to: currentPath }];
      navigate(currentPath, {
        replace: true,
        state: {
          ...(location.state || {}),
          breadcrumb: updated,
          from: backTo,
          rut: selectedRut
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  useMobileAutoScrollTop();


  const [form, setForm] = useState({
    tipo_pago_id: '',
    situacion_pago_id: '',
    monto: '',
    fecha_pago: '',
    medio_pago_id: '',
    comprobante_url: '',
    observaciones: ''
  });

  const [tiposPago, setTiposPago] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);
  const [situacionesPago, setSituacionesPago] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rol, setRol] = useState(null);

  // Auth: solo admin (1)
  useEffect(() => {
    try {
      const token = getToken();
      if (!token) throw new Error('no-token');
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded?.exp && decoded.exp < now) throw new Error('expired');

      const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
      const parsed = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;
      if (parsed !== 1) {
        navigate('/admin', { replace: true });
        return;
      }
      setRol(parsed);
    } catch {
      clearToken();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Si no viene RUT → regresar al origen
  useEffect(() => {
    if (rol === 1 && !selectedRut) {
      navigate(backTo, { replace: true });
    }
  }, [rol, selectedRut, backTo, navigate]);

  // ── Helpers
  const normalizeListResponse = (res) => {
    if (!res || res.status === 204) return [];
    const d = res?.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.results)) return d.results;
    if (Array.isArray(d?.items)) return d.items;
    return [];
  };

  const tryGetList = async (paths, signal) => {
    const variants = [];
    for (const p of paths) {
      if (p.endsWith('/')) variants.push(p, p.slice(0, -1));
      else variants.push(p, `${p}/`);
    }
    const uniq = [...new Set(variants)];
    for (const url of uniq) {
      try {
        const r = await api.get(url, { signal });
        return normalizeListResponse(r)
          .map((x) => ({
            id: Number(x?.id ?? x?.value ?? x?.key),
            nombre: String(x?.nombre ?? x?.descripcion ?? x?.label ?? '')
          }))
          .filter((x) => Number.isFinite(x.id) && x.nombre);
      } catch (e) {
        const st = e?.response?.status;
        if (st === 401 || st === 403) throw e;
        continue;
      }
    }
    return [];
  };

  const prettyBackendErrors = (data) => {
    try {
      if (!data) return null;
      if (data.errors?.fieldErrors) {
        const fe = data.errors.fieldErrors;
        const msgs = Object.entries(fe).flatMap(([k, arr]) =>
          (arr || []).map((m) => `[${k}] ${m}`)
        );
        if (msgs.length) return msgs.join(' | ');
      }
      if (Array.isArray(data.detail) && data.detail.length) {
        return data.detail
          .map((d) => `[${(d.loc || []).join('.')}] ${d.msg}`)
          .join(' | ');
      }
      if (typeof data.detail === 'string') return data.detail;
      if (typeof data.message === 'string') return data.message;
    } catch {}
    return null;
  };

  const isPositiveAmount = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
  };

  // ── Carga catálogos
  useEffect(() => {
    if (rol !== 1 || !selectedRut) return;
    const abort = new AbortController();
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [tipos, medios, situaciones] = await Promise.all([
          tryGetList(['/tipo-pago'], abort.signal),
          tryGetList(['/medio-pago'], abort.signal),
          tryGetList(['/situacion-pago'], abort.signal)
        ]);

        if (abort.signal.aborted) return;
        setTiposPago(tipos);
        setMediosPago(medios);
        setSituacionesPago(situaciones);

        if (!tipos.length || !medios.length || !situaciones.length) {
          setError('⚠️ No se pudieron cargar todos los catálogos. Verifica las rutas de API.');
        }
      } catch (err) {
        if (abort.signal.aborted) return;
        const st = err?.response?.status;
        if (st === 401 || st === 403) {
          clearToken();
          navigate('/login', { replace: true });
          return;
        }
        setError('❌ Error al cargar listas de selección');
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    })();
    return () => abort.abort();
  }, [rol, selectedRut, navigate]);

  // ── Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'monto' && !/^\d*\.?\d{0,2}$/.test(value)) return; // hasta 2 decimales
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Submit consistente con backend (POST /pagos-jugador)
  const submitPago = async () => {
    const payload = {
      jugador_rut: Number(selectedRut),
      tipo_pago_id: Number(form.tipo_pago_id),
      situacion_pago_id: Number(form.situacion_pago_id),
      monto: Number(form.monto),
      fecha_pago: String(form.fecha_pago || '').trim(), // YYYY-MM-DD
      medio_pago_id: Number(form.medio_pago_id),
      comprobante_url: form.comprobante_url?.trim() || null,
      observaciones: form.observaciones?.trim() || null
    };
    return api.post('/pagos-jugador', payload);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setError('');
    setIsSubmitting(true);

    if (
      !selectedRut ||
      !form.tipo_pago_id ||
      !form.situacion_pago_id ||
      !form.monto ||
      !form.fecha_pago ||
      !form.medio_pago_id
    ) {
      setError('Debes completar todos los campos obligatorios.');
      setIsSubmitting(false);
      return;
    }
    if (!isPositiveAmount(form.monto)) {
      setError('El monto debe ser mayor a 0.');
      setIsSubmitting(false);
      return;
    }

    try {
      await submitPago();
      setMensaje('✅ Pago registrado correctamente');
      setForm({
        tipo_pago_id: '',
        situacion_pago_id: '',
        monto: '',
        fecha_pago: '',
        medio_pago_id: '',
        comprobante_url: '',
        observaciones: ''
      });
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      const data = err?.response?.data ?? {};
      const human = prettyBackendErrors(data);
      setError(human || `❌ Error al registrar el pago (HTTP ${st || 'desconocido'})`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Estilos
  const fondoClase = darkMode ? 'bg-[#111827] text-white' : 'bg-white text-[#1d0b0b]';
  const tarjetaClase = darkMode ? 'bg-[#1f2937] text-white' : 'bg-white text-[#1d0b0b]';
  const inputClase =
    (darkMode
      ? 'bg-[#1f2937] text-white border border-gray-600 placeholder-gray-400'
      : 'bg-white text-black border border-gray-300 placeholder-gray-500') + ' w-full p-2 rounded';

  const disableSubmit = useMemo(() => {
    return (
      !selectedRut ||
      !form.tipo_pago_id ||
      !form.situacion_pago_id ||
      !form.monto ||
      !form.fecha_pago ||
      !form.medio_pago_id ||
      isSubmitting
    );
  }, [selectedRut, form, isSubmitting]);

  if (isLoading) return <IsLoading />;

  return (
    <div className={`${fondoClase} px-4 pt-4 pb-10 font-realacademy`}>
      {/* 🧭 El DashboardLayout pinta: Inicio / Gestionar pagos / Registrar pago */}

      <h2 className="text-2xl font-bold mb-6 text-center">Registrar Pago</h2>

      <div className={`${tarjetaClase} border shadow-lg rounded-2xl p-8 max-w-3xl mx-auto`}>
        {/* RUT seleccionado (solo lectura) */}
        <div className="mb-4 text-sm">
          <span className="font-semibold">RUT jugador: </span>
          <span className="inline-block px-2 py-1 rounded border">{selectedRut}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <select
            name="tipo_pago_id"
            value={form.tipo_pago_id}
            onChange={handleChange}
            className={inputClase}
            required
          >
            <option value="">Seleccione Tipo de Pago</option>
            {tiposPago.map((tipo) => (
              <option key={tipo.id} value={String(tipo.id)}>{tipo.nombre}</option>
            ))}
          </select>

          <select
            name="situacion_pago_id"
            value={form.situacion_pago_id}
            onChange={handleChange}
            className={inputClase}
            required
          >
            <option value="">Seleccione Situación del Pago</option>
            {situacionesPago.map((sp) => (
              <option key={sp.id} value={String(sp.id)}>{sp.nombre}</option>
            ))}
          </select>

          <input
            name="monto"
            value={form.monto}
            onChange={handleChange}
            placeholder="Monto $"
            className={inputClase}
            inputMode="decimal"
            required
          />

          <input
            name="fecha_pago"
            type="date"
            value={form.fecha_pago}
            onChange={handleChange}
            className={inputClase}
            required
          />

          <select
            name="medio_pago_id"
            value={form.medio_pago_id}
            onChange={handleChange}
            className={inputClase}
            required
          >
            <option value="">Seleccione Medio de Pago</option>
            {mediosPago.map((medio) => (
              <option key={medio.id} value={String(medio.id)}>{medio.nombre}</option>
            ))}
          </select>

          <input
            name="comprobante_url"
            value={form.comprobante_url}
            onChange={handleChange}
            placeholder="URL Comprobante (opcional)"
            className={inputClase}
          />

          <textarea
            name="observaciones"
            value={form.observaciones}
            onChange={handleChange}
            placeholder="Observaciones (opcional)"
            className={inputClase}
            rows={3}
          />

          <button
            type="submit"
            disabled={disableSubmit}
            className={`w-full py-2 rounded transition duration-300 ${
              disableSubmit ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#e82d89] text-white hover:bg-[#c61f74]'
            }`}
          >
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </button>
        </form>

        {mensaje && <p className="text-green-500 mt-4 text-center">{mensaje}</p>}
        {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
      </div>
    </div>
  );
}

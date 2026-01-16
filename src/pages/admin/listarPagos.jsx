// src/pages/admin/listarPagos.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import api, { getToken, clearToken } from "../../services/api";
import { jwtDecode } from "jwt-decode";
import { formatRutWithDV } from "../../services/rut";
import { Pencil, Trash2, X, CreditCard } from "lucide-react";
import { useMobileAutoScrollTop } from "../../hooks/useMobileScrollTop";

/* ─────────────────────────────
   CONSTANTES NEGOCIO
───────────────────────────── */
const ESTADO_JUGADOR_ACTIVO = 1;
const TIPO_PAGO_MENSUALIDAD = 3;
const SITUACION_PAGO_PAGADO_ID = 1; // Ajusta si tu catálogo usa otro ID

/* ─────────────────────────────
   HELPERS (MISMA LÓGICA detalleJugador.jsx)
───────────────────────────── */
const asList = (raw) => {
  if (!raw) return [];
  const d = raw?.data ?? raw;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.results)) return d.results;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.rows)) return d.rows;
  return [];
};

const tryGetList = async (paths, signal) => {
  const variants = [];
  for (const p of paths) {
    variants.push(p.endsWith("/") ? p : `${p}/`);
    variants.push(p.endsWith("/") ? p.slice(0, -1) : p);
  }
  const uniq = [...new Set(variants)];
  for (const url of uniq) {
    try {
      const r = await api.get(url, { signal });
      return asList(r);
    } catch (e) {
      const st = e?.response?.status;
      if (st === 401 || st === 403) throw e;
      continue;
    }
  }
  return [];
};

// Igual que en detalleJugador: id + nombre/descripcion
const normalizeCatalog = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map((x) => ({
      id: Number(
        x?.id ??
          x?.posicion_id ??
          x?.categoria_id ??
          x?.establec_educ_id ??
          x?.prevision_medica_id ??
          x?.estado_id ??
          x?.sucursal_id ??
          x?.comuna_id
      ),
      nombre: String(x?.nombre ?? x?.descripcion ?? "").trim(),
    }))
    .filter((x) => Number.isFinite(x.id) && x.nombre);

const buildIdNameMap = (arr, idKey = "id", nameKey = "nombre") => {
  const m = new Map();
  for (const x of Array.isArray(arr) ? arr : []) {
    const id = x?.[idKey];
    const name = x?.[nameKey] ?? String(id ?? "—");
    if (id != null) m.set(String(id), String(name).trim());
  }
  return m;
};

const normalizePagos = (arr, { tipoPagoMap, medioPagoMap, situacionPagoMap, jugadoresMap }) => {
  const list = Array.isArray(arr) ? arr : [];
  return list.map((p) => {
    const tipoId = p?.tipo_pago_id ?? p?.tipo_id ?? p?.tipoPagoId ?? p?.tipo_pago?.id ?? null;
    const medioId = p?.medio_pago_id ?? p?.medio_id ?? p?.medioPagoId ?? p?.medio_pago?.id ?? null;
    const situId =
      p?.situacion_pago_id ?? p?.estado_pago_id ?? p?.estado_id ?? p?.situacion_pago?.id ?? null;

    const rutPlano =
      p?.jugador_rut ??
      p?.rut_jugador ??
      p?.rut ??
      p?.jugador?.rut_jugador ??
      p?.jugador?.rut ??
      null;

    const jAnidado = p?.jugador ?? {};
    const jFromMap = rutPlano != null ? jugadoresMap.get(String(rutPlano)) : null;

    const jugadorNombre =
      jAnidado?.nombre_jugador ??
      jAnidado?.nombre ??
      jAnidado?.nombre_completo ??
      jFromMap?.nombre ??
      p?.jugador_nombre ??
      p?.nombre_jugador ??
      "—";

    const catId = jAnidado?.categoria?.id ?? jAnidado?.categoria_id ?? jFromMap?.categoria?.id ?? null;

    const catNombre =
      jAnidado?.categoria?.nombre ??
      jAnidado?.categoria_nombre ??
      jFromMap?.categoria?.nombre ??
      (typeof jAnidado?.categoria === "string" ? jAnidado?.categoria : null) ??
      "Sin categoría";

    const tipoNombre =
      p?.tipo_pago?.nombre ??
      p?.tipo_pago_nombre ??
      (tipoId != null ? tipoPagoMap.get(String(tipoId)) ?? String(tipoId) : "—");

    const medioNombre =
      p?.medio_pago?.nombre ??
      p?.medio_pago_nombre ??
      (medioId != null ? medioPagoMap.get(String(medioId)) ?? String(medioId) : "—");

    const situNombre =
      p?.situacion_pago?.nombre ??
      p?.estado_pago_nombre ??
      p?.estado_nombre ??
      (situId != null ? situacionPagoMap.get(String(situId)) ?? String(situId) : "—");

    const fecha = p?.fecha_pago ?? p?.fecha ?? null;

    return {
      id: p?.id ?? p?.ID ?? null,
      monto: Number(p?.monto ?? 0),
      fecha_pago: fecha,
      jugador: {
        rut_jugador: rutPlano ?? "—",
        nombre_jugador: jugadorNombre,
        categoria: { id: catId, nombre: catNombre },
      },
      tipo_pago: { id: tipoId, nombre: tipoNombre },
      situacion_pago: { id: situId, nombre: situNombre },
      medio_pago: { id: medioId, nombre: medioNombre },
      observaciones: p?.observaciones ?? "",
    };
  });
};

/* ─────────────────────────────
   COMPONENTE
───────────────────────────── */
export default function ListarPagos() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  useMobileAutoScrollTop();

  // 🔐 Auth / estado base
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [pagos, setPagos] = useState([]);
  const [jugadoresActivos, setJugadoresActivos] = useState([]);

  const [tipoPagoMap, setTipoPagoMap] = useState(new Map());
  const [medioPagoMap, setMedioPagoMap] = useState(new Map());
  const [situacionPagoMap, setSituacionPagoMap] = useState(new Map());
  const [jugadoresMap, setJugadoresMap] = useState(new Map());

  // ✅ Catálogos normalizados al estilo detalleJugador
  const [categoriasCat, setCategoriasCat] = useState([]); // opcional (por consistencia)
  const [sucursalesCat, setSucursalesCat] = useState([]);

  // Filtros pagos
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState(""); // PAGADO / VENCIDO
  const [filtroTipoPago, setFiltroTipoPago] = useState(""); // id tipo_pago
  const [filtroCategoriaSel, setFiltroCategoriaSel] = useState("");
  const [filtroMedioPago, setFiltroMedioPago] = useState(""); // id medio_pago

  // Paginación pagos
  const PAGE_SIZE = 10;
  const MAX_PAGES = 200;
  const [page, setPage] = useState(1);

  // 🆕 Sección pagos manuales: filtro + paginación
  const MANUAL_PAGE_SIZE = 10;
  const [manualFiltro, setManualFiltro] = useState("");
  const [manualPage, setManualPage] = useState(1);

  // Modal edición/registro
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");

  // ✅ Modal de éxito + recarga visual
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [reloadBusy, setReloadBusy] = useState(false);

  const [editForm, setEditForm] = useState({
    id: null,

    // flags
    virtual: false, // mensualidad vencida virtual -> POST
    create: false, // pago manual nuevo -> POST

    jugador_rut: "",
    monto: "",
    fecha_pago: "",
    tipo_pago_id: "",
    medio_pago_id: "",
    situacion_pago_id: "",
    observaciones: "",
  });

  // 🔐 Validación de sesión y autorización (solo admin = rol 1)
  useEffect(() => {
    try {
      const token = getToken();
      if (!token) throw new Error("no-token");

      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);

      if (!decoded?.exp || decoded.exp <= now) {
        clearToken();
        navigate("/login", { replace: true });
        return;
      }

      const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
      const rol = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;

      if (rol !== 1) {
        navigate("/admin", { replace: true });
        return;
      }
    } catch {
      clearToken();
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // 🧭 Breadcrumb por defecto
  useEffect(() => {
    if (!Array.isArray(location.state?.breadcrumb)) {
      navigate(location.pathname + location.search, {
        replace: true,
        state: {
          ...(location.state || {}),
          breadcrumb: [{ to: location.pathname, label: "Pagos centralizados" }],
        },
      });
    }
  }, [location, navigate]);

  // 📡 Carga catálogos + jugadores + pagos
  useEffect(() => {
    const abort = new AbortController();

    (async () => {
      setIsLoading(true);
      setError("");

      try {
        const [tipos, medios, situaciones, jugadoresList, categoriasRaw, sucursalesRaw] =
          await Promise.all([
            tryGetList(["/tipo-pago", "/tipo_pago"], abort.signal),
            tryGetList(["/medio-pago", "/medio_pago"], abort.signal),
            tryGetList(
              ["/situacion-pago", "/situacion_pago", "/estado-pago", "/estado_pago"],
              abort.signal
            ),
            tryGetList(["/jugadores"], abort.signal),
            tryGetList(["/categorias"], abort.signal),

            // ✅ MISMA ruta que tu detalleJugador.jsx
            tryGetList(["/sucursales-real"], abort.signal),
          ]);

        if (abort.signal.aborted) return;

        // Maps catálogos pagos
        const tipoMap = buildIdNameMap(tipos, "id", "nombre");
        const medioMap = buildIdNameMap(medios, "id", "nombre");
        const situMap = buildIdNameMap(situaciones, "id", "nombre");
        setTipoPagoMap(tipoMap);
        setMedioPagoMap(medioMap);
        setSituacionPagoMap(situMap);

        // ✅ Normalización estilo detalleJugador
        const _categorias = normalizeCatalog(categoriasRaw);
        const _sucursales = normalizeCatalog(sucursalesRaw);
        setCategoriasCat(_categorias);
        setSucursalesCat(_sucursales);

        const catMap = new Map(_categorias.map((c) => [Number(c.id), c.nombre]));
        const sucMap = new Map(_sucursales.map((s) => [Number(s.id), s.nombre]));

        // ✅ SOLO activos
        const activos = (Array.isArray(jugadoresList) ? jugadoresList : []).filter((j) => {
          const estadoId = Number(j?.estado_id ?? j?.estadoId ?? j?.estado ?? 0);
          return estadoId === ESTADO_JUGADOR_ACTIVO;
        });
        setJugadoresActivos(activos);

        // ✅ jugadoresMap enriquecido (incluye sucursal nombre usando sucMap)
        const jm = new Map();
        for (const j of activos) {
          const rut = j?.rut_jugador ?? j?.rut ?? null;
          if (rut == null) continue;

          const categoriaId = j?.categoria_id ?? j?.categoria?.id ?? null;
          const categoriaNombre =
            j?.categoria?.nombre ??
            j?.categoria_nombre ??
            (categoriaId != null ? catMap.get(Number(categoriaId)) ?? String(categoriaId) : null) ??
            (typeof j?.categoria === "string" ? j.categoria : null) ??
            "Sin categoría";

          const sucursalId = j?.sucursal_id ?? j?.sucursal?.id ?? j?.id_sucursal ?? null;
          const sucursalNombre =
            j?.sucursal?.nombre ??
            j?.sucursal_nombre ??
            j?.nombre_sucursal ??
            (sucursalId != null ? sucMap.get(Number(sucursalId)) : null) ??
            (sucursalId != null ? `Sucursal ${sucursalId}` : null) ??
            "Sin sucursal";

          jm.set(String(rut), {
            nombre: j?.nombre_jugador ?? j?.nombre ?? j?.nombre_completo ?? "—",
            categoria: { id: categoriaId, nombre: categoriaNombre },
            sucursal: { id: sucursalId, nombre: sucursalNombre },
          });
        }
        setJugadoresMap(jm);

        // Pagos (estado cuenta)
        const respEstado = await api.get("/pagos-jugador/estado-cuenta", { signal: abort.signal });
        if (abort.signal.aborted) return;

        const rawPagos = Array.isArray(respEstado?.data?.pagos) ? respEstado.data.pagos : [];

        // ✅ Filtrar pagos solo de activos
        const rutsActivos = new Set(Array.from(jm.keys()));
        const rawPagosActivos = rawPagos.filter((p) => {
          const rut =
            p?.jugador_rut ??
            p?.rut_jugador ??
            p?.rut ??
            p?.jugador?.rut_jugador ??
            p?.jugador?.rut;
          return rut != null && rutsActivos.has(String(rut));
        });

        const pagosNorm = normalizePagos(rawPagosActivos, {
          tipoPagoMap: tipoMap,
          medioPagoMap: medioMap,
          situacionPagoMap: situMap,
          jugadoresMap: jm,
        });

        setPagos(pagosNorm);
      } catch (e) {
        if (abort.signal.aborted) return;
        const st = e?.response?.status;
        if (st === 401 || st === 403) {
          clearToken();
          navigate("/login", { replace: true });
          return;
        }
        setError("❌ No se pudieron cargar los pagos centralizados.");
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    })();

    return () => abort.abort();
  }, [navigate]);

  // 🎨 Estilos
  const fondoClase = darkMode ? "bg-[#111827] text-white" : "bg-white text-[#1d0b0b]";
  const tablaCabecera = darkMode ? "bg-[#1f2937] text-white" : "bg-gray-100 text-[#1d0b0b]";
  const filaHover = darkMode ? "hover:bg-[#111827]" : "hover:bg-gray-50";

  const controlBase = darkMode
    ? "border border-gray-500 bg-[#1f2937] text-white placeholder-gray-400"
    : "border border-gray-300 bg-white text-black placeholder-gray-500";
  const controlClase = `${controlBase} w-full h-10 px-3 rounded-md text-sm leading-none`;

  const toCLP = (n) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(Number(n || 0));

  const estadoPillClass = (estadoRaw) => {
    const estado = (estadoRaw ?? "").toString().trim().toUpperCase();
    if (estado === "PAGADO") return "bg-green-100 text-green-800 border border-green-300";
    if (estado === "VENCIDO") return "bg-red-100 text-red-800 border border-red-300";
    return "bg-gray-100 text-gray-800 border border-gray-300";
  };

  /* ─────────────────────────────
     Construcción de filas (incluye vencidos virtuales)
  ───────────────────────────── */
  const filas = useMemo(() => {
    const rows = [];
    const tieneMensualidad = new Set();

    for (const p of pagos) {
      const rut = String(p?.jugador?.rut_jugador ?? "");
      const nombre = p?.jugador?.nombre_jugador ?? "—";
      const categoria =
        p?.jugador?.categoria?.nombre ??
        (typeof p?.jugador?.categoria === "string" ? p.jugador.categoria : null) ??
        "Sin categoría";

      const estado = p?.situacion_pago?.nombre || "—";
      const tipoId = p?.tipo_pago?.id ?? null;

      if (String(tipoId) === String(TIPO_PAGO_MENSUALIDAD)) {
        if (rut) tieneMensualidad.add(rut);
      }

      const ts = (() => {
        if (!p?.fecha_pago) return 0;
        const d = new Date(p.fecha_pago);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      })();

      rows.push({
        key: p?.id ?? `${rut}-${ts}`,
        id: p?.id ?? null,
        rut,
        nombre,
        categoria,
        estado,
        pago: p,
        ts,
        virtual: false,
      });
    }

    // Filas virtuales vencidas para los activos SIN mensualidad
    for (const [rut, j] of jugadoresMap.entries()) {
      if (!tieneMensualidad.has(String(rut))) {
        rows.push({
          key: `VIRTUAL-${rut}`,
          id: `VIRTUAL-${rut}`,
          rut: String(rut),
          nombre: j?.nombre ?? "—",
          categoria: j?.categoria?.nombre ?? "Sin categoría",
          estado: "VENCIDO",
          pago: {
            id: null,
            monto: 0,
            fecha_pago: null,
            jugador: {
              rut_jugador: String(rut),
              nombre_jugador: j?.nombre ?? "—",
              categoria: j?.categoria ?? null,
            },
            tipo_pago: {
              id: TIPO_PAGO_MENSUALIDAD,
              nombre: tipoPagoMap.get(String(TIPO_PAGO_MENSUALIDAD)) ?? "Mensualidad",
            },
            situacion_pago: { id: null, nombre: "VENCIDO" },
            medio_pago: { id: null, nombre: "—" },
            observaciones: "",
          },
          ts: 0,
          virtual: true,
        });
      }
    }

    const pesoEstado = (estadoRaw) => {
      const e = (estadoRaw ?? "").toString().toUpperCase();
      if (e === "VENCIDO") return 0;
      if (e === "PAGADO") return 1;
      return 2;
    };

    rows.sort((a, b) => {
      const ea = pesoEstado(a.estado);
      const eb = pesoEstado(b.estado);
      if (ea !== eb) return ea - eb;
      return b.ts - a.ts;
    });

    return rows;
  }, [pagos, jugadoresMap, tipoPagoMap]);

  // Opciones filtros pagos
  const opcionesTipoPago = useMemo(() => {
    const m = new Map();
    for (const r of filas) {
      const id = r?.pago?.tipo_pago?.id;
      const nombre = r?.pago?.tipo_pago?.nombre;
      if (!id || !nombre) continue;
      m.set(String(id), nombre);
    }
    return Array.from(m, ([value, label]) => ({ value, label }));
  }, [filas]);

  const opcionesCategoria = useMemo(() => {
    const s = new Set();
    for (const r of filas) {
      if (r?.categoria) s.add(r.categoria);
    }
    return Array.from(s).map((label) => ({ value: label, label }));
  }, [filas]);

  const opcionesMedioPago = useMemo(() => {
    const m = new Map();
    for (const r of filas) {
      const id = r?.pago?.medio_pago?.id;
      const nombre = r?.pago?.medio_pago?.nombre;
      if (!id || !nombre) continue;
      m.set(String(id), nombre);
    }
    return Array.from(m, ([value, label]) => ({ value, label }));
  }, [filas]);

  // Filtros pagos
  const filasFiltradas = useMemo(() => {
    const f = (filtroTexto || "").toLowerCase().trim();

    return filas.filter((row) => {
      const pago = row.pago ?? {};
      const rut = row.rut || "";
      const nombre = row.nombre || "";
      const categoria = row.categoria || "";

      let okTexto = true;
      if (f) {
        okTexto =
          rut.includes(f) ||
          formatRutWithDV(rut).toLowerCase().includes(f) ||
          nombre.toLowerCase().includes(f) ||
          categoria.toLowerCase().includes(f);
      }

      let okEstado = true;
      if (filtroEstado) okEstado = (row.estado ?? "").toUpperCase() === filtroEstado.toUpperCase();

      let okTipo = true;
      if (filtroTipoPago) {
        const idTipo = pago?.tipo_pago?.id ? String(pago.tipo_pago.id) : "";
        okTipo = idTipo === filtroTipoPago;
      }

      let okCat = true;
      if (filtroCategoriaSel) okCat = row.categoria === filtroCategoriaSel;

      let okMedio = true;
      if (filtroMedioPago) {
        const idMedio = pago?.medio_pago?.id ? String(pago.medio_pago.id) : "";
        okMedio = idMedio === filtroMedioPago;
      }

      return okTexto && okEstado && okTipo && okCat && okMedio;
    });
  }, [filas, filtroTexto, filtroEstado, filtroTipoPago, filtroCategoriaSel, filtroMedioPago]);

  const totalPages = useMemo(() => {
    const tp = Math.ceil(filasFiltradas.length / PAGE_SIZE);
    return Math.max(1, Math.min(tp, MAX_PAGES));
  }, [filasFiltradas]);

  useEffect(() => setPage(1), [filtroTexto, filtroEstado, filtroTipoPago, filtroCategoriaSel, filtroMedioPago]);

  const pageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filasFiltradas.slice(start, end);
  }, [filasFiltradas, page]);

  /* ─────────────────────────────
     Sección: jugadores para pagos manuales
  ───────────────────────────── */
  const jugadoresManualRows = useMemo(() => {
    const f = (manualFiltro || "").toLowerCase().trim();

    const rows = Array.from(jugadoresMap.entries()).map(([rut, j]) => ({
      rut: String(rut),
      nombre: j?.nombre ?? "—",
      categoria: j?.categoria?.nombre ?? "Sin categoría",
      sucursal: j?.sucursal?.nombre ?? "Sin sucursal",
    }));

    const filtrados = !f
      ? rows
      : rows.filter((r) => {
          const rutFmt = formatRutWithDV(r.rut).toLowerCase();
          return (
            r.rut.includes(f) ||
            rutFmt.includes(f) ||
            r.nombre.toLowerCase().includes(f) ||
            r.categoria.toLowerCase().includes(f) ||
            r.sucursal.toLowerCase().includes(f)
          );
        });

    filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return filtrados;
  }, [jugadoresMap, manualFiltro]);

  const manualTotalPages = useMemo(() => {
    const tp = Math.ceil(jugadoresManualRows.length / MANUAL_PAGE_SIZE);
    return Math.max(1, Math.min(tp, 200));
  }, [jugadoresManualRows]);

  useEffect(() => setManualPage(1), [manualFiltro]);

  const manualPageData = useMemo(() => {
    const start = (manualPage - 1) * MANUAL_PAGE_SIZE;
    const end = start + MANUAL_PAGE_SIZE;
    return jugadoresManualRows.slice(start, end);
  }, [jugadoresManualRows, manualPage]);

  /* ─────────────────────────────
     Acciones
  ───────────────────────────── */
  const openEdit = (row) => {
    const pago = row?.pago;
    if (!row?.rut) return;

    const isVirtual = Boolean(row.virtual);

    setEditError("");
    setEditForm({
      id: isVirtual ? null : pago?.id ?? null,
      virtual: isVirtual,
      create: false,

      jugador_rut: row.rut,
      monto: pago?.monto ?? "",
      fecha_pago: pago?.fecha_pago ? String(pago.fecha_pago).slice(0, 10) : "",
      tipo_pago_id: isVirtual
        ? String(TIPO_PAGO_MENSUALIDAD)
        : pago?.tipo_pago?.id
        ? String(pago.tipo_pago.id)
        : "",
      medio_pago_id: pago?.medio_pago?.id ? String(pago.medio_pago.id) : "",
      situacion_pago_id: isVirtual
        ? String(SITUACION_PAGO_PAGADO_ID)
        : pago?.situacion_pago?.id
        ? String(pago.situacion_pago.id)
        : "",
      observaciones: pago?.observaciones ?? "",
    });

    setEditOpen(true);
  };

  const openManualPago = (rut) => {
    const r = String(rut ?? "").trim();
    if (!r) return;

    setEditError("");
    setEditForm({
      id: null,
      virtual: false,
      create: true,

      jugador_rut: r,
      monto: "",
      fecha_pago: "",
      tipo_pago_id: "",
      medio_pago_id: "",
      situacion_pago_id: String(SITUACION_PAGO_PAGADO_ID),
      observaciones: "",
    });

    setEditOpen(true);
  };

  const closeEdit = () => {
    if (editBusy || reloadBusy) return;
    setEditOpen(false);
  };

  const refetchPagosActivos = async () => {
    const respEstado = await api.get("/pagos-jugador/estado-cuenta");
    const rawPagos = Array.isArray(respEstado?.data?.pagos) ? respEstado.data.pagos : [];

    const rutsActivos = new Set(Array.from(jugadoresMap.keys()));
    const rawPagosActivos = rawPagos.filter((p) => {
      const rut =
        p?.jugador_rut ?? p?.rut_jugador ?? p?.rut ?? p?.jugador?.rut_jugador ?? p?.jugador?.rut;
      return rut != null && rutsActivos.has(String(rut));
    });

    const pagosNorm = normalizePagos(rawPagosActivos, {
      tipoPagoMap,
      medioPagoMap,
      situacionPagoMap,
      jugadoresMap,
    });

    setPagos(pagosNorm);
  };

  // ✅ Éxito + “recarga” visual (isLoading)
  const showSuccessAndReload = async (msg) => {
    setSuccessMsg(msg);
    setSuccessOpen(true);

    // que se alcance a leer
    await new Promise((r) => setTimeout(r, 900));

    setSuccessOpen(false);

    setReloadBusy(true);
    setIsLoading(true);

    try {
      await refetchPagosActivos();
    } finally {
      setIsLoading(false);
      setReloadBusy(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();

    if (!editForm.jugador_rut) {
      setEditError("RUT inválido");
      return;
    }

    const isVirtual = Boolean(editForm.virtual);
    const isCreate = Boolean(editForm.create);

    const payload = {
      jugador_rut: editForm.jugador_rut,
      monto: editForm.monto,
      fecha_pago: editForm.fecha_pago,
      tipo_pago_id: isVirtual ? TIPO_PAGO_MENSUALIDAD : Number(editForm.tipo_pago_id),
      medio_pago_id: Number(editForm.medio_pago_id),
      situacion_pago_id: isVirtual ? SITUACION_PAGO_PAGADO_ID : Number(editForm.situacion_pago_id),
      observaciones: editForm.observaciones ?? "",
    };

    if (!payload.monto || Number(payload.monto) <= 0) {
      setEditError("El monto debe ser mayor a 0");
      return;
    }
    if (!payload.fecha_pago) {
      setEditError("La fecha de pago es obligatoria");
      return;
    }
    if (!payload.medio_pago_id) {
      setEditError("Seleccione medio de pago");
      return;
    }
    if (!payload.tipo_pago_id) {
      setEditError("Seleccione tipo de pago");
      return;
    }
    if (!payload.situacion_pago_id) {
      setEditError("Seleccione situación");
      return;
    }

    setEditBusy(true);
    setEditError("");

    try {
      // POST: manual o fila virtual
      if (isVirtual || isCreate) {
        await api.post("/pagos-jugador", payload);
        setEditOpen(false);

        // ✅ mensaje distinto para dar “cache”
        await showSuccessAndReload("Pago completado");
        return;
      }

      // PUT: editar pago existente
      if (!editForm.id) {
        setEditError("ID de pago inválido");
        return;
      }

      await api.put(`/pagos-jugador/${editForm.id}`, payload);

      // (opcional) actualización local rápida, pero igual recargaremos por consistencia
      setPagos((prev) =>
        prev.map((p) =>
          p.id === editForm.id
            ? {
                ...p,
                monto: Number(payload.monto),
                fecha_pago: payload.fecha_pago,
                tipo_pago: {
                  id: Number(payload.tipo_pago_id),
                  nombre: tipoPagoMap.get(String(payload.tipo_pago_id)) ?? p.tipo_pago?.nombre,
                },
                medio_pago: {
                  id: Number(payload.medio_pago_id),
                  nombre: medioPagoMap.get(String(payload.medio_pago_id)) ?? p.medio_pago?.nombre,
                },
                situacion_pago: {
                  id: Number(payload.situacion_pago_id),
                  nombre: situacionPagoMap.get(String(payload.situacion_pago_id)) ?? p.situacion_pago?.nombre,
                },
                observaciones: payload.observaciones ?? "",
              }
            : p
        )
      );

      setEditOpen(false);
      await showSuccessAndReload("Registro actualizado");
      return;
    } catch (err) {
      setEditError(err?.response?.data?.message || err?.message || "No se pudo guardar el pago");
    } finally {
      setEditBusy(false);
    }
  };

  const removePago = async (row) => {
    const pago = row?.pago;
    if (!pago || !pago.id || row?.virtual) return;

    const ok = window.confirm(`¿Eliminar el pago #${pago.id}? Esta acción es irreversible.`);
    if (!ok) return;

    try {
      await api.delete(`/pagos-jugador/${pago.id}`);
      setPagos((prev) => prev.filter((p) => p.id !== pago.id));
    } catch (err) {
      alert(err?.message || "No se pudo eliminar el pago");
    }
  };

  /* ─────────────────────────────
     Render
  ───────────────────────────── */
  if (isLoading) {
    return (
      <div className={`${fondoClase} min-h-[calc(100vh-100px)] px-4 pt-4 pb-16 flex items-center justify-center`}>
        <p className="opacity-80 text-sm">{reloadBusy ? "Actualizando información…" : "Cargando pagos centralizados…"}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${fondoClase} min-h-[calc(100vh-100px)] px-4 pt-4 pb-16 flex items-center justify-center`}>
        <p className="text-red-500 text-sm sm:text-base">{error}</p>
      </div>
    );
  }

  return (
    <div className={`${fondoClase} min-h-[calc(100vh-100px)] px-4 pt-4 pb-16 font-realacademy`}>
      <h2 className="text-2xl font-bold mb-2 text-center">Pagos Centralizados</h2>
      <p className="text-center mb-6 text-xs sm:text-sm opacity-80">
        Vista consolidada de pagos de jugadores <span className="font-semibold">ACTIVOS</span>. Además, se agregan filas
        virtuales de <span className="font-semibold">Mensualidad VENCIDA</span> cuando el jugador no tiene mensualidad
        registrada.
      </p>

      {/* Filtros pagos */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end max-w-6xl mx-auto">
        <input
          type="text"
          placeholder="Buscar por RUT, nombre o categoría"
          value={filtroTexto}
          onChange={(e) => setFiltroTexto(e.target.value)}
          className={controlClase}
        />

        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className={controlClase}>
          <option value="">Estado (todos)</option>
          <option value="PAGADO">PAGADO</option>
          <option value="VENCIDO">VENCIDO</option>
        </select>

        <select value={filtroTipoPago} onChange={(e) => setFiltroTipoPago(e.target.value)} className={controlClase}>
          <option value="">Tipo de pago (todos)</option>
          {opcionesTipoPago.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filtroCategoriaSel}
          onChange={(e) => setFiltroCategoriaSel(e.target.value)}
          className={controlClase}
        >
          <option value="">Categoría (todas)</option>
          {opcionesCategoria.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select value={filtroMedioPago} onChange={(e) => setFiltroMedioPago(e.target.value)} className={controlClase}>
          <option value="">Medio de pago (todos)</option>
          {opcionesMedioPago.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla pagos */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-xs sm:text-sm min-w-[1100px]">
          <thead className={tablaCabecera}>
            <tr>
              <th className="py-2 px-4 border min-w-[120px]">RUT Jugador</th>
              <th className="py-2 px-4 border min-w-[220px] break-all">Nombre del Jugador</th>
              <th className="py-2 px-4 border min-w-[150px] break-all">Categoría</th>
              <th className="py-2 px-4 border min-w-[140px] break-all text-center">Tipo de Pago</th>
              <th className="py-2 px-4 border min-w-[160px] break-all text-center">Estado del pago</th>
              <th className="py-2 px-4 border min-w-[130px]">Fecha pago</th>
              <th className="py-2 px-4 border min-w-[130px]">Monto</th>
              <th className="py-2 px-4 border min-w-[150px] break-all">Medio de pago</th>
              <th className="py-2 px-4 border min-w-[120px] text-center">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {pageData.map((row) => {
              const pago = row.pago;
              return (
                <tr key={row.key} className={filaHover}>
                  <td className="py-2 px-4 border text-center">{row.rut ? formatRutWithDV(row.rut) : "—"}</td>
                  <td className="py-2 px-4 border text-center break-all">{row.nombre}</td>
                  <td className="py-2 px-4 border text-center break-all">{row.categoria}</td>
                  <td className="py-2 px-4 border text-center break-all">{pago?.tipo_pago?.nombre ?? "—"}</td>

                  <td className="py-2 px-4 border text-center">
                    <span
                      className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${estadoPillClass(
                        row.estado
                      )}`}
                    >
                      {row.estado}
                    </span>
                  </td>

                  <td className="py-2 px-4 border text-center">
                    {pago?.fecha_pago ? new Date(pago.fecha_pago).toLocaleDateString("es-CL") : "—"}
                  </td>

                  <td className="py-2 px-4 border text-center">{pago ? toCLP(pago.monto) : "—"}</td>

                  <td className="py-2 px-4 border text-center break-all">{pago?.medio_pago?.nombre ?? "—"}</td>

                  <td className="py-2 px-2 border text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(row)}
                        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50"
                        title={row.virtual ? "Registrar pago de mensualidad" : "Editar pago"}
                        disabled={reloadBusy}
                      >
                        <Pencil size={18} />
                      </button>

                      <button
                        onClick={() => removePago(row)}
                        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50"
                        title={row.virtual ? "No se puede eliminar (fila virtual)" : "Eliminar pago"}
                        disabled={reloadBusy || row.virtual || !pago?.id}
                      >
                        <Trash2 size={18} color="#D32F2F" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {pageData.length === 0 && (
              <tr>
                <td className="py-4 px-4 border text-center" colSpan={9}>
                  No hay registros que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación pagos */}
      <div className="flex flex-col items-center justify-center gap-2 mt-4">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={reloadBusy || page <= 1}
            className={`px-3 py-1 rounded border ${
              page <= 1 || reloadBusy ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 dark:hover:bg-[#111827]"
            }`}
          >
            Anterior
          </button>

          <span className="px-2">
            Página {page} de {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={reloadBusy || page >= totalPages}
            className={`px-3 py-1 rounded border ${
              page >= totalPages || reloadBusy
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-100 dark:hover:bg-[#111827]"
            }`}
          >
            Siguiente
          </button>
        </div>

        <div className="text-xs opacity-80">
          Mostrando <span className="font-semibold">{pageData.length}</span> de{" "}
          <span className="font-semibold">{filasFiltradas.length}</span> pagos filtrados.
        </div>
      </div>

      {/* ─────────────────────────────
          NUEVA SECCIÓN: INGRESAR PAGOS MANUALES
        ───────────────────────────── */}
      <div className="max-w-6xl mx-auto mt-10">
        <h3 className="text-xl font-bold text-center">INGRESAR PAGOS MANUALES</h3>
        <p className="text-center mt-1 mb-4 text-xs sm:text-sm opacity-80">
          Acá se pueden realizar pagos en forma manual. Se listan{" "}
          <span className="font-semibold">solo jugadores activos</span> (estado_id = 1).
        </p>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <input
            type="text"
            placeholder="Buscar por RUT, nombre, categoría o sucursal"
            value={manualFiltro}
            onChange={(e) => setManualFiltro(e.target.value)}
            className={controlClase}
          />
          <div className="text-xs opacity-80 md:text-right">
            Total jugadores activos: <span className="font-semibold">{jugadoresManualRows.length}</span>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[1100px]">
            <thead className={tablaCabecera}>
              <tr>
                <th className="py-2 px-4 border min-w-[120px]">RUT Jugador</th>
                <th className="py-2 px-4 border min-w-[260px]">Nombre del jugador</th>
                <th className="py-2 px-4 border min-w-[180px]">Categoría</th>
                <th className="py-2 px-4 border min-w-[180px]">Sucursal</th>
                <th className="py-2 px-4 border min-w-[140px] text-center">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {manualPageData.map((j) => (
                <tr key={`MANUAL-${j.rut}`} className={filaHover}>
                  <td className="py-2 px-4 border text-center">{formatRutWithDV(j.rut)}</td>
                  <td className="py-2 px-4 border text-center break-all">{j.nombre}</td>
                  <td className="py-2 px-4 border text-center break-all">{j.categoria}</td>
                  <td className="py-2 px-4 border text-center break-all">{j.sucursal}</td>
                  <td className="py-2 px-4 border text-center">
                    <button
                      onClick={() => openManualPago(j.rut)}
                      disabled={reloadBusy}
                      className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[#e82d89] text-white hover:bg-pink-700 disabled:opacity-50"
                      title="Ingresar pago manual"
                    >
                      <CreditCard size={16} />
                      Ingresar pago
                    </button>
                  </td>
                </tr>
              ))}

              {manualPageData.length === 0 && (
                <tr>
                  <td className="py-4 px-4 border text-center" colSpan={5}>
                    No hay jugadores que coincidan con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* paginación manual */}
        <div className="flex flex-col items-center justify-center gap-2 mt-4">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setManualPage((p) => Math.max(1, p - 1))}
              disabled={reloadBusy || manualPage <= 1}
              className={`px-3 py-1 rounded border ${
                manualPage <= 1 || reloadBusy
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-gray-100 dark:hover:bg-[#111827]"
              }`}
            >
              Anterior
            </button>

            <span className="px-2">
              Página {manualPage} de {manualTotalPages}
            </span>

            <button
              onClick={() => setManualPage((p) => Math.min(manualTotalPages, p + 1))}
              disabled={reloadBusy || manualPage >= manualTotalPages}
              className={`px-3 py-1 rounded border ${
                manualPage >= manualTotalPages || reloadBusy
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-gray-100 dark:hover:bg-[#111827]"
              }`}
            >
              Siguiente
            </button>
          </div>

          <div className="text-xs opacity-80">
            Mostrando <span className="font-semibold">{manualPageData.length}</span> de{" "}
            <span className="font-semibold">{jugadoresManualRows.length}</span> jugadores filtrados.
          </div>
        </div>
      </div>

      {/* Modal Edición / Registro */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className={`${darkMode ? "bg-[#1f2937] text-white" : "bg-white"} w-[95%] max-w-2xl rounded-lg p-5 shadow-lg`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                {editForm.virtual
                  ? `Registrar mensualidad (VENCIDO) - ${formatRutWithDV(editForm.jugador_rut)}`
                  : editForm.create
                  ? `Ingresar pago manual - ${formatRutWithDV(editForm.jugador_rut)}`
                  : `Editar pago #${editForm.id}`}
              </h3>
              <button
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50"
                onClick={closeEdit}
                disabled={editBusy || reloadBusy}
              >
                <X size={18} />
              </button>
            </div>

            {editError && <p className="mb-3 text-red-500 text-sm">{editError}</p>}

            <form onSubmit={submitEdit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1 opacity-80">RUT Jugador</label>
                <input type="text" value={formatRutWithDV(editForm.jugador_rut)} className={controlClase} disabled />
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Monto (CLP)</label>
                <input
                  type="number"
                  value={editForm.monto}
                  onChange={(e) => setEditForm((f) => ({ ...f, monto: e.target.value }))}
                  className={controlClase}
                  required
                  disabled={editBusy || reloadBusy}
                />
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Fecha pago</label>
                <input
                  type="date"
                  value={editForm.fecha_pago}
                  onChange={(e) => setEditForm((f) => ({ ...f, fecha_pago: e.target.value }))}
                  className={controlClase}
                  required
                  disabled={editBusy || reloadBusy}
                />
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Tipo de pago</label>
                <select
                  value={editForm.tipo_pago_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, tipo_pago_id: e.target.value }))}
                  className={controlClase}
                  required
                  disabled={editForm.virtual || editBusy || reloadBusy}
                >
                  <option value="">Seleccione…</option>
                  {Array.from(tipoPagoMap, ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Medio de pago</label>
                <select
                  value={editForm.medio_pago_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, medio_pago_id: e.target.value }))}
                  className={controlClase}
                  required
                  disabled={editBusy || reloadBusy}
                >
                  <option value="">Seleccione…</option>
                  {Array.from(medioPagoMap, ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Situación</label>
                <select
                  value={editForm.situacion_pago_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, situacion_pago_id: e.target.value }))}
                  className={controlClase}
                  required
                  disabled={editForm.virtual || editBusy || reloadBusy}
                >
                  <option value="">Seleccione…</option>
                  {Array.from(situacionPagoMap, ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                {editForm.virtual && (
                  <p className="text-[11px] opacity-70 mt-1">
                    Esta fila es mensualidad vencida: al guardar se registrará como{" "}
                    <span className="font-semibold">PAGADO</span>.
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs mb-1 opacity-80">Observaciones</label>
                <textarea
                  value={editForm.observaciones}
                  onChange={(e) => setEditForm((f) => ({ ...f, observaciones: e.target.value }))}
                  className={`${controlBase} w-full min-h-[80px] rounded-md p-3 text-sm`}
                  placeholder="Opcional"
                  disabled={editBusy || reloadBusy}
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={editBusy || reloadBusy}
                  className="px-3 py-1 rounded border hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editBusy || reloadBusy}
                  className="px-3 py-1 rounded bg-[#e82d89] text-white hover:bg-pink-700 disabled:opacity-50"
                >
                  {editBusy ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ Modal de éxito */}
      {successOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div
            className={`${
              darkMode ? "bg-[#1f2937] text-white" : "bg-white text-[#1d0b0b]"
            } w-[92%] max-w-sm rounded-xl p-6 shadow-2xl border border-[#e82d89]`}
          >
            <div className="text-center">
              <div className="text-4xl mb-2">✅</div>
              <h4 className="text-lg font-extrabold mb-1">{successMsg}</h4>
              <p className="text-xs opacity-80">Actualizando información…</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

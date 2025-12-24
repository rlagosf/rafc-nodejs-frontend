// src/services/contratoPdf.js
import jsPDF from "jspdf";

/**
 * NOTA FUENTE:
 * - jsPDF NO trae "Aptos" por defecto.
 * - Si registras la fuente (Aptos-Regular.ttf / Aptos-Bold.ttf),
 *   se usará. Si no, cae a helvetica sin romper.
 *
 * Export nombrado: buildContratoPdfBlob
 */
export async function buildContratoPdfBlob({
  texto = "",
  watermarkSrc = "/logo-en-negativo.png",
  // Si registras Aptos, usa estos nombres:
  bodyFont = "Aptos",       // o "helvetica"
  bodyFontStyle = "normal", // normal
  bodyFontBoldStyle = "bold",
} = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  /* =========================
     Helpers: watermark
  ========================= */
  const tryLoadImage = (src) =>
    new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });

  const logo = await tryLoadImage(watermarkSrc);

  const drawWatermark = () => {
    if (!logo) return;
    const size = 320;
    try {
      const gState = doc.GState ? doc.GState({ opacity: 0.10 }) : null;
      if (gState) doc.setGState(gState);
      doc.addImage(logo, "PNG", (pageW - size) / 2, (pageH - size) / 2, size, size);
      if (gState && doc.GState) doc.setGState(doc.GState({ opacity: 1 }));
    } catch {
      // sin watermark si falla
    }
  };

  /* =========================
     Helpers: fonts safe
  ========================= */
  const safeSetFont = (name, style) => {
    // si no existe la fuente, jsPDF puede tirar o ignorar según build;
    // hacemos fallback “seguro”.
    try {
      doc.setFont(name, style);
    } catch {
      doc.setFont("helvetica", style === "bold" ? "bold" : "normal");
    }
  };

  /* =========================
     Layout base
  ========================= */
  const marginX = 50;
  const topY = 95;
  const bottomMargin = 60;

  const maxWidth = pageW - marginX * 2;

  // tamaño solicitado
  const fontSizeBody = 12;
  doc.setFontSize(fontSizeBody);

  // altura de línea para 12pt
  const lineHeight = 16;

  /* =========================
     Título principal fijo
  ========================= */
  const MAIN_TITLE =
    "CONTRATO DE PRESTACIÓN DE SERVICIOS DE ENSEÑANZA DEPORTIVA ESPECIALIZADA EN FÚTBOL";

  const header = () => {
    drawWatermark();

    safeSetFont(bodyFont, bodyFontBoldStyle);
    doc.setFontSize(12);

    // Título principal centrado y en mayúsculas
    const titleLines = doc.splitTextToSize(MAIN_TITLE, maxWidth);
    let yTitle = 50;
    for (const t of titleLines) {
      doc.text(t, pageW / 2, yTitle, { align: "center" });
      yTitle += 14;
    }

    // línea separadora
    doc.setDrawColor(200);
    doc.line(marginX, 78, pageW - marginX, 78);

    // volver a body default
    doc.setFontSize(fontSizeBody);
  };

  header();

  /* =========================
     Justificado (manual)
  ========================= */

  const measure = (txt) => doc.getTextWidth(txt);

  const justifyLine = (line, x, y, targetWidth) => {
    // Divide por espacios múltiples
    const words = line.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      // una palabra → normal
      doc.text(line.trim(), x, y);
      return;
    }

    const wordsWidth = words.reduce((acc, w) => acc + measure(w), 0);
    const gaps = words.length - 1;
    const free = targetWidth - wordsWidth;

    // si no hay espacio extra (o negativo), print normal
    if (free <= 0) {
      doc.text(line.trim(), x, y);
      return;
    }

    const gapExtra = free / gaps;

    let cursor = x;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      doc.text(w, cursor, y);
      cursor += measure(w);
      if (i < gaps) cursor += measure(" ") + gapExtra; // espacio base + extra
    }
  };

  /* =========================
     Detectar títulos (negrita + subrayado)
     Heurística: línea en MAYÚSCULAS, corta, sin punto final.
  ========================= */
  const isHeadingLine = (s) => {
    const t = String(s || "").trim();
    if (!t) return false;
    if (t.length > 60) return false;
    if (/[.]{1,}\s*$/.test(t)) return false; // termina en punto
    // “mayúsculas” (permitimos acentos, Ñ y espacios)
    const onlyCaps = t === t.toUpperCase();
    // Evitar párrafos largos en caps
    const wordCount = t.split(/\s+/).filter(Boolean).length;
    return onlyCaps && wordCount <= 6;
  };

  const underlineText = (text, x, y) => {
    const w = measure(text);
    // underline: una línea 1pt abajo del baseline
    doc.setDrawColor(0);
    doc.setLineWidth(0.6);
    doc.line(x, y + 2, x + w, y + 2);
  };

  /* =========================
     Render texto largo
  ========================= */
  safeSetFont(bodyFont, bodyFontStyle);
  doc.setFontSize(fontSizeBody);

  const paragraphs = String(texto || "")
    .replace(/\r\n/g, "\n")
    .split("\n");

  let y = topY;

  const addFooter = (pageNumber) => {
    safeSetFont(bodyFont, "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Real Academy FC • Página ${pageNumber}`, pageW / 2, pageH - 24, { align: "center" });
    doc.setTextColor(0);
    doc.setFontSize(fontSizeBody);
  };

  const newPage = () => {
    addFooter(doc.internal.getCurrentPageInfo().pageNumber);
    doc.addPage();
    header();
    safeSetFont(bodyFont, bodyFontStyle);
    doc.setFontSize(fontSizeBody);
    y = topY;
  };

  const ensureSpace = (needed = lineHeight) => {
    if (y + needed > pageH - bottomMargin) newPage();
  };

  for (const p of paragraphs) {
    const raw = p ?? "";
    const line = String(raw).trimEnd();

    // línea vacía → espacio entre párrafos
    if (!line.trim()) {
      y += lineHeight * 0.8;
      ensureSpace(0);
      continue;
    }

    // TÍTULO
    if (isHeadingLine(line)) {
      ensureSpace(lineHeight * 1.2);

      safeSetFont(bodyFont, bodyFontBoldStyle);
      doc.setFontSize(12);

      // centrado o a la izquierda? (tú pediste títulos en negrita/subrayado, no centrado)
      doc.text(line.trim(), marginX, y);
      underlineText(line.trim(), marginX, y);

      // volver a cuerpo
      safeSetFont(bodyFont, bodyFontStyle);
      doc.setFontSize(fontSizeBody);

      y += lineHeight * 1.2;
      continue;
    }

    // PÁRRAFO normal, justificado
    const wrapped = doc.splitTextToSize(line, maxWidth);

    for (let i = 0; i < wrapped.length; i++) {
      ensureSpace(lineHeight);

      const wline = String(wrapped[i] || "");
      const isLastLine = i === wrapped.length - 1;

      // Justificar todas excepto la última línea del párrafo
      if (!isLastLine) {
        justifyLine(wline, marginX, y, maxWidth);
      } else {
        // última línea: alineación normal izquierda
        doc.text(wline.trim(), marginX, y);
      }

      y += lineHeight;
    }

    // espacio extra tras párrafo
    y += lineHeight * 0.35;
    ensureSpace(0);
  }

  addFooter(doc.internal.getCurrentPageInfo().pageNumber);
  return doc.output("blob");
}

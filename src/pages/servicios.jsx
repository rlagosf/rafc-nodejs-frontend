import { motion } from "framer-motion";

/* ========= Programas: 3 fotos a la izquierda + texto a la derecha ========= */
const programas = [
  {
    titulo: "JUNIOR (5–8 años)",
    descripcion:
      "Iniciamos a los niños en el fútbol con metodologías lúdicas y dinámicas, potenciando la coordinación motriz, el control del cuerpo y la socialización. Se despierta la pasión por el deporte y se sientan las bases técnicas y actitudinales.",
    imagenes: ["/images/foto-real-facup-54.webp", "/images/foto-real-facup-55.webp", "/images/foto-real-facup-56.webp"],
  },
  {
    titulo: "FORMATIVO (9–12 años)",
    descripcion:
      " Se desarrollan las técnicas individuales fundamentales (conducción, pase, control, remate), la comprensión táctica inicial y un acondicionamiento físico adaptado a la edad. Se introducen las primeras experiencias competitivas, siempre con un enfoque formativo y pedagógico.",
    imagenes: ["/images/foto-real-facup-57.webp", "/images/foto-real-facup-65.webp", "/images/foto-real-facup-45.webp"],
  },
  {
    titulo: "COMPETITIVO (13–16 años)",
    descripcion:
      " Entrenamientos de alta exigencia, con roles y funciones específicas por posición, preparación física más avanzada y partidos de mayor nivel. Se perfecciona la técnica, se optimiza la toma de decisiones en situaciones reales de juego y se potencia el rendimiento integral del jugador.",
    imagenes: ["/images/foto-real-facup-59.webp", "/images/foto-real-facup-62.webp", "/images/foto-real-facup-60.webp"],
  },
  {
    titulo: "PROYECCIÓN (17+ años)",
    descripcion:
      " Programa orientado a jugadores que buscan dar el salto. Se entregan herramientas de alto rendimiento, análisis táctico, y preparación física específica, potenciando al máximo las capacidades individuales y grupales.", imagenes: ["/images/foto-real-facup-63.webp", "/images/foto-real-facup-64.webp", "/images/foto-real-facup-58.webp"],
  },
  {
    titulo: "ADULTOS (+18 años)",
    descripcion:
      " Entrenamientos diseñados para equilibrar salud, recreación y rendimiento competitivo. Se refuerzan aspectos técnicos y tácticos aplicados al juego real, favoreciendo tanto la mejora personal como la experiencia grupal.",
    imagenes: ["/images/foto-real-facup-25.webp", "/images/foto-real-facup-24.webp", "/images/foto-real-facup-35.webp"],
  },
];

/* ========= Beneficios (sin Guía Nutricional) ========= */
const beneficios = [
  { icono: "🧠", titulo: "Psicología Deportiva" },
  { icono: "💪", titulo: "Preparación Física" },
  { icono: "🩺", titulo: "Kinesiología" },
];

export default function Servicios() {
  return (
    <motion.section
      id="servicios"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.2 }}
      variants={{
        hidden: { opacity: 0, y: 50 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
      }}
      className="text-white py-16 px-6 font-sans bg-transparent flex flex-col items-center"
    >
      {/* ===================== Título general ===================== */}
      <div className="max-w-4xl text-center mb-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-fucsia-ra">
          Nuestros Programas
        </h2>
        <p className="text-gray-300 text-lg">
          Formación progresiva según edad, etapa de desarrollo y objetivos personales.
        </p>
      </div>

      {/* ===================== Tarjetas “3 fotos + texto” ===================== */}
      <div className="flex flex-col gap-10 w-full max-w-7xl">
        {programas.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className="
              flex flex-col md:flex-row rounded-xl overflow-hidden
              shadow-lg hover:shadow-[0_0_25px_#e82d89] transition-all duration-300
              bg-marron-ra/80 h-[300px] md:h-[220px]
            "
          >
            {/* Columna de fotos (llena siempre la altura) */}
            <div className="md:w-1/2 w-full grid grid-cols-3 h-[45%] md:h-full">
              {p.imagenes.map((img, j) => (
                <div key={j} className="relative h-full overflow-hidden border-r border-fucsia-ra last:border-r-0">
                  <img
                    src={img}
                    alt={`${p.titulo}-${j + 1}`}
                    className="absolute inset-0 w-full h-full object-cover transform transition-transform duration-500 hover:scale-105"
                    style={{ objectPosition: i === 0 ? "center 25%" : "center" }} /* JUNIOR más abajo */
                  />
                </div>
              ))}
            </div>

            {/* Columna de texto (mismo fondo que la tarjeta y altura completa) */}
            <div className="md:w-1/2 w-full flex flex-col justify-center p-5 md:p-6 text-justify h-[55%] md:h-full bg-marron-ra/80">
              <h3 className="text-xl md:text-2xl font-bold text-fucsia-ra mb-2 leading-snug">
                {p.titulo}
              </h3>
              <p
                className="text-gray-300 text-[13px] md:text-[15px] leading-tight md:leading-snug"
                style={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  WebkitLineClamp: 6, // limita líneas en mobile para evitar overflow
                }}
              >
                {p.descripcion}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ===================== Beneficios Institucionales ===================== */}
      <div className="max-w-4xl text-center mt-16 mb-10">
        <h3 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-fucsia-ra">
          Beneficios Institucionales
        </h3>
        <p className="text-gray-300 text-lg">
          En <span className="text-fucsia-ra font-semibold">Real Academy FC</span> comprendemos
          que el rendimiento no se limita al entrenamiento físico. Nuestro equipo
          multidisciplinario acompaña a cada jugador dentro y fuera de la cancha,
          potenciando su desarrollo integral.
        </p>
      </div>

      {/* === Grilla de beneficios === */}
      <div className="w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 max-w-5xl mx-auto">

          {/* --- Psicología Deportiva --- */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.6, delay: 0 }}
            className="relative rounded-xl overflow-hidden border border-fucsia-ra 
                 shadow-md hover:shadow-fucsia-ra/40 transition-all duration-300 h-[240px]"
          >
            <img
              src="/PSICOLOGIA.png"
              alt="Psicología Deportiva"
              className="absolute inset-0 w-full h-full object-cover opacity-80 
                   transition-transform duration-500 hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <h4 className="text-xl font-semibold text-fucsia-ra text-center px-4">
                Psicología Deportiva
              </h4>
            </div>
          </motion.div>

          {/* --- Preparación Física --- */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative rounded-xl overflow-hidden border border-fucsia-ra 
                 shadow-md hover:shadow-fucsia-ra/40 transition-all duration-300 h-[240px]"
          >
            <img
              src="/PREPARACION_FISICA.png"
              alt="Preparación Física"
              className="absolute inset-0 w-full h-full object-cover opacity-80 
                   transition-transform duration-500 hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <h4 className="text-xl font-semibold text-fucsia-ra text-center px-4">
                Preparación Física
              </h4>
            </div>
          </motion.div>

          {/* --- Kinesiología --- */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative rounded-xl overflow-hidden border border-fucsia-ra 
                 shadow-md hover:shadow-fucsia-ra/40 transition-all duration-300 h-[240px]"
          >
            <img
              src="/KINESIOLOGIA.png"
              alt="Kinesiología"
              className="absolute inset-0 w-full h-full object-cover opacity-80 
                   transition-transform duration-500 hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <h4 className="text-xl font-semibold text-fucsia-ra text-center px-4">
                Kinesiología
              </h4>
            </div>
          </motion.div>

        </div>
      </div>
    </motion.section>
  );
}

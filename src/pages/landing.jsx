import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const imagenes = [
  '/images/foto-real-facup-32.webp',
  '/images/foto-real-facup-42.webp',
  '/images/foto-real-facup-27.webp',
  '/images/foto-real-facup-43.webp',
  '/images/foto-real-facup-40.webp',
  '/images/foto-real-facup-44.webp',
  '/images/foto-real-facup-38.webp',
  '/images/foto-real-facup-45.webp',
  '/images/foto-real-facup-30.webp',
  '/images/foto-real-facup-46.webp',
  '/images/foto-real-facup-25.webp',
  '/images/foto-real-facup-48.webp',
];

const leyendas = [
  'Forjamos talento desde la raíz',
  'Disciplina, pasión y carácter',
  'Donde otros ven sueños, nosotros vemos futuro',
  'Somos una academia de alto rendimiento',
  'Somos más que fútbol. Somos legado.',
  'Real Academy FC. Deja tu huella.',
];

function precargarImagenes(srcs) {
  srcs.forEach(src => { const img = new Image(); img.src = src; });
}

export default function Landing() {
  const [indice, setIndice] = useState(0);
  const navigate = useNavigate();

  const slides = imagenes.map((src, i) => ({ src, caption: leyendas[i % leyendas.length] }));

  useEffect(() => {
    precargarImagenes(slides.map(s => s.src));
    const intervalo = setInterval(() => setIndice(p => (p + 1) % slides.length), 5000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Ancla para scroll */}
      <div className="w-full h-screen relative z-10" id="inicio" />

      {/* Carrusel visual */}
      <section className="absolute top-0 left-0 w-full h-screen overflow-hidden text-white font-sans z-40">
        <AnimatePresence mode="wait">
          <motion.div
            key={indice}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 w-full h-full pointer-events-none"
            // 👇 Máscara: mantiene opaco el 70% superior y desvanece a transparente el 30% inferior
            style={{
              WebkitMaskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)',
              maskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)',
            }}
          >
            {/* Imagen de fondo */}
            <img
              src={slides[indice].src}
              alt={`Fondo ${indice}`}
              className="absolute inset-0 w-full h-full object-cover object-[center_35%] scale-105"
              loading="eager"
              decoding="async"
            />

            {/* Overlay uniforme que transiciona con la imagen */}
            <div className="absolute inset-0 bg-black/50 z-10" />
          </motion.div>
        </AnimatePresence>

        {/* Leyendas y botones */}
        <motion.div
          key={`text-${indice}`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 1 }}
          className="absolute top-1/2 z-50 transform -translate-y-1/2 w-full px-6 pointer-events-auto"
        >
          <div className="max-w-6xl mx-auto">
            <div
              className={`max-w-2xl ${indice % 2 === 0
                ? 'md:ml-0 md:mr-auto md:text-left'
                : 'md:ml-auto md:mr-0 md:text-right'
              } text-center`}
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                {slides[indice].caption}
              </h2>

              <button
                onClick={() => {
                  if (indice === 5) {
                    navigate('/galeria');
                  } else {
                    const section = document.getElementById('nosotros');
                    if (section) section.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="inline-block bg-[#e82d89] hover:bg-[#c9206e] transition-colors duration-300 text-white font-semibold py-3 px-6 rounded-full shadow-lg"
              >
                {indice === 5 ? 'Explora la galería' : 'Conoce más'}
              </button>
            </div>
          </div>
        </motion.div>
      </section>
    </>
  );
}

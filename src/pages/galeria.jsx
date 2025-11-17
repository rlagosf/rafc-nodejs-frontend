import React, { useState } from 'react';
import Footer from '../components/footer';

const Galeria = () => {
  const fotos = Array.from({ length: 41 }, (_, i) => ({
    baja: `/low-res/foto-real-facup-${i + 1}.webp`,
    alta: `/images/foto-real-facup-${i + 1}.webp`
  }));

  const [imagenActiva, setImagenActiva] = useState(null);

  return (
    <>
      <section className="min-h-screen bg-gradient-to-br from-[#1d0b0b] via-[#1d0b0b] to-[#e82d89] text-white font-sans pt-32 pb-12 px-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-10 text-[#ffffff] flex items-center justify-center gap-3 flex-wrap text-center">
            <img
              src={new URL('/src/statics/logos/logo-en-blanco.png', import.meta.url).href}
              alt="Logo"
              className="w-12 h-12 object-contain"
            />
            Galería Real Academy FC
          </h2>

          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {fotos.map((foto, idx) => (
              <div
                key={idx}
                className="overflow-hidden rounded-lg shadow-lg group relative cursor-pointer"
                onClick={() => setImagenActiva(foto.alta)}
              >
                <img
                  src={foto.baja}
                  alt={`Foto ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-60 object-cover transform group-hover:scale-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
                  <p className="text-white text-sm font-semibold">Ver Imagen</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer embebido, dentro del fondo degradado */}
        <div className="mt-16 w-full">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-y-6">
            <a
              href="/"
              className="text-sm text-gray-400 hover:text-white transition flex items-center space-x-2"
            >
              <img
                src={new URL('/src/statics/logos/logo-en-blanco.png', import.meta.url).href}
                alt="Logo"
                className="w-6 h-6 object-contain"
              />
              <span>© {new Date().getFullYear()} Real Academy FC. Todos los derechos reservados.</span>
            </a>

            <div className="flex justify-center md:justify-end w-full md:w-auto space-x-6 text-3xl">
              <a
                href="https://wa.me/56967438184"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green-400 transition"
              >
                <i className="fab fa-whatsapp"></i>
              </a>
              <a
                href="https://www.facebook.com/realacademyfc"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-500 transition"
              >
                <i className="fab fa-facebook-f"></i>
              </a>
              <a
                href="https://www.instagram.com/realacademyfc"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-pink-400 transition"
              >
                <i className="fab fa-instagram"></i>
              </a>
              <a
                href="https://www.linkedin.com/company/realacademyfc"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-300 transition"
              >
                <i className="fab fa-linkedin-in"></i>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Modal con marca de agua */}
      {imagenActiva && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setImagenActiva(null)}
        >
          <div className="relative flex items-center justify-center max-w-[95vw] max-h-[95vh]">
            <img
              src={imagenActiva}
              alt="Imagen ampliada"
              className="relative z-10 object-contain max-w-full max-h-[90vh] border-4 border-white rounded-lg shadow-2xl"
            />
            <img
              src={new URL('/src/statics/logos/logo-en-blanco.png', import.meta.url).href}
              alt="Marca de agua"
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
              opacity-100 max-w-[45%] pointer-events-none z-20 drop-shadow-md mix-blend-overlay"
            />
            <button
              className="absolute top-4 right-4 text-white text-2xl font-bold bg-black/70 hover:bg-black/90 rounded-full px-4 py-1 z-30"
              onClick={(e) => {
                e.stopPropagation();
                setImagenActiva(null);
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Galeria;

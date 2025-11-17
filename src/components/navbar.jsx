import React, { useState, useEffect } from 'react';
import { Link as ScrollLink } from 'react-scroll';
import { Link as RouterLink } from 'react-router-dom';
import logoRAFC from '../statics/logos/logo-sin-fondo.png';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [tocaDifuminado, setTocaDifuminado] = useState(false);
  const [showNavbar, setShowNavbar] = useState(true); // 👈 nuevo estado para ocultar/mostrar navbar

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const navLinks = [
    { name: 'Inicio', target: 'inicio' },
    { name: 'Nosotros', target: 'nosotros' },
    { name: 'Servicios', target: 'servicios' },
    { name: 'Ubicacion', target: 'ubicacion'},
    { name: 'Contacto', target: 'contacto' },
  ];

  useEffect(() => {
    const observerHero = new IntersectionObserver(
      ([entry]) => setScrolledPastHero(!entry.isIntersecting),
      { threshold: 0.1 }
    );

    const observerDifuminado = new IntersectionObserver(
      ([entry]) => setTocaDifuminado(!entry.isIntersecting),
      { threshold: 0.1 }
    );

    const hero = document.getElementById('inicio');
    const difuminadoTrigger = document.getElementById('trigger-difuminado');

    if (hero) observerHero.observe(hero);
    if (difuminadoTrigger) observerDifuminado.observe(difuminadoTrigger);

    return () => {
      if (hero) observerHero.unobserve(hero);
      if (difuminadoTrigger) observerDifuminado.unobserve(difuminadoTrigger);
    };
  }, []);

  // 👇 lógica para ocultar navbar en móviles al hacer scroll hacia abajo
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const isMobile = window.innerWidth < 768;
      if (!isMobile) {
        setShowNavbar(true);
        return;
      }

      if (window.scrollY <= 10) {
        setShowNavbar(true); // mostrar al tope
      } else if (window.scrollY > lastScrollY) {
        setShowNavbar(false); // ocultar al bajar
      } else {
        setShowNavbar(true); // mostrar al subir
      }

      lastScrollY = window.scrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 🔷 Fondo para navbar superior (pantallas grandes)
  const topBarBackground =
    scrolledPastHero
      ? 'bg-black/80 backdrop-blur-md'
      : 'bg-transparent backdrop-blur-md';

  // 🔷 Fondo para menú hamburguesa abierto
  const menuMobileBackground =
    isMenuOpen && tocaDifuminado
      ? 'bg-[#1d0b0b] backdrop-blur-md'
      : 'bg-transparent';

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 font-sans text-white transition-all duration-500 ease-in-out transform ${showNavbar ? 'translate-y-0' : '-translate-y-full'
        }`}
    >
      {/* 🔸 Barra superior completa */}
      <div className={`w-full px-8 lg:px-40 py-4 flex justify-between items-center transition-all duration-500 ease-in-out ${topBarBackground}`}>


        {/* 🔹 Logo + redes sociales */}
        <div className="flex items-center gap-6">
          <ScrollLink
            to="inicio"
            smooth={true}
            duration={500}
            offset={-64}
            className="cursor-pointer"
          >
            <img
              src={logoRAFC}
              alt="Real Academy FC"
              className="h-12 w-auto"
            />
          </ScrollLink>

          <div className="hidden lg:flex space-x-5 text-xl">
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

        {/* 🔹 Links menú desktop */}
        <ul className="hidden md:flex space-x-6 text-sm font-medium items-center">
          {navLinks.map(({ name, target }) => (
            <li key={target}>
              <ScrollLink
                to={target}
                smooth={true}
                duration={600}
                offset={-64}
                spy={true}
                className="cursor-pointer hover:text-[#e82d89] transition"
              >
                {name}
              </ScrollLink>
            </li>
          ))}
          <li>
            <RouterLink
              to="/login"
              className="hover:text-[#e82d89] transition"
            >
              Iniciar sesión
            </RouterLink>
          </li>
        </ul>

        {/* 🔹 Botón hamburguesa */}
        <button
          onClick={toggleMenu}
          aria-label="Menu"
          className="md:hidden focus:outline-none"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8h16M4 16h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* 🔸 Menú móvil */}
      {isMenuOpen && (
        <div
          className={`md:hidden px-4 py-4 space-y-4 text-sm font-medium transition-all duration-300 ${menuMobileBackground}`}
        >
          {navLinks.map(({ name, target }) => (
            <ScrollLink
              key={target}
              to={target}
              smooth={true}
              duration={600}
              offset={-64}
              spy={true}
              onClick={toggleMenu}
              className="block cursor-pointer hover:text-[#e82d89]"
            >
              {name}
            </ScrollLink>
          ))}
          <RouterLink
            to="/login"
            className="block hover:text-[#e82d89]"
            onClick={toggleMenu}
          >
            Iniciar Sesión
          </RouterLink>

          <div className="flex justify-center pt-4 space-x-5 text-xl border-t border-white/20 mt-4">
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
      )}
    </nav>
  );
}

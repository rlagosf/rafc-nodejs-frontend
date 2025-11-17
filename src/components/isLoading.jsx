// src/components/Loading.jsx

import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function Loading() {
  const { darkMode } = useTheme();
  const [progress, setProgress] = useState(0);
  const [fade, setFade] = useState(true);

  // Progreso
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 30);
    return () => clearInterval(interval);
  }, []);

  // Fade
  useEffect(() => {
    const fadeInterval = setInterval(() => setFade(prev => !prev), 700);
    return () => clearInterval(fadeInterval);
  }, []);

  const backgroundColor = darkMode ? '#111111' : '#f5f5f5';
  const barColor = darkMode ? '#ffffff' : '#000000';
  const barBackground = darkMode ? '#333333' : '#cccccc';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999
    }}>
      <img
        src="/logo-en-negativo.png"
        alt="Cargando datos..."
        style={{
          width: '150px',
          height: 'auto',
          opacity: fade ? 1 : 0,
          transition: 'opacity 0.7s ease-in-out'
        }}
      />
      <div style={{
        marginTop: '30px',
        width: '300px',
        height: '10px',
        backgroundColor: barBackground,
        borderRadius: '5px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: barColor,
          transition: 'width 0.3s ease-in-out'
        }} />
      </div>
    </div>
  );
}

/**
 * SonicLab 3D - Academic Experiments and Guided Practices
 */

import { AcademicExperiment } from '../types/soniclab';

export const ACADEMIC_EXPERIMENTS: AcademicExperiment[] = [
  {
    id: 'exp-chladni-resonance',
    title: 'Resonancia y Modos de Chladni en Placa',
    category: 'Cimática',
    difficulty: 'Fundamentos',
    summary: 'Observa cómo las partículas de arena migran lejos de los antinodos y se depositan exactamente sobre las líneas nodales de vibración nula.',
    objective: 'Identificar frecuencias naturales y verificar la relación entre el número de líneas nodales (m, n) y la frecuencia modal del sistema.',
    preset: {
      lab: 'cymatics',
      cymaticsState: {
        geometry: 'square',
        boundary: 'simply_supported',
        modeIndex: 3,
        driveFrequencyHz: 480,
        sandParticleCount: 12000,
        palette: 'aurora_electrica',
        showNodalStreams: true,
      },
    },
    questions: [
      '¿Por qué la arena no se dispersa aleatoriamente sino que dibuja patrones geométricos simétricos?',
      '¿Qué ocurre con la distancia entre líneas nodales al incrementar la frecuencia?',
      '¿En qué puntos de la placa la amplitud de oscilación vertical es máxima y en cuáles es cero?',
    ],
  },
  {
    id: 'exp-air-propagation',
    title: 'Propagación Longitudinal vs Oscilación Local',
    category: 'Acústica',
    difficulty: 'Fundamentos',
    summary: 'Demuestra el principio fundamental de SonicLab: "La onda sonora se propaga, pero cada partícula de aire oscila alrededor de su posición de equilibrio".',
    objective: 'Comprobar que el sonido es una perturbación de energía y presión, no un flujo o transporte de materia a través del espacio.',
    preset: {
      lab: 'acoustics',
      acousticsState: {
        frequencyHz: 180,
        levelDbSpl: 75,
        showReferenceParticle: true,
        showWavefronts: true,
        waveform: 'sine',
      },
    },
    questions: [
      'Sigue visualmente la partícula de referencia en rojo: ¿Cruza la habitación o retorna a su centro de equilibrio?',
      '¿Dónde se concentran las zonas de alta densidad (compresión) en relación con el vector de desplazamiento?',
      '¿Qué desfase angular existe entre la presión acústica y la velocidad de las partículas?',
    ],
  },
  {
    id: 'exp-speed-temperature',
    title: 'Efecto de la Temperatura en la Velocidad del Sonido',
    category: 'Acústica',
    difficulty: 'Aplicación',
    summary: 'Analiza cómo la velocidad de propagación c varía linealmente con la temperatura del gas (c = 331.3 + 0.606 * T) y su efecto en la longitud de onda.',
    objective: 'Determinar cómo la longitud de onda lambda se expande o comprime a frecuencia fija al calentar o enfriar el aire.',
    preset: {
      lab: 'acoustics',
      acousticsState: {
        frequencyHz: 343,
        temperatureC: 40,
        humidityPercent: 50,
      },
    },
    questions: [
      'Si duplicamos la temperatura de 0°C a 40°C a frecuencia fija, ¿aumenta o disminuye la longitud de onda?',
      '¿Por qué los instrumentos de viento desafinan cuando cambia la temperatura del entorno?',
    ],
  },
  {
    id: 'exp-interference-beats',
    title: 'Interferencia Espacial y Batimiento Acústico',
    category: 'Interferencia',
    difficulty: 'Avanzado',
    summary: 'Activa dos fuentes sonoras con frecuencias ligeramente desfasadas para observar la modulación periódica de amplitud (batimiento).',
    objective: 'Medir la frecuencia de batimiento f_b = |f1 - f2| y visualizar zonas de interferencia constructiva y destructiva en el espacio.',
    preset: {
      lab: 'acoustics',
      acousticsState: {
        frequencyHz: 220,
        secondarySourceEnabled: true,
        secondaryFrequencyHz: 224,
        secondaryDistanceM: 1.5,
      },
    },
    questions: [
      '¿A qué ritmo se perciben las pulsaciones de volumen cuando la diferencia entre fuentes es de 4 Hz?',
      '¿Dónde se ubican los nodos de cancelación de sonido en el espacio tridimensional?',
    ],
  },
];

# SonicLab 3D · ORBIT

Laboratorio interactivo de acústica y cimática en tiempo real para web y Android. SonicLab visualiza la propagación del sonido como un campo volumétrico de partículas y muestra patrones de Chladni/cimática con controles científicos y navegación táctil.

## Versión 1.2 ORBIT

- Campo acústico **3D** renderizado por GPU con hasta 120 000 partículas.
- Cámara ORBIT: arrastrar para orbitar, pellizcar para acercar/alejar y dos dedos para desplazar; también incluye controles en pantalla.
- Selección de partículas: toca el volumen para inspeccionar una partícula y usar el enfoque de cámara.
- Lecturas de longitud de onda, velocidad y presión actualizadas a una cadencia legible; las sondas A/B/C permanecen estables.
- Corrección del desbordamiento horizontal en móviles y eliminación del antiguo aviso de instalación que cubría el menú.
- Cimática pulida: integración con pausa real, fuerzas basadas en el gradiente del modo y menor trabajo cuando la vista no está activa.
- Migración automática que elimina la caché del PWA anterior para que una APK actualizada no cargue el visualizador 2D obsoleto.

## Requisitos

- Node.js 20 o superior.
- Para Android: Android Studio, JDK 21 y Android SDK 36.
- Un dispositivo Android con WebGL 2. En dispositivos de gama alta se recomienda la calidad de 120 000 partículas; la aplicación reduce la resolución de renderizado si detecta una caída sostenida de FPS.

## Ejecutar en web

```bash
npm install
npm run dev
```

Abre la dirección que muestra Vite, normalmente `http://localhost:3000`.

## Verificaciones

```bash
npm run lint
node tests/particle-field.cjs
npm run build
```

La prueba de partículas verifica el RMS a 1 m, la separación entre la escala visual y los valores físicos, el desplazamiento radial, la estabilidad en el origen, la interferencia destructiva y los armónicos.

## Generar la APK Android

Desde la raíz del proyecto:

```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

En Windows se puede usar `gradlew.bat assembleDebug`. La APK de depuración queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

## Arquitectura

- `src/components/AcousticsLab/SonicParticleStage.tsx`: nube de partículas 3D, shaders GLSL, cámara, selección y presupuesto de rendimiento.
- `src/physics/ParticleField.ts`: muestreo físico compartido por telemetría y renderizado.
- `src/components/CymaticsLab/Cymatics3DView.tsx`: placa cimática y dinámica de partículas.
- `android/`: contenedor Capacitor para compilar e instalar en Android.

## Controles del campo acústico

| Acción | Control |
| --- | --- |
| Orbitar | Arrastrar con un dedo / ratón |
| Zoom | Pellizcar / rueda / botones `−` y `+` |
| Desplazar | Arrastrar con dos dedos |
| Seleccionar | Tocar o hacer clic en una partícula |
| Enfocar selección | Botón `Enfocar` |

## Nota científica

El render utiliza una escala visual para que los desplazamientos microscópicos sean observables. Esa escala no modifica los valores físicos mostrados en la interfaz: presión, velocidad del sonido y desplazamiento reportado se calculan por separado.


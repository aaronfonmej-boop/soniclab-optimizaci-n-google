import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2, X, ExternalLink, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isAndroid, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  // If already installed as native standalone app, show small badge or hide
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden sm:inline">App Instalada</span>
      </div>
    );
  }

  return (
    <>
      <button
        id="btn-install-apk-pwa"
        onClick={() => {
          if (isInstallable) {
            install();
          } else {
            setShowModal(true);
          }
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all active:scale-95"
        title="Instalar SonicLab 3D en Android (Xiaomi 15T)"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>Instalar en Android / APK</span>
      </button>

      {/* Modal de Asistencia para APK e Instalación en Xiaomi 15T */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-slate-200">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Instalar SonicLab 3D en Xiaomi 15T</h3>
                <p className="text-xs text-slate-400">HyperOS / Android 14+ • WebAPK & APK</p>
              </div>
            </div>

            <div className="space-y-4 text-xs leading-relaxed">
              {/* Opción 1: WebAPK Nativo Directo */}
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Opción 1: Instalar WebAPK Directo (Recomendado)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                    Instantáneo
                  </span>
                </div>
                <p className="text-slate-300 mb-2">
                  En tu Xiaomi 15T con Google Chrome o Mi Browser, el sistema compila e instala un <strong>WebAPK real</strong> en el cajón de aplicaciones de HyperOS:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>Toca el menú de <strong>3 puntos (⋮)</strong> en Chrome.</li>
                  <li>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla de inicio"</strong>.</li>
                  <li>Android compilará automáticamente el WebAPK con aceleración GPU y soporte offline.</li>
                </ol>
                {isInstallable && (
                  <button
                    onClick={() => {
                      install();
                      setShowModal(false);
                    }}
                    className="mt-3 w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Download className="w-4 h-4" />
                    Iniciar Instalación Automática
                  </button>
                )}
              </div>

              {/* Opción 2: Generar APK standalone firmado con PWABuilder */}
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    Opción 2: Descargar archivo .APK firmado
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                    Archivo .apk
                  </span>
                </div>
                <p className="text-slate-300 mb-2">
                  Si requieres el archivo binario independiente <code>.apk</code> para distribuirlo o instalarlo manualmente:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>Abre <strong>PWABuilder.com</strong> (herramienta oficial de Microsoft & Google).</li>
                  <li>Pega la URL pública compartida de esta aplicación.</li>
                  <li>Haz clic en <strong>"Package for Android"</strong> para descargar tu archivo <code>.apk</code>.</li>
                </ol>
                <a
                  href={`https://www.pwabuilder.com?url=${encodeURIComponent(window.location.origin)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir Generador de APK (PWABuilder)
                </a>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

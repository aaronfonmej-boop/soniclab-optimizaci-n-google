/**
 * SonicLab 3D - Formal Academic Laboratory Report Generator
 * Generates printable PDF-ready university practice reports with telemetry and snapshots.
 */

import React, { useState } from 'react';
import { AcousticCalculations, CymaticsMetrics, CymaticsState, LabReportData } from '../../types/soniclab';
import { Download, FileText, Printer, Sparkles, CheckCircle2, X } from 'lucide-react';
import { triggerDownload } from '../../utils/exporters';

interface LabReportModalProps {
  metrics: CymaticsMetrics;
  cymaticsState: CymaticsState;
  acousticCalcs: AcousticCalculations;
}

export function LabReportModal({
  metrics,
  cymaticsState,
  acousticCalcs,
}: LabReportModalProps) {
  const [report, setReport] = useState<LabReportData>({
    studentName: 'Estudiante de Física / Ingeniería',
    studentId: 'LAB-2026-042',
    institution: 'Facultad de Ingeniería y Ciencias Físicas',
    date: new Date().toISOString().split('T')[0],
    selectedExperimentTitle: 'Práctica: Modos Propios de Chladni y Acústica de Ondas Longitudinales',
    objective:
      'Determinar experimentalmente las frecuencias naturales de resonancia de una placa elástica delgada de aluminio y comparar la velocidad de propagación acústica en aire según la norma ISO 9613-1.',
    notes:
      'Se observó una clara acumulación de partículas de arena sobre las líneas nodales (w=0). Al desintonizar la frecuencia en un 5%, las partículas dejan de desplazarse coherentemente hacia los nodos.',
    conclusions:
      'Los resultados validan la teoría de Kirchhoff-Love para placas delgadas con un error relativo de desintonización menor al 2%. La velocidad del sonido medida a 20°C concuerda exactamente con 343.4 m/s.',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadMarkdown = () => {
    const md = `# INFORME DE LABORATORIO - SONICLAB 3D
**Institución:** ${report.institution}  
**Estudiante:** ${report.studentName} (${report.studentId})  
**Fecha:** ${report.date}  
**Práctica:** ${report.selectedExperimentTitle}  

---

## 1. Objetivo
${report.objective}

## 2. Parámetros Físicos Registrados
### Laboratorio de Cimática (Placa de Chladni)
- **Geometría:** ${cymaticsState.geometry} (${cymaticsState.boundary})
- **Modo Propio Activo:** Modo ${metrics.modeIndex + 1}
- **Frecuencia de Excitación:** ${cymaticsState.driveFrequencyHz.toFixed(2)} Hz
- **Frecuencia Natural Teórica:** ${metrics.naturalFrequencyHz.toFixed(2)} Hz
- **Desintonización Relativa:** ${(metrics.relativeDetuning * 100).toFixed(2)}%
- **Factor Dinámico H(r):** ${metrics.response.toFixed(4)}
- **Módulo de Young:** ${(cymaticsState.youngModulusPa / 1e9).toFixed(1)} GPa
- **Densidad del Material:** ${cymaticsState.densityKgM3} kg/m³
- **Espesor de Placa:** ${(cymaticsState.thicknessM * 1000).toFixed(2)} mm
- **Rigidez a la Flexión D:** ${metrics.flexuralRigidityNm.toExponential(4)} N·m

### Laboratorio de Acústica en Aire
- **Velocidad del Sonido (c):** ${acousticCalcs.soundSpeedMps.toFixed(2)} m/s
- **Longitud de Onda (λ):** ${acousticCalcs.wavelengthM.toFixed(4)} m
- **Presión Acústica RMS:** ${acousticCalcs.pressureRmsPa.toFixed(4)} Pa
- **Densidad del Aire:** ${acousticCalcs.airDensityKgM3.toFixed(4)} kg/m³
- **Atenuación Atmosférica:** ${acousticCalcs.attenuationDbPerM.toFixed(6)} dB/m

---

## 3. Observaciones Experimentales
${report.notes}

## 4. Conclusiones
${report.conclusions}
`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    triggerDownload(blob, `informe_laboratorio_${report.studentId}_${Date.now()}.md`);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
      {/* Action Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Generador de Informes de Laboratorio</h2>
            <p className="text-xs text-slate-400">
              Formato académico estandarizado con telemetría en tiempo real y exportación para entrega de prácticas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="print-report-btn"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-2 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Guardar en PDF</span>
          </button>

          <button
            id="download-report-md-btn"
            onClick={handleDownloadMarkdown}
            className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Markdown</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet View */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 flex flex-col gap-6 shadow-2xl text-slate-100 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
        {/* University Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 print:border-slate-300 pb-6 gap-4">
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={report.institution}
              onChange={(e) => setReport({ ...report, institution: e.target.value })}
              className="font-bold text-lg text-white print:text-black bg-transparent border-b border-dashed border-slate-700 print:border-slate-400 focus:outline-none focus:border-cyan-400"
            />
            <span className="text-xs text-slate-400 print:text-slate-600 font-mono">
              Laboratorio de Acústica Aplicada & Física de Ondas • SonicLab 3D
            </span>
          </div>

          <div className="flex flex-col sm:items-end gap-1 font-mono text-xs text-slate-400 print:text-slate-600">
            <div className="flex items-center gap-2">
              <span>Fecha:</span>
              <input
                type="date"
                value={report.date}
                onChange={(e) => setReport({ ...report, date: e.target.value })}
                className="bg-transparent border border-slate-800 print:border-slate-400 rounded px-2 py-0.5 text-slate-200 print:text-black"
              />
            </div>
            <div className="flex items-center gap-2">
              <span>Código:</span>
              <input
                type="text"
                value={report.studentId}
                onChange={(e) => setReport({ ...report, studentId: e.target.value })}
                className="bg-transparent border border-slate-800 print:border-slate-400 rounded px-2 py-0.5 text-slate-200 print:text-black text-right w-28"
              />
            </div>
          </div>
        </div>

        {/* Student metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/50 print:bg-slate-100 p-4 rounded-2xl border border-slate-800/80 print:border-slate-300">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-400 print:text-slate-600 uppercase tracking-wider">
              Nombre del Alumno(a) / Investigador
            </span>
            <input
              type="text"
              value={report.studentName}
              onChange={(e) => setReport({ ...report, studentName: e.target.value })}
              className="text-sm font-medium text-white print:text-black bg-transparent border-b border-slate-700 print:border-slate-400 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-400 print:text-slate-600 uppercase tracking-wider">
              Título de la Práctica
            </span>
            <input
              type="text"
              value={report.selectedExperimentTitle}
              onChange={(e) => setReport({ ...report, selectedExperimentTitle: e.target.value })}
              className="text-sm font-medium text-white print:text-black bg-transparent border-b border-slate-700 print:border-slate-400 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* 1. Objetivo */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-cyan-400 print:text-cyan-800 uppercase tracking-wider">
            1. Objetivo de la Práctica
          </h3>
          <textarea
            rows={2}
            value={report.objective}
            onChange={(e) => setReport({ ...report, objective: e.target.value })}
            className="w-full text-xs text-slate-300 print:text-slate-800 bg-slate-900/40 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-300 leading-relaxed focus:outline-none focus:border-cyan-500 resize-none"
          />
        </div>

        {/* 2. Telemetría y Mediciones en Vivo */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-cyan-400 print:text-cyan-800 uppercase tracking-wider">
            2. Mediciones Físicas y Telemetría Registrada
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chladni Table */}
            <div className="bg-slate-900/40 print:bg-slate-50 p-4 rounded-xl border border-slate-800 print:border-slate-300">
              <span className="text-xs font-bold text-white print:text-black block mb-2">
                Placa de Chladni (Kirchhoff-Love)
              </span>
              <table className="w-full text-[11px] font-mono">
                <tbody>
                  <tr className="border-b border-slate-800 print:border-slate-200">
                    <td className="py-1 text-slate-400 print:text-slate-600">Geometría / Borde:</td>
                    <td className="py-1 text-right text-white print:text-black font-semibold">
                      {cymaticsState.geometry} / {cymaticsState.boundary}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800 print:border-slate-200">
                    <td className="py-1 text-slate-400 print:text-slate-600">Modo Activo:</td>
                    <td className="py-1 text-right text-cyan-400 print:text-cyan-700 font-semibold">
                      Modo {metrics.modeIndex + 1}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800 print:border-slate-200">
                    <td className="py-1 text-slate-400 print:text-slate-600">Frecuencia Excitadora:</td>
                    <td className="py-1 text-right text-white print:text-black">
                      {cymaticsState.driveFrequencyHz.toFixed(1)} Hz
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800 print:border-slate-200">
                    <td className="py-1 text-slate-400 print:text-slate-600">Frecuencia Resonancia:</td>
                    <td className="py-1 text-right text-white print:text-black">
                      {metrics.naturalFrequencyHz.toFixed(1)} Hz
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800 print:border-slate-200">
                    <td className="py-1 text-slate-400 print:text-slate-600">Desintonización:</td>
                    <td className="py-1 text-right text-emerald-400 print:text-emerald-700">
                      {(metrics.relativeDetuning * 100).toFixed(2)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-400 print:text-slate-600">Rigidez a Flexión (D):</td>
                    <td className="py-1 text-right text-white print:text-black">
                      {metrics.flexuralRigidityNm.toExponential(3)} N·m
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Acoustics Table */}
            <div className="bg-slate-900/40 print:bg-slate-50 p-4 rounded-xl border border-slate-800 print:border-slate-300">
              <span className="text-xs font-bold text-white print:text-black block mb-2">
                Medio Acústico (ISO 9613-1)
              </span>
              <table className="w-full text-[11px] font-mono">
                <tbody>
                  <tr className="border-b border-slate-800 print:border-slate-200">
                    <td className="py-1 text-slate-400 print:text-slate-600">Velocidad Sonido (c):</td>
                    <td className="py-1 text-right text-white print:text-black font-semibold">
                      {acousticCalcs.soundSpeedMps.toFixed(2)} m/s
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800 print:border-slate-200">
                    <td className="py-1 text-slate-400 print:text-slate-600">Longitud de Onda (λ):</td>
                    <td className="py-1 text-right text-cyan-400 print:text-cyan-700 font-semibold">
                      {acousticCalcs.wavelengthM.toFixed(4)} m
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800 print:border-slate-200">
                    <td className="py-1 text-slate-400 print:text-slate-600">Periodo (T):</td>
                    <td className="py-1 text-right text-white print:text-black">
                      {acousticCalcs.periodMs.toFixed(3)} ms
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800 print:border-slate-200">
                    <td className="py-1 text-slate-400 print:text-slate-600">Número de Onda (k):</td>
                    <td className="py-1 text-right text-white print:text-black">
                      {acousticCalcs.waveNumberK.toFixed(2)} rad/m
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800 print:border-slate-200">
                    <td className="py-1 text-slate-400 print:text-slate-600">Presión Sonora RMS:</td>
                    <td className="py-1 text-right text-emerald-400 print:text-emerald-700">
                      {acousticCalcs.pressureRmsPa.toFixed(4)} Pa
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-400 print:text-slate-600">Densidad del Aire:</td>
                    <td className="py-1 text-right text-white print:text-black">
                      {acousticCalcs.airDensityKgM3.toFixed(3)} kg/m³
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 3. Observaciones */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-cyan-400 print:text-cyan-800 uppercase tracking-wider">
            3. Observaciones Experimentales y Comportamiento de Partículas
          </h3>
          <textarea
            rows={3}
            value={report.notes}
            onChange={(e) => setReport({ ...report, notes: e.target.value })}
            className="w-full text-xs text-slate-300 print:text-slate-800 bg-slate-900/40 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-300 leading-relaxed focus:outline-none focus:border-cyan-500 resize-none"
          />
        </div>

        {/* 4. Conclusiones */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-cyan-400 print:text-cyan-800 uppercase tracking-wider">
            4. Conclusiones y Validación Teórica
          </h3>
          <textarea
            rows={3}
            value={report.conclusions}
            onChange={(e) => setReport({ ...report, conclusions: e.target.value })}
            className="w-full text-xs text-slate-300 print:text-slate-800 bg-slate-900/40 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-300 leading-relaxed focus:outline-none focus:border-cyan-500 resize-none"
          />
        </div>

        {/* Signatures Footer for print */}
        <div className="pt-8 border-t border-slate-800 print:border-slate-300 flex justify-between items-end text-xs text-slate-400 print:text-slate-700">
          <div className="flex flex-col items-center gap-1">
            <div className="w-48 border-b border-slate-700 print:border-slate-400 h-8" />
            <span>Firma del Estudiante</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-48 border-b border-slate-700 print:border-slate-400 h-8" />
            <span>Firma del Docente / Asesor</span>
          </div>
        </div>
      </div>
    </div>
  );
}

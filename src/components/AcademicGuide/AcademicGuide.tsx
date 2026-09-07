/**
 * SonicLab 3D - Academic Experiments and Laboratory Guides
 */

import React, { useState } from 'react';
import { ACADEMIC_EXPERIMENTS } from '../../data/academicCatalog';
import { AcademicExperiment, AcousticsState, CymaticsState } from '../../types/soniclab';
import { BookOpen, CheckCircle, ChevronDown, ChevronUp, Play, Sparkles } from 'lucide-react';

interface AcademicGuideProps {
  onLoadExperiment: (experiment: AcademicExperiment) => void;
}

export const AcademicGuide: React.FC<AcademicGuideProps> = ({ onLoadExperiment }) => {
  const [activeExp, setActiveExp] = useState<AcademicExperiment>(ACADEMIC_EXPERIMENTS[0]);
  const [revealedQuestions, setRevealedQuestions] = useState<Record<string, boolean>>({});

  const toggleQuestion = (qKey: string) => {
    setRevealedQuestions((prev) => ({ ...prev, [qKey]: !prev[qKey] }));
  };

  return (
    <div className="w-full flex flex-col gap-6 text-slate-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-500/30 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              Guías Didácticas de Laboratorio
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Prácticas Experimentales de Cimática y Acústica
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl">
            Protocolos paso a paso orientados al aprendizaje riguroso de modos propios de vibración,
            propagación longitudinal en medios compresibles e interferencia acústica.
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Experiments Catalog */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Catálogo de Experimentos ({ACADEMIC_EXPERIMENTS.length})
          </span>

          <div className="flex flex-col gap-2.5">
            {ACADEMIC_EXPERIMENTS.map((exp) => (
              <button
                key={exp.id}
                onClick={() => setActiveExp(exp)}
                className={`p-4 rounded-xl border text-left flex flex-col gap-1.5 transition-all ${
                  activeExp.id === exp.id
                    ? 'bg-slate-800/90 border-purple-500/60 shadow-lg shadow-purple-500/10'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {exp.category}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{exp.difficulty}</span>
                </div>
                <h4 className="text-sm font-semibold text-white leading-snug">{exp.title}</h4>
                <p className="text-xs text-slate-400 line-clamp-2">{exp.summary}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Active Experiment Details and Launcher */}
        <div className="lg:col-span-8 flex flex-col gap-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono text-purple-400 font-semibold uppercase">
                {activeExp.category} • Dificultad: {activeExp.difficulty}
              </span>
              <h3 className="text-xl font-bold text-white">{activeExp.title}</h3>
            </div>

            <button
              id="launch-experiment-btn"
              onClick={() => onLoadExperiment(activeExp)}
              className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-all font-medium text-xs flex items-center gap-2 shadow-lg shadow-purple-500/10"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Ejecutar en Laboratorio</span>
            </button>
          </div>

          {/* Objective */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Objetivo Científico
            </span>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              {activeExp.objective}
            </p>
          </div>

          {/* Summary / Physical Principle */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Fundamento Físico
            </span>
            <p className="text-sm text-slate-300 leading-relaxed">{activeExp.summary}</p>
          </div>

          {/* Guided Questions */}
          <div className="flex flex-col gap-3 pt-3 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Preguntas de Observación y Comprobación</span>
            </span>

            <div className="flex flex-col gap-2">
              {activeExp.questions.map((q, idx) => {
                const qKey = `${activeExp.id}-q-${idx}`;
                const isOpen = revealedQuestions[qKey];
                return (
                  <div key={idx} className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleQuestion(qKey)}
                      className="w-full px-4 py-3 text-left flex items-center justify-between text-xs font-medium text-slate-200 hover:text-purple-300 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-mono text-[11px]">
                          {idx + 1}
                        </span>
                        <span>{q}</span>
                      </span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3 pt-1 text-xs text-slate-400 border-t border-slate-800/60 leading-relaxed">
                        Observa el comportamiento en el visor interactivo. Modifica los parámetros de excitación
                        y compara el patrón nodal y la respuesta del espectro de audio.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

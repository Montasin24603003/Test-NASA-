import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  Loader2, 
  CheckCircle2, 
  ShieldAlert, 
  Droplets, 
  Mountain, 
  Compass, 
  ExternalLink,
  BookOpen,
  Activity,
  Layers
} from 'lucide-react';
import type { SwimAssessment } from '@/lib/swim-data';

export interface MarsAiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: {
    lat: number;
    lon: number;
    name: string;
    elevationM: number;
    slopeDeg?: number;
    roughnessM?: number;
    terrainClassification?: string;
    roverStatus?: string;
    roverScore?: number;
    evaStatus?: string;
    evaScore?: number;
    meriScore?: number;
    meriClassification?: string;
    swim: SwimAssessment;
  } | null;
}

export function MarsAiAdvisorModal({
  isOpen,
  onClose,
  context,
}: MarsAiAdvisorModalProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [providerMode, setProviderMode] = useState<string>('scientific-rag');
  const [citations, setCitations] = useState<any[]>([]);

  if (!isOpen) return null;

  const handleAsk = async (qText?: string) => {
    const activeQuestion = qText || question;
    if (!activeQuestion.trim()) return;

    setLoading(true);
    setAnswer(null);
    setCitations([]);

    try {
      const res = await fetch('/api/mars-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: activeQuestion,
          context: context ? {
            lat: context.lat,
            lon: context.lon,
            name: context.name,
            elevationM: context.elevationM,
            slopeDeg: context.slopeDeg,
            roughnessM: context.roughnessM,
            terrainClassification: context.terrainClassification,
            roverStatus: context.roverStatus,
            roverScore: context.roverScore,
            evaStatus: context.evaStatus,
            evaScore: context.evaScore,
            meriScore: context.meriScore,
            meriClassification: context.meriClassification,
            swim: {
              compositeConsistency: context.swim.compositeConsistency,
              dominantDepth: context.swim.dominantDepth,
              confidenceCategory: context.swim.confidenceCategory,
              evidenceTier: context.swim.evidenceTier,
              wehPercent: context.swim.wehPercent,
              extractionFeasibility: context.swim.extractionFeasibility,
            },
          } : undefined,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAnswer(data.answer);
      setProviderMode(data.mode);
      if (Array.isArray(data.citations)) {
        setCitations(data.citations);
      }
    } catch (err) {
      setAnswer('Unable to communicate with Mission Advisor service. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  const sampleQuestions = [
    `Can we extract drinking water and fuel oxidizer at ${context?.name || 'this coordinate'}?`,
    `What are the major terrain rollover and slope hazards for a rover vs astronaut traverse here?`,
    `Why is this exploration area rated as ${context?.meriClassification || 'CAUTION'} on the MERI index?`,
    `What are the mandatory turn-back conditions and consumable margins for a mission here?`,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 font-sans">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#080d17]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Grounded AI Mission Advisor
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold uppercase border border-amber-500/20">
                  NASA RAG Grounded
                </span>
              </div>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target: {context?.name || 'Survey Coordinate'} ({context?.lat.toFixed(2)}°, {context?.lon.toFixed(2)}°)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Telemetry Context Pill Bar */}
        {context && (
          <div className="p-3 bg-amber-500/5 dark:bg-amber-950/20 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5">
              <Mountain className="size-3.5 text-amber-500" />
              <span>{context.elevationM >= 0 ? `+${context.elevationM}` : context.elevationM} m MOLA ({context.slopeDeg ?? 0}°)</span>
            </div>
            <span>&middot;</span>
            <div className="flex items-center gap-1.5">
              <Droplets className="size-3.5 text-cyan-500" />
              <span>SWIM: {context.swim.confidenceCategory}</span>
            </div>
            <span>&middot;</span>
            <div className="flex items-center gap-1.5">
              <Activity className="size-3.5 text-indigo-400" />
              <span>MERI: {context.meriScore ?? '—'}/100 ({context.meriClassification ?? 'NOMINAL'})</span>
            </div>
          </div>
        )}

        {/* Body & Conversation Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Preset Prompts */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
              Suggested Mission Queries for This Site
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sampleQuestions.map((sq, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuestion(sq);
                    handleAsk(sq);
                  }}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-amber-500/10 hover:border-amber-500/40 text-left text-xs transition-colors"
                >
                  <p className="line-clamp-2 text-slate-700 dark:text-slate-200">{sq}</p>
                </button>
              ))}
            </div>
          </div>

          {/* AI Response Display */}
          {loading ? (
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
              <Loader2 className="size-8 animate-spin text-amber-500" />
              <p className="font-mono text-xs text-slate-500">
                Retrieving peer-reviewed NASA citations and synthesizing MOLA &amp; SWIM 2.0 telemetry...
              </p>
            </div>
          ) : answer ? (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    Mission Intelligence Brief
                  </span>
                  <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Mode: {providerMode}
                  </span>
                </div>
                <div className="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line font-sans">
                  {answer}
                </div>
              </div>

              {/* Ingested Citations Card */}
              {citations.length > 0 && (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-400">
                    <BookOpen className="size-3.5 text-amber-500" />
                    <span>NASA Literature References Ingested For This Query:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                    {citations.map((c, i) => (
                      <div key={i} className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <span className="text-amber-500 font-bold">[{i + 1}]</span>{' '}
                        <strong className="text-slate-900 dark:text-slate-100">{c.title}</strong>
                        <p className="text-[10px] text-slate-500 mt-0.5">{c.authors} ({c.year})</p>
                        <a 
                          href={c.doiOrUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:underline mt-1"
                        >
                          <span>Publication DOI</span>
                          <ExternalLink className="size-2.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080d17] flex items-center gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="Ask AI advisor about terrain, rover vs EVA hazards, ice extraction, or route trade-offs..."
            className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
          <button
            type="button"
            onClick={() => handleAsk()}
            disabled={loading || !question.trim()}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-display font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            <span className="hidden sm:inline">Consult</span>
          </button>
        </div>

      </div>
    </div>
  );
}

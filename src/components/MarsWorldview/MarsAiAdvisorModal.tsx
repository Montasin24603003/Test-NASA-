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
  ExternalLink 
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
  const [providerMode, setProviderMode] = useState<string>('local-fallback');

  if (!isOpen) return null;

  const handleAsk = async (qText?: string) => {
    const activeQuestion = qText || question;
    if (!activeQuestion.trim()) return;

    setLoading(true);
    setAnswer(null);

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
            swim: {
              compositeConsistency: context.swim.compositeConsistency,
              dominantDepth: context.swim.dominantDepth,
              confidenceCategory: context.swim.confidenceCategory,
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
    } catch (err) {
      setAnswer('Unable to communicate with Mission Advisor service. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  const sampleQuestions = [
    `Can we extract drinking water and fuel oxidizer at ${context?.name || 'this coordinate'}?`,
    `What are the major terrain rollover and slope hazards for a rover traverse here?`,
    `How does the atmospheric pressure and cosmic radiation here impact crew habitat shielding?`,
    `What scientific samples should crew prioritize at this location for biosignature detection?`,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Grounded AI Mission Advisor
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold uppercase">
                  NASA Data Grounded
                </span>
              </div>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Site: {context?.name || 'Survey Coordinate'} ({context?.lat.toFixed(2)}°, {context?.lon.toFixed(2)}°)
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

        {/* Telemetry Summary Pill Bar */}
        {context && (
          <div className="p-3 bg-amber-50/40 dark:bg-amber-950/20 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1">
              <Mountain className="size-3.5 text-amber-500" />
              <span>Elevation: {context.elevationM >= 0 ? `+${context.elevationM}` : context.elevationM} m</span>
            </div>
            <span>&middot;</span>
            <div className="flex items-center gap-1">
              <Droplets className="size-3.5 text-cyan-500" />
              <span>SWIM Ice: {context.swim.confidenceCategory} (CI: {context.swim.compositeConsistency})</span>
            </div>
            <span>&middot;</span>
            <div className="flex items-center gap-1">
              <ShieldAlert className="size-3.5 text-rose-500" />
              <span>ISRU Feasibility: {context.swim.extractionFeasibility}</span>
            </div>
          </div>
        )}

        {/* Body & Conversation Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Preset Prompts */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
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
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:bg-amber-500/10 hover:border-amber-500/40 hover:text-amber-900 dark:hover:text-amber-200 text-left text-xs transition-colors"
                >
                  <p className="line-clamp-2">{sq}</p>
                </button>
              ))}
            </div>
          </div>

          {/* AI Response Display */}
          {loading ? (
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
              <Loader2 className="size-8 animate-spin text-amber-500" />
              <p className="font-mono text-xs text-slate-500">
                Cross-referencing MOLA topography, SWIM 2.0 radar consistency, and MSL radiation baselines...
              </p>
            </div>
          ) : answer ? (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Mission Evaluation Completed
                </span>
                <span>Mode: {providerMode.toUpperCase()}</span>
              </div>
              <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line font-sans">
                {answer}
              </div>
            </div>
          ) : null}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="Ask AI advisor about terrain, radiation, ice extraction, or landing safety..."
            className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
          <button
            type="button"
            onClick={() => handleAsk()}
            disabled={loading || !question.trim()}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-display font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            <span>Consult Advisor</span>
          </button>
        </div>
      </div>
    </div>
  );
}

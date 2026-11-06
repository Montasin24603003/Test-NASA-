import React from 'react';
import { 
  X, 
  ExternalLink, 
  Cpu, 
  Layers, 
  ShieldCheck, 
  Scale, 
  FileText, 
  Sparkles, 
  BookOpen, 
  AlertTriangle 
} from 'lucide-react';
import type { HfModelMetadata } from '@/lib/hf-mars-models';

interface HfModelCardModalProps {
  model: HfModelMetadata | null;
  onClose: () => void;
}

export function HfModelCardModal({ model, onClose }: HfModelCardModalProps) {
  if (!model) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl text-slate-200 font-sans">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 uppercase">
                {model.category}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {model.parameterCount}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white font-mono">{model.name}</h2>
            <p className="text-xs text-slate-400">{model.authors}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-5 space-y-5 text-xs leading-relaxed">
          {/* Description */}
          <div>
            <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
              <FileText className="size-3.5 text-amber-400" />
              Model Architecture &amp; Methodology
            </h3>
            <p className="text-slate-300">{model.description}</p>
            <div className="mt-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 font-mono text-[11px]">
              <span className="text-slate-500">Architecture: </span>
              <span className="text-slate-200">{model.architecture}</span>
            </div>
          </div>

          {/* Target Sensors & Resolution */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
              <h4 className="font-mono text-[10px] uppercase text-slate-400 tracking-wider mb-1 flex items-center gap-1">
                <Layers className="size-3 text-cyan-400" />
                Target Sensors
              </h4>
              <div className="flex flex-wrap gap-1 mt-1">
                {model.targetSensors.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">
                    {s}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1.5">Resolution: {model.resolutionRange}</p>
            </div>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
              <h4 className="font-mono text-[10px] uppercase text-slate-400 tracking-wider mb-1 flex items-center gap-1">
                <Cpu className="size-3 text-emerald-400" />
                Inference Requirements
              </h4>
              <p className="text-slate-300 font-mono text-[11px]">
                Min VRAM: <span className="text-emerald-400">{model.inferenceRequirements.minVramGb} GB</span>
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-1">
                Recommended: {model.inferenceRequirements.recommendedDevice} · CPU: {model.inferenceRequirements.supportsCpu ? 'Supported' : 'Unavailable (VRAM Guard)'}
              </p>
            </div>
          </div>

          {/* Preprocessing Specifications */}
          <div>
            <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Scale className="size-3.5 text-amber-400" />
              Input Format &amp; Preprocessing
            </h3>
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1 font-mono text-[11px]">
              <p><span className="text-slate-500">Input: </span>{model.inputFormat}</p>
              <p><span className="text-slate-500">Preprocessing: </span>{model.preprocessingRequirements}</p>
            </div>
          </div>

          {/* Limitations & Scientific Notice */}
          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-200">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="size-3.5 text-rose-400" />
              Scientific Limitations &amp; Guardrails
            </h4>
            <p className="text-[11px] leading-relaxed text-rose-200/90">{model.limitations}</p>
          </div>

          {/* License & Hugging Face Link */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <ShieldCheck className="size-3.5 text-slate-400" />
              License: <span className="text-slate-200 font-bold">{model.license}</span>
            </div>
            <a
              href={model.hfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-[11px] font-bold shadow-md transition-colors"
            >
              <span>View on Hugging Face</span>
              <ExternalLink className="size-3" />
            </a>
          </div>

          {/* Citations */}
          {model.citations && model.citations.length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <h4 className="text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1 flex items-center gap-1">
                <BookOpen className="size-3 text-slate-500" />
                Scientific References &amp; Citations
              </h4>
              <ul className="space-y-1 text-[10px] font-mono text-slate-400">
                {model.citations.map((c, i) => (
                  <li key={i} className="list-disc list-inside">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

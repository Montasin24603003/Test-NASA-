import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Search, 
  ExternalLink, 
  X, 
  Loader2, 
  Sparkles, 
  Calendar, 
  Building,
  Image as ImageIcon
} from 'lucide-react';

interface NasaImageItem {
  nasaId: string;
  title: string;
  description: string;
  thumbUrl: string;
  origUrl: string;
  center: string;
  dateCreated: string;
}

export function NasaImagesModal({
  isOpen,
  onClose,
  initialQuery = 'Perseverance rover Mars',
}: {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<NasaImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<NasaImageItem | null>(null);

  const fetchNasaImages = async (searchParam: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(searchParam)}&media_type=image&page_size=18`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const parsedItems: NasaImageItem[] = (data.collection?.items || []).map((item: any) => {
        const d = item.data?.[0] || {};
        const thumb = item.links?.[0]?.href || '';
        return {
          nasaId: d.nasa_id || '',
          title: d.title || 'Mars Image',
          description: d.description || '',
          thumbUrl: thumb,
          origUrl: thumb.replace('~thumb.jpg', '~orig.jpg').replace('~thumb.png', '~orig.png'),
          center: d.center || 'NASA',
          dateCreated: d.date_created ? new Date(d.date_created).toLocaleDateString() : 'N/A',
        };
      }).filter((it: NasaImageItem) => it.thumbUrl);

      setItems(parsedItems);
    } catch (err: any) {
      setError('Unable to reach NASA Images API. Please check internet connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNasaImages(query);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const quickFilters = [
    { label: 'Perseverance Delta', query: 'Perseverance rover delta Jezero' },
    { label: 'Curiosity Mount Sharp', query: 'Curiosity rover Gale crater Mount Sharp' },
    { label: 'MRO HiRISE Dunes', query: 'Mars Reconnaissance Orbiter HiRISE dunes' },
    { label: 'InSight Seismometer', query: 'InSight lander Mars seismometer SEIS' },
    { label: 'Viking 1976 Surface', query: 'Viking lander Mars surface 1976' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Camera className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                NASA Images &amp; Video Library Explorer
              </h3>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                Live query to images-api.nasa.gov · Mars Mission Observations
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

        {/* Search Bar & Quick Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchNasaImages(query)}
                placeholder="Search real NASA Mars imagery..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchNasaImages(query)}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-display font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
              <span>Search NASA</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
            <span className="text-slate-400 text-[10px] mr-1 uppercase">Quick Searches:</span>
            {quickFilters.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => {
                  setQuery(q.query);
                  fetchNasaImages(q.query);
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:bg-amber-500/10 hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="size-8 animate-spin text-amber-500" />
              <p className="font-mono text-xs">Querying NASA Images &amp; Video Library...</p>
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-rose-500 font-mono text-xs">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => fetchNasaImages(query)}
                className="text-amber-500 underline"
              >
                Retry Query
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 font-mono text-xs">
              <ImageIcon className="size-8 opacity-40" />
              <p>No NASA images found for "{query}". Try a broader query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((item) => (
                <div
                  key={item.nasaId}
                  onClick={() => setSelectedImage(item)}
                  className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
                >
                  <div className="aspect-video w-full overflow-hidden bg-slate-900">
                    <img
                      src={item.thumbUrl}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-2.5">
                    <h4 className="font-display text-xs font-semibold text-slate-900 dark:text-white line-clamp-2">
                      {item.title}
                    </h4>
                    <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>{item.center}</span>
                      <span>{item.dateCreated}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Image Detail Modal */}
        {selectedImage && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-md p-6 flex flex-col sm:flex-row gap-6 overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition-colors z-40"
            >
              <X className="size-5" />
            </button>

            <div className="flex-1 flex items-center justify-center max-h-[60vh] sm:max-h-full">
              <img
                src={selectedImage.origUrl || selectedImage.thumbUrl}
                alt={selectedImage.title}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-slate-700"
              />
            </div>

            <div className="w-full sm:w-80 flex flex-col justify-between text-white space-y-4">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold uppercase">
                  NASA Planetary Archive
                </span>
                <h3 className="font-display text-base font-bold mt-2">
                  {selectedImage.title}
                </h3>
                <div className="flex items-center gap-3 text-xs font-mono text-slate-400 mt-1">
                  <span>Center: {selectedImage.center}</span>
                  <span>Date: {selectedImage.dateCreated}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mt-3 max-h-48 overflow-y-auto pr-1">
                  {selectedImage.description || 'No detailed description available from NASA metadata.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <a
                  href={`https://images.nasa.gov/details/${selectedImage.nasaId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:underline font-mono"
                >
                  <span>View on NASA.gov</span>
                  <ExternalLink className="size-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                >
                  Back to Results
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

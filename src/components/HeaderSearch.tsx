import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PredictiveSearchDropdown } from './PredictiveSearchDropdown';
import {
  ensureCatalogLoaded,
  fetchCatalogSuggestions,
  getCachedCatalogSnapshot,
  getRecentSearches,
  mergeCatalogItems,
  removeRecentSearch,
  saveRecentSearch,
  searchCatalogLocal,
  type CatalogSearchItem,
} from '../utils/catalogSearch';

interface HeaderSearchProps {
  className?: string;
  placeholder?: string;
  enableGlobalShortcut?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
  dropdownClassName?: string;
}

export function HeaderSearch({
  className = '',
  placeholder = 'Cari Anime, Donghua...',
  enableGlobalShortcut = false,
  compact = false,
  autoFocus = false,
  dropdownClassName,
}: HeaderSearchProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [catalogItems, setCatalogItems] = useState<CatalogSearchItem[]>(() =>
    getCachedCatalogSnapshot()
  );
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    getRecentSearches()
  );

  // Preload catalog index silently when header mounts so suggestions are instant on first keystroke
  useEffect(() => {
    let active = true;
    const load = () => {
      ensureCatalogLoaded().then((loaded) => {
        if (active && loaded.length > 0) {
          setCatalogItems((prev) => mergeCatalogItems(prev, loaded));
        }
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = (window as Window & {
        requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback: (id: number) => void;
      }).requestIdleCallback(load, { timeout: 1200 });
      return () => {
        active = false;
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
      };
    }

    const timer = setTimeout(load, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  // Optional '/' keyboard shortcut to focus header search
  useEffect(() => {
    if (!enableGlobalShortcut) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }
      if (!inputRef.current || inputRef.current.offsetParent === null) return;
      e.preventDefault();
      inputRef.current.focus();
      setIsOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableGlobalShortcut]);

  // Close on outside click or focus leaving container
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  // Debounced live catalog search enrichment as user types >= 2 characters
  useEffect(() => {
    const trimmed = query.trim();
    setActiveIndex(-1);

    if (trimmed.length < 2) {
      setIsLoadingRemote(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(async () => {
      setIsLoadingRemote(true);
      try {
        const remote = await fetchCatalogSuggestions(trimmed, controller.signal);
        if (active && remote.length > 0) {
          setCatalogItems((prev) => mergeCatalogItems(prev, remote));
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          // Ignore transient search error; local catalog matches still remain visible
        }
      } finally {
        if (active) setIsLoadingRemote(false);
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Keep options array aligned with PredictiveSearchDropdown for keyboard navigation
  const navigableItems = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return catalogItems.slice(0, 4);
    return searchCatalogLocal(trimmed, catalogItems, 7);
  }, [query, catalogItems]);

  const handleFocus = () => {
    setIsOpen(true);
    setRecentSearches(getRecentSearches());
    const snap = getCachedCatalogSnapshot();
    if (snap.length > 0) {
      setCatalogItems((prev) => mergeCatalogItems(prev, snap));
    }
    ensureCatalogLoaded().then((loaded) => {
      if (loaded.length > 0) {
        setCatalogItems((prev) => mergeCatalogItems(prev, loaded));
      }
    });
  };

  const navigateToItem = (item: CatalogSearchItem) => {
    const nextRecents = saveRecentSearch(item.title);
    setRecentSearches(nextRecents);
    setIsOpen(false);
    setActiveIndex(-1);
    const epQuery = item.episodeId ? `?ep=${encodeURIComponent(item.episodeId)}` : '';
    navigate(`/detail/${item.type}/${encodeURIComponent(item.id)}${epQuery}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && navigableItems[activeIndex]) {
      navigateToItem(navigableItems[activeIndex]);
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches(saveRecentSearch(trimmed));
    setIsOpen(false);
    setActiveIndex(-1);
    navigate(`/catalog?q=${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      if (navigableItems.length === 0) return;
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % navigableItems.length);
    } else if (e.key === 'ArrowUp') {
      if (navigableItems.length === 0) return;
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? navigableItems.length - 1 : prev - 1));
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form
        onSubmit={handleSubmit}
        role="search"
        className="relative w-full"
      >
        <Search
          aria-hidden="true"
          className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-label="Cari judul anime atau donghua"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          className={`w-full ${
            compact ? 'h-10 text-xs' : 'h-11 sm:h-10 text-sm sm:text-xs'
          } pl-9 pr-9 rounded-xl bg-slate-100/90 hover:bg-slate-100 focus:bg-white dark:bg-[#13151C] dark:hover:bg-[#171A23] dark:focus:bg-[#14161F] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18] focus:ring-2 focus:ring-[#E84A18]/20 transition-colors`}
        />
        {query ? (
          <button
            type="button"
            aria-label="Bersihkan pencarian"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery('');
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          enableGlobalShortcut &&
          !isOpen && (
            <kbd
              aria-hidden="true"
              className="hidden xl:inline-flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 h-5 rounded border border-slate-300/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] text-[10px] font-mono text-slate-400 dark:text-gray-500 pointer-events-none"
            >
              /
            </kbd>
          )
        )}
      </form>

      <PredictiveSearchDropdown
        query={query}
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setActiveIndex(-1);
        }}
        items={catalogItems}
        activeIndex={activeIndex}
        onHoverIndex={setActiveIndex}
        isLoadingRemote={isLoadingRemote}
        recentSearches={recentSearches}
        onSelectRecentSearch={(term) => {
          setQuery(term);
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        onRemoveRecentSearch={(term) => {
          setRecentSearches(removeRecentSearch(term));
        }}
        onSelectItem={(item) => {
          setRecentSearches(saveRecentSearch(item.title));
        }}
        listboxId={listboxId}
        dropdownClassName={dropdownClassName}
      />
    </div>
  );
}

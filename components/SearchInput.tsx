"use client";

import { useEffect, useRef, useState } from "react";
import type { RestaurantResult } from "@/lib/types";

interface SearchInputProps {
  onSelect: (restaurant: RestaurantResult | null) => void;
  selected: RestaurantResult | null;
}

export function SearchInput({ onSelect, selected }: SearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RestaurantResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (selected) {
      setQuery(selected.name);
    }
  }, [selected]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="relative">
      <label className="mb-1.5 block text-sm font-medium text-gray-300">
        Restaurant
      </label>
      <input
        className="input"
        placeholder="Search by name or paste Resy/OpenTable URL..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selected && e.target.value !== selected.name) {
            onSelect(null);
          }
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {loading && (
        <span className="absolute right-3 top-10 text-xs text-gray-500">
          Searching...
        </span>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-surface-border bg-surface-raised shadow-xl">
          {results.map((r) => (
            <li key={`${r.platform}-${r.venueId}`}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-border"
                onClick={() => {
                  onSelect(r);
                  setQuery(r.name);
                  setOpen(false);
                }}
              >
                <span
                  className={
                    r.platform === "resy" ? "badge-resy" : "badge-opentable"
                  }
                >
                  {r.platform}
                </span>
                <div>
                  <div className="text-sm font-medium text-white">{r.name}</div>
                  {r.location && (
                    <div className="text-xs text-gray-500">{r.location}</div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <p className="mt-2 text-xs text-gray-500">
          {selected.platform === "resy" ? "Resy" : "OpenTable"} · ID{" "}
          {selected.venueId}
        </p>
      )}
    </div>
  );
}

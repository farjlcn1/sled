"use client";

import { useEffect, useRef, useState } from "react";

export function AddressCombobox({
  name,
  value,
  onChange,
  required,
  className,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/geokod?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: { results?: string[] }) => setSuggestions(data.results ?? []))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [value]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        name={name}
        required={required}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Išči naslov …"
        className={className}
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onChange(s);
                  setIsOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-blue-50 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select…",
  className = "",
  disabled,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: r.bottom + 4,
        left: r.left,
        width: r.width,
        zIndex: 9999,
      });
    }
    setOpen(true);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          className="h-4 w-4 text-gray-400 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          style={dropdownStyle}
          className="rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm"
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              onMouseDown={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                opt.value === value
                  ? "font-medium text-brand-600"
                  : "text-gray-700"
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

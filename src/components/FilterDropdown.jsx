import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export default function FilterDropdown({ value, onChange, options, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label || options[0]?.label || "Select",
    [options, value],
  );

  useEffect(() => {
    const closeFromOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };

    const closeFromEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);

    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, []);

  return (
    <div className={`filter-select ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="filter-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>

      {open && (
        <div className="filter-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                type="button"
                key={option.value || "all"}
                role="option"
                aria-selected={selected}
                className={`filter-select-option ${selected ? "selected" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {selected && <Check size={16} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

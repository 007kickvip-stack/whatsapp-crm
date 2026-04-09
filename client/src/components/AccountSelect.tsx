import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronDown, Search, X } from "lucide-react";

type AccountItem = {
  id: number;
  name: string;
  color: string | null;
  sortOrder: number | null;
};

interface AccountSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Compact mode for inline table cells */
  compact?: boolean;
  /** Show "all" option for filters */
  showAll?: boolean;
  allLabel?: string;
  className?: string;
}

export default function AccountSelect({
  value,
  onValueChange,
  placeholder = "选择账号",
  disabled = false,
  compact = false,
  showAll = false,
  allLabel = "全部账号",
  className = "",
}: AccountSelectProps) {
  const { data: accountsRaw = [] } = trpc.accounts.list.useQuery();
  const accounts = accountsRaw as AccountItem[];

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter((a) => a.name.toLowerCase().includes(q));
  }, [accounts, search]);

  const selectedAccount = accounts.find((a) => a.name === value);
  const displayText = value
    ? selectedAccount?.name || value
    : showAll
    ? allLabel
    : placeholder;
  const displayColor = selectedAccount?.color || null;

  if (disabled) {
    return (
      <div className={`flex items-center gap-1 ${compact ? "text-[11px] min-h-[24px] px-1" : "text-sm px-2 py-1"} ${className}`}>
        {displayColor && (
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: displayColor }}
          />
        )}
        <span className="truncate">{value || <span className="text-gray-300">-</span>}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSearch("");
        }}
        className={`
          w-full flex items-center gap-1 border rounded transition-colors
          ${compact
            ? "border-gray-200 px-1 py-0.5 text-[11px] hover:bg-emerald-50 focus:ring-1 focus:ring-emerald-400"
            : "border-input bg-background px-2 py-1.5 text-xs hover:bg-accent/50 focus:ring-1 focus:ring-ring"
          }
          ${open ? (compact ? "ring-1 ring-emerald-400" : "ring-1 ring-ring") : ""}
          ${!value && !showAll ? "text-muted-foreground" : ""}
        `}
      >
        {displayColor && (
          <span
            className={`inline-block rounded-full shrink-0 ${compact ? "w-2 h-2" : "w-2.5 h-2.5"}`}
            style={{ backgroundColor: displayColor }}
          />
        )}
        <span className="truncate flex-1 text-left">{displayText}</span>
        <ChevronDown className={`shrink-0 text-muted-foreground transition-transform ${compact ? "w-3 h-3" : "w-3.5 h-3.5"} ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className={`absolute z-50 mt-1 w-full min-w-[180px] bg-popover border border-border rounded-md shadow-lg ${compact ? "text-[11px]" : "text-xs"}`}>
          {/* Search input */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索账号..."
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-[240px] overflow-y-auto py-1">
            {/* "All" option for filters */}
            {showAll && (
              <button
                type="button"
                onClick={() => {
                  onValueChange("");
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 transition-colors text-left ${
                  !value ? "bg-accent text-accent-foreground font-medium" : ""
                }`}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0" />
                <span>{allLabel}</span>
              </button>
            )}

            {/* Empty option */}
            {!showAll && (
              <button
                type="button"
                onClick={() => {
                  onValueChange("");
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 transition-colors text-left text-muted-foreground ${
                  !value ? "bg-accent font-medium" : ""
                }`}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-200 shrink-0" />
                <span>{placeholder}</span>
              </button>
            )}

            {/* Account options */}
            {filtered.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  onValueChange(acc.name);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 transition-colors text-left ${
                  value === acc.name ? "bg-accent text-accent-foreground font-medium" : ""
                }`}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: acc.color || "#94a3b8" }}
                />
                <span className="truncate">{acc.name}</span>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-muted-foreground">
                未找到匹配的账号
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

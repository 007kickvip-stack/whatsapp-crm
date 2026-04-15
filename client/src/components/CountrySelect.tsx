import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, X } from "lucide-react";

// Country data: { name, flag emoji }
// Flag emojis use regional indicator symbols (Unicode standard)
const COUNTRY_DATA: { name: string; flag: string }[] = [
  // Middle East (高频业务区)
  { name: "巴基斯坦", flag: "🇵🇰" },
  { name: "沙特阿拉伯", flag: "🇸🇦" },
  { name: "阿联酋", flag: "🇦🇪" },
  { name: "科威特", flag: "🇰🇼" },
  { name: "卡塔尔", flag: "🇶🇦" },
  { name: "巴林", flag: "🇧🇭" },
  { name: "阿曼", flag: "🇴🇲" },
  { name: "伊拉克", flag: "🇮🇶" },
  { name: "约旦", flag: "🇯🇴" },
  { name: "黎巴嫩", flag: "🇱🇧" },
  { name: "叙利亚", flag: "🇸🇾" },
  { name: "也门", flag: "🇾🇪" },
  { name: "伊朗", flag: "🇮🇷" },
  // South Asia
  { name: "印度", flag: "🇮🇳" },
  { name: "孟加拉国", flag: "🇧🇩" },
  { name: "斯里兰卡", flag: "🇱🇰" },
  { name: "尼泊尔", flag: "🇳🇵" },
  // Southeast Asia
  { name: "马来西亚", flag: "🇲🇾" },
  { name: "印度尼西亚", flag: "🇮🇩" },
  { name: "泰国", flag: "🇹🇭" },
  { name: "越南", flag: "🇻🇳" },
  { name: "菲律宾", flag: "🇵🇭" },
  { name: "新加坡", flag: "🇸🇬" },
  { name: "缅甸", flag: "🇲🇲" },
  { name: "柬埔寨", flag: "🇰🇭" },
  // Africa
  { name: "埃及", flag: "🇪🇬" },
  { name: "摩洛哥", flag: "🇲🇦" },
  { name: "突尼斯", flag: "🇹🇳" },
  { name: "阿尔及利亚", flag: "🇩🇿" },
  { name: "利比亚", flag: "🇱🇾" },
  { name: "苏丹", flag: "🇸🇩" },
  { name: "尼日利亚", flag: "🇳🇬" },
  { name: "南非", flag: "🇿🇦" },
  { name: "肯尼亚", flag: "🇰🇪" },
  { name: "加纳", flag: "🇬🇭" },
  { name: "坦桑尼亚", flag: "🇹🇿" },
  { name: "埃塞俄比亚", flag: "🇪🇹" },
  { name: "乌干达", flag: "🇺🇬" },
  // Europe
  { name: "英国", flag: "🇬🇧" },
  { name: "法国", flag: "🇫🇷" },
  { name: "德国", flag: "🇩🇪" },
  { name: "意大利", flag: "🇮🇹" },
  { name: "西班牙", flag: "🇪🇸" },
  { name: "葡萄牙", flag: "🇵🇹" },
  { name: "荷兰", flag: "🇳🇱" },
  { name: "比利时", flag: "🇧🇪" },
  { name: "瑞士", flag: "🇨🇭" },
  { name: "奥地利", flag: "🇦🇹" },
  { name: "瑞典", flag: "🇸🇪" },
  { name: "挪威", flag: "🇳🇴" },
  { name: "丹麦", flag: "🇩🇰" },
  { name: "芬兰", flag: "🇫🇮" },
  { name: "波兰", flag: "🇵🇱" },
  { name: "捷克", flag: "🇨🇿" },
  { name: "希腊", flag: "🇬🇷" },
  { name: "土耳其", flag: "🇹🇷" },
  { name: "俄罗斯", flag: "🇷🇺" },
  { name: "乌克兰", flag: "🇺🇦" },
  { name: "罗马尼亚", flag: "🇷🇴" },
  { name: "匈牙利", flag: "🇭🇺" },
  // Americas
  { name: "美国", flag: "🇺🇸" },
  { name: "加拿大", flag: "🇨🇦" },
  { name: "墨西哥", flag: "🇲🇽" },
  { name: "巴西", flag: "🇧🇷" },
  { name: "阿根廷", flag: "🇦🇷" },
  { name: "智利", flag: "🇨🇱" },
  { name: "哥伦比亚", flag: "🇨🇴" },
  { name: "秘鲁", flag: "🇵🇪" },
  // East Asia & Oceania
  { name: "中国", flag: "🇨🇳" },
  { name: "日本", flag: "🇯🇵" },
  { name: "韩国", flag: "🇰🇷" },
  { name: "中国台湾", flag: "🇨🇳" },
  { name: "中国香港", flag: "🇭🇰" },
  { name: "中国澳门", flag: "🇲🇴" },
  { name: "澳大利亚", flag: "🇦🇺" },
  { name: "新西兰", flag: "🇳🇿" },
  // Central Asia
  { name: "哈萨克斯坦", flag: "🇰🇿" },
  { name: "乌兹别克斯坦", flag: "🇺🇿" },
  { name: "土库曼斯坦", flag: "🇹🇲" },
  { name: "吉尔吉斯斯坦", flag: "🇰🇬" },
  { name: "塔吉克斯坦", flag: "🇹🇯" },
  { name: "阿富汗", flag: "🇦🇫" },
  // Other
  { name: "以色列", flag: "🇮🇱" },
  { name: "巴勒斯坦", flag: "🇵🇸" },
  { name: "格鲁吉亚", flag: "🇬🇪" },
  { name: "亚美尼亚", flag: "🇦🇲" },
  { name: "阿塞拜疆", flag: "🇦🇿" },
  { name: "马尔代夫", flag: "🇲🇻" },
  { name: "文莱", flag: "🇧🇳" },
  { name: "老挝", flag: "🇱🇦" },
  { name: "蒙古", flag: "🇲🇳" },
];

// Build a lookup map for quick flag retrieval
const FLAG_MAP = new Map(COUNTRY_DATA.map((c) => [c.name, c.flag]));

/** Get flag emoji for a country name. Returns empty string if not found. */
export function getCountryFlag(name: string): string {
  return FLAG_MAP.get(name) || "";
}

/** Export country names list for external use */
export const COUNTRY_NAMES = COUNTRY_DATA.map((c) => c.name);

interface CountrySelectProps {
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

export default function CountrySelect({
  value,
  onValueChange,
  placeholder = "选择国家",
  disabled = false,
  compact = false,
  showAll = false,
  allLabel = "全部国家",
  className = "",
}: CountrySelectProps) {
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
    if (!search.trim()) return COUNTRY_DATA;
    const q = search.toLowerCase();
    return COUNTRY_DATA.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const selectedFlag = value ? getCountryFlag(value) : "";
  const displayText = value || (showAll ? allLabel : placeholder);

  if (disabled) {
    return (
      <div className={`flex items-center gap-1 ${compact ? "text-[11px] min-h-[24px] px-1" : "text-sm px-2 py-1"} ${className}`}>
        {selectedFlag && <span className="shrink-0">{selectedFlag}</span>}
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
        {selectedFlag && <span className="shrink-0">{selectedFlag}</span>}
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
              placeholder="搜索国家..."
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
                <span className="shrink-0">🌍</span>
                <span>{allLabel}</span>
              </button>
            )}

            {/* Empty / clear option */}
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
                <span className="shrink-0">🏳️</span>
                <span>{placeholder}</span>
              </button>
            )}

            {/* Country options */}
            {filtered.map((country) => (
              <button
                key={country.name}
                type="button"
                onClick={() => {
                  onValueChange(country.name);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 transition-colors text-left ${
                  value === country.name ? "bg-accent text-accent-foreground font-medium" : ""
                }`}
              >
                <span className="shrink-0">{country.flag}</span>
                <span className="truncate">{country.name}</span>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-muted-foreground">
                未找到匹配的国家
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

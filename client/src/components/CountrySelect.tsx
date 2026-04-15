import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, X } from "lucide-react";

// Common countries list - prioritize frequently used countries for this business
const COUNTRIES = [
  // Top frequently used (Middle East, South Asia, Southeast Asia)
  "巴基斯坦", "沙特阿拉伯", "阿联酋", "科威特", "卡塔尔", "巴林", "阿曼",
  "伊拉克", "约旦", "黎巴嫩", "叙利亚", "也门", "伊朗",
  "印度", "孟加拉国", "斯里兰卡", "尼泊尔",
  "马来西亚", "印度尼西亚", "泰国", "越南", "菲律宾", "新加坡", "缅甸", "柬埔寨",
  // Africa
  "埃及", "摩洛哥", "突尼斯", "阿尔及利亚", "利比亚", "苏丹",
  "尼日利亚", "南非", "肯尼亚", "加纳", "坦桑尼亚", "埃塞俄比亚", "乌干达",
  // Europe
  "英国", "法国", "德国", "意大利", "西班牙", "葡萄牙", "荷兰", "比利时",
  "瑞士", "奥地利", "瑞典", "挪威", "丹麦", "芬兰", "波兰", "捷克",
  "希腊", "土耳其", "俄罗斯", "乌克兰", "罗马尼亚", "匈牙利",
  // Americas
  "美国", "加拿大", "墨西哥", "巴西", "阿根廷", "智利", "哥伦比亚", "秘鲁",
  // East Asia & Oceania
  "中国", "日本", "韩国", "中国台湾", "中国香港", "中国澳门",
  "澳大利亚", "新西兰",
  // Central Asia
  "哈萨克斯坦", "乌兹别克斯坦", "土库曼斯坦", "吉尔吉斯斯坦", "塔吉克斯坦", "阿富汗",
  // Other
  "以色列", "巴勒斯坦", "格鲁吉亚", "亚美尼亚", "阿塞拜疆",
  "马尔代夫", "文莱", "老挝", "蒙古",
];

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
    if (!search.trim()) return COUNTRIES;
    const q = search.toLowerCase();
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [search]);

  const displayText = value || (showAll ? allLabel : placeholder);

  if (disabled) {
    return (
      <div className={`flex items-center gap-1 ${compact ? "text-[11px] min-h-[24px] px-1" : "text-sm px-2 py-1"} ${className}`}>
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
        <span className="truncate flex-1 text-left">{displayText}</span>
        <ChevronDown className={`shrink-0 text-muted-foreground transition-transform ${compact ? "w-3 h-3" : "w-3.5 h-3.5"} ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className={`absolute z-50 mt-1 w-full min-w-[160px] bg-popover border border-border rounded-md shadow-lg ${compact ? "text-[11px]" : "text-xs"}`}>
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
                <span>{placeholder}</span>
              </button>
            )}

            {/* Country options */}
            {filtered.map((country) => (
              <button
                key={country}
                type="button"
                onClick={() => {
                  onValueChange(country);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 transition-colors text-left ${
                  value === country ? "bg-accent text-accent-foreground font-medium" : ""
                }`}
              >
                <span className="truncate">{country}</span>
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

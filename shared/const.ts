export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// 固定账号列表（用于订单表"账号"和每日数据表"whats账号"下拉选择）
export const ACCOUNT_OPTIONS = [
  "M1 BUY-4254",
  "K-ONE-1718",
  "UMI BUY-3264",
  "BEST-BUY-1152",
  "First Supplier",
  "Best one-5832",
  "Rich-4192",
  "OKR",
  "topone",
  "fashion",
  "Sneak Depot",
  "rich",
  "Jack",
  "Everybuy",
  "k-club",
  "Trend Union",
  "Factory Drip",
  "Visionmart",
  "prosperity hub",
  "电报娜",
  "best",
  "Dark-pop",
  "See.U",
  "A1 BUY",
  "ONE BUY",
  "Lucky Buy",
  "coco",
  "Hyped Code",
  "Keep Real",
  "POP",
] as const;

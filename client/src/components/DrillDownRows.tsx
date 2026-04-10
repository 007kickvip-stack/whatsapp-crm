import { trpc } from "@/lib/trpc";

function formatMoney(v: any): string {
  const n = parseFloat(v) || 0;
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(v: any): string {
  const n = parseFloat(v) || 0;
  return (n * 100).toFixed(1) + "%";
}

const tdClass = "py-1 px-1 text-center border-r border-gray-100 whitespace-nowrap text-[11px]";

export default function DrillDownRows({ reportDate, staffName }: { reportDate: string; staffName: string }) {
  const { data: rows = [], isLoading } = trpc.dailyData.drillDown.useQuery(
    { reportDate, staffName },
    { enabled: !!staffName }
  );

  if (isLoading) {
    return (
      <tr className="bg-blue-50/30">
        <td colSpan={13} className="py-2 text-center text-xs text-muted-foreground">
          加载账号明细...
        </td>
      </tr>
    );
  }

  if (rows.length === 0) {
    return (
      <tr className="bg-blue-50/30">
        <td colSpan={13} className="py-2 text-center text-xs text-muted-foreground">
          暂无账号明细数据
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((row: any, idx: number) => (
        <tr key={row.id || idx} className="bg-blue-50/30 border-b border-blue-100/50">
          <td className={`${tdClass} pl-6 text-left`}>
            <span className="text-blue-500 mr-1">└</span>
            <span className="text-[10px] text-muted-foreground">{row.whatsAccount || "未指定账号"}</span>
          </td>
          <td className={tdClass}>{row.messageCount || 0}</td>
          <td className={tdClass}>{row.newCustomerCount || 0}</td>
          <td className={tdClass}>{row.newIntentCount || 0}</td>
          <td className={tdClass}>{row.returnVisitCount || 0}</td>
          <td className={tdClass}>{row.newOrderCount || 0}</td>
          <td className={tdClass}>{row.oldOrderCount || 0}</td>
          <td className={tdClass}>{row.itemCount || 0}</td>
          <td className={`${tdClass} text-emerald-600`}>¥{formatMoney(row.totalRevenue)}</td>
          <td className={tdClass}>¥{formatMoney(row.productSellingPrice)}</td>
          <td className={tdClass}>¥{formatMoney(row.shippingCharged)}</td>
          <td className={`${tdClass} text-blue-600`}>¥{formatMoney(row.estimatedProfit)}</td>
          <td className="py-1 px-1 text-center whitespace-nowrap text-[11px]">{formatPercent(row.estimatedProfitRate)}</td>
        </tr>
      ))}
    </>
  );
}

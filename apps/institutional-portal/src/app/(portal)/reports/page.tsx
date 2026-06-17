"use client";

import { useQuery } from "@tanstack/react-query";
import { orders as ordersApi } from "@/lib/api";
import { formatUsd, formatDate } from "@/lib/utils";
import { Download } from "lucide-react";

export default function ReportsPage() {
  const { data: orderList, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.list,
  });

  const completedOrders =
    orderList?.filter((o) => o.status === "COMPLETED") ?? [];
  const totalBuyVolume = completedOrders
    .filter((o) => o.type === "BUY")
    .reduce((s, o) => s + parseFloat(o.amountUsd), 0);
  const totalSellVolume = completedOrders
    .filter((o) => o.type === "SELL")
    .reduce((s, o) => s + parseFloat(o.amountUsd), 0);
  const totalTokensBought = completedOrders
    .filter((o) => o.type === "BUY")
    .reduce((s, o) => s + parseFloat(o.tokenAmount), 0);

  const exportCsv = () => {
    if (!orderList?.length) return;
    const headers = [
      "Order ID",
      "Type",
      "Amount USD",
      "Gold Ounces",
      "Tokens",
      "Gold Price",
      "Wallet",
      "Status",
      "Date",
    ];
    const rows = orderList.map((o) => [
      o.id,
      o.type,
      o.amountUsd,
      o.goldOunces,
      o.tokenAmount,
      o.goldPriceUsd,
      o.walletAddress,
      o.status,
      o.createdAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aurum-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Reports & Export</h1>
        <button
          onClick={exportCsv}
          disabled={!orderList?.length}
          className="flex items-center gap-2 rounded-lg bg-gold-500 hover:bg-gold-600 text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Total Buy Volume", value: formatUsd(totalBuyVolume) },
          { label: "Total Sell Volume", value: formatUsd(totalSellVolume) },
          {
            label: "Total Tokens Bought",
            value: `${totalTokensBought.toFixed(4)} AUR`,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
          >
            <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* All orders for reporting */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            Transaction History (all orders)
          </h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
          </div>
        ) : !orderList?.length ? (
          <p className="py-8 text-center text-sm text-gray-400">No orders</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="px-6 py-3 text-left font-medium">Date</th>
                  <th className="px-6 py-3 text-left font-medium">Type</th>
                  <th className="px-6 py-3 text-left font-medium">
                    Amount (USD)
                  </th>
                  <th className="px-6 py-3 text-left font-medium">Gold oz</th>
                  <th className="px-6 py-3 text-left font-medium">Tokens</th>
                  <th className="px-6 py-3 text-left font-medium">
                    Gold Price
                  </th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orderList.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="px-6 py-3 text-xs text-gray-400">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`font-semibold ${order.type === "BUY" ? "text-green-600" : "text-red-600"}`}
                      >
                        {order.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-medium">
                      {formatUsd(order.amountUsd)}
                    </td>
                    <td className="px-6 py-3">
                      {parseFloat(order.goldOunces).toFixed(6)}
                    </td>
                    <td className="px-6 py-3">
                      {parseFloat(order.tokenAmount).toFixed(4)} AUR
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {formatUsd(order.goldPriceUsd)}/oz
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          order.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : order.status === "FAILED"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

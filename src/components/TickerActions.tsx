"use client";

import { useState } from "react";

import QuickAlertButton from "@/components/QuickAlertButton";
import TradeModal from "@/components/TradeModal";

export default function TickerActions({
  ticker,
  currentPrice,
}: {
  ticker: string;
  currentPrice: number | null;
}) {
  const [tradeOpen, setTradeOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTradeOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <span aria-hidden>📈</span>
          <span>Paper Trade</span>
        </button>
        <QuickAlertButton
          ticker={ticker}
          currentPrice={currentPrice}
          label="Set Alert"
          tone="amber"
        />
      </div>

      {tradeOpen && (
        <TradeModal
          ticker={ticker}
          direction="buy"
          source="manual"
          onClose={() => setTradeOpen(false)}
        />
      )}
    </>
  );
}

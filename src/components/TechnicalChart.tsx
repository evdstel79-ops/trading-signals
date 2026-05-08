"use client";

import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

import type { ChartBar } from "@/app/api/chart-data/[symbol]/route";

type ChartDataResponse = { bars: ChartBar[] } | { error: string };

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

// Wilder's smoothed RSI.
function rsi(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] =
    avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function detectDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

type Theme = {
  background: string;
  text: string;
  grid: string;
  border: string;
  upColor: string;
  downColor: string;
  sma20: string;
  sma50: string;
  rsi: string;
  rsi70: string;
  rsi30: string;
  volumeUp: string;
  volumeDown: string;
};

function chartTheme(dark: boolean): Theme {
  return {
    background: dark ? "#0a0a0a" : "#ffffff",
    text: dark ? "#a3a3a3" : "#525252",
    grid: dark ? "#262626" : "#e5e5e5",
    border: dark ? "#404040" : "#d4d4d4",
    upColor: "#10b981",
    downColor: "#ef4444",
    sma20: "#3b82f6",
    sma50: "#f97316",
    rsi: "#a855f7",
    rsi70: "#ef4444",
    rsi30: "#10b981",
    volumeUp: dark ? "rgba(16, 185, 129, 0.45)" : "rgba(16, 185, 129, 0.55)",
    volumeDown: dark ? "rgba(239, 68, 68, 0.45)" : "rgba(239, 68, 68, 0.55)",
  };
}

export default function TechnicalChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [bars, setBars] = useState<ChartBar[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState<boolean>(() => detectDark());

  useEffect(() => {
    const obs = new MutationObserver(() => setDark(detectDark()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chart-data/${encodeURIComponent(symbol)}`)
      .then(async (r) => {
        const data = (await r.json()) as ChartDataResponse;
        if (cancelled) return;
        if (!r.ok || "error" in data) {
          setError(
            "error" in data ? data.error : `Request failed: ${r.status}`,
          );
          return;
        }
        setBars(data.bars);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "Failed to load chart data",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !bars || bars.length === 0) return;

    const t = chartTheme(dark);

    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: t.background },
        textColor: t.text,
      },
      grid: {
        vertLines: { color: t.grid },
        horzLines: { color: t.grid },
      },
      timeScale: {
        borderColor: t.border,
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: t.border,
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
    });

    const candleSeries = chart.addSeries(
      CandlestickSeries,
      {
        upColor: t.upColor,
        downColor: t.downColor,
        borderUpColor: t.upColor,
        borderDownColor: t.downColor,
        wickUpColor: t.upColor,
        wickDownColor: t.downColor,
      },
      0,
    );
    candleSeries.setData(
      bars.map(
        (b): CandlestickData<Time> => ({
          time: b.time as Time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        }),
      ),
    );

    const closes = bars.map((b) => b.close);
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);

    const sma20Series = chart.addSeries(
      LineSeries,
      {
        color: t.sma20,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      0,
    );
    sma20Series.setData(toLineData(bars, sma20));

    const sma50Series = chart.addSeries(
      LineSeries,
      {
        color: t.sma50,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      0,
    );
    sma50Series.setData(toLineData(bars, sma50));

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceScaleId: "volume",
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      0,
    );
    chart.priceScale("volume", 0).applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeries.setData(
      bars.map(
        (b): HistogramData<Time> => ({
          time: b.time as Time,
          value: b.volume,
          color: b.close >= b.open ? t.volumeUp : t.volumeDown,
        }),
      ),
    );

    const rsiValues = rsi(closes, 14);
    const rsiSeries = chart.addSeries(
      LineSeries,
      {
        color: t.rsi,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      },
      1,
    );
    rsiSeries.setData(toLineData(bars, rsiValues));
    rsiSeries.createPriceLine({
      price: 70,
      color: t.rsi70,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "70",
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: t.rsi30,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "30",
    });

    const panes = chart.panes();
    if (panes.length > 1) {
      panes[1].setHeight(120);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [bars, dark]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{symbol} · 3M technicals</h3>
        <Legend dark={dark} />
      </div>
      <div className="relative h-[460px] w-full">
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-neutral-50 text-sm text-red-600 dark:bg-neutral-950/40 dark:text-red-400">
            Failed to load chart: {error}
          </div>
        )}
        {!error && bars === null && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-neutral-50 text-sm text-neutral-500 dark:bg-neutral-950/40 dark:text-neutral-400">
            Loading chart…
          </div>
        )}
        {!error && bars !== null && bars.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-neutral-50 text-sm text-neutral-500 dark:bg-neutral-950/40 dark:text-neutral-400">
            No chart data available.
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}

function toLineData(
  bars: ChartBar[],
  values: (number | null)[],
): LineData<Time>[] {
  const out: LineData<Time>[] = [];
  for (let i = 0; i < bars.length; i++) {
    const v = values[i];
    if (v === null || !Number.isFinite(v)) continue;
    out.push({ time: bars[i].time as Time, value: v });
  }
  return out;
}

function Legend({ dark }: { dark: boolean }) {
  const t = chartTheme(dark);
  const items: { color: string; label: string }[] = [
    { color: t.sma20, label: "SMA 20" },
    { color: t.sma50, label: "SMA 50" },
    { color: t.rsi, label: "RSI 14" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0.5 w-4"
            style={{ backgroundColor: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

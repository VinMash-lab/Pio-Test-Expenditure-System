import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Budget,
  DrillDownTarget,
  Expenditure,
  LPORecord,
  LegalEntityFilter,
  QuarterType,
} from '../types';

interface BudgetTimelineProps {
  budgets: Budget[];
  expenditures: Expenditure[];
  lpos: LPORecord[];
  financialYear: string;
  legalEntity: LegalEntityFilter;
  currencySymbol: string;
  onNavigate?: (tab: string) => void;
  onDrillDown?: (target: DrillDownTarget) => void;
}

type CalendarMode = 'fiscal' | 'calendar';
type TimelineViewMode = 'cumulative' | 'monthly';

interface MonthBucket {
  index: number;
  key: string;
  monthStart: Date;
  monthEnd: Date;
  midpoint: Date;
  shortLabel: string;
  fullLabel: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  monthlySpend: number;
  monthlyCommitted: number;
  releasedInMonth: number;
  cumulativeSpend: number;
  cumulativeCommitted: number;
  cumulativeReleased: number;
  transactions: Expenditure[];
  releaseBudgets: Budget[];
}

interface ReleaseMilestone {
  id: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  title: string;
  releaseDate: Date;
  dateLabel: string;
  releasedAmount: number;
  cumulativeAmount: number;
  budgets: Budget[];
  status: 'Released' | 'Scheduled' | 'No Allocation';
}

interface HoverInspectState {
  x: number;
  y: number;
  bucket: MonthBucket;
  milestone?: ReleaseMilestone;
}

function parseEndYear(financialYear: string): number {
  const matches = (financialYear || '2026').match(/\d{4}/g);
  if (!matches || matches.length === 0) return 2026;
  return parseInt(matches[matches.length - 1], 10);
}

function parseSafeDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const normalized = dateStr.trim();
  const parsed = new Date(normalized.length === 10 ? `${normalized}T00:00:00` : normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatCompactCurrency(value: number, symbol: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}${symbol} ${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol} ${(abs / 1_000).toFixed(0)}K`;
  }
  return `${sign}${symbol} ${abs.toLocaleString()}`;
}

export const BudgetTimeline: React.FC<BudgetTimelineProps> = ({
  budgets,
  expenditures,
  lpos,
  financialYear,
  legalEntity,
  currencySymbol = 'KES',
  onNavigate,
  onDrillDown,
}) => {
  const endYear = useMemo(() => parseEndYear(financialYear), [financialYear]);

  // Auto-detect whether Jul–Jun Fiscal Year or Jan–Dec Calendar Year matches the records best
  const defaultCalendarMode: CalendarMode = useMemo(() => {
    if (financialYear.includes('/')) return 'fiscal';
    const hasPriorYearH2 = [...budgets, ...expenditures].some((item) => {
      const d = parseSafeDate(
        'createdDate' in item ? item.createdDate : item.date || item.expenseDate || item.createdAt
      );
      if (!d) return false;
      return d.getFullYear() === endYear - 1 && d.getMonth() >= 6;
    });
    if (hasPriorYearH2) return 'fiscal';
    const hasEndYearH2 = expenditures.some((e) => {
      const d = parseSafeDate(e.date || e.expenseDate || e.createdAt);
      return d ? d.getFullYear() === endYear && d.getMonth() >= 6 : false;
    });
    if (hasEndYearH2) return 'calendar';
    return 'fiscal';
  }, [financialYear, budgets, expenditures, endYear]);

  const [calendarMode, setCalendarMode] = useState<CalendarMode>(defaultCalendarMode);
  const [viewMode, setViewMode] = useState<TimelineViewMode>('cumulative');
  const [showCommitments, setShowCommitments] = useState<boolean>(true);
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4' | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInspectState | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(880);

  useEffect(() => {
    setCalendarMode(defaultCalendarMode);
  }, [defaultCalendarMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setChartWidth(w);
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            setChartWidth(entry.contentRect.width);
          }
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
    return undefined;
  }, []);

  // Build 12-month timeline model + planned budget release milestones
  const timelineModel = useMemo(() => {
    const startMonthIdx = calendarMode === 'fiscal' ? 6 : 0; // July vs January
    const startYear = calendarMode === 'fiscal' ? endYear - 1 : endYear;

    const buckets: MonthBucket[] = Array.from({ length: 12 }, (_, idx) => {
      const monthDate = new Date(startYear, startMonthIdx + idx, 1);
      const monthEnd = new Date(startYear, startMonthIdx + idx + 1, 0, 23, 59, 59);
      const midpoint = new Date(startYear, startMonthIdx + idx, 15);
      const quarterIndex = Math.floor(idx / 3);
      const quarter = (['Q1', 'Q2', 'Q3', 'Q4'] as const)[quarterIndex];
      const monthName = monthDate.toLocaleString('en-US', { month: 'short' });
      const yearShort = String(monthDate.getFullYear()).slice(-2);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

      return {
        index: idx,
        key,
        monthStart: monthDate,
        monthEnd,
        midpoint,
        shortLabel: monthName,
        fullLabel: `${monthName} ${monthDate.getFullYear()}`,
        quarter,
        monthlySpend: 0,
        monthlyCommitted: 0,
        releasedInMonth: 0,
        cumulativeSpend: 0,
        cumulativeCommitted: 0,
        cumulativeReleased: 0,
        transactions: [],
        releaseBudgets: [],
      };
    });

    const fyStart = buckets[0].monthStart;
    const fyEnd = buckets[11].monthEnd;

    const bucketByKey = new Map<string, MonthBucket>();
    buckets.forEach((b) => bucketByKey.set(b.key, b));

    // Map Planned Budget Release Dates to Q1-Q4 tranches
    const quarterStartIndex: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', number> = {
      Q1: 0,
      Q2: 3,
      Q3: 6,
      Q4: 9,
    };

    const resolveBudgetQuarter = (b: Budget): 'Q1' | 'Q2' | 'Q3' | 'Q4' => {
      if (b.quarter === 'Q1' || b.quarter === 'Q2' || b.quarter === 'Q3' || b.quarter === 'Q4') {
        return b.quarter;
      }
      const created = parseSafeDate(b.createdDate);
      if (created && created >= fyStart && created <= fyEnd) {
        const diffMonths =
          (created.getFullYear() - fyStart.getFullYear()) * 12 +
          (created.getMonth() - fyStart.getMonth());
        const qIdx = Math.min(3, Math.max(0, Math.floor(diffMonths / 3)));
        return (['Q1', 'Q2', 'Q3', 'Q4'] as const)[qIdx];
      }
      return 'Q1';
    };

    const trancheBudgets: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', Budget[]> = {
      Q1: [],
      Q2: [],
      Q3: [],
      Q4: [],
    };

    budgets.forEach((b) => {
      const amount = Number(b.revisedBudget ?? b.allocatedAmount ?? 0);
      const q = resolveBudgetQuarter(b);
      trancheBudgets[q].push(b);
      const targetBucket = buckets[quarterStartIndex[q]];
      targetBucket.releasedInMonth += amount;
      targetBucket.releaseBudgets.push(b);
    });

    // Map Expenditures into their respective month buckets
    const inWindowExpenses: { date: Date; exp: Expenditure }[] = [];
    let outOfWindowSpend = 0;

    expenditures.forEach((exp) => {
      const d = parseSafeDate(exp.date || exp.expenseDate || exp.createdAt);
      const amount = Number(exp.totalAmount || 0);
      if (d && d >= fyStart && d <= fyEnd) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bucket = bucketByKey.get(key);
        if (bucket) {
          bucket.monthlySpend += amount;
          bucket.transactions.push(exp);
          inWindowExpenses.push({ date: d, exp });
          return;
        }
      }
      // Fallback: if expenditure quarter matches but date sits slightly outside window, track separately
      if (exp.quarter && (exp.quarter === 'Q1' || exp.quarter === 'Q2' || exp.quarter === 'Q3' || exp.quarter === 'Q4')) {
        outOfWindowSpend += amount;
      } else {
        outOfWindowSpend += amount;
      }
    });

    // Map Open LPO Commitments into their month buckets
    lpos.forEach((lpo) => {
      const lpoStatus = lpo.lpoStatus || lpo.status;
      if (lpo.paymentStatus === 'Fully Paid' || lpo.paymentStatus === 'Paid' || lpoStatus === 'Cancelled') return;
      const d = parseSafeDate(lpo.lpoDate || lpo.createdAt);
      if (d && d >= fyStart && d <= fyEnd) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bucket = bucketByKey.get(key);
        if (bucket) {
          bucket.monthlyCommitted += Number(lpo.totalLpoValue ?? lpo.totalLpoAmount ?? 0);
        }
      }
    });

    // Calculate cumulative series
    let runningSpend = 0;
    let runningCommitted = 0;
    let runningReleased = 0;

    buckets.forEach((b) => {
      runningSpend += b.monthlySpend;
      runningCommitted += b.monthlyCommitted;
      runningReleased += b.releasedInMonth;
      b.cumulativeSpend = runningSpend;
      b.cumulativeCommitted = runningCommitted;
      b.cumulativeReleased = runningReleased;
    });

    // Build chronological expenditure flow points for crisp continuous D3 curve
    inWindowExpenses.sort((a, b) => a.date.getTime() - b.date.getTime());

    const now = new Date();
    const milestones: ReleaseMilestone[] = (['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => {
      const bucket = buckets[quarterStartIndex[q]];
      const releasedAmount = bucket.releasedInMonth;
      const status: ReleaseMilestone['status'] =
        releasedAmount <= 0
          ? 'No Allocation'
          : bucket.monthStart <= now
          ? 'Released'
          : 'Scheduled';

      return {
        id: q,
        quarter: q,
        title: `${q} Planned Release`,
        releaseDate: bucket.monthStart,
        dateLabel: bucket.monthStart.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        releasedAmount,
        cumulativeAmount: bucket.cumulativeReleased,
        budgets: trancheBudgets[q],
        status,
      };
    });

    // Build stepped budget release path points across [fyStart, fyEnd]
    const releaseStepPoints: { date: Date; value: number; quarter?: QuarterType }[] = [];
    milestones.forEach((m, idx) => {
      if (idx === 0) {
        releaseStepPoints.push({ date: fyStart, value: m.cumulativeAmount, quarter: m.quarter });
      } else {
        releaseStepPoints.push({ date: m.releaseDate, value: m.cumulativeAmount, quarter: m.quarter });
      }
    });
    releaseStepPoints.push({
      date: fyEnd,
      value: runningReleased,
    });

    const totalBudgetReleased = runningReleased;
    const totalFlowSpend = runningSpend;
    const totalCommitted = runningCommitted;
    const nextUpcomingRelease = milestones.find((m) => m.releaseDate > now && m.releasedAmount > 0) || null;
    const peakSpendMonth = buckets.reduce<MonthBucket | null>(
      (best, cur) => (cur.monthlySpend > (best?.monthlySpend ?? 0) ? cur : best),
      null
    );

    return {
      fyStart,
      fyEnd,
      buckets,
      milestones,
      releaseStepPoints,
      inWindowExpenses,
      totalBudgetReleased,
      totalFlowSpend,
      totalCommitted,
      outOfWindowSpend,
      nextUpcomingRelease,
      peakSpendMonth,
      isTodayInWindow: now >= fyStart && now <= fyEnd,
      today: now,
    };
  }, [budgets, expenditures, lpos, calendarMode, endYear]);

  // Render D3 SVG visualization
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const height = 310;
    const margin = { top: 36, right: 24, bottom: 38, left: 64 };
    const width = Math.max(420, chartWidth);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', height);

    const defs = svg.append('defs');

    // Gradient for cumulative expenditure flow area
    const spendGrad = defs
      .append('linearGradient')
      .attr('id', 'budgetTimelineSpendGrad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    spendGrad.append('stop').attr('offset', '0%').attr('stop-color', '#DC2626').attr('stop-opacity', 0.24);
    spendGrad.append('stop').attr('offset', '100%').attr('stop-color', '#DC2626').attr('stop-opacity', 0.02);

    // Gradient for planned budget envelope
    const budgetGrad = defs
      .append('linearGradient')
      .attr('id', 'budgetTimelinePlanGrad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    budgetGrad.append('stop').attr('offset', '0%').attr('stop-color', '#2563EB').attr('stop-opacity', 0.11);
    budgetGrad.append('stop').attr('offset', '100%').attr('stop-color', '#2563EB').attr('stop-opacity', 0.01);

    const root = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const { buckets, milestones, releaseStepPoints, fyStart, fyEnd, isTodayInWindow, today } =
      timelineModel;

    // Scales
    const xScale = d3.scaleTime().domain([fyStart, fyEnd]).range([0, innerWidth]);

    const maxYCumulative = buckets.reduce(
      (max, b) =>
        Math.max(
          max,
          b.cumulativeReleased,
          b.cumulativeSpend + (showCommitments ? b.cumulativeCommitted : 0)
        ),
      100_000
    );

    const maxYMonthly = buckets.reduce(
      (max, b) =>
        Math.max(
          max,
          b.releasedInMonth,
          b.monthlySpend + (showCommitments ? b.monthlyCommitted : 0)
        ),
      50_000
    );

    const yMax = (viewMode === 'cumulative' ? maxYCumulative : maxYMonthly) * 1.16;
    const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

    // Horizontal Gridlines
    const yTicks = yScale.ticks(5);
    root
      .append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#E2E8F0')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-width', 1);

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickSize(0)
      .tickPadding(10)
      .tickFormat((d) => {
        const val = Number(d);
        if (val === 0) return '0';
        if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
        if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
        return String(val);
      });

    const yAxisG = root.append('g').call(yAxis);
    yAxisG.select('.domain').remove();
    yAxisG
      .selectAll('text')
      .attr('fill', '#64748B')
      .style('font-size', '11px')
      .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace');

    // X Axis (Monthly ticks)
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(d3.timeMonth.every(1))
      .tickSize(4)
      .tickPadding(8)
      .tickFormat((d) => d3.timeFormat('%b')(d as Date));

    const xAxisG = root
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);
    xAxisG.select('.domain').attr('stroke', '#CBD5E1');
    xAxisG.selectAll('.tick line').attr('stroke', '#CBD5E1');
    xAxisG
      .selectAll('text')
      .attr('fill', '#475569')
      .style('font-size', '11px')
      .style('font-weight', '600');

    // Planned Budget Release Vertical Guide Lines & Top Milestone Markers
    const milestoneG = root.append('g').attr('class', 'release-milestones');

    milestones.forEach((m) => {
      const mx = xScale(m.releaseDate);
      const isSelected = selectedQuarter === m.quarter;
      const hasBudget = m.releasedAmount > 0;

      // Vertical release date rule
      milestoneG
        .append('line')
        .attr('x1', mx)
        .attr('x2', mx)
        .attr('y1', -8)
        .attr('y2', innerHeight)
        .attr('stroke', isSelected ? '#1D4ED8' : hasBudget ? '#93C5FD' : '#E2E8F0')
        .attr('stroke-width', isSelected ? 2 : 1.25)
        .attr('stroke-dasharray', isSelected ? 'none' : '4,4');

      // Diamond release marker at top track
      const markerGroup = milestoneG
        .append('g')
        .attr('transform', `translate(${mx}, -14)`)
        .style('cursor', 'pointer')
        .on('click', () => {
          setSelectedQuarter((prev) => (prev === m.quarter ? null : m.quarter));
          setSelectedMonthKey(null);
        });

      markerGroup
        .append('path')
        .attr('d', d3.symbol().type(d3.symbolDiamond).size(isSelected ? 130 : hasBudget ? 85 : 50)())
        .attr('fill', isSelected ? '#1E40AF' : hasBudget ? '#2563EB' : '#CBD5E1')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 1.5);

      // Quarter label above diamond
      markerGroup
        .append('text')
        .attr('x', m.quarter === 'Q1' ? 10 : 0)
        .attr('y', -11)
        .attr('text-anchor', m.quarter === 'Q1' ? 'start' : 'middle')
        .attr('fill', isSelected ? '#1E40AF' : hasBudget ? '#1E293B' : '#94A3B8')
        .style('font-size', '10.5px')
        .style('font-weight', '700')
        .text(
          hasBudget
            ? `${m.quarter} Release · ${formatCompactCurrency(m.releasedAmount, currencySymbol)}`
            : `${m.quarter} Release`
        );
    });

    // Today Marker if within fiscal window
    if (isTodayInWindow) {
      const tx = xScale(today);
      const todayG = root.append('g').attr('class', 'today-marker');
      todayG
        .append('line')
        .attr('x1', tx)
        .attr('x2', tx)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#0F172A')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '2,3');

      todayG
        .append('text')
        .attr('x', Math.min(innerWidth - 36, Math.max(4, tx + 4)))
        .attr('y', 12)
        .attr('fill', '#0F172A')
        .style('font-size', '10px')
        .style('font-weight', '700')
        .text('Today');
    }

    if (viewMode === 'cumulative') {
      // 1. Stepped Planned Budget Release Envelope
      const planAreaGen = d3
        .area<{ date: Date; value: number }>()
        .x((d) => xScale(d.date))
        .y0(innerHeight)
        .y1((d) => yScale(d.value))
        .curve(d3.curveStepAfter);

      const planLineGen = d3
        .line<{ date: Date; value: number }>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.value))
        .curve(d3.curveStepAfter);

      root
        .append('path')
        .datum(releaseStepPoints)
        .attr('fill', 'url(#budgetTimelinePlanGrad)')
        .attr('d', planAreaGen);

      root
        .append('path')
        .datum(releaseStepPoints)
        .attr('fill', 'none')
        .attr('stroke', '#2563EB')
        .attr('stroke-width', 2.25)
        .attr('d', planLineGen);

      // 2. Subtle Monthly Spend Activity Bars along baseline
      const barWidth = Math.max(10, Math.min(26, innerWidth / 20));
      root
        .append('g')
        .selectAll<SVGRectElement, MonthBucket>('rect.monthly-pulse-bar')
        .data<MonthBucket>(buckets)
        .join('rect')
        .attr('class', 'monthly-pulse-bar')
        .attr('x', (b: MonthBucket) => xScale(b.midpoint) - barWidth / 2)
        .attr('y', (b: MonthBucket) => yScale(b.monthlySpend))
        .attr('width', barWidth)
        .attr('height', (b: MonthBucket) => Math.max(0, innerHeight - yScale(b.monthlySpend)))
        .attr('rx', 2)
        .attr('fill', (b: MonthBucket) =>
          b.key === selectedMonthKey ? 'rgba(220, 38, 38, 0.35)' : 'rgba(220, 38, 38, 0.14)'
        );

      // 3. Cumulative Committed + Spend Dashed Amber Line (optional)
      if (showCommitments && timelineModel.totalCommitted > 0) {
        const commPoints = [
          { date: fyStart, value: 0 },
          ...buckets.map((b) => ({
            date: b.monthEnd > fyEnd ? fyEnd : b.monthEnd,
            value: b.cumulativeSpend + b.cumulativeCommitted,
          })),
        ];

        const commLineGen = d3
          .line<{ date: Date; value: number }>()
          .x((d) => xScale(d.date))
          .y((d) => yScale(d.value))
          .curve(d3.curveMonotoneX);

        root
          .append('path')
          .datum(commPoints)
          .attr('fill', 'none')
          .attr('stroke', '#D97706')
          .attr('stroke-width', 1.75)
          .attr('stroke-dasharray', '5,4')
          .attr('d', commLineGen);
      }

      // 4. Cumulative Actual Expenditure Flow Area & Curve
      const spendCurvePoints: { date: Date; value: number; bucket?: MonthBucket }[] = [
        { date: fyStart, value: 0 },
        ...buckets.map((b) => ({
          date: b.midpoint,
          value: b.cumulativeSpend,
          bucket: b,
        })),
        { date: fyEnd, value: timelineModel.totalFlowSpend },
      ];

      const spendAreaGen = d3
        .area<{ date: Date; value: number }>()
        .x((d) => xScale(d.date))
        .y0(innerHeight)
        .y1((d) => yScale(d.value))
        .curve(d3.curveMonotoneX);

      const spendLineGen = d3
        .line<{ date: Date; value: number }>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.value))
        .curve(d3.curveMonotoneX);

      root
        .append('path')
        .datum(spendCurvePoints)
        .attr('fill', 'url(#budgetTimelineSpendGrad)')
        .attr('d', spendAreaGen);

      root
        .append('path')
        .datum(spendCurvePoints)
        .attr('fill', 'none')
        .attr('stroke', '#DC2626')
        .attr('stroke-width', 2.5)
        .attr('d', spendLineGen);

      // Monthly expenditure nodes along the flow curve
      root
        .append('g')
        .selectAll<SVGCircleElement, MonthBucket>('circle.spend-node')
        .data<MonthBucket>(buckets)
        .join('circle')
        .attr('class', 'spend-node')
        .attr('cx', (b: MonthBucket) => xScale(b.midpoint))
        .attr('cy', (b: MonthBucket) => yScale(b.cumulativeSpend))
        .attr('r', (b: MonthBucket) => (b.key === selectedMonthKey ? 5.5 : b.monthlySpend > 0 ? 4 : 2.5))
        .attr('fill', (b: MonthBucket) => (b.monthlySpend > 0 ? '#DC2626' : '#FFFFFF'))
        .attr('stroke', '#DC2626')
        .attr('stroke-width', 1.75);
    } else {
      // Monthly Flow Mode: Grouped Bars per Month (Planned Release Tranche vs Monthly Spend vs Commitments)
      const slotWidth = innerWidth / 12;
      const barWidth = Math.max(6, Math.min(16, (slotWidth - 10) / (showCommitments ? 3 : 2)));

      const monthGroups = root
        .append('g')
        .selectAll<SVGGElement, MonthBucket>('g.month-bar-group')
        .data<MonthBucket>(buckets)
        .join('g')
        .attr('class', 'month-bar-group')
        .attr('transform', (b: MonthBucket) => `translate(${xScale(b.midpoint)}, 0)`);

      // Planned Budget Release Bar (in release months)
      monthGroups
        .append('rect')
        .attr('x', showCommitments ? -barWidth * 1.5 - 2 : -barWidth - 1)
        .attr('y', (b: MonthBucket) => yScale(b.releasedInMonth))
        .attr('width', barWidth)
        .attr('height', (b: MonthBucket) => Math.max(0, innerHeight - yScale(b.releasedInMonth)))
        .attr('rx', 2)
        .attr('fill', '#2563EB');

      // Monthly Expenditure Flow Bar
      monthGroups
        .append('rect')
        .attr('x', showCommitments ? -barWidth / 2 : 1)
        .attr('y', (b: MonthBucket) => yScale(b.monthlySpend))
        .attr('width', barWidth)
        .attr('height', (b: MonthBucket) => Math.max(0, innerHeight - yScale(b.monthlySpend)))
        .attr('rx', 2)
        .attr('fill', '#DC2626');

      // Monthly LPO Commitment Bar
      if (showCommitments) {
        monthGroups
          .append('rect')
          .attr('x', barWidth / 2 + 2)
          .attr('y', (b: MonthBucket) => yScale(b.monthlyCommitted))
          .attr('width', barWidth)
          .attr('height', (b: MonthBucket) => Math.max(0, innerHeight - yScale(b.monthlyCommitted)))
          .attr('rx', 2)
          .attr('fill', '#D97706');
      }
    }

    // Crosshair & Interactive Hover Overlay
    const crosshairG = root.append('g').style('display', 'none').style('pointer-events', 'none');
    const crosshairLine = crosshairG
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#64748B')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    const hoverSpendDot = crosshairG
      .append('circle')
      .attr('r', 5.5)
      .attr('fill', '#DC2626')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2);

    const hoverBudgetDot = crosshairG
      .append('circle')
      .attr('r', 5)
      .attr('fill', '#2563EB')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2);

    const bisectDate = d3.bisector<MonthBucket, Date>((b) => b.midpoint).center;

    root
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (event) => {
        const [mouseX] = d3.pointer(event);
        const hoveredDate = xScale.invert(mouseX);
        const idx = Math.min(buckets.length - 1, Math.max(0, bisectDate(buckets, hoveredDate)));
        const bucket = buckets[idx];
        if (!bucket) return;

        const bx = xScale(bucket.midpoint);
        const spendY =
          viewMode === 'cumulative' ? yScale(bucket.cumulativeSpend) : yScale(bucket.monthlySpend);
        const budgetY =
          viewMode === 'cumulative' ? yScale(bucket.cumulativeReleased) : yScale(bucket.releasedInMonth);

        crosshairG.style('display', null);
        crosshairLine.attr('x1', bx).attr('x2', bx);
        hoverSpendDot.attr('cx', bx).attr('cy', spendY);
        hoverBudgetDot.attr('cx', bx).attr('cy', budgetY);

        const milestone = milestones.find((m) => m.quarter === bucket.quarter && bucket.index % 3 === 0);

        setHoverInfo({
          x: bx + margin.left,
          y: Math.min(spendY, budgetY) + margin.top,
          bucket,
          milestone,
        });
      })
      .on('mouseleave', () => {
        crosshairG.style('display', 'none');
        setHoverInfo(null);
      })
      .on('click', (event) => {
        const [mouseX] = d3.pointer(event);
        const clickedDate = xScale.invert(mouseX);
        const idx = Math.min(buckets.length - 1, Math.max(0, bisectDate(buckets, clickedDate)));
        const bucket = buckets[idx];
        if (bucket) {
          setSelectedMonthKey((prev) => (prev === bucket.key ? null : bucket.key));
          setSelectedQuarter(null);
        }
      });
  }, [
    timelineModel,
    chartWidth,
    viewMode,
    showCommitments,
    selectedQuarter,
    selectedMonthKey,
    currencySymbol,
  ]);

  const activeSelectedMilestone = useMemo(
    () => timelineModel.milestones.find((m) => m.quarter === selectedQuarter) || null,
    [timelineModel.milestones, selectedQuarter]
  );

  const activeSelectedMonth = useMemo(
    () => timelineModel.buckets.find((b) => b.key === selectedMonthKey) || null,
    [timelineModel.buckets, selectedMonthKey]
  );

  const isEmpty = budgets.length === 0 && expenditures.length === 0;
  const utilizationRatio =
    timelineModel.totalBudgetReleased > 0
      ? (timelineModel.totalFlowSpend / timelineModel.totalBudgetReleased) * 100
      : 0;

  return (
    <div className="card card-erp p-3.5 bg-white">
      {/* Header & Controls */}
      <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3 mb-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h6 className="fw-bold text-dark mb-0 fs-7 text-uppercase">
              <i className="bi bi-calendar2-range me-1.5 text-danger"></i>
              Budget Timeline — Expenditure Flow & Planned Release Dates
            </h6>
          </div>
          <div className="text-muted fs-8 d-flex flex-wrap align-items-center gap-2">
            <span>
              FY {financialYear} ({calendarMode === 'fiscal' ? 'Jul – Jun' : 'Jan – Dec'})
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Scope: {legalEntity === 'All' ? 'Combined (PACL + PGIL)' : legalEntity}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-monospace">
              Released {formatCompactCurrency(timelineModel.totalBudgetReleased, currencySymbol)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-monospace text-danger fw-semibold">
              Flow {formatCompactCurrency(timelineModel.totalFlowSpend, currencySymbol)} ({utilizationRatio.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Interactive Toolbar Controls */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          {/* Cumulative vs Monthly Toggle */}
          <div className="btn-group btn-group-sm" role="group" aria-label="Timeline view mode">
            <button
              type="button"
              className={`btn ${viewMode === 'cumulative' ? 'btn-dark' : 'btn-outline-secondary'} text-nowrap`}
              onClick={() => setViewMode('cumulative')}
            >
              Cumulative Flow
            </button>
            <button
              type="button"
              className={`btn ${viewMode === 'monthly' ? 'btn-dark' : 'btn-outline-secondary'} text-nowrap`}
              onClick={() => setViewMode('monthly')}
            >
              Monthly Bars
            </button>
          </div>

          {/* Fiscal (Jul-Jun) vs Calendar (Jan-Dec) Toggle */}
          <div className="btn-group btn-group-sm" role="group" aria-label="Fiscal calendar cycle">
            <button
              type="button"
              className={`btn ${calendarMode === 'fiscal' ? 'btn-outline-danger active' : 'btn-outline-secondary'} text-nowrap`}
              onClick={() => setCalendarMode('fiscal')}
              title="Kenyan Corporate Fiscal Year (July – June)"
            >
              Jul – Jun (FY)
            </button>
            <button
              type="button"
              className={`btn ${calendarMode === 'calendar' ? 'btn-outline-danger active' : 'btn-outline-secondary'} text-nowrap`}
              onClick={() => setCalendarMode('calendar')}
              title="Calendar Year (January – December)"
            >
              Jan – Dec
            </button>
          </div>

          {/* LPO Commitments Overlay Toggle */}
          <button
            type="button"
            className={`btn btn-sm ${showCommitments ? 'btn-outline-warning active text-dark' : 'btn-outline-secondary'} text-nowrap`}
            onClick={() => setShowCommitments((prev) => !prev)}
            title="Toggle open LPO commitment trajectory"
          >
            <i className="bi bi-layers me-1"></i>
            Commitments
          </button>
        </div>
      </div>

      {/* Legend Strip */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2 fs-8 text-muted">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <span className="d-inline-flex align-items-center gap-1.5">
            <span
              className="d-inline-block"
              style={{ width: '14px', height: '3px', backgroundColor: '#2563EB' }}
            ></span>
            <span>Planned Budget Release Ceiling</span>
          </span>
          <span className="d-inline-flex align-items-center gap-1.5">
            <span
              className="d-inline-block"
              style={{ width: '14px', height: '3px', backgroundColor: '#DC2626' }}
            ></span>
            <span>Actual Expenditure Flow</span>
          </span>
          {showCommitments && (
            <span className="d-inline-flex align-items-center gap-1.5">
              <span
                className="d-inline-block"
                style={{
                  width: '14px',
                  height: '0px',
                  borderTop: '2px dashed #D97706',
                }}
              ></span>
              <span>Spend + Open LPO Commitments</span>
            </span>
          )}
          <span className="d-inline-flex align-items-center gap-1.5">
            <span
              className="d-inline-block"
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#2563EB',
                transform: 'rotate(45deg)',
              }}
            ></span>
            <span>Planned Tranche Release Date</span>
          </span>
        </div>
        <span className="text-muted">Click any diamond marker or month to inspect records</span>
      </div>

      {/* D3 SVG Canvas */}
      <div ref={containerRef} className="position-relative w-100" style={{ minHeight: '310px' }}>
        <svg ref={svgRef} className="d-block w-100 overflow-visible" role="img" aria-label="Fiscal Year Budget Timeline D3 Chart" />

        {/* Empty Data Overlay Prompt (still keeps fiscal release skeleton visible behind) */}
        {isEmpty && (
          <div
            className="position-absolute top-50 start-50 translate-middle text-center bg-white bg-opacity-95 border rounded-3 p-3 shadow-sm"
            style={{ maxWidth: '380px', zIndex: 5 }}
          >
            <div className="fw-bold text-dark fs-7 mb-1">Fiscal Timeline Ready for Allocations & Spend</div>
            <p className="text-muted fs-8 mb-2.5">
              Import Excel sheets or log your first budget tranche and expenditure to plot live release dates and burn curves.
            </p>
            {onNavigate && (
              <div className="d-flex justify-content-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-corporate"
                  onClick={() => onNavigate('budgets')}
                >
                  Add Budget Release
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-dark"
                  onClick={() => onNavigate('excel_wizard')}
                >
                  Import Data
                </button>
              </div>
            )}
          </div>
        )}

        {/* Interactive Floating D3 Tooltip */}
        {hoverInfo && !isEmpty && (
          <div
            className="position-absolute bg-white border rounded-3 shadow p-2.5 pointer-events-none"
            style={{
              left: hoverInfo.x > chartWidth * 0.62 ? Math.max(8, hoverInfo.x - 248) : hoverInfo.x + 14,
              top: Math.max(8, Math.min(185, hoverInfo.y - 24)),
              width: '234px',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            <div className="d-flex align-items-center justify-content-between border-bottom pb-1 mb-1.5">
              <span className="fw-bold text-dark fs-7">{hoverInfo.bucket.fullLabel}</span>
              <span className="text-muted fs-8 fw-semibold">{hoverInfo.bucket.quarter}</span>
            </div>

            <div className="d-flex flex-column gap-1 fs-8">
              <div className="d-flex justify-content-between">
                <span className="text-muted">Cumulative Budget:</span>
                <span className="fw-bold text-primary font-monospace">
                  {currencySymbol} {hoverInfo.bucket.cumulativeReleased.toLocaleString()}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Cumulative Spend:</span>
                <span className="fw-bold text-danger font-monospace">
                  {currencySymbol} {hoverInfo.bucket.cumulativeSpend.toLocaleString()}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Month Spend Flow:</span>
                <span className="fw-semibold text-dark font-monospace">
                  {currencySymbol} {hoverInfo.bucket.monthlySpend.toLocaleString()}
                </span>
              </div>
              {showCommitments && hoverInfo.bucket.cumulativeCommitted > 0 && (
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Open LPOs (Cum.):</span>
                  <span className="fw-semibold text-warning font-monospace">
                    {currencySymbol} {hoverInfo.bucket.cumulativeCommitted.toLocaleString()}
                  </span>
                </div>
              )}
              {hoverInfo.bucket.releasedInMonth > 0 && (
                <div className="d-flex justify-content-between border-top pt-1 mt-0.5 text-primary">
                  <span className="fw-semibold">Planned Release:</span>
                  <span className="fw-bold font-monospace">
                    +{currencySymbol} {hoverInfo.bucket.releasedInMonth.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="text-muted pt-0.5" style={{ fontSize: '0.68rem' }}>
                {hoverInfo.bucket.transactions.length} expense(s) · Click month to inspect
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Planned Budget Release Schedule Strip (Q1 - Q4) */}
      <div className="row g-2 mt-2 pt-2 border-top">
        {timelineModel.milestones.map((m) => {
          const isSelected = selectedQuarter === m.quarter;
          const pctOfTotal =
            timelineModel.totalBudgetReleased > 0
              ? (m.releasedAmount / timelineModel.totalBudgetReleased) * 100
              : 0;
          return (
            <div key={m.id} className="col-6 col-lg-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedQuarter((prev) => (prev === m.quarter ? null : m.quarter));
                  setSelectedMonthKey(null);
                }}
                className={`w-100 text-start p-2.5 rounded border transition-all ${
                  isSelected
                    ? 'bg-primary-subtle border-primary shadow-xs'
                    : 'bg-light border-light-subtle hover-bg-white'
                }`}
              >
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="fw-bold fs-7 text-dark">{m.title}</span>
                  <span
                    className={`fs-8 fw-semibold ${
                      m.status === 'Released'
                        ? 'text-success'
                        : m.status === 'Scheduled'
                        ? 'text-primary'
                        : 'text-muted'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <div className="fw-bold fs-6 text-dark font-monospace">
                  {currencySymbol} {m.releasedAmount.toLocaleString()}
                </div>
                <div className="d-flex align-items-center justify-content-between text-muted fs-8 mt-1">
                  <span>{m.dateLabel}</span>
                  <span>
                    {m.budgets.length} line{m.budgets.length === 1 ? '' : 's'} · {pctOfTotal.toFixed(0)}%
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Interactive Drill-Down Inspector for Selected Release Tranche or Month */}
      {(activeSelectedMilestone || activeSelectedMonth) && (
        <div className="mt-3 pt-3 border-top">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="fw-bold text-dark fs-7">
              {activeSelectedMilestone ? (
                <>
                  <i className="bi bi-calendar-event me-1.5 text-primary"></i>
                  {activeSelectedMilestone.title} ({activeSelectedMilestone.dateLabel}) —{' '}
                  <span className="font-monospace">
                    {currencySymbol} {activeSelectedMilestone.releasedAmount.toLocaleString()}
                  </span>
                </>
              ) : (
                <>
                  <i className="bi bi-receipt me-1.5 text-danger"></i>
                  {activeSelectedMonth?.fullLabel} Expenditure Flow —{' '}
                  <span className="font-monospace">
                    {currencySymbol} {activeSelectedMonth?.monthlySpend.toLocaleString()}
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary py-0 px-2 fs-8"
              onClick={() => {
                setSelectedQuarter(null);
                setSelectedMonthKey(null);
              }}
            >
              Close Details
            </button>
          </div>

          {activeSelectedMilestone && (
            <div className="table-responsive">
              {activeSelectedMilestone.budgets.length === 0 ? (
                <div className="text-muted fs-8 py-2">
                  No budget lines scheduled for {activeSelectedMilestone.quarter}.{' '}
                  {onNavigate && (
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 fs-8 text-danger"
                      onClick={() => onNavigate('budgets')}
                    >
                      Allocate a {activeSelectedMilestone.quarter} budget line
                    </button>
                  )}
                </div>
              ) : (
                <table className="table table-sm table-hover align-middle fs-8 mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Budget Code</th>
                      <th>Entity</th>
                      <th>Category / Activity</th>
                      <th>Project</th>
                      <th className="text-end">Released ({currencySymbol})</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSelectedMilestone.budgets.map((b) => (
                      <tr key={b.id}>
                        <td className="fw-bold font-monospace text-primary">{b.code}</td>
                        <td>{b.legalEntity}</td>
                        <td>{b.category}</td>
                        <td>{b.projectName || b.campaign || 'General Departmental'}</td>
                        <td className="text-end fw-bold font-monospace">
                          {Number(b.revisedBudget ?? b.allocatedAmount ?? 0).toLocaleString()}
                        </td>
                        <td>{b.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeSelectedMonth && (
            <div className="table-responsive">
              {activeSelectedMonth.transactions.length === 0 ? (
                <div className="text-muted fs-8 py-2">
                  No expenditures recorded in {activeSelectedMonth.fullLabel}.
                </div>
              ) : (
                <table className="table table-sm table-hover align-middle fs-8 mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Expense ID</th>
                      <th>Date</th>
                      <th>Entity</th>
                      <th>Category</th>
                      <th>Supplier</th>
                      <th className="text-end">Amount ({currencySymbol})</th>
                      <th className="text-center">Trace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSelectedMonth.transactions.map((exp) => (
                      <tr key={exp.id}>
                        <td className="fw-bold font-monospace text-danger">{exp.expenseId}</td>
                        <td className="font-monospace">{exp.date || exp.expenseDate || ''}</td>
                        <td>{exp.legalEntity}</td>
                        <td>{exp.category}</td>
                        <td>{exp.supplierName}</td>
                        <td className="text-end fw-bold font-monospace">
                          {Number(exp.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="text-center">
                          {onDrillDown ? (
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm py-0 px-2 fs-8"
                              onClick={() =>
                                onDrillDown({
                                  type: 'transaction',
                                  id: exp.expenseId,
                                  recordType: 'Expenditure',
                                })
                              }
                            >
                              Trace
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

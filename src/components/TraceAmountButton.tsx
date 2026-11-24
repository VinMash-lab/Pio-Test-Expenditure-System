import React from 'react';
import { AmountTraceContext } from '../types';

interface TraceAmountButtonProps {
  amount: number;
  metricName: string;
  metricId?: string;
  currency?: string;
  financialYear?: string;
  period?: string;
  departmentName?: string;
  costCentre?: string;
  budgetLine?: string;
  projectName?: string;
  supplierName?: string;
  formula?: string;
  formulaExplanation?: string;
  onTraceAmount: (context: AmountTraceContext) => void;
  className?: string;
  variant?: 'badge' | 'button' | 'icon' | 'link';
  children?: React.ReactNode;
}

export const TraceAmountButton: React.FC<TraceAmountButtonProps> = ({
  amount,
  metricName,
  metricId,
  currency = 'KES',
  financialYear = '2026',
  period,
  departmentName,
  costCentre,
  budgetLine,
  projectName,
  supplierName,
  formula,
  formulaExplanation,
  onTraceAmount,
  className = '',
  variant = 'badge',
  children,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTraceAmount({
      metricId: metricId || metricName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      metricName,
      totalAmount: amount,
      currency,
      financialYear,
      period,
      departmentName,
      costCentre,
      budgetLine,
      projectName,
      supplierName,
      formula: formula || `Reported Amount = Σ(Qualifying Ledger Transactions for "${metricName}")`,
      formulaExplanation: formulaExplanation || `Sum of underlying financial transactions composing ${metricName}.`,
    });
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={`btn btn-link p-0 text-decoration-none text-muted ${className}`}
        title={`Trace this amount: ${metricName}`}
        onClick={handleClick}
        style={{ verticalAlign: 'middle', lineHeight: 1 }}
      >
        <i className="bi bi-search text-danger" style={{ fontSize: '0.85rem' }}></i>
      </button>
    );
  }

  if (variant === 'link') {
    return (
      <button
        type="button"
        className={`btn btn-link p-0 text-decoration-none text-start text-dark fw-bold hover-underline ${className}`}
        title={`Click to trace ${metricName}`}
        onClick={handleClick}
      >
        {children || `${amount.toLocaleString()} ${currency}`}
        <i className="bi bi-box-arrow-up-right ms-1 text-danger" style={{ fontSize: '0.75rem' }}></i>
      </button>
    );
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        className={`btn btn-sm btn-outline-danger py-0 px-2 fs-8 fw-semibold d-inline-flex align-items-center gap-1 ${className}`}
        onClick={handleClick}
        title={`Trace calculation & transactions for ${metricName}`}
      >
        <i className="bi bi-node-plus"></i>
        <span>Trace Amount</span>
      </button>
    );
  }

  // Default: badge
  return (
    <span
      className={`badge bg-danger-subtle text-danger border border-danger-subtle cursor-pointer d-inline-flex align-items-center gap-1 py-1 px-1.5 fs-8 hover-shadow ${className}`}
      onClick={handleClick}
      role="button"
      title={`Trace this amount (${metricName})`}
    >
      <i className="bi bi-search" style={{ fontSize: '0.7rem' }}></i>
      <span>Trace</span>
    </span>
  );
};

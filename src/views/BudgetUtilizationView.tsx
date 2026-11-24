import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { RoleType } from '../types';

interface BudgetUtilizationViewProps {
  role: RoleType;
  onRefresh: () => void;
  embedded?: boolean;
}

export const BudgetUtilizationView: React.FC<BudgetUtilizationViewProps> = ({ role: _role, onRefresh: _onRefresh, embedded = false }) => {
  const projs = DatabaseService.getProjects();
  const exps = DatabaseService.getExpenditures();
  const settings = DatabaseService.getSettings();

  const [selectedEntity, setSelectedEntity] = useState<string>('All');
  const [selectedTier, setSelectedTier] = useState<string>('All');
  const [search, setSearch] = useState<string>('');

  // Calculate detailed utilization for all initiatives
  const utilizationItems = useMemo(() => {
    return projs.map((p) => {
      const relatedExps = exps.filter((e) => e.projectId === p.id);
      const budget = Number(p.totalBudget || p.approvedBudget || p.budget || 0);
      const actual = p.actualSpend !== undefined && p.actualSpend > 0
        ? p.actualSpend
        : relatedExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

      const remaining = budget - actual;
      const utilization = budget > 0 ? (actual / budget) * 100 : 0;
      
      let tier = 'low'; // < 50%
      if (utilization > 100) tier = 'over';
      else if (utilization >= 90) tier = 'critical';
      else if (utilization >= 75) tier = 'warning';
      else if (utilization >= 50) tier = 'moderate';

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        entity: p.entity || (p.projectType === 'Shared Project' ? 'Shared' : p.paclApplicable ? 'PACL' : 'PGIL'),
        category: p.campaignType || p.budgetCategory || 'Marketing & CX',
        budget,
        actual,
        remaining,
        utilization,
        tier,
        status: p.status,
      };
    });
  }, [projs, exps]);

  // Filter items
  const filteredItems = useMemo(() => {
    return utilizationItems.filter((item) => {
      if (selectedEntity !== 'All' && item.entity !== selectedEntity) return false;
      if (selectedTier !== 'All' && item.tier !== selectedTier) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(item.name || '').toLowerCase().includes(q) &&
          !(item.code || '').toLowerCase().includes(q) &&
          !(item.category || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [utilizationItems, selectedEntity, selectedTier, search]);

  // Tier counts
  const tierStats = useMemo(() => {
    return {
      all: utilizationItems.length,
      over: utilizationItems.filter((i) => i.tier === 'over').length,
      critical: utilizationItems.filter((i) => i.tier === 'critical').length,
      warning: utilizationItems.filter((i) => i.tier === 'warning').length,
      moderate: utilizationItems.filter((i) => i.tier === 'moderate').length,
      low: utilizationItems.filter((i) => i.tier === 'low').length,
    };
  }, [utilizationItems]);

  const handleExportExcel = () => {
    const data = filteredItems.map((item) => ({
      'Project Code': item.code,
      'Project Name': item.name,
      'Entity': item.entity,
      'Category': item.category,
      'Approved Budget (KES)': item.budget,
      'Actual Spend (KES)': item.actual,
      'Remaining Balance (KES)': item.remaining,
      'Utilization Rate': `${item.utilization.toFixed(1)}%`,
      'Utilization Tier': item.tier.toUpperCase(),
      'Status': item.status,
    }));
    ExcelService.exportCustomDataset(data, 'Budget_Utilization_Ledger');
  };

  const handleExportPDF = () => {
    const cols = ['Project Code', 'Project Name', 'Entity', 'Budget', 'Actual Spend', 'Remaining', 'Utilization Rate', 'Tier'];
    const rows = filteredItems.map((i) => [
      i.code,
      i.name,
      i.entity,
      `${i.budget.toLocaleString()} ${settings.currencySymbol}`,
      `${i.actual.toLocaleString()} ${settings.currencySymbol}`,
      `${i.remaining.toLocaleString()} ${settings.currencySymbol}`,
      `${i.utilization.toFixed(1)}%`,
      i.tier.toUpperCase(),
    ]);
    PDFService.generateReportPDF('BUDGET UTILIZATION TRACKING REPORT', `Entity: ${selectedEntity} | FY ${settings.financialYear}`, cols, rows, settings);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      {embedded ? (
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <p className="text-muted small mb-0">
            Departmental burn rate tracking, early warning thresholds (75% &amp; 90%), and over-expenditure monitoring.
          </p>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button id="btn-export-excel-util" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-excel"></i> Export Excel
            </button>
            <button id="btn-export-pdf-util" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-pdf"></i> Export PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
          <div>
            <div className="d-flex align-items-center gap-2">
              <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
                Budget Utilization Ledger
              </h3>
              <span className="badge bg-success text-white px-2 py-1">Rate Analysis</span>
            </div>
            <p className="text-muted small mb-0 mt-1">
              Departmental burn rate tracking, early warning thresholds (75% &amp; 90%), and over-expenditure monitoring.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button id="btn-export-excel-util" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-excel"></i> Export Excel
            </button>
            <button id="btn-export-pdf-util" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-pdf"></i> Export PDF
            </button>
          </div>
        </div>
      )}

      {/* Tier Filter Pills */}
      <div className="d-flex gap-2 flex-wrap">
        <button
          className={`btn btn-sm ${selectedTier === 'All' ? 'btn-dark' : 'btn-outline-secondary'}`}
          onClick={() => setSelectedTier('All')}
        >
          All Items ({tierStats.all})
        </button>
        <button
          className={`btn btn-sm ${selectedTier === 'over' ? 'btn-danger' : 'btn-outline-danger'}`}
          onClick={() => setSelectedTier('over')}
        >
          <i className="bi bi-exclamation-octagon me-1"></i> Over 100% ({tierStats.over})
        </button>
        <button
          className={`btn btn-sm ${selectedTier === 'critical' ? 'btn-warning text-dark' : 'btn-outline-warning'}`}
          onClick={() => setSelectedTier('critical')}
        >
          <i className="bi bi-exclamation-triangle me-1"></i> 90% - 100% Critical ({tierStats.critical})
        </button>
        <button
          className={`btn btn-sm ${selectedTier === 'warning' ? 'btn-warning text-dark' : 'btn-outline-secondary'}`}
          onClick={() => setSelectedTier('warning')}
        >
          75% - 90% Warning ({tierStats.warning})
        </button>
        <button
          className={`btn btn-sm ${selectedTier === 'moderate' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setSelectedTier('moderate')}
        >
          50% - 75% On Track ({tierStats.moderate})
        </button>
        <button
          className={`btn btn-sm ${selectedTier === 'low' ? 'btn-success' : 'btn-outline-success'}`}
          onClick={() => setSelectedTier('low')}
        >
          &lt; 50% Low Utilization ({tierStats.low})
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card card-erp p-3 shadow-sm">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-6">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted border-end-0">
                <i className="bi bi-search"></i>
              </span>
              <input
                id="input-search-util"
                type="text"
                className="form-control form-control-sm border-start-0"
                placeholder="Search initiative by name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-4">
            <select
              id="select-util-entity"
              className="form-select form-select-sm"
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
            >
              <option value="All">All Entities (PACL, PGIL & Shared)</option>
              <option value="PACL">PACL (Pioneer Assurance)</option>
              <option value="PGIL">PGIL (Pioneer General)</option>
              <option value="Shared">Shared Projects</option>
            </select>
          </div>

          <div className="col-6 col-md-2 text-end">
            <button
              id="btn-reset-util-filters"
              onClick={() => {
                setSearch('');
                setSelectedEntity('All');
                setSelectedTier('All');
              }}
              className="btn btn-outline-secondary btn-sm w-100"
              title="Reset Filters"
            >
              <i className="bi bi-arrow-counterclockwise me-1"></i> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="row g-3">
        {filteredItems.length === 0 ? (
          <div className="col-12">
            <div className="card card-erp p-5 text-center text-muted">
              <i className="bi bi-speedometer2 fs-1 text-secondary opacity-50 mb-2"></i>
              No initiatives match the selected utilization criteria.
            </div>
          </div>
        ) : (
          filteredItems.map((item) => {
            const barColor = item.tier === 'over' ? 'bg-danger' : item.tier === 'critical' ? 'bg-danger' : item.tier === 'warning' ? 'bg-warning' : item.tier === 'moderate' ? 'bg-primary' : 'bg-success';
            return (
              <div key={item.id} className="col-12 col-md-6 col-xl-4">
                <div className={`card card-erp p-3 h-100 shadow-sm border-start border-4 ${item.tier === 'over' ? 'border-danger' : item.tier === 'critical' ? 'border-danger' : item.tier === 'warning' ? 'border-warning' : 'border-success'}`}>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <span className="badge bg-light text-dark border me-1">{item.code}</span>
                      <span className={`badge ${item.entity === 'PACL' ? 'bg-dark text-white' : item.entity === 'PGIL' ? 'bg-danger text-white' : 'bg-primary text-white'}`}>
                        {item.entity}
                      </span>
                    </div>
                    <span className={`badge ${item.tier === 'over' ? 'bg-danger text-white' : item.tier === 'critical' ? 'bg-danger-subtle text-danger border border-danger' : 'bg-light text-dark border'}`}>
                      {item.tier === 'over' ? 'OVER BUDGET' : `${item.utilization.toFixed(1)}%`}
                    </span>
                  </div>

                  <h6 className="fw-bold text-dark text-truncate mb-1" title={item.name}>
                    {item.name}
                  </h6>
                  <p className="text-muted extra-small mb-3 text-truncate">{item.category}</p>

                  <div className="mb-2">
                    <div className="d-flex justify-content-between extra-small text-muted mb-1">
                      <span>Spent: <strong>{item.actual.toLocaleString()} {settings.currencySymbol}</strong></span>
                      <span>Budget: <strong>{item.budget.toLocaleString()} {settings.currencySymbol}</strong></span>
                    </div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div
                        className={`progress-bar ${barColor}`}
                        role="progressbar"
                        style={{ width: `${Math.min(item.utilization, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center extra-small pt-2 border-top mt-auto">
                    <span className="text-muted">
                      Remaining: <strong className={item.remaining < 0 ? 'text-danger' : 'text-success'}>{item.remaining.toLocaleString()} {settings.currencySymbol}</strong>
                    </span>
                    <span className="text-muted">{item.status}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

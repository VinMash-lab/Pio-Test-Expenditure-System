import React, { useState } from 'react';
import { ExcelService } from '../services/excelService';
import { DatabaseService } from '../services/db';
import { ExcelImportRow, Budget, RoleType } from '../types';
import { showToast } from '../services/uiFeedback';

interface ExcelWizardViewProps {
  role: RoleType;
  onRefresh: () => void;
}

export const ExcelWizardView: React.FC<ExcelWizardViewProps> = ({ role, onRefresh }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [fileName, setFileName] = useState<string>('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetsData, setSheetsData] = useState<Record<string, any[]>>({});
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Column Mapping
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState({
    budgetCodeKey: '',
    financialYearKey: '',
    departmentKey: '',
    projectKey: '',
    categoryKey: '',
    allocatedAmountKey: '',
    descriptionKey: '',
  });

  // Validated Processed Rows
  const [processedRows, setProcessedRows] = useState<ExcelImportRow[]>([]);

  // Step 1: File Upload Event
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    try {
      const parsed = await ExcelService.parseWorkbook(file);
      setSheetNames(parsed.sheetNames);
      setSheetsData(parsed.sheetsData);

      if (parsed.sheetNames.length > 0) {
        const firstSheet = parsed.sheetNames[0];
        setSelectedSheet(firstSheet);
        const rawData = parsed.sheetsData[firstSheet] || [];
        if (rawData.length > 0) {
          const keys = Object.keys(rawData[0]);
          setColumns(keys);

          // Auto-guess mapping keys
          setMapping({
            budgetCodeKey: keys.find((k) => k.toLowerCase().includes('code')) || keys[0] || '',
            financialYearKey: keys.find((k) => k.toLowerCase().includes('year') || k.toLowerCase().includes('fy')) || '',
            departmentKey: keys.find((k) => k.toLowerCase().includes('dept') || k.toLowerCase().includes('department')) || '',
            projectKey: keys.find((k) => k.toLowerCase().includes('proj')) || '',
            categoryKey: keys.find((k) => k.toLowerCase().includes('cat')) || '',
            allocatedAmountKey: keys.find((k) => k.toLowerCase().includes('amount') || k.toLowerCase().includes('alloc') || k.toLowerCase().includes('budget')) || '',
            descriptionKey: keys.find((k) => k.toLowerCase().includes('desc')) || '',
          });
        }
      }
      setStep(2);
    } catch (err) {
      showToast('Error reading Excel workbook. Please ensure it is a valid .xlsx or .xls file.', 'danger');
    }
  };

  // Step 2: Worksheet Change
  const handleSheetChange = (sheet: string) => {
    setSelectedSheet(sheet);
    const rawData = sheetsData[sheet] || [];
    if (rawData.length > 0) {
      const keys = Object.keys(rawData[0]);
      setColumns(keys);
    }
  };

  // Step 3: Run Validation Engine
  const handleValidateMapping = () => {
    const existingBudgets = DatabaseService.getBudgets();
    const rawRows = sheetsData[selectedSheet] || [];

    const validated = ExcelService.processBudgetImportSheet(rawRows, mapping, existingBudgets);
    setProcessedRows(validated);
    setStep(3);
  };

  // Step 4: Execute Import
  const handleExecuteImport = () => {
    const validRows = processedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      showToast('No valid rows available for import.', 'warning');
      return;
    }

    const depts = DatabaseService.getDepartments();
    const settings = DatabaseService.getSettings();
    const defaultFy = settings.financialYear || '2026';

    validRows.forEach((r) => {
      const deptNeedle = (r.department || '').trim().toLowerCase();
      const matchedDept = depts.find(
        (d) => (d.name || '').toLowerCase() === deptNeedle || (d.code || '').toLowerCase() === deptNeedle
      );

      const newBudget: Budget = {
        id: 'bdg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        code: r.budgetCode,
        legalEntity: 'PACL',
        financialYear: r.financialYear || defaultFy,
        departmentId: matchedDept ? matchedDept.id : depts[0]?.id || 'dept-mcx',
        departmentName: matchedDept ? matchedDept.name : r.department || depts[0]?.name || 'General',
        category: r.category || 'General',
        allocatedAmount: Number(r.allocatedAmount || 0),
        description: r.description || `Imported from ${fileName}`,
        status: 'Approved',
        createdBy: `${role} Excel Import`,
        createdDate: new Date().toISOString().split('T')[0],
      };

      DatabaseService.saveBudget(newBudget, `${role} User`, role);
    });

    DatabaseService.addImportHistory({
      id: 'imp-' + Date.now(),
      fileName: fileName || 'Budget_Import.xlsx',
      dataType: 'Budget',
      dateImported: new Date().toISOString().split('T')[0],
      totalRecords: processedRows.length,
      successfulRecords: validRows.length,
      failedRecords: processedRows.length - validRows.length,
      importedBy: `${role} User`,
      status: validRows.length === processedRows.length ? 'Successful' : 'Partial Success',
    });

    showToast(`Imported ${validRows.length} budget record(s) successfully.`, 'success');
    onRefresh();
    setStep(4);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Wizard Step Progress Tracker */}
      <div className="card card-erp p-3">
        <div className="row text-center g-2">
          <div className="col-3">
            <div className={`p-2 rounded ${step === 1 ? 'bg-danger text-white fw-bold' : step > 1 ? 'bg-success text-white' : 'bg-light text-muted'}`}>
              1. Upload Workbook
            </div>
          </div>
          <div className="col-3">
            <div className={`p-2 rounded ${step === 2 ? 'bg-danger text-white fw-bold' : step > 2 ? 'bg-success text-white' : 'bg-light text-muted'}`}>
              2. Column Mapping
            </div>
          </div>
          <div className="col-3">
            <div className={`p-2 rounded ${step === 3 ? 'bg-danger text-white fw-bold' : step > 3 ? 'bg-success text-white' : 'bg-light text-muted'}`}>
              3. Data Integrity Check
            </div>
          </div>
          <div className="col-3">
            <div className={`p-2 rounded ${step === 4 ? 'bg-danger text-white fw-bold' : 'bg-light text-muted'}`}>
              4. Import Complete
            </div>
          </div>
        </div>
      </div>

      {/* STEP 1: Upload File */}
      {step === 1 && (
        <div className="card card-erp p-5 text-center">
          <i className="bi bi-file-earmark-excel-fill text-success" style={{ fontSize: '4rem' }}></i>
          <h3 className="h5 fw-bold mt-3 mb-2">Import Budget Workbook from Microsoft Excel</h3>
          <p className="text-muted fs-7 mb-4" style={{ maxWidth: '540px', margin: '0 auto' }}>
            Upload an Excel workbook (`.xlsx`, `.xls`, `.csv`). Map worksheets like Budgets, Expenditure, or Projects directly into your ERP system with duplicate validation.
          </p>

          <div className="d-flex justify-content-center gap-3">
            <label className="btn btn-corporate btn-lg px-4 fs-6 shadow-sm cursor-pointer">
              <i className="bi bi-folder2-open me-2"></i> Choose Excel File
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="d-none" />
            </label>

            <button
              type="button"
              onClick={() => ExcelService.downloadBudgetImportTemplate()}
              className="btn btn-outline-secondary btn-lg px-4 fs-6"
            >
              <i className="bi bi-download me-2 text-success"></i> Download Excel Template
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Worksheet & Column Mapping */}
      {step === 2 && (
        <div className="card card-erp p-4">
          <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
            <div>
              <h4 className="h6 fw-bold mb-0">Step 2: Map Excel Columns for File: <span className="text-corporate-primary">{fileName}</span></h4>
              <small className="text-muted">Select worksheet and match your Excel headers to system fields</small>
            </div>
            <button type="button" onClick={() => setStep(1)} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-arrow-left me-1"></i> Back
            </button>
          </div>

          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold fs-7">Select Worksheet *</label>
              <select className="form-select fs-7" value={selectedSheet} onChange={(e) => handleSheetChange(e.target.value)}>
                {sheetNames.map((name) => (
                  <option key={name} value={name}>
                    Worksheet: {name} ({sheetsData[name]?.length || 0} rows)
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12"><hr /></div>

            {/* Field Mappings */}
            <div className="col-md-6">
              <label className="form-label fw-semibold fs-7">Budget Code Key *</label>
              <select
                className="form-select fs-7"
                value={mapping.budgetCodeKey}
                onChange={(e) => setMapping({ ...mapping, budgetCodeKey: e.target.value })}
              >
                <option value="">-- Select Column --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold fs-7">Financial Year Column</label>
              <select
                className="form-select fs-7"
                value={mapping.financialYearKey}
                onChange={(e) => setMapping({ ...mapping, financialYearKey: e.target.value })}
              >
                <option value="">-- Select Column --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold fs-7">Department Column *</label>
              <select
                className="form-select fs-7"
                value={mapping.departmentKey}
                onChange={(e) => setMapping({ ...mapping, departmentKey: e.target.value })}
              >
                <option value="">-- Select Column --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold fs-7">Project Name Column</label>
              <select
                className="form-select fs-7"
                value={mapping.projectKey}
                onChange={(e) => setMapping({ ...mapping, projectKey: e.target.value })}
              >
                <option value="">-- Select Column --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold fs-7">Expense Category Column</label>
              <select
                className="form-select fs-7"
                value={mapping.categoryKey}
                onChange={(e) => setMapping({ ...mapping, categoryKey: e.target.value })}
              >
                <option value="">-- Select Column --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold fs-7">Allocated Amount Column *</label>
              <select
                className="form-select fs-7"
                value={mapping.allocatedAmountKey}
                onChange={(e) => setMapping({ ...mapping, allocatedAmountKey: e.target.value })}
              >
                <option value="">-- Select Column --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 mt-4 text-end">
              <button type="button" onClick={handleValidateMapping} className="btn btn-corporate px-4">
                Validate & Preview Rows <i className="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Validation & Error Check */}
      {step === 3 && (
        <div className="card card-erp p-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h4 className="h6 fw-bold mb-0">Step 3: Data Integrity & Error Inspection</h4>
              <small className="text-muted">
                Valid: {processedRows.filter((r) => r.isValid).length} | Errors:{' '}
                <span className="text-danger fw-bold">{processedRows.filter((r) => !r.isValid).length}</span>
              </small>
            </div>
            <div className="d-flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="btn btn-outline-secondary btn-sm">
                Back to Mapping
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                className="btn btn-corporate btn-sm"
                disabled={processedRows.filter((r) => r.isValid).length === 0}
              >
                Execute Import ({processedRows.filter((r) => r.isValid).length} Valid Records)
              </button>
            </div>
          </div>

          <div className="table-responsive" style={{ maxHeight: '380px' }}>
            <table className="table table-hover table-erp align-middle mb-0" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Budget Code</th>
                  <th>FY</th>
                  <th>Department</th>
                  <th>Category</th>
                  <th>Allocated Amount</th>
                  <th>Validation Message</th>
                </tr>
              </thead>
              <tbody>
                {processedRows.map((row, idx) => (
                  <tr key={idx} className={!row.isValid ? 'bg-danger-subtle' : ''}>
                    <td>
                      {row.isValid ? (
                        <span className="badge bg-success">Valid</span>
                      ) : (
                        <span className="badge bg-danger">Error</span>
                      )}
                    </td>
                    <td className="fw-bold">{row.budgetCode}</td>
                    <td>{row.financialYear}</td>
                    <td>{row.department}</td>
                    <td>{row.category}</td>
                    <td className="fw-bold">{Number(row.allocatedAmount || 0).toLocaleString()} KES</td>
                    <td className={!row.isValid ? 'text-danger fw-bold' : 'text-muted'}>
                      {row.isValid ? 'Ready for import' : row.errorMessages.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 4: Execution Complete */}
      {step === 4 && (
        <div className="card card-erp p-5 text-center">
          <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '4rem' }}></i>
          <h3 className="h5 fw-bold mt-3 mb-2">Import Completed Successfully!</h3>
          <p className="text-muted fs-7 mb-4">
            The valid budget records have been inserted into the corporate database. Audit trail entry has been created.
          </p>
          <div>
            <button type="button" onClick={() => setStep(1)} className="btn btn-corporate px-4">
              Import Another Workbook
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

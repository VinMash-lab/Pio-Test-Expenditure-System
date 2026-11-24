import React, { useState } from 'react';

export const HelpView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'journey' | 'steps' | 'roles' | 'rules' | 'faq' | 'architecture'>('journey');
  const [searchQuery, setSearchQuery] = useState('');

  const lifecycleStages = [
    {
      step: 1,
      phase: 'Phase 1: Annual Budget Planning & Entity Ceilings',
      title: 'Define Master Budget Allocations & Revisions',
      view: 'Annual Budget Workspace',
      badge: 'Admin / Finance Lead',
      icon: 'bi-calculator-fill',
      summary: 'Establish legal entity ceilings for Pioneer Assurance (PACL) and Pioneer General (PGIL), set quarterly quotas, and manage approved budget revisions.',
      steps: [
        'Navigate to "Annual Budget Workspace" from the sidebar.',
        'Select the active Financial Year (FY 2026) and target Legal Entity (PACL or PGIL).',
        'Click "+ New Annual Budget" to define an approved budget line for a specific Department/Cost Centre.',
        'Enter Department Name, Expense Category (e.g. Media Buying, Market Research, CX Surveys, Agency Retainers), and Approved Baseline (KES).',
        'When mid-year adjustments occur, use the "+ Add Revision" feature to append audited revisions with formal justifications without overwriting historical baselines.',
        'View the live variance and utilization rates computed in real-time as expenditures are posted.',
      ],
      tip: 'Audit Rule: Baseline budgets are immutable once finalized; any subsequent addition must be recorded as an authorized Revision with an audit trail note.',
    },
    {
      step: 2,
      phase: 'Phase 2: Strategic Initiatives & Shared Projects Split',
      title: 'Configure Standalone Campaigns & Co-Funding Splits',
      view: 'Shared Projects Co-Funding',
      badge: 'Marketing & CX Manager',
      icon: 'bi-diagram-3-fill',
      summary: 'Manage standalone campaigns or joint co-funded initiatives where costs are mathematically shared between PACL and PGIL.',
      steps: [
        'Navigate to "Shared Projects Co-Funding" or "Campaigns & Projects".',
        'Click "+ Create Shared Project" to register a joint initiative (e.g. "Annual Brand Campaign & Customer Journey Refresh").',
        'Enter Project Code (e.g. PRJ-2026-SH01), Total Project Budget, and the target Cost Split percentage (e.g. 60% PACL / 40% PGIL or 50% / 50%).',
        'The co-funding calculation engine automatically computes: PACL Allocation (KES) + PGIL Allocation (KES) = Total Budget.',
        'The system enforces strict real-time mathematical validation: The sum of PACL and PGIL shares must equal 100% of the total budget before saving.',
        'Track actual spend independently against each entity’s allocated ceiling to prevent disproportionate burden.',
      ],
      tip: 'Co-Funding Engine: Standalone projects belong strictly to one legal entity; Shared projects maintain separate ledger debit tracking for PACL and PGIL.',
    },
    {
      step: 3,
      phase: 'Phase 3: Vendor Onboarding & Quotations Sourcing',
      title: 'Evaluate Vendor Bids & Compare Proposals',
      view: 'Quotations & Vendor Proposals',
      badge: 'Procurement / Budget Officer',
      icon: 'bi-tag-fill',
      summary: 'Register prospective agency bids, evaluate multi-vendor quotes, and record formal bid award justifications.',
      steps: [
        'Go to "Agencies & Suppliers" to register vetted agencies with legal names, KRA Tax PINs, and banking information.',
        'Open "Quotations & Vendor Proposals" and click "+ Register Quotation".',
        'Enter Quotation Reference No., Vendor Name, Project Tag, Quoted Amount, and validity dates.',
        'Upload the digital quotation document or vendor proposal PDF.',
        'Use the Bid Evaluation status (Submitted, Under Evaluation, Accepted, Rejected) to document competitive selection and compliance.',
      ],
      tip: 'Procurement Governance: Enterprise rules require minimum three competitive quotations for marketing procurement exceeding KES 500,000.',
    },
    {
      step: 4,
      phase: 'Phase 4: Procurement Commitment & LPO Issuance',
      title: 'Issue Official Local Purchase Orders with 16% VAT',
      view: 'LPO Management',
      badge: 'Approver / Procurement Lead',
      icon: 'bi-file-earmark-spreadsheet-fill',
      summary: 'Generate sequentially numbered, binding purchase orders that instantly commit budget funds prior to invoice receipt.',
      steps: [
        'Open "LPO Management" and click "+ Create Local Purchase Order".',
        'Select Legal Entity (PACL, PGIL, or Shared), Supplier, and target Project/Department.',
        'System generates sequential format: LPO-PACL-2026-001 or LPO-PGIL-2026-002.',
        'Input Base Amount (KES). The 16% Standard VAT and Gross Total Amount calculate automatically.',
        'Enter Delivery Scope, Payment Milestones, and terms (e.g. Net 30 Days).',
        'Upon approval, the LPO amount is automatically classified as "Committed Budget", reserving funds and updating the available balance immediately.',
        'Export standard formatted LPO PDF for supplier dispatch and countersigning.',
      ],
      tip: 'Commitment Accounting: An approved LPO immediately locks funds, preventing other officers from over-committing the budget before the invoice arrives.',
    },
    {
      step: 5,
      phase: 'Phase 5: Invoice Processing & 3-Way Match Verification',
      title: 'Log Tax Invoices & Verify against Purchase Orders',
      view: 'Invoices & Accounts Payable',
      badge: 'Accounts Payable / Budget Officer',
      icon: 'bi-receipt',
      summary: 'Record vendor tax invoices, itemize VAT and withholding tax, and perform 3-way matching against issued LPOs.',
      steps: [
        'Navigate to "Invoices & Accounts Payable".',
        'Click "+ Log Vendor Invoice".',
        'Enter Vendor Invoice Number (system automatically verifies against duplicate numbers across the database).',
        'Select the corresponding LPO number from the dropdown to auto-populate supplier, entity, and project context.',
        'Enter Net Invoice Amount and VAT Amount. Verify that invoice does not exceed the issued LPO commitment.',
        'Upload the scanned tax invoice copy into the Document Vault.',
        'System updates matching status to "3-Way Verified" ready for payment requisition.',
      ],
      tip: 'Duplicate Protection: The system blocks submission of duplicate invoice numbers for the same supplier to prevent double disbursements.',
    },
    {
      step: 6,
      phase: 'Phase 6: Payment Requisition & Disbursement Authorization',
      title: 'Initiate, Authorize, and Disburse Payments',
      view: 'Payment Requests & Authorizations',
      badge: 'HOD / Marketing Manager / Finance',
      icon: 'bi-credit-card-2-front-fill',
      summary: 'Generate formal payment vouchers, review signatory authorizations, and settle accounts payable.',
      steps: [
        'Open "Payment Requests & Authorizations" and click "+ Create Payment Request".',
        'Select Matched Invoice or create direct disbursement requisition.',
        'Specify priority level (Urgent, High, Medium, Low) and provide payment particulars.',
        'Manager or Administrator reviews and triggers "Approve Request".',
        'Upon fund release by Treasury/Finance, click "Mark as Paid / Settled".',
        'The settlement automatically marks the linked invoice as Paid, generates a transaction in the Expenditure Ledger, and converts the LPO commitment into Actual Spend.',
      ],
      tip: 'Segregation of Duties: Requisitioners cannot authorize their own payment requests above threshold limits.',
    },
    {
      step: 7,
      phase: 'Phase 7: Real-Time Variance & Utilization Monitoring',
      title: 'Analyze Budget vs Actual & Monthly Burn Rates',
      view: 'Budget vs Actual & Utilization',
      badge: 'All Roles / Management',
      icon: 'bi-bar-chart-line-fill',
      summary: 'Monitor project burn rates, variance alerts (Favorable vs Overspent), and 12-month spending trajectories.',
      steps: [
        'Open "Budget vs Actual Variance" to inspect project-level variance amounts and percentage deviations.',
        'Review "Budget Utilization Ledger" to identify line items nearing warning thresholds (>75% Caution, >90% Critical).',
        'Explore "Monthly Trend & Burn Rate" to assess 12-month expenditure seasonality against monthly benchmark quotas.',
        'Use the Executive Dashboard for instant macro KPIs across PACL, PGIL, and Shared portfolios.',
      ],
      tip: 'Predictive Signals: Early detection of seasonal spikes in Q3/Q4 allows reallocation of unutilized reserves from Q1/Q2.',
    },
    {
      step: 8,
      phase: 'Phase 8: Diagnostics, Management Reports & Audit Exports',
      title: 'Run Health Checks, Board Reports & Data Backups',
      view: 'Management Reports & Export Centre',
      badge: 'ExCo / Auditors / Administrators',
      icon: 'bi-shield-check',
      summary: 'Execute automated 7-point integrity scans, produce board-ready executive reports, and export auditable datasets.',
      steps: [
        'Navigate to "System Diagnostics & Health" and click "Re-Run Diagnostics" to scan for balance imbalances, duplicates, or overspends.',
        'Access "Executive Management Report" for consolidated ExCo and Board summaries with PACL vs PGIL comparisons.',
        'Open "Export & Download Hub" to generate one-click Excel (.xlsx), CSV, and PDF reports for any ledger or document registry.',
        'Review the immutable "Activity Logs" to audit user actions, timestamps, and IP addresses.',
        'Download the "Full Database Backup (.json)" for offline archival and compliance record-keeping.',
      ],
      tip: 'Continuous Integrity: Automated diagnostics evaluate the entire database state upon every write operation.',
    },
  ];

  const roleMatrices = [
    {
      role: 'Administrator',
      color: 'dark',
      description: 'System master administrator with full configuration rights, user provisioning, diagnostics, and archive recovery.',
      responsibilities: [
        'Configure global system settings, KRA PIN, base currency, and fiscal year.',
        'Provision user profiles, assign departmental roles, and manage access statuses.',
        'Run automated data diagnostics and resolve integrity warnings.',
        'Manage soft-deleted records in the Archive and execute permanent purges.',
        'Review full system audit logs and override budget restrictions in emergency scenarios.',
      ],
    },
    {
      role: 'Marketing & CX Manager',
      color: 'danger',
      description: 'Departmental approver and strategic budget custodian overseeing campaign plans and authorizations.',
      responsibilities: [
        'Formulate annual Marketing & CX budget proposals and submit revisions.',
        'Authorize Shared Projects and validate PACL/PGIL co-funding split percentages.',
        'Approve high-value Local Purchase Orders (LPOs) and Vendor Quotations.',
        'Authorize Payment Requisitions for agency retainers and campaign deliverables.',
        'Present executive performance reports and variance analyses to Executive Committee.',
      ],
    },
    {
      role: 'Budget Officer',
      color: 'primary',
      description: 'Operational procurement and accounts payable officer managing day-to-day transaction records.',
      responsibilities: [
        'Draft and submit Local Purchase Orders (LPOs) with 16% VAT calculations.',
        'Log vendor tax invoices and perform 3-way matching against approved LPOs.',
        'Initiate payment requisitions and attach supporting disbursement proofs.',
        'Maintain vendor profile details, KRA tax compliance, and contract briefs.',
        'Perform monthly expenditure reconciliations and flag potential budget overruns.',
      ],
    },
    {
      role: 'Viewer / Auditor',
      color: 'secondary',
      description: 'Read-only compliance and governance auditor verifying financial accuracy and trail integrity.',
      responsibilities: [
        'Inspect all financial ledgers, budget lines, LPOs, invoices, and vouchers.',
        'Verify 3-way matching compliance across all procurement and payables.',
        'Review the immutable Audit Trail for unauthorized edits or timestamp anomalies.',
        'Export verified financial statements and audit workpapers in Excel and PDF.',
      ],
    },
  ];

  const quickRules = [
    {
      rule: 'Mandatory Legal Entity Segregation (PACL vs PGIL)',
      desc: 'All financial entities (Budgets, LPOs, Invoices, Expenditures) must specify whether they belong to Pioneer Assurance Company Limited (PACL) or Pioneer General Insurance Limited (PGIL) for statutory tax filing.',
    },
    {
      rule: 'Shared Project Co-Funding Balance Rule',
      desc: 'For all joint initiatives, PACL Allocation + PGIL Allocation MUST exactly equal 100% of Total Budget. The system automatically blocks saving if there is any numerical discrepancy.',
    },
    {
      rule: 'Standard 16% Value Added Tax (VAT)',
      desc: 'All procurement entries and tax invoices automatically apply Kenya’s standard 16% VAT on taxable supplies while maintaining clear separation between Net Base and Gross Total.',
    },
    {
      rule: 'Three-Way Matching Policy (LPO ➔ Invoice ➔ Payment Request)',
      desc: 'Expenditures and payment authorizations must match an approved LPO and vendor tax invoice to ensure procurement governance and eliminate duplicate billings.',
    },
    {
      rule: 'Prohibition of Automatic Record Overwrites',
      desc: 'Edits and revisions must be explicitly tracked with audit histories. Baseline figures remain preserved and traceable.',
    },
    {
      rule: 'Immutable Audit Trail & Archive Safeguards',
      desc: 'Deleted records are safely moved to the Soft-Deleted Archive with restore capabilities, and all operations are stamped in the permanent Audit Log.',
    },
  ];

  const faqs = [
    {
      q: 'How do I handle a project whose costs are shared between PACL and PGIL?',
      a: 'Navigate to "Shared Projects Co-Funding" from the sidebar. When creating or editing the project, enter the Total Budget and specify the split percentage (e.g. 60% PACL / 40% PGIL). The system automatically allocates the funds to each entity and verifies that the sum of the two shares matches the total budget.',
    },
    {
      q: 'How does the system calculate 16% VAT on LPOs and Invoices?',
      a: 'When creating an LPO or logging an invoice, input the Net Base Amount. The system automatically computes 16% VAT and calculates the Gross Total. You can also manually adjust the VAT amount if exempt or non-taxable services apply.',
    },
    {
      q: 'Why does an LPO show "Committed" status instead of "Actual Spend"?',
      a: 'An approved LPO represents an encumbrance or commitment of funds. It reduces the "Available Balance" to prevent overspending. Once the vendor invoice is received and settled via "Payment Requests", the committed amount converts into "Actual Spend".',
    },
    {
      q: 'How do I generate an Executive Management Report for the Board?',
      a: 'Open "Management Executive Report" from the sidebar. You will see high-level KPI cards, PACL vs PGIL comparative tables, and top 5 project rankings. Click "Export Executive PDF" or "Export Excel" for immediate presentation-ready downloads.',
    },
    {
      q: 'What should I do if the Data Diagnostics center shows a Warning or Failed Check?',
      a: 'Navigate to "System Diagnostics & Health". Review the diagnostic finding details (e.g. an unbalanced shared project or duplicate invoice number). Click the direct link to the affected record, update the allocation or numbers, and click "Re-Run Diagnostics" to verify.',
    },
    {
      q: 'Can I restore an accidentally deleted budget or LPO?',
      a: 'Yes! Navigate to "Archive & Data Recovery". Locate the deleted item and click "Restore". The system will immediately reinstate the record into active ledgers without data loss.',
    },
  ];

  const filteredStages = lifecycleStages.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.steps.some((step) => step.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header Banner */}
      <div className="card card-erp p-4 bg-dark text-white border-0 shadow-sm">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <div className="bg-danger text-white p-3 rounded-3 d-flex align-items-center justify-content-center shadow-sm">
              <i className="bi bi-book-half" style={{ fontSize: '2rem' }}></i>
            </div>
            <div>
              <h3 className="h5 fw-bold mb-1" style={{ fontFamily: 'Tahoma, sans-serif' }}>
                Pioneer Marketing & CX Budget Platform: Enterprise Operating Manual
              </h3>
              <p className="text-white-50 fs-7 mb-0">
                Comprehensive step-by-step operating procedures, legal entity separation guidelines, and governance controls.
              </p>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-light btn-sm d-flex align-items-center gap-1.5 shadow-sm"
              onClick={() => window.print()}
            >
              <i className="bi bi-printer"></i>
              <span>Print Complete Manual</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="d-flex flex-wrap gap-2 border-bottom pb-2">
        <button
          type="button"
          className={`btn btn-sm ${activeSection === 'journey' ? 'btn-danger text-white' : 'btn-light border'}`}
          onClick={() => setActiveSection('journey')}
        >
          <i className="bi bi-diagram-3 me-1"></i> Full Operating Lifecycle
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeSection === 'steps' ? 'btn-danger text-white' : 'btn-light border'}`}
          onClick={() => setActiveSection('steps')}
        >
          <i className="bi bi-list-ol me-1"></i> Step-by-Step Module Guides
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeSection === 'roles' ? 'btn-danger text-white' : 'btn-light border'}`}
          onClick={() => setActiveSection('roles')}
        >
          <i className="bi bi-people me-1"></i> Role Responsibilities & RBAC
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeSection === 'rules' ? 'btn-danger text-white' : 'btn-light border'}`}
          onClick={() => setActiveSection('rules')}
        >
          <i className="bi bi-shield-check me-1"></i> Financial Policies & Controls
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeSection === 'faq' ? 'btn-danger text-white' : 'btn-light border'}`}
          onClick={() => setActiveSection('faq')}
        >
          <i className="bi bi-question-circle me-1"></i> FAQs & Troubleshooting
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeSection === 'architecture' ? 'btn-danger text-white' : 'btn-light border'}`}
          onClick={() => setActiveSection('architecture')}
        >
          <i className="bi bi-code-square me-1"></i> System Architecture & Integrations
        </button>
      </div>

      {/* ================= SECTION 1: VISUAL JOURNEY FLOWCHART ================= */}
      {activeSection === 'journey' && (
        <div className="d-flex flex-column gap-4">
          <div className="card card-erp p-4 bg-white shadow-sm">
            <h5 className="h6 fw-bold mb-2 d-flex align-items-center gap-2 text-dark">
              <i className="bi bi-arrow-right-circle text-danger"></i>
              The 8-Stage Marketing & CX Financial Journey
            </h5>
            <p className="fs-7 text-muted mb-4">
              From annual budget planning and PACL/PGIL co-funding to procurement, 3-way matching, payment disbursement, and executive management reporting.
            </p>

            {/* Visual Process Stepper */}
            <div className="row g-3">
              {lifecycleStages.map((stage) => (
                <div key={stage.step} className="col-12 col-md-6 col-lg-3">
                  <div className="card h-100 p-3 border rounded-3 position-relative bg-light shadow-sm">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="badge bg-danger text-white rounded-pill px-2.5 py-1 fs-8">
                        Step {stage.step}
                      </span>
                      <i className={`bi ${stage.icon} fs-5 text-danger`}></i>
                    </div>
                    <h6 className="fw-bold fs-7 text-dark mb-1">{stage.title}</h6>
                    <div className="text-muted fs-8 mb-2 font-mono">Module: {stage.view}</div>
                    <p className="fs-7 text-secondary mb-3" style={{ minHeight: '52px' }}>
                      {stage.summary}
                    </p>
                    <div className="mt-auto pt-2 border-top">
                      <span className="badge bg-white text-dark border fs-8">
                        {stage.badge}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Summary Callout */}
            <div className="mt-4 p-3 bg-light rounded-3 border-start border-4 border-danger">
              <h6 className="fw-bold fs-7 mb-1 text-dark">Pioneer Insurance Financial Governance Golden Rule</h6>
              <p className="fs-7 text-muted mb-0">
                <strong>Plan First, Commit via LPO, Match with Invoices, Authorize with Receipts:</strong> All expenditures require prior approved budget lines, clear PACL/PGIL legal entity assignment, 16% VAT itemization, and verified 3-way matching before fund release.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION 2: STEP-BY-STEP DETAILED STAGES ================= */}
      {activeSection === 'steps' && (
        <div className="d-flex flex-column gap-3">
          {/* Search bar inside steps */}
          <div className="card card-erp p-3 bg-white shadow-sm">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control bg-light border-start-0"
                placeholder="Search instructions, views, or policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setSearchQuery('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {filteredStages.map((stage) => (
            <div key={stage.step} className="card card-erp p-4 bg-white border shadow-sm">
              <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 border-bottom pb-3 mb-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="badge bg-danger text-white rounded-circle p-2.5 fs-6 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                    {stage.step}
                  </div>
                  <div>
                    <span className="text-uppercase tracking-wider fs-8 text-muted fw-bold d-block">
                      {stage.phase}
                    </span>
                    <h5 className="h6 fw-bold mb-0 text-dark">{stage.title}</h5>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-light text-dark border fs-7">
                    <i className="bi bi-window me-1"></i> {stage.view}
                  </span>
                  <span className="badge bg-danger-subtle text-danger border border-danger fs-7">
                    {stage.badge}
                  </span>
                </div>
              </div>

              <p className="fs-7 text-secondary mb-3">{stage.summary}</p>

              <h6 className="fs-7 fw-bold text-dark mb-2">Step-by-Step Operating Instructions:</h6>
              <ol className="fs-7 text-dark mb-3 ps-3 d-flex flex-column gap-1.5">
                {stage.steps.map((stepText, idx) => (
                  <li key={idx} className="ps-1">
                    {stepText}
                  </li>
                ))}
              </ol>

              <div className="p-2.5 bg-light rounded text-muted fs-7 d-flex align-items-center gap-2">
                <i className="bi bi-lightbulb-fill text-warning fs-6"></i>
                <span>{stage.tip}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= SECTION 3: ROLE RESPONSIBILITIES ================= */}
      {activeSection === 'roles' && (
        <div className="row g-3">
          {roleMatrices.map((rm) => (
            <div key={rm.role} className="col-12 col-md-6">
              <div className="card card-erp p-4 h-100 bg-white border shadow-sm">
                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                  <h5 className="h6 fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-person-badge text-danger"></i>
                    {rm.role}
                  </h5>
                  <span className={`badge bg-${rm.color} text-white`}>{rm.role}</span>
                </div>
                <p className="fs-7 text-muted mb-3">{rm.description}</p>
                <h6 className="fs-7 fw-bold text-dark mb-2">Key Permissions & Responsibilities:</h6>
                <ul className="fs-7 text-secondary mb-0 ps-3 d-flex flex-column gap-1">
                  {rm.responsibilities.map((resp, idx) => (
                    <li key={idx}>{resp}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= SECTION 4: POLICIES & CONTROLS ================= */}
      {activeSection === 'rules' && (
        <div className="card card-erp p-4 bg-white border shadow-sm">
          <h5 className="h6 fw-bold mb-3 d-flex align-items-center gap-2 text-dark">
            <i className="bi bi-shield-check text-success"></i> Corporate Governance, Tax Compliance & Financial Controls
          </h5>
          <p className="fs-7 text-muted mb-4">
            The Pioneer Marketing & CX budget workspace strictly enforces accounting principles and KRA tax standards.
          </p>

          <div className="d-flex flex-column gap-3">
            {quickRules.map((rule, idx) => (
              <div key={idx} className="p-3 bg-light rounded-3 border">
                <h6 className="fw-bold fs-7 text-dark mb-1 d-flex align-items-center gap-2">
                  <i className="bi bi-check-circle-fill text-danger"></i>
                  {rule.rule}
                </h6>
                <p className="fs-7 text-secondary mb-0 ps-4">{rule.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= SECTION 5: FAQs & TROUBLESHOOTING ================= */}
      {activeSection === 'faq' && (
        <div className="card card-erp p-4 bg-white border shadow-sm">
          <h5 className="h6 fw-bold mb-3 d-flex align-items-center gap-2 text-dark">
            <i className="bi bi-patch-question text-danger"></i> Frequently Asked Questions & Troubleshooting
          </h5>
          <div className="accordion d-flex flex-column gap-3" id="faqAccordion">
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-3 border rounded-3 bg-light">
                <h6 className="fw-bold fs-7 text-dark mb-2 d-flex align-items-center gap-2">
                  <i className="bi bi-question-circle-fill text-danger"></i>
                  {faq.q}
                </h6>
                <p className="fs-7 text-secondary mb-0 ps-4">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= SECTION 6: DEVELOPER & ARCHITECTURE ================= */}
      {activeSection === 'architecture' && (
        <div className="d-flex flex-column gap-3">
          <div className="card card-erp p-4 bg-dark text-white border-0 shadow-sm">
            <h5 className="h6 fw-bold mb-2">System Data Architecture & Integration Layer</h5>
            <p className="text-white-50 fs-7 mb-0">
              The platform utilizes a reactive single-page architecture backed by <code>DatabaseService</code> in <code>/src/services/db.ts</code> with live multi-tab synchronization and offline data persistence.
            </p>
          </div>

          <div className="row g-3">
            <div className="col-12 col-md-6">
              <div className="card card-erp p-4 h-100 bg-white border shadow-sm">
                <h6 className="fw-bold fs-7 mb-2 text-dark">Core Data Models</h6>
                <ul className="fs-7 text-secondary ps-3 mb-0">
                  <li><strong>AnnualBudgetRecord</strong>: code, financialYear, legalEntity (PACL/PGIL), allocatedAmount, revisedAmount, revisions[]</li>
                  <li><strong>ProjectRecord</strong>: code, name, projectType (Shared/Standalone), paclAllocation, pgilAllocation, actualSpend</li>
                  <li><strong>LPORecord</strong>: lpoNumber, legalEntity, baseAmount, vatAmount (16%), totalLpoAmount, status</li>
                  <li><strong>InvoiceRecord</strong>: invoiceNumber, supplierName, lpoNumber, totalAmount, paymentStatus</li>
                  <li><strong>PaymentRequestRecord</strong>: requestNumber, invoiceNumber, requestedAmount, priority, status</li>
                </ul>
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div className="card card-erp p-4 h-100 bg-white border shadow-sm">
                <h6 className="fw-bold fs-7 mb-2 text-dark">7-Point Diagnostics Audit Checks</h6>
                <div className="bg-light p-3 rounded font-mono fs-8 text-dark">
                  <div>1. Shared Project Co-Funding Balance (PACL + PGIL = Total)</div>
                  <div>2. Project Overspend Violations (Actual &gt; Budget)</div>
                  <div>3. Budget Line Item Ceiling Limits</div>
                  <div>4. Procurement Duplicates (LPOs &amp; Invoices)</div>
                  <div>5. Unallocated &amp; Orphaned Expenditure Postings</div>
                  <div>6. Zero-Budget Active Strategic Initiatives</div>
                  <div>7. Legal Entity Assignment Compliance (PACL vs PGIL)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

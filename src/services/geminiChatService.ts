import { DatabaseService } from './db';
import { LegalEntityFilter } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
  contextAttached?: boolean;
}

export type ChatbotRole = 'financial_controller' | 'procurement_specialist' | 'cx_strategist' | 'erp_guide';

export interface ChatbotRoleDefinition {
  id: ChatbotRole;
  name: string;
  title: string;
  avatarIcon: string;
  badgeColor: string;
  description: string;
  systemInstruction: string;
  suggestedPrompts: string[];
}

export const CHATBOT_ROLES: Record<ChatbotRole, ChatbotRoleDefinition> = {
  financial_controller: {
    id: 'financial_controller',
    name: 'Financial Controller',
    title: 'Corporate Financial Controller & Auditor',
    avatarIcon: 'bi-bank',
    badgeColor: 'primary',
    description: 'Expert in PACL vs PGIL budget allocations, expenditure ceilings, burn rates, variance analysis, and KRA/tax compliance.',
    systemInstruction: `You are the Senior Corporate Financial Controller and Enterprise Budget Auditor for Pioneer Assurance Company Limited (PACL) and Pioneer General Insurance Limited (PGIL).
Your responsibility is to ensure strict budget discipline, monitor variance, prevent unauthorized cost overruns, verify legal entity allocation splits (e.g. 57% PACL / 43% PGIL for shared initiatives), and ensure KRA tax/VAT compliance.
Always calculate with precision in Kenyan Shillings (KES), reference specific figures from the provided real-time data, and give concrete, actionable financial recommendations.`,
    suggestedPrompts: [
      'Analyze the current PACL vs PGIL expenditure ratio and variance.',
      'Which budget categories or projects are at risk of exceeding 90% utilization?',
      'Review current monthly burn rate and forecast year-end variance.',
      'Explain the financial impact of current pending payment requests.',
    ],
  },
  procurement_specialist: {
    id: 'procurement_specialist',
    name: 'Procurement Lead',
    title: 'Procurement & LPO Specialist',
    avatarIcon: 'bi-cart-check',
    badgeColor: 'success',
    description: 'Guides Local Purchase Orders (LPOs), supplier vetting, competitive quotations (3-quote policy), and invoice matching.',
    systemInstruction: `You are the Lead Procurement and Supply Chain Specialist for the Pioneer Group (PACL & PGIL).
Your role is to enforce corporate procurement policies including competitive bidding (3-quotation rule), verification of approved vendor lists, 3-way matching (Quotation -> LPO -> Supplier Invoice -> Payment Voucher), and timely milestone fulfillment.
Provide structured, step-by-step guidance on procurement workflows, identify missing documentation, and recommend supplier management best practices.`,
    suggestedPrompts: [
      'Check if there are any unfulfilled or pending LPOs requiring action.',
      'Summarize top suppliers by paid amount and active commitments.',
      'What are the mandatory compliance steps before approving a Payment Request?',
      'How does the 3-way matching process work between LPOs and Invoices?',
    ],
  },
  cx_strategist: {
    id: 'cx_strategist',
    name: 'Marketing & CX Advisor',
    title: 'Marketing & Customer Experience Strategist',
    avatarIcon: 'bi-megaphone',
    badgeColor: 'info',
    description: 'Advises on departmental campaign performance, CSAT & Net Promoter investments, and brand marketing ROI.',
    systemInstruction: `You are the Executive Marketing & Customer Experience (CX) Strategic Advisor for Pioneer Assurance and Pioneer General Insurance.
You help the Marketing & CX department maximize the strategic impact of their promotional budgets, customer satisfaction (CSAT) engines, digital revamps, and brand equity campaigns.
Offer strategic advice balancing creative impact with return on investment (ROI), customer retention, and brand differentiation in Kenya's insurance landscape.`,
    suggestedPrompts: [
      'Evaluate our investment allocation in Customer Experience (CSAT) vs Brand Advertising.',
      'What KPIs should we measure for the Omnichannel CSAT Automation project?',
      'Suggest budget optimization strategies for upcoming Q3/Q4 marketing campaigns.',
      'How can we demonstrate measurable ROI on our digital media spend?',
    ],
  },
  erp_guide: {
    id: 'erp_guide',
    name: 'ERP Navigator',
    title: 'ERP Operations & Systems Guide',
    avatarIcon: 'bi-compass',
    badgeColor: 'secondary',
    description: 'Answers operational questions on system features, physical backups, Excel imports, and transaction drill-down.',
    systemInstruction: `You are the Enterprise ERP Operations Specialist and Systems Navigator for the Corporate Budget Management System.
You provide clear, friendly, and practical guidance on using all modules: Transaction Drill-Down & Traceability, Monthly Trend & Burn Rate, Physical PC Backups, Systems Diagnostics, and Audit Trail.
Explain procedures step-by-step, referencing the exact buttons, filters, and reports available.`,
    suggestedPrompts: [
      'How do I perform a physical disaster-recovery backup to my PC?',
      'Where can I trace an invoice back to its original Quotation and LPO?',
      'How do I run a system health diagnosis to find unattached transactions?',
      'Explain how the Excel Import validation rules work.',
    ],
  },
};

export interface ChatModelOption {
  id: string;
  modelId: string;
  thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH';
  name: string;
  badge: string;
  description: string;
  badgeClass: string;
}

export const CHAT_MODELS: ChatModelOption[] = [
  {
    id: 'gemini-4-hydrogen',
    modelId: 'gemini-4-hydrogen',
    thinkingLevel: 'MEDIUM',
    name: 'Gemini 4 Hydrogen',
    badge: 'Recommended',
    description: 'Balanced Gemini 4 model for enterprise financial reasoning and multi-turn guidance.',
    badgeClass: 'bg-primary text-white',
  },
  {
    id: 'gemini-4-hydrogen-deep',
    modelId: 'gemini-4-hydrogen',
    thinkingLevel: 'HIGH',
    name: 'Gemini 4 Hydrogen (Deep Audit)',
    badge: 'Deep Reasoning',
    description: 'High reasoning depth on Gemini 4 Hydrogen for complex variance audits and policy checks.',
    badgeClass: 'bg-dark text-white',
  },
  {
    id: 'gemini-3.1-flash-lite',
    modelId: 'gemini-3.1-flash-lite',
    thinkingLevel: 'LOW',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Fast',
    description: 'Lowest latency for quick answers and brief ledger lookups.',
    badgeClass: 'bg-success text-white',
  },
];

export class GeminiChatService {
  /**
   * Generates a context payload summarizing current live enterprise data.
   */
  static getLiveSystemContext(activeTab: string, entityFilter: LegalEntityFilter): any {
    try {
      const summary = DatabaseService.getFinancialSummary(entityFilter);
      const budgets = DatabaseService.getBudgets();
      const expenditures = DatabaseService.getExpenditures();
      const lpos = DatabaseService.getLPOs();
      const invoices = DatabaseService.getInvoices();
      const paymentRequests = DatabaseService.getPaymentRequests();
      const suppliers = DatabaseService.getSuppliers();
      const settings = DatabaseService.getSettings();

      // Filtered data count
      const entityFilteredBudgets = entityFilter === 'All' 
        ? budgets 
        : budgets.filter(b => b.legalEntity === entityFilter || b.legalEntity === 'Shared');
      
      const entityFilteredExpenses = entityFilter === 'All'
        ? expenditures
        : expenditures.filter(e => e.legalEntity === entityFilter);

      // Identify high risk budgets (>85% utilization)
      const highUtilizationBudgets = entityFilteredBudgets
        .filter(b => (b.utilizationPercent || 0) >= 85)
        .map(b => ({
          code: b.code,
          category: b.category,
          entity: b.legalEntity,
          allocated: b.allocatedAmount,
          spent: b.actualExpenditure || 0,
          utilization: `${(b.utilizationPercent || 0).toFixed(1)}%`,
        }));

      // Pending procurement counts
      const pendingLPOs = lpos.filter(
        l =>
          ['Pending Approval', 'Issued', 'Approved'].includes(l.lpoStatus || l.status || '') &&
          l.paymentStatus !== 'Paid' &&
          l.paymentStatus !== 'Fully Paid'
      );
      const pendingInvoices = invoices.filter(i => i.paymentStatus === 'Pending' || i.paymentStatus === 'Submitted');
      const pendingPayments = paymentRequests.filter(p => p.status === 'Submitted' || p.status === 'Finance Review');

      return {
        activeTab,
        legalEntity: entityFilter,
        financialYear: settings.financialYear || '2026',
        departmentName: settings.departmentName || 'Marketing & Customer Experience',
        metricsSummary: {
          totalBudget: `KES ${(summary.totalBudget || 0).toLocaleString()}`,
          totalSpend: `KES ${(summary.totalSpend || 0).toLocaleString()}`,
          committedSpend: `KES ${(summary.committedSpend || 0).toLocaleString()}`,
          remainingBalance: `KES ${(summary.remainingBalance || 0).toLocaleString()}`,
          overallUtilization: `${(summary.overallUtilization || 0).toFixed(1)}%`,
          paclBudget: `KES ${(summary.paclBudget || 0).toLocaleString()}`,
          paclSpend: `KES ${(summary.paclSpend || 0).toLocaleString()}`,
          pgilBudget: `KES ${(summary.pgilBudget || 0).toLocaleString()}`,
          pgilSpend: `KES ${(summary.pgilSpend || 0).toLocaleString()}`,
        },
        relevantEntities: {
          totalBudgetLines: entityFilteredBudgets.length,
          totalExpenseRecords: entityFilteredExpenses.length,
          totalSuppliers: suppliers.length,
          highRiskBudgetsCount: highUtilizationBudgets.length,
          highRiskBudgetsSample: highUtilizationBudgets.slice(0, 4),
          pendingLPOsCount: pendingLPOs.length,
          pendingInvoicesCount: pendingInvoices.length,
          pendingPaymentsCount: pendingPayments.length,
        },
      };
    } catch (e) {
      console.warn('Failed to build real-time system context for Gemini:', e);
      return {
        activeTab,
        legalEntity: entityFilter,
        note: 'Basic context attached',
      };
    }
  }

  /**
   * Sends multi-turn conversation to the server-side Gemini endpoint.
   */
  static async sendChatMessage(params: {
    messages: { role: 'user' | 'model'; text: string }[];
    role: ChatbotRole;
    model: string;
    includeContext: boolean;
    activeTab: string;
    entityFilter: LegalEntityFilter;
  }): Promise<{ reply: string; modelUsed: string }> {
    const roleDef = CHATBOT_ROLES[params.role] || CHATBOT_ROLES.financial_controller;
    const modelOption = CHAT_MODELS.find(m => m.id === params.model) || CHAT_MODELS[0];
    
    let contextData = null;
    if (params.includeContext) {
      contextData = this.getLiveSystemContext(params.activeTab, params.entityFilter);
    }

    const payload = {
      messages: params.messages,
      systemInstruction: roleDef.systemInstruction,
      model: modelOption.modelId,
      thinkingLevel: modelOption.thinkingLevel,
      contextData,
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || errorJson.details || `Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return {
      reply: data.reply || 'No response generated.',
      modelUsed: data.model || modelOption.modelId,
    };
  }
}

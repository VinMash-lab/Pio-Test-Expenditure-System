import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SystemSettings } from '../types';

export class PDFService {
  /**
   * Generates a corporate PDF report
   */
  static generateReportPDF(
    title: string,
    subtitle: string,
    columns: string[],
    tableRows: (string | number)[][],
    settings: SystemSettings,
    summaryCards?: { label: string; value: string }[]
  ): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Colors
    const primaryRed = '#FF0000';
    const darkHeader = '#111827';

    // Header Background
    doc.setFillColor(255, 0, 0); // Red Accent
    doc.rect(0, 0, 297, 12, 'F');

    // Title & Company Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(darkHeader);
    doc.text((settings.companyName || 'Pioneer Assurance Company Limited').toUpperCase(), 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${settings.address || ''} | KRA PIN: ${settings.kraPin || ''} | Tel: ${settings.phone || ''}`, 14, 27);

    // Report Title Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(185, 28, 28); // Primary red tone
    doc.text(title.toUpperCase(), 14, 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Financial Year: ${settings.financialYear || '2026'} | Subtitle: ${subtitle} | Generated: ${new Date().toLocaleString()}`, 14, 41);

    let startY = 46;

    // Optional Summary KPI cards row
    if (summaryCards && summaryCards.length > 0) {
      const cardWidth = 50;
      summaryCards.forEach((card, idx) => {
        const x = 14 + idx * (cardWidth + 8);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, startY, cardWidth, 14, 2, 2, 'FD');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(card.label.toUpperCase(), x + 4, startY + 5);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(card.value, x + 4, startY + 11);
      });
      startY += 20;
    }

    // Auto Table Generation
    autoTable(doc, {
      startY: startY,
      head: [columns],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [220, 38, 38], // Corporate primary red
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 14, right: 14 },
    });

    // Signature Footer & Page Numbers
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);

      // Footer line
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 198, 283, 198);

      doc.text(`Pioneer Group ERP - Corporate Budget Management System | Confidential`, 14, 203);
      doc.text(`Page ${i} of ${totalPages}`, 260, 203);
    }

    // Save
    doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}_Report.pdf`);
  }
}

/**
 * Quotation PDF Generation Service (Day 8 Backend)
 * Generates professional PDF quotations loaded directly from SQLite database records.
 * Uses pdfkit streaming into an in-memory buffer.
 */

const PDFDocument = require("pdfkit");
const quotationStore = require("./quotationStore");
const { get } = require("../database/db");

/**
 * Generates a PDF buffer for a given quotation, strictly validated against the user's organizationId.
 * @param {string} quotationId - ID or quote_number of the quotation
 * @param {string} organizationId - Tenant organization context
 * @returns {Promise<{ buffer: Buffer, quotation: Object, filename: string } | null>}
 */
const generateQuotationPdf = async (quotationId, organizationId) => {
  if (!quotationId || !organizationId) {
    throw new Error("Quotation ID and organization ID are required.");
  }

  // 1. Direct SQLite fetch with strict tenant isolation
  const quotation = await quotationStore.getById(quotationId, organizationId);
  if (!quotation) {
    return null;
  }

  // 2. Fetch organization branding name
  const org = await get("SELECT name FROM organizations WHERE id = ?", [organizationId]);
  const organizationName = org ? org.name : "CRM & Sales Management System";

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
        info: {
          Title: `Quotation ${quotation.quoteNumber}`,
          Author: organizationName,
          Subject: "Quotation Document"
        }
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          buffer,
          quotation,
          filename: `quotation-${quotation.quoteNumber}.pdf`
        });
      });
      doc.on("error", (err) => reject(err));

      // --- PDF DESIGN & CONTENT ---

      // Header Bar
      doc.rect(50, 45, 495, 4).fill("#4f46e5"); // Indigo top accent

      // Company / Org Name & Title
      doc.moveDown(0.8);
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .fillColor("#1e293b")
        .text(organizationName, 50, 60);

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#64748b")
        .text("Sales & Quotation Management", 50, 85);

      // Document Title & Number (Right Aligned)
      doc
        .fontSize(22)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text("QUOTATION", 350, 60, { align: "right" });

      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#4f46e5")
        .text(quotation.quoteNumber, 350, 85, { align: "right" });

      // Horizontal Divider
      doc
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .moveTo(50, 110)
        .lineTo(545, 110)
        .stroke();

      // Quotation Metadata & Customer Details
      const metaY = 125;

      // Left Column: Customer Information
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("PREPARED FOR:", 50, metaY);

      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text(quotation.customerName || "Valued Client", 50, metaY + 16);

      let clientDetailsY = metaY + 32;
      doc.fontSize(9).font("Helvetica").fillColor("#334155");

      if (quotation.customerCompany) {
        doc.text(quotation.customerCompany, 50, clientDetailsY);
        clientDetailsY += 13;
      }
      if (quotation.customerEmail) {
        doc.text(`Email: ${quotation.customerEmail}`, 50, clientDetailsY);
        clientDetailsY += 13;
      }
      if (quotation.customerPhone) {
        doc.text(`Phone: ${quotation.customerPhone}`, 50, clientDetailsY);
        clientDetailsY += 13;
      }
      if (quotation.customerAddress) {
        doc.text(`Address: ${quotation.customerAddress}`, 50, clientDetailsY);
        clientDetailsY += 13;
      }

      // Right Column: Quote Meta (Dates & Status)
      const rightX = 350;
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#64748b")
        .text("Issue Date:", rightX, metaY, { width: 90 })
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text(quotation.issueDate, rightX + 80, metaY, { align: "right", width: 115 });

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#64748b")
        .text("Valid Until:", rightX, metaY + 16, { width: 90 })
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text(quotation.validUntil, rightX + 80, metaY + 16, { align: "right", width: 115 });

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#64748b")
        .text("Status:", rightX, metaY + 32, { width: 90 })
        .font("Helvetica-Bold")
        .fillColor(
          quotation.status === "Accepted"
            ? "#059669"
            : quotation.status === "Declined"
            ? "#e11d48"
            : "#2563eb"
        )
        .text(quotation.status.toUpperCase(), rightX + 80, metaY + 32, { align: "right", width: 115 });

      // Line Items Table
      const tableTop = Math.max(clientDetailsY + 15, 210);

      // Table Header Background
      doc
        .rect(50, tableTop, 495, 22)
        .fill("#f8fafc");

      doc
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .rect(50, tableTop, 495, 22)
        .stroke();

      // Table Header Titles
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor("#334155")
        .text("Item & Description", 60, tableTop + 6, { width: 210 })
        .text("Qty", 280, tableTop + 6, { width: 40, align: "right" })
        .text("Unit Price", 330, tableTop + 6, { width: 65, align: "right" })
        .text("Tax", 405, tableTop + 6, { width: 45, align: "right" })
        .text("Total", 460, tableTop + 6, { width: 75, align: "right" });

      let currentY = tableTop + 22;

      // Table Rows
      const items = quotation.items || [];
      if (items.length === 0) {
        doc
          .fontSize(9)
          .font("Helvetica-Oblique")
          .fillColor("#94a3b8")
          .text("No line items listed on this quotation.", 60, currentY + 8);
        currentY += 25;
      } else {
        items.forEach((item, index) => {
          const rowBg = index % 2 === 1 ? "#fafafa" : "#ffffff";
          doc.rect(50, currentY, 495, 22).fill(rowBg);

          doc
            .strokeColor("#f1f5f9")
            .lineWidth(0.5)
            .moveTo(50, currentY + 22)
            .lineTo(545, currentY + 22)
            .stroke();

          doc
            .fontSize(9)
            .font("Helvetica")
            .fillColor("#1e293b")
            .text(item.description, 60, currentY + 6, { width: 210, ellipsis: true })
            .text(String(item.quantity), 280, currentY + 6, { width: 40, align: "right" })
            .text(`₹${Number(item.unitPrice).toFixed(2)}`, 330, currentY + 6, { width: 65, align: "right" })
            .text(`${item.taxRate}%`, 405, currentY + 6, { width: 45, align: "right" })
            .font("Helvetica-Bold")
            .text(`₹${Number(item.lineTotal).toFixed(2)}`, 460, currentY + 6, { width: 75, align: "right" });

          currentY += 22;
        });
      }

      // Financial Summary Block (Right Aligned)
      currentY += 15;
      const summaryX = 330;
      const summaryWidth = 215;

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#475569")
        .text("Subtotal:", summaryX, currentY, { width: 90 })
        .text(`₹${Number(quotation.subtotal).toFixed(2)}`, summaryX + 90, currentY, {
          width: summaryWidth - 90,
          align: "right"
        });

      currentY += 16;
      doc
        .text("Tax Total:", summaryX, currentY, { width: 90 })
        .text(`₹${Number(quotation.taxTotal).toFixed(2)}`, summaryX + 90, currentY, {
          width: summaryWidth - 90,
          align: "right"
        });

      if (Number(quotation.discount) > 0) {
        currentY += 16;
        doc
          .fillColor("#dc2626")
          .text("Discount:", summaryX, currentY, { width: 90 })
          .text(`-₹${Number(quotation.discount).toFixed(2)}`, summaryX + 90, currentY, {
            width: summaryWidth - 90,
            align: "right"
          })
          .fillColor("#475569");
      }

      currentY += 18;
      // Grand Total Highlight Box
      doc
        .rect(summaryX - 10, currentY - 4, summaryWidth + 10, 26)
        .fill("#f1f5f9");

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text("Grand Total:", summaryX, currentY + 3, { width: 90 })
        .text(`₹${Number(quotation.grandTotal).toFixed(2)}`, summaryX + 90, currentY + 3, {
          width: summaryWidth - 90,
          align: "right"
        });

      // Notes Section
      if (quotation.notes && quotation.notes.trim()) {
        const notesY = Math.max(currentY + 40, tableTop + items.length * 22 + 40);
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#334155")
          .text("Notes / Terms:", 50, notesY);

        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#64748b")
          .text(quotation.notes.trim(), 50, notesY + 16, { width: 495 });
      }

      // Footer
      const footerY = 770;
      doc
        .strokeColor("#e2e8f0")
        .lineWidth(0.5)
        .moveTo(50, footerY)
        .lineTo(545, footerY)
        .stroke();

      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#94a3b8")
        .text(
          `Generated automatically by ${organizationName} on ${new Date().toISOString().split("T")[0]} | Valid until ${quotation.validUntil}`,
          50,
          footerY + 8,
          { align: "center", width: 495 }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateQuotationPdf
};

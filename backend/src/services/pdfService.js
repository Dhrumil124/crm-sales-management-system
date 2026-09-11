/**
 * Quotation PDF Generation Service (Day 8 Backend)
 * Generates an elegantly styled, professional commercial quotation PDF
 * loaded directly from authoritative SQLite database records.
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

  // 1. Authoritative SQLite fetch with tenant isolation
  const quotation = await quotationStore.getById(quotationId, organizationId);
  if (!quotation) {
    return null;
  }

  // 2. Fetch organization company branding
  const org = await get("SELECT name FROM organizations WHERE id = ?", [organizationId]);
  const organizationName = org ? org.name : "Camel Communication CRM";

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 45,
        size: "A4",
        info: {
          Title: `Commercial Quotation - ${quotation.quoteNumber}`,
          Author: organizationName,
          Subject: `Quotation for ${quotation.customerName || "Valued Client"}`
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

      // Page dimensions
      const pageWidth = 595.28; // A4 width in pt
      const contentWidth = 505.28; // 595.28 - 2 * 45
      const leftX = 45;
      const rightX = leftX + contentWidth;

      // -------------------------------------------------------------
      // TOP BRANDING BANNER
      // -------------------------------------------------------------
      // Deep Indigo top accent banner
      doc.rect(leftX, 40, contentWidth, 5).fill("#4338ca");

      // Company Name & Subtitle
      doc
        .fontSize(22)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text(organizationName, leftX, 58);

      doc
        .fontSize(9.5)
        .font("Helvetica")
        .fillColor("#64748b")
        .text("Enterprise Sales Management & Commercial Quotations", leftX, 86);

      // Document Title Badge
      doc
        .fontSize(22)
        .font("Helvetica-Bold")
        .fillColor("#4338ca")
        .text("QUOTATION", 320, 58, { align: "right", width: 230 });

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#1e293b")
        .text(quotation.quoteNumber, 320, 86, { align: "right", width: 230 });

      // Subtle horizontal divider
      doc
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .moveTo(leftX, 110)
        .lineTo(rightX, 110)
        .stroke();

      // -------------------------------------------------------------
      // CLIENT & QUOTATION METADATA CARDS
      // -------------------------------------------------------------
      const cardY = 122;
      const colWidth = 242;

      // Left Card: Customer Information
      doc
        .roundedRect(leftX, cardY, colWidth, 90, 6)
        .fillAndStroke("#f8fafc", "#e2e8f0");

      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor("#4338ca")
        .text("PREPARED FOR", leftX + 14, cardY + 12);

      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text(quotation.customerName || "Valued Client", leftX + 14, cardY + 26, { width: colWidth - 28 });

      let cY = cardY + 42;
      doc.fontSize(8.5).font("Helvetica").fillColor("#475569");

      if (quotation.customerCompany) {
        doc.text(`Company: ${quotation.customerCompany}`, leftX + 14, cY, { width: colWidth - 28 });
        cY += 12;
      }
      if (quotation.customerEmail) {
        doc.text(`Email: ${quotation.customerEmail}`, leftX + 14, cY, { width: colWidth - 28 });
        cY += 12;
      }
      if (quotation.customerPhone) {
        doc.text(`Phone: ${quotation.customerPhone}`, leftX + 14, cY, { width: colWidth - 28 });
      }

      // Right Card: Quotation Metadata
      const rightCardX = leftX + colWidth + 21;
      doc
        .roundedRect(rightCardX, cardY, colWidth, 90, 6)
        .fillAndStroke("#f8fafc", "#e2e8f0");

      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor("#4338ca")
        .text("QUOTATION DETAILS", rightCardX + 14, cardY + 12);

      const renderMetaLine = (label, value, yPos, valueColor = "#0f172a") => {
        doc
          .fontSize(8.5)
          .font("Helvetica")
          .fillColor("#64748b")
          .text(label, rightCardX + 14, yPos, { width: 90 });
        doc
          .font("Helvetica-Bold")
          .fillColor(valueColor)
          .text(value, rightCardX + 105, yPos, { width: colWidth - 119, align: "right" });
      };

      renderMetaLine("Quote Number:", quotation.quoteNumber, cardY + 28);
      renderMetaLine("Issue Date:", quotation.issueDate, cardY + 42);
      renderMetaLine("Valid Until:", quotation.validUntil, cardY + 56);

      const statusColors = {
        Draft: "#475569",
        Sent: "#2563eb",
        Accepted: "#059669",
        Declined: "#dc2626"
      };
      renderMetaLine(
        "Status:",
        quotation.status.toUpperCase(),
        cardY + 70,
        statusColors[quotation.status] || "#0f172a"
      );

      // -------------------------------------------------------------
      // ITEMIZATION TABLE
      // -------------------------------------------------------------
      const tableTop = 228;
      const tableHeaderHeight = 24;

      // Table Header Dark Container
      doc
        .roundedRect(leftX, tableTop, contentWidth, tableHeaderHeight, 4)
        .fill("#1e293b");

      // Column widths & offsets
      const col = {
        num: { x: leftX + 8, w: 22 },
        desc: { x: leftX + 35, w: 225 },
        qty: { x: leftX + 265, w: 45 },
        price: { x: leftX + 315, w: 65 },
        tax: { x: leftX + 385, w: 45 },
        total: { x: leftX + 435, w: 62 }
      };

      // Table Header Titles
      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor("#ffffff")
        .text("#", col.num.x, tableTop + 7, { width: col.num.w, align: "center" })
        .text("Item & Description", col.desc.x, tableTop + 7, { width: col.desc.w })
        .text("Qty", col.qty.x, tableTop + 7, { width: col.qty.w, align: "right" })
        .text("Unit Price", col.price.x, tableTop + 7, { width: col.price.w, align: "right" })
        .text("Tax %", col.tax.x, tableTop + 7, { width: col.tax.w, align: "right" })
        .text("Amount", col.total.x, tableTop + 7, { width: col.total.w, align: "right" });

      let currentY = tableTop + tableHeaderHeight;
      const items = quotation.items || [];

      if (items.length === 0) {
        doc
          .rect(leftX, currentY, contentWidth, 26)
          .fill("#ffffff")
          .strokeColor("#f1f5f9")
          .stroke();

        doc
          .fontSize(9)
          .font("Helvetica-Oblique")
          .fillColor("#94a3b8")
          .text("No line items listed on this quotation.", leftX + 15, currentY + 8);
        currentY += 26;
      } else {
        items.forEach((item, index) => {
          const rowHeight = 24;
          const isEven = index % 2 === 0;

          // Alternating row background
          doc
            .rect(leftX, currentY, contentWidth, rowHeight)
            .fill(isEven ? "#ffffff" : "#f8fafc");

          // Row divider line
          doc
            .strokeColor("#e2e8f0")
            .lineWidth(0.5)
            .moveTo(leftX, currentY + rowHeight)
            .lineTo(rightX, currentY + rowHeight)
            .stroke();

          // Row contents
          doc
            .fontSize(8.5)
            .font("Helvetica")
            .fillColor("#64748b")
            .text(String(index + 1), col.num.x, currentY + 7, { width: col.num.w, align: "center" });

          doc
            .font("Helvetica-Bold")
            .fillColor("#0f172a")
            .text(item.description, col.desc.x, currentY + 7, { width: col.desc.w, ellipsis: true });

          doc
            .font("Helvetica")
            .fillColor("#334155")
            .text(String(item.quantity), col.qty.x, currentY + 7, { width: col.qty.w, align: "right" })
            .text(`INR ${Number(item.unitPrice).toFixed(2)}`, col.price.x, currentY + 7, { width: col.price.w, align: "right" })
            .text(`${item.taxRate}%`, col.tax.x, currentY + 7, { width: col.tax.w, align: "right" })
            .font("Helvetica-Bold")
            .fillColor("#0f172a")
            .text(`INR ${Number(item.lineTotal).toFixed(2)}`, col.total.x, currentY + 7, { width: col.total.w, align: "right" });

          currentY += rowHeight;
        });
      }

      // Outer table border bottom
      doc
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .moveTo(leftX, currentY)
        .lineTo(rightX, currentY)
        .stroke();

      // -------------------------------------------------------------
      // FINANCIAL SUMMARY & TOTALS
      // -------------------------------------------------------------
      currentY += 16;
      const summaryBoxWidth = 230;
      const summaryBoxX = rightX - summaryBoxWidth;

      const renderSummaryRow = (label, amount, isDeduction = false, isBold = false) => {
        doc
          .fontSize(9)
          .font(isBold ? "Helvetica-Bold" : "Helvetica")
          .fillColor(isDeduction ? "#dc2626" : "#475569")
          .text(label, summaryBoxX, currentY, { width: 100 });

        doc
          .font("Helvetica-Bold")
          .fillColor(isDeduction ? "#dc2626" : "#0f172a")
          .text(
            `${isDeduction ? "-" : ""}INR ${Number(amount).toFixed(2)}`,
            summaryBoxX + 105,
            currentY,
            { width: summaryBoxWidth - 105, align: "right" }
          );

        currentY += 16;
      };

      renderSummaryRow("Subtotal:", quotation.subtotal);
      renderSummaryRow("Estimated Tax:", quotation.taxTotal);

      if (Number(quotation.discount) > 0) {
        renderSummaryRow("Discount Applied:", quotation.discount, true);
      }

      currentY += 4;

      // Grand Total Highlight Container (Indigo Banner)
      doc
        .roundedRect(summaryBoxX - 6, currentY - 4, summaryBoxWidth + 6, 28, 5)
        .fill("#4338ca");

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#ffffff")
        .text("GRAND TOTAL:", summaryBoxX + 6, currentY + 3, { width: 100 });

      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#ffffff")
        .text(`INR ${Number(quotation.grandTotal).toFixed(2)}`, summaryBoxX + 100, currentY + 3, {
          width: summaryBoxWidth - 110,
          align: "right"
        });

      // -------------------------------------------------------------
      // NOTES / TERMS & CONDITIONS SECTION
      // -------------------------------------------------------------
      const notesBoxY = Math.max(currentY + 45, tableTop + items.length * 24 + 65);
      const notesBoxWidth = 320;

      if (quotation.notes && quotation.notes.trim()) {
        doc
          .roundedRect(leftX, notesBoxY, notesBoxWidth, 75, 6)
          .fillAndStroke("#f8fafc", "#e2e8f0");

        doc
          .fontSize(8.5)
          .font("Helvetica-Bold")
          .fillColor("#4338ca")
          .text("NOTES & TERMS OF SERVICE", leftX + 12, notesBoxY + 10);

        doc
          .fontSize(8.5)
          .font("Helvetica")
          .fillColor("#475569")
          .text(quotation.notes.trim(), leftX + 12, notesBoxY + 24, {
            width: notesBoxWidth - 24,
            height: 45,
            ellipsis: true
          });
      }

      // -------------------------------------------------------------
      // FOOTER
      // -------------------------------------------------------------
      const footerY = 760;

      doc
        .strokeColor("#e2e8f0")
        .lineWidth(0.75)
        .moveTo(leftX, footerY)
        .lineTo(rightX, footerY)
        .stroke();

      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#94a3b8")
        .text(
          `This quotation is computer-generated by ${organizationName} on ${new Date().toISOString().split("T")[0]}. Valid through ${quotation.validUntil}.`,
          leftX,
          footerY + 8,
          { align: "center", width: contentWidth }
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

/**
 * Quotation PDF Generation Service (Day 8 Backend)
 * Generates an elegantly styled, professional commercial quotation PDF
 * loaded directly from authoritative SQLite database records.
 * 
 * Features dynamic vertical flow layout to prevent text overlapping on long names,
 * multi-line line items, and full-width notes card placed cleanly underneath grand total.
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
      const contentWidth = 505.28; // 595.28 - 2 * 45
      const leftX = 45;
      const rightX = leftX + contentWidth;

      // -------------------------------------------------------------
      // TOP BRANDING BANNER
      // -------------------------------------------------------------
      // Deep Indigo top accent banner
      doc.rect(leftX, 38, contentWidth, 4).fill("#4338ca");

      // Calculate organization name height to prevent overlap
      const orgNameHeight = doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .heightOfString(organizationName, { width: 280 });

      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text(organizationName, leftX, 52, { width: 280 });

      const subtitleY = 52 + orgNameHeight + 3;
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#64748b")
        .text("Enterprise Sales Management & Commercial Quotations", leftX, subtitleY);

      // Document Title Badge (Right-aligned)
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .fillColor("#4338ca")
        .text("QUOTATION", 330, 52, { align: "right", width: 220 });

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#1e293b")
        .text(quotation.quoteNumber, 330, 76, { align: "right", width: 220 });

      const headerBottomY = Math.max(subtitleY + 18, 98);

      // Subtle horizontal divider
      doc
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .moveTo(leftX, headerBottomY)
        .lineTo(rightX, headerBottomY)
        .stroke();

      // -------------------------------------------------------------
      // CLIENT & QUOTATION METADATA CARDS (DYNAMIC HEIGHT)
      // -------------------------------------------------------------
      const cardY = headerBottomY + 14;
      const colWidth = 242;
      const rightCardX = leftX + colWidth + 21;

      // Clean customer display: avoid duplicated company if already present in name
      const customerDisplayName = quotation.customerName || "Valued Client";

      // Dynamically measure customer name height
      const nameTextHeight = doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .heightOfString(customerDisplayName, { width: colWidth - 28 });

      // Measure total left card height based on present contact fields
      let leftContentHeight = 12 + 14 + nameTextHeight + 6; // header + name + spacing
      const shouldShowCompany =
        quotation.customerCompany &&
        !customerDisplayName.toLowerCase().includes(quotation.customerCompany.toLowerCase());

      if (shouldShowCompany) leftContentHeight += 13;
      if (quotation.customerEmail) leftContentHeight += 13;
      if (quotation.customerPhone) leftContentHeight += 13;
      if (quotation.customerAddress) leftContentHeight += 13;
      leftContentHeight += 12; // bottom margin

      const cardHeight = Math.max(96, Math.ceil(leftContentHeight));

      // Draw Left Card Container
      doc
        .roundedRect(leftX, cardY, colWidth, cardHeight, 6)
        .fillAndStroke("#f8fafc", "#e2e8f0");

      // Draw Right Card Container
      doc
        .roundedRect(rightCardX, cardY, colWidth, cardHeight, 6)
        .fillAndStroke("#f8fafc", "#e2e8f0");

      // Render Left Card Content (Dynamic vertical offset)
      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor("#4338ca")
        .text("PREPARED FOR", leftX + 14, cardY + 12);

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text(customerDisplayName, leftX + 14, cardY + 26, { width: colWidth - 28 });

      // Dynamic cY strictly below customer name
      let cY = cardY + 26 + nameTextHeight + 6;
      doc.fontSize(8.5).font("Helvetica").fillColor("#475569");

      if (shouldShowCompany) {
        doc.text(`Company: ${quotation.customerCompany}`, leftX + 14, cY, { width: colWidth - 28 });
        cY += 13;
      }
      if (quotation.customerEmail) {
        doc.text(`Email: ${quotation.customerEmail}`, leftX + 14, cY, { width: colWidth - 28 });
        cY += 13;
      }
      if (quotation.customerPhone) {
        doc.text(`Phone: ${quotation.customerPhone}`, leftX + 14, cY, { width: colWidth - 28 });
        cY += 13;
      }
      if (quotation.customerAddress) {
        doc.text(`Address: ${quotation.customerAddress}`, leftX + 14, cY, { width: colWidth - 28 });
      }

      // Render Right Card Content (Quotation Metadata)
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
      renderMetaLine("Issue Date:", quotation.issueDate, cardY + 44);
      renderMetaLine("Valid Until:", quotation.validUntil, cardY + 60);

      const statusColors = {
        Draft: "#475569",
        Sent: "#2563eb",
        Accepted: "#059669",
        Declined: "#dc2626"
      };
      renderMetaLine(
        "Status:",
        quotation.status.toUpperCase(),
        cardY + 76,
        statusColors[quotation.status] || "#0f172a"
      );

      // -------------------------------------------------------------
      // ITEMIZATION TABLE (DYNAMIC ROW HEIGHTS)
      // -------------------------------------------------------------
      const tableTop = cardY + cardHeight + 16;
      const tableHeaderHeight = 22;

      // Table Header Dark Container
      doc
        .roundedRect(leftX, tableTop, contentWidth, tableHeaderHeight, 4)
        .fill("#1e293b");

      // Column widths & horizontal offsets
      const col = {
        num: { x: leftX + 6, w: 22 },
        desc: { x: leftX + 32, w: 228 },
        qty: { x: leftX + 265, w: 45 },
        price: { x: leftX + 315, w: 65 },
        tax: { x: leftX + 385, w: 45 },
        total: { x: leftX + 435, w: 64 }
      };

      // Table Header Titles
      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor("#ffffff")
        .text("#", col.num.x, tableTop + 6, { width: col.num.w, align: "center" })
        .text("Item & Description", col.desc.x, tableTop + 6, { width: col.desc.w })
        .text("Qty", col.qty.x, tableTop + 6, { width: col.qty.w, align: "right" })
        .text("Unit Price", col.price.x, tableTop + 6, { width: col.price.w, align: "right" })
        .text("Tax %", col.tax.x, tableTop + 6, { width: col.tax.w, align: "right" })
        .text("Amount", col.total.x, tableTop + 6, { width: col.total.w, align: "right" });

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
          // Dynamically calculate description height to prevent row overlap on long items
          const descHeight = doc
            .fontSize(8.5)
            .font("Helvetica-Bold")
            .heightOfString(item.description, { width: col.desc.w });

          const rowHeight = Math.max(22, Math.ceil(descHeight + 10));
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

          // Row text
          const textY = currentY + 5;

          doc
            .fontSize(8.5)
            .font("Helvetica")
            .fillColor("#64748b")
            .text(String(index + 1), col.num.x, textY, { width: col.num.w, align: "center" });

          doc
            .font("Helvetica-Bold")
            .fillColor("#0f172a")
            .text(item.description, col.desc.x, textY, { width: col.desc.w });

          doc
            .font("Helvetica")
            .fillColor("#334155")
            .text(String(item.quantity), col.qty.x, textY, { width: col.qty.w, align: "right" })
            .text(`INR ${Number(item.unitPrice).toFixed(2)}`, col.price.x, textY, { width: col.price.w, align: "right" })
            .text(`${item.taxRate}%`, col.tax.x, textY, { width: col.tax.w, align: "right" })
            .font("Helvetica-Bold")
            .fillColor("#0f172a")
            .text(`INR ${Number(item.lineTotal).toFixed(2)}`, col.total.x, textY, { width: col.total.w, align: "right" });

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
      // FINANCIAL SUMMARY & GRAND TOTAL (RIGHT-ALIGNED BLOCK)
      // -------------------------------------------------------------
      currentY += 14;
      const summaryBoxWidth = 235;
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
      const grandTotalHeight = 28;
      doc
        .roundedRect(summaryBoxX - 6, currentY - 4, summaryBoxWidth + 6, grandTotalHeight, 5)
        .fill("#4338ca");

      doc
        .fontSize(10.5)
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

      currentY += grandTotalHeight + 4;

      // -------------------------------------------------------------
      // NOTES / TERMS & CONDITIONS (PLACED UNDERNEATH GRAND TOTAL)
      // Spans the full content width for clean alignment and readability
      // -------------------------------------------------------------
      if (quotation.notes && quotation.notes.trim()) {
        const notesBoxY = currentY + 20;
        const notesBoxWidth = contentWidth;

        const notesContentHeight = doc
          .fontSize(8.5)
          .font("Helvetica")
          .heightOfString(quotation.notes.trim(), { width: notesBoxWidth - 28 });

        const notesBoxHeight = Math.max(48, Math.ceil(notesContentHeight + 28));

        doc
          .roundedRect(leftX, notesBoxY, notesBoxWidth, notesBoxHeight, 6)
          .fillAndStroke("#f8fafc", "#e2e8f0");

        doc
          .fontSize(8.5)
          .font("Helvetica-Bold")
          .fillColor("#4338ca")
          .text("NOTES & TERMS OF SERVICE", leftX + 14, notesBoxY + 10);

        doc
          .fontSize(8.5)
          .font("Helvetica")
          .fillColor("#475569")
          .text(quotation.notes.trim(), leftX + 14, notesBoxY + 24, {
            width: notesBoxWidth - 28
          });

        currentY = notesBoxY + notesBoxHeight;
      }

      // -------------------------------------------------------------
      // FOOTER
      // -------------------------------------------------------------
      const footerY = 765;

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

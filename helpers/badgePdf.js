const { buildBadgeValidityText, getVisitingDateCount } = require("./badgeDate");

const renderVisitorBadgePdf = ({
  doc,
  bgPath,
  qrPath,
  pdfData,
  visitingDates,
  invitedBy,
}) => {
  doc.image(bgPath, 0, 0, { width: 600, height: 800 });

  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(10);

  //  Correct box alignment
  let x = 395;
  let y = 168;
  let gap = 18;

  doc.text(
    buildBadgeValidityText(visitingDates),
    // x - gap * getVisitingDateCount(visitingDates),
    x - 70,
    y + gap * 5,
    {
      width: 150,
    },
  );

  if (invitedBy) {
    doc.text(`Invited by: ${invitedBy}`, x - 70, y + gap * 6 + 10, {
      width: 150,
    });
  }

  doc.text(pdfData.name, x, y, { width: 150 });
  doc.text(pdfData.position, x, y + gap, { width: 150 });
  doc.text(pdfData.brand, x, y + gap * 2, { width: 150 });
  doc.text(pdfData.visitorId, x, y + gap * 3, { width: 150 });

  // QR
  doc.image(qrPath, 490, 250, {
    width: 90,
    height: 90,
  });
};

module.exports = {
  renderVisitorBadgePdf,
};

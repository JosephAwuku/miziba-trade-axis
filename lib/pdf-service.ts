import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export interface FDPSummary {
  tradeRef: string;
  commodity: string;
  volume: string;
  valuation: string;
  trader: string;
  buyer: string;
  riskScore: number;
  riskBand: string;
  waterfall: {
    principal: string;
    fees: string;
    mizibaFee: string;
    traderMargin: string;
  };
}

export async function generateFDPBuffer(data: FDPSummary): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Colors
  const navy = rgb(0.05, 0.09, 0.15); // #0D1726
  const gold = rgb(0.72, 0.58, 0.28); // #B89447
  const grey = rgb(0.4, 0.4, 0.4);

  // 1. Header Area
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: navy,
  });

  // Try to embed Logo (using the relative path from the current context)
  // Note: In production, this would be an absolute path from process.cwd() or a URL
  try {
    const logoRelPath = 'tradeaxis_fdp_header_1776688600727.png';
    // We search in the artifacts directory
    const artifactsDir = 'C:/Users/okyea/.gemini/antigravity/brain/47af07c5-3eb9-42d9-bbf3-efb47da28db1';
    const logoPath = path.join(artifactsDir, logoRelPath);
    
    if (fs.existsSync(logoPath)) {
      const logoBytes = fs.readFileSync(logoPath);
      const logoImage = await pdfDoc.embedPng(logoBytes);
      const logoDims = logoImage.scale(0.24);
      page.drawImage(logoImage, {
        x: 40,
        y: height - 80,
        width: logoDims.width,
        height: logoDims.height,
      });
    }
  } catch (err) {
    console.warn('Logo embed failed:', err);
  }

  page.drawText('FINANCE DATA PACKAGE', {
    x: width - 210,
    y: height - 60,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`REF: ${data.tradeRef}`, {
    x: width - 210,
    y: height - 80,
    size: 10,
    font: fontRegular,
    color: gold,
  });

  // 2. Deal Summary Section
  let y = height - 150;
  
  page.drawText('EXECUTIVE SUMMARY', { x: 40, y, size: 12, font: fontBold, color: navy });
  y -= 5;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: gold });
  y -= 25;

  const summaryItems = [
    ['Entity (Trader)', data.trader],
    ['Counterparty (Buyer)', data.buyer],
    ['Commodity Type', data.commodity.toUpperCase()],
    ['Volume / Capacity', data.volume],
    ['Contract Valuation', data.valuation],
  ];

  summaryItems.forEach(([label, value]) => {
    page.drawText(label, { x: 40, y, size: 9, font: fontBold, color: grey });
    page.drawText(value, { x: 200, y, size: 10, font: fontRegular, color: navy });
    y -= 18;
  });

  // 3. Risk Profile Section
  y -= 30;
  page.drawText('RISK ASSESSMENT', { x: 40, y, size: 12, font: fontBold, color: navy });
  y -= 5;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: gold });
  y -= 25;

  page.drawText('Composite Risk Score:', { x: 40, y, size: 9, font: fontBold, color: grey });
  page.drawText(`${data.riskScore}/100`, { x: 200, y, size: 12, font: fontBold, color: data.riskScore > 70 ? rgb(0.1, 0.6, 0.1) : gold });
  
  page.drawText('Risk Band / Rating:', { x: 300, y, size: 9, font: fontBold, color: grey });
  page.drawText(data.riskBand.replace('_', ' '), { x: 420, y, size: 10, font: fontBold, color: navy });
  
  y -= 40;

  // 4. Waterfall / Financials Table
  page.drawText('SETTLEMENT WATERFALL (ESTIMATED)', { x: 40, y, size: 12, font: fontBold, color: navy });
  y -= 5;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: gold });
  y -= 25;

  // Table Header
  page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 20, color: rgb(0.96, 0.96, 0.96) });
  page.drawText('DISBURSEMENT COMPONENT', { x: 50, y, size: 8, font: fontBold, color: grey });
  page.drawText('PRIORITY', { x: 250, y, size: 8, font: fontBold, color: grey });
  page.drawText('AMOUNT (USD)', { x: 450, y, size: 8, font: fontBold, color: grey });
  
  y -= 25;

  const waterfallItems = [
    ['Finance Partner (Principal + Interest)', '01 (Senior)', data.waterfall.principal],
    ['Miziba Management & Structuring', '02', data.waterfall.mizibaFee],
    ['Trader Residual Margin', '03 (Junior/Equity)', data.waterfall.traderMargin],
  ];

  waterfallItems.forEach(([label, priority, amount], idx) => {
    page.drawText(label, { x: 50, y, size: 9, font: fontRegular, color: navy });
    page.drawText(priority, { x: 250, y, size: 9, font: fontRegular, color: grey });
    page.drawText(amount, { x: 450, y, size: 9, font: fontBold, color: idx === 0 ? navy : grey });
    y -= 20;
    page.drawLine({ start: { x: 40, y: y + 5 }, end: { x: width - 40, y: y + 5 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
  });

  // Footer / Disclaimer
  y = 60;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: grey });
  y -= 15;
  page.drawText('CONFIDENTIAL PROPERTY OF MIZIBA INFRASTRUCTURE LTD', { x: 40, y, size: 7, font: fontBold, color: grey });
  page.drawText('This document is for internal finance review purposes only. Figures are based on submitted trade data as of ', { 
    x: 40, y: y - 10, size: 7, font: fontRegular, color: grey 
  });
  page.drawText(new Date().toLocaleDateString(), { x: 380, y: y - 10, size: 7, font: fontBold, color: grey });

  return await pdfDoc.save();
}

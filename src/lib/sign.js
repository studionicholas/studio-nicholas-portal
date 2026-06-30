// Builds the "official" signed fee-proposal PDF entirely in the browser (free,
// no third-party e-sign service). Takes the studio's original proposal, stamps
// a discreet footer on every page, and appends a formal "Certificate of
// Completion" page carrying the audit trail. See [[studio-nicholas-esign]].

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import PdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker";

// Spin up pdf.js's worker the Vite way: a bundled, classic-format worker that
// ships inside this chunk. This is far more reliable in the deployed PWA than
// fetching a separate hashed worker file (?url → workerSrc), which can silently
// fail to load — and when it does, the in-document signature fill is skipped
// while the certificate page (pure pdf-lib, no worker) still appends. Lazy +
// guarded so a worker hiccup never breaks signing; it just falls back to the
// certificate-only result.
let _workerSet = false;
function ensurePdfWorker() {
  if (_workerSet) return;
  _workerSet = true;
  try {
    pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
  } catch (_e) {
    /* getDocument will surface any real problem; we just won't crash here */
  }
}

// Brand palette (see [[studio-nicholas-brand-colours]]).
const INK = rgb(0.110, 0.102, 0.090); // #1C1A17
const MUTED = rgb(0.612, 0.584, 0.549); // #9c958c
const AQUA = rgb(0.608, 0.675, 0.714); // #9BACB6
const SAGE = rgb(0.341, 0.420, 0.271); // #576B45
const LINE = rgb(0.886, 0.847, 0.804); // #e2d8cd
const FAINT = rgb(0.945, 0.910, 0.875);

// --- byte helpers -----------------------------------------------------------

function base64ToBytes(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// Get the raw bytes of a document whether it's an inline data: URL or a remote
// (Supabase storage) URL.
export async function bytesFromUrl(url) {
  if (!url) throw new Error("No document to sign.");
  if (url.startsWith("data:")) {
    const b64 = url.split(",")[1] || "";
    return base64ToBytes(b64);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load the proposal document.");
  return new Uint8Array(await res.arrayBuffer());
}

function dataUrlPngToBytes(dataUrl) {
  return base64ToBytes((dataUrl.split(",")[1] || ""));
}

export function bytesToDataUrl(bytes, mime = "application/pdf") {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

// SHA-256 fingerprint of the original document (hex), so any later tampering is
// detectable against the value printed on the certificate.
export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- text helpers -----------------------------------------------------------

function wrap(text, font, size, maxWidth) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function chunkMono(text, font, size, maxWidth) {
  // Hard-wrap a continuous string (e.g. a hash) to fit a width.
  const chars = String(text || "").split("");
  const lines = [];
  let cur = "";
  for (const ch of chars) {
    if (font.widthOfTextAtSize(cur + ch, size) > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Locate the document's own "Acceptance" block (the page carrying "I hereby
// accept…" with name / date / signature labels) and return the label positions,
// so we can fill the client's details right there. Works for any proposal in the
// template regardless of which page the block lands on. Returns null if absent.
async function findAcceptance(bytes) {
  try {
    ensurePdfWorker();
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const tc = await page.getTextContent();
      const items = tc.items
        .filter((it) => it && it.str != null)
        .map((it) => ({
          s: String(it.str).trim().toLowerCase(),
          x: it.transform[4],
          y: it.transform[5],
          w: it.width || 0,
          h: it.height || Math.abs(it.transform[3]) || 9,
        }));
      if (!items.some((i) => i.s.includes("hereby accept"))) continue;
      const find = (label) => items.find((i) => i.s === label);
      const name = find("name");
      const date = find("date");
      const sig = find("signature");
      if (name || date || sig) {
        try {
          await doc.destroy();
        } catch (_e) {}
        return { pageIndex: n - 1, name, date, sig };
      }
    }
    try {
      await doc.destroy();
    } catch (_e) {}
  } catch (e) {
    console.error("acceptance detect failed", e);
  }
  return null;
}

// --- main -------------------------------------------------------------------

// cert: { documentTitle, documentId, signerName, signerEmail, signedAtLabel,
//         ip, device, projectName, fingerprint, issuedLabel, viewedLabel,
//         consentText }
// signaturePng: PNG data URL of the drawn signature (transparent background).
// Returns a Uint8Array of the finished PDF.
export async function buildSignedProposal({ originalBytes, signaturePng, cert }) {
  const pdf = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const obl = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  let sigImg = null;
  if (signaturePng) {
    try {
      sigImg = await pdf.embedPng(dataUrlPngToBytes(signaturePng));
    } catch (_e) {
      sigImg = null;
    }
  }

  // Fill the document's own Acceptance section (name / date / signature) so the
  // signature sits right against the fee schedule and terms the client accepted.
  const anchors = await findAcceptance(originalBytes);
  if (anchors) {
    const pages = pdf.getPages();
    const pg = pages[anchors.pageIndex];
    if (pg) {
      // The labels sit at the bottom of each field, with the write-space ABOVE
      // them, so we draw the client's details just above each label, aligned to it.
      if (anchors.name) {
        pg.drawText(cert.signerName, { x: anchors.name.x, y: anchors.name.y + 15, size: 12, font: obl, color: INK });
      }
      if (anchors.date && cert.dateOnly) {
        pg.drawText(cert.dateOnly, { x: anchors.date.x, y: anchors.date.y + 15, size: 12, font: helv, color: INK });
      }
      if (anchors.sig && sigImg) {
        const avail = pg.getWidth() - anchors.sig.x - 24;
        const maxW = Math.max(90, Math.min(200, avail));
        const maxH = 40;
        const scale = Math.min(maxW / sigImg.width, maxH / sigImg.height);
        pg.drawImage(sigImg, { x: anchors.sig.x, y: anchors.sig.y + 12, width: sigImg.width * scale, height: sigImg.height * scale });
      }
    }

  }

  // Discreet "signed" stamp at the very bottom edge of each original page.
  const stamp = `Electronically signed · ${cert.documentId} · ${cert.signedAtLabel}`;
  pdf.getPages().forEach((pg) => {
    pg.drawText(stamp, { x: 40, y: 14, size: 6.5, font: helv, color: MUTED });
  });

  // --- Certificate page (A4 portrait) ---
  const W = 595.28;
  const H = 841.89;
  const page = pdf.addPage([W, H]);
  const M = 56;
  const right = W - M;
  let y = H - 64;

  // Header
  page.drawText("STUDIO NICHOLAS", { x: M, y, size: 15, font: bold, color: INK });
  page.drawText("Interior Design", { x: M, y: y - 14, size: 8.5, font: helv, color: MUTED });
  const ttl = "Certificate of Completion";
  page.drawText(ttl, { x: right - obl.widthOfTextAtSize(ttl, 15), y, size: 15, font: obl, color: INK });
  const idLine = `Document ID · ${cert.documentId}`;
  page.drawText(idLine, { x: right - helv.widthOfTextAtSize(idLine, 9), y: y - 14, size: 9, font: helv, color: MUTED });

  y -= 30;
  page.drawRectangle({ x: M, y, width: right - M, height: 1.6, color: INK });
  y -= 24;

  const labelX = M;
  const valX = M + 150;
  const valW = right - valX;
  const rowGap = 8;

  function row(label, drawValue, valueHeight) {
    page.drawText(label, { x: labelX, y: y - 9, size: 10.5, font: helv, color: MUTED });
    drawValue(y);
    y -= (valueHeight || 11) + rowGap * 2;
    page.drawRectangle({ x: M, y: y + rowGap, width: right - M, height: 0.6, color: FAINT });
  }

  // Document
  row("Document", (ry) => {
    page.drawText(cert.documentTitle, { x: valX, y: ry - 9, size: 11, font: bold, color: INK });
  });

  // Verification code (full hash, monospace, wrapped)
  const fpLines = chunkMono(`SHA-256  ${cert.fingerprint}`, mono, 8, valW);
  row("Verification code", (ry) => {
    fpLines.forEach((ln, i) => page.drawText(ln, { x: valX, y: ry - 9 - i * 10, size: 8, font: mono, color: INK }));
    page.drawText("Confirms this is the original, unaltered document.", { x: valX, y: ry - 9 - fpLines.length * 10 - 2, size: 8.5, font: obl, color: SAGE });
  }, fpLines.length * 10 + 12);

  // Signed by
  row("Signed by", (ry) => {
    page.drawText(cert.signerName, { x: valX, y: ry - 9, size: 11, font: bold, color: INK });
    const nameW = bold.widthOfTextAtSize(cert.signerName, 11);
    page.drawText("Verified portal login", { x: valX + nameW + 10, y: ry - 8.5, size: 8.5, font: helv, color: SAGE });
    page.drawText(cert.signerEmail, { x: valX, y: ry - 22, size: 9.5, font: helv, color: MUTED });
  }, 26);

  // Signature image
  row("Signature", (ry) => {
    if (sigImg) {
      const maxW = 190;
      const maxH = 46;
      const scale = Math.min(maxW / sigImg.width, maxH / sigImg.height);
      const w = sigImg.width * scale;
      const h = sigImg.height * scale;
      page.drawImage(sigImg, { x: valX, y: ry - h - 2, width: w, height: h });
    } else {
      page.drawText(cert.signerName, { x: valX, y: ry - 14, size: 16, font: obl, color: INK });
    }
  }, 46);

  // Signed at
  row("Signed at", (ry) => {
    page.drawText(cert.signedAtLabel, { x: valX, y: ry - 9, size: 11, font: helv, color: INK });
  });

  // IP / device
  row("IP address / device", (ry) => {
    page.drawText(`${cert.ip || "—"} · ${cert.device || "—"}`, { x: valX, y: ry - 9, size: 10, font: helv, color: INK });
  });

  // Consent
  const consentLines = wrap(cert.consentText, helv, 9.5, valW);
  row("Consent", (ry) => {
    consentLines.forEach((ln, i) => page.drawText(ln, { x: valX, y: ry - 9 - i * 12, size: 9.5, font: helv, color: INK }));
  }, consentLines.length * 12);

  // Audit trail
  y -= 6;
  page.drawText("AUDIT TRAIL", { x: M, y, size: 9, font: bold, color: AQUA });
  y -= 18;
  const events = [
    ["Proposal issued by Studio Nicholas", cert.issuedLabel],
    ["Opened & viewed by client", cert.viewedLabel],
    ["Signed & accepted by client", cert.signedAtLabel],
  ];
  events.forEach(([what, when], i) => {
    const color = i === 2 ? SAGE : AQUA;
    page.drawCircle({ x: M + 3, y: y + 3, size: 3, color });
    page.drawText(what, { x: M + 14, y, size: 10, font: helv, color: INK });
    if (when) page.drawText(when, { x: right - helv.widthOfTextAtSize(when, 9), y, size: 9, font: helv, color: MUTED });
    y -= 16;
  });

  // Footer
  const fy = 78;
  page.drawRectangle({ x: M, y: fy + 14, width: right - M, height: 0.8, color: LINE });
  const footL = [
    "Nicholas Ben Gilbert trading as Studio Nicholas",
    "ABN 71 478 719 632 · Registered for GST",
    "Noosa Heads QLD 4566 · info@studionicholas.com.au · studionicholas.com.au",
  ];
  footL.forEach((ln, i) => {
    page.drawText(ln, { x: M, y: fy - i * 12, size: 8.5, font: i === 0 ? bold : helv, color: i === 0 ? INK : MUTED });
  });
  const valid = "This certificate accompanies a";
  const valid2 = "legally binding electronic signature.";
  page.drawText(valid, { x: right - helv.widthOfTextAtSize(valid, 8), y: fy, size: 8, font: helv, color: MUTED });
  page.drawText(valid2, { x: right - helv.widthOfTextAtSize(valid2, 8), y: fy - 12, size: 8, font: helv, color: MUTED });

  const out = await pdf.save();
  return out;
}

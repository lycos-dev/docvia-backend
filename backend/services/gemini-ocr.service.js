/**
 * backend/services/gemini-ocr.service.js
 *
 * OCR for image-based / scanned PDFs using Google Gemini Flash.
 *
 * WHY GEMINI OVER GROQ FOR OCR
 * ─────────────────────────────
 * • Gemini accepts a raw PDF as a single file part — no page-by-page
 *   canvas rendering loop needed.
 * • Gemini 2.0 Flash has significantly better vision accuracy on
 *   mixed-layout documents (tables, diagrams, handwritten notes).
 * • Much more generous rate limits than Groq free tier.
 *
 * STRATEGY
 * ─────────
 * 1. pdf-parse (fast, zero API cost) — used when the text layer is good.
 * 2. Gemini vision on the raw PDF bytes — used when text layer is thin/absent.
 *    We send the whole PDF as one request instead of per-page PNGs, which is
 *    cheaper and gives Gemini cross-page context for better extraction.
 *
 * Returns: { fullText, pages, pageCount, usedOCR }
 *
 * PACKAGES REQUIRED (already in project or add once):
 *   npm install @google/generative-ai pdf-parse
 */

'use strict';

const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_KEYS, nextKey } = require('./geminikeymanager.service');

const GEMINI_VISION_MODELS = ['gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

// ─── Gemini vision call — tries multiple models with fallback ─────────────────

async function geminiVisionOCR(pdfBuffer) {
  const base64Pdf = pdfBuffer.toString('base64');
  
  for (const modelName of GEMINI_VISION_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const key = nextKey();
      try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: modelName });

        console.log(`[GeminiOCR] Trying model: ${modelName}`);

        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            text: `Extract ALL readable text from every page of this PDF document.
Return the raw extracted text only — no commentary, no formatting labels.
Preserve paragraph breaks with a blank line between paragraphs.
For each new page, insert a marker like: [PAGE N]
If a page is blank or contains only images with no text, write: [PAGE N - NO TEXT]
Do not summarize, interpret, or add any content that is not on the page.`,
          },
        ]);

        const text = result.response.text().trim();
        console.log(`[GeminiOCR] ✅ Success with ${modelName}: ${text.length} chars`);
        return text;
      } catch (err) {
        const status = err?.status ?? 0;
        const isRetryable = status === 503 || status === 429 || (err.message || '').toLowerCase().includes('unavailable');
        
        if (isRetryable && attempt < 2) {
          const delay = 1000 * (attempt + 1);
          console.warn(`[GeminiOCR] ⚠️  ${modelName} unavailable (${status}), retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        
        console.warn(`[GeminiOCR] ❌ ${modelName} failed: ${err.message?.slice(0, 100)}`);
        
        if (attempt >= 2) break; // Move to next model
      }
    }
  }
  
  throw new Error('All Gemini models are currently unavailable. Please try again later.');
}

// ─── Parse Gemini output into per-page structure ─────────────────────────────

function parseGeminiPages(fullText) {
  // Split on [PAGE N] markers
  const pageMarkerRx = /\[PAGE\s+(\d+)(?:\s*-[^\]]+)?\]/gi;
  const parts = fullText.split(pageMarkerRx);

  // parts alternates: [text-before-first-marker, pageNum, pageText, pageNum, pageText ...]
  if (parts.length <= 1) {
    // No markers found — treat entire output as page 1
    return [{ pageNum: 1, text: fullText.trim() }];
  }

  const pages = [];
  // parts[0] is text before first marker (usually empty)
  for (let i = 1; i < parts.length; i += 2) {
    const pageNum = parseInt(parts[i], 10);
    const text    = (parts[i + 1] || '').trim();
    pages.push({ pageNum, text });
  }

  return pages.filter(p => p.text.length > 0);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Extracts text from a PDF buffer.
 *
 * Strategy:
 *   1. pdf-parse (fast, zero API cost)  — used when text layer is sufficient.
 *   2. Gemini vision OCR                — used when text layer is empty/thin.
 *
 * Returns: { fullText, pages, pageCount, usedOCR }
 *
 * @param {Buffer} pdfBuffer  Raw PDF bytes.
 * @param {string} userId     Unused here (kept for API consistency with callers).
 * @param {string} [label]    Log prefix e.g. '[Lessons]' or '[Segmentation]'.
 */
async function extractPDFTextWithOCR(pdfBuffer, userId, label = '[OCR]') {
  // ── Step 1: pdf-parse ──────────────────────────────────────────────────────
  let rawText   = '';
  let pageCount = 1;

  try {
    const result = await pdfParse(pdfBuffer);
    rawText   = result.text    || '';
    pageCount = result.numpages || 1;
  } catch (e) {
    console.warn(`${label} pdf-parse failed: ${e.message} — will attempt Gemini vision OCR`);
  }

  const cleaned     = rawText.replace(/\s+/g, ' ').trim();
  const pageTexts   = cleaned.split(/\f/).map(t => t.trim()).filter(Boolean);
  const pageLens    = pageTexts.map(p => p.length);
  const totalChars  = cleaned.length;
  const usablePages = pageLens.filter(len => len >= 30).length;
  const avgChars    = pageCount > 0 ? totalChars / pageCount : 0;

  console.log(`${label} pdf-parse: ${totalChars} chars, ${pageCount} pages (avg: ${avgChars.toFixed(0)}/page, usable: ${usablePages}/${pageCount})`);

  // Detect if text layer looks like OCR metadata noise
  const ocrMetadataPatterns = [
    /text extracted from the image/i,
    /## step \d+/i,
    /## analyzing the image/i,
    /the image is (completely )?blank/i,
    /no visible text/i,
  ];
  const looksLikeOCRMeta = ocrMetadataPatterns.some(p => p.test(cleaned.slice(0, 500)));

  const textLayerOK = (
    (usablePages >= pageCount * 0.4 || avgChars >= 50) &&
    totalChars >= 100 &&
    !looksLikeOCRMeta
  );

  if (textLayerOK) {
    const rawPages  = pageTexts.map((t, i) => ({ pageNum: i + 1, text: t })).filter(p => p.text.length > 0);
    const finalPages = rawPages.length > 0 ? rawPages : [{ pageNum: 1, text: cleaned }];
    console.log(`${label} Using text layer (${totalChars} chars)`);
    return {
      fullText:  finalPages.map((p, i) => `\n[PAGE ${i + 1}]\n${p.text}`).join(''),
      pages:     finalPages,
      pageCount: finalPages.length,
      usedOCR:   false,
    };
  }

  // ── Step 2: Gemini vision OCR ──────────────────────────────────────────────
  console.log(`${label} Text layer weak (${totalChars} chars, ${usablePages}/${pageCount} usable) — running Gemini vision OCR...`);

  try {
    const geminiText  = await geminiVisionOCR(pdfBuffer);
    const pages       = parseGeminiPages(geminiText);
    const ocrTotal    = pages.reduce((sum, p) => sum + p.text.length, 0);
    const goodPages   = pages.filter(p => p.text.length >= 100).length;
    const bestPage    = Math.max(...pages.map(p => p.text.length), 0);

    console.log(`${label} Gemini OCR done: ${ocrTotal} chars, ${goodPages}/${pages.length} good pages, best: ${bestPage} chars`);

    if (bestPage >= 100 || goodPages >= 1) {
      const finalPages = pages.map((p, i) => ({ pageNum: i + 1, text: p.text }));
      return {
        fullText:  finalPages.map((p, i) => `\n[PAGE ${i + 1}]\n${p.text}`).join(''),
        pages:     finalPages,
        pageCount: finalPages.length,
        usedOCR:   true,
      };
    }
  } catch (err) {
    console.error(`${label} Gemini OCR failed: ${err.message}`);
  }

  // ── Fallback: return whatever text-parse gave us ───────────────────────────
  if (rawText && rawText.trim().length > 50) {
    console.log(`${label} Poor OCR — falling back to text layer`);
    const rawPages   = rawText.split(/\f/).map((t, i) => ({ pageNum: i + 1, text: t.trim() })).filter(p => p.text);
    const finalPages = rawPages.length > 0 ? rawPages : [{ pageNum: 1, text: rawText }];
    return {
      fullText:  finalPages.map((p, i) => `\n[PAGE ${i + 1}]\n${p.text}`).join(''),
      pages:     finalPages,
      pageCount: finalPages.length,
      usedOCR:   false,
    };
  }

  throw new Error(
    'Could not extract readable text from this PDF. ' +
    'The document may be blank, corrupted, or password-protected.'
  );
}

module.exports = { extractPDFTextWithOCR };
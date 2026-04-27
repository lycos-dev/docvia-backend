/**
 * backend/services/groq-ocr.service.js
 *
 * OCR for image-based / scanned PDFs using Groq's free vision model.
 *
 * KNOWN ISSUES FIXED
 * ──────────────────
 * 1. pdfjs-dist v4 is ESM-only — loaded via dynamic import(), not require().
 * 2. workerSrc on Windows must be a file:// URL, not a raw C:\ path.
 *    Use pathToFileURL() from the built-in 'url' module.
 * 3. groq-sdk@0.4.x does not support vision/image_url content blocks.
 *    We call the Groq REST API directly with native fetch() instead, which
 *    works on Node 18+ and passes the full content array as-is.
 * 4. @napi-rs/canvas must be installed: npm install @napi-rs/canvas
 */

'use strict';

const pdfParse        = require('pdf-parse');
const { pathToFileURL } = require('url');
const { GROQ_KEYS }   = require('./groqkeymanager.service');

const GROQ_VISION_MODEL  = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_VISION_URL    = 'https://api.groq.com/openai/v1/chat/completions';
const MIN_CHARS_PER_PAGE = 60;
const MIN_TOTAL_CHARS   = 150;
const OCR_MIN_PER_PAGE  = 30;

// ─── Round-robin key index (module-level, stateless fallback) ─────────────────
// makeGroqCall() requires a userId DB lookup. For OCR we just cycle keys
// directly so we have no async DB dependency here.
let _keyIndex = 0;
function nextGroqKey() {
  if (!GROQ_KEYS || GROQ_KEYS.length === 0) {
    throw new Error('No Groq API keys configured in GROQ_API_KEY env var.');
  }
  const key = GROQ_KEYS[_keyIndex % GROQ_KEYS.length];
  _keyIndex++;
  return key;
}

// ─── Groq vision call via native fetch (SDK-version-independent) ──────────────

async function groqVisionRequest(base64Png) {
  const lastError = null;

  for (let attempt = 0; attempt < GROQ_KEYS.length; attempt++) {
    const key = nextGroqKey();

    const body = JSON.stringify({
      model:       GROQ_VISION_MODEL,
      max_tokens:  2048,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type:      'image_url',
              image_url: { url: `data:image/png;base64,${base64Png}` },
            },
            {
              type: 'text',
              text: `You are a text extraction tool. Your ONLY job is to output the exact text you see in the image.

STRICT RULES:
- Output ONLY the literal text characters visible in the image, word for word.
- Preserve reading order and paragraph breaks.
- If a section is hard to read, do your best to transcribe it — never describe difficulty.
- NEVER output phrases like: "undecipherable", "illegible", "blurry", "absence of text", "no text", "cannot read", "image shows", "the page contains", "this page", or any sentence describing the image.
- If the page is truly blank, output only: [BLANK PAGE]
- Do not add headings, labels, explanations, or any words that are not in the original image.`,
            },
          ],
        },
      ],
    });

    const res = await fetch(GROQ_VISION_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body,
    });

    if (res.status === 429 || res.status === 401 || res.status === 403) {
      // Key exhausted or invalid — try the next one
      console.warn(`[OCR] Groq key attempt ${attempt + 1} failed (${res.status}) — cycling...`);
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq vision API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  }

  throw new Error('All Groq API keys are exhausted or rate-limited for vision OCR.');
}

// ─── Render a single PDF page to a base64 PNG ─────────────────────────────────

async function renderPageToBase64(pdfDoc, pageNum, scale = 3.0) {
  const { createCanvas } = require('@napi-rs/canvas');

  const page     = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas   = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context  = canvas.getContext('2d');

  // pdfjs-dist v4 requires an explicit NodeCanvasFactory in Node.js
  const canvasFactory = {
    create(w, h) {
      const c = createCanvas(w, h);
      return { canvas: c, context: c.getContext('2d') };
    },
    reset(obj, w, h) { obj.canvas.width = w; obj.canvas.height = h; },
    destroy(obj)     { obj.canvas.width = 0; obj.canvas.height = 0; },
  };

  await page.render({ canvasContext: context, viewport, canvasFactory }).promise;

  return canvas.toBuffer('image/png').toString('base64');
}

// ─── Lazy-load pdfjs (ESM) — cached after first import ───────────────────────
let _pdfjs = null;
async function getPdfjs() {
  if (_pdfjs) return _pdfjs;

  // Dynamic import required — pdfjs-dist v4 is ESM-only (.mjs), cannot require()
  _pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // workerSrc MUST be a file:// URL on Windows (raw C:\ paths are rejected by
  // the ESM loader). pathToFileURL() handles this correctly on all platforms.
  _pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  ).href;

  return _pdfjs;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Extracts text from a PDF buffer.
 *
 * Strategy:
 *   1. pdf-parse (fast, zero API cost) — used when the text layer is sufficient.
 *   2. Groq vision OCR per page       — used when the text layer is empty/thin.
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
    console.warn(`${label} pdf-parse failed: ${e.message} — will attempt Groq vision OCR`);
  }

  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  const pageTexts = cleaned.split(/\f/).map(t => t.trim()).filter(Boolean);
  const pageLens = pageTexts.map(p => p.length);
  const totalChars = cleaned.length;
  const avgCharsPerPage = pageCount > 0 ? totalChars / pageCount : 0;
  const hasRichPages = pageLens.some(len => len >= MIN_CHARS_PER_PAGE);
  const minPageLen = Math.min(...pageLens, 0);

  console.log(`${label} pdf-parse: ${totalChars} chars, ${pageCount} pages (avg: ${avgCharsPerPage.toFixed(1)}/page, min: ${minPageLen}, has rich pages: ${hasRichPages})`);

  const shouldUseOCR = (
    totalChars < MIN_TOTAL_CHARS ||
    (!hasRichPages && avgCharsPerPage < 20 && pageCount > 1)
  );

  if (!shouldUseOCR) {
    const rawPages = pageTexts
      .map((t, i) => ({ pageNum: i + 1, text: t }))
      .filter(p => p.text.length > 0);
    const finalPages = rawPages.length > 0 ? rawPages : [{ pageNum: 1, text: cleaned }];
    return {
      fullText:  finalPages.map((p, i) => `\n[PAGE ${i + 1}]\n${p.text}`).join(''),
      pages:     finalPages,
      pageCount: finalPages.length,
      usedOCR:   false,
    };
  }

  // ── Step 2: Groq vision OCR per page ──────────────────────────────────────
  console.log(`${label} Text too short — PDF is image-based. Running Groq vision OCR...`);

  const pdfjs  = await getPdfjs();
  const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;

  const numPages = pdfDoc.numPages;
  const pages    = [];
  let   fullText = '';

  for (let i = 1; i <= numPages; i++) {
    console.log(`${label} OCR page ${i}/${numPages}...`);
    try {
      const base64Png = await renderPageToBase64(pdfDoc, i);
      const pageText  = await groqVisionRequest(base64Png);
      pages.push({ pageNum: i, text: pageText });
      fullText += `\n[PAGE ${i}]\n${pageText}`;
      console.log(`${label} Page ${i}: ${pageText.length} chars extracted`);
    } catch (err) {
      console.error(`${label} Page ${i} OCR failed: ${err.message}`);
      pages.push({ pageNum: i, text: '' });
    }
  }

  const ocrPageTexts = pages.map(p => p.text);
  const ocrPageLens = ocrPageTexts.map(t => t.length);
  const ocrMinLen = Math.min(...ocrPageLens, 0);
  const ocrAvgLen = pages.length > 0 ? ocrPageLens.reduce((a, b) => a + b, 0) / pages.length : 0;
  const hasGoodOCRPages = ocrPageLens.some(len => len >= OCR_MIN_PER_PAGE);

  const combinedText = fullText.trim();

  if (combinedText.length < 50 || (!hasGoodOCRPages && ocrAvgLen < 15)) {
    if (rawText && rawText.trim().length > 50) {
      console.log(`${label} OCR yielded poor results (${combinedText.length} chars, avg ${ocrAvgLen.toFixed(1)}/page), falling back to raw text layer`);
      const rawPages = rawText.split(/\f/).map((t, i) => ({ pageNum: i + 1, text: t.trim() })).filter(p => p.text);
      const finalPages = rawPages.length > 0 ? rawPages : [{ pageNum: 1, text: rawText }];
      return {
        fullText:  finalPages.map((p, i) => `\n[PAGE ${i + 1}]\n${p.text}`).join(''),
        pages:     finalPages,
        pageCount: finalPages.length,
        usedOCR:   false,
      };
    }
    throw new Error(
      'Could not extract meaningful text from this PDF. ' +
      'The document may be blank, corrupted, password-protected, or scanned at very low resolution.'
    );
  }

  console.log(`${label} OCR results: ${combinedText.length} chars, ${pages.length} pages (avg ${ocrAvgLen.toFixed(1)}/page, min ${ocrMinLen})`);

  console.log(`${label} Groq OCR complete: ${combinedText.length} total chars across ${numPages} pages`);

  return {
    fullText:  fullText,
    pages:     pages,
    pageCount: numPages,
    usedOCR:   true,
  };
}

module.exports = { extractPDFTextWithOCR };
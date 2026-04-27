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
  for (let attempt = 0; attempt < GROQ_KEYS.length; attempt++) {
    const key = nextGroqKey();

    const body = JSON.stringify({
      model:       GROQ_VISION_MODEL,
      max_tokens:  4096,
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
              text: `Extract all readable text from this document image. Return the raw text only with no commentary. If you cannot read any text, respond with exactly: [NO_TEXT]`,
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

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[OCR] Groq response error: ${res.status}`, errText.slice(0, 500));
      if (res.status === 429 || res.status === 401 || res.status === 403) {
        console.warn(`[OCR] Groq key attempt ${attempt + 1} failed (${res.status}) — cycling...`);
        continue;
      }
      throw new Error(`Groq vision API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();
    console.log(`[OCR] Groq raw response (${content.length} chars):`, content.slice(0, 200));
    return content;
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

  // Debug: fill with white to see if canvas is working
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

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

  const base64 = canvas.toBuffer('image/png').toString('base64');
  
  // Verify the base64 isn't empty or suspiciously small
  if (base64.length < 1000) {
    console.warn(`[OCR] Warning: Rendered PNG is very small (${base64.length} chars), page may be blank`);
  }
  
  return base64;
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
    console.warn(`${label} pdf-parse failed: ${e.message} — will attempt vision OCR`);
  }

  // Parse extracted text into pages
  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  const pageTexts = cleaned.split(/\f/).map(t => t.trim()).filter(Boolean);
  const pageLens = pageTexts.map(p => p.length);
  const totalChars = cleaned.length;

  // Check usability of text layer - be very lenient
  const usablePages = pageLens.filter(len => len >= 30).length;
  const avgChars = pageCount > 0 ? totalChars / pageCount : 0;

  console.log(`${label} pdf-parse: ${totalChars} chars, ${pageCount} pages (avg: ${avgChars.toFixed(0)}/page, usable: ${usablePages}/${pageCount})`);

  // HEURISTIC: If text layer looks like OCR metadata (contains phrases like "text extracted", 
  // "unreadable", "## Step" or page markers), skip it and force vision OCR
  const ocrMetadataPatterns = [
    /text extracted from the image/i,
    /## step \d+/i,
    /## analyzing the image/i,
    /the image is (completely )?blank/i,
    /no visible text/i,
  ];
  const looksLikeOCRMeta = ocrMetadataPatterns.some(p => p.test(cleaned.slice(0, 500)));

  // Use text layer only if: decent quality AND doesn't look like OCR metadata
  const textLayerOK = (usablePages >= pageCount * 0.4 || avgChars >= 50) && totalChars >= 100 && !looksLikeOCRMeta;

  if (textLayerOK) {
    const rawPages = pageTexts
      .map((t, i) => ({ pageNum: i + 1, text: t }))
      .filter(p => p.text.length > 0);
    const finalPages = rawPages.length > 0 ? rawPages : [{ pageNum: 1, text: cleaned }];
    console.log(`${label} Using text layer (${totalChars} chars)`);
    return {
      fullText:  finalPages.map((p, i) => `\n[PAGE ${i + 1}]\n${p.text}`).join(''),
      pages:     finalPages,
      pageCount: finalPages.length,
      usedOCR:   false,
    };
  }

  // ── Step 2: Vision OCR for PDFs with images containing text ───────────────────
  console.log(`${label} Text layer weak (${totalChars} chars, ${usablePages}/${pageCount} usable) — running vision OCR...`);

  const pdfjs  = await getPdfjs();
  const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const numPages = pdfDoc.numPages;

  const pages    = [];
  let   fullText = '';

  const ocrFailureMarkers = ['[OCR_UNCLEAR]', '[BLANK_PAGE]', '[NO_TEXT]'];

  for (let i = 1; i <= numPages; i++) {
    console.log(`${label} OCR page ${i}/${numPages}...`);
    try {
      const base64Png = await renderPageToBase64(pdfDoc, i);
      console.log(`${label} Rendered PNG size: ${Math.round(base64Png.length * 3/4)} bytes approx (base64 length: ${base64Png.length})`);
      let pageText  = await groqVisionRequest(base64Png);
      
      // Filter out OCR failure markers
      const isFailureMarker = ocrFailureMarkers.includes(pageText);
      if (isFailureMarker) {
        pageText = '';
      }
      
      pages.push({ pageNum: i, text: pageText });
      fullText += `\n[PAGE ${i}]\n${pageText}`;
      console.log(`${label} Page ${i}: ${pageText.length} chars extracted${isFailureMarker ? ' (filtered)' : ''}`);
    } catch (err) {
      console.error(`${label} Page ${i} OCR failed: ${err.message}`);
      pages.push({ pageNum: i, text: '' });
    }
  }

const ocrPageLens = pages.map(p => p.text).map(t => t.length);
  const ocrTotal = ocrPageLens.reduce((a, b) => a + b, 0);
  const ocrAvgLen = pages.length > 0 ? ocrTotal / pages.length : 0;
  const bestPage = Math.max(...ocrPageLens, 0);
  const goodPages = ocrPageLens.filter(len => len >= 100).length;

  console.log(`${label} OCR done: ${ocrTotal} chars total, ${goodPages}/${pages.length} good pages, best page: ${bestPage} chars`);

  // If ANY page has substantial content (like 100+ chars), use it - don't reject for blank pages!
  if (bestPage >= 100 || goodPages >= 1) {
    const finalPages = pages.map((p, i) => ({ pageNum: i + 1, text: p.text }));
    console.log(`${label} Success: ${ocrTotal} chars from vision OCR`);
    return {
      fullText:  finalPages.map((p, i) => `\n[PAGE ${i + 1}]\n${p.text}`).join(''),
      pages:     finalPages,
      pageCount: finalPages.length,
      usedOCR:   true,
    };
  }

  // Very poor OCR results - fall back to text layer if available
  if (rawText && rawText.trim().length > 50) {
    console.log(`${label} Poor OCR (${bestPage} chars best), falling back to text layer`);
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
    'Could not extract readable text from this PDF. ' +
    'The document may be blank, corrupted, or password-protected.'
  );
}

module.exports = { extractPDFTextWithOCR };
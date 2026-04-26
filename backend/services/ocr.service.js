/**
 * backend/services/ocr.service.js
 *
 * OCR fallback for PDF pages that have no extractable text layer.
 *
 * HOW IT WORKS
 * ────────────
 * 1. pdfjs-dist renders the page to an off-screen canvas via @napi-rs/canvas
 *    (pre-built binaries — no native gyp compile needed on Windows/Mac/Linux).
 * 2. The canvas pixel data is passed directly to tesseract.js — no temp files.
 * 3. Tesseract runs in its own Worker, never blocking the Node event loop.
 * 4. A single Tesseract worker is created lazily and reused for the process
 *    lifetime, avoiding the ~1 s init cost on every page.
 *
 * PACKAGES REQUIRED — run once in your project root:
 *   npm install tesseract.js @napi-rs/canvas
 *
 * WHY THESE PACKAGES
 * ──────────────────
 * • tesseract.js     — pure-JS Tesseract 4 wrapper, no system binaries, free/OSS.
 * • @napi-rs/canvas  — ships pre-built binaries for Win/Mac/Linux; no gyp compile.
 *                      The `canvas` npm package requires a native build which fails
 *                      on many Windows environments — @napi-rs/canvas avoids that.
 * • pdfjs-dist       — already in your project; v4 dropped the legacy CJS path
 *                      (pdf.js), so we import it the same way the rest of the
 *                      backend does: require('pdfjs-dist').
 */

'use strict';

// ─── Minimum text chars before we consider a page "has a text layer" ─────────

const MIN_TEXT_CHARS = 20;

// ─── Lazy Tesseract worker singleton ─────────────────────────────────────────

let _worker = null;

async function getWorker() {
  if (_worker) return _worker;

  const { createWorker } = require('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: () => {}, // suppress per-progress log spam
  });
  _worker = worker;
  return worker;
}

// Terminate cleanly so the process doesn't hang on exit.
function terminateWorker() {
  if (_worker) {
    _worker.terminate().catch(() => {});
    _worker = null;
  }
}
process.on('exit', terminateWorker);
process.on('SIGTERM', terminateWorker);
process.on('SIGINT', terminateWorker);

// ─── Canvas factory for pdfjs-dist v4 (Node.js) ───────────────────────────────
//
// pdfjs-dist v4 dropped its built-in NodeCanvasFactory.
// We provide one backed by @napi-rs/canvas which has pre-built binaries
// for Windows/Mac/Linux — no native compile step required.

function makeCanvasFactory() {
  const { createCanvas } = require('@napi-rs/canvas');

  return {
    /** Called by pdfjs to allocate a canvas for rendering */
    create(width, height) {
      const canvas = createCanvas(width, height);
      return { canvas, context: canvas.getContext('2d') };
    },
    /** Called by pdfjs if it needs to resize the canvas */
    reset(canvasAndCtx, width, height) {
      canvasAndCtx.canvas.width  = width;
      canvasAndCtx.canvas.height = height;
    },
    /** Called by pdfjs when rendering is done */
    destroy(canvasAndCtx) {
      canvasAndCtx.canvas.width  = 0;
      canvasAndCtx.canvas.height = 0;
      canvasAndCtx.canvas   = null;
      canvasAndCtx.context  = null;
    },
  };
}

// ─── Render a single PDF page to a PNG Buffer ─────────────────────────────────

/**
 * Renders page `pageNum` (1-indexed) of an already-open pdfjs document to a
 * PNG Buffer suitable for passing directly to tesseract.js.
 *
 * Scale 2.0 gives ~144 dpi on a typical 72-dpi PDF page — good OCR accuracy
 * without producing huge buffers.
 *
 * @param   {object} pdfDoc   Open pdfjs PDFDocumentProxy.
 * @param   {number} pageNum  1-indexed page number.
 * @param   {number} [scale]  Render scale (default 2.0).
 * @returns {Promise<Buffer>} PNG image buffer.
 */
async function renderPageToBuffer(pdfDoc, pageNum, scale = 2.0) {
  const { createCanvas } = require('@napi-rs/canvas');

  const page     = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas  = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context,
    viewport,
    canvasFactory: makeCanvasFactory(),
  }).promise;

  // toBuffer() is synchronous on @napi-rs/canvas
  return canvas.toBuffer('image/png');
}

// ─── OCR a PNG buffer ─────────────────────────────────────────────────────────

async function ocrImageBuffer(imageBuffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageBuffer);
  return (data.text || '').trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the best available text for a PDF page:
 *   • If the text layer has >= MIN_TEXT_CHARS characters -> return it as-is.
 *   • Otherwise -> render the page to an image and run OCR.
 *   • If OCR itself fails -> log the error and return whatever text we had.
 *
 * The `renderFn` thunk is only called when OCR is actually needed, so normal
 * text-layer pages pay zero rendering cost.
 *
 * @param   {string}   extractedText  Text from pdfjs text layer (may be empty).
 * @param   {Function} renderFn       Async () => Buffer — renders the page to PNG.
 * @param   {number}   pageNum        Page number used only for log messages.
 * @returns {Promise<string>}
 */
async function getPageTextWithOCRFallback(extractedText, renderFn, pageNum) {
  const trimmed = (extractedText || '').trim();

  if (trimmed.length >= MIN_TEXT_CHARS) {
    return trimmed; // text layer is sufficient — skip OCR entirely
  }

  console.log(`[OCR] Page ${pageNum}: sparse text layer (${trimmed.length} chars) — running OCR`);

  try {
    const imageBuffer = await renderFn();
    const ocrText     = await ocrImageBuffer(imageBuffer);

    if (ocrText.length > 0) {
      console.log(`[OCR] Page ${pageNum}: recovered ${ocrText.length} chars via OCR`);
      // Prepend any thin text-layer content so nothing is lost.
      return trimmed.length > 0 ? `${trimmed}\n${ocrText}` : ocrText;
    }

    console.log(`[OCR] Page ${pageNum}: OCR returned empty — page may be decorative`);
    return trimmed;
  } catch (err) {
    // Never crash the pipeline — log and continue with whatever we had.
    console.error(`[OCR] Page ${pageNum}: OCR error — ${err.message}`);
    return trimmed;
  }
}

module.exports = {
  getPageTextWithOCRFallback,
  renderPageToBuffer,
  MIN_TEXT_CHARS,
};
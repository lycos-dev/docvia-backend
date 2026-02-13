/**
 * GROQ SEGMENTATION CONTROLLER - FIXED VERSION
 * AI-Powered Document Segmentation using Groq API (FREE)
 */

const Groq = require('groq-sdk');
const pdfjs = require('pdfjs-dist');
const { supabase } = require('../config/supabase');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function extractPDFText(pdfBuffer) {
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/legacy/build/pdf.worker.min.js');
    
    const pdf = await pdfjs.getDocument({ data: pdfBuffer }).promise;
    let fullText = '';
    const pageCount = pdf.numPages;

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `\n[PAGE ${i}]\n${pageText}`;
    }

    return {
      text: fullText,
      pageCount: pageCount,
      extractedAt: new Date().toISOString()
    };

  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

async function segmentWithGroq(extractedText, fileName) {
  try {
    const truncatedText = extractedText.length > 15000 
      ? extractedText.substring(0, 15000) + '\n... (content truncated for token limit)'
      : extractedText;

    console.log(`[Groq] Segmenting document: ${fileName}`);
    console.log(`[Groq] Text length: ${truncatedText.length} characters`);

    const message = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `You are an expert educational content analyst. Your task is to analyze this academic document and create a learning roadmap.

DOCUMENT NAME: "${fileName}"

DOCUMENT CONTENT:
${truncatedText}

YOUR TASK:
1. Analyze the document structure and content
2. Identify 4-8 logical learning topics/sections
3. Topics should be sequential and build upon each other
4. For each topic, provide:
   - Clear, descriptive title
   - Description of what learners will understand
   - 2-4 key learning points
   - Difficulty level (beginner/intermediate/advanced)
   - Estimated reading time (e.g., "5-10 minutes")

IMPORTANT INSTRUCTIONS:
- Topics should be in reading/learning order
- Make descriptions motivating and clear
- Estimate realistic time for students
- Return ONLY valid JSON, no markdown code blocks, no other text

REQUIRED JSON FORMAT:
{
  "title": "Main document/course title",
  "overview": "2-3 sentence overview of what learner will achieve",
  "segments": [
    {
      "id": 1,
      "title": "Topic title",
      "description": "What the learner will understand after this segment",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
      "difficulty": "beginner",
      "estimatedTime": "5-10 minutes",
      "learningObjectives": ["By the end...", "You will understand..."]
    }
  ],
  "totalSegments": 4,
  "estimatedTotalTime": "45-60 minutes"
}

Remember: Return ONLY the JSON object, nothing else. No code blocks, no markdown.`
        }
      ],
      model: "mixtral-8x7b-32768",
      max_tokens: 2048,
      temperature: 0.7,
      stream: false
    });

    const responseText = message.choices[0].message.content;
    const cleanText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    console.log(`[Groq] Parsing segmentation response...`);
    const segmentData = JSON.parse(cleanText);
    
    console.log(`[Groq] Successfully created ${segmentData.segments.length} segments`);
    
    return segmentData;

  } catch (error) {
    console.error('[Groq] Segmentation error:', error.message);
    throw new Error(`Segmentation failed: ${error.message}`);
  }
}

function fallbackSegmentation(fileName) {
  console.log('[Fallback] Using fallback segmentation');
  
  return {
    title: fileName.replace(/\.pdf$/i, ''),
    overview: "Document divided into sections for guided learning.",
    segments: [
      {
        id: 1,
        title: "Introduction & Overview",
        description: "Get familiar with the document structure and main topics",
        keyPoints: ["Document overview", "Key concepts", "Learning path"],
        difficulty: "beginner",
        estimatedTime: "5-10 minutes",
        learningObjectives: ["Understand document scope and structure"]
      },
      {
        id: 2,
        title: "Core Concepts",
        description: "Learn the main information and foundational concepts",
        keyPoints: ["Key information", "Important concepts", "Examples"],
        difficulty: "intermediate",
        estimatedTime: "20-30 minutes",
        learningObjectives: ["Understand core concepts", "Learn key information"]
      },
      {
        id: 3,
        title: "Advanced Topics",
        description: "Explore deeper topics and complex ideas",
        keyPoints: ["Advanced concepts", "Detailed examples", "Applications"],
        difficulty: "advanced",
        estimatedTime: "15-25 minutes",
        learningObjectives: ["Understand advanced topics", "Apply concepts"]
      },
      {
        id: 4,
        title: "Summary & Review",
        description: "Consolidate and review what you've learned",
        keyPoints: ["Key takeaways", "Review questions", "Next steps"],
        difficulty: "intermediate",
        estimatedTime: "10-15 minutes",
        learningObjectives: ["Consolidate learning", "Identify next steps"]
      }
    ],
    totalSegments: 4,
    estimatedTotalTime: "50-80 minutes",
    isUsingFallback: true
  };
}

async function saveSegmentsToDB(pdfId, userId, segmentData) {
  try {
    console.log(`[Database] Saving segments for ${pdfId}`);

    const { data, error } = await supabase
      .from('document_segments')
      .insert([{
        pdf_id: pdfId,
        user_id: userId,
        title: segmentData.title,
        overview: segmentData.overview,
        segments_json: JSON.stringify(segmentData.segments),
        total_segments: segmentData.totalSegments,
        estimated_total_time: segmentData.estimatedTotalTime,
        segmentation_method: segmentData.isUsingFallback ? 'fallback' : 'groq',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select();

    if (error) throw error;
    
    console.log(`[Database] Segments saved successfully`);
    return data[0];

  } catch (error) {
    console.error('[Database] Save error:', error.message);
    throw new Error(`Database save failed: ${error.message}`);
  }
}

async function getExistingSegments(pdfId, userId) {
  try {
    const { data, error } = await supabase
      .from('document_segments')
      .select('*')
      .eq('pdf_id', pdfId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;

  } catch (error) {
    console.warn('[Cache] Error fetching segments:', error.message);
    return null;
  }
}

async function segmentPDFEndpoint(req, res) {
  try {
    const { pdfId, userId } = req.body;

    if (!pdfId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['pdfId', 'userId']
      });
    }

    console.log(`\n[Segmentation] Starting segmentation for ${pdfId}`);

    const existing = await getExistingSegments(pdfId, userId);
    if (existing) {
      console.log(`[Cache] Found existing segmentation`);
      return res.status(200).json({
        success: true,
        message: 'Using cached segmentation (instant)',
        cached: true,
        data: {
          id: existing.id,
          title: existing.title,
          overview: existing.overview,
          segments: JSON.parse(existing.segments_json),
          totalSegments: existing.total_segments,
          estimatedTime: existing.estimated_total_time,
          method: existing.segmentation_method,
          cost: '$0.00 (free)',
          createdAt: existing.created_at
        }
      });
    }

    console.log(`[Storage] Downloading PDF from Supabase...`);
    const { data: pdfData, error: downloadError } = await supabase
      .storage
      .from('academic-pdfs')
      .download(`pdfs/${pdfId}`);

    if (downloadError) {
      console.error('[Storage] Download error:', downloadError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to download PDF',
        details: downloadError.message
      });
    }

    console.log(`[PDF] Extracting text from PDF...`);
    let extractionResult;
    try {
      extractionResult = await extractPDFText(Buffer.from(pdfData));
      console.log(`[PDF] Extracted ${extractionResult.pageCount} pages, ${extractionResult.text.length} characters`);
    } catch (extractError) {
      console.warn('[PDF] Extraction failed, using fallback');
      const fallbackSegments = fallbackSegmentation(pdfId);
      const saved = await saveSegmentsToDB(pdfId, userId, fallbackSegments);
      
      return res.status(200).json({
        success: true,
        message: 'Segmented with fallback method',
        warning: 'PDF text extraction had issues, using basic segmentation',
        data: {
          ...fallbackSegments,
          id: saved.id,
          cost: '$0.00 (free)'
        }
      });
    }

    console.log(`[AI] Sending to Groq for segmentation...`);
    let segmentData;
    try {
      segmentData = await segmentWithGroq(extractionResult.text, pdfId);
      console.log(`[AI] Groq segmentation successful`);
    } catch (groqError) {
      console.warn('[AI] Groq segmentation failed, using fallback:', groqError.message);
      segmentData = fallbackSegmentation(pdfId);
    }

    console.log(`[Database] Saving segmentation to database...`);
    const saved = await saveSegmentsToDB(pdfId, userId, segmentData);

    console.log(`[Success] Segmentation completed successfully\n`);
    
    res.status(200).json({
      success: true,
      message: 'Document segmented successfully',
      cached: false,
      data: {
        id: saved.id,
        title: segmentData.title,
        overview: segmentData.overview,
        segments: segmentData.segments,
        totalSegments: segmentData.totalSegments,
        estimatedTime: segmentData.estimatedTotalTime,
        method: segmentData.isUsingFallback ? 'fallback' : 'groq-free',
        cost: '$0.00 (completely free)',
        createdAt: saved.created_at
      }
    });

  } catch (error) {
    console.error('[Error] Segmentation error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Segmentation failed',
      message: error.message
    });
  }
}

async function getSegmentsEndpoint(req, res) {
  try {
    const { pdfId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const existing = await getExistingSegments(pdfId, userId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Segmentation not found',
        message: 'This PDF has not been segmented yet'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: existing.id,
        pdfId: existing.pdf_id,
        title: existing.title,
        overview: existing.overview,
        segments: JSON.parse(existing.segments_json),
        totalSegments: existing.total_segments,
        estimatedTime: existing.estimated_total_time,
        method: existing.segmentation_method,
        cost: '$0.00 (free)',
        createdAt: existing.created_at,
        updatedAt: existing.updated_at
      }
    });

  } catch (error) {
    console.error('[Error] Get segments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve segments',
      message: error.message
    });
  }
}

async function deleteSegmentsEndpoint(req, res) {
  try {
    const { pdfId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { error } = await supabase
      .from('document_segments')
      .delete()
      .eq('pdf_id', pdfId)
      .eq('user_id', userId);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Segmentation deleted successfully'
    });

  } catch (error) {
    console.error('[Error] Delete segments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete segments',
      message: error.message
    });
  }
}

module.exports = {
  segmentPDFEndpoint,
  getSegmentsEndpoint,
  deleteSegmentsEndpoint,
  segmentWithGroq,
  extractPDFText,
  saveSegmentsToDB,
  getExistingSegments,
  fallbackSegmentation
};
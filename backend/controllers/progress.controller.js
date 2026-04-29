/**
 * PROGRESS CONTROLLER
 * Persists per-user, per-document segment completion state in Supabase.
 *
 * Table: user_progress
 *   id            uuid  PK
 *   user_id       text
 *   pdf_id        text
 *   completed_ids jsonb  -- array of completed segment IDs, e.g. [1, 3]
 *   updated_at    timestamptz
 *   UNIQUE (user_id, pdf_id)
 */

const { supabase } = require('../config/supabase');

// ─── SAVE PROGRESS ────────────────────────────────────────────────────────────

/**
 * POST /api/pdf/progress
 * Body: { pdfId, userId, completedIds: [1, 2, 3] }
 *
 * Upserts the completed segment IDs for this user+PDF combination.
 * Uses Supabase's onConflict upsert so a single call handles both
 * first-save and updates without needing a separate "create" step.
 */
async function saveProgressEndpoint(req, res) {
  try {
    const { pdfId, userId, completedIds } = req.body;

    if (!pdfId || !userId || !Array.isArray(completedIds)) {
      return res.status(400).json({
        success:  false,
        error:    'Missing or invalid fields',
        required: ['pdfId', 'userId', 'completedIds (array)'],
      });
    }

    console.log(`[Progress] Saving for user ${userId}, pdf ${pdfId}: [${completedIds.join(', ')}]`);

    const { data, error } = await supabase
      .from('user_progress')
      .upsert(
        {
          user_id:       userId,
          pdf_id:        pdfId,
          completed_ids: completedIds,
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'user_id,pdf_id' }
      )
      .select();

    if (error) {
      console.error('[Progress] Save error:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to save progress', message: error.message });
    }

    console.log(`[Progress] Saved — ${completedIds.length} segment(s) complete`);

    res.status(200).json({
      success:      true,
      message:      'Progress saved',
      completedIds: completedIds,
      updatedAt:    data?.[0]?.updated_at,
    });

  } catch (error) {
    console.error('[Progress] Unexpected error:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
}

// ─── LOAD PROGRESS ────────────────────────────────────────────────────────────

/**
 * GET /api/pdf/progress/:pdfId?userId=...
 *
 * Returns the saved completed segment IDs for this user+PDF.
 * Returns an empty array if no progress has been saved yet —
 * this is not an error, it just means the user hasn't started.
 */
async function getProgressEndpoint(req, res) {
  try {
    const { pdfId }  = req.params;
    const { userId } = req.query;

    if (!pdfId || !userId) {
      return res.status(400).json({
        success:  false,
        error:    'Missing required params',
        required: ['pdfId (path)', 'userId (query)'],
      });
    }

    const { data, error } = await supabase
      .from('user_progress')
      .select('completed_ids, updated_at')
      .eq('user_id', userId)
      .eq('pdf_id', pdfId)
      .maybeSingle();

    if (error) {
      console.error('[Progress] Fetch error:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to fetch progress', message: error.message });
    }

    // No row = no progress yet, return empty array (not a 404)
    const completedIds = data?.completed_ids ?? [];
    const updatedAt    = data?.updated_at    ?? null;

    res.status(200).json({
      success:      true,
      completedIds: completedIds,
      updatedAt:    updatedAt,
    });

  } catch (error) {
    console.error('[Progress] Unexpected error:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
}


// ─── ALL PROGRESS FOR A USER ─────────────────────────────────────────────────

/**
 * GET /api/pdf/progress?userId=...
 *
 * Returns every progress row for a user — one per document they have started.
 * The frontend uses this to build the progress visualization dashboard.
 */
async function getAllProgressEndpoint(req, res) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success:false, error:'Missing userId query param' });
    }

    const { data, error } = await supabase
      .from('user_progress')
      .select('pdf_id, completed_ids, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[Progress] getAllProgress error:', error.message);
      return res.status(500).json({ success:false, error:'Failed to fetch progress', message:error.message });
    }

    res.status(200).json({
      success:   true,
      progress:  data || [],   // [{ pdf_id, completed_ids, updated_at }]
    });

  } catch (error) {
    console.error('[Progress] Unexpected error:', error.message);
    res.status(500).json({ success:false, error:'Internal server error', message:error.message });
  }
}

module.exports = {
  saveProgressEndpoint,
  getProgressEndpoint,
  getAllProgressEndpoint,
};
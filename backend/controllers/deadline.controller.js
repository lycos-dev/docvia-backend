/**
 * DEADLINE CONTROLLER
 * 
 * Handles document deadlines:
 * - Set a target date to finish a document
 * - Check and send reminders
 * - Apply penalties for missed deadlines
 */

const { supabase, supabaseAdmin } = require('../config/supabase');

const db = () => (supabaseAdmin || supabase);

// Default deadline in days
const DEFAULT_DEADLINE_DAYS = 7;
const REMINDER_24H_BEFORE_MS = 24 * 60 * 60 * 1000;
const REMINDER_1H_BEFORE_MS = 60 * 60 * 1000;
const PENALTY_STREAK_DAYS = 1;

// ── SET DEADLINE ─────────────────────────────────────────────────────────
async function setDeadlineEndpoint(req, res) {
  const userId = req.user.id;
  const { pdfId, deadline } = req.body;

  if (!pdfId) {
    return res.status(400).json({ success: false, error: 'pdfId is required' });
  }

  if (!deadline) {
    return res.status(400).json({ success: false, error: 'deadline date is required' });
  }

  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime())) {
    return res.status(400).json({ success: false, error: 'Invalid deadline date format' });
  }

  if (deadlineDate <= new Date()) {
    return res.status(400).json({ success: false, error: 'Deadline must be in the future' });
  }

  try {
    const row = {
      user_id: userId,
      pdf_id: pdfId,
      deadline: deadlineDate.toISOString(),
      reminder_sent: false,
      reminder_24h_sent: false,
      reminder_1h_sent: false,
      penalty_applied: false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db()
      .from('document_deadlines')
      .upsert(row, { onConflict: 'user_id,pdf_id' })
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: {
        id: data.id,
        pdfId: data.pdf_id,
        deadline: data.deadline,
        createdAt: data.created_at,
      },
      message: `Deadline set for ${deadlineDate.toLocaleDateString()}`,
    });
  } catch (err) {
    console.error('[Deadline] Set error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to set deadline', message: err.message });
  }
}

// ── GET DEADLINE ─────────────────────────────────────────────────────────
async function getDeadlineEndpoint(req, res) {
  const userId = req.user.id;
  const { pdfId } = req.params;

  if (!pdfId) {
    return res.status(400).json({ success: false, error: 'pdfId is required' });
  }

  try {
    const { data, error } = await db()
      .from('document_deadlines')
      .select('*')
      .eq('user_id', userId)
      .eq('pdf_id', pdfId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'No deadline set', message: 'Set a deadline first' });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: data.id,
        pdfId: data.pdf_id,
        deadline: data.deadline,
        penaltyApplied: data.penalty_applied,
        createdAt: data.created_at,
      },
    });
  } catch (err) {
    console.error('[Deadline] Get error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to get deadline', message: err.message });
  }
}

// ── GET ALL DEADLINES ──────────────────────────────────────────────
async function getAllDeadlinesEndpoint(req, res) {
  const userId = req.user.id;

  try {
    const { data, error } = await db()
      .from('document_deadlines')
      .select('*')
      .eq('user_id', userId)
      .order('deadline', { ascending: true });

    if (error) throw error;

    const now = new Date();
    const deadlines = (data || []).map(d => ({
      id: d.id,
      pdfId: d.pdf_id,
      deadline: d.deadline,
      isOverdue: new Date(d.deadline) < now && !d.penalty_applied,
      isPenaltyApplied: d.penalty_applied,
      createdAt: d.created_at,
    }));

    return res.status(200).json({ success: true, data: deadlines });
  } catch (err) {
    console.error('[Deadline] Get all error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to get deadlines', message: err.message });
  }
}

// ── DELETE DEADLINE ─────────────────────────────────────────────
async function deleteDeadlineEndpoint(req, res) {
  const userId = req.user.id;
  const { pdfId } = req.params;

  if (!pdfId) {
    return res.status(400).json({ success: false, error: 'pdfId is required' });
  }

  try {
    const { error } = await db()
      .from('document_deadlines')
      .delete()
      .eq('user_id', userId)
      .eq('pdf_id', pdfId);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Deadline removed' });
  } catch (err) {
    console.error('[Deadline] Delete error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete deadline', message: err.message });
  }
}

// ── CHECK AND APPLY PENALTIES (called by cron job) ─────────────────────
async function checkDeadlinesAndApplyPenalties() {
  console.log('[Deadline] Checking for overdue deadlines...');

  const now = new Date();

  try {
    // Find deadlines that have passed and haven't had penalty applied
    const { data: overdueRows, error: queryError } = await db()
      .from('document_deadlines')
      .select('*')
      .lt('deadline', now.toISOString())
      .eq('penalty_applied', false);

    if (queryError) {
      console.error('[Deadline] Query error:', queryError.message);
      return;
    }

    if (!overdueRows || overdueRows.length === 0) {
      console.log('[Deadline] No overdue deadlines');
      return;
    }

    console.log(`[Deadline] Found ${overdueRows.length} overdue deadlines`);

    for (const row of overdueRows) {
      try {
        // Apply penalty: reduce streak
        console.log(`[Deadline] Applying penalty for ${row.pdf_id} (user: ${row.user_id})`);

        // Get current progress to find streak
        const { data: progress } = await db()
          .from('user_progress')
          .select('streak_days')
          .eq('user_id', row.user_id)
          .eq('pdf_id', row.pdf_id)
          .maybeSingle();

        const currentStreak = progress?.streak_days || 0;
        const newStreak = Math.max(0, currentStreak - PENALTY_STREAK_DAYS);

        // Update progress
        await db()
          .from('user_progress')
          .upsert({
            user_id: row.user_id,
            pdf_id: row.pdf_id,
            streak_days: newStreak,
            updated_at: now.toISOString(),
          }, { onConflict: 'user_id,pdf_id' });

        // Mark penalty as applied
        await db()
          .from('document_deadlines')
          .update({ penalty_applied: true, updated_at: now.toISOString() })
          .eq('id', row.id);

        console.log(`[Deadline] Penalty applied: streak ${currentStreak} → ${newStreak} for ${row.pdf_id}`);
      } catch (err) {
        console.error(`[Deadline] Penalty error for ${row.pdf_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Deadline] Check error:', err.message);
  }
}

// ── CHECK REMINDERS ────────────────────────────────────────────────
async function checkReminders() {
  console.log('[Deadline] Checking for upcoming deadlines...');

  const now = new Date();

  try {
    // Get all non-penalized deadlines
    const { data: rows, error } = await db()
      .from('document_deadlines')
      .select('*')
      .eq('penalty_applied', false);

    if (error) {
      console.error('[Deadline] Reminder query error:', error.message);
      return;
    }

    for (const row of rows || []) {
      const deadline = new Date(row.deadline);
      const timeUntil = deadline.getTime() - now.getTime();

      // 24 hour reminder
      if (timeUntil <= REMINDER_24H_BEFORE_MS && timeUntil > 0 && !row.reminder_24h_sent) {
        console.log(`[Deadline] 24h reminder for ${row.pdf_id}`);
        // Queue notification (for now just log - integrate with push notifications later)
        await db()
          .from('document_deadlines')
          .update({ reminder_24h_sent: true, updated_at: now.toISOString() })
          .eq('id', row.id);
      }

      // 1 hour reminder
      if (timeUntil <= REMINDER_1H_BEFORE_MS && timeUntil > 0 && !row.reminder_1h_sent) {
        console.log(`[Deadline] 1h reminder for ${row.pdf_id}`);
        await db()
          .from('document_deadlines')
          .update({ reminder_1h_sent: true, updated_at: now.toISOString() })
          .eq('id', row.id);
      }
    }
  } catch (err) {
    console.error('[Deadline] Reminder check error:', err.message);
  }
}

module.exports = {
  setDeadlineEndpoint,
  getDeadlineEndpoint,
  getAllDeadlinesEndpoint,
  deleteDeadlineEndpoint,
  checkDeadlinesAndApplyPenalties,
  checkReminders,
};
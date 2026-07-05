const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { runBulkCampaign } = require('../whatsapp/bulkSender');

// POST /api/bulk/send  { numbers: string[], message: string, minDelayMs?, maxDelayMs? }
// Starts a bulk campaign in the background and returns immediately with
// a campaignId the UI can poll for progress. Numbers are never dumped
// into a single Firestore doc as an array we'd have to reload fully -
// progress/failures are tracked incrementally instead.
router.post('/send', async (req, res) => {
  try {
    const { numbers, message, minDelayMs, maxDelayMs } = req.body;
    if (!Array.isArray(numbers) || !numbers.length || !message) {
      return res.status(400).json({ ok: false, error: 'numbers[] and message are required' });
    }
    if (numbers.length > 2000) {
      return res.status(400).json({ ok: false, error: 'Max 2000 numbers per campaign - split into batches to stay ban-safe.' });
    }

    const campaignId = `camp_${Date.now()}`;

    // Fire-and-forget: the HTTP response returns immediately, the actual
    // sending (with random delays) continues in the background.
    runBulkCampaign(campaignId, numbers, message, { minDelayMs, maxDelayMs }).catch((err) =>
      console.error('[bulk] campaign crashed:', err)
    );

    res.json({ ok: true, campaignId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/bulk/:campaignId - poll progress
router.get('/:campaignId', async (req, res) => {
  try {
    const doc = await db.collection('bulk_campaigns').doc(req.params.campaignId).get();
    if (!doc.exists) return res.status(404).json({ ok: false, error: 'campaign not found' });
    res.json({ ok: true, campaign: doc.data() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;

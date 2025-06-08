import { Router } from 'express';
import { storageService } from '../services/storage-service';

const router = Router();

// === CAMPAIGN ROUTES ===

// Get all leads (for enrolling)
router.get('/all-leads', async (_req, res) => {
  try {
    const leads = await storageService.getAllLeads();
    res.json(leads);
  } catch (error) {
    console.error('Failed to get leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads.' });
  }
});

// Get all campaigns
router.get('/', async (_req, res) => {
  try {
    const campaigns = await storageService.getCampaigns();
    res.status(200).json(campaigns);
  } catch (error) {
    console.error('Failed to get campaigns:', error);
    res.status(500).json({ error: 'Failed to get campaigns.' });
  }
});

// Get a single campaign by ID
router.get('/:campaignId', async (req, res) => {
  const { campaignId } = req.params;
  try {
    const campaign = await storageService.getCampaignById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }
    res.status(200).json(campaign);
  } catch (error) {
    console.error(`Failed to get campaign ${campaignId}:`, error);
    res.status(500).json({ error: 'Failed to get campaign.' });
  }
});

// Fetch all leads
router.get('/:campaignId/leads/all', async (req, res) => {
  try {
    const leads = await storageService.getAllLeads();
    res.status(200).json(leads);
  } catch (error) {
    console.error('Failed to get all leads:', error);
    res.status(500).json({ error: 'Failed to get all leads.' });
  }
});

// Fetch enrolled leads for a campaign
router.get('/:campaignId/leads/enrolled', async (req, res) => {
  const { campaignId } = req.params;
  try {
    const leads = await storageService.getEnrolledLeads(campaignId);
    res.status(200).json(leads);
  } catch (error) {
    console.error('Failed to get enrolled leads:', error);
    res.status(500).json({ error: 'Failed to get enrolled leads.' });
  }
});

// Update campaign (edit name, goal, status)
router.patch('/:campaignId', async (req, res) => {
  const { campaignId } = req.params;
  try {
    const campaign = await storageService.updateCampaign(campaignId, req.body);
    res.status(200).json(campaign);
  } catch (error) {
    console.error('Failed to update campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign.' });
  }
});

// Delete campaign
router.delete('/:campaignId', async (req, res) => {
  const { campaignId } = req.params;
  try {
    await storageService.deleteCampaign(campaignId);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign.' });
  }
});

// Clone campaign
router.post('/:campaignId/clone', async (req, res) => {
  const { campaignId } = req.params;
  try {
    const newCampaign = await storageService.cloneCampaign(campaignId);
    res.status(201).json(newCampaign);
  } catch (error) {
    console.error('Failed to clone campaign:', error);
    res.status(500).json({ error: 'Failed to clone campaign.' });
  }
});

// Create a new campaign
router.post('/', async (req, res) => {
  const { name, goal_prompt } = req.body;
  if (!name || !goal_prompt) {
    return res.status(400).json({ error: 'Campaign name and goal_prompt are required.' });
  }
  try {
    const campaign = await storageService.createCampaign(name, goal_prompt);
    res.status(201).json(campaign);
  } catch (error) {
    console.error('Failed to create campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign.' });
  }
});

// Add an email template to a campaign
router.post('/:campaignId/templates', async (req, res) => {
  const { campaignId } = req.params;
  const { subject, body, sequence_order, delay_hours } = req.body;

  if (!subject || !body || !sequence_order) {
    return res.status(400).json({ error: 'Subject, body, and sequence_order are required.' });
  }

  try {
    const template = { subject, body, sequence_order, delay_hours };
    const newTemplate = await storageService.addEmailTemplate(campaignId, template);
    res.status(201).json(newTemplate);
  } catch (error) {
    console.error(`Failed to add template to campaign ${campaignId}:`, error);
    res.status(500).json({ error: 'Failed to add email template.' });
  }
});

// Enroll leads into a campaign
router.post('/:campaignId/enroll', async (req, res) => {
  const { campaignId } = req.params;
  const { leadIds } = req.body;

  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'An array of leadIds is required.' });
  }

  try {
    const result = await storageService.enrollLeadsInCampaign(campaignId, leadIds);
    res.status(200).json(result);
  } catch (error) {
    console.error(`Failed to enroll leads in campaign ${campaignId}:`, error);
    res.status(500).json({ error: 'Failed to enroll leads.' });
  }
});

export default router;

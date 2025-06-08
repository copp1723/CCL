import express from 'express';
import { storageService } from './services/storage-service';
import { sendSuccess, sendServerError } from './utils/response-formatter';
import { apiAuth } from './middleware/auth';

const app = express();
app.use(express.json());
app.use(apiAuth);

app.get('/health', async (_req, res) => {
  try {
    const result = await storageService.healthCheck();
    sendSuccess(res, result);
  } catch (err) {
    sendServerError(res, 'Failed to run health check');
  }
});

app.get('/leads', async (_req, res) => {
  try {
    const leads = await storageService.getLeads();
    sendSuccess(res, leads);
  } catch (err) {
    sendServerError(res, 'Failed to fetch leads');
  }
});

app.post('/leads', async (req, res) => {
  try {
    const lead = await storageService.createLead(req.body);
    sendSuccess(res, lead, 201);
  } catch (err: any) {
    sendServerError(res, err.message);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;

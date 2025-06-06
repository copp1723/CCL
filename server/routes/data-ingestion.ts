import { Router } from 'express';
import { storage } from '../database-storage';
import { handleApiError } from '../utils/error-handler';
import { sanitizeEmail, sanitizeJsonData } from '../utils/input-sanitizer';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// Manual lead data upload
router.post('/leads/manual', async (req, res) => {
  try {
    const { leads } = req.body;

    if (!leads || !Array.isArray(leads)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_001',
          message: 'Leads array is required',
          category: 'validation'
        }
      });
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const leadData of leads) {
      try {
        const { email, firstName, lastName, vehicleInterest, phoneNumber, notes } = leadData;

        if (!email) {
          results.push({
            email: leadData.email,
            success: false,
            error: 'Email is required'
          });
          failureCount++;
          continue;
        }

        const sanitizedEmail = sanitizeEmail(email);
        if (!sanitizedEmail) {
          results.push({
            email: leadData.email,
            success: false,
            error: 'Invalid email format'
          });
          failureCount++;
          continue;
        }

        const processedLeadData = {
          email: sanitizedEmail,
          firstName: firstName?.trim() || '',
          lastName: lastName?.trim() || '',
          vehicleInterest: vehicleInterest?.trim() || 'Not specified',
          phoneNumber: phoneNumber?.trim() || '',
          notes: notes?.trim() || '',
          source: 'manual_upload',
          uploadedAt: new Date().toISOString()
        };

        const newLead = await storage.createLead({
          email: sanitizedEmail,
          status: 'new',
          leadData: sanitizeJsonData(processedLeadData)
        });

        results.push({
          email: sanitizedEmail,
          leadId: newLead.id,
          success: true
        });
        successCount++;

      } catch (error: any) {
        results.push({
          email: leadData.email,
          success: false,
          error: error.message
        });
        failureCount++;
      }
    }

    await storage.createActivity(
      'manual_upload_completed',
      `Manual lead upload: ${successCount} success, ${failureCount} failed`,
      'system',
      { totalLeads: leads.length, successCount, failureCount }
    );

    res.json({
      success: true,
      data: {
        totalProcessed: leads.length,
        successCount,
        failureCount,
        results
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    handleApiError(res, error);
  }
});

// CSV file upload
router.post('/leads/csv', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_001',
          message: 'CSV file is required',
          category: 'validation'
        }
      });
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    const csvData: any[] = [];
    const stream = Readable.from(req.file.buffer);

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => csvData.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    for (const row of csvData) {
      try {
        const email = row.email || row.Email || row.EMAIL;
        const firstName = row.firstName || row.first_name || row['First Name'] || row.FirstName;
        const lastName = row.lastName || row.last_name || row['Last Name'] || row.LastName;
        const vehicleInterest = row.vehicleInterest || row.vehicle_interest || row['Vehicle Interest'] || row.VehicleInterest;
        const phoneNumber = row.phoneNumber || row.phone_number || row['Phone Number'] || row.PhoneNumber || row.phone;
        const notes = row.notes || row.Notes || row.NOTES;

        if (!email) {
          results.push({
            row: csvData.indexOf(row) + 1,
            success: false,
            error: 'Email is required'
          });
          failureCount++;
          continue;
        }

        const sanitizedEmail = sanitizeEmail(email);
        if (!sanitizedEmail) {
          results.push({
            email,
            row: csvData.indexOf(row) + 1,
            success: false,
            error: 'Invalid email format'
          });
          failureCount++;
          continue;
        }

        const processedLeadData = {
          email: sanitizedEmail,
          firstName: firstName?.toString().trim() || '',
          lastName: lastName?.toString().trim() || '',
          vehicleInterest: vehicleInterest?.toString().trim() || 'Not specified',
          phoneNumber: phoneNumber?.toString().trim() || '',
          notes: notes?.toString().trim() || '',
          source: 'csv_upload',
          uploadedAt: new Date().toISOString(),
          originalRow: csvData.indexOf(row) + 1
        };

        const newLead = await storage.createLead({
          email: sanitizedEmail,
          status: 'new',
          leadData: sanitizeJsonData(processedLeadData)
        });

        results.push({
          email: sanitizedEmail,
          leadId: newLead.id,
          row: csvData.indexOf(row) + 1,
          success: true
        });
        successCount++;

      } catch (error: any) {
        results.push({
          row: csvData.indexOf(row) + 1,
          success: false,
          error: error.message
        });
        failureCount++;
      }
    }

    await storage.createActivity(
      'csv_upload_completed',
      `CSV upload: ${successCount} success, ${failureCount} failed from ${csvData.length} rows`,
      'system',
      { 
        fileName: req.file.originalname,
        totalRows: csvData.length,
        successCount,
        failureCount
      }
    );

    res.json({
      success: true,
      data: {
        fileName: req.file.originalname,
        totalRows: csvData.length,
        successCount,
        failureCount,
        results
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    handleApiError(res, error);
  }
});

// SFTP endpoint simulation (webhook for SFTP processing)
router.post('/leads/sftp-webhook', async (req, res) => {
  try {
    const { fileName, leads, source } = req.body;

    if (!leads || !Array.isArray(leads)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_001',
          message: 'Leads array is required',
          category: 'validation'
        }
      });
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const leadData of leads) {
      try {
        const { email, firstName, lastName, vehicleInterest, phoneNumber, metadata } = leadData;

        if (!email) {
          results.push({
            email: leadData.email,
            success: false,
            error: 'Email is required'
          });
          failureCount++;
          continue;
        }

        const sanitizedEmail = sanitizeEmail(email);
        if (!sanitizedEmail) {
          results.push({
            email: leadData.email,
            success: false,
            error: 'Invalid email format'
          });
          failureCount++;
          continue;
        }

        const processedLeadData = {
          email: sanitizedEmail,
          firstName: firstName?.trim() || '',
          lastName: lastName?.trim() || '',
          vehicleInterest: vehicleInterest?.trim() || 'Not specified',
          phoneNumber: phoneNumber?.trim() || '',
          source: source || 'sftp_import',
          importedAt: new Date().toISOString(),
          fileName: fileName || 'unknown',
          metadata: sanitizeJsonData(metadata || {})
        };

        const newLead = await storage.createLead({
          email: sanitizedEmail,
          status: 'new',
          leadData: sanitizeJsonData(processedLeadData)
        });

        results.push({
          email: sanitizedEmail,
          leadId: newLead.id,
          success: true
        });
        successCount++;

      } catch (error: any) {
        results.push({
          email: leadData.email,
          success: false,
          error: error.message
        });
        failureCount++;
      }
    }

    await storage.createActivity(
      'sftp_import_completed',
      `SFTP import from ${fileName}: ${successCount} success, ${failureCount} failed`,
      'system',
      { 
        fileName,
        source,
        totalLeads: leads.length,
        successCount,
        failureCount
      }
    );

    res.json({
      success: true,
      data: {
        fileName,
        source,
        totalProcessed: leads.length,
        successCount,
        failureCount,
        results
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    handleApiError(res, error);
  }
});

// Email-based lead capture (simulates Mailgun webhook)
router.post('/leads/email-capture', async (req, res) => {
  try {
    const { sender, subject, body, timestamp, messageId } = req.body;

    if (!sender) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_001',
          message: 'Sender email is required',
          category: 'validation'
        }
      });
    }

    const sanitizedEmail = sanitizeEmail(sender);
    if (!sanitizedEmail) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_002',
          message: 'Invalid sender email format',
          category: 'validation'
        }
      });
    }

    // Extract information from email content if possible
    const extractedInfo = extractInfoFromEmail(body || '', subject || '');

    const processedLeadData = {
      email: sanitizedEmail,
      firstName: extractedInfo.firstName || '',
      lastName: extractedInfo.lastName || '',
      vehicleInterest: extractedInfo.vehicleInterest || 'Email inquiry',
      phoneNumber: extractedInfo.phoneNumber || '',
      source: 'email_capture',
      capturedAt: timestamp || new Date().toISOString(),
      messageId: messageId || '',
      originalSubject: subject || '',
      originalBody: body || '',
      extractedInfo
    };

    const newLead = await storage.createLead({
      email: sanitizedEmail,
      status: 'new',
      leadData: sanitizeJsonData(processedLeadData)
    });

    await storage.createActivity(
      'email_lead_captured',
      `Lead captured from email: ${sanitizedEmail}`,
      'system',
      { 
        leadId: newLead.id,
        messageId,
        subject,
        extractedInfo
      }
    );

    res.json({
      success: true,
      data: {
        leadId: newLead.id,
        email: sanitizedEmail,
        extractedInfo,
        status: 'captured'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    handleApiError(res, error);
  }
});

// Helper function to extract information from email content
function extractInfoFromEmail(body: string, subject: string): any {
  const info: any = {};
  
  // Extract phone number
  const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
  const phoneMatch = body.match(phoneRegex);
  if (phoneMatch) {
    info.phoneNumber = phoneMatch[0];
  }
  
  // Extract vehicle interest from keywords
  const vehicleKeywords = ['truck', 'suv', 'sedan', 'car', 'vehicle', 'auto', 'honda', 'toyota', 'ford', 'chevrolet'];
  for (const keyword of vehicleKeywords) {
    if (body.toLowerCase().includes(keyword) || subject.toLowerCase().includes(keyword)) {
      info.vehicleInterest = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      break;
    }
  }
  
  // Extract name patterns
  const nameRegex = /(?:my name is|i'm|i am)\s+([a-zA-Z]+)(?:\s+([a-zA-Z]+))?/i;
  const nameMatch = body.match(nameRegex);
  if (nameMatch) {
    info.firstName = nameMatch[1];
    if (nameMatch[2]) {
      info.lastName = nameMatch[2];
    }
  }
  
  return info;
}

// Get data ingestion statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await storage.getStats();
    const activities = await storage.getActivities(50);
    
    const ingestionActivities = activities.filter(activity => 
      activity.type.includes('upload') || 
      activity.type.includes('import') || 
      activity.type.includes('capture')
    );

    const ingestionStats = {
      totalLeads: stats.leads,
      recentIngestionActivities: ingestionActivities.length,
      lastIngestion: ingestionActivities[0]?.timestamp || null,
      ingestionSources: {}
    };

    // Count leads by source
    const leads = await storage.getLeads();
    for (const lead of leads) {
      const source = lead.leadData?.source || 'unknown';
      ingestionStats.ingestionSources[source] = (ingestionStats.ingestionSources[source] || 0) + 1;
    }

    res.json({
      success: true,
      data: ingestionStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    handleApiError(res, error);
  }
});

export default router;
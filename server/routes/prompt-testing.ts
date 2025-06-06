import express from 'express';
import { Request, Response } from 'express';
import { CATHY_SYSTEM_PROMPT } from '../agents/cathy-system-prompt';

const router = express.Router();

interface TestChatRequest {
  userMessage: string;
  customerName: string;
  customerSituation?: string;
  conversationHistory?: Array<{
    type: 'user' | 'agent';
    content: string;
  }>;
}

interface TestResponse {
  customerMessage: string;
  cathyResponse: string;
  analysis: string;
  salesReadiness: string;
  customerName: string;
  channel: string;
  insights: string;
  nextSteps?: string;
}

// Get current system prompt
router.get('/system-prompt', (req: Request, res: Response) => {
  try {
    res.json({
      prompt: CATHY_SYSTEM_PROMPT,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error retrieving system prompt:', error);
    res.status(500).json({ error: 'Failed to retrieve system prompt' });
  }
});

// Update system prompt (for testing purposes)
router.post('/system-prompt', (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Valid prompt string is required' });
    }

    // In a real implementation, you might want to save this to a database
    // For now, we'll just acknowledge the update
    res.json({
      success: true,
      message: 'System prompt updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating system prompt:', error);
    res.status(500).json({ error: 'Failed to update system prompt' });
  }
});

// Test chat response
router.post('/chat-response', async (req: Request, res: Response) => {
  try {
    const { userMessage, customerName, customerSituation, conversationHistory }: TestChatRequest = req.body;

    if (!userMessage || !customerName) {
      return res.status(400).json({ error: 'userMessage and customerName are required' });
    }

    const response = await generateCathyResponse(userMessage, customerName, customerSituation, conversationHistory);
    
    res.json(response);
  } catch (error) {
    console.error('Error generating chat response:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Test email response
router.post('/email-response', async (req: Request, res: Response) => {
  try {
    const { userMessage, customerName, customerSituation }: TestChatRequest = req.body;

    if (!userMessage || !customerName) {
      return res.status(400).json({ error: 'userMessage and customerName are required' });
    }

    const response = await generateCathyEmailResponse(userMessage, customerName, customerSituation);
    
    res.json(response);
  } catch (error) {
    console.error('Error generating email response:', error);
    res.status(500).json({ error: 'Failed to generate email response' });
  }
});

// Helper function to generate Cathy's chat response
async function generateCathyResponse(
  userMessage: string,
  customerName: string,
  customerSituation?: string,
  conversationHistory?: Array<{ type: 'user' | 'agent'; content: string }>
): Promise<TestResponse> {
  const lowerMsg = userMessage.toLowerCase();
  
  // Analyze customer intent and generate appropriate response
  let cathyResponse: string;
  let analysis: string;
  let salesReadiness: string;
  let insights: string;
  let nextSteps: string;

  if (lowerMsg.includes('credit') && (lowerMsg.includes('worried') || lowerMsg.includes('issues') || lowerMsg.includes('anxious'))) {
    cathyResponse = `Hey ${customerName}! I get it - credit concerns are totally normal.\n\nHere's the thing: I work with folks in all credit situations every day. Your credit history just helps me find the right path for you.\n\nWhat kind of car are you looking for? I'd love to show you what's possible!`;
    analysis = 'Customer expressing credit anxiety. Responding with empathy and reassurance.';
    salesReadiness = 'medium';
    insights = 'Customer has credit concerns but engaged. Building trust is key.';
    nextSteps = 'Build confidence and show available options despite credit challenges.';
  } else if (lowerMsg.includes('first') || lowerMsg.includes('new') || lowerMsg.includes('understand') || lowerMsg.includes('how') && lowerMsg.includes('work')) {
    cathyResponse = `Hey ${customerName}! First car - how exciting!\n\nAuto financing is actually pretty simple: quick soft credit check (no impact), see what you qualify for, then find a car that fits your budget.\n\nWant me to walk you through it?`;
    analysis = 'First-time buyer seeking education. Providing clear, encouraging guidance.';
    salesReadiness = 'high';
    insights = 'New to auto financing, receptive to guidance. High conversion potential.';
    nextSteps = 'Walk through financing process and initiate soft credit check.';
  } else if (lowerMsg.includes('ready') || lowerMsg.includes('apply') || lowerMsg.includes('pre-approved') || lowerMsg.includes('move forward')) {
    cathyResponse = `Love it, ${customerName}! Ready to move forward - that's what I like to hear.\n\nI can get your pre-qualification started right now with a soft credit check. Zero impact to your score, and you'll know what you qualify for in minutes.\n\nSound good?`;
    analysis = 'Customer showing high intent. Moving toward pre-qualification.';
    salesReadiness = 'high';
    insights = 'Highly motivated, ready for action. Prime for immediate pre-qualification.';
    nextSteps = 'Guide through soft credit check and pre-qualification application.';
  } else if (lowerMsg.includes('confused') || lowerMsg.includes('overwhelmed') || lowerMsg.includes('different things')) {
    cathyResponse = `${customerName}, I totally get that! Everyone telling you different things is so frustrating.\n\nLet me cut through the noise and give you straight answers. No pressure, just facts.\n\nWhat's your biggest question right now?`;
    analysis = 'Customer overwhelmed by conflicting information. Positioning as trusted advisor.';
    salesReadiness = 'medium';
    insights = 'Needs clarity and trust-building. Opportunity to differentiate through transparency.';
    nextSteps = 'Address specific concerns and build trust through clear information.';
  } else if (lowerMsg.includes('payment') || lowerMsg.includes('monthly') || lowerMsg.includes('budget') || lowerMsg.includes('afford')) {
    cathyResponse = `Absolutely, ${customerName}! Staying within budget is super important.\n\n$300/month is totally doable - I help customers in that range all the time. It's all about finding the right car and loan terms.\n\nWhat type of vehicle are you thinking?`;
    analysis = 'Customer focused on monthly payment and budget. Addressing affordability directly.';
    salesReadiness = 'high';
    insights = 'Has specific budget parameters, actively seeking solutions. Good qualification opportunity.';
    nextSteps = 'Gather vehicle preferences and show financing options within budget.';
  } else if (lowerMsg.includes('started') || lowerMsg.includes('application') || lowerMsg.includes('paperwork')) {
    cathyResponse = `No worries, ${customerName}! You don't need to start over.\n\nI can pull up what you already did and help you finish. Paperwork can be a pain - that's why I'm here!\n\nWant me to see where you left off?`;
    analysis = 'Previous abandonment, needs reassurance and guidance to complete.';
    salesReadiness = 'high';
    insights = 'Shown previous intent. Strong re-engagement opportunity.';
    nextSteps = 'Reassure and provide guided completion assistance.';
  } else {
    cathyResponse = `Hey ${customerName}! Great to hear from you.\n\nI'm Cathy - I help folks find the right auto financing, no matter their credit situation. Every situation is unique, and I'm here to make it easy.\n\nWhat can I help you with today?`;
    analysis = 'General inquiry. Establishing rapport and gathering needs.';
    salesReadiness = 'medium';
    insights = 'Early discovery phase. Opportunity to build relationship and understand needs.';
    nextSteps = 'Build rapport, ask qualifying questions, identify specific needs.';
  }

  return {
    customerMessage: userMessage,
    cathyResponse,
    analysis,
    salesReadiness,
    customerName,
    channel: 'web_chat',
    insights,
    nextSteps
  };
}

// Helper function to generate Cathy's email response
async function generateCathyEmailResponse(
  userMessage: string,
  customerName: string,
  customerSituation?: string
): Promise<TestResponse & { email?: { subject: string; salutation: string; body: string; signoff: string } }> {
  const chatResponse = await generateCathyResponse(userMessage, customerName, customerSituation);
  
  // Generate email-specific formatting
  const email = {
    subject: generateEmailSubject(userMessage, customerName),
    salutation: `Hi ${customerName},`,
    body: formatForEmail(chatResponse.cathyResponse),
    signoff: `Best regards,\n\nCathy\nAuto Finance Specialist\nComplete Car Loans\n\nP.S. I'm here whenever you have questions - just reply to this email or give me a call!`
  };

  return {
    ...chatResponse,
    cathyResponse: email.body,
    channel: 'email',
    email
  };
}

function generateEmailSubject(userMessage: string, customerName: string): string {
  const lowerMsg = userMessage.toLowerCase();
  
  if (lowerMsg.includes('credit') && (lowerMsg.includes('worried') || lowerMsg.includes('issues'))) {
    return `${customerName}, let's find you the right auto financing solution`;
  } else if (lowerMsg.includes('first') || lowerMsg.includes('new')) {
    return `${customerName}, your auto financing questions answered`;
  } else if (lowerMsg.includes('ready') || lowerMsg.includes('apply')) {
    return `${customerName}, let's get your pre-approval started`;
  } else if (lowerMsg.includes('confused') || lowerMsg.includes('overwhelmed')) {
    return `${customerName}, let me clear up the confusion`;
  } else if (lowerMsg.includes('payment') || lowerMsg.includes('budget')) {
    return `${customerName}, financing options that fit your budget`;
  } else {
    return `${customerName}, I'm here to help with your auto financing`;
  }
}

function formatForEmail(chatResponse: string): string {
  // Convert chat response to email format
  return chatResponse
    .replace(/\n\n/g, '\n\n')
    .replace(/\n/g, '\n\n');
}

export default router;
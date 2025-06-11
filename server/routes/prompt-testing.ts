import express from "express";
import { Request, Response } from "express";
import { CATHY_SYSTEM_PROMPT } from "../agents/cathy-system-prompt";
import { CATHY_ENHANCED_SYSTEM_PROMPT } from "../agents/cathy-enhanced-prompt";
import { promptVariableManager, PromptVariables } from "../config/prompt-variables-enhanced";

const router = express.Router();

interface TestChatRequest {
  userMessage: string;
  customerName: string;
  customerSituation?: string;
  conversationHistory?: Array<{
    type: "user" | "agent";
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

// Get current system prompt (dynamic)
router.get("/system-prompt", (req: Request, res: Response) => {
  try {
    const dynamicPrompt = promptVariableManager.generateSystemPrompt();
    const currentVariables = promptVariableManager.getVariables();

    res.json({
      prompt: dynamicPrompt,
      enhancedPrompt: CATHY_ENHANCED_SYSTEM_PROMPT,
      staticPrompt: CATHY_SYSTEM_PROMPT,
      variables: currentVariables,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error retrieving system prompt:", error);
    res.status(500).json({ error: "Failed to retrieve system prompt" });
  }
});

// Get current prompt variables
router.get("/variables", (req: Request, res: Response) => {
  try {
    const variables = promptVariableManager.getVariables();
    res.json(variables);
  } catch (error) {
    console.error("Error fetching prompt variables:", error);
    res.status(500).json({ error: "Failed to fetch prompt variables" });
  }
});

// Update prompt variables
router.post("/variables", (req: Request, res: Response) => {
  try {
    const updates: Partial<PromptVariables> = req.body;
    promptVariableManager.updateVariables(updates);

    const updatedVariables = promptVariableManager.getVariables();
    const newSystemPrompt = promptVariableManager.generateSystemPrompt();

    res.json({
      success: true,
      variables: updatedVariables,
      systemPrompt: newSystemPrompt,
      message: "Prompt variables updated successfully",
    });
  } catch (error) {
    console.error("Error updating prompt variables:", error);
    res.status(500).json({ error: "Failed to update prompt variables" });
  }
});

// Reset variables to defaults
router.post("/variables/reset", (req: Request, res: Response) => {
  try {
    const { DEFAULT_PROMPT_VARIABLES } = require("../config/prompt-variables");
    promptVariableManager.updateVariables(DEFAULT_PROMPT_VARIABLES);
    const defaultVariables = promptVariableManager.getVariables();

    res.json({
      success: true,
      variables: defaultVariables,
      message: "Prompt variables reset to defaults",
    });
  } catch (error) {
    console.error("Error resetting prompt variables:", error);
    res.status(500).json({ error: "Failed to reset prompt variables" });
  }
});

// Test chat response
router.post("/chat-response", async (req: Request, res: Response) => {
  try {
    const { userMessage, customerName, customerSituation, conversationHistory }: TestChatRequest =
      req.body;

    if (!userMessage || !customerName) {
      return res.status(400).json({ error: "userMessage and customerName are required" });
    }

    const response = await generateCathyResponse(
      userMessage,
      customerName,
      customerSituation,
      conversationHistory
    );

    res.json(response);
  } catch (error) {
    console.error("Error generating chat response:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// Test email response
router.post("/email-response", async (req: Request, res: Response) => {
  try {
    const { userMessage, customerName, customerSituation }: TestChatRequest = req.body;

    if (!userMessage || !customerName) {
      return res.status(400).json({ error: "userMessage and customerName are required" });
    }

    const response = await generateCathyEmailResponse(userMessage, customerName, customerSituation);

    res.json(response);
  } catch (error) {
    console.error("Error generating email response:", error);
    res.status(500).json({ error: "Failed to generate email response" });
  }
});

// Helper function to generate Cathy's chat response with enhanced strategy
async function generateCathyResponse(
  userMessage: string,
  customerName: string,
  customerSituation?: string,
  conversationHistory?: Array<{ type: "user" | "agent"; content: string }>
): Promise<TestResponse> {
  const lowerMsg = userMessage.toLowerCase();

  // Extract first name only for natural greetings
  const firstName = customerName.split(" ")[0];

  // Analyze customer intent and generate appropriate response using enhanced strategy
  let cathyResponse: string;
  let analysis: string;
  let salesReadiness: string;
  let insights: string;
  let nextSteps: string;
  let compassion: string;
  let affirmation: string;
  let progress: string;

  if (
    lowerMsg.includes("credit") &&
    (lowerMsg.includes("worried") || lowerMsg.includes("issues") || lowerMsg.includes("anxious"))
  ) {
    // Credit concerns - enhanced with required elements
    compassion = "I completely understand those credit concerns";
    affirmation = "You're being really smart to think about this upfront";
    progress = "I'm checking what options are available for your situation right now";
    cathyResponse = `${compassion}, ${firstName}. ${affirmation}.\n\nHere's the thing: We work with people in all credit situations every day. ${progress}.\n\nI'm creating your price now, get more info on the vehicle. If you have someone who could co-sign or a vehicle to trade, that can really help your approval odds too!`;
    analysis =
      "Customer expressing credit anxiety. Responding with required compassion, affirmation, and progress indicators.";
    salesReadiness = "medium";
    insights = "Customer has credit concerns but engaged. Building trust with enhanced strategy.";
    nextSteps = "Guide to application completion with co-signer/trade-in alternatives if needed.";
  } else if (
    lowerMsg.includes("first") ||
    lowerMsg.includes("new") ||
    lowerMsg.includes("understand") ||
    (lowerMsg.includes("how") && lowerMsg.includes("work"))
  ) {
    // First-time buyer - YES-first approach
    compassion = "I completely understand wanting to learn how this works";
    affirmation = "You're being very wise to ask questions first";
    progress = "I'm getting your pre-qualification details ready right now";
    cathyResponse = `${compassion}, ${firstName}! ${affirmation}.\n\nYes! I can definitely walk you through this. Auto financing is actually pretty simple: quick soft credit check (no impact), see what you qualify for, then find a car that fits.\n\n${progress} - I'm creating your price now, get more info on the vehicle!`;
    analysis =
      "First-time buyer seeking education. Using YES-first approach with required elements.";
    salesReadiness = "high";
    insights =
      "New to auto financing, receptive to guidance. High conversion potential with enhanced strategy.";
    nextSteps = "Guide through application process with progress reinforcement.";
  } else if (
    lowerMsg.includes("ready") ||
    lowerMsg.includes("apply") ||
    lowerMsg.includes("pre-approved") ||
    lowerMsg.includes("move forward")
  ) {
    // High intent - immediate YES with progress
    compassion = "I hear that you're ready to move forward";
    affirmation = "You're making a great choice taking action";
    progress = "I'm pulling up your qualification options right now";
    cathyResponse = `Yes! ${compassion}, ${firstName} - ${affirmation}.\n\n${progress}. I can get your pre-qualification started with a soft credit check. Zero impact to your score, and you'll know what you qualify for in minutes.\n\nI'm creating your price now, get more info on the vehicle. Let's get this done!`;
    analysis = "Customer showing high intent. Using YES-first with immediate progress indicators.";
    salesReadiness = "high";
    insights = "Highly motivated, ready for action. Prime for immediate application completion.";
    nextSteps = "Direct to application completion with strong momentum.";
  } else if (
    lowerMsg.includes("confused") ||
    lowerMsg.includes("overwhelmed") ||
    lowerMsg.includes("different things")
  ) {
    // Confusion - compassion first, then progress
    compassion = "I completely understand feeling overwhelmed by all the different information";
    affirmation = "You're absolutely right to want clear, straight answers";
    progress = "Let me check your specific options and give you the real facts";
    cathyResponse = `${compassion}, ${firstName}. ${affirmation}.\n\n${progress} right now. No pressure, just clear information about what's actually available for you.\n\nI'm creating your price now, get more info on the vehicle. What's your biggest question - let me give you a straight answer!`;
    analysis =
      "Customer overwhelmed by information. Using enhanced compassion and clarity approach.";
    salesReadiness = "medium";
    insights =
      "Needs clarity and trust-building. Enhanced strategy builds confidence through understanding.";
    nextSteps = "Address specific concerns with compassion, then guide to application.";
  } else if (
    lowerMsg.includes("payment") ||
    lowerMsg.includes("monthly") ||
    lowerMsg.includes("budget") ||
    lowerMsg.includes("afford")
  ) {
    // Budget questions - YES-first approach
    compassion = "I completely understand wanting to know about payments upfront";
    affirmation = "You're being really smart about staying within budget";
    progress = "I'm checking what payment options fit your range right now";
    cathyResponse = `Yes! ${compassion}, ${firstName}. ${affirmation}.\n\n${progress}. I help customers in all budget ranges find something that works. The key is getting your exact qualification first.\n\nI'm creating your price now, get more info on the vehicle. What monthly range feels comfortable for you?`;
    analysis = "Customer focused on budget. Using YES-first approach with payment focus.";
    salesReadiness = "high";
    insights = "Budget-conscious but engaged. Enhanced strategy shows understanding and solutions.";
    nextSteps = "Gather budget parameters and guide to qualification for exact numbers.";
  } else {
    // General inquiry - full enhanced strategy
    compassion = "I completely understand wanting to explore your auto financing options";
    affirmation = "You're making a great choice looking into this";
    progress = "I'm checking what's available for you right now";
    cathyResponse = `${compassion}, ${firstName}! ${affirmation}.\n\nI'm Cathy - I help people find the right auto financing, no matter their credit situation. ${progress}.\n\nI'm creating your price now, get more info on the vehicle. What can I help you with specifically today?`;
    analysis = "General inquiry. Using full enhanced strategy with all required elements.";
    salesReadiness = "medium";
    insights = "Early discovery phase. Enhanced strategy builds immediate rapport and confidence.";
    nextSteps =
      "Build relationship with compassion/affirmation, then guide to application completion.";
  }

  // Apply enhanced prompt variable manager
  const finalResponse = promptVariableManager.applyToResponse(cathyResponse, {
    customerName: customerName,
  });

  return {
    customerMessage: userMessage,
    cathyResponse: finalResponse,
    analysis,
    salesReadiness,
    customerName,
    channel: "web_chat",
    insights,
    nextSteps,
    // Enhanced response format with required elements
    compassion,
    affirmation,
    progress,
  } as TestResponse & { compassion: string; affirmation: string; progress: string };
}

// Helper function to generate Cathy's email response
async function generateCathyEmailResponse(
  userMessage: string,
  customerName: string,
  customerSituation?: string
): Promise<
  TestResponse & { email?: { subject: string; salutation: string; body: string; signoff: string } }
> {
  const chatResponse = await generateCathyResponse(userMessage, customerName, customerSituation);

  // Generate email-specific formatting
  const email = {
    subject: generateEmailSubject(userMessage, customerName),
    salutation: `Hi ${customerName},`,
    body: formatForEmail(chatResponse.cathyResponse),
    signoff: `Best regards,\n\nCathy\nAuto Finance Specialist\nComplete Car Loans\n\nP.S. I'm here whenever you have questions - just reply to this email or give me a call!`,
  };

  return {
    ...chatResponse,
    cathyResponse: email.body,
    channel: "email",
    email,
  };
}

function generateEmailSubject(userMessage: string, customerName: string): string {
  const lowerMsg = userMessage.toLowerCase();

  if (
    lowerMsg.includes("credit") &&
    (lowerMsg.includes("worried") || lowerMsg.includes("issues"))
  ) {
    return `${customerName}, let's find you the right auto financing solution`;
  } else if (lowerMsg.includes("first") || lowerMsg.includes("new")) {
    return `${customerName}, your auto financing questions answered`;
  } else if (lowerMsg.includes("ready") || lowerMsg.includes("apply")) {
    return `${customerName}, let's get your pre-approval started`;
  } else if (lowerMsg.includes("confused") || lowerMsg.includes("overwhelmed")) {
    return `${customerName}, let me clear up the confusion`;
  } else if (lowerMsg.includes("payment") || lowerMsg.includes("budget")) {
    return `${customerName}, financing options that fit your budget`;
  } else {
    return `${customerName}, I'm here to help with your auto financing`;
  }
}

function formatForEmail(chatResponse: string): string {
  // Convert chat response to email format
  return chatResponse.replace(/\n\n/g, "\n\n").replace(/\n/g, "\n\n");
}

export default router;

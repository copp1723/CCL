// Response formatting utilities for Cathy's empathetic communication style

export function formatResponseByTone(tone: 'positive' | 'negative' | 'progress', message: string): string {
  const toneMarkers = {
    positive: "✨ ",
    negative: "💙 ",
    progress: "🎯 "
  };

  // Remove tone markers for production - keep responses natural and human
  return message.trim();
}

export function generateEmpatheticResponse(situation: string, customerConcern: string): string {
  const empathyPhrases = {
    credit_anxiety: "I completely understand that credit concerns can feel overwhelming. You're not alone in this - many of our most successful customers started with similar worries.",
    application_confusion: "I can see how this process might feel complicated. Let me walk you through this step by step to make it clearer.",
    financial_stress: "I know financial decisions can feel stressful. My job is to make this as easy and comfortable as possible for you.",
    previous_rejection: "I hear that you've had challenges before, and I want you to know that doesn't define your options with us. We specialize in finding solutions."
  };

  return empathyPhrases[situation as keyof typeof empathyPhrases] || 
         "I understand this is important to you, and I'm here to help make this process as smooth as possible.";
}

export function personalizeGreeting(customerName?: string, lastInteraction?: string): string {
  if (customerName && lastInteraction) {
    return `Hi ${customerName}! I'm Cathy from Complete Car Loans. It's been a bit since we last talked about ${lastInteraction}. I'm here to help you move forward whenever you're ready.`;
  }
  
  if (customerName) {
    return `Hi ${customerName}! I'm Cathy from Complete Car Loans. I'm really glad you stopped by today - I'm here to help make your auto financing journey as smooth as possible.`;
  }
  
  return `Hi there! I'm Cathy from Complete Car Loans. I'm really glad you stopped by today - I specialize in helping customers find the perfect financing solution, regardless of credit situation.`;
}

export function generateNextStepGuidance(currentStep: string, customerReadiness: 'low' | 'medium' | 'high'): string {
  const guidance = {
    low: {
      initial_contact: "Take your time to think about what kind of vehicle would work best for you. When you're ready, I can help you explore your options with no pressure.",
      information_gathering: "I'm here whenever you have questions. Would you like me to explain how our process works, or would you prefer to look around first?",
      credit_discussion: "There's no rush at all. When you feel comfortable, we can talk about your situation and I'll show you what options are available."
    },
    medium: {
      initial_contact: "I'd love to learn more about what you're looking for in a vehicle and financing. What's most important to you in this process?",
      information_gathering: "Based on what you've shared, I think we can find some great options for you. Would you like to see what's available?",
      credit_discussion: "I can do a quick, soft credit check that won't impact your score at all - just to see what programs might work best for you."
    },
    high: {
      initial_contact: "It sounds like you're ready to move forward! I can get started with your pre-qualification right away if you'd like.",
      information_gathering: "Perfect! Let me get you pre-qualified so we can see exactly what you qualify for. This will just take a moment.",
      credit_discussion: "Great! I'll run that soft credit check now and get your options ready. You're going to be pleased with what we can do for you."
    }
  };

  return guidance[customerReadiness]?.[currentStep as keyof typeof guidance[customerReadiness]] || 
         "I'm here to help with whatever questions you have. What would be most helpful for you right now?";
}
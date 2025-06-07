// Simple, production-ready Cathy agent for chat responses
export class SimpleCathyAgent {
  private systemPrompt = `You are Cathy, a friendly and experienced finance guide at Complete Car Loans. Your specialty is making the car loan process easy and stress-free for people, no matter their credit history.

You are warm, patient, and reassuring. Your main goal is to make customers feel heard and understood, not judged. You build genuine connections and help people take the next step with confidence.

Your Core Mission:
- Re-engage customers who showed interest but haven't completed an application
- Start highly relevant, personal conversations 
- Build trust and make them feel comfortable
- Gently guide them to provide their phone number for a soft credit pull

Conversational Style:
- Be human, not robotic. Use short, friendly sentences
- Lead with empathy - acknowledge their feelings
- Keep it positive and encouraging. Use phrases like "We're one step closer" or "That's great, let's see what we can do next"
- Simple and clear - avoid jargon
- When good news: Start with clear "Yes," then details
- When saying no: Lead with empathy, deliver gently, immediately offer solution
- Break longer responses into natural paragraphs using double line breaks (\n\n) for better readability

Key Rules:
- NEVER reveal you are AI/bot/automated
- NEVER ask for SSN, bank details in chat
- NEVER give specific financial/legal advice
- NEVER promise loan approval or specific rates
- NEVER use "bad credit" - say "all credit situations"
- NEVER use high-pressure tactics

Focus on building trust and guiding toward the soft credit check phone number collection.`;

  async generateResponse(message: string, sessionId: string): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: message }
          ],
          max_tokens: 150,
          temperature: 0.8
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0].message.content.trim();
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
    }

    // Enhanced fallback responses
    return this.generateFallbackResponse(message);
  }

  private generateFallbackResponse(message: string): string {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
      return "Hi there! I'm Cathy from Complete Car Loans.\n\nI saw you were looking into financing options and wanted to reach out personally.\n\nHow's your car search going so far?";
    }
    
    if (lowerMsg.includes('credit') || lowerMsg.includes('bad') || lowerMsg.includes('low score') || lowerMsg.includes('poor')) {
      return "I completely understand that concern. We actually specialize in helping people with all credit situations - that's our specialty!\n\nThe quickest way to see what you qualify for is a soft credit check that won't impact your score at all.";
    }
    
    if (lowerMsg.includes('approved') || lowerMsg.includes('approval') || lowerMsg.includes('qualify')) {
      return "That's exactly what we're here for! I'm confident we can find some great options for you.\n\nTo get you pre-approved, I'd just need to run a quick soft credit check - do you have a good phone number I can use for that?";
    }
    
    if (lowerMsg.includes('rate') || lowerMsg.includes('payment') || lowerMsg.includes('interest')) {
      return "Great question! Your rate will depend on your specific situation, but the good news is we work with many different lenders.\n\nLet me run a soft credit check to see your personalized options - what's the best phone number to reach you?";
    }
    
    if (lowerMsg.includes('help') || lowerMsg.includes('question') || lowerMsg.includes('info')) {
      return "I'm absolutely here to help! Auto financing can feel overwhelming, but I'll make it as easy as possible.\n\nWhat's your biggest concern right now?";
    }

    if (lowerMsg.includes('car') || lowerMsg.includes('vehicle') || lowerMsg.includes('looking')) {
      return "That's exciting! Finding the right car is such an important step.\n\nHave you found any vehicles you're interested in, or are you still browsing? Either way, getting pre-approved first gives you so much more negotiating power.";
    }

    return "I'm so glad you reached out! I specialize in making the car loan process stress-free, no matter your credit history.\n\nWhat brings you here today - are you ready to get pre-approved?";
  }
}

export const simpleCathyAgent = new SimpleCathyAgent();
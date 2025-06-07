// Simple, production-ready Cathy agent for chat responses
export class SimpleCathyAgent {
  private systemPrompt = `You are Cathy, a warm and empathetic finance expert at Complete Car Loans. 

Your role:
- Help customers with auto financing regardless of credit history
- Keep responses brief (1-2 sentences maximum)
- Be encouraging about credit challenges
- Guide customers toward pre-approval
- Never mention specific rates without application

Personality:
- Warm, professional, and understanding
- Solution-focused and optimistic
- Knowledgeable about sub-prime auto lending
- Patient with customer concerns

Always focus on next steps and building confidence.`;

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
          max_tokens: 80,
          temperature: 0.7
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0].message.content.trim();
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
    }

    // Fallback to contextual responses
    return this.generateFallbackResponse(message);
  }

  private generateFallbackResponse(message: string): string {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
      return "Hi! I'm Cathy from Complete Car Loans. How can I help with your auto financing today?";
    }
    
    if (lowerMsg.includes('credit') || lowerMsg.includes('bad') || lowerMsg.includes('low score')) {
      return "No worries, we specialize in helping people with all credit situations. Let's start your application to find the best options.";
    }
    
    if (lowerMsg.includes('approved') || lowerMsg.includes('approval') || lowerMsg.includes('qualify')) {
      return "Great! Let's get you pre-approved. Our quick application takes just 2 minutes to complete.";
    }
    
    if (lowerMsg.includes('rate') || lowerMsg.includes('payment') || lowerMsg.includes('interest')) {
      return "Rates depend on your specific situation. Let's start with a quick pre-approval to see your personalized options.";
    }
    
    if (lowerMsg.includes('help') || lowerMsg.includes('question') || lowerMsg.includes('info')) {
      return "I'm here to help! What specific questions do you have about auto financing?";
    }

    return "I'd love to help you with your auto financing needs. What can I assist you with today?";
  }
}

export const simpleCathyAgent = new SimpleCathyAgent();
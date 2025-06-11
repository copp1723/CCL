export class WebhookService {
  async send(
    url: string,
    data: any
  ): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      return { success: true, response: responseData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async submitToDealerCrm(leadPackage: any): Promise<{
    success: boolean;
    crmName?: string;
    leadId?: string;
    response?: any;
    error?: string;
  }> {
    // Mock implementation - replace with actual dealer CRM integration
    const dealerCrmUrl = process.env.DEALER_CRM_URL || "https://api.dealercrm.com/leads";

    const result = await this.send(dealerCrmUrl, leadPackage);

    return {
      ...result,
      crmName: "DealerCRM",
      leadId: result.response?.leadId || leadPackage.leadId,
    };
  }
}

export const webhookService = new WebhookService();


interface CustomerRecord {
  // Safe for prompts
  firstName?: string;
  lastName?: string;
  dealer?: string;
  city?: string;
  state?: string;
  leadSource?: string;
  leadStatus?: string;
  appointmentStatus?: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  
  // Internal use only - never show in prompts
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  
  // Metadata
  globalCustomerId?: string;
  recordId?: string;
  createdDate?: string;
}

interface PersonalizedMessage {
  greeting: string;
  context: string;
  vehicle?: string;
  dealer?: string;
  nextStep: string;
  signature: string;
  fullMessage: string;
}

class DataMappingService {
  
  /**
   * Map CSV row to standardized customer record
   */
  mapCsvRowToCustomerRecord(csvRow: Record<string, any>): CustomerRecord {
    return {
      // Safe fields for conversation use
      firstName: this.sanitizeField(csvRow['First Name'] || csvRow['firstName']),
      lastName: this.sanitizeField(csvRow['Last Name'] || csvRow['lastName']),
      dealer: this.sanitizeField(csvRow['Dealer'] || csvRow['dealer']),
      city: this.sanitizeField(csvRow['City'] || csvRow['city']),
      state: this.sanitizeField(csvRow['State'] || csvRow['State/Region'] || csvRow['state']),
      leadSource: this.sanitizeField(csvRow['Lead Source'] || csvRow['External Data Source'] || csvRow['Latest Source']),
      leadStatus: this.sanitizeField(csvRow['Lead Status'] || csvRow['Status']),
      appointmentStatus: this.sanitizeField(csvRow['Appointment Status']),
      vehicleYear: this.sanitizeField(csvRow['Year']),
      vehicleMake: this.sanitizeField(csvRow['Make']),
      vehicleModel: this.sanitizeField(csvRow['Model']),
      
      // Private fields - never show in messages
      email: csvRow['Email'] || csvRow['email'],
      phone: csvRow['Phone Number'] || csvRow['phone'],
      address: csvRow['Address'] || csvRow['Street Address'],
      postalCode: csvRow['Postal Code'] || csvRow['postalCode'],
      
      // Metadata
      globalCustomerId: csvRow['Global Customer ID'] || csvRow['Record ID'],
      recordId: csvRow['Record ID'] || csvRow['id'],
      createdDate: csvRow['Created Date'] || csvRow['Create Date']
    };
  }

  /**
   * Sanitize field values for safe prompt use
   */
  private sanitizeField(value: any): string | undefined {
    if (!value || value === '' || value === 'null' || value === 'undefined') {
      return undefined;
    }
    
    const cleaned = String(value).trim();
    
    // Handle edge cases
    if (cleaned.toLowerCase() === 'unknown' || cleaned.toLowerCase() === 'n/a') {
      return undefined;
    }
    
    // Fix capitalization issues
    if (cleaned.length > 1) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    }
    
    return cleaned;
  }

  /**
   * Generate personalized message using Complete Car Loans personality
   */
  generatePersonalizedMessage(customer: CustomerRecord, messageType: 'reengagement' | 'inmarket' | 'followup' = 'reengagement'): PersonalizedMessage {
    const greeting = this.generateGreeting(customer);
    const context = this.generateContext(customer, messageType);
    const vehicle = this.generateVehicleContext(customer);
    const dealer = this.generateDealerContext(customer);
    const nextStep = this.generateNextStep(customer, messageType);
    const signature = "Best regards,\nCathy\nComplete Car Loans";
    
    // Assemble full message
    let fullMessage = greeting;
    
    if (context) {
      fullMessage += ` ${context}`;
    }
    
    if (vehicle) {
      fullMessage += ` ${vehicle}`;
    }
    
    if (dealer) {
      fullMessage += ` ${dealer}`;
    }
    
    fullMessage += ` ${nextStep}`;
    fullMessage += `\n\n${signature}`;
    
    return {
      greeting,
      context,
      vehicle,
      dealer,
      nextStep,
      signature,
      fullMessage
    };
  }

  /**
   * Generate appropriate greeting based on available data
   */
  private generateGreeting(customer: CustomerRecord): string {
    if (customer.firstName) {
      return `Hi ${customer.firstName},`;
    }
    return "Hi there,";
  }

  /**
   * Generate context based on message type and customer data
   */
  private generateContext(customer: CustomerRecord, messageType: string): string {
    switch (messageType) {
      case 'reengagement':
        if (customer.leadStatus?.toLowerCase().includes('waiting') || customer.leadStatus?.toLowerCase().includes('did not respond')) {
          return "just checking in to help move things forward for you. Sometimes life gets busy—are there any questions I can answer, or can I help you take the next step toward your new vehicle? You're making real progress.";
        }
        return "I wanted to follow up on your car financing inquiry. Every step brings you closer to approval—let's find the right fit together.";
        
      case 'inmarket':
        if (customer.leadSource && !this.isGenericSource(customer.leadSource)) {
          return `you recently inquired about car financing through ${customer.leadSource} and I'm here to help you review your options with Complete Car Loans. Every step brings you closer to approval—let's find the right fit together.`;
        }
        return "you recently inquired about car financing and I'm here to help you review your options with Complete Car Loans. Every step brings you closer to approval—let's find the right fit together.";
        
      case 'followup':
      default:
        return "I wanted to follow up on your interest in car financing. Let me know what questions you have—I'm here to help you move forward.";
    }
  }

  /**
   * Generate vehicle-specific context if available
   */
  private generateVehicleContext(customer: CustomerRecord): string | undefined {
    if (customer.vehicleYear && customer.vehicleMake && customer.vehicleModel) {
      return `I noticed your interest in a ${customer.vehicleYear} ${customer.vehicleMake} ${customer.vehicleModel}. Would you like to keep exploring options or get your personalized numbers? You're one step closer to driving it home.`;
    }
    return undefined;
  }

  /**
   * Generate dealer-specific context if available
   */
  private generateDealerContext(customer: CustomerRecord): string | undefined {
    if (customer.dealer && !this.isGenericDealer(customer.dealer)) {
      return `I see you connected with ${customer.dealer} recently. Is there anything I can clarify or assist with? You're almost at the finish line.`;
    }
    return undefined;
  }

  /**
   * Generate appropriate next step based on context
   */
  private generateNextStep(customer: CustomerRecord, messageType: string): string {
    if (customer.appointmentStatus && customer.appointmentStatus.trim() !== '') {
      return "If you want to schedule a time, let me know! I'm here to make the process easy and support you every step of the way.";
    }
    
    if (messageType === 'reengagement') {
      return "No worries if you've been busy—your goals are important and I'm here when you're ready. Everyone's journey is unique—let's find your best path together.";
    }
    
    return "I'm here to make the process easy and support you every step of the way. You're making real progress.";
  }

  /**
   * Check if lead source is generic and should be skipped
   */
  private isGenericSource(source: string): boolean {
    const genericSources = ['web', 'import', 'unknown', 'offline sources', 'integration'];
    return genericSources.includes(source.toLowerCase());
  }

  /**
   * Check if dealer name is generic and should be skipped
   */
  private isGenericDealer(dealer: string): boolean {
    const genericDealers = ['unknown', 'n/a', 'various', 'multiple'];
    return genericDealers.includes(dealer.toLowerCase());
  }

  /**
   * Validate customer record for message generation
   */
  validateCustomerRecord(customer: CustomerRecord): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check for critical missing data
    if (!customer.firstName && !customer.lastName) {
      issues.push('No name available - will use generic greeting');
    }
    
    if (!customer.email) {
      issues.push('No email address - cannot send message');
    }
    
    // Validate email format
    if (customer.email && !this.isValidEmail(customer.email)) {
      issues.push('Invalid email format');
    }
    
    // Check for potentially problematic data
    if (customer.firstName && this.hasSpecialCharacters(customer.firstName)) {
      issues.push('First name contains special characters');
    }
    
    return {
      valid: issues.length === 0 || (issues.length === 1 && issues[0].includes('generic greeting')),
      issues
    };
  }

  /**
   * Basic email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check for special characters that might cause issues
   */
  private hasSpecialCharacters(text: string): boolean {
    const specialCharRegex = /[<>\"'&]/;
    return specialCharRegex.test(text);
  }

  /**
   * Generate test message for QA purposes
   */
  generateTestMessage(sampleData: Partial<CustomerRecord>): PersonalizedMessage {
    const customer = {
      firstName: 'Test',
      lastName: 'Customer',
      dealer: 'Test Dealer',
      city: 'Test City',
      state: 'TS',
      leadSource: 'Test Source',
      leadStatus: 'Waiting for prospect response',
      vehicleYear: '2023',
      vehicleMake: 'Toyota',
      vehicleModel: 'Camry',
      ...sampleData
    };
    
    return this.generatePersonalizedMessage(customer, 'reengagement');
  }

  /**
   * Process batch of customer records with error handling
   */
  processBatch(csvData: Record<string, any>[]): {
    processed: Array<{ customer: CustomerRecord; message: PersonalizedMessage; validation: { valid: boolean; issues: string[] } }>;
    errors: Array<{ index: number; error: string; data: any }>;
  } {
    const processed: Array<{ customer: CustomerRecord; message: PersonalizedMessage; validation: { valid: boolean; issues: string[] } }> = [];
    const errors: Array<{ index: number; error: string; data: any }> = [];

    csvData.forEach((row, index) => {
      try {
        const customer = this.mapCsvRowToCustomerRecord(row);
        const validation = this.validateCustomerRecord(customer);
        
        if (validation.valid) {
          const messageType = this.determineMessageType(customer);
          const message = this.generatePersonalizedMessage(customer, messageType);
          
          processed.push({
            customer,
            message,
            validation
          });
        } else {
          errors.push({
            index,
            error: `Validation failed: ${validation.issues.join(', ')}`,
            data: row
          });
        }
      } catch (error) {
        errors.push({
          index,
          error: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: row
        });
      }
    });

    return { processed, errors };
  }

  /**
   * Determine appropriate message type based on customer data
   */
  private determineMessageType(customer: CustomerRecord): 'reengagement' | 'inmarket' | 'followup' {
    if (customer.leadStatus?.toLowerCase().includes('waiting') || customer.leadStatus?.toLowerCase().includes('did not respond')) {
      return 'reengagement';
    }
    
    if (customer.leadSource && customer.leadSource.toLowerCase().includes('conquest')) {
      return 'inmarket';
    }
    
    return 'followup';
  }
}

export const dataMappingService = new DataMappingService();
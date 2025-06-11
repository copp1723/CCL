import Client from "ssh2-sftp-client";
import { parse } from "fast-csv";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import cron from "node-cron";
import config from "../config/environment";
import { sftpLogger, logError, logPerformance, logBusinessEvent } from "../logger";
import { storage } from "../storage";
import { SftpIngestRowSchema, type SftpIngestRow } from "../../shared/validation/schemas";

export interface SftpIngestResult {
  success: boolean;
  filesProcessed: number;
  totalRows: number;
  totalErrors: number;
  processingTime: number;
  error?: string;
}

export class SftpIngestorService {
  private sftp: Client;
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;

  constructor() {
    this.sftp = new Client();
  }

  async initialize(): Promise<void> {
    const sftpConfig = config.getSftpConfig();

    if (!sftpConfig.configured) {
      sftpLogger.warn("SFTP not configured, ingestion service will not start");
      return;
    }

    // Schedule ingestion based on config
    const cronExpression = config.isDevelopment()
      ? "*/5 * * * *" // Every 5 minutes in dev
      : `*/${sftpConfig.pollIntervalMinutes} * * * *`; // Configurable in production

    this.cronJob = cron.schedule(cronExpression, () => this.ingestDailyFiles(), {
      scheduled: false, // Don't start immediately
    });

    sftpLogger.info(
      {
        cronExpression,
        pollInterval: sftpConfig.pollIntervalMinutes,
      },
      "SFTP ingestion service initialized"
    );
  }

  async start(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.start();
      sftpLogger.info("SFTP ingestion cron job started");
    }
  }

  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      sftpLogger.info("SFTP ingestion cron job stopped");
    }
  }

  async ingestDailyFiles(): Promise<SftpIngestResult> {
    if (this.isRunning) {
      sftpLogger.warn("SFTP ingestion already running, skipping...");
      return {
        success: false,
        filesProcessed: 0,
        totalRows: 0,
        totalErrors: 0,
        processingTime: 0,
        error: "Already running",
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    let filesProcessed = 0;
    let totalRows = 0;
    let totalErrors = 0;

    try {
      const sftpConfig = config.getSftpConfig();

      sftpLogger.info("Starting SFTP ingestion process");

      // Connect to SFTP server
      await this.sftp.connect({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.user,
        password: sftpConfig.password,
        readyTimeout: 20000,
        retries: 3,
        retry_minTimeout: 2000,
      });

      sftpLogger.info({ host: sftpConfig.host }, "Connected to SFTP server");

      // List remote files
      const remoteFiles = await this.sftp.list(sftpConfig.remotePath);
      const csvFiles = remoteFiles.filter(
        file => file.name.endsWith(".csv") && file.type === "-" && file.size > 0
      );

      sftpLogger.info(
        {
          fileCount: csvFiles.length,
          remotePath: sftpConfig.remotePath,
        },
        "Found CSV files for ingestion"
      );

      // Process each file
      for (const file of csvFiles) {
        try {
          const result = await this.processFile(file.name, file.size);
          if (result.success) {
            filesProcessed++;
            totalRows += result.rowCount;
            totalErrors += result.errorCount;
          }
        } catch (error) {
          logError(error as Error, { fileName: file.name }, "Failed to process SFTP file");
          totalErrors++;
        }
      }

      // Trigger abandonment detection after successful ingestion
      if (filesProcessed > 0) {
        await this.triggerAbandonmentDetection();
      }

      const processingTime = Date.now() - startTime;

      logBusinessEvent("sftp_ingestion_completed", {
        filesProcessed,
        totalRows,
        totalErrors,
        processingTime,
      });

      logPerformance("sftp_ingestion", processingTime, {
        filesProcessed,
        totalRows,
        totalErrors,
      });

      return {
        success: true,
        filesProcessed,
        totalRows,
        totalErrors,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logError(error as Error, { processingTime }, "SFTP ingestion failed");

      return {
        success: false,
        filesProcessed,
        totalRows,
        totalErrors,
        processingTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      try {
        await this.sftp.end();
      } catch (error) {
        sftpLogger.warn({ error }, "Error closing SFTP connection");
      }
      this.isRunning = false;
      sftpLogger.info(
        { processingTime: Date.now() - startTime },
        "SFTP ingestion process completed"
      );
    }
  }

  private async processFile(
    fileName: string,
    fileSize: number
  ): Promise<{
    success: boolean;
    rowCount: number;
    errorCount: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const sftpConfig = config.getSftpConfig();
    const remotePath = path.posix.join(sftpConfig.remotePath, fileName);

    // Create local directory structure
    const dateStamp = this.getDateStamp();
    const localDir = path.join(process.cwd(), "data", "inbound", dateStamp);
    const localPath = path.join(localDir, fileName);

    sftpLogger.info({ fileName, fileSize, remotePath, localPath }, "Processing SFTP file");

    // Check if already processed
    const existingFile = await storage.getIngestedFile(fileName);
    if (existingFile) {
      sftpLogger.debug({ fileName }, "File already processed, skipping");
      return { success: true, rowCount: 0, errorCount: 0, processingTime: 0 };
    }

    // Ensure directory exists
    await fs.mkdir(localDir, { recursive: true });

    // Download file
    await this.sftp.fastGet(remotePath, localPath);
    sftpLogger.info({ fileName, localPath }, "File downloaded from SFTP");

    // Parse and process CSV
    const { rowCount, errorCount } = await this.parseCsvFile(localPath, fileName);

    const processingTime = Date.now() - startTime;

    // Mark file as processed
    await storage.createIngestedFile({
      fileName,
      filePath: localPath,
      fileSize,
      rowCount,
      errorCount,
      processingTimeMs: processingTime,
      status: errorCount > 0 ? "processed_with_errors" : "processed",
      processedAt: new Date(),
    });

    sftpLogger.info(
      {
        fileName,
        rowCount,
        errorCount,
        processingTime,
      },
      "File processing completed"
    );

    return { success: true, rowCount, errorCount, processingTime };
  }

  private async parseCsvFile(
    filePath: string,
    fileName: string
  ): Promise<{
    rowCount: number;
    errorCount: number;
  }> {
    return new Promise((resolve, reject) => {
      let rowCount = 0;
      let errorCount = 0;
      const errors: any[] = [];

      const stream = fs
        .createReadStream(filePath)
        .pipe(
          parse({
            headers: true,
            skipEmptyLines: true,
            ignoreEmpty: true,
            trim: true,
            delimiter: "auto", // Auto-detect delimiter
          })
        )
        .on("data", async row => {
          try {
            await this.processVisitorRow(row, fileName);
            rowCount++;

            // Log progress every 1000 rows
            if (rowCount % 1000 === 0) {
              sftpLogger.debug({ fileName, rowCount }, "Processing progress");
            }
          } catch (error) {
            errorCount++;
            const errorDetail = {
              row: rowCount + 1,
              data: row,
              error: error instanceof Error ? error.message : "Unknown error",
            };
            errors.push(errorDetail);

            sftpLogger.error(errorDetail, "Error processing CSV row");

            // Stop processing if too many errors
            if (errorCount > 100) {
              stream.destroy();
              reject(new Error(`Too many errors processing ${fileName}: ${errorCount} errors`));
              return;
            }
          }
        })
        .on("end", () => {
          sftpLogger.info(
            {
              fileName,
              rowCount,
              errorCount,
              errorDetails: errors.slice(0, 5), // Log first 5 errors for debugging
            },
            "CSV parsing completed"
          );
          resolve({ rowCount, errorCount });
        })
        .on("error", error => {
          sftpLogger.error({ fileName, error }, "CSV parsing failed");
          reject(error);
        });
    });
  }

  private async processVisitorRow(row: any, source: string): Promise<void> {
    try {
      // Validate row data against schema
      const validatedRow = SftpIngestRowSchema.parse(row);

      // Map CSV columns to visitor fields
      const visitorData = {
        emailHash: validatedRow.email_hash || this.hashEmail(validatedRow.email || ""),
        sessionId: validatedRow.session_id || validatedRow.click_id || crypto.randomUUID(),
        adClickTs: this.parseTimestamp(validatedRow.click_timestamp),
        formStartTs: this.parseTimestamp(validatedRow.form_start_timestamp),
        formSubmitTs: this.parseTimestamp(validatedRow.form_submit_timestamp),
        phoneNumber: this.formatPhoneNumber(validatedRow.phone_number),
        ipAddress: validatedRow.ip_address || null,
        userAgent: validatedRow.user_agent || null,
        ingestSource: source,
        metadata: {
          originalRow: validatedRow,
          campaignId: validatedRow.campaign_id,
          adGroupId: validatedRow.ad_group_id,
          keyword: validatedRow.keyword,
          source: validatedRow.source,
        },
      };

      // Upsert visitor (update if exists, insert if new)
      await storage.upsertVisitorFromIngest(visitorData);
    } catch (error) {
      // Re-throw with more context
      throw new Error(
        `Failed to process visitor row: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async triggerAbandonmentDetection(): Promise<void> {
    try {
      sftpLogger.info("Triggering abandonment detection after ingestion");

      // This will be implemented when we create the abandonment detection service
      // For now, we'll log the intent
      logBusinessEvent("abandonment_detection_triggered", {
        triggeredBy: "sftp_ingestion",
        timestamp: new Date().toISOString(),
      });

      // TODO: Queue abandonment detection job
      // await abandonmentQueue.add('detect-abandoned', {
      //   triggeredAt: new Date(),
      //   source: 'sftp_ingestion'
      // });
    } catch (error) {
      logError(error as Error, {}, "Failed to trigger abandonment detection");
    }
  }

  private hashEmail(email: string): string {
    if (!email || !email.includes("@")) {
      return "";
    }
    return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
  }

  private formatPhoneNumber(phone?: string): string | null {
    if (!phone) return null;

    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, "");

    // Format to E.164 if it's a valid US number
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+${cleaned}`;
    }

    return phone; // Return original if we can't format
  }

  private parseTimestamp(timestamp?: string | Date): Date | null {
    if (!timestamp) return null;

    try {
      if (timestamp instanceof Date) {
        return timestamp;
      }

      // Try parsing as ISO string first
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }

      // Try parsing common formats
      // Add more parsing logic here if needed for specific timestamp formats

      return null;
    } catch (error) {
      sftpLogger.warn({ timestamp }, "Failed to parse timestamp");
      return null;
    }
  }

  private getDateStamp(): string {
    return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  }

  // Manual ingestion method for testing or one-off imports
  async ingestSingleFile(
    filePath: string,
    source: string = "manual"
  ): Promise<{
    success: boolean;
    rowCount: number;
    errorCount: number;
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      sftpLogger.info({ filePath, source }, "Starting manual file ingestion");

      const fileName = path.basename(filePath);
      const { rowCount, errorCount } = await this.parseCsvFile(filePath, fileName);

      const processingTime = Date.now() - startTime;

      // Record the manual ingestion
      await storage.createIngestedFile({
        fileName,
        filePath,
        rowCount,
        errorCount,
        processingTimeMs: processingTime,
        status: "processed",
        processedAt: new Date(),
      });

      logBusinessEvent("manual_file_ingestion", {
        fileName,
        rowCount,
        errorCount,
        processingTime,
        source,
      });

      return { success: true, rowCount, errorCount, processingTime };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logError(
        error as Error,
        { filePath, source, processingTime },
        "Manual file ingestion failed"
      );

      return {
        success: false,
        rowCount: 0,
        errorCount: 0,
        processingTime,
      };
    }
  }

  // Health check method
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    const sftpConfig = config.getSftpConfig();

    if (!sftpConfig.configured) {
      return { healthy: false, error: "SFTP not configured" };
    }

    try {
      const testSftp = new Client();
      await testSftp.connect({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.user,
        password: sftpConfig.password,
        readyTimeout: 10000,
      });

      // Try to list the remote directory
      await testSftp.list(sftpConfig.remotePath);
      await testSftp.end();

      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const sftpIngestor = new SftpIngestorService();

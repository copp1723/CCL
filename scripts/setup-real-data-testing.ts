#!/usr/bin/env tsx
/**
 * CCL - Real Data Testing Setup Script
 *
 * This script automates the setup process for testing the Complete Car Loans
 * application with real data and services. It performs the following steps:
 *
 * 1. Checks for required environment variables.
 * 2. Tests the database connection.
 * 3. Runs database migrations if necessary.
 * 4. Seeds the database with test data.
 * 5. Validates connectivity to essential external services (Mailgun, OpenRouter).
 * 6. Provides next steps for initiating real data testing.
 *
 * Usage:
 *   npm run setup:real-data-testing
 *   OR
 *   tsx scripts/setup-real-data-testing.ts
 */

import chalk from 'chalk';
import { execa } from 'execa';
import path from 'path';
import fs from 'fs';

// Assuming config, db, logger, emailService are structured as in the CCL project
// Adjust paths if necessary based on your project structure.
import config from '../server/config/environment';
import { db, pool } from '../server/db'; // Assuming db.ts exports 'db' and 'pool'
import { logger } from '../server/logger';
import { emailService } from '../server/services/email-onerylie'; // For Mailgun test

const LOG_PREFIX = chalk.cyan('[SETUP]');
const SUCCESS_PREFIX = chalk.greenBright('[SUCCESS]');
const ERROR_PREFIX = chalk.redBright('[ERROR]');
const WARN_PREFIX = chalk.yellowBright('[WARNING]');
const INFO_PREFIX = chalk.blueBright('[INFO]');

const projectRoot = path.resolve(__dirname, '..');

/**
 * Helper function to print messages with a prefix.
 */
function printMessage(prefix: string, message: string) {
  console.log(`${prefix} ${message}`);
}

/**
 * Step 1: Check for required environment variables.
 */
async function checkEnvVariables(): Promise<boolean> {
  printMessage(LOG_PREFIX, 'Checking environment variables...');
  const appConfig = config.get();
  const requiredEnvVars = [
    'DATABASE_URL',
    'OPENROUTER_API_KEY',
    'MAILGUN_API_KEY',
    'MAILGUN_DOMAIN',
    'NODE_ENV', // Important for DB SSL and other settings
  ];

  const missingVars = requiredEnvVars.filter(varName => !(appConfig as Record<string, any>)[varName]);

  if (missingVars.length > 0) {
    printMessage(ERROR_PREFIX, `Missing required environment variables: ${chalk.red(missingVars.join(', '))}`);
    printMessage(INFO_PREFIX, `Please ensure these are set in your .env file or system environment.`);
    printMessage(INFO_PREFIX, `Refer to .env.example for the full list of required variables.`);
    return false;
  }

  printMessage(SUCCESS_PREFIX, 'All required environment variables are set.');
  return true;
}

/**
 * Step 2: Test database connectivity.
 */
async function testDatabaseConnection(): Promise<boolean> {
  printMessage(LOG_PREFIX, 'Testing database connection...');
  try {
    // db instance from db.ts should already be connected or connect on first query
    await db.execute(sql`SELECT 1`);
    printMessage(SUCCESS_PREFIX, `Database connection successful to: ${chalk.green(config.get().DATABASE_URL?.split('@')[1] || 'DB HOST')}`);
    return true;
  } catch (error) {
    printMessage(ERROR_PREFIX, 'Database connection failed.');
    logger.error({ err: error }, 'Database connection error during setup');
    printMessage(INFO_PREFIX, `Ensure your DATABASE_URL is correct and the PostgreSQL server is running.`);
    return false;
  }
}

/**
 * Step 3: Run database migrations.
 */
async function runDatabaseMigrations(): Promise<boolean> {
  printMessage(LOG_PREFIX, 'Running database migrations...');
  try {
    // Check if drizzle.config.ts exists
    const drizzleConfigPath = path.join(projectRoot, 'drizzle.config.ts');
    if (!fs.existsSync(drizzleConfigPath)) {
        printMessage(WARN_PREFIX, 'drizzle.config.ts not found. Skipping migrations. Ensure your DB schema is up-to-date manually.');
        return true; // Allow to proceed if config is missing, but warn
    }

    printMessage(INFO_PREFIX, `Using Drizzle Kit to apply migrations. This may take a moment...`);
    // It's better to use the npm script if it's defined and handles `drizzle-kit` path correctly
    const { stdout, stderr } = await execa('npm', ['run', 'db:migrate'], { cwd: projectRoot, reject: false });

    if (stderr && !stderr.includes("No migrations to apply") && !stderr.includes("All migrations already applied")) {
      // Some drizzle-kit versions output non-error info to stderr.
      // We only consider it an error if it's not a "no migrations" message.
      const relevantStderr = stderr.split('\n').filter(line => !line.includes('drizzle-kit:migration') && !line.includes('drizzle-kit:migrator') && line.trim() !== '').join('\n');
      if (relevantStderr) {
        printMessage(ERROR_PREFIX, 'Database migration command finished with errors.');
        console.error(chalk.red(relevantStderr));
        return false;
      }
    }
    
    if (stdout.includes("No migrations to apply") || stdout.includes("All migrations already applied") || (stderr && (stderr.includes("No migrations to apply") || stderr.includes("All migrations already applied")))) {
      printMessage(SUCCESS_PREFIX, 'Database schema is up-to-date. No new migrations to apply.');
    } else {
      printMessage(SUCCESS_PREFIX, 'Database migrations applied successfully.');
      // console.log(chalk.gray(stdout)); // Optional: print full stdout
    }
    return true;
  } catch (error: any) {
    // execa throws an error if the command exits with a non-zero code.
    // The error object from execa includes stdout and stderr.
    printMessage(ERROR_PREFIX, 'Database migration failed.');
    if (error.stdout) console.log(chalk.gray('Stdout:\n', error.stdout));
    if (error.stderr) console.error(chalk.red('Stderr:\n', error.stderr));
    if (!error.stdout && !error.stderr) logger.error({ err: error }, 'Migration execution error');
    return false;
  }
}

/**
 * Step 4: Seed test data.
 */
async function seedTestData(): Promise<boolean> {
  printMessage(LOG_PREFIX, 'Seeding test data...');
  const seedScriptPath = path.join(projectRoot, 'scripts', 'seed-test-data.ts');

  if (!fs.existsSync(seedScriptPath)) {
    printMessage(ERROR_PREFIX, `Seed script not found at ${seedScriptPath}. Cannot seed data.`);
    return false;
  }

  try {
    // Using npm run seed to ensure it uses the correct tsx execution context
    const { stdout, stderr } = await execa('npm', ['run', 'seed', '--', '--full'], { cwd: projectRoot }); // Added --full to ensure all data
    printMessage(SUCCESS_PREFIX, 'Test data seeded successfully.');
    // console.log(chalk.gray(stdout)); // Optional: print full stdout from seed script
    if (stderr) {
      printMessage(WARN_PREFIX, 'Seed script produced some stderr output:');
      console.warn(chalk.yellow(stderr));
    }
    return true;
  } catch (error: any) {
    printMessage(ERROR_PREFIX, 'Test data seeding failed.');
    if (error.stdout) console.log(chalk.gray('Stdout:\n', error.stdout));
    if (error.stderr) console.error(chalk.red('Stderr:\n', error.stderr));
    if (!error.stdout && !error.stderr) logger.error({ err: error }, 'Seed script execution error');
    return false;
  }
}

/**
 * Step 5: Validate essential services.
 */
async function validateServices(): Promise<boolean> {
  printMessage(LOG_PREFIX, 'Validating essential services...');
  let allServicesValid = true;

  // Validate Mailgun
  printMessage(INFO_PREFIX, 'Testing Mailgun connection...');
  const appConfig = config.get();
  if (appConfig.MAILGUN_API_KEY && appConfig.MAILGUN_DOMAIN) {
    try {
      // emailService should be initialized with config by this point
      const mailgunStatus = await emailService.testConnection(); // Assumes testConnection exists
      if (mailgunStatus.success) {
        printMessage(SUCCESS_PREFIX, `Mailgun connection successful for domain: ${chalk.green(mailgunStatus.domain)}`);
      } else {
        printMessage(ERROR_PREFIX, `Mailgun connection failed for domain ${mailgunStatus.domain}: ${chalk.red(mailgunStatus.error || 'Unknown error')}`);
        allServicesValid = false;
      }
    } catch (error) {
      printMessage(ERROR_PREFIX, 'Failed to test Mailgun connection.');
      logger.error({ err: error }, 'Mailgun test connection error');
      allServicesValid = false;
    }
  } else {
    printMessage(WARN_PREFIX, 'Mailgun API Key or Domain not configured. Skipping Mailgun validation.');
    // Not necessarily a failure for setup, but a warning.
  }

  // Validate OpenRouter
  printMessage(INFO_PREFIX, 'Checking OpenRouter configuration...');
  if (appConfig.OPENROUTER_API_KEY) {
    printMessage(SUCCESS_PREFIX, 'OpenRouter API Key is configured.');
    // A simple API call could be added here for a more robust check, e.g., list models
    // For now, just checking key presence.
  } else {
    printMessage(WARN_PREFIX, 'OpenRouter API Key not configured. AI agent responses will be limited.');
    // Not necessarily a failure for setup, but a warning.
  }

  // Placeholder for future service validations (e.g., Twilio, Boberdoo if configured)

  if (allServicesValid) {
    printMessage(SUCCESS_PREFIX, 'Essential services validated (or warnings noted).');
  } else {
    printMessage(ERROR_PREFIX, 'One or more essential service validations failed.');
  }
  return allServicesValid;
}

/**
 * Step 6: Print next steps for the user.
 */
function printNextSteps() {
  printMessage(LOG_PREFIX, chalk.bold.magenta('🎉 Setup for Real Data Testing Complete! 🎉'));
  console.log('');
  printMessage(INFO_PREFIX, chalk.underline('Next Steps:'));
  console.log('');
  console.log(`  1. ${chalk.bold('Start the Server')}:`);
  console.log(`     Run ${chalk.yellow('npm run dev')} in your terminal.`);
  console.log(`     The server should start on port ${chalk.bold(config.get().PORT || 5000)}.`);
  console.log('');
  console.log(`  2. ${chalk.bold('Access the Application/Dashboard')}:`);
  console.log(`     If a client/dashboard is part of this project, start it (e.g., ${chalk.yellow('npm run --filter client dev')}).`);
  console.log(`     Open your browser to ${chalk.yellow(config.get().FRONTEND_URL || 'http://localhost:5173')}.`);
  console.log('');
  console.log(`  3. ${chalk.bold('Begin Testing Conversation Workflow')}:`);
  console.log(`     - Use the seeded leads (e.g., from ${chalk.yellow('test_leads.csv')}) to initiate conversations.`);
  console.log(`     - Send emails to your configured Mailgun receiving address to simulate lead replies.`);
  console.log(`     - Check Mailgun logs and application activity feed for email processing.`);
  console.log(`     - Verify agent responses are generated via OpenRouter and sent back.`);
  console.log(`     - Test campaign worker functionality if applicable.`);
  console.log('');
  console.log(`  4. ${chalk.bold('Monitor Logs')}:`);
  console.log(`     Keep an eye on the server console output for any errors or warnings.`);
  console.log('');
  printMessage(INFO_PREFIX, `Refer to ${chalk.yellow('REAL_DATA_TESTING_GUIDE.md')} for detailed testing scenarios.`);
  console.log('');
}

/**
 * Main setup function.
 */
async function setup() {
  printMessage(LOG_PREFIX, chalk.bold('Starting CCL Real Data Testing Environment Setup...'));
  console.log(chalk.gray('--------------------------------------------------'));

  if (!await checkEnvVariables()) {
    printMessage(ERROR_PREFIX, 'Setup aborted due to missing environment variables.');
    process.exit(1);
  }
  console.log(chalk.gray('--------------------------------------------------'));

  if (!await testDatabaseConnection()) {
    printMessage(ERROR_PREFIX, 'Setup aborted due to database connection failure.');
    process.exit(1);
  }
  console.log(chalk.gray('--------------------------------------------------'));

  if (!await runDatabaseMigrations()) {
    printMessage(ERROR_PREFIX, 'Setup aborted due to database migration failure.');
    process.exit(1);
  }
  console.log(chalk.gray('--------------------------------------------------'));

  if (!await seedTestData()) {
    printMessage(ERROR_PREFIX, 'Setup aborted due to test data seeding failure.');
    process.exit(1);
  }
  console.log(chalk.gray('--------------------------------------------------'));

  if (!await validateServices()) {
    printMessage(WARN_PREFIX, 'Service validation finished with warnings/errors. Proceed with caution.');
    // We might not want to exit here if services are optional for some testing.
  }
  console.log(chalk.gray('--------------------------------------------------'));

  printNextSteps();
  
  // Close the database pool after the script is done
  await pool.end().then(() => printMessage(LOG_PREFIX, 'Database pool closed.'));
}

// SQL helper for raw queries if needed (e.g., for db.execute)
function sql(strings: TemplateStringsArray, ...values: any[]): { text: string; values: any[] } {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}` + strings[i + 1];
  }
  return { text, values };
}


// Execute the setup.
setup().catch(error => {
  printMessage(ERROR_PREFIX, 'An unexpected error occurred during setup:');
  logger.fatal({ err: error }, 'Unhandled setup script error');
  pool.end(); // Attempt to close pool on fatal error too
  process.exit(1);
});

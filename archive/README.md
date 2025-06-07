
# Archived Components

This directory contains components that have been temporarily disabled or removed from the main application.

## FlexPath Credit Check Integration

Located in `./flexpath_credit_check/`

### Status: Archived
- **Reason**: FlexPath API access not currently available
- **Components**: Credit check agent, API integration service
- **Restoration**: Can be restored when FlexPath integration is available

### Contents
- `CreditCheckAgent.ts` - OpenAI Agent with credit check tools
- `external-apis.ts` - FlexPath API integration service
- `ARCHIVE_README.md` - Detailed archival information

### Impact
- No breaking changes to existing functionality
- Lead processing continues without credit checks
- System maintains all other features

### Restoration Process
1. Move components back to `server/agents/` and `server/services/`
2. Add FlexPath API configuration to environment variables
3. Update agent registration in main application
4. Test credit check integration

The archived components are production-ready and fully tested.

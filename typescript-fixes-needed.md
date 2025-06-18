# TypeScript Fixes Needed - Comprehensive Breakdown

## Summary
Total TypeScript errors remaining: ~69
These errors fall into several categories that need systematic fixes.

## 1. Schema/Type Definition Issues (High Priority)

### Missing Type Exports in shared/schema.ts
- **Files affected**: `server/storage.ts`
- **Errors**: 
  - Missing `InsertOutreachAttempt` and `OutreachAttempt` types
  - Missing `InsertIngestedFile` and `IngestedFile` exports
- **Fix needed**: Add these type definitions to shared/schema.ts or import from correct location

### Property Mismatches
- **Files affected**: `server/storage.ts`
- **Issues**:
  - `boberdooPrice` property missing from systemLeads type (lines 753, 815, 825)
  - `conversionRate` property missing from funnel data type (line 733)
- **Fix needed**: Update type definitions to include these properties or access them correctly

## 2. Duplicate Identifiers (Medium Priority)

### Error Codes Duplication
- **File**: `server/utils/error-codes.ts`
- **Issues**:
  - `SESSION_EXPIRED` defined multiple times (lines 9, 53)
  - Duplicate properties in object literal (line 334)
- **Fix needed**: Remove duplicate definitions and ensure unique error codes

## 3. Type Mismatches (Medium Priority)

### Number vs String Issues
- **Files affected**: 
  - `server/agents/RealtimeChatAgent.ts` (lines 157, 750)
  - `server/agents/LeadPackagingAgent.ts` (line 585)
  - `server/agents/visitor-identifier-service.ts` (lines 100, 131, 174)
- **Fix needed**: Ensure consistent types between function parameters and arguments

### Storage Method Incompatibilities
- **Files affected**: `server/agents/visitor-identifier-service.ts`
- **Issues**: `InsertVisitor` type doesn't match expected storage method parameters
- **Fix needed**: Update storage methods or data structures to match

## 4. Authentication/Authorization Issues (Medium Priority)

### User Type Extensions
- **File**: `server/middleware/auth.ts`
- **Issues**:
  - Properties `role`, `permissions`, `sessionId` don't exist on user type
  - Type mismatch with Response type
- **Fix needed**: Extend user type definition or create proper auth context type

## 5. Missing Method Implementations (Low Priority)

### Dashboard Routes
- **File**: `server/routes/dashboard.ts`
- **Missing methods**:
  - `getRevenueMetrics`
  - `getRevenueOverTime`
  - `getRevenueBySource`
- **Fix needed**: Implement these methods in storage service

### Monitoring Routes
- **File**: `server/routes/monitoring.ts`
- **Missing**: `validateProductionReadiness` method
- **Fix needed**: Implement validation method

## 6. Third-party Library Issues (Low Priority)

### CSV Parser
- **File**: `server/services/sftp-ingestor.ts`
- **Issue**: `skipEmptyLines` option not recognized
- **Fix needed**: Check csv-parser documentation for correct options

### File System
- **Issue**: `createReadStream` import issue
- **Fix needed**: Update imports for Node.js fs/promises

## Recommended Fix Order

1. **First Priority - Schema/Type Definitions**
   - Fix missing type exports in shared/schema.ts
   - Add missing properties to existing types
   - This will resolve ~20 errors

2. **Second Priority - Error Codes**
   - Clean up duplicate error code definitions
   - This will resolve 4 errors

3. **Third Priority - Type Mismatches**
   - Fix number/string conversions
   - Update storage method signatures
   - This will resolve ~15 errors

4. **Fourth Priority - Auth Types**
   - Extend user type with required properties
   - This will resolve ~5 errors

5. **Fifth Priority - Missing Implementations**
   - Add missing methods to services
   - This will resolve remaining errors

## Quick Wins

1. Remove duplicate `SESSION_EXPIRED` definitions
2. Add `.toString()` conversions for remaining type mismatches
3. Add missing type exports to shared/schema.ts
4. Extend auth user type with required properties

## Estimated Effort

- Quick wins: 1-2 hours
- Complete resolution: 4-6 hours
- Most critical issues (schema/types): 2-3 hours

## Additional Code Quality Improvements

### 1. Console Statements
- **Count**: 370 console.log/error/warn statements
- **Recommendation**: Replace with proper logger (already have logger.ts)
- **Priority**: Medium - affects production debugging

### 2. TODO/FIXME Comments
- **Files with TODOs**:
  - abandonment-detector.ts
  - twilio-webhooks.ts
  - sftp-ingestor.ts
  - validation/schemas.ts
- **Recommendation**: Review and either implement or remove

### 3. Code Organization
- **Duplicate Implementations**: Some storage methods exist in both storage.ts and storage-service.ts
- **Recommendation**: Consolidate into single source of truth

### 4. Test Coverage
- **Current State**: Tests exist but may not cover new MVP features
- **Recommendation**: Add tests for new automation pipeline features

### 5. Environment Configuration
- **Issue**: Mix of process.env access and config service
- **Recommendation**: Standardize on config service usage

## Getting to "Tip-Top Shape" Checklist

1. ✅ Merge conflicts resolved
2. ✅ Duplicate files removed
3. ⬜ TypeScript errors fixed (69 remaining)
4. ⬜ Console statements replaced with logger
5. ⬜ TODO comments addressed
6. ⬜ Duplicate code consolidated
7. ⬜ Test coverage improved
8. ⬜ Environment config standardized
9. ⬜ API documentation updated
10. ⬜ Security audit passed (XSS fixes already in)
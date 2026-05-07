-- Adds the DOCUMENT_EXPIRY_ALERT ActivityType used by
-- src/lib/services/document-expiry.ts.
-- This was originally bundled into the offer-letter migration by accident
-- when prisma migrate dev picked up the schema diff. Split out for clarity.
ALTER TYPE "ActivityType" ADD VALUE 'DOCUMENT_EXPIRY_ALERT';

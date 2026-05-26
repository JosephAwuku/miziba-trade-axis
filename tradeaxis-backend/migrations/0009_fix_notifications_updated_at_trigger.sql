-- Fix: PATCH /api/notifications fails when marking notifications read.
-- schema.sql attaches trg_updated_at to notifications, but that table has no updated_at column.
-- Error: record "new" has no field "updated_at" (PostgreSQL 42703)

DROP TRIGGER IF EXISTS trg_updated_at ON notifications;

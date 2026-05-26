-- Migration: Add type column to notifications
-- Description: Adds type column to support categorizing notifications
-- Date: 2026-05-08

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'info';

COMMENT ON COLUMN notifications.type IS 'Notification type/category (info, warning, success, error, etc.)';

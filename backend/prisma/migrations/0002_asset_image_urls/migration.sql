-- Add imageUrls column to assets table
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] NOT NULL DEFAULT '{}';

-- CallerLog: Supabase PostgreSQL Database Schema
-- Run this script in the Supabase SQL Editor to initialize or restore tables.

-- 1. Enable UUID Extension (default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company_kind VARCHAR(100) DEFAULT 'not known',
    industry VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index on company name for rapid lookups and deduplication
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- 3. Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    role_title VARCHAR(255) DEFAULT 'not known',
    phone_number VARCHAR(50),
    email VARCHAR(255),
    personal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(full_name);

-- 4. Calls Table
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    transcript_id VARCHAR(50), -- e.g. T001, T046
    caller_name VARCHAR(100) NOT NULL, -- e.g. Arjun, Priya, Divya
    duration_seconds INTEGER DEFAULT 0,
    max_stage_number INTEGER NOT NULL DEFAULT 1, -- 1 through 8
    max_stage_name VARCHAR(50) NOT NULL, -- Opening, Purpose, Permission, Their business, etc.
    outcome VARCHAR(50) NOT NULL DEFAULT 'not_logged', -- next_step_agreed, follow_up, do_not_call, etc.
    stage_5_need_verbatim TEXT, -- Crucial: prospect's exact words on need
    objection_summary TEXT, -- Root cause objection if encountered
    next_step_action VARCHAR(255), -- E.g., Send growth report, Schedule Google Meet
    next_step_date_time VARCHAR(100), -- E.g., Next Tuesday after 2 PM
    next_step_channel VARCHAR(50), -- WhatsApp, Email, Phone, Google Meet
    raw_transcript TEXT NOT NULL,
    stage_analysis JSONB DEFAULT '[]'::jsonb, -- Array of stage-by-turn classifications
    call_timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calls_company_id ON calls(company_id);
CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_outcome ON calls(outcome);
CREATE INDEX IF NOT EXISTS idx_calls_max_stage ON calls(max_stage_number);
CREATE INDEX IF NOT EXISTS idx_calls_timestamp ON calls(call_timestamp DESC);

-- 5. Row-Level Security (RLS) Policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated roles full read/write for caller companion operations
CREATE POLICY "Public read/write access for companies" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read/write access for contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read/write access for calls" ON calls FOR ALL USING (true) WITH CHECK (true);

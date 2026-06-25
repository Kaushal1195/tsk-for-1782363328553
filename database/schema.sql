-- Drop tables if they exist to allow for clean re-runs during development
DROP TABLE IF EXISTS expense_audits CASCADE;
DROP TABLE IF EXISTS expense_tags CASCADE;
DROP TABLE IF EXISTS receipts CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS merchant_category_defaults CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS merchants CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Enable UUID generation if not already enabled (for PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Organizations Table
CREATE TABLE organizations (
    organization_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Roles Table
CREATE TABLE roles (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES
('Admin', 'Administrator with full access within an organization'),
('Employee', 'Standard user within an organization'),
('Individual User', 'User without an organization, managing personal expenses')
ON CONFLICT (name) DO NOTHING;

-- Create Users Table
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    organization_id UUID REFERENCES organizations(organization_id) ON DELETE SET NULL,
    role_id UUID NOT NULL REFERENCES roles(role_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Categories Table
CREATE TABLE categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_system_defined BOOLEAN DEFAULT FALSE,
    organization_id UUID REFERENCES organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_category_name_per_scope UNIQUE (name, organization_id, user_id)
);

-- Insert some system-defined categories
INSERT INTO categories (name, description, is_system_defined) VALUES
('Food', 'Expenses related to food and dining', TRUE),
('Transport', 'Transportation costs (fuel, public transport, taxi)', TRUE),
('Utilities', 'Household utility bills (electricity, water, internet)', TRUE),
('Rent', 'Monthly rent or mortgage payments', TRUE),
('Shopping', 'General shopping expenses', TRUE),
('Entertainment', 'Leisure and entertainment activities', TRUE),
('Healthcare', 'Medical expenses and health insurance', TRUE),
('Education', 'Educational fees and supplies', TRUE),
('Salary', 'Income from salary (for tracking purposes)', TRUE),
('Investments', 'Investment related expenses', TRUE)
ON CONFLICT (name, is_system_defined) DO NOTHING;

-- Create Payment Methods Table
CREATE TABLE payment_methods (
    payment_method_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_system_defined BOOLEAN DEFAULT FALSE,
    organization_id UUID REFERENCES organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_payment_method_name_per_scope UNIQUE (name, organization_id, user_id)
);

-- Insert some system-defined payment methods
INSERT INTO payment_methods (name, description, is_system_defined) VALUES
('Credit Card', 'Payments made via credit card', TRUE),
('Debit Card', 'Payments made via debit card', TRUE),
('Cash', 'Cash payments', TRUE),
('Bank Transfer', 'Payments made via direct bank transfer', TRUE),
('PayPal', 'Payments made via PayPal', TRUE)
ON CONFLICT (name, is_system_defined) DO NOTHING;

-- Create Merchants Table
CREATE TABLE merchants (
    merchant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_system_defined BOOLEAN DEFAULT FALSE,
    organization_id UUID REFERENCES organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_merchant_name_per_scope UNIQUE (name, organization_id, user_id)
);

-- Create Tags Table
CREATE TABLE tags (
    tag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(organization_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tag_name_per_scope UNIQUE (name, organization_id, user_id)
);

-- Create Expenses Table
CREATE TABLE expenses (
    expense_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(organization_id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) DEFAULT 'USD',
    expense_date DATE NOT NULL,
    description TEXT,
    merchant_id UUID REFERENCES merchants(merchant_id) ON DELETE SET NULL,
    category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT, -- Prevent deleting categories with linked expenses
    payment_method_id UUID NOT NULL REFERENCES payment_methods(payment_method_id) ON DELETE RESTRICT, -- Prevent deleting payment methods with linked expenses
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Receipts Table
CREATE TABLE receipts (
    receipt_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES expenses(expense_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, -- Denormalized for easier access/security
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size_bytes INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Expense Tags Junction Table
CREATE TABLE expense_tags (
    expense_id UUID NOT NULL REFERENCES expenses(expense_id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (expense_id, tag_id)
);

-- Create Merchant Category Defaults Table
CREATE TABLE merchant_category_defaults (
    merchant_category_default_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE, -- User-specific default
    organization_id UUID REFERENCES organizations(organization_id) ON DELETE CASCADE, -- Organization-wide default
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_merchant_default_per_scope UNIQUE (merchant_id, user_id, organization_id)
);

-- Create Expense Audits Table
CREATE TABLE expense_audits (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES expenses(expense_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- e.g., 'CREATE', 'UPDATE', 'DELETE'
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_expenses_user_id ON expenses (user_id);
CREATE INDEX idx_expenses_organization_id ON expenses (organization_id);
CREATE INDEX idx_expenses_expense_date ON expenses (expense_date);
CREATE INDEX idx_expenses_category_id ON expenses (category_id);
CREATE INDEX idx_expenses_merchant_id ON expenses (merchant_id);
CREATE INDEX idx_expenses_payment_method_id ON expenses (payment_method_id);
CREATE INDEX idx_expense_tags_tag_id ON expense_tags (tag_id);
CREATE INDEX idx_receipts_expense_id ON receipts (expense_id);
CREATE INDEX idx_receipts_user_id ON receipts (user_id);
CREATE INDEX idx_merchant_category_defaults_merchant_id ON merchant_category_defaults (merchant_id);
CREATE INDEX idx_merchant_category_defaults_user_id ON merchant_category_defaults (user_id);
CREATE INDEX idx_merchant_category_defaults_organization_id ON merchant_category_defaults (organization_id);
CREATE INDEX idx_users_organization_id ON users (organization_id);
CREATE INDEX idx_users_role_id ON users (role_id);
CREATE INDEX idx_categories_organization_id ON categories (organization_id);
CREATE INDEX idx_categories_user_id ON categories (user_id);
CREATE INDEX idx_payment_methods_organization_id ON payment_methods (organization_id);
CREATE INDEX idx_payment_methods_user_id ON payment_methods (user_id);
CREATE INDEX idx_merchants_organization_id ON merchants (organization_id);
CREATE INDEX idx_merchants_user_id ON merchants (user_id);
CREATE INDEX idx_tags_organization_id ON tags (organization_id);
CREATE INDEX idx_tags_user_id ON tags (user_id);

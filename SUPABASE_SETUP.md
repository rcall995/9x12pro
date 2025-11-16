# Supabase Setup Instructions for Authentication

This document explains how to configure Supabase for the authentication system with user approval workflow.

## Database Setup

You need to create a table in your Supabase database to track user approvals.

### 1. Create the `user_approvals` table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create user_approvals table
CREATE TABLE user_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  approved BOOLEAN DEFAULT FALSE,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add index for faster lookups
CREATE INDEX idx_user_approvals_user_id ON user_approvals(user_id);
CREATE INDEX idx_user_approvals_approved ON user_approvals(approved);

-- Add Row Level Security (RLS)
ALTER TABLE user_approvals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own approval status
CREATE POLICY "Users can view own approval status"
  ON user_approvals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Anyone can insert their own approval request (during registration)
CREATE POLICY "Users can insert own approval request"
  ON user_approvals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can update any approval (you'll need to create admin users)
-- For now, we'll allow service role to update (you can refine this later)
```

### 2. Configure Email Settings

In your Supabase Dashboard:

1. Go to **Authentication** > **Email Templates**
2. Customize the **Confirm signup** email template
3. Customize the **Reset password** email template

### 3. Configure URL Configuration

In your Supabase Dashboard:

1. Go to **Authentication** > **URL Configuration**
2. Add your site URL:
   - For local development: `http://localhost:8080` (or whatever port you use)
   - For production: Your actual domain (e.g., `https://10kpostcards.com`)
3. Add to **Redirect URLs**:
   - `http://localhost:8080/10k-files/*`
   - `https://yourdomain.com/10k-files/*`

### 4. Disable Email Confirmation (Optional)

If you want users to be able to log in immediately after registration (before approval), you can:

1. Go to **Authentication** > **Providers** > **Email**
2. Uncheck **"Confirm email"**

This allows users to create accounts, but they still won't be able to access the system until approved.

Alternatively, if you want email confirmation AND approval, keep it checked.

## Approving Users

### Method 1: Via Supabase Dashboard (Recommended for now)

1. Go to **Table Editor** > **user_approvals**
2. Find the user you want to approve
3. Click on the row to edit
4. Set `approved` to `true`
5. Optionally set `approved_at` to the current timestamp
6. Save

### Method 2: Via SQL

Run this SQL in your Supabase SQL Editor:

```sql
-- Approve a user by email
UPDATE user_approvals
SET approved = true,
    approved_at = NOW()
WHERE email = 'user@example.com';
```

### Method 3: Create an Admin Interface (Future Enhancement)

You could create an admin page that lists pending approvals and allows you to approve/reject them with a button click. This would require:

1. Creating an admin role or permission system
2. Building an admin interface (HTML page)
3. Adding API calls to update the user_approvals table

## Testing the Authentication Flow

### 1. Test Registration

1. Go to `http://localhost:8080/10k-files/register.html`
2. Fill out the registration form
3. Submit
4. You should be redirected to the login page with a success message

### 2. Test Login Before Approval

1. Go to `http://localhost:8080/10k-files/login.html`
2. Try to log in with the newly created account
3. You should see a message: "Your account is pending approval"

### 3. Approve the User

1. Go to Supabase Dashboard > Table Editor > user_approvals
2. Find your test user
3. Set `approved` to `true`
4. Save

### 4. Test Login After Approval

1. Go to `http://localhost:8080/10k-files/login.html`
2. Log in with the approved account
3. You should be redirected to the main page (index.html)
4. You should see your name and a "Logout" button in the navigation

### 5. Test Protected Pages

1. While logged in, navigate to any page (e.g., markets.html, pricing.html)
2. You should see the page content
3. Click "Logout"
4. Try to access the same page again
5. You should be redirected to the login page

### 6. Test Forgot Password

1. Go to `http://localhost:8080/10k-files/forgot-password.html`
2. Enter your email
3. Submit
4. Check your email for the password reset link
5. Click the link and reset your password

## Security Notes

1. **Never commit API keys**: The Supabase anon key is safe to use in client-side code, but make sure you never commit service role keys.

2. **Row Level Security (RLS)**: Make sure RLS is enabled on the user_approvals table to prevent unauthorized access.

3. **Email Verification**: Consider enabling email verification for additional security.

4. **Admin Roles**: For a production system, you should create a proper admin role system instead of manually updating the database.

5. **Rate Limiting**: Configure rate limiting in Supabase to prevent brute force attacks.

## Troubleshooting

### Users can't log in after registration
- Check if the user exists in Authentication > Users
- Check if an approval record exists in user_approvals table
- Check if `approved` is set to `true`

### Password reset emails not arriving
- Check your email provider settings in Supabase
- Check spam/junk folders
- Verify the redirect URL is configured correctly

### Authentication errors
- Check the browser console for error messages
- Verify the Supabase URL and anon key are correct
- Check if RLS policies are too restrictive

## Next Steps

Consider these enhancements for a production system:

1. **Admin Dashboard**: Create an admin interface to manage user approvals
2. **Email Notifications**: Send emails when users are approved/rejected
3. **User Roles**: Implement different user roles (admin, user, etc.)
4. **Audit Log**: Track who approved which users and when
5. **Session Management**: Configure session timeout and refresh token settings
6. **Two-Factor Authentication**: Add 2FA for additional security

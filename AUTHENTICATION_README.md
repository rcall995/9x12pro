# Authentication System for 10k Postcards

This site now has a complete email/password authentication system with user approval workflow. All pages in the `10k-files` folder are protected and require login.

## Features

✅ User registration with email and password
✅ Login/logout functionality
✅ Admin approval workflow (users must be approved before they can access the site)
✅ Password reset via email
✅ Protected pages - all pages in 10k-files folder require authentication
✅ Admin dashboard to manage user approvals
✅ Session management with Supabase Auth

## Files Created

### Authentication Pages
- `10k-files/login.html` - Login page
- `10k-files/register.html` - Registration page (users request access)
- `10k-files/forgot-password.html` - Password reset page
- `10k-files/admin.html` - Admin dashboard for approving users

### Core Files
- `10k-files/auth.js` - Main authentication logic (included in all protected pages)
- `SUPABASE_SETUP.md` - Detailed setup instructions for Supabase
- `add-auth-to-pages.js` - Helper script to add auth to all pages (already run)

## Quick Start

### 1. Set Up Supabase Database

You need to create the `user_approvals` table in your Supabase database. Open your Supabase project at https://supabase.com and run this SQL:

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

-- Add indexes
CREATE INDEX idx_user_approvals_user_id ON user_approvals(user_id);
CREATE INDEX idx_user_approvals_approved ON user_approvals(approved);

-- Enable Row Level Security
ALTER TABLE user_approvals ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own approval status
CREATE POLICY "Users can view own approval status"
  ON user_approvals FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own approval request
CREATE POLICY "Users can insert own approval request"
  ON user_approvals FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 2. Configure Supabase Settings

1. Go to **Authentication** > **URL Configuration** in your Supabase dashboard
2. Add your site URLs:
   - Local: `http://localhost:8080` (or your port)
   - Production: Your domain
3. Add redirect URLs:
   - `http://localhost:8080/10k-files/*`
   - `https://yourdomain.com/10k-files/*`

### 3. Test the System

1. Start your local server:
   ```bash
   npx http-server
   ```

2. Navigate to `http://localhost:8080/10k-files/index.html`
   - You should be redirected to the login page

3. Click "Request Access" and create an account
   - You'll be redirected back to login with a success message

4. Try to log in
   - You'll see "Your account is pending approval"

5. Approve yourself:
   - Option A: Go to `http://localhost:8080/10k-files/admin.html` and approve the user
   - Option B: Go to Supabase Dashboard > Table Editor > user_approvals and set `approved` to `true`

6. Log in again
   - You should now be able to access all pages
   - You'll see your name and a "Logout" button in the navigation

## User Workflow

### Registration Flow
1. User visits any protected page → redirected to login
2. User clicks "Request Access" → fills out registration form
3. User submits form → account created but not approved
4. User redirected to login with message about pending approval

### Approval Flow
1. Admin receives notification (you'll need to check manually or set up email notifications)
2. Admin goes to `10k-files/admin.html`
3. Admin sees pending approvals
4. Admin clicks "Approve" or "Reject"
5. User can now log in (if approved)

### Login Flow
1. User goes to `login.html`
2. User enters email and password
3. System checks if user is approved
4. If approved: redirected to protected pages
5. If not approved: shown pending message and signed out

## Admin Dashboard

Access the admin dashboard at: `http://localhost:8080/10k-files/admin.html`

Features:
- View all pending approval requests
- View all approved users
- Approve users with one click
- Reject users (deletes approval record)

Note: Currently, any logged-in user can access the admin page. In production, you should add additional checks to restrict this to actual administrators.

## Security Features

1. **Row Level Security (RLS)**: Users can only view/modify their own approval records
2. **Password Requirements**: Minimum 6 characters (configurable)
3. **Session Management**: Automatic session handling via Supabase
4. **Protected Routes**: All pages check authentication before loading
5. **Approval Workflow**: Prevents unauthorized users from accessing the system

## File Structure

```
10k-files/
├── login.html              # Login page
├── register.html           # Registration page
├── forgot-password.html    # Password reset
├── admin.html             # Admin dashboard
├── auth.js                # Core authentication logic
├── index.html             # Protected page (includes auth.js)
├── about.html             # Protected page (includes auth.js)
├── ... (all other pages)  # Protected pages (include auth.js)
```

## Customization

### Change Password Requirements
Edit `register.html` line ~183:
```javascript
if (password.length < 6) {  // Change 6 to your desired minimum
```

### Customize Login Redirect
Edit `auth.js` to change where users go after login. Currently they stay on the page they tried to access.

### Add Admin Role
To restrict admin.html to specific users:
1. Add an `is_admin` column to user_approvals table
2. Check this in admin.html before loading the page
3. Only allow admins to approve other users

### Email Customization
In Supabase Dashboard > Authentication > Email Templates:
- Customize signup confirmation email
- Customize password reset email
- Add custom branding

## Troubleshooting

### Can't log in after registration
- Check if user exists in Supabase > Authentication > Users
- Check if approval record exists in user_approvals table
- Make sure `approved` is set to `true`

### Redirected to login constantly
- Check browser console for errors
- Verify Supabase URL and anon key are correct
- Clear browser cache and cookies

### Password reset not working
- Check email spam folder
- Verify redirect URL is configured in Supabase
- Check Supabase email settings

### Admin page shows errors
- Verify user_approvals table exists
- Check RLS policies allow SELECT queries
- Check browser console for specific errors

## Next Steps

Consider these enhancements:

1. **Email Notifications**: Send emails when users are approved
2. **Real Admin Roles**: Add proper admin role system
3. **User Management**: Allow admins to deactivate users
4. **Audit Logging**: Track who approved which users
5. **Two-Factor Authentication**: Add 2FA via Supabase
6. **Social Login**: Add Google/GitHub login options
7. **Session Timeout**: Configure automatic logout after inactivity

## Support

For detailed Supabase setup instructions, see `SUPABASE_SETUP.md`

For issues or questions:
1. Check browser console for errors
2. Check Supabase logs in your dashboard
3. Review the RLS policies on your tables
4. Make sure your URLs are configured correctly

# Security Features in OwlDoo Frontend

This document outlines the security features implemented in the OwlDoo frontend application and how to use them properly.

## Authentication Security

The authentication system uses several security best practices:

1. **HTTP-Only Cookies**: Sensitive tokens are stored in HTTP-only cookies, not in localStorage or sessionStorage
2. **CSRF Protection**: All authenticated requests include CSRF tokens
3. **Token Refresh**: Access tokens are automatically refreshed before they expire
4. **Session Management**: Inactive sessions are automatically timed out

## How to Use Security Features

### In Components

To use the session timeout warning in your application, wrap your main App component:

```tsx
import SessionTimeoutWarning from './components/SessionTimeoutWarning/SessionTimeoutWarning';

function App() {
  return (
    <SessionTimeoutWarning>
      {/* Your app content */}
    </SessionTimeoutWarning>
  );
}
```

### For API Requests

Always use the provided API utilities which automatically handle CSRF tokens and authentication:

```tsx
import { apiService } from './api/api';

// The apiService automatically adds CSRF tokens and handles authentication
const data = await apiService.get('/some-endpoint');
```

### Backend Requirements

For these security features to work properly, your backend must implement:

1. `/api/auth/csrf-token` - To generate and provide CSRF tokens
2. `/api/auth/set-cookies` - To set HTTP-only cookies
3. `/api/auth/clear-cookies` - To clear HTTP-only cookies
4. `/api/auth/validate` - To validate authentication status
5. `/api/auth/refresh-token` - To refresh the access token
6. `/api/auth/session` - To check if the server-side session is still valid

## Security Considerations

- Never store sensitive tokens in localStorage or sessionStorage
- Always use the provided API utilities which handle CSRF protection
- Implement proper validation on the backend for all requests

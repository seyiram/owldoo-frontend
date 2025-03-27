# Owldoo Frontend Development Guidelines

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production (runs TypeScript check first)
- `npm run lint` - Run ESLint on all files
- `npm run typecheck` - Run TypeScript type checking
- `npm run preview` - Preview production build locally

## API and Network Configuration
- **NEVER hardcode URLs**: Always use relative URLs like `/api/auth/status` instead of `http://localhost:3000/api/auth/status`
- **Configure proxies**: All external API calls must go through the Vite proxy in vite.config.ts
  - Ensure ALL endpoints are properly proxied (including root endpoints like `/health`)
  - Each top-level route needs its own proxy configuration in vite.config.ts
- **API Path Consistency**: Make sure frontend API paths match backend route definitions exactly
- **Base URLs**: Always use the configured API_BASE or environment variables for API paths
- **CORS handling**: Always include `credentials: 'include'` for authenticated requests
- **Content Types**: Always specify `'Accept': 'application/json'` in headers

## Authentication Best Practices
- **Cookie Authentication**: Use HTTP-only cookies for secure auth with auth_session cookie
- **Auth Store**: Use useAuthStore for centralized auth state management
- **Separation of Concerns**: Keep app auth separate from Google Calendar auth
- **Auth Checks**: Always verify auth status via server endpoints (/api/auth/status)
- **Auth Redundancy**: Implement fallback mechanisms for auth verification
- **Local Storage**: Use for non-sensitive data only; keep tokens in HTTP-only cookies
- **Auth Expiry**: Track expiry dates properly and refresh before expiration
- **Lazy Authentication**: Only check authentication when needed for features that require it

## Error Handling
- **Network Errors**: Catch and handle fetch errors with specific error types
- **API Errors**: Check for specific error responses from backend
- **Auth Failures**: Detect token expiry and trigger re-authentication
- **JSON Parsing**: Use try/catch when parsing JSON responses
- **Recovery Flows**: Implement graceful recovery for authentication failures
- **Logging**: Use descriptive console.log statements for debugging with context

## Code Style
- **Imports**: Group imports by source (React, then external libraries, then local files)
- **Types**: Use TypeScript interfaces/types; enforce strict typing with proper generics
- **Components**: Use functional components with React.FC type
- **State Management**: Use Zustand for state, with strong typing (see useChatStore pattern)
- **Hooks**: Use React.useCallback for event handlers and React.useMemo for computed values
- **Naming**: 
  - PascalCase for components and interfaces
  - camelCase for variables, functions, and instances
  - Use descriptive names that reflect purpose
- **Comments**:
  - Include only comments that help future developers understand the code
  - Avoid unnecessary or redundant commentary that restates the obvious
  - Use comments to explain complex logic, edge cases, or non-obvious behavior

## React Query Usage
- Use the @tanstack/react-query hooks for data fetching
- Implement proper query keys and cache invalidation strategies

## Code Organization
- Keep components focused on a single responsibility
- Extract complex logic into custom hooks
- Use consistent logging patterns for debugging
- Implement proper state sharing between components

## Authentication Debugging Workflow
- Check auth cookies with document.cookie.includes('auth_session=true')
- Verify token storage in localStorage with getItem/setItem
- Ensure proper API endpoint URLs and proxy configuration
- Inspect network requests for proper credentials and CORS settings
- Add explicit console logging for auth state changes and errors

## Connection & CORS Debugging
- Check browser console for 404 errors which may indicate proxy misconfigurations
- Verify all backend endpoints have corresponding proxy configurations
- Ensure backend route paths match frontend API call paths exactly
- For non-nested routes (e.g., `/health`), ensure they have their own proxy config
- Test connections with browser network tab to isolate CORS vs route issues
- Verify backend CORS configuration allows the correct origins and headers

## Performance Optimization
- Disable debug logging in production using feature flags (`const DEBUG = false`)
- Implement caching strategies to avoid redundant API calls
- Use the browser's localStorage or sessionStorage for non-sensitive data
- Optimize authentication checks using expiry times and cookie checks
- Avoid duplicate effect triggers by using refs to track loaded state
- Consider using React Query's caching mechanisms for API responses
- Pre-fetch common data at the app initialization stage
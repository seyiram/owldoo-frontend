# Owldoo Frontend Development Guidelines

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production (runs TypeScript check first)
- `npm run lint` - Run ESLint on all files
- `npm run preview` - Preview production build locally

## Code Style
- **Imports**: Group imports by source (React, then external libraries, then local files)
- **Types**: Use TypeScript interfaces/types; enforce strict typing with proper generics
- **Components**: Use functional components with React.FC type
- **State Management**: Use Zustand for state, with strong typing (see useChatStore pattern)
- **Hooks**: Use React.useCallback for event handlers and React.useMemo for computed values
- **Error Handling**: Try/catch blocks with proper error logging in console
- **Naming**: 
  - PascalCase for components and interfaces
  - camelCase for variables, functions, and instances
  - Use descriptive names that reflect purpose

## React Query Usage
- Use the @tanstack/react-query hooks for data fetching
- Implement proper query keys and cache invalidation strategies

## Code Organization
- Keep components focused on a single responsibility
- Extract complex logic into custom hooks
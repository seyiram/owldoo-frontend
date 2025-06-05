# Owldoo Frontend

A modern React-based frontend for the Owldoo AI calendar management system, providing an intuitive interface for natural language calendar interactions.

## Features

- 💬 Natural language interface for calendar management
- 🔐 Google Authentication integration
- 📅 Interactive calendar view
- 🎨 Modern, responsive UI
- 🔄 Real-time updates
- 📱 Mobile-friendly design

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Routing**: React Router v7
- **UI Components**: Custom components with Lucide icons
- **Styling**: CSS Modules

## Prerequisites

- Node.js (v22.12.0 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd owldoo-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
VITE_API_URL=your_backend_api_url
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## Development

Start the development server:
```bash
npm run dev
```

## Production

Build the production bundle:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
src/
├── api/        # API integration and services
├── assets/     # Static assets
├── components/ # React components
├── hooks/      # Custom React hooks
├── lib/        # Third-party library configurations
├── store/      # Zustand store
├── types/      # TypeScript type definitions
└── utils/      # Utility functions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

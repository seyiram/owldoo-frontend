import "./App.css";

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import ChatCompose from "./components/Chat/ChatCompose/ChatCompose";
import ChatThread from "./components/Chat/ChatThread/ChatThread";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import WorkingHours from "./components/Scheduling/WorkingHours/WorkingHours";
import MeetingPreferences from "./components/Scheduling/MeetingPreferences/MeetingPreferences";
import FocusTimePreferences from "./components/Scheduling/FocusTimePreferences/FocusTimePreferences";
import NLPDashboard from "./components/NLPDashboard/NLPDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

function NotFound() {
  return (
    <div className="error-container">
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <button onClick={() => (window.location.href = "/")}>Go to Home</button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Home route (ChatCompose) is always accessible */}
          <Route path="/" element={<ChatCompose />} />
          
          {/* Protected routes that require authentication */}
          <Route path="/chat/:threadId" element={
            <ProtectedRoute>
              <ChatThread />
            </ProtectedRoute>
          } />
          <Route path="/settings/working-hours" element={
            <ProtectedRoute>
              <WorkingHours />
            </ProtectedRoute>
          } />
          <Route path="/settings/meeting-preferences" element={
            <ProtectedRoute>
              <MeetingPreferences />
            </ProtectedRoute>
          } />
          <Route path="/settings/focus-time" element={
            <ProtectedRoute>
              <FocusTimePreferences />
            </ProtectedRoute>
          } />
          <Route path="/nlp-dashboard" element={
            <ProtectedRoute>
              <NLPDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;

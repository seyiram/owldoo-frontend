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
          <Route path="/" element={<ChatCompose />} />
          <Route path="/chat/:threadId" element={<ChatThread />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;

import "./AgentDashboard.css";
import React, { useState, useEffect } from "react";
import { apiService } from "../../api/api";
import { AgentStats, AgentTask, Insight } from "../../types/agent.types";


const AgentDashboard: React.FC = () => {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [statsData, tasksData, insightsData] = await Promise.all([
        apiService.getAgentStats(),
        apiService.getAgentTasks(),
        apiService.getAgentInsights(),
      ]);
      setStats(statsData);
      setTasks(tasksData);
      setInsights(insightsData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="agent-dashboard-loading">Loading dashboard data...</div>
    );
  }

  if (error) {
    return (
      <div className="agent-dashboard-error">
        Error fetching dashboard data: {error}
      </div>
    );
  }

  return (
    <div className="agent-dashboard">
      <h1 className="dashboard-title">AI Assistant Dashboard</h1>

      <div className="stats-overview">
        <div className="stat-card">
          <h3>Events Managed</h3>
          <div className="stat-value">{stats?.eventsManaged || 0}</div>
        </div>

        <div className="stat-card">
          <h3>Suggestions</h3>
          <div className="stat-value">{stats?.suggestionsGenerated || 0}</div>
          <div className="stat-subtext">
            {stats?.suggestionsAcceptedRate || 0}% acceptance rate
          </div>
        </div>

        <div className="stat-card">
          <h3>Insights Generated</h3>
          <div className="stat-value">{stats?.insightsGenerated || 0}</div>
        </div>

        <div className="stat-card">
          <h3>Accuracy Rate</h3>
          <div className="stat-value">{stats?.accuracyRate || 0}%</div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${stats?.accuracyRate || 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <h2>Recent Tasks</h2>
          <div className="tasks-list">
            {tasks.length === 0 ? (
              <p className="empty-state">No tasks found</p>
            ) : (
              tasks.slice(0, 5).map((task) => (
                <div
                  key={task._id}
                  className={`task-item status-${task.status}`}
                >
                  <div className="task-header">
                    <h3>{task.title}</h3>
                    <span className={`task-status ${task.status}`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="task-description">{task.description}</p>
                  <div className="task-footer">
                    <span className="task-date">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="dashboard-section">
          <h2>Recent Insights</h2>
          <div className="insights-list">
            {insights.length === 0 ? (
              <p className="empty-state">No insights found</p>
            ) : (
              insights.slice(0, 5).map((insight) => (
                <div key={insight._id} className="insight-item">
                  <div className="insight-header">
                    <h3>{insight.title}</h3>
                    <span className={`insight-category ${insight.category}`}>
                      {insight.category}
                    </span>
                  </div>
                  <p className="insight-description">{insight.description}</p>
                  <div className="insight-footer">
                    <span className="insight-date">
                      {new Date(insight.timestamp).toLocaleDateString()}
                    </span>
                    {insight.actionable && insight.actionLink && (
                      <a
                        href={insight.actionLink}
                        className="insight-action-link"
                      >
                        Take Action
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-section full-width">
        <h2>Task Distribution</h2>
        <div className="chart-container">
          {stats?.taskDistribution && stats.taskDistribution.length > 0 ? (
            <div className="distribution-chart">
              {stats.taskDistribution.map((item, index) => (
                <div key={index} className="distribution-item">
                  <div className="distribution-label">{item.name}</div>
                  <div className="distribution-bar-container">
                    <div
                      className="distribution-bar"
                      style={{
                        width: `${
                          (item.value /
                            stats.taskDistribution.reduce(
                              (sum, i) => sum + i.value,
                              0
                            )) *
                          100
                        }%`,
                        backgroundColor: `hsl(${index * 60}, 70%, 60%)`,
                      }}
                    ></div>
                  </div>
                  <div className="distribution-value">{item.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No distribution data available</p>
          )}
        </div>
      </div>

      <div className="dashboard-section full-width">
        <h2>Weekly Activity</h2>
        <div className="chart-container">
          {stats?.weeklyActivity && stats.weeklyActivity.length > 0 ? (
            <div className="weekly-chart">
              {stats.weeklyActivity.map((day, index) => (
                <div key={index} className="weekly-day">
                  <div className="weekly-label">{day.day}</div>
                  <div className="weekly-bars">
                    <div className="weekly-bar-container">
                      <div
                        className="weekly-bar events-bar"
                        style={{
                          height: `${day.events * 10}px`,
                          maxHeight: "100px",
                        }}
                      ></div>
                      <div className="weekly-bar-label">Events</div>
                    </div>
                    <div className="weekly-bar-container">
                      <div
                        className="weekly-bar tasks-bar"
                        style={{
                          height: `${day.tasks * 10}px`,
                          maxHeight: "100px",
                        }}
                      ></div>
                      <div className="weekly-bar-label">Tasks</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No weekly activity data available</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;

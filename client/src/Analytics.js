import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Analytics.css';

function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('http://localhost:5000/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setAnalytics(response.data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="analytics-loading">📊 Loading Analytics...</div>;
  }

  if (!analytics) {
    return <div className="analytics-error">❌ Failed to load analytics</div>;
  }

  return (
    <div className="analytics-dashboard">
      <h1>📊 Conversion Analytics Dashboard</h1>
      
      {/* Overview Stats */}
      <div className="overview-grid">
        <div className="stat-card">
          <h3>📈 Total Conversions</h3>
          <p className="stat-number">{analytics.overview.totalConversions}</p>
        </div>
        <div className="stat-card">
          <h3>📅 Today's Conversions</h3>
          <p className="stat-number">{analytics.overview.todayConversions}</p>
        </div>
        <div className="stat-card">
          <h3>📁 Files Processed</h3>
          <p className="stat-number">{analytics.overview.totalFilesProcessed}</p>
        </div>
        <div className="stat-card">
          <h3>⚡ Avg Processing Time</h3>
          <p className="stat-number">{(analytics.overview.avgProcessingTime / 1000).toFixed(2)}s</p>
        </div>
      </div>

      {/* Format Statistics */}
      <div className="analytics-section">
        <h2>🎯 Format Statistics</h2>
        <div className="format-stats">
          <div className="format-chart">
            <h3>📤 Most Used Output Formats</h3>
            <div className="chart-bars">
              {analytics.formats.output.map((format, index) => (
                <div key={index} className="chart-bar">
                  <span className="format-name">{format._id.toUpperCase()}</span>
                  <div className="bar-container">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${(format.count / analytics.formats.output[0].count) * 100}%` }}
                    ></div>
                    <span className="bar-value">{format.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="format-chart">
            <h3>📥 Most Used Input Formats</h3>
            <div className="chart-bars">
              {analytics.formats.input.map((format, index) => (
                <div key={index} className="chart-bar">
                  <span className="format-name">{format._id.toUpperCase()}</span>
                  <div className="bar-container">
                    <div 
                      className="bar-fill input-bar" 
                      style={{ width: `${(format.count / analytics.formats.input[0].count) * 100}%` }}
                    ></div>
                    <span className="bar-value">{format.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Device Statistics */}
      <div className="analytics-section">
        <h2>📱 Device Statistics</h2>
        <div className="device-stats">
          {analytics.devices.map((device, index) => (
            <div key={index} className="device-card">
              <span className="device-icon">{device._id === 'mobile' ? '📱' : '💻'}</span>
              <span className="device-name">{device._id === 'mobile' ? 'Mobile' : 'Desktop'}</span>
              <span className="device-count">{device.count} conversions</span>
              <div className="device-percentage">
                {((device.count / analytics.overview.totalConversions) * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Users */}
      <div className="analytics-section">
        <h2>👥 Active Users (Last 7 Days)</h2>
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Conversions</th>
                <th>Files Processed</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {analytics.users.active.map((user, index) => (
                <tr key={index}>
                  <td>{user._id}</td>
                  <td>{user.conversions}</td>
                  <td>{user.totalFiles}</td>
                  <td>{new Date(user.lastActive).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Files */}
      <div className="analytics-section">
        <h2>🔥 Most Converted Files</h2>
        <div className="files-list">
          {analytics.files.topConverted.slice(0, 10).map((file, index) => (
            <div key={index} className="file-stat">
              <span className="file-rank">#{index + 1}</span>
              <span className="file-name">{file._id}</span>
              <span className="file-count">{file.count} times</span>
              <div className="file-formats">
                {file.formats.map(format => (
                  <span key={format} className="format-tag">{format}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Trends */}
      <div className="analytics-section">
        <h2>📈 Daily Conversion Trends (Last 30 Days)</h2>
        <div className="trend-chart">
          {analytics.trends.daily.map((day, index) => (
            <div key={index} className="trend-bar">
              <div 
                className="trend-fill"
                style={{ height: `${(day.count / Math.max(...analytics.trends.daily.map(d => d.count))) * 100}%` }}
                title={`${day._id.day}/${day._id.month}: ${day.count} conversions`}
              ></div>
              <span className="trend-date">{day._id.day}/{day._id.month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Analytics;
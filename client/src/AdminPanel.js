import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Analytics from './Analytics';
import './AdminPanel.css';

function AdminPanel() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [users, setUsers] = useState([]);
  const [conversions, setConversions] = useState([]);
  const [apiUsage, setApiUsage] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'api') fetchApiUsage();
  }, [activeTab]);

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`http://localhost:5000/admin/users?page=${page}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setUsers(response.data.users);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (page = 1) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`http://localhost:5000/admin/history?page=${page}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setConversions(response.data.conversions);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApiUsage = async (page = 1) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`http://localhost:5000/admin/api-usage?page=${page}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setApiUsage(response.data.usage);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch API usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (username, action) => {
    try {
      const token = localStorage.getItem('adminToken');
      await axios.post(`http://localhost:5000/admin/users/${username}/ban`, 
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(`User ${action}ned successfully`);
      fetchUsers();
    } catch (error) {
      alert('Failed to update user status');
    }
  };

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Delete user ${username}? This will remove all their data.`)) return;
    
    try {
      const token = localStorage.getItem('adminToken');
      await axios.delete(`http://localhost:5000/admin/users/${username}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('User deleted successfully');
      fetchUsers();
    } catch (error) {
      alert('Failed to delete user');
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!window.confirm('Delete this conversion log?')) return;
    
    try {
      const token = localStorage.getItem('adminToken');
      await axios.delete(`http://localhost:5000/admin/logs/${logId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Log deleted successfully');
      fetchHistory();
    } catch (error) {
      alert('Failed to delete log');
    }
  };

  const handleBulkDeleteLogs = async () => {
    const days = prompt('Delete logs older than how many days?', '30');
    if (!days) return;
    
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.delete('http://localhost:5000/admin/logs', {
        data: { days: parseInt(days) },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert(response.data.message);
      fetchHistory();
    } catch (error) {
      alert('Failed to delete logs');
    }
  };

  return (
    <div className=\"admin-panel\">\n      <div className=\"admin-header\">\n        <h1>🔧 Admin Control Panel</h1>\n        <div className=\"admin-tabs\">\n          <button \n            className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}\n            onClick={() => setActiveTab('analytics')}\n          >\n            📊 Analytics\n          </button>\n          <button \n            className={`tab ${activeTab === 'users' ? 'active' : ''}`}\n            onClick={() => setActiveTab('users')}\n          >\n            👥 Users\n          </button>\n          <button \n            className={`tab ${activeTab === 'history' ? 'active' : ''}`}\n            onClick={() => setActiveTab('history')}\n          >\n            📋 History\n          </button>\n          <button \n            className={`tab ${activeTab === 'api' ? 'active' : ''}`}\n            onClick={() => setActiveTab('api')}\n          >\n            🔌 API Usage\n          </button>\n        </div>\n      </div>\n\n      {activeTab === 'analytics' && <Analytics />}\n\n      {activeTab === 'users' && (\n        <div className=\"admin-content\">\n          <div className=\"content-header\">\n            <h2>👥 User Management</h2>\n          </div>\n          \n          {loading ? (\n            <div className=\"loading\">Loading users...</div>\n          ) : (\n            <div className=\"users-table\">\n              <table>\n                <thead>\n                  <tr>\n                    <th>Username</th>\n                    <th>Role</th>\n                    <th>Status</th>\n                    <th>Conversions</th>\n                    <th>Files Processed</th>\n                    <th>Last Login</th>\n                    <th>Created</th>\n                    <th>Actions</th>\n                  </tr>\n                </thead>\n                <tbody>\n                  {users.map((user, index) => (\n                    <tr key={index} className={user.status === 'banned' ? 'banned-user' : ''}>\n                      <td>{user.username}</td>\n                      <td>\n                        <span className={`role-badge ${user.role}`}>\n                          {user.role === 'admin' ? '👑' : '👤'} {user.role}\n                        </span>\n                      </td>\n                      <td>\n                        <span className={`status-badge ${user.status}`}>\n                          {user.status === 'active' ? '✅' : '🚫'} {user.status}\n                        </span>\n                      </td>\n                      <td>{user.totalConversions || 0}</td>\n                      <td>{user.totalFilesProcessed || 0}</td>\n                      <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>\n                      <td>{new Date(user.createdAt).toLocaleDateString()}</td>\n                      <td>\n                        <div className=\"user-actions\">\n                          {user.role !== 'admin' && (\n                            <>\n                              <button \n                                onClick={() => handleBanUser(user.username, user.status === 'active' ? 'ban' : 'unban')}\n                                className={`action-btn ${user.status === 'active' ? 'ban' : 'unban'}`}\n                              >\n                                {user.status === 'active' ? '🚫 Ban' : '✅ Unban'}\n                              </button>\n                              <button \n                                onClick={() => handleDeleteUser(user.username)}\n                                className=\"action-btn delete\"\n                              >\n                                🗑️ Delete\n                              </button>\n                            </>\n                          )}\n                        </div>\n                      </td>\n                    </tr>\n                  ))}\n                </tbody>\n              </table>\n            </div>\n          )}\n        </div>\n      )}\n\n      {activeTab === 'history' && (\n        <div className=\"admin-content\">\n          <div className=\"content-header\">\n            <h2>📋 Conversion History</h2>\n            <button onClick={handleBulkDeleteLogs} className=\"bulk-delete-btn\">\n              🗑️ Bulk Delete Logs\n            </button>\n          </div>\n          \n          {loading ? (\n            <div className=\"loading\">Loading history...</div>\n          ) : (\n            <div className=\"history-table\">\n              <table>\n                <thead>\n                  <tr>\n                    <th>Date</th>\n                    <th>User</th>\n                    <th>Files</th>\n                    <th>Input → Output</th>\n                    <th>Device</th>\n                    <th>IP Address</th>\n                    <th>Actions</th>\n                  </tr>\n                </thead>\n                <tbody>\n                  {conversions.map((conversion, index) => (\n                    <tr key={index}>\n                      <td>{new Date(conversion.timestamp).toLocaleString()}</td>\n                      <td>{conversion.userId}</td>\n                      <td>{conversion.fileCount || conversion.originalFiles.length}</td>\n                      <td>\n                        <span className=\"format-flow\">\n                          {conversion.inputFormats?.join(', ') || 'Unknown'} → {conversion.outputFormat.toUpperCase()}\n                        </span>\n                      </td>\n                      <td>\n                        <span className={`device-badge ${conversion.deviceType}`}>\n                          {conversion.deviceType === 'mobile' ? '📱' : '💻'} {conversion.deviceType}\n                        </span>\n                      </td>\n                      <td>{conversion.ipAddress}</td>\n                      <td>\n                        <button \n                          onClick={() => handleDeleteLog(conversion._id)}\n                          className=\"action-btn delete small\"\n                        >\n                          🗑️\n                        </button>\n                      </td>\n                    </tr>\n                  ))}\n                </tbody>\n              </table>\n            </div>\n          )}\n        </div>\n      )}\n\n      {activeTab === 'api' && (\n        <div className=\"admin-content\">\n          <div className=\"content-header\">\n            <h2>🔌 API Usage Monitoring</h2>\n          </div>\n          \n          {loading ? (\n            <div className=\"loading\">Loading API usage...</div>\n          ) : (\n            <div className=\"api-table\">\n              <table>\n                <thead>\n                  <tr>\n                    <th>Timestamp</th>\n                    <th>User</th>\n                    <th>Endpoint</th>\n                    <th>Method</th>\n                    <th>Response Time</th>\n                    <th>Status</th>\n                    <th>IP Address</th>\n                  </tr>\n                </thead>\n                <tbody>\n                  {apiUsage.map((usage, index) => (\n                    <tr key={index}>\n                      <td>{new Date(usage.timestamp).toLocaleString()}</td>\n                      <td>{usage.userId}</td>\n                      <td><code>{usage.endpoint}</code></td>\n                      <td>\n                        <span className={`method-badge ${usage.method.toLowerCase()}`}>\n                          {usage.method}\n                        </span>\n                      </td>\n                      <td>{usage.responseTime}ms</td>\n                      <td>\n                        <span className={`status-code ${usage.statusCode < 400 ? 'success' : 'error'}`}>\n                          {usage.statusCode}\n                        </span>\n                      </td>\n                      <td>{usage.ipAddress}</td>\n                    </tr>\n                  ))}\n                </tbody>\n              </table>\n            </div>\n          )}\n        </div>\n      )}\n\n      {pagination.pages > 1 && (\n        <div className=\"pagination\">\n          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (\n            <button\n              key={page}\n              onClick={() => {\n                if (activeTab === 'users') fetchUsers(page);\n                if (activeTab === 'history') fetchHistory(page);\n                if (activeTab === 'api') fetchApiUsage(page);\n              }}\n              className={pagination.page === page ? 'active' : ''}\n            >\n              {page}\n            </button>\n          ))}\n        </div>\n      )}\n    </div>\n  );\n}\n\nexport default AdminPanel;
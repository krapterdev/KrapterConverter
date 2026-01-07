import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [files, setFiles] = useState([]);
  const [outputFormat, setOutputFormat] = useState('png');
  const [inputFilter, setInputFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [convertedFiles, setConvertedFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [currentProcessing, setCurrentProcessing] = useState('');
  const [processedCount, setProcessedCount] = useState(0);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [loginData, setLoginData] = useState({ email: '', password: '', username: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [editSettings, setEditSettings] = useState({
    quality: 'high',
    resize: { width: '', height: '', fit: 'inside' },
    crop: { x: 0, y: 0, width: '', height: '' },
    rotate: 0,
    filters: { brightness: 1, contrast: 1, saturation: 1, blur: 0, greyscale: false },
    watermark: { 
      enabled: false, 
      type: 'text', 
      text: '', 
      fontSize: 24, 
      opacity: 0.5, 
      position: 'bottom-right' 
    },
    metadata: {
      action: 'keep', // 'keep', 'removeAll', 'removeGPS'
      view: false
    }
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('');

  const formatPresets = {
    'instagram-post': { width: 1080, height: 1080, name: '📸 Instagram Post', desc: '1080×1080 Square' },
    'facebook-cover': { width: 1200, height: 630, name: '📘 Facebook Cover', desc: '1200×630 Banner' },
    'youtube-thumb': { width: 1280, height: 720, name: '📺 YouTube Thumbnail', desc: '1280×720 HD' },
    'website-banner': { width: 1920, height: 400, name: '🌐 Website Banner', desc: '1920×400 Wide' },
    'hd-print': { width: 3000, height: 2000, name: '🖨️ HD Print', desc: '3000×2000 300DPI' },
    'twitter-header': { width: 1500, height: 500, name: '🐦 Twitter Header', desc: '1500×500 Banner' },
    'linkedin-cover': { width: 1584, height: 396, name: '💼 LinkedIn Cover', desc: '1584×396 Professional' }
  };

  const formats = {
    jpeg: { icon: '📷', name: 'JPEG', desc: 'Standard format', mime: 'image/jpeg' },
    png: { icon: '🖼️', name: 'PNG', desc: 'Lossless, transparent', mime: 'image/png' },
    webp: { icon: '🌐', name: 'WebP', desc: 'Modern, efficient', mime: 'image/webp' },
    avif: { icon: '🚀', name: 'AVIF', desc: 'Next-gen format', mime: 'image/avif' },
    gif: { icon: '🎬', name: 'GIF', desc: 'Animated support', mime: 'image/gif' },
    tiff: { icon: '📄', name: 'TIFF', desc: 'High quality', mime: 'image/tiff' },
    bmp: { icon: '🎨', name: 'BMP', desc: 'Uncompressed', mime: 'image/bmp' },
    heif: { icon: '📱', name: 'HEIF', desc: 'Apple format', mime: 'image/heif' }
  };

  const handleFileChange = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles);
    let filteredFiles = fileArray.filter(file => file.type.startsWith('image/'));
    
    if (inputFilter !== 'all') {
      filteredFiles = filteredFiles.filter(file => file.type === formats[inputFilter].mime);
    }
    
    if (filteredFiles.length > 0) {
      setFiles(prev => [...prev, ...filteredFiles]);
      setMessage('');
      if (filteredFiles.length < fileArray.length) {
        setMessage(`Added ${filteredFiles.length} files. ${fileArray.length - filteredFiles.length} files were filtered out.`);
      }
    } else {
      setMessage(`Please select ${inputFilter === 'all' ? 'image' : formats[inputFilter].name} files only`);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files);
    }
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      setMessage('Please select files first');
      return;
    }

    setLoading(true);
    setMessage('');
    setConvertedFiles([]);
    setCurrentProcessing('');
    setProcessedCount(0);

    const token = localStorage.getItem('userToken');
    const allConvertedFiles = [];

    try {
      // Convert files one by one
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentProcessing(file.name);
        setProcessedCount(i + 1);

        const formData = new FormData();
        formData.append('images', file);
        formData.append('format', outputFormat);
        formData.append('quality', editSettings.quality);
        formData.append('resize', JSON.stringify(editSettings.resize));
        formData.append('crop', JSON.stringify(editSettings.crop));
        formData.append('rotate', editSettings.rotate);
        formData.append('filters', JSON.stringify(editSettings.filters));
        formData.append('watermark', JSON.stringify(editSettings.watermark));
        formData.append('metadata', JSON.stringify({
          removeAll: editSettings.metadata.action === 'removeAll',
          removeGPS: editSettings.metadata.action === 'removeGPS',
          keep: editSettings.metadata.action === 'keep'
        }));

        const response = await axios.post('http://localhost:5000/convert', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.data.success && response.data.files.length > 0) {
          allConvertedFiles.push(...response.data.files);
          setConvertedFiles([...allConvertedFiles]);
        }
      }

      setMessage(`🎉 ${allConvertedFiles.length} files converted successfully!`);
      setCurrentProcessing('');
      setProcessedCount(0);
    } catch (error) {
      setMessage('❌ Conversion failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (downloadUrl) => {
    const fullUrl = `http://localhost:5000${downloadUrl}`;
    window.open(fullUrl, '_blank');
  };

  const handleDownloadAll = () => {
    convertedFiles.forEach((file, index) => {
      setTimeout(() => {
        const fullUrl = `http://localhost:5000${file.downloadUrl}`;
        window.open(fullUrl, '_blank');
      }, index * 500);
    });
  };

  const handleDownloadZip = async () => {
    if (convertedFiles.length === 0) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const filePaths = convertedFiles.map(file => file.downloadUrl);
      
      const response = await axios.post('http://localhost:5000/download-zip', 
        { files: filePaths },
        { 
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'converted_images.zip';
      link.click();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      setMessage('Failed to create ZIP file');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToPdf = async () => {
    if (files.length === 0) {
      setMessage('Please select files first');
      return;
    }

    setLoading(true);
    setMessage('');

    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });
    formData.append('pageSize', 'A4');
    formData.append('orientation', 'portrait');

    try {
      const token = localStorage.getItem('userToken');
      const response = await axios.post('http://localhost:5000/convert-to-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'images.pdf';
      link.click();
      window.URL.revokeObjectURL(url);
      
      setMessage('🎉 PDF created successfully!');
      
    } catch (error) {
      setMessage('❌ PDF creation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setConvertedFiles([]);
    setMessage('');
  };

  const handleViewMetadata = async (file) => {
    setLoading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const token = localStorage.getItem('userToken');
      const response = await axios.post('http://localhost:5000/view-metadata', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.data.success) {
        const metadata = response.data.metadata;
        let metadataText = `📊 METADATA FOR: ${file.name}\n\n`;
        
        // Basic Info
        metadataText += `📷 BASIC INFO:\n`;
        metadataText += `Format: ${metadata.basic.format?.toUpperCase()}\n`;
        metadataText += `Dimensions: ${metadata.basic.width} × ${metadata.basic.height}\n`;
        metadataText += `Channels: ${metadata.basic.channels}\n`;
        metadataText += `Density: ${metadata.basic.density} DPI\n\n`;
        
        // EXIF Data
        if (metadata.exif) {
          metadataText += `📸 CAMERA INFO:\n`;
          if (metadata.exif.make) metadataText += `Camera: ${metadata.exif.make} ${metadata.exif.model || ''}\n`;
          if (metadata.exif.dateTime) metadataText += `Date: ${metadata.exif.dateTime}\n`;
          if (metadata.exif.exposureTime) metadataText += `Exposure: ${metadata.exif.exposureTime}s\n`;
          if (metadata.exif.fNumber) metadataText += `Aperture: f/${metadata.exif.fNumber}\n`;
          if (metadata.exif.iso) metadataText += `ISO: ${metadata.exif.iso}\n`;
          if (metadata.exif.focalLength) metadataText += `Focal Length: ${metadata.exif.focalLength}mm\n\n`;
        }
        
        // GPS Data
        if (metadata.gps) {
          metadataText += `🌍 GPS LOCATION:\n`;
          metadataText += `Latitude: ${metadata.gps.latitude}\n`;
          metadataText += `Longitude: ${metadata.gps.longitude}\n`;
          if (metadata.gps.altitude) metadataText += `Altitude: ${metadata.gps.altitude}m\n`;
        } else {
          metadataText += `🌍 GPS: No location data found\n`;
        }
        
        alert(metadataText);
      }
    } catch (error) {
      setMessage('❌ Failed to read metadata.');
    } finally {
      setLoading(false);
    }
  };

  const handleWatermarkRemoval = async (file) => {
    setLoading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const token = localStorage.getItem('userToken');
      const response = await axios.post('http://localhost:5000/remove-watermark', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.data.success) {
        const fullUrl = `http://localhost:5000${response.data.downloadUrl}`;
        window.open(fullUrl, '_blank');
        setMessage('🎉 Watermark removal completed! ' + response.data.note);
      }
    } catch (error) {
      setMessage('❌ Watermark removal failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/user/login', loginData);
      if (response.data.success) {
        setIsLoggedIn(true);
        // Login successful, user is now logged in
        setMessage('Login successful! You can now convert files.');
        localStorage.setItem('userToken', response.data.token);
      }
    } catch (error) {
      setMessage('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('userToken');
    setFiles([]);
    setConvertedFiles([]);
    setMessage('Logged out successfully');
  };

  useEffect(() => {
    const token = localStorage.getItem('userToken');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="tailwind-login">
        <div className="login-bg">
          <div className="login-bg-blur-1"></div>
          <div className="login-bg-blur-2"></div>
        </div>
        
        <div className="login-container">
          <div className="login-title-section">
            <h1 className="login-main-title">Krapter Converter</h1>
            <p className="login-main-subtitle">Welcome back! Please sign in to your account.</p>
          </div>
          
          <div className="glass-card">
            <div className="login-form-content">
              <div className="form-fields-container">
                <div className="form-field">
                  <label className="field-label" htmlFor="email">Email</label>
                  <div className="input-container">
                    <span className="input-icon">📧</span>
                    <input
                      className="form-input"
                      id="email"
                      placeholder="Enter your email"
                      type="email"
                      value={loginData.email}
                      onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-field">
                  <label className="field-label" htmlFor="password">Password</label>
                  <div className="input-container">
                    <span className="input-icon">🔒</span>
                    <input
                      className="form-input"
                      id="password"
                      placeholder="••••••••"
                      type={showPassword ? 'text' : 'password'}
                      value={loginData.password}
                      onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="form-options">
                <div className="remember-section">
                  <input className="remember-checkbox" id="remember-me" type="checkbox" />
                  <label className="remember-label" htmlFor="remember-me">Remember me</label>
                </div>
                <button className="forgot-link" type="button">Forgot password?</button>
              </div>
              
              <form onSubmit={handleLogin}>
                <button className="signin-button" type="submit" disabled={loading}>
                  <span>{loading ? (isSignup ? 'Signing up...' : 'Signing in...') : (isSignup ? 'Sign Up' : 'Sign In')}</span>
                </button>
              </form>
            </div>
            
            <div className="login-footer">
              <p className="footer-text">
                {isSignup ? 'Already have an account?' : 'New user?'} 
                <button 
                  className="signup-link" 
                  onClick={() => setIsSignup(!isSignup)}
                  type="button"
                >
                  {isSignup ? 'Sign In' : 'Sign Up for New Tour'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="background-animation"></div>
      <div className="container">
        <div className="header">
          <div className="logo">🖼️</div>
          <h1>🎯 Krapter Converter</h1>
          <p>Advanced Universal Image Converter with Smart Format Selection</p>
          <div className="header-buttons">
            <button onClick={handleLogout} className="logout-btn">
              👤 Logout
            </button>
          </div>
        </div>
        
        <div className="converter-section">
          <div className="format-selectors">
            <div className="input-selector">
              <h3>📥 Input Format Filter</h3>
              <select 
                value={inputFilter} 
                onChange={(e) => setInputFilter(e.target.value)}
                className="format-dropdown"
              >
                <option value="all">🌟 All Image Formats</option>
                {Object.entries(formats).map(([key, fmt]) => (
                  <option key={key} value={key}>{fmt.icon} {fmt.name} only</option>
                ))}
              </select>
            </div>
            
            <div className="output-selector">
              <h3>📤 Output Format</h3>
              <div className="format-grid">
                {Object.entries(formats).map(([key, fmt]) => (
                  <label key={key} className={`format-card ${outputFormat === key ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      value={key}
                      checked={outputFormat === key}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="format-radio"
                    />
                    <div className="format-content">
                      <span className="format-icon">{fmt.icon}</span>
                      <span className="format-name">{fmt.name}</span>
                      <span className="format-desc">{fmt.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="quality-section">
            <h3>⚙️ Quality & Settings</h3>
            <div className="quality-options">
              {[
                { value: 'low', label: '📱 Low (Web)', desc: 'Small file size' },
                { value: 'medium', label: '⚖️ Medium', desc: 'Balanced' },
                { value: 'high', label: '🎯 High', desc: 'Good quality' },
                { value: 'lossless', label: '💎 Lossless', desc: 'Maximum quality' }
              ].map(q => (
                <label key={q.value} className={`quality-card ${editSettings.quality === q.value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    value={q.value}
                    checked={editSettings.quality === q.value}
                    onChange={(e) => setEditSettings({...editSettings, quality: e.target.value})}
                  />
                  <div className="quality-content">
                    <span className="quality-label">{q.label}</span>
                    <span className="quality-desc">{q.desc}</span>
                  </div>
                </label>
              ))}
            </div>
            
            <div className="presets-section">
              <h4>📐 Quick Presets</h4>
              <div className="presets-grid">
                {Object.entries(formatPresets).map(([key, preset]) => (
                  <button
                    key={key}
                    className={`preset-btn ${selectedPreset === key ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedPreset(key);
                      setEditSettings({
                        ...editSettings,
                        resize: {
                          ...editSettings.resize,
                          width: preset.width,
                          height: preset.height,
                          fit: 'fill'
                        }
                      });
                    }}
                  >
                    <span className="preset-name">{preset.name}</span>
                    <span className="preset-desc">{preset.desc}</span>
                  </button>
                ))}
                <button
                  className={`preset-btn ${selectedPreset === 'custom' ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedPreset('custom');
                    setEditSettings({
                      ...editSettings,
                      resize: { width: '', height: '', fit: 'inside' }
                    });
                  }}
                >
                  <span className="preset-name">⚙️ Custom</span>
                  <span className="preset-desc">Manual resize</span>
                </button>
              </div>
            </div>
            
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)} 
              className="advanced-toggle"
            >
              {showAdvanced ? '🔼 Hide Advanced' : '🔽 Show Advanced'}
            </button>
          </div>

          {showAdvanced && (
            <div className="advanced-section">
              <div className="edit-grid">
                <div className="resize-controls">
                  <h4>📏 Resize</h4>
                  <div className="control-row">
                    <input
                      type="number"
                      placeholder="Width"
                      value={editSettings.resize.width}
                      onChange={(e) => setEditSettings({
                        ...editSettings,
                        resize: {...editSettings.resize, width: e.target.value}
                      })}
                    />
                    <input
                      type="number"
                      placeholder="Height"
                      value={editSettings.resize.height}
                      onChange={(e) => setEditSettings({
                        ...editSettings,
                        resize: {...editSettings.resize, height: e.target.value}
                      })}
                    />
                  </div>
                  <select
                    value={editSettings.resize.fit}
                    onChange={(e) => setEditSettings({
                      ...editSettings,
                      resize: {...editSettings.resize, fit: e.target.value}
                    })}
                  >
                    <option value="inside">Fit Inside</option>
                    <option value="outside">Fit Outside</option>
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                    <option value="fill">Fill</option>
                  </select>
                </div>

                <div className="rotate-controls">
                  <h4>🔄 Rotate</h4>
                  <div className="rotate-buttons">
                    {[0, 90, 180, 270].map(angle => (
                      <button
                        key={angle}
                        className={`rotate-btn ${editSettings.rotate === angle ? 'active' : ''}`}
                        onClick={() => setEditSettings({...editSettings, rotate: angle})}
                      >
                        {angle}°
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-controls">
                  <h4>🎨 Filters</h4>
                  <div className="filter-sliders">
                    <label>
                      Brightness: {editSettings.filters.brightness}
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={editSettings.filters.brightness}
                        onChange={(e) => setEditSettings({
                          ...editSettings,
                          filters: {...editSettings.filters, brightness: parseFloat(e.target.value)}
                        })}
                      />
                    </label>
                    <label>
                      Saturation: {editSettings.filters.saturation}
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={editSettings.filters.saturation}
                        onChange={(e) => setEditSettings({
                          ...editSettings,
                          filters: {...editSettings.filters, saturation: parseFloat(e.target.value)}
                        })}
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={editSettings.filters.greyscale}
                        onChange={(e) => setEditSettings({
                          ...editSettings,
                          filters: {...editSettings.filters, greyscale: e.target.checked}
                        })}
                      />
                      Greyscale
                    </label>
                  </div>
                </div>

                <div className="watermark-controls">
                  <h4>💧 Watermark</h4>
                  <label className="watermark-toggle">
                    <input
                      type="checkbox"
                      checked={editSettings.watermark.enabled}
                      onChange={(e) => setEditSettings({
                        ...editSettings,
                        watermark: {...editSettings.watermark, enabled: e.target.checked}
                      })}
                    />
                    Enable Watermark
                  </label>
                  
                  {editSettings.watermark.enabled && (
                    <div className="watermark-settings">
                      <input
                        type="text"
                        placeholder="Watermark text"
                        value={editSettings.watermark.text}
                        onChange={(e) => setEditSettings({
                          ...editSettings,
                          watermark: {...editSettings.watermark, text: e.target.value}
                        })}
                      />
                      
                      <div className="watermark-row">
                        <label>
                          Size: {editSettings.watermark.fontSize}px
                          <input
                            type="range"
                            min="12"
                            max="72"
                            value={editSettings.watermark.fontSize}
                            onChange={(e) => setEditSettings({
                              ...editSettings,
                              watermark: {...editSettings.watermark, fontSize: parseInt(e.target.value)}
                            })}
                          />
                        </label>
                        
                        <label>
                          Opacity: {editSettings.watermark.opacity}
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={editSettings.watermark.opacity}
                            onChange={(e) => setEditSettings({
                              ...editSettings,
                              watermark: {...editSettings.watermark, opacity: parseFloat(e.target.value)}
                            })}
                          />
                        </label>
                      </div>
                      
                      <select
                        value={editSettings.watermark.position}
                        onChange={(e) => setEditSettings({
                          ...editSettings,
                          watermark: {...editSettings.watermark, position: e.target.value}
                        })}
                      >
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="center">Center</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="metadata-controls">
                  <h4>🏷️ Metadata & Privacy</h4>
                  <div className="metadata-options">
                    <label className={`metadata-option ${editSettings.metadata.action === 'keep' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        value="keep"
                        checked={editSettings.metadata.action === 'keep'}
                        onChange={(e) => setEditSettings({
                          ...editSettings,
                          metadata: {...editSettings.metadata, action: e.target.value}
                        })}
                      />
                      <div className="metadata-card">
                        <span className="metadata-icon">📋</span>
                        <span className="metadata-label">Keep All</span>
                        <span className="metadata-desc">Preserve metadata</span>
                      </div>
                    </label>
                    
                    <label className={`metadata-option ${editSettings.metadata.action === 'removeGPS' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        value="removeGPS"
                        checked={editSettings.metadata.action === 'removeGPS'}
                        onChange={(e) => setEditSettings({
                          ...editSettings,
                          metadata: {...editSettings.metadata, action: e.target.value}
                        })}
                      />
                      <div className="metadata-card">
                        <span className="metadata-icon">🌍</span>
                        <span className="metadata-label">Remove GPS</span>
                        <span className="metadata-desc">Keep EXIF, remove location</span>
                      </div>
                    </label>
                    
                    <label className={`metadata-option ${editSettings.metadata.action === 'removeAll' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        value="removeAll"
                        checked={editSettings.metadata.action === 'removeAll'}
                        onChange={(e) => setEditSettings({
                          ...editSettings,
                          metadata: {...editSettings.metadata, action: e.target.value}
                        })}
                      />
                      <div className="metadata-card">
                        <span className="metadata-icon">🔒</span>
                        <span className="metadata-label">Remove All</span>
                        <span className="metadata-desc">Maximum privacy</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="upload-section">
            <div 
              className={`drop-zone ${dragActive ? 'drag-active' : ''} ${files.length > 0 ? 'has-file' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept={inputFilter === 'all' ? 'image/*' : formats[inputFilter]?.mime || 'image/*'}
                multiple
                onChange={(e) => handleFileChange(e.target.files)}
                className="file-input"
                id="file-input"
              />
              <label htmlFor="file-input" className="file-label">
                {files.length > 0 ? (
                  <div className="files-info">
                    <span className="file-icon">📁</span>
                    <span className="files-count">{files.length} files selected</span>
                    <span className="total-size">({(files.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024).toFixed(2)} MB total)</span>
                  </div>
                ) : (
                  <div className="upload-prompt">
                    <span className="upload-icon">☁️</span>
                    <span>Drop {inputFilter === 'all' ? 'any image' : formats[inputFilter]?.name || 'image'} files here</span>
                    <span className="or-text">or click to browse • Multiple files supported</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          {files.length > 0 && (
            <div className="file-list">
              <div className="file-list-header">
                <h4>Selected Files ({files.length})</h4>
                <button onClick={clearAll} className="clear-btn">Clear All</button>
              </div>
              <div className="files-grid">
                {files.map((file, index) => (
                  <div key={index} className="file-item">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    <div className="file-actions">
                      <button 
                        onClick={() => handleViewMetadata(file)} 
                        className="metadata-view-btn"
                        disabled={loading}
                        title="View Metadata"
                      >
                        🏷️
                      </button>
                      <button 
                        onClick={() => handleWatermarkRemoval(file)} 
                        className="watermark-remove-btn"
                        disabled={loading}
                        title="Remove Watermark"
                      >
                        💧
                      </button>
                      <button onClick={() => removeFile(index)} className="remove-btn">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleConvert}
            disabled={files.length === 0 || loading}
            className={`convert-btn ${loading ? 'loading' : ''}`}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                {currentProcessing ? `Converting: ${currentProcessing} (${processedCount}/${files.length})` : `Converting ${files.length} files...`}
              </>
            ) : (
              <>
                <span>✨</span>
                Convert to {formats[outputFormat].name} {files.length > 0 ? `(${files.length} files)` : ''}
              </>
            )}
          </button>
          
          {files.length > 0 && (
            <button
              onClick={handleConvertToPdf}
              disabled={loading}
              className="pdf-btn"
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Creating PDF...
                </>
              ) : (
                <>
                  <span>📄</span>
                  Convert to PDF ({files.length} images)
                </>
              )}
            </button>
          )}
        </div>

        {message && (
          <div className={`message ${convertedFiles.length > 0 ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {convertedFiles.length > 0 && (
          <div className="download-section">
            <div className="converted-files">
              <h4>Converted Files ({convertedFiles.length})</h4>
              <div className="download-grid">
                {convertedFiles.map((file, index) => (
                  <div key={index} className="download-item">
                    <span className="original-name">{file.originalName}</span>
                    <button onClick={() => handleDownload(file.downloadUrl)} className="download-btn-small">
                      ⬇️ Download
                    </button>
                  </div>
                ))}
              </div>
              {convertedFiles.length > 1 && (
                <div className="bulk-download">
                  <button onClick={handleDownloadAll} className="download-all-btn">
                    <span>📦</span>
                    Download All Separately
                  </button>
                  <button onClick={handleDownloadZip} className="download-zip-btn" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner"></span>
                        Creating ZIP...
                      </>
                    ) : (
                      <>
                        <span>🗜️</span>
                        Download as ZIP
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>


    </div>
  );
}

export default App;
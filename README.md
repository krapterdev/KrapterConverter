# Krapter Convertor - AVIF to PNG/JPG Converter

## Setup Instructions

### Backend Setup
1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   npm run dev
   ```
   Server will run on http://localhost:5000

### Frontend Setup
1. Navigate to client directory:
   ```
   cd client
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start React app:
   ```
   npm start
   ```
   App will run on http://localhost:3000

## Features
- Upload AVIF files
- Convert to PNG or JPG format
- Download converted files
- Clean and responsive UI
- Automatic file cleanup after download

## Usage
1. Select an AVIF file
2. Choose output format (PNG or JPG)
3. Click Convert
4. Download the converted file

## Tech Stack
- **Backend**: Node.js, Express, Sharp, Multer
- **Frontend**: React, Axios
- **Image Processing**: Sharp library
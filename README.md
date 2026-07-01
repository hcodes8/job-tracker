# Job Application Tracker

A full stack web app for tracking job applications with PDF resume storage.

## Setup

**1. Database**
```bash
mysql -u root -p < schema.sql
```

**2. Install & run**
```bash
cd backend
npm install
DB_PASSWORD=yourpassword npm start
```

**3. Open** `http://localhost:3001`

## Features
- Add, sort, and delete job applications
- Upload and preview PDF resumes in browser
- Persistent storage via MySQL

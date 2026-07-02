require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Multer (in mem PDF storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  },
});

// DB connection
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'job_tracker',
  waitForConnections: true,
  connectionLimit: 10,
});

// Routes

// GET all applications sorted
app.get('/api/applications', async (req, res) => {
  const sort = req.query.sort || 'newest';
  let orderBy;
  switch (sort) {
    case 'company':    orderBy = 'company ASC, date_applied DESC'; break;
    case 'oldest':     orderBy = 'date_applied ASC'; break;
    case 'newest':
    default:           orderBy = 'date_applied DESC'; break;
  }

  try {
    const [rows] = await db.query(
      `SELECT id, date_applied, job_title, job_description, url, company, status,
              resume_original_name, resume_mime_type,
              IF(resume_data IS NOT NULL, true, false) AS has_resume
       FROM applications ORDER BY ${orderBy}`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// GET single application
app.get('/api/applications/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, date_applied, job_title, job_description, url, company, status,
              resume_original_name, resume_mime_type,
              IF(resume_data IS NOT NULL, true, false) AS has_resume
       FROM applications WHERE id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// GET resume PDF for a specific application
app.get('/api/applications/:id/resume', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT resume_data, resume_mime_type, resume_original_name FROM applications WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length || !rows[0].resume_data) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    const { resume_data, resume_mime_type, resume_original_name } = rows[0];
    res.setHeader('Content-Type', resume_mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${resume_original_name || 'resume.pdf'}"`);
    res.send(resume_data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch resume' });
  }
});

// POST create application
app.post('/api/applications', upload.single('resume'), async (req, res) => {
  const { date_applied, job_title, job_description, url, company, status } = req.body;
  if (!job_title || !company) {
    return res.status(400).json({ error: 'job_title and company are required' });
  }

  const ALLOWED_STATUSES = ['Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted'];
  const normalizedStatus = ALLOWED_STATUSES.includes(status) ? status : 'Applied';

  // Parse date, fall back to NOW() if missing or invalid
  let parsedDate = new Date();
  if (date_applied && date_applied.trim() !== '') {
    const d = new Date(date_applied);
    if (!isNaN(d.getTime())) parsedDate = d;
  }

  let resumeData = null, resumeOriginalName = null, resumeMimeType = null;
  if (req.file) {
    resumeData = req.file.buffer;
    resumeOriginalName = req.file.originalname;
    resumeMimeType = req.file.mimetype;
  }

  try {
    const [result] = await db.query(
      `INSERT INTO applications
         (date_applied, job_title, job_description, url, company, status, resume_data, resume_original_name, resume_mime_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parsedDate,
        job_title.trim(),
        job_description ? job_description.trim() : null,
        url ? url.trim() : null,
        company.trim(),
        normalizedStatus,
        resumeData,
        resumeOriginalName,
        resumeMimeType,
      ]
    );
    console.log(`[INSERT] id=${result.insertId} title="${job_title}" company="${company}"`);
    res.status(201).json({ id: result.insertId, message: 'Application created' });
  } catch (err) {
    console.error('[INSERT ERROR]', err.message);
    res.status(500).json({ error: 'Failed to create application', detail: err.message });
  }
});

// PATCH update application status
app.patch('/api/applications/:id/status', async (req, res) => {
  const ALLOWED_STATUSES = ['Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted'];
  const { status } = req.body;
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const [result] = await db.query(
      'UPDATE applications SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE application
app.delete('/api/applications/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM applications WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

// DELETE multiple applications
app.post('/api/applications/delete-batch', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  try {
    await db.query('DELETE FROM applications WHERE id IN (?)', [ids]);
    res.json({ message: `Deleted ${ids.length} application(s)` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete applications' });
  }
});

// Serve frontend to all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start
app.listen(PORT, () => {
  console.log(`Job Tracker API running on http://localhost:${PORT}`);
});

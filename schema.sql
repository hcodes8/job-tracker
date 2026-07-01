-- Job Application Tracker - MySQL Schema
CREATE DATABASE IF NOT EXISTS job_tracker;
USE job_tracker;

CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date_applied DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    job_title VARCHAR(255) NOT NULL,
    job_description TEXT,
    url VARCHAR(2048),
    company VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Applied',
    resume_filename VARCHAR(512),
    resume_original_name VARCHAR(512),
    resume_mime_type VARCHAR(128),
    resume_data LONGBLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Index for sorting
CREATE INDEX idx_date_applied ON applications(date_applied);
CREATE INDEX idx_company ON applications(company);
CREATE INDEX idx_status ON applications(status);

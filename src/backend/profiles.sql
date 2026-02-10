-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS profiles_vue_app;
USE profiles_vue_app;

-- Disable foreign key checks to allow dropping tables in any order
SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing tables if they exist (to start fresh)
DROP TABLE IF EXISTS profile_profession_members;
DROP TABLE IF EXISTS professions;
DROP TABLE IF EXISTS profile_room_members;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS profile_group_members;
DROP TABLE IF EXISTS group_subjects;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS profile_groups;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS group_room_members;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS users;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Create profiles table (REMOVED professions field)
CREATE TABLE profiles (
    id VARCHAR(255) PRIMARY KEY,
    firstName VARCHAR(100) NOT NULL,
    lastName VARCHAR(100) NOT NULL,
    age INT DEFAULT 18,
    message TEXT,
    fullName VARCHAR(201) GENERATED ALWAYS AS (CONCAT(firstName, ' ', lastName)) STORED,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    avatarUrl VARCHAR(255) NULL
);

-- Create professions table (NEW)
CREATE TABLE professions (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create profile_profession_members table for many-to-many relationship (NEW)
CREATE TABLE profile_profession_members (
    id VARCHAR(255) PRIMARY KEY,
    profile_id VARCHAR(255) NOT NULL,
    profession_id VARCHAR(255) NOT NULL,
    addedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_profile_profession (profile_id, profession_id)
);

-- Create subjects table
CREATE TABLE subjects (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create profile_groups table (keeping existing functionality)
CREATE TABLE profile_groups (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create group_subjects junction table
CREATE TABLE group_subjects (
    id VARCHAR(255) PRIMARY KEY,
    group_id VARCHAR(255) NOT NULL,
    subject_id VARCHAR(255) NOT NULL,
    addedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES profile_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    UNIQUE KEY unique_group_subject (group_id, subject_id)
);

-- Create users table
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- This should store hashed passwords
    profile_id VARCHAR(255) NULL, -- Optional link to profiles table
    role ENUM('admin', 'user') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    
    -- Foreign key to link user to their profile (optional)
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL
);

-- Create rooms table
CREATE TABLE rooms (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    max_capacity INT DEFAULT 10,
    current_count INT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create notifications table (MOVED after rooms table)
CREATE TABLE notifications (
    id VARCHAR(255) PRIMARY KEY,
    type ENUM('group_request', 'system', 'profile', 'room', 'general') NOT NULL DEFAULT 'general',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority ENUM('low', 'normal', 'high') DEFAULT 'normal',
    read_status BOOLEAN DEFAULT FALSE,
    resolved BOOLEAN DEFAULT FALSE,
    resolution ENUM('approved', 'denied') NULL,
    resolved_at TIMESTAMP NULL,
    
    -- Related entity references
    profile_id VARCHAR(255) NULL,
    group_id VARCHAR(255) NULL,
    room_id VARCHAR(255) NULL,
    user_id VARCHAR(255) NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES profile_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create junction table for many-to-many relationship (keeping existing functionality)
CREATE TABLE profile_group_members (
    id VARCHAR(255) PRIMARY KEY,
    group_id VARCHAR(255) NOT NULL,
    profile_id VARCHAR(255) NOT NULL,
    addedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES profile_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_membership (group_id, profile_id)
);

-- Create profile_room_members table for room assignments
CREATE TABLE profile_room_members (
    id VARCHAR(255) PRIMARY KEY,
    room_id VARCHAR(255) NOT NULL,
    profile_id VARCHAR(255) NOT NULL,
    group_id VARCHAR(255) NULL,
    addedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES profile_groups(id) ON DELETE SET NULL,
    UNIQUE KEY unique_room_membership (room_id, profile_id)
);

-- Create group_room_members table for group-room assignments
CREATE TABLE group_room_members (
    id VARCHAR(255) PRIMARY KEY,
    group_id VARCHAR(255) NOT NULL,
    room_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES profile_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    UNIQUE KEY unique_group_room (group_id, room_id)
);

-- Create indexes for better performance
CREATE INDEX idx_name ON profiles(firstName, lastName);
CREATE INDEX idx_created ON profiles(createdAt);
CREATE INDEX idx_fullname ON profiles(fullName);
CREATE INDEX idx_group_members_group ON profile_group_members(group_id);
CREATE INDEX idx_group_members_profile ON profile_group_members(profile_id);
CREATE INDEX idx_groups_created ON profile_groups(createdAt);
CREATE INDEX idx_room_members_room ON profile_room_members(room_id);
CREATE INDEX idx_room_members_profile ON profile_room_members(profile_id);
CREATE INDEX idx_rooms_created ON rooms(createdAt);
CREATE INDEX idx_profession_members_profile ON profile_profession_members(profile_id);
CREATE INDEX idx_profession_members_profession ON profile_profession_members(profession_id);
CREATE INDEX idx_professions_name ON professions(name);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_profile ON users(profile_id);
CREATE INDEX idx_users_created ON users(createdAt);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read_status ON notifications(read_status);
CREATE INDEX idx_notifications_resolved ON notifications(resolved);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_profile_id ON notifications(profile_id);
CREATE INDEX idx_notifications_group_id ON notifications(group_id);
CREATE INDEX idx_notifications_room_id ON notifications(room_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Insert default professions
INSERT INTO professions (id, name) VALUES 
('prof_1', 'doctor'),
('prof_2', 'Software Engineer'),
('prof_3', 'Teacher'),
('prof_4', 'Electrician'),
('prof_5', 'chef'),
('prof_6', 'nurse');

-- Insert default subjects
INSERT INTO subjects (id, name, description) VALUES
('subj_1', 'Math', 'Mathematics including algebra, geometry, and calculus'),
('subj_2', 'Physics', 'Study of matter, energy, and their interactions'),
('subj_3', 'Chemistry', 'Study of substances, their properties, and reactions'),
('subj_4', 'Biology', 'Study of living organisms and their processes'),
('subj_5', 'History', 'Study of past events and human civilization'),
('subj_6', 'Geography', 'Study of Earth and its features'),
('subj_7', 'Computer Science', 'Study of computers and computational systems'),
('subj_8', 'English', 'Study of English language and literature');

-- Insert the two default rooms
INSERT INTO rooms (id, name, description, max_capacity, current_count) VALUES 
('room_1', 'Room A', 'First room with capacity for 10 people', 10, 0),
('room_2', 'Room B', 'Second room with capacity for 10 people', 10, 0);

-- Insert admin user
INSERT INTO users (id, email, password, role, is_active) VALUES (
    'admin_001', 
    'ismail@gmail.com', 
    '$2b$10$MN6kA8E7V7tIvAIoHmjTeOZgSY7xuD66QXMLCM51pfX2/5cjEO.DC', -- This is '123456' hashed
    'admin', 
    true
) ON DUPLICATE KEY UPDATE 
    password = '$2b$10$MN6kA8E7V7tIvAIoHmjTeOZgSY7xuD66QXMLCM51pfX2/5cjEO.DC', 
    role = 'admin', 
    is_active = true;

-- Create triggers to automatically update room current_count
DELIMITER //

CREATE TRIGGER update_room_count_after_insert
    AFTER INSERT ON profile_room_members
    FOR EACH ROW
BEGIN
    UPDATE rooms 
    SET current_count = (
        SELECT COUNT(*) 
        FROM profile_room_members 
        WHERE room_id = NEW.room_id
    )
    WHERE id = NEW.room_id;
END//

CREATE TRIGGER update_room_count_after_delete
    AFTER DELETE ON profile_room_members
    FOR EACH ROW
BEGIN
    UPDATE rooms 
    SET current_count = (
        SELECT COUNT(*) 
        FROM profile_room_members 
        WHERE room_id = OLD.room_id
    )
    WHERE id = OLD.room_id;
END//

CREATE TRIGGER update_last_login
    BEFORE UPDATE ON users
    FOR EACH ROW
BEGIN
    IF OLD.last_login != NEW.last_login THEN
        SET NEW.updatedAt = CURRENT_TIMESTAMP;
    END IF;
END//

DELIMITER ;

-- Query to get user with their profile information
SELECT 
    u.*,
    p.firstName,
    p.lastName,
    p.fullName,
    p.avatarUrl
FROM users u
LEFT JOIN profiles p ON u.profile_id = p.id
WHERE u.email = 'user@example.com';

-- Query to get profiles with their professions and room info
SELECT 
    p.*,
    r.name AS room_name,
    GROUP_CONCAT(prof.name) AS professions
FROM profiles p
LEFT JOIN profile_room_members prm ON p.id = prm.profile_id
LEFT JOIN rooms r ON prm.room_id = r.id
LEFT JOIN profile_profession_members ppm ON p.id = ppm.profile_id
LEFT JOIN professions prof ON ppm.profession_id = prof.id
GROUP BY p.id, r.name
ORDER BY p.createdAt DESC;
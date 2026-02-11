import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { hash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '******' : '(empty)');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('PORT:', process.env.PORT);
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}
const generateNotificationId = () => {
  return 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/avatars'
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const profileId = req.params.id || 'temp'
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const extension = path.extname(file.originalname)
    cb(null, `avatar-${profileId}-${uniqueSuffix}${extension}`)
  }
})
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'))
    }
  }
})
const app = express();
app.use(cors());
app.use(bodyParser.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.post('/api/profiles/:id/avatar', upload.single('avatar'), async (req, res) => {
  const connection = await pool.getConnection()
  
  try {
    const profileId = req.params.id
    
    console.log(`Avatar upload request for profile ID: ${profileId}`)
    console.log('Uploaded file:', req.file)
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      })
    }
    
    await connection.beginTransaction()
    
    const [profileRows] = await connection.query(
      'SELECT * FROM profiles WHERE id = ?',
      [profileId]
    )
    
    if (profileRows.length === 0) {
      await connection.rollback()
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      })
    }
    
    const avatarUrl = `/uploads/avatars/${req.file.filename}`
    
    console.log('Generated avatar URL:', avatarUrl)
    
    const oldAvatarUrl = profileRows[0].avatarUrl
    if (oldAvatarUrl) {
      const oldFilePath = path.join(process.cwd(), oldAvatarUrl)
      if (fs.existsSync(oldFilePath)) {
        console.log('Deleting old avatar file:', oldFilePath)
        fs.unlinkSync(oldFilePath)
      }
    }
    
    await connection.query(
      'UPDATE profiles SET avatarUrl = ? WHERE id = ?',
      [avatarUrl, profileId]
    )
    
    await connection.commit()
    
    console.log('Avatar upload successful')
    
    res.json({
      success: true,
      avatarUrl: avatarUrl,
      message: 'Avatar uploaded successfully'
    })
    
  } catch (error) {
    await connection.rollback()
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    
    console.error('Avatar upload error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to upload avatar: ' + error.message
    })
  } finally {
    connection.release()
  }
})

// Test route
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API working', db: process.env.DB_NAME });
});
app.get('/api/professions', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM professions ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching professions:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// Add profile
app.delete('/api/profiles/:id/avatar', async (req, res) => {
  const connection = await pool.getConnection()
  
  try {
    const profileId = req.params.id
    
    await connection.beginTransaction()
    
    // Get current avatar URL
    const [profileRows] = await connection.query(
      'SELECT avatarUrl FROM profiles WHERE id = ?',
      [profileId]
    )
    
    if (profileRows.length === 0) {
      await connection.rollback()
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      })
    }
    
    const avatarUrl = profileRows[0].avatarUrl
    
    // Update profile to remove avatar URL
    await connection.query(
      'UPDATE profiles SET avatarUrl = NULL WHERE id = ?',
      [profileId]
    )
    
    // Delete file from filesystem
    if (avatarUrl) {
      const filePath = path.join(process.cwd(), avatarUrl)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }
    
    await connection.commit()
    
    res.json({
      success: true,
      message: 'Avatar deleted successfully'
    })
    
  } catch (error) {
    await connection.rollback()
    console.error('Avatar deletion error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete avatar'
    })
  } finally {
    connection.release()
  }
})
// Add this route after your existing user routes
app.put('/api/users/:userId/profile', async (req, res) => {
  let connection;
  
  try {
    const { userId } = req.params;
    const { profileId } = req.body;
    
    connection = await pool.getConnection();
    
    await connection.query(
      'UPDATE users SET profile_id = ? WHERE id = ?',
      [profileId, userId]
    );
    
    res.json({ success: true, message: 'User linked to profile successfully' });
    
  } catch (error) {
    console.error('Error linking user to profile:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
});
// Add this debugging endpoint to your backend to check data consistency
app.get('/api/debug/group/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Get group info
    const [groupInfo] = await pool.query(
      'SELECT * FROM profile_groups WHERE id = ?',
      [groupId]
    );
    
    // Get actual group members
    const [groupMembers] = await pool.query(`
      SELECT pgm.*, p.firstName, p.lastName
      FROM profile_group_members pgm
      JOIN profiles p ON pgm.profile_id = p.id
      WHERE pgm.group_id = ?
    `, [groupId]);
    
    // Check for duplicates in group membership
    const [duplicateCheck] = await pool.query(`
      SELECT profile_id, COUNT(*) as count
      FROM profile_group_members
      WHERE group_id = ?
      GROUP BY profile_id
      HAVING COUNT(*) > 1
    `, [groupId]);
    
    // Check room assignments for this group
    const [roomAssignments] = await pool.query(`
      SELECT prm.*, r.name as room_name
      FROM profile_room_members prm
      JOIN rooms r ON prm.room_id = r.id
      WHERE prm.group_id = ?
    `, [groupId]);
    
    // Check for duplicate room assignments
    const [roomDuplicates] = await pool.query(`
      SELECT profile_id, room_id, COUNT(*) as count
      FROM profile_room_members
      WHERE group_id = ?
      GROUP BY profile_id, room_id
      HAVING COUNT(*) > 1
    `, [groupId]);
    
    res.json({
      groupInfo: groupInfo[0],
      actualMembers: groupMembers,
      actualMemberCount: groupMembers.length,
      duplicateGroupMembers: duplicateCheck,
      roomAssignments: roomAssignments,
      roomDuplicates: roomDuplicates
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/addProfile', async (req, res) => {
    let connection;
    
    try {
        // Get connection from pool
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        const { id, firstName, lastName, age, professions, message, avatarUrl } = req.body;
        
        console.log('=== CREATING PROFILE ===');
        console.log('Received data:', { 
            id, firstName, lastName, age, professions, message, avatarUrl 
        });
        
        // Validate required fields
        if (!id || !firstName || !lastName) {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields: id, firstName, lastName' 
            });
        }
        
        // Insert profile - MATCH YOUR EXACT SCHEMA
        const profileInsertResult = await connection.execute(
            'INSERT INTO profiles (id, firstName, lastName, age, message, avatarUrl) VALUES (?, ?, ?, ?, ?, ?)',
            [
                id, 
                firstName.toString().trim(), 
                lastName.toString().trim(), 
                parseInt(age) || 18, 
                message ? message.toString().trim() : null, 
                avatarUrl || null
            ]
        );
        
        console.log('Profile inserted successfully with ID:', id);
        
        // Handle professions if provided
        if (professions && Array.isArray(professions) && professions.length > 0) {
            console.log('Processing professions:', professions);
            
            for (const professionName of professions) {
                if (!professionName || typeof professionName !== 'string' || professionName.trim() === '') {
                    continue;
                }
                
                // Find profession by name (case-insensitive)
                const [professionRows] = await connection.execute(
                    'SELECT id FROM professions WHERE LOWER(name) = LOWER(?)',
                    [professionName.trim()]
                );
                
                if (professionRows.length > 0) {
                    const professionId = professionRows[0].id;
                    const membershipId = 'prof_member_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    
                    // Insert profession membership
                    await connection.execute(
                        'INSERT INTO profile_profession_members (id, profile_id, profession_id) VALUES (?, ?, ?)',
                        [membershipId, id, professionId]
                    );
                    
                    console.log(`Added profession "${professionName}" to profile`);
                } else {
                    console.warn(`Profession "${professionName}" not found in database`);
                }
            }
        }
        
        // Commit transaction
        await connection.commit();
        console.log('Profile creation completed successfully');
        
        // Return success response
        res.json({ 
            success: true, 
            profile: { 
                id, 
                firstName, 
                lastName, 
                age: parseInt(age) || 18, 
                professions: professions || [], 
                message: message || '', 
                avatarUrl: avatarUrl || null 
            },
            message: 'Profile created successfully' 
        });
        
    } catch (error) {
        console.error('=== PROFILE CREATION ERROR ===');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error stack:', error.stack);
        
        // Rollback transaction
        if (connection) {
            try {
                await connection.rollback();
                console.log('Transaction rolled back successfully');
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
        }
        
        // Return error response
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Database error occurred',
            errorCode: error.code,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
        
    } finally {
        // Always release connection back to pool
        if (connection) {
            connection.release();
            console.log('Database connection released');
        }
    }
});
app.get('/api/test-connection', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        
        // Test basic query
        const [testResult] = await connection.execute('SELECT 1 as test');
        
        // Test profiles table
        const [profilesTest] = await connection.execute('SELECT COUNT(*) as count FROM profiles');
        
        // Test professions table
        const [professionsTest] = await connection.execute('SELECT COUNT(*) as count FROM professions');
        
        res.json({
            success: true,
            message: 'Database connection successful',
            tests: {
                basic: testResult[0],
                profilesCount: profilesTest[0].count,
                professionsCount: professionsTest[0].count
            }
        });
        
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// REPLACE both of your existing login endpoints with this single one:

app.post('/api/login', async (req, res) => {
  let connection;
  
  try {
    const { email, password } = req.body;
    
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Email received:', email);
    console.log('Password received:', password);
    console.log('Password length:', password?.length);
    
    // Validate input
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    connection = await pool.getConnection();
    
    // Find user by email
    console.log('Searching for user with email:', email);
    const [users] = await connection.query(
      'SELECT id, email, password, role, is_active FROM users WHERE email = ?',
      [email]
    );
    
    console.log('Users found:', users.length);
    if (users.length > 0) {
      console.log('User data:', {
        id: users[0].id,
        email: users[0].email,
        role: users[0].role,
        is_active: users[0].is_active,
        password_hash: users[0].password
      });
    }
    
    if (users.length === 0) {
      console.log('No user found with email:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = users[0];
    
    // Check if user account is active
    if (!user.is_active) {
      console.log('User account is deactivated');
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }
    
    // Compare password with hashed password
    console.log('Comparing passwords...');
    console.log('Plain password:', password);
    console.log('Stored hash:', user.password);
    // Guard: ensure stored password is a string
    if (!user.password || typeof user.password !== 'string') {
      console.error('Stored password hash is invalid for user:', user.id);
      return res.status(500).json({ success: false, message: 'Server error: invalid stored password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('Password comparison failed');
      
      // Additional debug: Let's also test the hash manually
      const testHash = await bcrypt.hash(password, 10);
      console.log('Test hash of entered password:', testHash);
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Update last login timestamp
    await connection.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );
    
    // Determine redirect URL based on user role
    let redirectUrl;
    if (user.role === 'admin') {
      redirectUrl = '/';  // profilePage
    } else {
      redirectUrl = '/test';  // testPage
    }
    
    console.log('Login successful for user:', email);
    
    // Successful login with redirect URL
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      redirectUrl: redirectUrl
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (connection) connection.release();
  }
});
app.get('/api/notifications', async (req, res) => {
  try {
    const [notifications] = await pool.execute(`
      SELECT 
        n.*,
        p.firstName,
        p.lastName,
        p.avatarUrl,
        CONCAT(p.firstName, ' ', p.lastName) as fullName,
        pg.name as group_name,
        r.name as room_name
      FROM notifications n
      LEFT JOIN profiles p ON n.profile_id = p.id
      LEFT JOIN profile_groups pg ON n.group_id = pg.id
      LEFT JOIN rooms r ON n.room_id = r.id
      ORDER BY n.created_at DESC
    `);
    
    // Transform data to match frontend expectations
    const transformedNotifications = notifications.map(notification => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      read: notification.read_status,
      resolved: notification.resolved,
      resolution: notification.resolution,
      createdAt: notification.created_at,
      resolvedAt: notification.resolved_at,
      profileInfo: notification.profile_id ? {
        id: notification.profile_id,
        firstName: notification.firstName,
        lastName: notification.lastName,
        fullName: notification.fullName,
        avatarUrl: notification.avatarUrl
      } : null,
      groupName: notification.group_name,
      roomName: notification.room_name
    }));
    
    res.json(transformedNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});
app.get('/api/notifications/count', async (req, res) => {
  try {
    const [totalCount] = await pool.execute(
      'SELECT COUNT(*) as total FROM notifications'
    );
    
    const [unreadCount] = await pool.execute(
      'SELECT COUNT(*) as unread FROM notifications WHERE read_status = FALSE'
    );
    
    const [pendingRequests] = await pool.execute(
      'SELECT COUNT(*) as pending FROM notifications WHERE type = "group_request" AND resolved = FALSE'
    );
    
    res.json({
      totalCount: totalCount[0].total,
      unreadCount: unreadCount[0].unread,
      pendingRequests: pendingRequests[0].pending
    });
  } catch (error) {
    console.error('Error fetching notification counts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notification counts' });
  }
});
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute(
      'UPDATE notifications SET read_status = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
});
app.put('/api/notifications/read-all', async (req, res) => {
  try {
    await pool.execute(
      'UPDATE notifications SET read_status = TRUE, updated_at = CURRENT_TIMESTAMP WHERE read_status = FALSE'
    );
    
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all notifications as read' });
  }
});
app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM notifications WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
});
app.delete('/api/notifications', async (req, res) => {
  try {
    await pool.execute('DELETE FROM notifications');
    
    res.json({ success: true, message: 'All notifications cleared successfully' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ success: false, message: 'Failed to clear notifications' });
  }
});
app.put('/api/notifications/:id/resolve', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'deny'
    
    if (!['approve', 'deny'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }
    
    await connection.beginTransaction();
    
    // Get notification details
    const [notification] = await connection.execute(
      'SELECT * FROM notifications WHERE id = ? AND type = "group_request"',
      [id]
    );
    
    if (notification.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Group request notification not found' });
    }
    
    const notificationData = notification[0];
    
    // If approving, move the profile into the requested group (remove other group memberships to avoid duplicates)
    if (action === 'approve' && notificationData.profile_id && notificationData.group_id) {
      const profileId = notificationData.profile_id;
      const targetGroupId = notificationData.group_id;

      // Find existing memberships for this profile
      const [existingMemberships] = await connection.execute(
        'SELECT id, group_id FROM profile_group_members WHERE profile_id = ?',
        [profileId]
      );

      // If profile is already a member of other groups, remove those memberships (we treat group membership as single for this flow)
      if (existingMemberships.length > 0) {
        // Delete memberships that are not the target group
        await connection.execute(
          'DELETE FROM profile_group_members WHERE profile_id = ? AND group_id != ?',
          [profileId, targetGroupId]
        );
      }

      // Ensure membership for target group exists
      const [existsTarget] = await connection.execute(
        'SELECT id FROM profile_group_members WHERE profile_id = ? AND group_id = ?',
        [profileId, targetGroupId]
      );

      if (existsTarget.length === 0) {
        const memberId = uuidv4();
        await connection.execute(
          'INSERT INTO profile_group_members (id, group_id, profile_id) VALUES (?, ?, ?)',
          [memberId, targetGroupId, profileId]
        );
      }

      // Update any room membership entries for this profile so their room group_id references the new group
      await connection.execute(
        'UPDATE profile_room_members SET group_id = ? WHERE profile_id = ?',
        [targetGroupId, profileId]
      );
    }
    
    // Update notification status
    await connection.execute(
      `UPDATE notifications 
       SET resolved = TRUE, resolution = ?, resolved_at = CURRENT_TIMESTAMP, read_status = TRUE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [action === 'approve' ? 'approved' : 'denied', id]
    );
    
    await connection.commit();
    res.json({ 
      success: true, 
      message: `Group request ${action === 'approve' ? 'approved' : 'denied'} successfully` 
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error resolving group request:', error);
    res.status(500).json({ success: false, message: 'Failed to resolve group request' });
  } finally {
    connection.release();
  }
});

// POST /api/notifications - Create new notification
app.post('/api/notifications', async (req, res) => {
  try {
    const {
      type = 'general',
      title,
      message,
      priority = 'normal',
      profileId = null,
      groupId = null,
      roomId = null,
      userId = null
    } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }
    
    const notificationId = generateNotificationId();
    
    await pool.execute(
      `INSERT INTO notifications 
       (id, type, title, message, priority, profile_id, group_id, room_id, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [notificationId, type, title, message, priority, profileId, groupId, roomId, userId]
    );
    
    res.json({ 
      success: true, 
      message: 'Notification created successfully',
      notificationId 
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ success: false, message: 'Failed to create notification' });
  }
});

// POST /api/notifications/group-request - Create group join request notification
app.post('/api/notifications/group-request', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { profileId, groupId, message } = req.body;
    
    if (!profileId || !groupId) {
      return res.status(400).json({ success: false, message: 'Profile ID and Group ID are required' });
    }
    
    await connection.beginTransaction();
    
    // Get profile and group details
    const [profile] = await connection.execute(
      'SELECT firstName, lastName FROM profiles WHERE id = ?',
      [profileId]
    );
    
    const [group] = await connection.execute(
      'SELECT name FROM profile_groups WHERE id = ?',
      [groupId]
    );
    
    if (profile.length === 0 || group.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Profile or group not found' });
    }
    
    const profileName = `${profile[0].firstName} ${profile[0].lastName}`;
    const groupName = group[0].name;
    
    const notificationId = generateNotificationId();
    const title = 'Group Join Request';
    const notificationMessage = message || `${profileName} wants to join the "${groupName}" group`;
    
    await connection.execute(
      `INSERT INTO notifications 
       (id, type, title, message, priority, profile_id, group_id) 
       VALUES (?, 'group_request', ?, ?, 'normal', ?, ?)`,
      [notificationId, title, notificationMessage, profileId, groupId]
    );
    
    await connection.commit();
    res.json({ 
      success: true, 
      message: 'Group join request submitted successfully',
      notificationId 
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating group request notification:', error);
    res.status(500).json({ success: false, message: 'Failed to submit group join request' });
  } finally {
    connection.release();
  }
});

// PUT /api/profiles/:profileId/group - Change a profile's group (remove other group memberships, update room links)
app.put('/api/profiles/:profileId/group', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { profileId } = req.params;
    const { targetGroupId } = req.body;

    if (!targetGroupId) {
      return res.status(400).json({ success: false, message: 'targetGroupId is required' });
    }

    await connection.beginTransaction();

    // Ensure profile exists
    const [profileRows] = await connection.execute('SELECT id FROM profiles WHERE id = ?', [profileId]);
    if (profileRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Ensure target group exists
    const [groupRows] = await connection.execute('SELECT id FROM profile_groups WHERE id = ?', [targetGroupId]);
    if (groupRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Target group not found' });
    }

    // Remove all other group memberships
    await connection.execute('DELETE FROM profile_group_members WHERE profile_id = ? AND group_id != ?', [profileId, targetGroupId]);

    // Ensure membership in target group exists
    const [existingTarget] = await connection.execute('SELECT id FROM profile_group_members WHERE profile_id = ? AND group_id = ?', [profileId, targetGroupId]);
    if (existingTarget.length === 0) {
      const memberId = uuidv4();
      await connection.execute('INSERT INTO profile_group_members (id, group_id, profile_id) VALUES (?, ?, ?)', [memberId, targetGroupId, profileId]);
    }

    // Update profile_room_members group_id for any room the profile is in
    await connection.execute('UPDATE profile_room_members SET group_id = ? WHERE profile_id = ?', [targetGroupId, profileId]);

    await connection.commit();
    res.json({ success: true, message: 'Profile group changed successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error changing profile group:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    connection.release();
  }
});
app.post('/api/register', async (req, res) => {
  let connection;
  
  try {
    const { email, password, role = 'user' } = req.body;
    
    console.log('=== REGISTRATION ATTEMPT ===');
    console.log('Email:', email);
    console.log('Role:', role);
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }
    
    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }
    
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Check if user already exists
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ?', 
      [email]
    );
    
    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(409).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const userId = uuidv4();
    await connection.query(
      'INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)',
      [userId, email, hashedPassword, role]
    );
    
    await connection.commit();
    
    // Determine redirect URL based on user role (same logic as login)
    let redirectUrl;
    if (role === 'admin') {
      redirectUrl = '/';  // profilePage
    } else {
      redirectUrl = '/test';  // testPage
    }
    
    console.log('Registration successful for:', email, 'redirecting to:', redirectUrl);
    
    res.json({ 
      success: true, 
      message: 'User registered successfully',
      user: { id: userId, email, role },
      redirectUrl: redirectUrl  // Add this line!
    });
    
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  } finally {
    if (connection) connection.release();
  }
});
// GET /api/profiles/:id - Include professions
app.get('/api/profiles/:id', async (req, res) => {
    try {
        // Get profile with avatarUrl
        const [profileRows] = await pool.execute(
            'SELECT id, firstName, lastName, age, message, avatarUrl FROM profiles WHERE id = ?',
            [req.params.id]
        );
        
        if (profileRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }
        
        const profile = profileRows[0];
        console.log('Fetched profile with avatar:', profile); // Debug log
        
        // Get professions for this profile
        const [professionRows] = await pool.execute(`
            SELECT prof.name 
            FROM professions prof
            JOIN profile_profession_members ppm ON prof.id = ppm.profession_id
            WHERE ppm.profile_id = ?
        `, [req.params.id]);
        
        profile.professions = professionRows.map(p => p.name);
        
        console.log('Final profile data:', profile); // Debug log
        res.json(profile);
        
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/profiles/:id - Handle profession updates
app.put('/api/profiles/:id', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const { firstName, lastName, age, professions, message, avatarUrl } = req.body;
        
        console.log('Updating profile:', { firstName, lastName, age, professions, message, avatarUrl });
        
        // Update profile basic info including avatarUrl
        await connection.execute(
            'UPDATE profiles SET firstName = ?, lastName = ?, age = ?, message = ?, avatarUrl = ? WHERE id = ?',
            [firstName, lastName, age || 18, message || '', avatarUrl || null, req.params.id]
        );
        
        // Delete existing profession memberships
        await connection.execute(
            'DELETE FROM profile_profession_members WHERE profile_id = ?',
            [req.params.id]
        );
        
        // Insert new professions if they exist
        if (professions && Array.isArray(professions) && professions.length > 0) {
            for (const professionName of professions) {
                const [professionRows] = await connection.execute(
                    'SELECT id FROM professions WHERE name = ?',
                    [professionName]
                );
                
                if (professionRows.length > 0) {
                    const professionId = professionRows[0].id;
                    const membershipId = 'prof_member_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    
                    await connection.execute(
                        'INSERT INTO profile_profession_members (id, profile_id, profession_id) VALUES (?, ?, ?)',
                        [membershipId, req.params.id, professionId]
                    );
                }
            }
        }
        
        await connection.commit();
        res.json({ success: true, profile: req.body });
        
    } catch (error) {
        await connection.rollback();
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
});

// Fix the bulk member addition that was causing issues
// Serve uploaded files - ADD THIS AFTER YOUR CORS SETUP
app.use('/uploads', express.static('uploads'))
// Assign groups to room - CORRECTED VERSION
app.post('/api/rooms/:roomId/groups', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { roomId } = req.params;
    const { groupIds } = req.body;

    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Group IDs array is required' 
      });
    }

    await connection.beginTransaction();

    // Get room info with current capacity
    const [roomRows] = await connection.query(`
      SELECT r.*, COUNT(prm.profile_id) as current_count
      FROM rooms r
      LEFT JOIN profile_room_members prm ON r.id = prm.room_id
      WHERE r.id = ?
      GROUP BY r.id
      FOR UPDATE
    `, [roomId]);

    if (roomRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const room = roomRows[0];

    // Get detailed group information and check if groups exist
    const placeholders = groupIds.map(() => '?').join(',');
    const [groupMembers] = await connection.query(`
      SELECT pg.id, pg.name, COUNT(pgm.profile_id) as memberCount
      FROM profile_groups pg
      LEFT JOIN profile_group_members pgm ON pg.id = pgm.group_id
      WHERE pg.id IN (${placeholders})
      GROUP BY pg.id, pg.name
    `, groupIds);

    // Check if all groups exist
    if (groupMembers.length !== groupIds.length) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'One or more groups not found' 
      });
    }

    // Check if any groups are already assigned to this room
    const [existingAssignments] = await connection.query(`
      SELECT group_id FROM group_room_members 
      WHERE room_id = ? AND group_id IN (${placeholders})
    `, [roomId, ...groupIds]);

    if (existingAssignments.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'One or more groups are already assigned to this room' 
      });
    }

    // Calculate total new members needed
    const totalNewMembers = groupMembers.reduce((sum, group) => sum + group.memberCount, 0);
    const availableSpots = room.max_capacity - room.current_count;

    if (totalNewMembers > availableSpots) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Not enough capacity. Room has ${availableSpots} spots available, but groups have ${totalNewMembers} total members.` 
      });
    }

    // STEP 1: Record group-to-room assignments in group_room_members table
    for (const groupId of groupIds) {
      const assignmentId = 'grm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await connection.query(
        'INSERT INTO group_room_members (id, group_id, room_id) VALUES (?, ?, ?)',
        [assignmentId, groupId, roomId]
      );
    }

    // STEP 2: Move all group members to the room with group_id reference
    for (const groupId of groupIds) {
      const [members] = await connection.query(
        'SELECT profile_id FROM profile_group_members WHERE group_id = ?',
        [groupId]
      );

      for (const member of members) {
        // Check if profile is already in ANY room (not just this room)
        const [existingRoom] = await connection.query(
          'SELECT room_id FROM profile_room_members WHERE profile_id = ?',
          [member.profile_id]
        );

        // Only add if not already in a room
        if (existingRoom.length === 0) {
          const membershipId = 'rm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          await connection.query(
            'INSERT INTO profile_room_members (id, room_id, profile_id, group_id) VALUES (?, ?, ?, ?)',
            [membershipId, roomId, member.profile_id, groupId]
          );
        }
      }
    }

    await connection.commit();

    res.json({ 
      success: true, 
      message: `${groupIds.length} group(s) assigned to room successfully`,
      assignedGroups: groupMembers.map(g => g.name)
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error assigning groups to room:', error);
    res.status(500).json({ success: false, message: 'Database error: ' + error.message });
  } finally {
    connection.release();
  }
});

app.get('/api/profiles/unassigned', async (req, res) => {
  try {
    const [profiles] = await pool.query(`
      SELECT p.* 
      FROM profiles p
      LEFT JOIN profile_group_members pgm ON p.id = pgm.profile_id
      WHERE pgm.profile_id IS NULL
      ORDER BY p.firstName, p.lastName
    `);
    
    res.json(profiles);
  } catch (error) {
    console.error('Error fetching unassigned profiles:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.get('/api/profiles/available', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.* 
      FROM profiles p
      LEFT JOIN profile_room_members prm ON p.id = prm.profile_id
      WHERE prm.profile_id IS NULL
      ORDER BY p.firstName, p.lastName
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching available profiles:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.get('/api/profiles/available-for-group/:groupId', async (req, res) => {
  try {
    const [profiles] = await pool.query(`
      SELECT DISTINCT p.* 
      FROM profiles p
      LEFT JOIN profile_group_members pgm ON p.id = pgm.profile_id AND pgm.group_id != ?
      WHERE pgm.profile_id IS NULL OR p.id IN (
        SELECT profile_id FROM profile_group_members WHERE group_id = ?
      )
      ORDER BY p.firstName, p.lastName
    `, [req.params.groupId, req.params.groupId]);
    
    res.json(profiles);
  } catch (error) {
    console.error('Error fetching available profiles for group:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available profiles' });
  }
});
// Get profiles not in any room (available for assignment) - MOVE THIS UP

// Get all profiles for selection
app.get('/api/profiles/unassigned', async (req, res) => {
  try {
    // Get all profiles with their current groups and professions
    const [profiles] = await pool.query(`
      SELECT DISTINCT p.*, 
             GROUP_CONCAT(DISTINCT pg.name) as groups,
             GROUP_CONCAT(DISTINCT prof.name) as professions
      FROM profiles p
      LEFT JOIN profile_group_members pgm ON p.id = pgm.profile_id
      LEFT JOIN profile_groups pg ON pgm.group_id = pg.id
      LEFT JOIN profile_profession_members ppm ON p.id = ppm.profile_id
      LEFT JOIN professions prof ON ppm.profession_id = prof.id
      GROUP BY p.id
      ORDER BY p.firstName, p.lastName
    `);

    // Transform the results
    const transformedProfiles = profiles.map(profile => ({
      ...profile,
      groups: profile.groups ? profile.groups.split(',') : [],
      professions: profile.professions ? profile.professions.split(',') : []
    }));

    res.json(transformedProfiles);
  } catch (error) {
    console.error('Error fetching available profiles:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch available profiles'
    });
  }
});

// Get all profiles that can be added to groups
app.get('/api/profiles/unassigned', async (req, res) => {
  try {
    // Get all profiles with their current groups
    const [profiles] = await pool.query(`
      SELECT DISTINCT p.*, 
             GROUP_CONCAT(DISTINCT pg.name) as groups,
             GROUP_CONCAT(DISTINCT prof.name) as professions
      FROM profiles p
      LEFT JOIN profile_group_members pgm ON p.id = pgm.profile_id
      LEFT JOIN profile_groups pg ON pgm.group_id = pg.id
      LEFT JOIN profile_profession_members ppm ON p.id = ppm.profile_id
      LEFT JOIN professions prof ON ppm.profession_id = prof.id
      GROUP BY p.id
      ORDER BY p.firstName, p.lastName
    `);

    // Transform the results
    const transformedProfiles = profiles.map(profile => ({
      ...profile,
      groups: profile.groups ? profile.groups.split(',') : [],
      professions: profile.professions ? profile.professions.split(',') : []
    }));

    res.json(transformedProfiles);
  } catch (error) {
    console.error('Error fetching available profiles:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch available profiles'
    });
  }
});

// Get all profiles
// Replace your existing GET /api/profiles endpoint with this corrected version
app.get('/api/profiles', async (req, res) => {
  try {
    // Get all profiles with their room and group information
    const [profiles] = await pool.query(`
      SELECT DISTINCT p.*, 
             r.name AS room_name, r.id AS room_id,
             pg.name AS group_name, pg.id AS group_id
      FROM profiles p
      LEFT JOIN profile_room_members prm ON p.id = prm.profile_id
      LEFT JOIN rooms r ON prm.room_id = r.id
      LEFT JOIN profile_group_members pgm ON p.id = pgm.profile_id
      LEFT JOIN profile_groups pg ON pgm.group_id = pg.id
      ORDER BY p.createdAt DESC
    `);

    // For each profile, fetch their professions
    const profilesWithProfessions = await Promise.all(
      profiles.map(async (profile) => {
        const [professionRows] = await pool.query(`
          SELECT prof.name 
          FROM professions prof
          JOIN profile_profession_members ppm ON prof.id = ppm.profession_id
          WHERE ppm.profile_id = ?
        `, [profile.id]);
        
        // Add professions array to the profile
        profile.professions = professionRows.map(p => p.name);
        
        return profile;
      })
    );

    res.json(profilesWithProfessions);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Alt

// Get single profile by ID
// GET /api/profiles/:id - Include professions

// CORRECTION BUG 1: Update profile - Assurer que cette route existe et fonctionne correctement
app.put('/api/profiles/:id', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const { firstName, lastName, age, professions, message } = req.body;
        
        // Update profile
        await connection.execute(
            'UPDATE profiles SET firstName = ?, lastName = ?, age = ?, message = ? WHERE id = ?',
            [firstName, lastName, age, message, req.params.id]
        );
        
        // Delete existing profession memberships
        await connection.execute(
            'DELETE FROM profile_profession_members WHERE profile_id = ?',
            [req.params.id]
        );
        
        // Insert new professions
        if (professions && professions.length > 0) {
            for (const professionName of professions) {
                const [professionRows] = await connection.execute(
                    'SELECT id FROM professions WHERE name = ?',
                    [professionName]
                );
                
                if (professionRows.length > 0) {
                    const professionId = professionRows[0].id;
                    const membershipId = 'prof_member_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    
                    await connection.execute(
                        'INSERT INTO profile_profession_members (id, profile_id, profession_id) VALUES (?, ?, ?)',
                        [membershipId, req.params.id, professionId]
                    );
                }
            }
        }
        
        await connection.commit();
        res.json({ success: true, profile: req.body });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
});

// Delete profile
app.delete('/api/profiles/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM profiles WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    res.json({ success: true, message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting profile:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});
// ADD THIS ENTIRE ENDPOINT - Assign groups to room
app.post('/api/rooms/:roomId/groups', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { roomId } = req.params;
    const { groupIds } = req.body;

    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Group IDs array is required' 
      });
    }

    await connection.beginTransaction();

    // Get room info with current capacity
    const [roomRows] = await connection.query(`
      SELECT r.*, COUNT(prm.profile_id) as current_count
      FROM rooms r
      LEFT JOIN profile_room_members prm ON r.id = prm.room_id
      WHERE r.id = ?
      GROUP BY r.id
      FOR UPDATE
    `, [roomId]);

    if (roomRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const room = roomRows[0];

    // Get detailed group information and check if groups exist
    const placeholders = groupIds.map(() => '?').join(',');
    const [groupMembers] = await connection.query(`
      SELECT pg.id, pg.name, COUNT(pgm.profile_id) as memberCount
      FROM profile_groups pg
      LEFT JOIN profile_group_members pgm ON pg.id = pgm.group_id
      WHERE pg.id IN (${placeholders})
      GROUP BY pg.id, pg.name
    `, groupIds);

    // Check if all groups exist
    if (groupMembers.length !== groupIds.length) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'One or more groups not found' 
      });
    }

    // Check if any groups are already assigned to this room
    const [existingAssignments] = await connection.query(`
      SELECT group_id FROM group_room_members 
      WHERE room_id = ? AND group_id IN (${placeholders})
    `, [roomId, ...groupIds]);

    if (existingAssignments.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'One or more groups are already assigned to this room' 
      });
    }

    // Calculate total new members needed
    const totalNewMembers = groupMembers.reduce((sum, group) => sum + group.memberCount, 0);
    const availableSpots = room.max_capacity - room.current_count;

    if (totalNewMembers > availableSpots) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Not enough capacity. Room has ${availableSpots} spots available, but groups have ${totalNewMembers} total members.` 
      });
    }

    // Assign groups to room
    for (const groupId of groupIds) {
      const assignmentId = uuidv4();
      await connection.query(
        'INSERT INTO group_room_members (id, group_id, room_id) VALUES (?, ?, ?)',
        [assignmentId, groupId, roomId]
      );
    }

    // Move all group members to the room
    for (const groupId of groupIds) {
      const [members] = await connection.query(
        'SELECT profile_id FROM profile_group_members WHERE group_id = ?',
        [groupId]
      );

      for (const member of members) {
        // Check if profile is already in a room
        const [existingRoom] = await connection.query(
          'SELECT room_id FROM profile_room_members WHERE profile_id = ?',
          [member.profile_id]
        );

        if (existingRoom.length === 0) {
          const membershipId = uuidv4();
          await connection.query(
            'INSERT INTO profile_room_members (id, room_id, profile_id, group_id) VALUES (?, ?, ?, ?)',
            [membershipId, roomId, member.profile_id, groupId]
          );
        }
      }
    }

    await connection.commit();

    res.json({ 
      success: true, 
      message: `${groupIds.length} group(s) assigned to room successfully`,
      assignedGroups: groupMembers.map(g => g.name)
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error assigning groups to room:', error);
    res.status(500).json({ success: false, message: 'Database error: ' + error.message });
  } finally {
    connection.release();
  }
});

// ADD THIS ENTIRE ENDPOINT - Remove group from room
app.delete('/api/rooms/:roomId/groups/:groupId', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { roomId, groupId } = req.params;

    await connection.beginTransaction();

    // Check if group is actually assigned to this room
    const [groupAssignment] = await connection.query(
      'SELECT id FROM group_room_members WHERE room_id = ? AND group_id = ?',
      [roomId, groupId]
    );

    if (groupAssignment.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Group is not assigned to this room' 
      });
    }

    // STEP 1: Remove group-to-room assignment
    await connection.query(
      'DELETE FROM group_room_members WHERE room_id = ? AND group_id = ?',
      [roomId, groupId]
    );

    // STEP 2: Remove all group members from room (only those that were assigned via this group)
    const [removedMembers] = await connection.query(`
      DELETE FROM profile_room_members 
      WHERE room_id = ? AND group_id = ?
    `, [roomId, groupId]);

    await connection.commit();

    res.json({ 
      success: true, 
      message: 'Group removed from room successfully',
      membersRemoved: removedMembers.affectedRows
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error removing group from room:', error);
    res.status(500).json({ success: false, message: 'Database error: ' + error.message });
  } finally {
    connection.release();
  }
});

// Get profiles not in any room (available for assignment)
app.get('/api/profiles/available', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.* 
      FROM profiles p
      LEFT JOIN profile_room_members prm ON p.id = prm.profile_id
      WHERE prm.profile_id IS NULL
      ORDER BY p.firstName, p.lastName
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching available profiles:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});
// ===== ROOM MANAGEMENT - CORRECTIONS POUR ÉVITER RACE CONDITIONS =====

// Get all rooms with member counts
app.get('/api/rooms', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, 
             COUNT(prm.profile_id) as current_count,
             (r.max_capacity - COUNT(prm.profile_id)) as available_spots
      FROM rooms r
      LEFT JOIN profile_room_members prm ON r.id = prm.room_id
      GROUP BY r.id, r.name, r.description, r.max_capacity
      ORDER BY r.name
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get single room with its members
app.get('/api/rooms/:id', async (req, res) => {
  try {
    // Get room info
    const [roomRows] = await pool.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    
    if (roomRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Get room members with group information
    const [memberRows] = await pool.query(`
      SELECT p.*, 
             COALESCE(pg.name, 'Individual') as group_name,
             COALESCE(pg.id, 'individual') as group_id
      FROM profiles p
      INNER JOIN profile_room_members prm ON p.id = prm.profile_id
      LEFT JOIN profile_groups pg ON prm.group_id = pg.id
      WHERE prm.room_id = ?
      ORDER BY pg.name, p.firstName, p.lastName
    `, [req.params.id]);

    // Get assigned groups with member counts limited to members who are actually in this room
    // We join profile_room_members (prm) so we count only profiles that are both
    // members of the group and currently assigned to the room.
    const [assignedGroups] = await pool.query(`
      SELECT
        pg.id,
        pg.name,
        pg.description,
        COUNT(DISTINCT prm.profile_id) as memberCount
      FROM group_room_members grm
      INNER JOIN profile_groups pg ON grm.group_id = pg.id
      LEFT JOIN profile_group_members pgm ON pg.id = pgm.group_id
      LEFT JOIN profile_room_members prm ON pgm.profile_id = prm.profile_id AND prm.room_id = ?
      WHERE grm.room_id = ?
      GROUP BY pg.id, pg.name, pg.description
    `, [req.params.id, req.params.id]);
    const room = roomRows[0];
    room.members = memberRows;
    room.memberCount = memberRows.length;
    room.availableSpots = room.max_capacity - memberRows.length;
    room.assignedGroups = assignedGroups;

    res.json(room);
  } catch (error) {
    console.error('Error fetching room details:', error);
    res.status(500).json({ success: false, message: 'Database error: ' + error.message });
  }
});

// CORRECTION BUG 2: Add single profile to room avec protection race condition
app.post('/api/rooms/:roomId/members', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { roomId } = req.params;
    const { profileId } = req.body;

    await connection.beginTransaction();

    // Vérifier room et capacité avec LOCK pour éviter race conditions
    const [roomRows] = await connection.query(`
      SELECT r.*, COUNT(prm.profile_id) as current_count
      FROM rooms r
      LEFT JOIN profile_room_members prm ON r.id = prm.room_id
      WHERE r.id = ?
      GROUP BY r.id
      FOR UPDATE
    `, [roomId]);

    if (roomRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const room = roomRows[0];
    if (room.current_count >= room.max_capacity) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Room ${room.name} is full (${room.current_count}/${room.max_capacity})` 
      });
    }

    // Vérifier si le profil existe
    const [profileRows] = await connection.query(
      'SELECT * FROM profiles WHERE id = ?', 
      [profileId]
    );
    
    if (profileRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Vérifier si déjà assigné avec LOCK
    const [existingRows] = await connection.query(
      'SELECT room_id FROM profile_room_members WHERE profile_id = ? FOR UPDATE', 
      [profileId]
    );
    
    if (existingRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Profile is already assigned to a room' 
      });
    }

    // Insérer avec vérification finale de capacité
    const membershipId = uuidv4();
    const [insertResult] = await connection.query(`
      INSERT INTO profile_room_members (id, room_id, profile_id) 
      SELECT ?, ?, ?
      WHERE (
        SELECT COUNT(*) 
        FROM profile_room_members 
        WHERE room_id = ?
      ) < (
        SELECT max_capacity 
        FROM rooms 
        WHERE id = ?
      )
    `, [membershipId, roomId, profileId, roomId, roomId]);

    if (insertResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Room became full during assignment' 
      });
    }

    await connection.commit();

    const profile = profileRows[0];
    res.json({ 
      success: true, 
      message: `${profile.firstName} ${profile.lastName} added to ${room.name}` 
    });

  } catch (error) {
    await connection.rollback();
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        message: 'Profile is already in this room' 
      });
    }
    
    console.error('Error adding profile to room:', error);
    res.status(500).json({ success: false, message: 'Database error' });
    
  } finally {
    connection.release();
  }
});

// CORRECTION: Add multiple profiles to room avec transactions
app.post('/api/rooms/:roomId/members/bulk', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { roomId } = req.params;
    const { profileIds } = req.body;

    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Profile IDs array is required' 
      });
    }

    await connection.beginTransaction();

    // Lock room et vérifier capacité
    const [roomRows] = await connection.query(`
      SELECT r.*, COUNT(prm.profile_id) as current_count
      FROM rooms r
      LEFT JOIN profile_room_members prm ON r.id = prm.room_id
      WHERE r.id = ?
      GROUP BY r.id
      FOR UPDATE
    `, [roomId]);

    if (roomRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const room = roomRows[0];
    const availableSpots = room.max_capacity - room.current_count;
    
    if (profileIds.length > availableSpots) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Not enough space in ${room.name}. Available: ${availableSpots}, Requested: ${profileIds.length}` 
      });
    }

    // Trouver les profils disponibles avec LOCK
    const placeholders = profileIds.map(() => '?').join(',');
    const [availableProfiles] = await connection.query(`
      SELECT p.id, p.firstName, p.lastName
      FROM profiles p
      LEFT JOIN profile_room_members prm ON p.id = prm.profile_id
      WHERE p.id IN (${placeholders}) AND prm.profile_id IS NULL
      FOR UPDATE
    `, profileIds);

    if (availableProfiles.length === 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'No available profiles found for assignment' 
      });
    }

    // Insérer tous les profils disponibles
    const insertPromises = availableProfiles.map(profile => {
      const membershipId = uuidv4();
      return connection.query(
        'INSERT INTO profile_room_members (id, room_id, profile_id) VALUES (?, ?, ?)',
        [membershipId, roomId, profile.id]
      );
    });

    await Promise.all(insertPromises);

    await connection.commit();

    res.json({ 
      success: true, 
      message: `${availableProfiles.length} profiles added to ${room.name}`,
      assignedProfiles: availableProfiles,
      skippedCount: profileIds.length - availableProfiles.length
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error adding profiles to room:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    connection.release();
  }
});

// Remove profile from room (transactional + remove empty group-room assignment)
app.delete('/api/rooms/:roomId/members/:profileId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { roomId, profileId } = req.params;

    await connection.beginTransaction();

    // Fetch the existing membership to inspect group association
    const [memberships] = await connection.query(
      'SELECT * FROM profile_room_members WHERE room_id = ? AND profile_id = ?',
      [roomId, profileId]
    );

    if (memberships.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Profile not found in this room' });
    }

    const membership = memberships[0];
    const groupId = membership.group_id; // may be null

    // Delete the membership
    const [delResult] = await connection.query(
      'DELETE FROM profile_room_members WHERE room_id = ? AND profile_id = ?',
      [roomId, profileId]
    );

    if (delResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(500).json({ success: false, message: 'Failed to remove profile from room' });
    }

    let groupRemoved = false;

    // If this profile was part of a group, check remaining members of that group in this room
    if (groupId) {
      const [remaining] = await connection.query(
        'SELECT COUNT(*) as cnt FROM profile_room_members WHERE room_id = ? AND group_id = ?',
        [roomId, groupId]
      );

      const remainingCount = remaining && remaining[0] ? remaining[0].cnt : 0;
      if (remainingCount === 0) {
        // Remove the group-room assignment so the group disappears from the room
        await connection.query(
          'DELETE FROM group_room_members WHERE room_id = ? AND group_id = ?',
          [roomId, groupId]
        );
        groupRemoved = true;
      }
    }

    await connection.commit();

    res.json({ success: true, message: 'Profile removed from room successfully', groupRemoved });

  } catch (error) {
    await connection.rollback();
    console.error('Error removing profile from room:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    connection.release();
  }
});

// Auto-assign unassigned profiles to rooms - CORRECTION avec transactions
app.post('/api/assignRooms', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get unassigned profiles avec LOCK
    const [unassignedProfiles] = await connection.query(`
      SELECT p.id, p.firstName, p.lastName 
      FROM profiles p
      LEFT JOIN profile_room_members prm ON p.id = prm.profile_id
      WHERE prm.profile_id IS NULL
      ORDER BY p.firstName, p.lastName
      FOR UPDATE
    `);

    if (unassignedProfiles.length === 0) {
      await connection.commit();
      return res.json({ 
        success: true, 
        message: 'No unassigned profiles found',
        assigned: [] 
      });
    }

    // Get rooms with available capacity avec LOCK
    const [rooms] = await connection.query(`
      SELECT r.*, COUNT(prm.profile_id) as current_count,
             (r.max_capacity - COUNT(prm.profile_id)) as available_spots
      FROM rooms r
      LEFT JOIN profile_room_members prm ON r.id = prm.room_id
      GROUP BY r.id
      HAVING available_spots > 0
      ORDER BY available_spots DESC, r.name
      FOR UPDATE
    `);

    if (rooms.length === 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'No rooms with available capacity found' 
      });
    }

    let assignments = [];
    let profileIndex = 0;

    // Distribute profiles across rooms
    for (const room of rooms) {
      let assigned = 0;
      while (assigned < room.available_spots && profileIndex < unassignedProfiles.length) {
        const profile = unassignedProfiles[profileIndex];
        
        const membershipId = uuidv4();

        await connection.query(
          'INSERT INTO profile_room_members (id, room_id, profile_id) VALUES (?, ?, ?)',
          [membershipId, room.id, profile.id]
        );

        assignments.push({
          profileId: profile.id,
          profileName: `${profile.firstName} ${profile.lastName}`,
          roomId: room.id,
          roomName: room.name
        });

        assigned++;
        profileIndex++;
      }

      if (profileIndex >= unassignedProfiles.length) break;
    }

    await connection.commit();

    const unassignedCount = unassignedProfiles.length - assignments.length;

    res.json({ 
      success: true, 
      message: `${assignments.length} profiles assigned successfully`,
      assigned: assignments,
      unassignedRemaining: unassignedCount
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error in auto-assignment:', error);
    res.status(500).json({ success: false, message: 'Auto-assignment failed' });
  } finally {
    connection.release();
  }
});

// ===== GROUP MANAGEMENT (Existing functionality) =====

// Get all subjects
app.get('/api/subjects', async (req, res) => {
  try {
    const [subjects] = await pool.query('SELECT * FROM subjects ORDER BY name');
    res.json(subjects);
  } catch (error) {
    console.error('Error getting subjects:', error);
    res.status(500).json({ error: 'Failed to get subjects' });
  }
});

// Get all groups with their subjects
app.get('/api/groups', async (req, res) => {
  try {
    // Get all groups with correct member counts
    const [groups] = await pool.query(`
      SELECT pg.*, 
             COUNT(pgm.profile_id) as memberCount
      FROM profile_groups pg
      LEFT JOIN profile_group_members pgm ON pg.id = pgm.group_id
      GROUP BY pg.id, pg.name, pg.description, pg.createdAt, pg.updatedAt
      ORDER BY pg.name
    `);
    
    res.json(groups);
    
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});
app.get('/api/groups/:groupId/subjects', async (req, res) => {
  try {
    const [subjects] = await pool.query(`
      SELECT s.* 
      FROM subjects s
      INNER JOIN group_subjects gs ON s.id = gs.subject_id
      WHERE gs.group_id = ?
      ORDER BY s.name
    `, [req.params.groupId]);
    
    res.json(subjects);
  } catch (error) {
    console.error('Error fetching group subjects:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch group subjects' });
  }
});
app.put('/api/groups/:groupId', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { groupId } = req.params;
    const { name, description, subjectIds = [], profileIds = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }

    if (!subjectIds || subjectIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one subject must be selected' });
    }

    await connection.beginTransaction();

    // Update group basic info
    await connection.query(
      'UPDATE profile_groups SET name = ?, description = ? WHERE id = ?',
      [name.trim(), description?.trim() || null, groupId]
    );

    // Delete existing subjects
    await connection.query('DELETE FROM group_subjects WHERE group_id = ?', [groupId]);

    // Insert new subjects
    for (const subjectId of subjectIds) {
      const gsId = 'gs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await connection.query(
        'INSERT INTO group_subjects (id, group_id, subject_id) VALUES (?, ?, ?)',
        [gsId, groupId, subjectId]
      );
    }

    // Delete existing members
    await connection.query('DELETE FROM profile_group_members WHERE group_id = ?', [groupId]);

    // Insert new members
    for (const profileId of profileIds) {
      const memberId = 'pgm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await connection.query(
        'INSERT INTO profile_group_members (id, group_id, profile_id) VALUES (?, ?, ?)',
        [memberId, groupId, profileId]
      );
    }

    await connection.commit();

    res.json({ 
      success: true, 
      message: 'Group updated successfully',
      group: { id: groupId, name, description, memberCount: profileIds.length }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error updating group:', error);
    res.status(500).json({ success: false, message: 'Failed to update group' });
  } finally {
    connection.release();
  }
});

// Get single group with members
app.get('/api/groups/:id', async (req, res) => {
  try {
    const [groupRows] = await pool.query('SELECT * FROM profile_groups WHERE id = ?', [req.params.id]);
    
    if (groupRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const [memberRows] = await pool.query(`
      SELECT p.* 
      FROM profiles p
      INNER JOIN profile_group_members pgm ON p.id = pgm.profile_id
      WHERE pgm.group_id = ?
      ORDER BY p.firstName, p.lastName
    `, [req.params.id]);

    // ADD THIS: Check for room assignment
    const [roomAssignment] = await pool.query(`
      SELECT r.name as room_name, r.id as room_id
      FROM group_room_members grm
      INNER JOIN rooms r ON grm.room_id = r.id
      WHERE grm.group_id = ?
    `, [req.params.id]);

    const group = groupRows[0];
    group.members = memberRows;
    group.memberCount = memberRows.length;
    
    // ADD THIS: Set assigned room info
    if (roomAssignment.length > 0) {
      group.assignedRoom = roomAssignment[0].room_name;
      group.assignedRoomId = roomAssignment[0].room_id;
    }

    res.json(group);
  } catch (error) {
    console.error('Error fetching group details:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});
// Assign groups to room with capacity checking
app.post('/api/rooms/:roomId/groups', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { roomId } = req.params;
    const { groupIds } = req.body;

    await connection.beginTransaction();

    // Get room info with current capacity
    const [roomRows] = await connection.query(`
      SELECT r.*, COUNT(prm.profile_id) as current_count
      FROM rooms r
      LEFT JOIN profile_room_members prm ON r.id = prm.room_id
      WHERE r.id = ?
      GROUP BY r.id
      FOR UPDATE
    `, [roomId]);

    if (roomRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const room = roomRows[0];

    // Calculate total members from selected groups
    const placeholders = groupIds.map(() => '?').join(',');
    const [groupMembers] = await connection.query(`
      SELECT pg.id, pg.name, COUNT(pgm.profile_id) as memberCount
      FROM profile_groups pg
      LEFT JOIN profile_group_members pgm ON pg.id = pgm.group_id
      WHERE pg.id IN (${placeholders})
      GROUP BY pg.id, pg.name
    `, groupIds);

    const totalNewMembers = groupMembers.reduce((sum, group) => sum + group.memberCount, 0);
    const availableSpots = room.max_capacity - room.current_count;

    if (totalNewMembers > availableSpots) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Not enough capacity. Room has ${availableSpots} spots available, but groups have ${totalNewMembers} total members.` 
      });
    }

    // Assign groups to room
    const assignmentPromises = groupIds.map(groupId => {
      const assignmentId = uuidv4();
      return connection.query(
        'INSERT IGNORE INTO group_room_members (id, group_id, room_id) VALUES (?, ?, ?)',
        [assignmentId, groupId, roomId]
      );
    });

    await Promise.all(assignmentPromises);

    // Move all group members to the room
    for (const groupId of groupIds) {
      const [members] = await connection.query(
        'SELECT profile_id FROM profile_group_members WHERE group_id = ?',
        [groupId]
      );

      for (const member of members) {
        const membershipId = uuidv4();
        await connection.query(
          'INSERT IGNORE INTO profile_room_members (id, room_id, profile_id, group_id) VALUES (?, ?, ?, ?)',
          [membershipId, roomId, member.profile_id, groupId]
        );
      }
    }

    await connection.commit();

    res.json({ 
      success: true, 
      message: `${groupIds.length} group(s) assigned to room successfully` 
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error assigning groups to room:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    connection.release();
  }
});

// Remove group from room
app.delete('/api/rooms/:roomId/groups/:groupId', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { roomId, groupId } = req.params;

    await connection.beginTransaction();

    // Remove group assignment
    await connection.query(
      'DELETE FROM group_room_members WHERE room_id = ? AND group_id = ?',
      [roomId, groupId]
    );

    // Remove all group members from room
    await connection.query(`
      DELETE prm FROM profile_room_members prm
      INNER JOIN profile_group_members pgm ON prm.profile_id = pgm.profile_id
      WHERE prm.room_id = ? AND pgm.group_id = ?
    `, [roomId, groupId]);

    await connection.commit();

    res.json({ success: true, message: 'Group removed from room successfully' });

  } catch (error) {
    await connection.rollback();
    console.error('Error removing group from room:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    connection.release();
  }
});
// Add this new endpoint in your backend (server.js)

// Add endpoint to get available profiles for a specific group (for editing)

// Create new group
app.post('/api/groups', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { name, description, profileIds = [], subjectIds = [] } = req.body;

    // Validate group name
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Group name is required' 
      });
    }

    // Validate subjects
    if (!subjectIds || !Array.isArray(subjectIds) || subjectIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one subject must be selected' 
      });
    }

    await connection.beginTransaction();

    // Verify all subjects exist
    const placeholders = subjectIds.map(() => '?').join(',');
    const [subjectRows] = await connection.query(
      `SELECT id FROM subjects WHERE id IN (${placeholders})`,
      subjectIds
    );

    if (subjectRows.length !== subjectIds.length) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'One or more invalid subject IDs provided' 
      });
    }

    // Create the group
    const groupId = uuidv4();
    await connection.query(
      'INSERT INTO profile_groups (id, name, description) VALUES (?, ?, ?)',
      [groupId, name.trim(), description?.trim() || null]
    );

    // **THIS WAS MISSING** - Insert subjects for the group
    for (const subjectId of subjectIds) {
      const gsId = 'gs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await connection.query(
        'INSERT INTO group_subjects (id, group_id, subject_id) VALUES (?, ?, ?)',
        [gsId, groupId, subjectId]
      );
    }

    // Add members to the group if provided
    if (profileIds.length > 0) {
      for (const profileId of profileIds) {
        const memberId = uuidv4();
        await connection.query(
          'INSERT INTO profile_group_members (id, group_id, profile_id) VALUES (?, ?, ?)',
          [memberId, groupId, profileId]
        );
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: `Group created successfully${profileIds.length > 0 ? ` with ${profileIds.length} member(s)` : ' (empty group)'}`,
      group: {
        id: groupId,
        name: name.trim(),
        description: description?.trim() || null,
        memberCount: profileIds.length,
        subjectCount: subjectIds.length
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error creating group:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        message: 'A group with this name already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Database error: ' + error.message 
    });
  } finally {
    connection.release();
  }
});
// Get unassigned profiles (profiles not in any group)


// Get profiles available for a specific group (unassigned + current group members)

// Delete group
app.delete('/api/groups/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM profile_groups WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});// ===== STATIC FILES (ONLY FOR PRODUCTION) =====
// Only serve static files in production environment
if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Serve static files
  app.use(express.static(path.join(__dirname, 'dist')));

  // Catch-all handler: send back index.html for any non-API routes
  app.get(/^(?!\/api).*$/, (req, res) => {
    const filePath = path.join(__dirname, 'dist', 'index.html');
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error serving file:', err);
        res.status(500).send('Internal Server Error');
      }
    });
  });
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DB_NAME}`);
});

// ===== ERROR HANDLING =====
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

// Export app for testing purposes
export default app;
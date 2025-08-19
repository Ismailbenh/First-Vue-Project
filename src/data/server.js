// Import required modules
import express from 'express';     // Web framework for handling HTTP requests
import fs from 'fs';               // File system module (read/write files)
import path from 'path';           // For working with file paths
import { fileURLToPath } from 'url'; // Fixes __dirname in ES modules

// -------------------- Fix __dirname for ES modules --------------------
// ES modules don't have __dirname, so we recreate it:
const __filename = fileURLToPath(import.meta.url);  // Current file path
const __dirname = path.dirname(__filename);         // Current folder path

// -------------------- Setup Express app --------------------
const app = express();

// Middleware to parse incoming JSON requests (req.body)
app.use(express.json());

// -------------------- CORS setup --------------------
// Allows frontend (http://localhost:5173) to talk to backend (http://localhost:3000)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173'); // Allow frontend origin
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE'); // Allowed HTTP methods
    res.header('Access-Control-Allow-Headers', 'Content-Type'); // Allowed headers
    next(); // Continue to the next middleware/route
});

// -------------------- File path for profiles --------------------
const profilesPath = path.join(__dirname, 'profiles.json'); // File where profiles are stored

// -------------------- Helper function: Read profiles from file --------------------
function readProfiles() {
    try {
        // If profiles.json doesn't exist, create an empty one
        if (!fs.existsSync(profilesPath)) {
            fs.writeFileSync(profilesPath, '[]');
            return [];
        }

        const fileData = fs.readFileSync(profilesPath, 'utf8');
        const profiles = JSON.parse(fileData || '[]');
        return Array.isArray(profiles) ? profiles : [];
    } catch (parseErr) {
        console.error('JSON parse error — resetting profiles.json');
        fs.writeFileSync(profilesPath, '[]');
        return [];
    }
}

// -------------------- Helper function: Write profiles to file --------------------
function writeProfiles(profiles) {
    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));
}

// -------------------- Route: Add new profile --------------------
app.post('/api/addProfile', (req, res) => {
    try {
        let profiles = readProfiles();

        // -------------------- Create new profile --------------------
        const profileWithId = {
            id: 'profile_' + Date.now(),   // Unique ID using timestamp
            ...req.body,                   // Spread operator: add all data from client (name, email, etc.)
            createdAt: new Date().toISOString() // Timestamp of when profile was created
        };

        // Add new profile to the list
        profiles.push(profileWithId);

        // Save updated list back into profiles.json
        writeProfiles(profiles);

        // Send success response to frontend with new profile
        res.json({ success: true, profile: profileWithId });

    } catch (err) {
        // -------------------- Error Handling --------------------
        console.error('Error saving profile:', err); // Log error to console
        res.status(500).json({ success: false, message: 'Error saving profile' }); // Respond with error
    }
});

// -------------------- Route: Update existing profile --------------------
app.put('/api/updateProfile/:id', (req, res) => {
    try {
        let profiles = readProfiles();
        
        // Find the profile to update
        const profileIndex = profiles.findIndex(profile => profile.id === req.params.id);
        
        if (profileIndex === -1) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        // Update the profile while keeping the original id and createdAt
        const updatedProfile = {
            ...profiles[profileIndex],  // Keep existing data (id, createdAt)
            ...req.body,               // Override with new data from client
            id: req.params.id,         // Ensure ID stays the same
            updatedAt: new Date().toISOString() // Add timestamp of when it was updated
        };

        // Replace the old profile with the updated one
        profiles[profileIndex] = updatedProfile;

        // Save updated list back to profiles.json
        writeProfiles(profiles);

        // Send success response to frontend with updated profile
        res.json({ success: true, profile: updatedProfile });

    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ success: false, message: 'Error updating profile' });
    }
});

// -------------------- Route: Get all profiles (optional, for debugging) --------------------
app.get('/api/profiles', (req, res) => {
    try {
        const profiles = readProfiles();
        res.json({ success: true, profiles });
    } catch (err) {
        console.error('Error reading profiles:', err);
        res.status(500).json({ success: false, message: 'Error reading profiles' });
    }
});

// -------------------- Start server --------------------
app.listen(3000, () => console.log(' Server running on http://localhost:3000'));
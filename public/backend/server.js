const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());           // allow requests from frontend dev server
app.use(express.json());   // parse JSON bodies

const DATA_FILE = path.join(__dirname, 'profiles.json');

async function readProfiles() {
  try {
    const text = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(text || '[]');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeProfiles(profiles) {
  await fs.writeFile(DATA_FILE, JSON.stringify(profiles, null, 2), 'utf8'); // pretty print
}

// GET all profiles
app.get('/profiles', async (req, res) => {
  try {
    const profiles = await readProfiles();
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add a new profile
app.post('/add-profile', async (req, res) => {
  try {
    const profiles = await readProfiles();
    const newProfile = req.body;

    // Basic validation
    if (!newProfile.firstName || !newProfile.lastName) {
      return res.status(400).json({ error: 'firstName and lastName are required' });
    }

    // Ensure profession is an array
    if (newProfile.profession && !Array.isArray(newProfile.profession)) {
      newProfile.profession = [newProfile.profession];
    } else if (!newProfile.profession) {
      newProfile.profession = [];
    }

    newProfile.age = newProfile.age ? Number(newProfile.age) : null;

    // Generate ID = max existing id + 1 (safer if IDs are not continuous)
    const maxId = profiles.reduce((m, p) => Math.max(m, p.id || 0), 0);
    newProfile.id = maxId + 1;

    profiles.push(newProfile);

    await writeProfiles(profiles);

    res.status(201).json({ success: true, newProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Backend running: http://localhost:${PORT}`));

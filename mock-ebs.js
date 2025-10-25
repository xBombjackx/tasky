// mock-ebs.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 8082;

app.use(cors());

const mockTasks = {
  streamerTasks: [
    { id: 'st1', title: 'Finish the main story quest', completed: true },
    { id: 'st2', title: 'Defeat the secret boss', completed: false },
  ],
  viewerTasks: [
    { id: 'vt1', title: 'Use only a pistol for a round', submitter: 'viewer123', completed: false, is_vip: true, is_subscriber: false },
    { id: 'vt2', title: 'Do a barrel roll!', submitter: 'anotherViewer', completed: true, is_vip: false, is_subscriber: true },
    { id: 'vt3', title: 'Get a triple kill', submitter: 'pro_gamer', completed: false, is_vip: false, is_subscriber: true },
    { id: 'vt4', title: 'No-scope an enemy from 50m', submitter: 'sniper_god', completed: false, is_vip: false, is_subscriber: false },
    { id: 'vt5', title: 'Win a round with 1 health', submitter: 'clutch_king', completed: false, is_vip: true, is_subscriber: true },
    { id: 'vt6', title: 'Get a headshot with a grenade', submitter: 'trickshotter', completed: false, is_vip: false, is_subscriber: false },
    { id: 'vt7', title: 'Tame a wild animal', submitter: 'beast_master', completed: true, is_vip: false, is_subscriber: true },
    { id: 'vt8', title: 'Craft a legendary item', submitter: 'crafty_crafter', completed: false, is_vip: false, is_subscriber: false },
    { id: 'vt9', title: 'Solve the ancient puzzle', submitter: 'riddle_master', completed: false, is_vip: true, is_subscriber: false },
    { id: 'vt10', title: 'Reach the highest point on the map', submitter: 'explorer_extraordinaire', completed: false, is_vip: false, is_subscriber: true },
  ],
};

app.get('/tasks', (req, res) => {
  console.log('Mock EBS: Received request for /tasks');
  res.json(mockTasks);
});

app.listen(PORT, () => {
  console.log(`Mock EBS server running on http://localhost:${PORT}`);
});

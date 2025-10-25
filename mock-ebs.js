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
  ],
};

app.get('/tasks', (req, res) => {
  console.log('Mock EBS: Received request for /tasks');
  res.json(mockTasks);
});

app.listen(PORT, () => {
  console.log(`Mock EBS server running on http://localhost:${PORT}`);
});

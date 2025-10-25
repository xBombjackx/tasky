// mock-ebs.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 8082;

app.use(cors());

const mockTasks = {
  streamerTasks: [
    { id: 'st1', title: 'Finish the main story quest' },
    { id: 'st2', title: 'Defeat the secret boss' },
  ],
  viewerTasks: [
    { id: 'vt1', title: 'Use only a pistol for a round', submitter: 'viewer123' },
    { id: 'vt2', title: 'Do a barrel roll!', submitter: 'anotherViewer' },
  ],
};

app.get('/tasks', (req, res) => {
  console.log('Mock EBS: Received request for /tasks');
  res.json(mockTasks);
});

app.listen(PORT, () => {
  console.log(`Mock EBS server running on http://localhost:${PORT}`);
});

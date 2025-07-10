const { evaluateSquatPosture, evaluateDeskSittingPosture } = require('../controllers/postureController');

function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('keypointsData', ({ keypoints, postureType }) => {
      let issues = [];

      if (postureType === 'squat') {
        issues = evaluateSquatPosture(keypoints);
      } else if (postureType === 'desk') {
        issues = evaluateDeskSittingPosture(keypoints);
      } else {
        issues.push('Unknown posture type.');
      }

      socket.emit('postureFeedback', {
        timestamp: Date.now(),
        issues,
        keypoints,
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
}

module.exports = socketHandler;

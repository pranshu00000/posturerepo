const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "https://posturerepo.vercel.app", 
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

const PORT = process.env.PORT || 5000;


function findKeypoint(keypoints, name) {
  return keypoints.find(kp => kp.name === name) || null;
}


function calculateAngle(p1, p2, p3) {
  if (!p1 || !p2 || !p3 || typeof p1.x === 'undefined' || typeof p1.y === 'undefined' ||
      typeof p2.x === 'undefined' || typeof p2.y === 'undefined' ||
      typeof p3.x === 'undefined' || typeof p3.y === 'undefined') {
    return 0; 
  }

  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  const dotProduct = v1.x * v2.x + v1.y * v2.y;
  const magnitude1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const magnitude2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (magnitude1 === 0 || magnitude2 === 0) return 0; 

  const angleRad = Math.acos(Math.min(Math.max(dotProduct / (magnitude1 * magnitude2), -1), 1)); 
  return angleRad * (180 / Math.PI); 
}

function evaluateSquatPosture(rawKeypoints) {
  const issues = [];
  const minConfidence = 0.2; 

  const nose = findKeypoint(rawKeypoints, 'nose');
  const leftShoulder = findKeypoint(rawKeypoints, 'left_shoulder');
  const rightShoulder = findKeypoint(rawKeypoints, 'right_shoulder');
  const leftHip = findKeypoint(rawKeypoints, 'left_hip');
  const rightHip = findKeypoint(rawKeypoints, 'right_hip');
  const leftKnee = findKeypoint(rawKeypoints, 'left_knee');
  const rightKnee = findKeypoint(rawKeypoints, 'right_knee');
  const leftAnkle = findKeypoint(rawKeypoints, 'left_ankle');
  const rightAnkle = findKeypoint(rawKeypoints, 'right_ankle');

  const essentialSquatKPs = [leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle];
  const allEssentialKPsPresent = essentialSquatKPs.every(kp => kp && kp.score > minConfidence);

  if (!allEssentialKPsPresent) {
    issues.push("Insufficient keypoints detected for squat evaluation. Ensure full body is visible.");
    return issues;
  }

 
  if (leftKnee.x < leftAnkle.x) { 
    issues.push("Left knee over toe.");
  }
  if (rightKnee.x > rightAnkle.x) { 
    issues.push("Right knee over toe.");
  }

 
  const leftBackAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
  const rightBackAngle = calculateAngle(rightShoulder, rightHip, rightKnee);

  if (leftBackAngle < 150 || rightBackAngle < 150) {
    issues.push(`Hunched back detected (Back angle: ${leftBackAngle.toFixed(0)}° / ${rightBackAngle.toFixed(0)}°).`);
  }

  return issues;
}


function evaluateDeskSittingPosture(rawKeypoints) {
  const issues = [];
  const minConfidence = 0.5;

  const nose = findKeypoint(rawKeypoints, 'nose');
  const leftEar = findKeypoint(rawKeypoints, 'left_ear');
  const rightEar = findKeypoint(rawKeypoints, 'right_ear');
  const leftShoulder = findKeypoint(rawKeypoints, 'left_shoulder');
  const rightShoulder = findKeypoint(rawKeypoints, 'right_shoulder');
  const leftHip = findKeypoint(rawKeypoints, 'left_hip');
  const rightHip = findKeypoint(rawKeypoints, 'right_hip');

  const essentialDeskKPs = [nose, leftShoulder, rightShoulder, leftHip, rightHip];
  const allEssentialKPsPresent = essentialDeskKPs.every(kp => kp && kp.score > minConfidence);

  if (!allEssentialKPsPresent) {
    issues.push("Insufficient keypoints detected for desk posture evaluation. Ensure upper body is visible.");
    
    return issues;
  }


  const neckAngleLeft = calculateAngle(leftEar || nose, leftShoulder, leftHip);
  const neckAngleRight = calculateAngle(rightEar || nose, rightShoulder, rightHip);

  if (neckAngleLeft < 150 || neckAngleRight < 150) {
    issues.push(`Neck bent forward (>30° estimated). Angles: ${neckAngleLeft.toFixed(0)}° / ${neckAngleRight.toFixed(0)}°`);
  }


  const leftSpineAngle = calculateAngle(leftShoulder, leftHip, leftHip.y + 0.1); 
  const rightSpineAngle = calculateAngle(rightShoulder, rightHip, rightHip.y + 0.1); 


  if (leftSpineAngle < 160 || rightSpineAngle < 160) {
    issues.push(`Back isn't straight (slouching detected). Angles: ${leftSpineAngle.toFixed(0)}° / ${rightSpineAngle.toFixed(0)}°`);
  }

  return issues;
}


io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('keypointsData', (data) => {
    

    const { keypoints, postureType } = data;

    let postureIssues = [];
    if (postureType === 'squat') {
      postureIssues = evaluateSquatPosture(keypoints);
    } else if (postureType === 'desk') {
      postureIssues = evaluateDeskSittingPosture(keypoints);
    } else {
      postureIssues.push("Unknown posture type.");
    }

    socket.emit('postureFeedback', {
      timestamp: Date.now(),
      issues: postureIssues,
      keypoints: keypoints 
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

app.get('/', (req, res) => {
  res.send('Posture Detection Backend is running!');
});

server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});

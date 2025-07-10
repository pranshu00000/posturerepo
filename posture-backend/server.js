const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173", // Allow your React app to connect
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Keep limit high just in case, though keypoints are small

const PORT = process.env.PORT || 5000;


/**
 * Finds a keypoint by name from the MoveNet output format.
 * @param {Array<Object>} keypoints - Array of keypoint objects from MoveNet.
 * @param {string} name - The name of the keypoint (e.g., 'nose', 'left_shoulder').
 * @returns {Object|null} The keypoint object {x, y, score} or null if not found.
 */
function findKeypoint(keypoints, name) {
  return keypoints.find(kp => kp.name === name) || null;
}

/**
 * Calculates the angle between three points.
 * Points are expected to have x and y properties.
 * @param {Object} p1 - First point {x, y}.
 * @param {Object} p2 - Middle point {x, y}.
 * @param {Object} p3 - Third point {x, y}.
 * @returns {number} Angle in degrees. Returns 0 if any point is missing or invalid.
 */
function calculateAngle(p1, p2, p3) {
  if (!p1 || !p2 || !p3 || typeof p1.x === 'undefined' || typeof p1.y === 'undefined' ||
      typeof p2.x === 'undefined' || typeof p2.y === 'undefined' ||
      typeof p3.x === 'undefined' || typeof p3.y === 'undefined') {
    return 0; // Return 0 if any point is missing or malformed
  }

  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  const dotProduct = v1.x * v2.x + v1.y * v2.y;
  const magnitude1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const magnitude2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (magnitude1 === 0 || magnitude2 === 0) return 0; // Avoid division by zero

  const angleRad = Math.acos(Math.min(Math.max(dotProduct / (magnitude1 * magnitude2), -1), 1)); // Clamp to avoid NaN from floating point errors
  return angleRad * (180 / Math.PI); // Convert to degrees
}

/**
 * Applies rule-based logic for squat posture.
 * @param {Array<Object>} rawKeypoints - Detected pose keypoints from MoveNet.
 * @returns {Array<string>} List of detected posture issues.
 */
function evaluateSquatPosture(rawKeypoints) {
  const issues = [];
  const minConfidence = 0.01; // Minimum confidence score for a keypoint to be considered

  // Extract relevant keypoints with confidence check
  const nose = findKeypoint(rawKeypoints, 'nose');
  const leftShoulder = findKeypoint(rawKeypoints, 'left_shoulder');
  const rightShoulder = findKeypoint(rawKeypoints, 'right_shoulder');
  const leftHip = findKeypoint(rawKeypoints, 'left_hip');
  const rightHip = findKeypoint(rawKeypoints, 'right_hip');
  const leftKnee = findKeypoint(rawKeypoints, 'left_knee');
  const rightKnee = findKeypoint(rawKeypoints, 'right_knee');
  const leftAnkle = findKeypoint(rawKeypoints, 'left_ankle');
  const rightAnkle = findKeypoint(rawKeypoints, 'right_ankle');

  // Check if essential keypoints are present and confident enough
  const essentialSquatKPs = [leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle];
  const allEssentialKPsPresent = essentialSquatKPs.every(kp => kp && kp.score > minConfidence);

  if (!allEssentialKPsPresent) {
    issues.push("Insufficient keypoints detected for squat evaluation. Ensure full body is visible.");
    return issues;
  }

  // Rule 1: Knee over toe (simplified check based on x-coordinates)
  // This is a common simplification. A more robust check might involve projection or 3D estimation.
  // Assuming facing sideways, if knee x is beyond ankle x in the direction of movement.
  // For a front-facing view, this rule is harder to apply without depth.
  // Let's assume a side view where left is left and right is right.
  // If left_knee.x is less than left_ankle.x (meaning knee is forward of ankle)
  if (leftKnee.x < leftAnkle.x) { // This depends on camera orientation. Could be > for right side.
    issues.push("Left knee over toe.");
  }
  if (rightKnee.x > rightAnkle.x) { // This depends on camera orientation. Could be < for left side.
    issues.push("Right knee over toe.");
  }

  // Rule 2: Back angle (angle between shoulder, hip, and knee/ankle)
  // A straight back in a squat means the torso is relatively upright.
  // Angle at the hip: (shoulder - hip - knee)
  const leftBackAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
  const rightBackAngle = calculateAngle(rightShoulder, rightHip, rightKnee);

  // If the back angle is too acute (e.g., < 150 degrees), it indicates a hunched back or excessive forward lean.
  if (leftBackAngle < 150 || rightBackAngle < 150) {
    issues.push(`Hunched back detected (Back angle: ${leftBackAngle.toFixed(0)}° / ${rightBackAngle.toFixed(0)}°).`);
  }

  return issues;
}

/**
 * Applies rule-based logic for desk sitting posture.
 * @param {Array<Object>} rawKeypoints - Detected pose keypoints from MoveNet.
 * @returns {Array<string>} List of detected posture issues.
 */
function evaluateDeskSittingPosture(rawKeypoints) {
  const issues = [];
  const minConfidence = 0.5;

  // Extract relevant keypoints with confidence check
  const nose = findKeypoint(rawKeypoints, 'nose');
  const leftEar = findKeypoint(rawKeypoints, 'left_ear');
  const rightEar = findKeypoint(rawKeypoints, 'right_ear');
  const leftShoulder = findKeypoint(rawKeypoints, 'left_shoulder');
  const rightShoulder = findKeypoint(rawKeypoints, 'right_shoulder');
  const leftHip = findKeypoint(rawKeypoints, 'left_hip');
  const rightHip = findKeypoint(rawKeypoints, 'right_hip');

  // Check if essential keypoints are present and confident enough
  const essentialDeskKPs = [nose, leftShoulder, rightShoulder, leftHip, rightHip];
  const allEssentialKPsPresent = essentialDeskKPs.every(kp => kp && kp.score > minConfidence);

  if (!allEssentialKPsPresent) {
    issues.push("Insufficient keypoints detected for desk posture evaluation. Ensure upper body is visible.");
    
    return issues;
  }

  // Rule 1: Neck bend (angle between ear/nose, shoulder, and hip)
  // We can approximate neck bend by looking at the angle formed by (ear - shoulder - hip).
  // A straight posture would have this angle close to 180 degrees.
  // If the head is bent forward, the angle will be smaller.
  const neckAngleLeft = calculateAngle(leftEar || nose, leftShoulder, leftHip);
  const neckAngleRight = calculateAngle(rightEar || nose, rightShoulder, rightHip);

  // If neck angle is less than 150 degrees (meaning it's bent more than 30 degrees from straight)
  if (neckAngleLeft < 150 || neckAngleRight < 150) {
    issues.push(`Neck bent forward (>30° estimated). Angles: ${neckAngleLeft.toFixed(0)}° / ${neckAngleRight.toFixed(0)}°`);
  }

  // Rule 2: Back isn't straight (angle between shoulder, hip, and a lower point like knee/ankle if available, or just vertical alignment)
  // For desk sitting, we primarily look at the spine's straightness.
  // Angle at the hip: (shoulder - hip - knee) or (shoulder - hip - vertical line)
  // Let's use shoulder-hip-knee if knees are visible, otherwise approximate vertical alignment.
  const leftSpineAngle = calculateAngle(leftShoulder, leftHip, leftHip.y + 0.1); // Using a point vertically below hip
  const rightSpineAngle = calculateAngle(rightShoulder, rightHip, rightHip.y + 0.1); // Using a point vertically below hip

  // If the spine angle is too far from 180 (e.g., less than 160 degrees), it indicates slouching.
  if (leftSpineAngle < 160 || rightSpineAngle < 160) {
    issues.push(`Back isn't straight (slouching detected). Angles: ${leftSpineAngle.toFixed(0)}° / ${rightSpineAngle.toFixed(0)}°`);
  }

  return issues;
}

// --- Socket.IO Connection Handling ---

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('keypointsData', (data) => {
    // data.keypoints is an array of keypoint objects from MoveNet
    // data.postureType is 'squat' or 'desk'

    const { keypoints, postureType } = data;

    let postureIssues = [];
    if (postureType === 'squat') {
      postureIssues = evaluateSquatPosture(keypoints);
    } else if (postureType === 'desk') {
      postureIssues = evaluateDeskSittingPosture(keypoints);
    } else {
      postureIssues.push("Unknown posture type.");
    }

    // Send feedback back to the client, including the keypoints for visualization
    socket.emit('postureFeedback', {
      timestamp: Date.now(),
      issues: postureIssues,
      keypoints: keypoints // Send the actual keypoints received for drawing
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Basic route for testing server status
app.get('/', (req, res) => {
  res.send('Posture Detection Backend is running!');
});

server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});

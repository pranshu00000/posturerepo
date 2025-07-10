const { findKeypoint, calculateAngle } = require('../utils/postureUtils');

function evaluateSquatPosture(keypoints) {
  const issues = [];
  const minConfidence = 0.2;

  const kps = {
    leftShoulder: findKeypoint(keypoints, 'left_shoulder'),
    rightShoulder: findKeypoint(keypoints, 'right_shoulder'),
    leftHip: findKeypoint(keypoints, 'left_hip'),
    rightHip: findKeypoint(keypoints, 'right_hip'),
    leftKnee: findKeypoint(keypoints, 'left_knee'),
    rightKnee: findKeypoint(keypoints, 'right_knee'),
    leftAnkle: findKeypoint(keypoints, 'left_ankle'),
    rightAnkle: findKeypoint(keypoints, 'right_ankle'),
  };

  const allPresent = Object.values(kps).every(kp => kp && kp.score > minConfidence);
  if (!allPresent) {
    issues.push("Insufficient keypoints detected for squat evaluation. Ensure full body is visible.");
    return issues;
  }

  if (kps.leftKnee.x < kps.leftAnkle.x) issues.push("Left knee over toe.");
  if (kps.rightKnee.x > kps.rightAnkle.x) issues.push("Right knee over toe.");

  const leftAngle = calculateAngle(kps.leftShoulder, kps.leftHip, kps.leftKnee);
  const rightAngle = calculateAngle(kps.rightShoulder, kps.rightHip, kps.rightKnee);
  if (leftAngle < 150 || rightAngle < 150) {
    issues.push(`Hunched back detected (Back angle: ${leftAngle.toFixed(0)}° / ${rightAngle.toFixed(0)}°).`);
  }

  return issues;
}

function evaluateDeskSittingPosture(keypoints) {
  const issues = [];
  const minConfidence = 0.5;

  const kps = {
    nose: findKeypoint(keypoints, 'nose'),
    leftEar: findKeypoint(keypoints, 'left_ear'),
    rightEar: findKeypoint(keypoints, 'right_ear'),
    leftShoulder: findKeypoint(keypoints, 'left_shoulder'),
    rightShoulder: findKeypoint(keypoints, 'right_shoulder'),
    leftHip: findKeypoint(keypoints, 'left_hip'),
    rightHip: findKeypoint(keypoints, 'right_hip'),
  };

  const allPresent = ['nose', 'leftShoulder', 'rightShoulder', 'leftHip', 'rightHip'].every(k => kps[k] && kps[k].score > minConfidence);
  if (!allPresent) {
    issues.push("Insufficient keypoints detected for desk posture evaluation. Ensure upper body is visible.");
    return issues;
  }

  const neckLeft = calculateAngle(kps.leftEar || kps.nose, kps.leftShoulder, kps.leftHip);
  const neckRight = calculateAngle(kps.rightEar || kps.nose, kps.rightShoulder, kps.rightHip);
  if (neckLeft < 150 || neckRight < 150) {
    issues.push(`Neck bent forward (>30° estimated). Angles: ${neckLeft.toFixed(0)}° / ${neckRight.toFixed(0)}°`);
  }

  const spineLeft = calculateAngle(kps.leftShoulder, kps.leftHip, { x: kps.leftHip.x, y: kps.leftHip.y + 0.1 });
  const spineRight = calculateAngle(kps.rightShoulder, kps.rightHip, { x: kps.rightHip.x, y: kps.rightHip.y + 0.1 });
  if (spineLeft < 160 || spineRight < 160) {
    issues.push(`Back isn't straight (slouching detected). Angles: ${spineLeft.toFixed(0)}° / ${spineRight.toFixed(0)}°`);
  }

  return issues;
}

module.exports = { evaluateSquatPosture, evaluateDeskSittingPosture };

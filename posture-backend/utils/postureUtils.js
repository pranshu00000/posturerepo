function findKeypoint(keypoints, name) {
  return keypoints.find(kp => kp.name === name) || null;
}

function calculateAngle(p1, p2, p3) {
  if (!p1 || !p2 || !p3 || p1.x == null || p1.y == null || p2.x == null || p2.y == null || p3.x == null || p3.y == null) return 0;

  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  const dotProduct = v1.x * v2.x + v1.y * v2.y;
  const magnitude1 = Math.hypot(v1.x, v1.y);
  const magnitude2 = Math.hypot(v2.x, v2.y);

  if (magnitude1 === 0 || magnitude2 === 0) return 0;

  const angleRad = Math.acos(Math.min(Math.max(dotProduct / (magnitude1 * magnitude2), -1), 1));
  return angleRad * (180 / Math.PI);
}

module.exports = { findKeypoint, calculateAngle };

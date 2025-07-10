import React, { useState, useRef, useEffect, useCallback } from "react";
import io from "socket.io-client";
import Webcam from "react-webcam";
import {
  PlayIcon,
  StopIcon,
  CameraIcon,
  ArrowUpTrayIcon,
  ComputerDesktopIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/solid";


import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";


const socket = io("https://posturerepo.onrender.com/"); 

function App() {
  const videoRef = useRef(null); 
  const canvasRef = useRef(null); 
  const webcamRef = useRef(null); 

  const [isCapturing, setIsCapturing] = useState(false);
  const [postureFeedback, setPostureFeedback] = useState([]);
  const [currentVideoFile, setCurrentVideoFile] = useState(null);
  const [useWebcam, setUseWebcam] = useState(false);
  const [postureType, setPostureType] = useState("squat");
  const [model, setModel] = useState(null); 
  const [modelLoading, setModelLoading] = useState(true); 

  const captureInterval = useRef(null); 


  useEffect(() => {
    async function loadModel() {
  try {
    setModelLoading(true);

    await tf.setBackend('webgl'); 
    await tf.ready(); 

    const loadedModel = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
      }
    );

    setModel(loadedModel);
    console.log('MoveNet model loaded successfully!');
  } catch (error) {
    console.error('Failed to load MoveNet model:', error);
    setPostureFeedback(['Error: Failed to load AI model. Please check console.']);
  } finally {
    setModelLoading(false);
  }
}

    loadModel();
  }, []); 

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to backend Socket.IO");
    });

    socket.on("postureFeedback", (data) => {
      console.log("Received feedback:", data);
      setPostureFeedback(data.issues);
      drawKeypoints(data.keypoints);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from backend Socket.IO");
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    return () => {
      socket.off("connect");
      socket.off("postureFeedback");
      socket.off("disconnect");
      socket.off("error");
      stopCapture(); 
    };
  }, []);

  const drawKeypoints = useCallback(
    (keypoints) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const video = useWebcam ? webcamRef.current?.video : videoRef.current;

      if (!video || video.paused || video.ended || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);


      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "red";
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;

      keypoints.forEach((kp) => {
        if (kp.score > 0.3) {
          ctx.beginPath();
          ctx.arc(kp.x * canvas.width, kp.y * canvas.height, 5, 0, 2 * Math.PI); 
          ctx.fill();
        }
      });

      const connections = [
        ["left_shoulder", "right_shoulder"],
        ["left_shoulder", "left_elbow"],
        ["left_elbow", "left_wrist"],
        ["right_shoulder", "right_elbow"],
        ["right_elbow", "right_wrist"],
        ["left_shoulder", "left_hip"],
        ["right_shoulder", "right_hip"],
        ["left_hip", "right_hip"],
        ["left_hip", "left_knee"],
        ["left_knee", "left_ankle"],
        ["right_hip", "right_knee"],
        ["right_knee", "right_ankle"],
        ["nose", "left_eye"],
        ["left_eye", "left_ear"],
        ["nose", "right_eye"],
        ["right_eye", "right_ear"],
        ["left_shoulder", "nose"],
        ["right_shoulder", "nose"],
      ];

      connections.forEach(([p1Name, p2Name]) => {
        const p1 = keypoints.find((kp) => kp.name === p1Name);
        const p2 = keypoints.find((kp) => kp.name === p2Name);

        if (p1 && p2 && p1.score > 0.3 && p2.score > 0.3) {
          ctx.beginPath();
          ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
          ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
          ctx.stroke();
        }
      });
    },
    [useWebcam]
  );

  const processFrame = useCallback(async () => {
    if (!model) {
      console.warn("MoveNet model not loaded yet.");
      return;
    }

    const video = useWebcam ? webcamRef.current?.video : videoRef.current;
    const canvas = canvasRef.current;

    if (!video || video.paused || video.ended || !canvas) {
      return;
    }

    canvas.width = video.videoWidth || video.offsetWidth;
    canvas.height = video.videoHeight || video.offsetHeight;

    if (canvas.width === 0 || canvas.height === 0) {
      console.warn("Canvas dimensions are zero. Skipping frame processing.");
      return;
    }

    const imageTensor = tf.browser.fromPixels(video);

    try {
      const poses = await model.estimatePoses(imageTensor);

if (poses && poses.length > 0 && poses[0].keypoints) {
  const keypoints = poses[0].keypoints;
  socket.emit('keypointsData', { keypoints, postureType: postureType });
}

    } catch (error) {
      console.error("Error estimating pose:", error);
      setPostureFeedback((prev) => [
        ...prev,
        "Error processing video frame for pose detection.",
      ]);
    } finally {
      imageTensor.dispose();
    }
  }, [model, useWebcam, postureType]);

  const startCapture = useCallback(() => {
    if (isCapturing || modelLoading || !model) return; 
    setIsCapturing(true);
    setPostureFeedback([]); 

    captureInterval.current = setInterval(processFrame, 1000);

    if (videoRef.current && currentVideoFile && !useWebcam) {
      videoRef.current.play();
    }
  }, [
    isCapturing,
    modelLoading,
    model,
    processFrame,
    currentVideoFile,
    useWebcam,
  ]);

  const stopCapture = useCallback(() => {
    setIsCapturing(false);
    if (captureInterval.current) {
      clearInterval(captureInterval.current);
      captureInterval.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setPostureFeedback([]); 
  }, []);

  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setCurrentVideoFile(URL.createObjectURL(file));
      setUseWebcam(false); 
      stopCapture(); 
    }
  };

  const toggleWebcam = () => {
    setUseWebcam((prev) => !prev);
    setCurrentVideoFile(null); 
    stopCapture(); 
  };

  const handleVideoCanPlay = () => {
    const videoElement = useWebcam ? webcamRef.current.video : videoRef.current;
    if (videoElement && canvasRef.current) {
      canvasRef.current.width = videoElement.videoWidth;
      canvasRef.current.height = videoElement.videoHeight;
    }
  };
  const parseAngleFeedback = (feedback) => {
  const angleRegex = /Angles:\s*([\d.]+)°\s*\/\s*([\d.]+)°/;
  const match = feedback.match(angleRegex);
  if (!match) return null;
  const left = parseFloat(match[1]);
  const right = parseFloat(match[2]);
  return { left, right };
};


  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 px-4 font-inter">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">
        Posture Detection App
      </h1>

      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl mb-8">
        <div className="flex justify-center items-center space-x-4 mb-6">
          <label className="flex items-center space-x-2 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out">
            <ArrowUpTrayIcon className="h-5 w-5" />
            <span>Upload Video</span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoUpload}
            />
          </label>
          <button
            onClick={toggleWebcam}
            className={`flex items-center space-x-2 font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out ${
              useWebcam
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            <CameraIcon className="h-5 w-5" />
            <span>{useWebcam ? "Disable Webcam" : "Use Webcam"}</span>
          </button>
        </div>

        <div className="flex justify-center space-x-4 mb-6">
          <button
            onClick={() => setPostureType("squat")}
            className={`flex items-center space-x-2 font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out ${
              postureType === "squat"
                ? "bg-purple-600 text-white"
                : "bg-gray-300 text-gray-700 hover:bg-gray-400"
            }`}
          >
            <AcademicCapIcon className="h-5 w-5" />
            <span>Squat Posture</span>
          </button>
          <button
            onClick={() => setPostureType("desk")}
            className={`flex items-center space-x-2 font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out ${
              postureType === "desk"
                ? "bg-purple-600 text-white"
                : "bg-gray-300 text-gray-700 hover:bg-gray-400"
            }`}
          >
            <ComputerDesktopIcon className="h-5 w-5" />
            <span>Desk Sitting Posture</span>
          </button>
        </div>

        <div className="relative w-full aspect-video bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center mb-6">
          {modelLoading && (
            <p className="text-white text-xl animate-pulse">
              Loading AI Model...
            </p>
          )}
          {!modelLoading && (
            <>
              {useWebcam ? (
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user" }}
                  className="absolute inset-0 w-full h-full object-contain"
                  onPlay={handleVideoCanPlay} 
                />
              ) : (
                currentVideoFile && (
                  <video
                    ref={videoRef}
                    src={currentVideoFile}
                    controls
                    loop
                    muted 
                    className="absolute inset-0 w-full h-full object-contain"
                    onLoadedMetadata={handleVideoCanPlay} 
                  />
                )
              )}
              {!useWebcam && !currentVideoFile && !modelLoading && (
                <p className="text-gray-400 text-lg">
                  Upload a video or enable webcam to start.
                </p>
              )}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
                style={{ zIndex: 10 }}
              ></canvas>
            </>
          )}
        </div>

        <div className="flex justify-center space-x-4 mb-6">
          <button
            onClick={startCapture}
            disabled={
              isCapturing ||
              modelLoading ||
              !model ||
              (!currentVideoFile && !useWebcam)
            }
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayIcon className="h-6 w-6" />
            <span>Start Analysis</span>
          </button>
          <button
            onClick={stopCapture}
            disabled={!isCapturing}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <StopIcon className="h-6 w-6" />
            <span>Stop Analysis</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          Posture Feedback
        </h2>
        {postureFeedback.length > 0 ? (
  <ul className="list-disc list-inside text-lg">
  {postureFeedback.map((issue, index) => {
    const angles = parseAngleFeedback(issue);

    return (
      <li
        key={index}
        className={`mb-2 ${
          issue.toLowerCase().includes("detected") ||
          issue.toLowerCase().includes("over toe") ||
          issue.toLowerCase().includes("bent") ||
          issue.toLowerCase().includes("slouch") ||
          issue.toLowerCase().includes("insufficient")
            ? "text-red-600"
            : "text-green-600"
        }`}
      >
        {issue}
        {angles && (
          <div className="flex gap-2 mt-1 ml-4">
            <span
              className={`text-sm px-2 py-1 rounded-full font-semibold ${
                angles.left >= 150 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
            >
              Left: {angles.left}°
            </span>
            <span
              className={`text-sm px-2 py-1 rounded-full font-semibold ${
                angles.right >= 150 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
            >
              Right: {angles.right}°
            </span>
          </div>
        )}
      </li>
    );
  })}
</ul>

) : (
  <p className="text-green-600 text-lg">Waiting to start analysis</p>
)}

      </div>
    </div>
  );
}

export default App;

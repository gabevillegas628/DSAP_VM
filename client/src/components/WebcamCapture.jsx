// WebcamCapture.jsx - Without the sniper crosshairs
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, RotateCcw, Check, AlertCircle, Move, ZoomIn, ZoomOut } from 'lucide-react';

const WebcamCapture = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const cropImageRef = useRef(null);
  const cropContainerRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [baseImageSize, setBaseImageSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);

  // Circle size as a percentage of the smaller container dimension
  const CIRCLE_SIZE_PERCENT = 0.65;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3.0;
  const ZOOM_STEP = 0.2;

  // Calculate actual image size including zoom
  const imageSize = {
    width: baseImageSize.width * zoom,
    height: baseImageSize.height * zoom
  };

  const initializeCamera = useCallback(async () => {
    if (!isOpen) return;
    
    try {
      //console.log('Starting camera initialization...');
      setCameraStarted(false);
      setError(null);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      //console.log('Got media stream:', mediaStream);
      setStream(mediaStream);

      await new Promise(resolve => setTimeout(resolve, 100));

      if (videoRef.current) {
        //console.log('Setting up video element...');
        const video = videoRef.current;
        
        video.srcObject = mediaStream;
        video.play().then(() => {
          //console.log('Video playing successfully');
          setCameraStarted(true);
        }).catch(err => {
          console.log('Play failed, but continuing:', err);
          setCameraStarted(true);
        });
      }

    } catch (error) {
      console.error('Camera initialization failed:', error);
      setError(`Failed to start camera: ${error.message}`);
    }
  }, [isOpen]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraStarted(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video dimensions are 0, cannot capture');
      setError('Camera not ready, please wait and try again');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame (mirrored)
    context.scale(-1, 1);
    context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    context.setTransform(1, 0, 0, 1, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage(imageUrl);
        setShowCrop(true);
        setZoom(1); // Reset zoom when taking new photo
        
        // Set up the crop interface
        setTimeout(() => {
          if (cropImageRef.current && cropContainerRef.current) {
            const container = cropContainerRef.current.getBoundingClientRect();
            const img = cropImageRef.current;
            
            // Store container dimensions
            setContainerSize({ width: container.width, height: container.height });
            
            // Calculate the circle size
            const minDimension = Math.min(container.width, container.height);
            const circleSize = minDimension * CIRCLE_SIZE_PERCENT;
            
            // Scale image to be larger than the circle for better cropping control
            const minImageSize = circleSize * 1.2; // Make image 1.2x circle size minimum
            const scale = Math.max(
              minImageSize / img.naturalWidth, 
              minImageSize / img.naturalHeight,
              container.width / img.naturalWidth * 0.8, // Don't make it too big initially
              container.height / img.naturalHeight * 0.8
            );
            
            const scaledWidth = img.naturalWidth * scale;
            const scaledHeight = img.naturalHeight * scale;
            
            setBaseImageSize({ width: scaledWidth, height: scaledHeight });
            
            // Center the image
            setImagePosition({ 
              x: (container.width - scaledWidth) / 2,
              y: (container.height - scaledHeight) / 2
            });
          }
        }, 100);
      } else {
        setError('Failed to capture image, please try again');
      }
    }, 'image/jpeg', 0.9);
  }, []);

  const retakePhoto = useCallback(() => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setShowCrop(false);
    setError(null);
    setImagePosition({ x: 0, y: 0 });
    setZoom(1);
    
    if (videoRef.current && stream) {
      const video = videoRef.current;
      if (video.paused || video.ended) {
        //console.log('Video was paused, restarting...');
        video.srcObject = stream;
        video.play().catch(err => {
          console.log('Error restarting video:', err);
        });
      }
    }
  }, [stream, capturedImage]);

  // Zoom functions
  const zoomIn = useCallback(() => {
    if (!cropContainerRef.current) return;
    
    const newZoom = Math.min(zoom + ZOOM_STEP, MAX_ZOOM);
    if (newZoom === zoom) return;
    
    // Calculate the center point of the container
    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;
    
    // Calculate how much the image will grow
    const zoomRatio = newZoom / zoom;
    
    // Adjust position to keep the center point stable
    const newX = centerX - (centerX - imagePosition.x) * zoomRatio;
    const newY = centerY - (centerY - imagePosition.y) * zoomRatio;
    
    setZoom(newZoom);
    setImagePosition({ x: newX, y: newY });
  }, [zoom, imagePosition, containerSize]);

  const zoomOut = useCallback(() => {
    if (!cropContainerRef.current) return;
    
    const newZoom = Math.max(zoom - ZOOM_STEP, MIN_ZOOM);
    if (newZoom === zoom) return;
    
    // Calculate the center point of the container
    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;
    
    // Calculate how much the image will shrink
    const zoomRatio = newZoom / zoom;
    
    // Adjust position to keep the center point stable
    const newX = centerX - (centerX - imagePosition.x) * zoomRatio;
    const newY = centerY - (centerY - imagePosition.y) * zoomRatio;
    
    setZoom(newZoom);
    setImagePosition({ x: newX, y: newY });
  }, [zoom, imagePosition, containerSize]);

  // Handle mouse/touch events for dragging
  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Get the container's position to calculate relative coordinates
    const containerRect = cropContainerRef.current.getBoundingClientRect();
    const relativeX = clientX - containerRect.left;
    const relativeY = clientY - containerRect.top;
    
    setDragStart({ 
      x: relativeX - imagePosition.x, 
      y: relativeY - imagePosition.y 
    });
  }, [imagePosition]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !cropContainerRef.current) return;
    
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Get the container's position
    const containerRect = cropContainerRef.current.getBoundingClientRect();
    const relativeX = clientX - containerRect.left;
    const relativeY = clientY - containerRect.top;
    
    const newX = relativeX - dragStart.x;
    const newY = relativeY - dragStart.y;
    
    setImagePosition({ x: newX, y: newY });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add event listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove, { passive: false });
      document.addEventListener('touchend', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleMouseMove);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const confirmPhoto = () => {
    if (!cropCanvasRef.current || !cropImageRef.current) return;
    
    const canvas = cropCanvasRef.current;
    const context = canvas.getContext('2d');
    const img = cropImageRef.current;
    
    // Set canvas size to desired output size (square)
    const outputSize = 400;
    canvas.width = outputSize;
    canvas.height = outputSize;
    
    // Calculate the circle dimensions in the container
    const minDimension = Math.min(containerSize.width, containerSize.height);
    const circleRadius = (minDimension * CIRCLE_SIZE_PERCENT) / 2;
    const circleCenterX = containerSize.width / 2;
    const circleCenterY = containerSize.height / 2;
    
    // Calculate scale from display to actual image coordinates (including zoom)
    const scaleX = img.naturalWidth / imageSize.width;
    const scaleY = img.naturalHeight / imageSize.height;
    
    // Calculate the crop area in the original image coordinates
    const cropCenterX = (circleCenterX - imagePosition.x) * scaleX;
    const cropCenterY = (circleCenterY - imagePosition.y) * scaleY;
    const cropRadius = circleRadius * scaleX;
    
    // Source rectangle (square that contains the circle)
    const sourceX = cropCenterX - cropRadius;
    const sourceY = cropCenterY - cropRadius;
    const sourceSize = cropRadius * 2;
    
    /*
    console.log('Crop details:', {
      zoom,
      circleRadius,
      circleCenterX, circleCenterY,
      imagePosition,
      imageSize,
      scaleX, scaleY,
      cropCenterX, cropCenterY, cropRadius,
      sourceX, sourceY, sourceSize
    });
    */
    
    // Create circular clipping path
    context.beginPath();
    context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    context.clip();
    
    // Draw the cropped portion
    context.drawImage(
      img,
      sourceX, sourceY, sourceSize, sourceSize, // source rectangle
      0, 0, outputSize, outputSize // destination rectangle
    );
    
    canvas.toBlob((blob) => {
      const file = new File([blob], `webcam-capture-${Date.now()}.jpg`, {
        type: 'image/jpeg'
      });
      onCapture(file);
      handleClose();
    }, 'image/jpeg', 0.9);
  };

  const handleClose = () => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    stopCamera();
    setCapturedImage(null);
    setShowCrop(false);
    setError(null);
    setImagePosition({ x: 0, y: 0 });
    setZoom(1);
    onClose();
  };

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      initializeCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, initializeCamera]);

  // Video ref callback
  const videoRefCallback = useCallback((element) => {
    videoRef.current = element;
    if (element && stream && !cameraStarted) {
      //console.log('Video element mounted, setting stream...');
      element.srcObject = stream;
      element.play().catch(console.log);
      setCameraStarted(true);
    }
  }, [stream, cameraStarted]);

  // Effect to ensure video keeps playing when switching back from captured image
  useEffect(() => {
    if (!capturedImage && videoRef.current && stream && cameraStarted) {
      const video = videoRef.current;
      if (video.paused || video.videoWidth === 0) {
        //console.log('Restoring video after retake...');
        video.srcObject = stream;
        video.play().catch(console.log);
      }
    }
  }, [capturedImage, stream, cameraStarted]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {showCrop ? 'Position Your Photo' : 'Take Profile Picture'}
          </h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700 text-sm">{error}</span>
            <button
              onClick={initializeCamera}
              className="ml-auto px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {showCrop && (
          <div className="mb-4 space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <Move className="w-4 h-4 text-blue-600" />
                <span className="text-blue-700 text-sm">Drag the image to position your face in the circle</span>
              </div>
            </div>
            
            {/* Zoom controls */}
            <div className="flex items-center justify-center space-x-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <button
                onClick={zoomOut}
                disabled={zoom <= MIN_ZOOM}
                className="flex items-center justify-center w-10 h-10 bg-gray-600 text-white rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 min-w-[3rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
              </div>
              
              <button
                onClick={zoomIn}
                disabled={zoom >= MAX_ZOOM}
                className="flex items-center justify-center w-10 h-10 bg-gray-600 text-white rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          {showCrop ? (
            // Crop interface
            <div 
              ref={cropContainerRef}
              className="relative w-full aspect-video bg-gray-800 overflow-hidden cursor-move"
              style={{ touchAction: 'none' }}
            >
              <img
                ref={cropImageRef}
                src={capturedImage}
                alt="Captured"
                className="absolute select-none"
                style={{
                  width: `${imageSize.width}px`,
                  height: `${imageSize.height}px`,
                  left: `${imagePosition.x}px`,
                  top: `${imagePosition.y}px`,
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
                draggable={false}
              />
              
              {/* Circular overlay for cropping */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div 
                  className="border-4 border-white rounded-full shadow-lg"
                  style={{
                    width: `${Math.min(containerSize.width, containerSize.height) * CIRCLE_SIZE_PERCENT}px`,
                    height: `${Math.min(containerSize.width, containerSize.height) * CIRCLE_SIZE_PERCENT}px`,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                  }}
                />
              </div>
            </div>
          ) : capturedImage ? (
            <img src={capturedImage} alt="Captured" className="w-full aspect-video object-cover" />
          ) : (
            <>
              <video
                ref={videoRefCallback}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video object-cover bg-gray-800"
                style={{ transform: 'scaleX(-1)' }}
              />
              {!cameraStarted && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                  <span className="text-white text-sm">Loading camera...</span>
                </div>
              )}
            </>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
          <canvas ref={cropCanvasRef} className="hidden" />
        </div>

        <div className="flex justify-center space-x-4 mt-4">
          {capturedImage ? (
            <>
              <button
                onClick={retakePhoto}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retake</span>
              </button>
              <button
                onClick={confirmPhoto}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Check className="w-4 h-4" />
                <span>{showCrop ? 'Crop & Use' : 'Use Photo'}</span>
              </button>
            </>
          ) : (
            <button
              onClick={capturePhoto}
              disabled={!cameraStarted}
              className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Camera className="w-5 h-5" />
              <span>Take Photo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebcamCapture;
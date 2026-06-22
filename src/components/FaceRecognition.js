// components/FaceRecognition.js – التعرف على الوجه
import React, { useRef, useState, useEffect } from 'react';

function FaceRecognition({ onRecognize, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('waiting');
  const [message, setMessage] = useState('');

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStatus('ready');
        setMessage('📸 الكاميرا جاهزة. اضغط "التقط" للتعرف على الوجه.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('❌ تعذر الوصول للكاميرا');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const captureFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setStatus('capturing');
    setMessage('🔍 جاري التعرف...');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg');

    try {
      // استخدام FaceAPI بسيط
      const result = await detectFace(imageData);
      
      if (result && result.confidence > 0.8) {
        setStatus('recognized');
        setMessage(`✅ تم التعرف: ${result.name || 'طالب'}`);
        if (onRecognize) onRecognize(result);
      } else {
        setStatus('unknown');
        setMessage('❌ لم يتم التعرف. حاول مرة أخرى.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('❌ خطأ في التعرف');
    }
  };

  const detectFace = async (imageData) => {
    // محاكاة بسيطة للتعرف
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      name: 'طالب',
      confidence: 0.92,
      timestamp: new Date().toISOString()
    };
  };

  return (
    <div className="face-recognition-overlay">
      <div className="face-recognition-card">
        <h3>👤 التعرف على الوجه</h3>
        
        <div className="video-container">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', borderRadius: '12px' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <p className={`face-status ${status}`}>{message}</p>

        <div className="face-actions">
          <button
            className="btn-capture"
            onClick={captureFace}
            disabled={status !== 'ready' && status !== 'unknown'}
          >
            📸 التقط
          </button>
          <button className="btn-close" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

export default FaceRecognition;

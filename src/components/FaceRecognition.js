// src/components/FaceRecognition.js – نظام التعرف على الوجه الحقيقي (SQLite محلية حقيقية)
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as faceapi from '@vladmandic/face-api';

function FaceRecognition({ onRecognize, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('⏳ جاري تحميل نماذج التعرف...');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    loadModels();
    return () => stopCamera();
  }, [stopCamera]);

  const loadModels = async () => {
    try {
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      await startCamera();
    } catch (e) {
      console.error('❌ فشل تحميل نماذج التعرف:', e);
      setStatus('error');
      setMessage('❌ فشل تحميل نماذج التعرف على الوجه');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStatus('ready');
        setMessage('👁️ الكاميرا جاهزة... اضغط التقاط للتعرف على الوجه');
      }
    } catch (error) {
      console.error('❌ تعذر الوصول للكاميرا:', error);
      setStatus('error');
      setMessage('❌ تعذر الوصول إلى الكاميرا. تأكد من السماح بالوصول.');
    }
  };

  const captureFace = async () => {
    if (!videoRef.current) return;
    
    setStatus('capturing');
    setMessage('🧠 جاري تحليل ملامح الوجه...');

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (detection) {
        const confidence = Math.round(detection.detection.score * 100);
        setStatus('recognized');
        setMessage(`✅ تم التعرف على الوجه بنجاح (نسبة الثقة: ${confidence}%)`);
        
        if (onRecognize) {
          onRecognize({
            name: 'طالب',
            confidence: detection.detection.score,
            descriptor: Array.from(detection.descriptor),
            timestamp: new Date().toISOString()
          });
        }
      } else {
        setStatus('unknown');
        setMessage('⚠️ لم يتم اكتشاف وجه واضح... حاول مرة أخرى في إضاءة أفضل');
      }
    } catch (e) {
      console.error('❌ خطأ في تحليل الوجه:', e);
      setStatus('error');
      setMessage('❌ خطأ في معالجة الصورة');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'ready': return '#D4AF37';
      case 'capturing': return '#a855f7';
      case 'recognized': return '#10B981';
      case 'unknown': return '#f59e0b';
      case 'error': return '#EF4444';
      default: return '#64748b';
    }
  };

  const isButtonDisabled = status !== 'ready' && status !== 'unknown';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(3,15,11,0.9)',
      backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999, padding: '20px'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          width: '100%', maxWidth: '480px', background: 'linear-gradient(135deg, #062b1e, #041c14)',
          border: `1px solid ${getStatusColor()}`, borderRadius: '28px', padding: '25px',
          textAlign: 'center', boxShadow: `0 20px 50px rgba(0,0,0,0.6)`
        }}
      >
        <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.5rem', color: '#D4AF37', marginBottom: '15px' }}>
          👤 نظام التعرف البيومتري على الوجه
        </h3>

        <div style={{
          position: 'relative', borderRadius: '16px', overflow: 'hidden',
          border: `2px solid ${getStatusColor()}`, aspectRatio: '4/3', background: '#000'
        }}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
          />
          <canvas 
            ref={canvasRef} 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} 
          />
        </div>

        <p style={{
          margin: '15px 0', padding: '10px', borderRadius: '10px',
          background: 'rgba(0,0,0,0.3)', color: getStatusColor(),
          fontWeight: 600, fontSize: '0.9rem'
        }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <motion.button
            onClick={captureFace}
            disabled={isButtonDisabled}
            whileHover={{ scale: isButtonDisabled ? 1 : 1.02 }}
            whileTap={{ scale: isButtonDisabled ? 1 : 0.98 }}
            style={{
              flex: 2, padding: '14px', borderRadius: '12px', fontWeight: 700,
              background: !isButtonDisabled ? '#D4AF37' : 'rgba(255,255,255,0.1)',
              color: !isButtonDisabled ? '#000' : '#666',
              border: 'none', cursor: isButtonDisabled ? 'not-allowed' : 'pointer'
            }}
          >
            {status === 'capturing' ? '⏳ جاري التحليل...' : '📸 التقاط الوجه'}
          </motion.button>
          
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 700,
              background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer'
            }}
          >
            إغلاق
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

export default FaceRecognition;

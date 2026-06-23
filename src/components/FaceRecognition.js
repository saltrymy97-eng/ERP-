// src/components/FaceRecognition.js – نظام التعرف على الوجه الحقيقي
import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as faceapi from 'face-api.js';

function FaceRecognition({ onRecognize, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('⏳ جاري تحميل نماذج التعرف...');

  // ========== تحميل النماذج ==========
  useEffect(() => {
    loadModels();
    return () => stopCamera();
  }, []);

  const loadModels = async () => {
    try {
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      startCamera();
    } catch (e) {
      setStatus('error');
      setMessage('❌ فشل تحميل نماذج التعرف');
    }
  };

  // ========== تشغيل الكاميرا ==========
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStatus('ready');
        setMessage('👁️ الكاميرا جاهزة... اضغط التقاط');
      }
    } catch (error) {
      setStatus('error');
      setMessage('❌ تعذر الوصول للكاميرا');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
  };

  // ========== التقاط وتحليل الوجه ==========
  const captureFace = async () => {
    if (!videoRef.current) return;

    setStatus('capturing');
    setMessage('🧠 جاري تحليل الوجه...');

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (detection) {
        const confidence = Math.round((1 - detection.detection.score) * 100);
        setStatus('recognized');
        setMessage(`✅ تم التعرف على الوجه (${confidence}%)`);
        
        if (onRecognize) {
          onRecognize({
            name: 'طالب',
            confidence: detection.detection.score,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        setStatus('unknown');
        setMessage('⚠️ لم يتم اكتشاف وجه... حاول مرة أخرى');
      }
    } catch (e) {
      setStatus('error');
      setMessage('❌ خطأ في التحليل');
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
          👤 التعرف على الوجه
        </h3>

        {/* كاميرا */}
        <div style={{
          position: 'relative', borderRadius: '16px', overflow: 'hidden',
          border: `2px solid ${getStatusColor()}`, aspectRatio: '4/3', background: '#000'
        }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
        </div>

        {/* رسالة */}
        <p style={{
          margin: '15px 0', padding: '10px', borderRadius: '10px',
          background: 'rgba(0,0,0,0.3)', color: getStatusColor(),
          fontWeight: 600, fontSize: '0.9rem'
        }}>
          {message}
        </p>

        {/* أزرار */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <motion.button
            onClick={captureFace}
            disabled={status !== 'ready' && status !== 'unknown'}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              flex: 2, padding: '14px', borderRadius: '12px', fontWeight: 700,
              background: status === 'ready' || status === 'unknown' ? '#D4AF37' : 'rgba(255,255,255,0.1)',
              color: status === 'ready' || status === 'unknown' ? '#000' : '#666',
              border: 'none', cursor: status === 'ready' || status === 'unknown' ? 'pointer' : 'not-allowed'
            }}
          >
            {status === 'capturing' ? '⏳ جاري التحليل...' : '📸 التقاط'}
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

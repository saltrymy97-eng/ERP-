// src/components/VoiceChat.js – بوابة التفاعل الصوتي الذكي والتحليل النطقي المطور
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { startVoiceChat, stopVoiceRecognition } from '../services/ai';

function VoiceChat({ onClose }) {
  const [listening, setListening] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [status, setStatus] = useState('');
  const [currentStage, setCurrentStage] = useState('idle');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, status]);

  // تنظيف كامل عند إغلاق النافذة لمنع تعليق الميكروفون في الخلفية
  useEffect(() => {
    return () => {
      stopVoiceRecognition();
    };
  }, []);

  const handleVoiceChat = async () => {
    setListening(true);
    setCurrentStage('listening');
    setStatus('🎤 النظام في وضع الاستماع الميداني الفوري... تحدث الآن');

    // استدعاء المحرك الموحد والمضمون من ملف خدمات الـ AI
    const result = await startVoiceChat((isThinking) => {
      if (isThinking) {
        setCurrentStage('thinking');
        setStatus('🧠 جاري تحليل البصمة الصوتية واستنباط الرد الاستراتيجي...');
      }
    });

    // معالجة النتائج بعد انتهاء الاستدعاء والنطق التلقائي
    if (result.error) {
      setStatus(result.error);
      setCurrentStage('idle');
      setListening(false);
      return;
    }

    if (result.question && result.answer) {
      // إضافة السؤال والإجابة إلى شاشة المحادثة
      setConversation(prev => [
        ...prev, 
        { role: 'user', text: result.question },
        { role: 'assistant', text: result.answer }
      ]);
      
      setCurrentStage('speaking');
      setStatus('🔊 جاري توليد النطق ومحاكاة الصوت الرئوي المعتمد...');
      
      // العودة لحالة الاستعداد بعد إنهاء الحديث
      setTimeout(() => {
        setCurrentStage('idle');
        setStatus('');
        setListening(false);
      }, 3000);
    }
  };

  const handleStop = () => {
    stopVoiceRecognition();
    setListening(false);
    setCurrentStage('idle');
    setStatus('🔌 تم تعليق التقاط الإشارات النطقية');
  };

  return (
    <div className="voice-chat-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(3, 15, 10, 0.85)', backdropFilter: 'blur(16px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 180 }}
        className="voice-chat-card-lux" 
        style={{ background: 'linear-gradient(145deg, #052217, #02110b)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)', width: '100%', maxWidth: '580px', borderRadius: '24px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '4px', background: 'linear-gradient(90deg, transparent, #d6af37, transparent)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(214,175,55,0.1)', paddingBottom: '15px' }}>
          <div>
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: '#f3e1a0', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ animation: currentStage !== 'idle' ? 'pulse 1.5s infinite' : 'none' }}>🔮</span> مركز التفاعل الأكاديمي الصوتي الذكي
            </h3>
            <p style={{ color: '#a0aec0', fontSize: '0.82rem', margin: '4px 0 0 0' }}>تقنية معالجة اللغات الطبيعية والبث البيومتري المباشر للبيانات</p>
          </div>
          <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>✕</motion.button>
        </div>

        <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)', position: 'relative' }}>
          {currentStage === 'idle' && <span style={{ color: '#a0aec0', fontSize: '0.9rem', fontStyle: 'italic' }}>بوابة الاستشعار الصوتي بانتظار أمر التفعيل...</span>}
          
          <AnimatePresence>
            {currentStage !== 'idle' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {[...Array(12)].map((_, i) => {
                  let duration = 0.5 + Math.random() * 0.8;
                  let color = '#d6af37'; // Gold
                  if (currentStage === 'thinking') { color = '#34d399'; duration = 0.3; } // Emerald
                  if (currentStage === 'speaking') { color = '#10b981'; duration = 0.6; } // Bright Green
                  
                  return (
                    <motion.div
                      key={i}
                      animate={{ height: [12, 65, 12] }}
                      transition={{ repeat: Infinity, duration: duration, ease: 'easeInOut', delay: i * 0.05 }}
                      style={{ width: '4px', background: color, borderRadius: '50px' }}
                    />
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="voice-conversation-container" style={{ height: '220px', overflowY: 'auto', padding: '10px 5px', display: 'flex', flexDirection: 'column', gap: '15px', scrollbarWidth: 'thin' }}>
          <AnimatePresence>
            {conversation.map((msg, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-start' : 'flex-end',
                  width: '100%'
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: msg.role === 'user' ? '#d6af37' : '#34d399', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {msg.role === 'user' ? '👤 الهوية المفحوصة' : '🤖 موجه السيطرة الذكي'}
                </span>
                <div style={{
                  maxWidth: '85%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                  background: msg.role === 'user' ? 'rgba(214,175,55,0.06)' : 'rgba(16,185,129,0.05)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(214,175,55,0.15)' : 'rgba(16,185,129,0.15)'}`,
                  color: '#fff', fontSize: '0.92rem', lineHeight: '1.5', textAlign: 'right'
                }}>
                  <p style={{ margin: 0 }}>{msg.text}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {conversation.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#a0aec0', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem', opacity: 0.3 }}>🎙️</span>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>بانتظار استقبال الأوامر الصوتية للتدقيق والرد الصوتي المباشر</p>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <AnimatePresence>
          {status && (
            <motion.p 
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ margin: 0, fontSize: '0.85rem', color: currentStage === 'listening' ? '#d6af37' : currentStage === 'thinking' ? '#34d399' : '#10b981', textAlign: 'center', fontWeight: 600, background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}
            >
              {status}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="voice-actions-lux" style={{ display: 'flex', gap: '12px', marginTop: '5px' }}>
          <motion.button
            whileHover={{ y: -3, boxShadow: listening ? '0 10px 25px rgba(239,68,68,0.2)' : '0 10px 25px rgba(214,175,55,0.2)' }}
            whileTap={{ scale: 0.97 }}
            onClick={listening ? handleStop : handleVoiceChat}
            style={{
              flex: 3, padding: '14px', borderRadius: '14px', border: 'none',
              background: listening ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, #d6af37, #b89324)',
              color: listening ? '#fff' : '#062b1e',
              fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              transition: 'all 0.2s ease'
            }}
          >
            {listening ? (
              <>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
                إيقاف التقاط الإشارة
              </>
            ) : (
              <>🎤 فتح قناة البث والحديث المباشر</>
            )}
          </motion.button>
          
          <motion.button 
            whileHover={{ background: 'rgba(255,255,255,0.06)' }} whileTap={{ scale: 0.97 }}
            className="btn-close-lux" onClick={onClose} 
            style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', color: '#a0aec0', borderRadius: '14px', fontWeight: 700, cursor: 'pointer' }}
          >
            إغلاق النافذة
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

export default VoiceChat;

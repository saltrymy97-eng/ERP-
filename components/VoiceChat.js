// components/VoiceChat.js – محادثة صوتية كاملة
import React, { useState, useRef } from 'react';
import { askAI, speakText } from '../services/ai';

function VoiceChat({ onClose }) {
  const [listening, setListening] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [status, setStatus] = useState('');
  const recognitionRef = useRef(null);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setStatus('❌ متصفحك لا يدعم الصوت');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;

    recognition.onstart = () => {
      setListening(true);
      setStatus('🎤 جاري الاستماع...');
    };

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      
      setConversation(prev => [...prev, { role: 'user', text }]);
      setStatus('🧠 جاري التفكير...');

      const answer = await askAI(text);
      
      setConversation(prev => [...prev, { role: 'assistant', text: answer }]);
      setStatus('🔊 جاري الرد...');
      
      speakText(answer);
      setStatus('');
    };

    recognition.onerror = (event) => {
      setStatus('❌ خطأ في التسجيل');
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setStatus('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      setStatus('');
    }
  };

  return (
    <div className="voice-chat-overlay">
      <div className="voice-chat-card">
        <h3>🎤 المحادثة الصوتية</h3>
        <p>تحدث بالعربية... والنظام يرد عليك صوتياً</p>

        <div className="voice-conversation">
          {conversation.map((msg, i) => (
            <div key={i} className={`voice-message ${msg.role}`}>
              <span className="voice-role">
                {msg.role === 'user' ? '👤 أنت' : '🤖 المساعد'}
              </span>
              <p>{msg.text}</p>
            </div>
          ))}
          {conversation.length === 0 && (
            <p className="voice-hint">اضغط على الميكروفون وابدأ الحديث...</p>
          )}
        </div>

        {status && <p className="voice-status">{status}</p>}

        <div className="voice-actions">
          <button
            className={`btn-mic ${listening ? 'active' : ''}`}
            onClick={listening ? stopListening : startListening}
          >
            {listening ? '⏹️ إيقاف' : '🎤 تحدث'}
          </button>
          <button className="btn-close" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}

export default VoiceChat;

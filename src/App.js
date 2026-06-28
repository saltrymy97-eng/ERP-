// src/App.js – نظام الحضور والغياب الإمبراطوري الحركي (أيقونات 3D حقيقية + SQLite محلية + هيئة التدريس)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { initDatabase } from './services/db';
import { login, logout, restoreSession } from './services/auth';
import Dashboard from './components/Dashboard';
import Students from './components/Students';
import Attendance from './components/Attendance';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Teachers from './components/Teachers';
import './App.css';

// ========== مكون الأيقونة ثلاثية الأبعاد (Three.js) ==========
function Icon3D({ icon, color, glow, isActive }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const meshRef = useRef(null);
  const frameRef = useRef(null);

  const getGeometry = useCallback((type) => {
    switch (type) {
      case '📊': return { geo: 'box', detail: [1, 0.6, 0.1], bars: 3 };
      case '🖐️': return { geo: 'sphere', detail: [0.5, 32, 32] };
      case '🎓': return { geo: 'torus', detail: [0.4, 0.15, 16, 32] };
      case '👨‍🏫': return { geo: 'cone', detail: [0.4, 0.7, 32] };
      case '📄': return { geo: 'box', detail: [0.6, 0.8, 0.02] };
      case '🔔': return { geo: 'cone', detail: [0.3, 0.6, 32] };
      case '🖨️': return { geo: 'cylinder', detail: [0.35, 0.35, 0.5, 32] };
      case '📅': return { geo: 'box', detail: [0.65, 0.5, 0.05] };
      case '⚙️': return { geo: 'torus', detail: [0.35, 0.1, 8, 32] };
      default: return { geo: 'sphere', detail: [0.5, 32, 32] };
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const THREE = window.THREE;
    if (!THREE) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // مشهد
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // كاميرا
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10);
    camera.position.z = 2.5;
    cameraRef.current = camera;

    // عارض
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // إضاءة
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 2);
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(color, 1, 3);
    pointLight.position.set(0, 0.5, 1);
    scene.add(pointLight);

    // المجسم
    const config = getGeometry(icon);
    let mesh;

    switch (config.geo) {
      case 'box':
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(...config.detail),
          new THREE.MeshStandardMaterial({ color: color, metalness: 0.3, roughness: 0.4, emissive: color, emissiveIntensity: 0.2 })
        );
        if (config.bars) {
          const group = new THREE.Group();
          group.add(mesh);
          for (let i = 0; i < config.bars; i++) {
            const bar = new THREE.Mesh(
              new THREE.BoxGeometry(0.08, 0.15 + i * 0.12, 0.08),
              new THREE.MeshStandardMaterial({ color: color, metalness: 0.5, roughness: 0.3, emissive: color, emissiveIntensity: 0.4 })
            );
            bar.position.set(-0.2 + i * 0.2, -0.35, 0.06);
            group.add(bar);
          }
          mesh = group;
        }
        break;
      case 'sphere':
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(...config.detail),
          new THREE.MeshStandardMaterial({ color: color, metalness: 0.3, roughness: 0.4, emissive: color, emissiveIntensity: 0.2 })
        );
        break;
      case 'torus':
        mesh = new THREE.Mesh(
          new THREE.TorusGeometry(...config.detail),
          new THREE.MeshStandardMaterial({ color: color, metalness: 0.4, roughness: 0.3, emissive: color, emissiveIntensity: 0.25 })
        );
        break;
      case 'cone':
        mesh = new THREE.Mesh(
          new THREE.ConeGeometry(...config.detail),
          new THREE.MeshStandardMaterial({ color: color, metalness: 0.3, roughness: 0.4, emissive: color, emissiveIntensity: 0.2 })
        );
        break;
      case 'cylinder':
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(...config.detail),
          new THREE.MeshStandardMaterial({ color: color, metalness: 0.3, roughness: 0.4, emissive: color, emissiveIntensity: 0.2 })
        );
        break;
      default:
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 32, 32),
          new THREE.MeshStandardMaterial({ color: color, metalness: 0.3, roughness: 0.4, emissive: color, emissiveIntensity: 0.2 })
        );
    }

    scene.add(mesh);
    meshRef.current = mesh;

    // حلقة دائرية
    const ringGeometry = new THREE.TorusGeometry(0.55, 0.02, 16, 64);
    const ringMaterial = new THREE.MeshStandardMaterial({ color: color, metalness: 0.6, roughness: 0.2, emissive: color, emissiveIntensity: 0.5 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
    meshRef.current.ring = ring;

    // جسيمات
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 30;
    const positions = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMaterial = new THREE.PointsMaterial({ color: color, size: 0.02, transparent: true, opacity: 0.6 });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);
    meshRef.current.particles = particles;

    // تحريك
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);

      if (meshRef.current) {
        if (meshRef.current.isGroup) {
          meshRef.current.rotation.y += 0.01;
          meshRef.current.rotation.x += 0.005;
        } else {
          meshRef.current.rotation.y += 0.01;
          meshRef.current.rotation.x += 0.005;
        }
      }

      if (meshRef.current?.ring) {
        meshRef.current.ring.rotation.z += 0.015;
      }

      if (meshRef.current?.particles) {
        meshRef.current.particles.rotation.y += 0.003;
        meshRef.current.particles.rotation.x += 0.002;
      }

      if (pointLight) {
        pointLight.intensity = isActive ? 1.5 + Math.sin(Date.now() * 0.005) * 0.3 : 1;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (rendererRef.current && container) {
        container.removeChild(rendererRef.current.domElement);
      }
      if (sceneRef.current) {
        sceneRef.current.clear();
      }
    };
  }, [icon, color, glow, isActive, getGeometry]);

  return (
    <div
      ref={containerRef}
      className="icon-3d-canvas"
      style={{
        width: '100%',
        height: '120px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: `drop-shadow(0 15px 20px ${glow})`
      }}
    />
  );
}

// ========== مكون الأيقونة الرئيسية (تم إصلاح ربط الـ props هنا) ==========
function IconCard({ icon, index, openMenu, onIconClick, setScreen, setOpenMenu }) {
  const isMenuOpen = openMenu === icon.id;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="icon-wrapper"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 110 }}
      style={{
        position: 'relative',
        zIndex: isMenuOpen ? 9999 : 10,
        transition: 'z-index 0.3s ease-in-out'
      }}
    >
      <button
        className={`icon-card ${isMenuOpen ? 'active' : ''}`}
        onClick={() => onIconClick(icon)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'relative',
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(15px)',
          border: isMenuOpen ? `1px solid ${icon.color}` : '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: isMenuOpen ? `0 15px 40px ${icon.glow}` : '0 10px 30px rgba(0,0,0,0.3)',
          cursor: 'pointer'
        }}
      >
        <motion.div
          className="icon-3d-container"
          animate={{
            scale: isMenuOpen ? 1.12 : isHovered ? 1.05 : 1,
          }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Icon3D icon={icon.icon} color={icon.color} glow={icon.glow} isActive={isMenuOpen || isHovered} />
        </motion.div>

        <h3 className="icon-title" style={{ color: isMenuOpen ? icon.color : '#ffffff', fontSize: '1.4rem', fontWeight: 700 }}>{icon.title}</h3>
        <p className="icon-desc" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>{icon.desc}</p>

        {icon.subItems.length > 0 && (
          <motion.span
            className="dropdown-arrow"
            style={{ display: 'inline-block', marginTop: '10px', color: icon.color }}
            animate={{ rotate: isMenuOpen ? 180 : 0 }}
          >
            ▼
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isMenuOpen && icon.subItems.length > 0 && (
          <motion.div
            className="dropdown-panel"
            initial={{ opacity: 0, scaleY: 0, y: -10 }}
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={{ opacity: 0, scaleY: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            style={{
              transformOrigin: 'top center',
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: '#041d14',
              border: `1px solid ${icon.color}`,
              borderRadius: '0 0 20px 20px',
              boxShadow: `0 20px 40px rgba(0,0,0,0.6), 0 0 30px ${icon.glow}`,
              padding: '10px',
              marginTop: '-10px',
              zIndex: 100000
            }}
          >
            {icon.subItems.map((sub, subIndex) => (
              <motion.button
                key={`${sub.title}-${subIndex}`}
                className="dropdown-item"
                onClick={() => {
                  setScreen(sub.screen);
                  setOpenMenu(null);
                }}
                whileHover={{ x: -8, backgroundColor: 'rgba(255,255,255,0.03)', color: icon.color }}
                style={{
                  display: 'flex',
                  justifyContent: 'between',
                  alignItems: 'center',
                  width: '100%',
                  padding: '14px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: '#e2e8f0',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  textAlign: 'right',
                  cursor: 'pointer',
                  borderBottom: subIndex !== icon.subItems.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                  transition: 'color 0.2s ease'
                }}
              >
                <span style={{ flexGrow: 1 }}>{sub.title}</span>
                <span style={{ fontSize: '1.1rem' }}>←</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ========== التطبيق الرئيسي ==========
function App() {
  const [screen, setScreen] = useState('home');
  const [openMenu, setOpenMenu] = useState(null);
  const [user, setUser] = useState(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [threeReady, setThreeReady] = useState(false);

  // ========== تحميل Three.js ==========
  useEffect(() => {
    if (window.THREE) {
      setThreeReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.async = true;
    script.onload = () => setThreeReady(true);
    script.onerror = () => {
      console.warn('⚠️ Three.js لم يتم تحميله، استخدام الأيقونات الاحتياطية');
      setThreeReady(true);
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  // ========== بدء التشغيل والتهيئة ==========
  useEffect(() => {
    let isMounted = true;

    async function startup() {
      try {
        await initDatabase();
        if (isMounted) setDbReady(true);
      } catch (e) {
        console.error("Database initialization failed:", e);
      }

      restoreSession()
        .then(u => { if (isMounted && u) setUser(u); })
        .catch(() => {});
    }

    startup();
    return () => { isMounted = false; };
  }, []);

  // ========== معالجة تسجيل الدخول ==========
  const handleLogin = async () => {
    if (!password.trim()) return;
    setLoginError('');
    setLoading(true);
    const result = await login(password.trim());
    setLoading(false);
    if (result.success) {
      setUser(result.user);
      setScreen('home');
      setPassword('');
    } else {
      setLoginError(result.message);
    }
  };

  // ========== تسجيل الخروج ==========
  const handleLogout = () => {
    logout();
    setUser(null);
    setScreen('login');
    setPassword('');
  };

  // ========== مصفوفة الأيقونات ==========
  const mainIcons = [
    {
      id: 'dashboard',
      title: 'لوحة التحكم',
      icon: '📊',
      color: '#D4AF37',
      glow: 'rgba(214, 175, 55, 0.4)',
      desc: 'الإحصائيات المتقدمة والتحليلات البيومترية الحية',
      subItems: []
    },
    {
      id: 'attendance',
      title: 'الحضور والغياب',
      icon: '🖐️',
      color: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.4)',
      desc: 'رصد حضور ومطابقة البصمة السحابية الفورية وتتبع الغياب',
      subItems: [
        { title: '⚡ تسجيل الحضور المباشر الآن', screen: 'attendance' },
        { title: '📋 كشف الحضور والغياب لليوم', screen: 'attendance' },
        { title: '📊 السجل الشهري التراكمي للغياب', screen: 'attendance' }
      ]
    },
    {
      id: 'students',
      title: 'الطلاب والكليات',
      icon: '🎓',
      color: '#34d399',
      glow: 'rgba(52, 211, 153, 0.4)',
      desc: 'إدارة الكليات، الأقسام، والتصنيفات الأكاديمية والطلاب',
      subItems: [
        { title: '🏫 الكليات والأقسام الأكاديمية', screen: 'students' },
        { title: '📜 التخصصات والخطط الدراسية', screen: 'students' },
        { title: '👥 سجلات الطلاب والقبض البيومتري', screen: 'students' }
      ]
    },
    {
      id: 'teachers',
      title: 'هيئة التدريس',
      icon: '👨‍🏫',
      color: '#f472b6',
      glow: 'rgba(244, 114, 182, 0.4)',
      desc: 'إدارة أعضاء هيئة التدريس والمحاضرين والكادر الأكاديمي',
      subItems: [
        { title: '👨‍🏫 قائمة المعلمين', screen: 'teachers' },
        { title: '📋 إضافة معلم جديد', screen: 'teachers' },
        { title: '📊 إحصائيات الكادر', screen: 'teachers' }
      ]
    },
    {
      id: 'reports',
      title: 'مركز التقارير',
      icon: '📄',
      color: '#fb923c',
      glow: 'rgba(251, 146, 60, 0.4)',
      desc: 'تصدير كشوفات وصكوك PDF و Excel ذكية بنقرة واحدة',
      subItems: [
        { title: '📈 التقارير اليومية الإجمالية للكليات', screen: 'reports' },
        { title: '📅 التقارير الدورية والشهرية للمواد', screen: 'reports' },
        { title: '👤 ملف الغياب التفصيلي للطالب', screen: 'reports' },
        { title: '🏆 مؤشر انضباط الكليات والأقسام', screen: 'reports' }
      ]
    },
    {
      id: 'schedule',
      title: 'الجدول الدراسي',
      icon: '📅',
      color: '#4ade80',
      glow: 'rgba(74, 222, 128, 0.4)',
      desc: 'إدارة الجداول والمحاضرات والأوقات الدراسية',
      subItems: []
    },
    {
      id: 'notifications',
      title: 'نظام الإشعارات',
      icon: '🔔',
      color: '#f87171',
      glow: 'rgba(248, 113, 113, 0.4)',
      desc: 'بث رسائل WhatsApp Cloud API المؤتمتة لأولياء الأمور',
      subItems: []
    },
    {
      id: 'devices',
      title: 'أجهزة البصمة',
      icon: '🖨️',
      color: '#c084fc',
      glow: 'rgba(192, 132, 252, 0.4)',
      desc: 'ربط ومراقبة حيوية أجهزة الحضور الطرفية أوفلاين',
      subItems: []
    },
    {
      id: 'settings',
      title: 'إعدادات النظام',
      icon: '⚙️',
      color: '#94a3b8',
      glow: 'rgba(148, 163, 184, 0.4)',
      desc: 'لوحة السيادة العليا وإدارة صلاحيات الموظفين والنسخ الاحتياطي',
      subItems: [
        { title: '🔌 إعدادات ربط أجهزة البصمة', screen: 'settings' },
        { title: '💬 تهيئة بوابة الـ WhatsApp API', screen: 'settings' },
        { title: '👥 صلاحيات الموظفين والمستخدمين', screen: 'settings' },
        { title: '💾 النسخ الاحتياطي لقواعد البيانات', screen: 'settings' }
      ]
    }
  ];

  const handleIconClick = (icon) => {
    if (icon.subItems.length > 0) {
      setOpenMenu(openMenu === icon.id ? null : icon.id);
    } else {
      setScreen(icon.id);
      setOpenMenu(null);
    }
  };

  // 1️⃣ شاشة التحميل
  if (loading || !threeReady) {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <motion.div
            className="splash-logo-3d"
            style={{ fontSize: '6rem', filter: 'drop-shadow(0 20px 40px rgba(214,175,55,0.4))' }}
            animate={{ scale: [1, 1.05, 1], y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            🏛️
          </motion.div>
          <h3 style={{ fontWeight: 400, color: 'rgba(255,255,255,0.8)', marginTop: '20px' }}>
            {!threeReady ? '⏳ جاري تحميل محرك الرسوميات ثلاثية الأبعاد...' : 'جاري معالجة طلبك وتصديق البيانات...'}
          </h3>
          <div className="splash-loader" style={{ borderColor: '#d4af37 transparent #d4af37 transparent' }}></div>
        </div>
      </div>
    );
  }

  // 2️⃣ واجهة تسجيل الدخول
  if (!user) {
    return (
      <div className="login-screen">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
        >
          <motion.div
            className="login-logo-3d"
            style={{ fontSize: '5rem', filter: 'drop-shadow(0 15px 30px rgba(214,175,55,0.3))', marginBottom: '15px' }}
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          >
            🏛️
          </motion.div>
          <h1 style={{ fontFamily: 'Amiri, serif', fontSize: '2.2rem', color: '#f3e5ab' }}>بوابة السيطرة المركزية</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>يرجى إدخال شيفرة التصديق لتفويض الدخول للمنظومة</p>

          <div className="login-input-group">
            <label style={{ color: '#d4af37', fontWeight: 600 }}>رمز المرور الأمني للمنصة</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyPress={e => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
          </div>

          {loginError && <p className="login-error">⚠️ {loginError}</p>}

          <motion.button
            className="login-btn"
            onClick={handleLogin}
            whileHover={{ scale: 1.03, boxShadow: '0 0 25px rgba(214,175,55,0.4)' }}
            whileTap={{ scale: 0.97 }}
            disabled={!password.trim()}
          >
            🔐 تصديق الدخول الآمن
          </motion.button>

          <p className="login-footer">
            جامعة القرآن الكريم والعلوم الإسلامية<br />
            فرع غيل باوزير - حضرموت
          </p>
        </motion.div>
      </div>
    );
  }

  // 3️⃣ سطح مكتب النظام الرئيسي (تم تمرير الـ سيت سكرين والـ سيت اوبن منيو هنا)
  if (screen === 'home') {
    return (
      <div className="home-screen" style={{ overflowX: 'hidden' }}>
        <div className="home-bg">
          <div className="bg-orb bg-orb-1"></div>
          <div className="bg-orb bg-orb-2"></div>
          <div className="bg-orb bg-orb-3"></div>
        </div>

        <motion.header
          className="home-header"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: 'spring' }}
        >
          <motion.div
            className="home-logo"
            style={{ fontSize: '5rem', filter: 'drop-shadow(0 15px 30px rgba(214,175,55,0.3))' }}
            whileHover={{ scale: 1.15, rotateY: 360 }}
            transition={{ duration: 0.8 }}
          >
            🏛️
          </motion.div>
          <h1 style={{ fontFamily: 'Amiri, serif', fontSize: '2.6rem', color: '#f3e5ab', textShadow: '0 4px 15px rgba(0,0,0,0.6)' }}>نظام إدارة الحضور والغياب الإلكتروني</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.5px' }}>بوابة التوجيه السريع لأنظمة الكليات والخدمات الذكية للجامعة</p>
        </motion.header>

        <div className="icons-grid" style={{ padding: '30px 15px', position: 'relative' }}>
          {mainIcons.map((icon, index) => (
            <IconCard
              key={icon.id}
              icon={icon}
              index={index}
              openMenu={openMenu}
              onIconClick={handleIconClick}
              setScreen={setScreen}
              setOpenMenu={setOpenMenu}
            />
          ))}
        </div>

        <motion.div
          className="user-bar"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="user-info-block">
            <span>👤 : السحابة الأمنية للمستخدم <strong style={{ color: '#d4af37' }}>{user?.username}</strong></span>
            <span className="user-role-badge" style={{ background: 'linear-gradient(135deg, #0d5c41, #041d14)', border: '1px solid #d4af37', color: '#f3e5ab' }}>
              {user?.role === 'admin' ? 'السيادة الإدارية العليا للمنظومة' : 'مسؤول الرصد المعتمد'}
            </span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>🚪 تدمير الجلسة وتسجيل الخروج الآمن</button>
        </motion.div>
      </div>
    );
  }

  // 4️⃣ إطار تصفح الواجهات الداخلية
  const getTitle = () => {
    const titles = {
      'dashboard': '📊 لوحة التحكم والمؤشرات الإحصائية العامة',
      'students': '👥 إدارة سجلات القبض البيومتري وشؤون الطلاب',
      'teachers': '👨‍🏫 إدارة هيئة التدريس والكادر الأكاديمي',
      'attendance': '🖐️ منظومة الرصد الاستراتيجي والمطابقة الفورية',
      'reports': '📄 مركز استخراج الصكوك والبيانات التحليلية للغياب',
      'schedule': '📅 الجدول الدراسي وإدارة المحاضرات',
      'notifications': '🔔 بوابة تكامل WhatsApp Cloud API للبث التلقائي',
      'devices': '🖨️ المراقبة الحيوية لربط أجهزة البصمة المحلية',
      'calendar': '📅 جدولة الفصول والخطط الزمنية للتقويم الأكاديمي',
      'settings': '⚙️ المركز السيادي لإدارة الصلاحيات والنسخ الاحتياطي'
    };
    return titles[screen] || 'المنظومة الرقمية السيادية للجامعة';
  };

  return (
    <div className="app-layout">
      <header className="top-bar" style={{ background: '#041d14', borderBottom: '1px solid rgba(214,175,55,0.2)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
        <button className="back-btn" onClick={() => setScreen('home')} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(214,175,55,0.3)', color: '#f3e5ab' }}>🏠 البوابة الرئيسية</button>
        <h2 style={{ fontFamily: 'Amiri, serif', color: '#ffffff', fontSize: '1.5rem', fontWeight: 700 }}>{getTitle()}</h2>

        <div className="header-status" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '50px' }}>
          <span className={`status-dot ${dbReady ? 'online' : 'offline'}`} style={{ backgroundColor: dbReady ? '#34d399' : '#f87171', boxShadow: dbReady ? '0 0 10px #34d399' : '0 0 10px #f87171' }}></span>
          <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
            {dbReady ? 'قاعدة بيانات محلية نشطة (SQLite) | 3D جاهز' : 'جاري تهيئة قاعدة البيانات...'}
          </span>
        </div>

        <button className="btn-logout-sm" onClick={handleLogout} title="تدمير الجلسة الآمنة" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>🚪</button>
      </header>

      <main className="main-content" style={{ background: '#03140e' }}>
        {screen === 'dashboard' && <Dashboard />}
        {screen === 'students' && <Students />}
        {screen === 'teachers' && <Teachers />}
        {screen === 'attendance' && <Attendance />}
        {screen === 'reports' && <Reports />}
        {screen === 'settings' && <Settings />}
        {screen === 'schedule' && <Settings />}
        {screen === 'notifications' && <Settings />}
        {screen === 'devices' && <Settings />}
        {screen === 'calendar' && <Settings />}
      </main>
    </div>
  );
}

export default App;

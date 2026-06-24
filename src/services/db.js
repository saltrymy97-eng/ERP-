// src/services/db.js – SQLite حقيقية عبر Electron
// إذا في Electron نستخدم الجسر، وإلا نستخدم sql.js احتياط

let getQuery, runQuery, initDatabase, closeDatabase, exportDatabase, importDatabase, loadFromLocalStorage;

if (window.electronAPI) {
  // ========== Electron + SQLite حقيقية ==========
  getQuery = async (sql, params = []) => {
    return await window.electronAPI.getQuery(sql, params);
  };

  runQuery = async (sql, params = []) => {
    return await window.electronAPI.runQuery(sql, params);
  };

  initDatabase = async () => {
    console.log('✅ SQLite حقيقية جاهزة');
    return true;
  };

  closeDatabase = () => {};

  exportDatabase = async () => {
    const data = await window.electronAPI.exportDB();
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup.db';
    a.click();
  };

  importDatabase = async () => {};
  loadFromLocalStorage = async () => [];

} else {
  // ========== احتياط: sql.js للمتصفح ==========
  import('sql.js').then(async (module) => {
    const initSqlJs = module.default;
    const SQL = await initSqlJs({ locateFile: file => `https://sql.js.org/dist/${file}` });
    
    const saved = localStorage.getItem('university_db');
    let db;
    if (saved) {
      db = new SQL.Database(new Uint8Array(JSON.parse(saved)));
    } else {
      db = new SQL.Database();
    }

    getQuery = (sql, params = []) => {
      try {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      } catch (e) { return []; }
    };

    runQuery = (sql, params = []) => {
      try {
        db.run(sql, params);
        const data = db.export();
        localStorage.setItem('university_db', JSON.stringify(Array.from(data)));
        return { success: true };
      } catch (e) { return null; }
    };

    initDatabase = async () => true;
    closeDatabase = () => {};
    exportDatabase = () => {};
    importDatabase = async () => {};
    loadFromLocalStorage = async () => [];
  });
}

export { getQuery, runQuery, initDatabase, closeDatabase, exportDatabase, importDatabase, loadFromLocalStorage };

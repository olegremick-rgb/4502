const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== НАЛАШТУВАННЯ ШЛЯХІВ ДЛЯ RAILWAY ====================
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Створення папок
const photosDir = path.join(UPLOADS_DIR, 'photos');
const videosDir = path.join(UPLOADS_DIR, 'videos');
const newsDir = path.join(UPLOADS_DIR, 'news');
const volunteersDir = path.join(UPLOADS_DIR, 'volunteers');
const partnersDir = path.join(UPLOADS_DIR, 'partners');

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(UPLOADS_DIR);
fs.ensureDirSync(photosDir);
fs.ensureDirSync(videosDir);
fs.ensureDirSync(newsDir);
fs.ensureDirSync(volunteersDir);
fs.ensureDirSync(partnersDir);

console.log('📁 DATA_DIR:', DATA_DIR);
console.log('📁 UPLOADS_DIR:', UPLOADS_DIR);

// ==================== НАЛАШТУВАННЯ MULTER ====================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'logo') cb(null, photosDir);
        else if (file.fieldname === 'media') cb(null, newsDir);
        else if (file.fieldname === 'photo') cb(null, volunteersDir);
        else if (file.fieldname === 'photos') cb(null, photosDir);
        else if (file.fieldname === 'logo') cb(null, partnersDir);
        else cb(null, photosDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024, files: 50 }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*', credentials: true }));
app.use('/uploads', express.static(UPLOADS_DIR));

// Сесії
app.use(session({
    secret: process.env.SESSION_SECRET || 'volunteer-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ==================== БАЗА ДАНИХ ====================
const DB_PATH = path.join(DATA_DIR, 'database.json');

async function initDB() {
    if (!await fs.pathExists(DB_PATH)) {
        const salt = bcrypt.genSaltSync(10);
        const defaultDB = {
            users: [{ id: 1, username: 'admin', password: bcrypt.hashSync('admin', salt), role: 'superadmin', createdAt: new Date().toISOString() }],
            settings: {
                siteName: 'Волонтерський штаб 4.5.0',
                logo: null,
                contacts: { phone: '+380 (99) 123-45-67', email: 'info@volunteer450.org', address: 'м. Київ, Україна' },
                social: []
            },
            collections: [],
            donations: [],
            reports: [],
            news: [],
            volunteers: [],
            partners: [],
            helpPage: {
                title: 'Як отримати допомогу',
                content: 'Якщо ви військовослужбовець або волонтер, який потребує допомоги, звертайтеся до нас.',
                image: null,
                instructions: ['Заповніть онлайн-форму заявки', 'Наш координатор зв\'яжеться з вами', 'Підтвердьте потребу', 'Отримайте допомогу'],
                contacts: { phone: '+380 (99) 123-45-67', email: 'help@volunteer450.org', telegram: '@volunteer450_help' }
            },
            about: { content: 'Ми - волонтерський штаб 4.5.0, який допомагає військовим з 2022 року.' },
            activity: []
        };
        await fs.writeJson(DB_PATH, defaultDB, { spaces: 2 });
        console.log('✅ Базу даних створено');
    }
}

initDB();

async function readDB() { return await fs.readJson(DB_PATH); }
async function writeDB(data) { await fs.writeJson(DB_PATH, data, { spaces: 2 }); }

function requireAuth(req, res, next) {
    if (req.session.userId) next();
    else res.status(401).json({ error: 'Необхідна авторизація' });
}

function requireAdmin(req, res, next) {
    if (req.session.userId && req.session.role === 'superadmin') next();
    else res.status(403).json({ error: 'Доступ заборонено' });
}

// ==================== API МАРШРУТИ ====================

// Аутентифікація
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = await readDB();
    const user = db.users.find(u => u.username === username);
    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        db.activity.push({ id: Date.now(), type: 'login', user: username, timestamp: new Date().toISOString(), details: 'Успішний вхід' });
        await writeDB(db);
        res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
    } else {
        res.status(401).json({ error: 'Невірний логін або пароль' });
    }
});

app.post('/api/logout', async (req, res) => {
    if (req.session.userId) {
        const db = await readDB();
        db.activity.push({ id: Date.now(), type: 'logout', user: req.session.username, timestamp: new Date().toISOString(), details: 'Вихід' });
        await writeDB(db);
    }
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/session', (req, res) => {
    if (req.session.userId) {
        res.json({ authenticated: true, user: { id: req.session.userId, username: req.session.username, role: req.session.role } });
    } else {
        res.json({ authenticated: false });
    }
});

// ==================== НОВИНИ ====================
app.get('/api/news', async (req, res) => {
    const db = await readDB();
    res.json(db.news.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

app.get('/api/news/:id', async (req, res) => {
    const db = await readDB();
    const news = db.news.find(n => n.id === parseInt(req.params.id));
    news ? res.json(news) : res.status(404).json({ error: 'Не знайдено' });
});

app.post('/api/news', requireAuth, requireAdmin, upload.array('media', 50), async (req, res) => {
    const db = await readDB();
    const files = req.files ? req.files.map(f => ({ type: f.mimetype.startsWith('image/') ? 'photo' : 'video', url: '/uploads/' + f.filename, caption: '' })) : [];
    const newNews = {
        id: Date.now(),
        title: req.body.title,
        content: req.body.content,
        important: req.body.important === 'true',
        media: files,
        date: req.body.date || new Date().toISOString().split('T')[0]
    };
    db.news.push(newNews);
    db.activity.push({ id: Date.now(), type: 'news_added', user: req.session.username, timestamp: new Date().toISOString(), details: `Додано новину: ${newNews.title}` });
    await writeDB(db);
    res.json(newNews);
});

app.put('/api/news/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const index = db.news.findIndex(n => n.id === parseInt(req.params.id));
    if (index !== -1) {
        db.news[index] = { ...db.news[index], ...req.body };
        await writeDB(db);
        res.json(db.news[index]);
    } else {
        res.status(404).json({ error: 'Не знайдено' });
    }
});

app.delete('/api/news/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.news = db.news.filter(n => n.id !== parseInt(req.params.id));
    await writeDB(db);
    res.json({ success: true });
});

// ==================== ЗБОРИ ====================
app.get('/api/collections', async (req, res) => {
    const db = await readDB();
    res.json(db.collections);
});

app.get('/api/collections/:id', async (req, res) => {
    const db = await readDB();
    const collection = db.collections.find(c => c.id === parseInt(req.params.id));
    collection ? res.json(collection) : res.status(404).json({ error: 'Не знайдено' });
});

app.post('/api/collections', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const newCollection = { id: Date.now(), ...req.body, current: 0, media: [], createdAt: new Date().toISOString().split('T')[0], status: 'active' };
    db.collections.push(newCollection);
    db.activity.push({ id: Date.now(), type: 'collection_added', user: req.session.username, timestamp: new Date().toISOString(), details: `Додано збір: ${newCollection.name}` });
    await writeDB(db);
    res.json(newCollection);
});

app.put('/api/collections/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const index = db.collections.findIndex(c => c.id === parseInt(req.params.id));
    if (index !== -1) {
        db.collections[index] = { ...db.collections[index], ...req.body };
        await writeDB(db);
        res.json(db.collections[index]);
    } else {
        res.status(404).json({ error: 'Не знайдено' });
    }
});

app.delete('/api/collections/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.collections = db.collections.filter(c => c.id !== parseInt(req.params.id));
    await writeDB(db);
    res.json({ success: true });
});

app.post('/api/collections/:id/photos', requireAuth, requireAdmin, upload.array('photos', 50), async (req, res) => {
    const db = await readDB();
    const index = db.collections.findIndex(c => c.id === parseInt(req.params.id));
    if (index !== -1 && req.files) {
        const files = req.files.map(f => ({ type: 'photo', url: '/uploads/' + f.filename, caption: '' }));
        db.collections[index].media = [...(db.collections[index].media || []), ...files];
        await writeDB(db);
        res.json({ success: true, files });
    } else {
        res.status(404).json({ error: 'Не знайдено' });
    }
});

// ==================== ДОНАТИ ====================
app.get('/api/donations', async (req, res) => {
    const db = await readDB();
    const donations = db.donations.map(d => ({ ...d, collectionName: db.collections.find(c => c.id === d.collectionId)?.name || 'Н/Д' }));
    res.json(donations);
});

app.post('/api/donations', async (req, res) => {
    const db = await readDB();
    const newDonation = { id: Date.now(), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    db.donations.push(newDonation);
    await writeDB(db);
    res.json(newDonation);
});

app.put('/api/donations/:id/confirm', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const index = db.donations.findIndex(d => d.id === parseInt(req.params.id));
    if (index !== -1) {
        db.donations[index].status = 'confirmed';
        const collectionIndex = db.collections.findIndex(c => c.id === db.donations[index].collectionId);
        if (collectionIndex !== -1) db.collections[collectionIndex].current += db.donations[index].amount;
        await writeDB(db);
        res.json(db.donations[index]);
    } else {
        res.status(404).json({ error: 'Не знайдено' });
    }
});

app.delete('/api/donations/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.donations = db.donations.filter(d => d.id !== parseInt(req.params.id));
    await writeDB(db);
    res.json({ success: true });
});

// ==================== ЗВІТИ ====================
app.get('/api/reports', async (req, res) => {
    const db = await readDB();
    res.json(db.reports);
});

app.get('/api/reports/:id', async (req, res) => {
    const db = await readDB();
    const report = db.reports.find(r => r.id === parseInt(req.params.id));
    report ? res.json(report) : res.status(404).json({ error: 'Не знайдено' });
});

app.post('/api/reports', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const newReport = { id: Date.now(), ...req.body, media: [], date: new Date().toISOString().split('T')[0] };
    db.reports.push(newReport);
    db.activity.push({ id: Date.now(), type: 'report_added', user: req.session.username, timestamp: new Date().toISOString(), details: `Додано звіт: ${newReport.title}` });
    await writeDB(db);
    res.json(newReport);
});

app.put('/api/reports/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const index = db.reports.findIndex(r => r.id === parseInt(req.params.id));
    if (index !== -1) {
        db.reports[index] = { ...db.reports[index], ...req.body };
        await writeDB(db);
        res.json(db.reports[index]);
    } else {
        res.status(404).json({ error: 'Не знайдено' });
    }
});

app.delete('/api/reports/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.reports = db.reports.filter(r => r.id !== parseInt(req.params.id));
    await writeDB(db);
    res.json({ success: true });
});

// ==================== ВОЛОНТЕРИ ====================
app.get('/api/volunteers', async (req, res) => {
    const db = await readDB();
    res.json(db.volunteers || []);
});

app.get('/api/volunteers/:id', async (req, res) => {
    const db = await readDB();
    const volunteer = (db.volunteers || []).find(v => v.id === parseInt(req.params.id));
    volunteer ? res.json(volunteer) : res.status(404).json({ error: 'Не знайдено' });
});

app.post('/api/volunteers', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    if (!db.volunteers) db.volunteers = [];
    const newVolunteer = { id: Date.now(), name: req.body.name, role: req.body.role || 'Волонтер', description: req.body.description || '', photo: null, createdAt: new Date().toISOString() };
    db.volunteers.push(newVolunteer);
    db.activity.push({ id: Date.now(), type: 'volunteer_added', user: req.session.username, timestamp: new Date().toISOString(), details: `Додано волонтера: ${newVolunteer.name}` });
    await writeDB(db);
    res.json(newVolunteer);
});

app.put('/api/volunteers/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const index = (db.volunteers || []).findIndex(v => v.id === parseInt(req.params.id));
    if (index !== -1) {
        db.volunteers[index] = { ...db.volunteers[index], ...req.body };
        await writeDB(db);
        res.json(db.volunteers[index]);
    } else {
        res.status(404).json({ error: 'Не знайдено' });
    }
});

app.post('/api/volunteers/:id/photo', requireAuth, requireAdmin, upload.single('photo'), async (req, res) => {
    const db = await readDB();
    const index = (db.volunteers || []).findIndex(v => v.id === parseInt(req.params.id));
    if (index !== -1 && req.file) {
        db.volunteers[index].photo = '/uploads/' + req.file.filename;
        await writeDB(db);
        res.json({ success: true, photo: db.volunteers[index].photo });
    } else {
        res.status(404).json({ error: 'Не знайдено' });
    }
});

app.delete('/api/volunteers/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.volunteers = (db.volunteers || []).filter(v => v.id !== parseInt(req.params.id));
    await writeDB(db);
    res.json({ success: true });
});

// ==================== ПАРТНЕРИ ====================
app.get('/api/partners', async (req, res) => {
    const db = await readDB();
    res.json((db.partners || []).filter(p => p.isActive !== false));
});

app.get('/api/partners/all', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    res.json(db.partners || []);
});

app.get('/api/partners/:id', async (req, res) => {
    const db = await readDB();
    const partner = (db.partners || []).find(p => p.id === parseInt(req.params.id));
    partner ? res.json(partner) : res.status(404).json({ error: 'Не знайдено' });
});

app.post('/api/partners', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    if (!db.partners) db.partners = [];
    const newPartner = { id: Date.now(), name: req.body.name, description: req.body.description || '', website: req.body.website || '', logo: null, isActive: true, order: db.partners.length + 1, createdAt: new Date().toISOString() };
    db.partners.push(newPartner);
    db.activity.push({ id: Date.now(), type: 'partner_added', user: req.session.username, timestamp: new Date().toISOString(), details: `Додано партнера: ${newPartner.name}` });
    await writeDB(db);
    res.json(newPartner);
});

app.put('/api/partners/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const index = (db.partners || []).findIndex(p => p.id === parseInt(req.params.id));
    if (index !== -1) {
        db.partners[index] = { ...db.partners[index], ...req.body };
        await writeDB(db);
        res.json(db.partners[index]);
    } else {
        res.status(404).json({ error: 'Не знайдено' });
    }
});

app.post('/api/partners/:id/logo', requireAuth, requireAdmin, upload.single('logo'), async (req, res) => {
    const db = await readDB();
    const index = (db.partners || []).findIndex(p => p.id === parseInt(req.params.id));
    if (index !== -1 && req.file) {
        db.partners[index].logo = '/uploads/' + req.file.filename;
        await writeDB(db);
        res.json({ success: true, logo: db.partners[index].logo });
    } else {
        res.status(404).json({ error: 'Не знайдено' });
    }
});

app.delete('/api/partners/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.partners = (db.partners || []).filter(p => p.id !== parseInt(req.params.id));
    await writeDB(db);
    res.json({ success: true });
});

// ==================== СТОРІНКА ДОПОМОГИ ====================
app.get('/api/help-page', async (req, res) => {
    const db = await readDB();
    res.json(db.helpPage);
});

app.put('/api/help-page', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.helpPage = { ...db.helpPage, ...req.body };
    await writeDB(db);
    res.json(db.helpPage);
});

app.post('/api/help-page/image', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
    const db = await readDB();
    if (req.file) {
        db.helpPage.image = '/uploads/' + req.file.filename;
        await writeDB(db);
        res.json({ success: true, image: db.helpPage.image });
    } else {
        res.status(400).json({ error: 'Файл не завантажено' });
    }
});

// ==================== ПРО НАС ====================
app.get('/api/about', async (req, res) => {
    const db = await readDB();
    res.json(db.about);
});

app.put('/api/about', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.about = { ...db.about, ...req.body };
    await writeDB(db);
    res.json(db.about);
});

// ==================== НАЛАШТУВАННЯ ====================
app.get('/api/settings', async (req, res) => {
    const db = await readDB();
    res.json(db.settings);
});

app.put('/api/settings', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.settings = { ...db.settings, ...req.body };
    await writeDB(db);
    res.json(db.settings);
});

app.post('/api/settings/logo', requireAuth, requireAdmin, upload.single('logo'), async (req, res) => {
    const db = await readDB();
    if (req.file) {
        db.settings.logo = '/uploads/' + req.file.filename;
        await writeDB(db);
        res.json({ logo: db.settings.logo });
    } else {
        res.status(400).json({ error: 'Файл не завантажено' });
    }
});

app.post('/api/settings/credentials', requireAuth, requireAdmin, async (req, res) => {
    const { username, password } = req.body;
    const db = await readDB();
    const userIndex = db.users.findIndex(u => u.id === req.session.userId);
    if (userIndex !== -1) {
        if (username) db.users[userIndex].username = username;
        if (password) db.users[userIndex].password = bcrypt.hashSync(password, 10);
        await writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Користувача не знайдено' });
    }
});

app.get('/api/logo', async (req, res) => {
    const db = await readDB();
    if (db.settings.logo) {
        const logoPath = path.join(UPLOADS_DIR, path.basename(db.settings.logo));
        if (await fs.pathExists(logoPath)) {
            res.sendFile(logoPath);
            return;
        }
    }
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#0066cc"/><text x="50" y="70" font-size="40" text-anchor="middle" fill="white" font-family="Arial">4.5.0</text></svg>`);
});

// ==================== СОЦІАЛЬНІ МЕРЕЖІ ====================
app.get('/api/social', async (req, res) => {
    const db = await readDB();
    res.json(db.settings.social.filter(s => s.active));
});

app.post('/api/social', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const newSocial = { id: Date.now(), ...req.body, active: true };
    db.settings.social.push(newSocial);
    await writeDB(db);
    res.json(newSocial);
});

app.delete('/api/social/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.settings.social = db.settings.social.filter(s => s.id !== parseInt(req.params.id));
    await writeDB(db);
    res.json({ success: true });
});

// ==================== СТАТИСТИКА ====================
app.get('/api/stats', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    res.json({
        activeCollections: db.collections.filter(c => c.status === 'active').length,
        totalRaised: db.collections.reduce((sum, c) => sum + (c.current || 0), 0),
        pendingDonations: db.donations.filter(d => d.status === 'pending').length,
        totalReports: db.reports.length,
        totalNews: db.news.length,
        totalVolunteers: db.volunteers?.length || 0,
        totalPartners: db.partners?.length || 0
    });
});

app.get('/api/activity', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    res.json((db.activity || []).slice(-50).reverse());
});

// ==================== СТОРІНКИ ====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.get('/admin', (req, res) => {
    if (req.session.userId && req.session.role === 'superadmin') {
        res.sendFile(path.join(__dirname, 'admin.html'));
    } else {
        res.redirect('/admin-login');
    }
});

// ==================== ЗАПУСК ====================
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════╗
    ║      ВОЛОНТЕРСЬКИЙ ШТАБ 4.5.0                        ║
    ║                                                      ║
    ║   🚀 Сервер запущено на порту: ${PORT}                  ║
    ║   📁 Дані зберігаються в: ${DATA_DIR}                   ║
    ║                                                      ║
    ║   👤 Логін: admin                                    ║
    ║   🔑 Пароль: admin                                   ║
    ║                                                      ║
    ╚══════════════════════════════════════════════════════╝
    `);
});

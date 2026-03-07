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

// Створення необхідних папок
const uploadsDir = path.join(__dirname, 'uploads');
const photosDir = path.join(uploadsDir, 'photos');
const videosDir = path.join(uploadsDir, 'videos');
const newsDir = path.join(uploadsDir, 'news');

fs.ensureDirSync(photosDir);
fs.ensureDirSync(videosDir);
fs.ensureDirSync(newsDir);

// Налаштування multer для фото
const photoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, photosDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'photo-' + uniqueSuffix + ext);
    }
});

// Налаштування multer для відео
const videoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, videosDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'video-' + uniqueSuffix + ext);
    }
});

// Налаштування multer для новин
const newsStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, newsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'news-' + uniqueSuffix + ext);
    }
});

const uploadPhoto = multer({ 
    storage: photoStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Тільки зображення дозволені'));
        }
    }
});

const uploadVideo = multer({ 
    storage: videoStorage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Тільки відео дозволені'));
        }
    }
});

const uploadNews = multer({ 
    storage: newsStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Тільки зображення та відео дозволені'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: 'http://localhost:' + PORT,
    credentials: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Налаштування сесій
app.use(session({
    secret: process.env.SESSION_SECRET || 'volunteer-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, 
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ==================== База даних ====================
const DB_PATH = path.join(__dirname, 'database.json');

// Ініціалізація БД
async function initDB() {
    if (!await fs.pathExists(DB_PATH)) {
        const salt = bcrypt.genSaltSync(10);
        const defaultDB = {
            users: [
                {
                    id: 1,
                    username: 'admin',
                    password: bcrypt.hashSync('admin', salt),
                    role: 'superadmin',
                    createdAt: new Date().toISOString()
                }
            ],
            settings: {
                siteName: 'Волонтерська організація 4.5.0',
                logo: null,
                primaryColor: '#0066cc',
                secondaryColor: '#ffffff',
                contacts: {
                    phone: '+380 (99) 123-45-67',
                    email: 'info@volunteer450.org',
                    address: 'м. Київ, Україна'
                },
                social: {
                    facebook: 'https://facebook.com/volunteer450',
                    instagram: 'https://instagram.com/volunteer450',
                    telegram: 'https://t.me/volunteer450',
                    youtube: 'https://youtube.com/volunteer450'
                }
            },
            collections: [
                {
                    id: 1,
                    name: 'Збір на тепловізори',
                    description: 'Збір коштів на тепловізори для розвідників',
                    target: 50000,
                    current: 15750,
                    requisites: '4149 4999 9999 9999',
                    media: [],
                    createdAt: '2024-01-10',
                    status: 'active'
                },
                {
                    id: 2,
                    name: 'Збір на автівку',
                    description: 'Збір на пікап для військових',
                    target: 120000,
                    current: 45000,
                    requisites: '5168 7575 1010 2020',
                    media: [],
                    createdAt: '2024-01-15',
                    status: 'active'
                }
            ],
            donations: [
                {
                    id: 1,
                    collectionId: 1,
                    name: 'Олександр',
                    amount: 1000,
                    status: 'confirmed',
                    createdAt: '2024-01-15T10:30:00Z'
                },
                {
                    id: 2,
                    collectionId: 1,
                    name: 'Марія',
                    amount: 500,
                    status: 'pending',
                    createdAt: '2024-01-16T14:20:00Z'
                }
            ],
            reports: [
                {
                    id: 1,
                    title: 'Придбано тепловізори',
                    content: 'Придбано 3 тепловізори на суму 45000 грн',
                    amount: 45000,
                    date: '2024-01-15',
                    media: []
                },
                {
                    id: 2,
                    title: 'Передано автівку',
                    content: 'Передано пікап на передову',
                    amount: 120000,
                    date: '2024-01-20',
                    media: []
                }
            ],
            news: [
                {
                    id: 1,
                    title: 'Вітання з Різдвом',
                    content: 'Вітаємо всіх з Різдвом! Дякуємо за підтримку.',
                    date: '2024-01-07',
                    media: [],
                    important: true
                },
                {
                    id: 2,
                    title: 'Звіт за тиждень',
                    content: 'За тиждень зібрано 15000 грн на тепловізори',
                    date: '2024-01-14',
                    media: [],
                    important: false
                }
            ],
         // ... (весь попередній код server.js без змін, але в функції initDB() змінено about)

            about: {
                content: 'Ми - волонтерська організація 4.5.0, яка допомагає військовим з 2022 року. Наша мета - забезпечити наших захисників усім необхідним для виконання бойових завдань.\n\nКожна гривня, яку ви жертвуєте, йде на потреби військових. Ми публікуємо детальні звіти про всі витрати. Ми працюємо цілодобово, щоб наблизити перемогу. Долучайтеся до нашої команди!'
}
            },
            activity: []
        };
        
        await fs.writeJson(DB_PATH, defaultDB, { spaces: 2 });
        console.log('✅ Базу даних створено');
    }
}

initDB();

// Допоміжні функції для роботи з БД
async function readDB() {
    return await fs.readJson(DB_PATH);
}

async function writeDB(data) {
    await fs.writeJson(DB_PATH, data, { spaces: 2 });
}

// Middleware для перевірки авторизації
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Необхідна авторизація' });
    }
}

function requireAdmin(req, res, next) {
    if (req.session.userId && req.session.role === 'superadmin') {
        next();
    } else {
        res.status(403).json({ error: 'Доступ заборонено' });
    }
}

// ==================== API Routes ====================

// Аутентифікація
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = await readDB();
    const user = db.users.find(u => u.username === username);
    
    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        
        db.activity.push({
            id: Date.now(),
            type: 'login',
            user: username,
            timestamp: new Date().toISOString(),
            details: 'Успішний вхід в систему'
        });
        await writeDB(db);
        
        res.json({ 
            success: true, 
            user: { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            } 
        });
    } else {
        res.status(401).json({ error: 'Невірний логін або пароль' });
    }
});

app.post('/api/logout', async (req, res) => {
    if (req.session.userId) {
        const db = await readDB();
        db.activity.push({
            id: Date.now(),
            type: 'logout',
            user: req.session.username,
            timestamp: new Date().toISOString(),
            details: 'Вихід з системи'
        });
        await writeDB(db);
    }
    
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/session', (req, res) => {
    if (req.session.userId) {
        res.json({ 
            authenticated: true, 
            user: { 
                id: req.session.userId, 
                username: req.session.username,
                role: req.session.role
            } 
        });
    } else {
        res.json({ authenticated: false });
    }
});

// ==================== Збори ====================
app.get('/api/collections', async (req, res) => {
    const db = await readDB();
    res.json(db.collections);
});

app.get('/api/collections/:id', async (req, res) => {
    const db = await readDB();
    const collection = db.collections.find(c => c.id === parseInt(req.params.id));
    if (collection) {
        res.json(collection);
    } else {
        res.status(404).json({ error: 'Збір не знайдено' });
    }
});

app.post('/api/collections', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const newCollection = {
        id: Date.now(),
        ...req.body,
        current: 0,
        media: [],
        createdAt: new Date().toISOString().split('T')[0],
        status: 'active'
    };
    
    db.collections.push(newCollection);
    
    db.activity.push({
        id: Date.now(),
        type: 'collection_added',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Додано новий збір: ${newCollection.name}`
    });
    
    await writeDB(db);
    res.json(newCollection);
});

app.put('/api/collections/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const index = db.collections.findIndex(c => c.id === parseInt(req.params.id));
    
    if (index !== -1) {
        db.collections[index] = { ...db.collections[index], ...req.body };
        
        db.activity.push({
            id: Date.now(),
            type: 'collection_updated',
            user: req.session.username,
            timestamp: new Date().toISOString(),
            details: `Оновлено збір: ${db.collections[index].name}`
        });
        
        await writeDB(db);
        res.json(db.collections[index]);
    } else {
        res.status(404).json({ error: 'Збір не знайдено' });
    }
});

app.delete('/api/collections/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const collection = db.collections.find(c => c.id === parseInt(req.params.id));
    
    if (collection && collection.media) {
        for (const media of collection.media) {
            const filePath = path.join(__dirname, media.url);
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
            }
        }
    }
    
    db.collections = db.collections.filter(c => c.id !== parseInt(req.params.id));
    
    db.activity.push({
        id: Date.now(),
        type: 'collection_deleted',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Видалено збір: ${collection ? collection.name : 'невідомий'}`
    });
    
    await writeDB(db);
    res.json({ success: true });
});

// Медіа для зборів
app.post('/api/collections/:id/photos', requireAuth, requireAdmin, uploadPhoto.array('photos', 10), async (req, res) => {
    const db = await readDB();
    const collectionIndex = db.collections.findIndex(c => c.id === parseInt(req.params.id));
    
    if (collectionIndex !== -1) {
        const files = req.files.map(file => ({
            type: 'photo',
            url: '/uploads/photos/' + file.filename,
            caption: req.body.caption || ''
        }));
        
        db.collections[collectionIndex].media = [...(db.collections[collectionIndex].media || []), ...files];
        await writeDB(db);
        res.json({ success: true, files });
    } else {
        res.status(404).json({ error: 'Збір не знайдено' });
    }
});

// ==================== Донати ====================
app.get('/api/donations', async (req, res) => {
    const db = await readDB();
    const { status } = req.query;
    
    let donations = db.donations;
    if (status) {
        donations = donations.filter(d => d.status === status);
    }
    
    donations = donations.map(d => ({
        ...d,
        collectionName: db.collections.find(c => c.id === d.collectionId)?.name || 'Невідомий збір'
    }));
    
    res.json(donations);
});

app.post('/api/donations', async (req, res) => {
    const db = await readDB();
    const newDonation = {
        id: Date.now(),
        ...req.body,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    db.donations.push(newDonation);
    await writeDB(db);
    res.json(newDonation);
});

app.put('/api/donations/:id/confirm', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const donationIndex = db.donations.findIndex(d => d.id === parseInt(req.params.id));
    
    if (donationIndex !== -1) {
        db.donations[donationIndex].status = 'confirmed';
        
        const donation = db.donations[donationIndex];
        const collectionIndex = db.collections.findIndex(c => c.id === donation.collectionId);
        
        if (collectionIndex !== -1) {
            db.collections[collectionIndex].current += donation.amount;
        }
        
        db.activity.push({
            id: Date.now(),
            type: 'donation_confirmed',
            user: req.session.username,
            timestamp: new Date().toISOString(),
            details: `Підтверджено донат від ${donation.name} на суму ${donation.amount} грн`
        });
        
        await writeDB(db);
        res.json(db.donations[donationIndex]);
    } else {
        res.status(404).json({ error: 'Донат не знайдено' });
    }
});

app.delete('/api/donations/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const donation = db.donations.find(d => d.id === parseInt(req.params.id));
    db.donations = db.donations.filter(d => d.id !== parseInt(req.params.id));
    
    db.activity.push({
        id: Date.now(),
        type: 'donation_rejected',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Відхилено донат від ${donation ? donation.name : 'невідомого'}`
    });
    
    await writeDB(db);
    res.json({ success: true });
});

// ==================== Звіти ====================
app.get('/api/reports', async (req, res) => {
    const db = await readDB();
    res.json(db.reports);
});

app.post('/api/reports', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const newReport = {
        id: Date.now(),
        ...req.body,
        media: [],
        date: new Date().toISOString().split('T')[0]
    };
    
    db.reports.push(newReport);
    
    db.activity.push({
        id: Date.now(),
        type: 'report_added',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Додано звіт: ${newReport.title}`
    });
    
    await writeDB(db);
    res.json(newReport);
});

app.post('/api/reports/:id/photos', requireAuth, requireAdmin, uploadPhoto.array('photos', 10), async (req, res) => {
    const db = await readDB();
    const reportIndex = db.reports.findIndex(r => r.id === parseInt(req.params.id));
    
    if (reportIndex !== -1) {
        const files = req.files.map(file => ({
            type: 'photo',
            url: '/uploads/photos/' + file.filename,
            caption: req.body.caption || ''
        }));
        
        db.reports[reportIndex].media = [...(db.reports[reportIndex].media || []), ...files];
        await writeDB(db);
        res.json({ success: true, files });
    } else {
        res.status(404).json({ error: 'Звіт не знайдено' });
    }
});

app.delete('/api/reports/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const report = db.reports.find(r => r.id === parseInt(req.params.id));
    
    if (report && report.media) {
        for (const media of report.media) {
            const filePath = path.join(__dirname, media.url);
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
            }
        }
    }
    
    db.reports = db.reports.filter(r => r.id !== parseInt(req.params.id));
    
    db.activity.push({
        id: Date.now(),
        type: 'report_deleted',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Видалено звіт: ${report ? report.title : 'невідомий'}`
    });
    
    await writeDB(db);
    res.json({ success: true });
});

// ==================== Новини ====================
app.get('/api/news', async (req, res) => {
    const db = await readDB();
    res.json(db.news.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

app.post('/api/news', requireAuth, requireAdmin, uploadNews.array('media', 10), async (req, res) => {
    const db = await readDB();
    
    const files = req.files ? req.files.map(file => ({
        type: file.mimetype.startsWith('image/') ? 'photo' : 'video',
        url: '/uploads/news/' + file.filename,
        caption: ''
    })) : [];
    
    const newNews = {
        id: Date.now(),
        title: req.body.title,
        content: req.body.content,
        important: req.body.important === 'true',
        media: files,
        date: new Date().toISOString().split('T')[0]
    };
    
    db.news.push(newNews);
    
    db.activity.push({
        id: Date.now(),
        type: 'news_added',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Додано новину: ${newNews.title}`
    });
    
    await writeDB(db);
    res.json(newNews);
});

app.delete('/api/news/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const news = db.news.find(n => n.id === parseInt(req.params.id));
    
    if (news && news.media) {
        for (const media of news.media) {
            const filePath = path.join(__dirname, media.url);
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
            }
        }
    }
    
    db.news = db.news.filter(n => n.id !== parseInt(req.params.id));
    
    db.activity.push({
        id: Date.now(),
        type: 'news_deleted',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Видалено новину: ${news ? news.title : 'невідома'}`
    });
    
    await writeDB(db);
    res.json({ success: true });
});

// ==================== Про нас ====================
app.get('/api/about', async (req, res) => {
    const db = await readDB();
    res.json(db.about);
});

app.put('/api/about', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.about = { ...db.about, ...req.body };
    
    db.activity.push({
        id: Date.now(),
        type: 'about_updated',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: 'Оновлено сторінку "Про нас"'
    });
    
    await writeDB(db);
    res.json(db.about);
});

// ==================== Налаштування ====================
app.get('/api/settings', async (req, res) => {
    const db = await readDB();
    res.json(db.settings);
});

app.put('/api/settings', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.settings = { ...db.settings, ...req.body };
    
    db.activity.push({
        id: Date.now(),
        type: 'settings_updated',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: 'Оновлено налаштування сайту'
    });
    
    await writeDB(db);
    res.json(db.settings);
});

app.post('/api/settings/logo', requireAuth, requireAdmin, uploadPhoto.single('logo'), async (req, res) => {
    if (req.file) {
        const db = await readDB();
        const logoPath = '/uploads/photos/' + req.file.filename;
        db.settings.logo = logoPath;
        
        db.activity.push({
            id: Date.now(),
            type: 'logo_updated',
            user: req.session.username,
            timestamp: new Date().toISOString(),
            details: 'Оновлено логотип сайту'
        });
        
        await writeDB(db);
        res.json({ logo: logoPath });
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
        if (password) {
            const salt = bcrypt.genSaltSync(10);
            db.users[userIndex].password = bcrypt.hashSync(password, salt);
        }
        
        db.activity.push({
            id: Date.now(),
            type: 'credentials_updated',
            user: req.session.username,
            timestamp: new Date().toISOString(),
            details: 'Змінено облікові дані адміністратора'
        });
        
        await writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Користувача не знайдено' });
    }
});

app.get('/api/logo', async (req, res) => {
    const db = await readDB();
    if (db.settings.logo && await fs.pathExists(path.join(__dirname, db.settings.logo))) {
        res.sendFile(path.join(__dirname, db.settings.logo));
    } else {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="#0066cc"/>
            <text x="50" y="70" font-size="40" text-anchor="middle" fill="white" font-family="Arial">4.5.0</text>
        </svg>`);
    }
});

// ==================== Статистика ====================
app.get('/api/stats', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    
    const stats = {
        activeCollections: db.collections.filter(c => c.status === 'active').length,
        totalRaised: db.collections.reduce((sum, c) => sum + c.current, 0),
        pendingDonations: db.donations.filter(d => d.status === 'pending').length,
        totalReports: db.reports.length,
        totalNews: db.news.length,
        totalDonors: [...new Set(db.donations.map(d => d.name))].length
    };
    
    res.json(stats);
});

app.get('/api/activity', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    res.json(db.activity.slice(-50).reverse());
});

// ==================== Сторінки ====================
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

// ==================== Запуск сервера ====================
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════╗
    ║   Волонтерська організація 4.5.0         ║
    ║                                          ║
    ║   Головна сторінка: http://localhost:${PORT}  ║
    ║   Адмін-логін: http://localhost:${PORT}/admin-login ║
    ║                                          ║
    ║   Логін: admin                               ║
    ║   Пароль: admin                              ║
    ╚══════════════════════════════════════════╝
    `);
});


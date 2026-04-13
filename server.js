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

// Визначаємо директорії для зберігання даних
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Функція для безпечного створення директорій
async function ensureDirectories() {
    await fs.ensureDir(DATA_DIR);
    await fs.ensureDir(UPLOADS_DIR);
    await fs.ensureDir(path.join(UPLOADS_DIR, 'photos'));
    await fs.ensureDir(path.join(UPLOADS_DIR, 'news'));
    await fs.ensureDir(path.join(UPLOADS_DIR, 'volunteers'));
    await fs.ensureDir(path.join(UPLOADS_DIR, 'partners'));
    console.log(`Директорії готові: DATA_DIR=${DATA_DIR}, UPLOADS_DIR=${UPLOADS_DIR}`);
}

// Налаштування multer для різних типів файлів
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let dest = path.join(UPLOADS_DIR, 'photos');
        if (file.fieldname === 'media') dest = path.join(UPLOADS_DIR, 'news');
        else if (file.fieldname === 'photo') dest = path.join(UPLOADS_DIR, 'volunteers');
        else if (file.fieldname === 'logo') dest = path.join(UPLOADS_DIR, 'partners');
        cb(null, dest);
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
app.use(cors());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(__dirname));

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
            users: [
                { id: 1, username: 'admin', password: bcrypt.hashSync('admin', salt), role: 'superadmin', createdAt: new Date().toISOString() }
            ],
            settings: {
                siteName: 'Волонтерський штаб 4.5.0',
                logo: null,
                contacts: { phone: '+380 (99) 123-45-67', email: 'info@volunteer450.org', address: 'м. Київ, Україна' },
                social: []
            },
            collections: [],
            donations: [],
            reports: [],
            news: [
                {
                    id: 1,
                    title: 'Ласкаво просимо!',
                    content: 'Вітаємо на сайті Волонтерського штабу 4.5.0',
                    important: true,
                    media: [],
                    date: new Date().toISOString().split('T')[0]
                }
            ],
            volunteers: [],
            partners: [],
            helpPage: {
                title: 'Як отримати допомогу',
                content: 'Зв\'яжіться з нами за телефонами нижче',
                instructions: ['Зателефонуйте нам', 'Опишіть вашу ситуацію', 'Отримайте допомогу'],
                contacts: { phone: '+380 (99) 123-45-67', email: 'help@volunteer450.org', telegram: '@volunteer450' }
            },
            about: { content: 'Ми - волонтерський штаб, що допомагає з 2022 року.' },
            activity: []
        };
        await fs.writeJson(DB_PATH, defaultDB, { spaces: 2 });
        console.log('✅ Базу даних створено');
    } else {
        console.log('✅ База даних вже існує');
    }
}

async function readDB() {
    try {
        return await fs.readJson(DB_PATH);
    } catch (err) {
        console.error('Помилка читання БД:', err);
        return { users: [], settings: { social: [] }, collections: [], donations: [], reports: [], news: [], volunteers: [], partners: [], helpPage: {}, about: {}, activity: [] };
    }
}

async function writeDB(data) {
    try {
        await fs.writeJson(DB_PATH, data, { spaces: 2 });
    } catch (err) {
        console.error('Помилка запису БД:', err);
    }
}

// Middleware для авторизації
function requireAuth(req, res, next) {
    if (req.session.userId) return next();
    res.status(401).json({ error: 'Необхідна авторизація' });
}

function requireAdmin(req, res, next) {
    if (req.session.userId && req.session.role === 'superadmin') return next();
    res.status(403).json({ error: 'Доступ заборонено' });
}

// ==================== АУТЕНТИФІКАЦІЯ ====================
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const db = await readDB();
        const user = db.users.find(u => u.username === username);
        if (user && bcrypt.compareSync(password, user.password)) {
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role;
            res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
        } else {
            res.status(401).json({ error: 'Невірний логін або пароль' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Внутрішня помилка' });
    }
});

app.post('/api/logout', (req, res) => {
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
    try {
        const db = await readDB();
        const news = db.news || [];
        res.json(news.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (err) {
        console.error('Помилка отримання новин:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.get('/api/news/:id', async (req, res) => {
    try {
        const db = await readDB();
        const news = (db.news || []).find(n => n.id === parseInt(req.params.id));
        if (news) res.json(news);
        else res.status(404).json({ error: 'Не знайдено' });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/news', requireAuth, requireAdmin, upload.array('media', 50), async (req, res) => {
    try {
        const db = await readDB();
        const files = req.files ? req.files.map(f => ({ type: f.mimetype.startsWith('image/') ? 'photo' : 'video', url: '/uploads/' + path.basename(f.path) })) : [];
        const newNews = {
            id: Date.now(),
            title: req.body.title,
            content: req.body.content,
            important: req.body.important === 'true',
            media: files,
            date: req.body.date || new Date().toISOString().split('T')[0]
        };
        db.news.push(newNews);
        await writeDB(db);
        res.json(newNews);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.put('/api/news/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        const index = (db.news || []).findIndex(n => n.id === parseInt(req.params.id));
        if (index !== -1) {
            db.news[index] = { ...db.news[index], ...req.body };
            await writeDB(db);
            res.json(db.news[index]);
        } else {
            res.status(404).json({ error: 'Не знайдено' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.delete('/api/news/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        db.news = (db.news || []).filter(n => n.id !== parseInt(req.params.id));
        await writeDB(db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ==================== ЗБОРИ ====================
app.get('/api/collections', async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.collections || []);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/collections', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        const newCollection = { id: Date.now(), ...req.body, current: 0, media: [], status: 'active' };
        db.collections.push(newCollection);
        await writeDB(db);
        res.json(newCollection);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.put('/api/collections/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        const index = (db.collections || []).findIndex(c => c.id === parseInt(req.params.id));
        if (index !== -1) {
            db.collections[index] = { ...db.collections[index], ...req.body };
            await writeDB(db);
            res.json(db.collections[index]);
        } else {
            res.status(404).json({ error: 'Не знайдено' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.delete('/api/collections/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        db.collections = (db.collections || []).filter(c => c.id !== parseInt(req.params.id));
        await writeDB(db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/collections/:id/photos', requireAuth, requireAdmin, upload.array('photos', 50), async (req, res) => {
    try {
        const db = await readDB();
        const index = db.collections.findIndex(c => c.id === parseInt(req.params.id));
        if (index !== -1 && req.files) {
            const files = req.files.map(f => ({ type: 'photo', url: '/uploads/' + path.basename(f.path) }));
            db.collections[index].media = [...(db.collections[index].media || []), ...files];
            await writeDB(db);
            res.json({ success: true, files });
        } else {
            res.status(404).json({ error: 'Не знайдено' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ==================== ДОНАТИ ====================
app.get('/api/donations', async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.donations || []);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/donations', async (req, res) => {
    try {
        const db = await readDB();
        const newDonation = { id: Date.now(), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
        db.donations.push(newDonation);
        await writeDB(db);
        res.json(newDonation);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.put('/api/donations/:id/confirm', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        const index = (db.donations || []).findIndex(d => d.id === parseInt(req.params.id));
        if (index !== -1) {
            db.donations[index].status = 'confirmed';
            // Оновлюємо суму збору
            const donation = db.donations[index];
            const collectionIndex = (db.collections || []).findIndex(c => c.id === donation.collectionId);
            if (collectionIndex !== -1) {
                db.collections[collectionIndex].current = (db.collections[collectionIndex].current || 0) + donation.amount;
            }
            await writeDB(db);
            res.json(db.donations[index]);
        } else {
            res.status(404).json({ error: 'Не знайдено' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.delete('/api/donations/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        db.donations = (db.donations || []).filter(d => d.id !== parseInt(req.params.id));
        await writeDB(db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ==================== ЗВІТИ ====================
app.get('/api/reports', async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.reports || []);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/reports', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        const newReport = { id: Date.now(), ...req.body, media: [], date: new Date().toISOString().split('T')[0] };
        db.reports.push(newReport);
        await writeDB(db);
        res.json(newReport);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.put('/api/reports/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        const index = (db.reports || []).findIndex(r => r.id === parseInt(req.params.id));
        if (index !== -1) {
            db.reports[index] = { ...db.reports[index], ...req.body };
            await writeDB(db);
            res.json(db.reports[index]);
        } else {
            res.status(404).json({ error: 'Не знайдено' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.delete('/api/reports/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        db.reports = (db.reports || []).filter(r => r.id !== parseInt(req.params.id));
        await writeDB(db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ==================== ВОЛОНТЕРИ ====================
app.get('/api/volunteers', async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.volunteers || []);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/volunteers', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        const newVolunteer = { id: Date.now(), ...req.body, photo: null };
        db.volunteers.push(newVolunteer);
        await writeDB(db);
        res.json(newVolunteer);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.put('/api/volunteers/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        const index = (db.volunteers || []).findIndex(v => v.id === parseInt(req.params.id));
        if (index !== -1) {
            db.volunteers[index] = { ...db.volunteers[index], ...req.body };
            await writeDB(db);
            res.json(db.volunteers[index]);
        } else {
            res.status(404).json({ error: 'Не знайдено' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/volunteers/:id/photo', requireAuth, requireAdmin, upload.single('photo'), async (req, res) => {
    try {
        const db = await readDB();
        const index = (db.volunteers || []).findIndex(v => v.id === parseInt(req.params.id));
        if (index !== -1 && req.file) {
            db.volunteers[index].photo = '/uploads/volunteers/' + req.file.filename;
            await writeDB(db);
            res.json({ success: true, photo: db.volunteers[index].photo });
        } else {
            res.status(404).json({ error: 'Не знайдено' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.delete('/api/volunteers/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        db.volunteers = (db.volunteers || []).filter(v => v.id !== parseInt(req.params.id));
        await writeDB(db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ==================== ПАРТНЕРИ ====================
app.get('/api/partners', async (req, res) => {
    try {
        const db = await readDB();
        res.json((db.partners || []).filter(p => p.isActive !== false));
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.get('/api/partners/all', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.partners || []);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/partners', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        const newPartner = { id: Date.now(), ...req.body, logo: null, isActive: true };
        db.partners.push(newPartner);
        await writeDB(db);
        res.json(newPartner);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.put('/api/partners/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        const index = (db.partners || []).findIndex(p => p.id === parseInt(req.params.id));
        if (index !== -1) {
            db.partners[index] = { ...db.partners[index], ...req.body };
            await writeDB(db);
            res.json(db.partners[index]);
        } else {
            res.status(404).json({ error: 'Не знайдено' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/partners/:id/logo', requireAuth, requireAdmin, upload.single('logo'), async (req, res) => {
    try {
        const db = await readDB();
        const index = (db.partners || []).findIndex(p => p.id === parseInt(req.params.id));
        if (index !== -1 && req.file) {
            db.partners[index].logo = '/uploads/partners/' + req.file.filename;
            await writeDB(db);
            res.json({ success: true, logo: db.partners[index].logo });
        } else {
            res.status(404).json({ error: 'Не знайдено' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.delete('/api/partners/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        db.partners = (db.partners || []).filter(p => p.id !== parseInt(req.params.id));
        await writeDB(db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ==================== ІНШІ API ====================
app.get('/api/help-page', async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.helpPage || {});
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.put('/api/help-page', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        db.helpPage = { ...db.helpPage, ...req.body };
        await writeDB(db);
        res.json(db.helpPage);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/help-page/image', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const db = await readDB();
        if (req.file) {
            db.helpPage.image = '/uploads/photos/' + req.file.filename;
            await writeDB(db);
            res.json({ success: true, image: db.helpPage.image });
        } else {
            res.status(400).json({ error: 'Файл не завантажено' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.get('/api/about', async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.about || { content: 'Інформація відсутня' });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.put('/api/about', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        db.about = { ...db.about, ...req.body };
        await writeDB(db);
        res.json(db.about);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.get('/api/settings', async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.settings || {});
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.put('/api/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        db.settings = { ...db.settings, ...req.body };
        await writeDB(db);
        res.json(db.settings);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/settings/logo', requireAuth, requireAdmin, upload.single('logo'), async (req, res) => {
    try {
        const db = await readDB();
        if (req.file) {
            const logoPath = '/uploads/photos/' + req.file.filename;
            db.settings.logo = logoPath;
            await writeDB(db);
            res.json({ success: true, logo: logoPath });
        } else {
            res.status(400).json({ error: 'Файл не завантажено' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/settings/credentials', requireAuth, requireAdmin, async (req, res) => {
    try {
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
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.get('/api/logo', async (req, res) => {
    try {
        const db = await readDB();
        if (db.settings && db.settings.logo) {
            const filename = path.basename(db.settings.logo);
            const logoPath = path.join(UPLOADS_DIR, 'photos', filename);
            if (await fs.pathExists(logoPath)) {
                return res.sendFile(logoPath);
            }
        }
    } catch (err) {}
    // Дефолтний SVG логотип
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="#0066cc"/>
        <text x="50" y="70" font-size="40" text-anchor="middle" fill="white" font-family="Arial">4.5.0</text>
    </svg>`);
});

app.get('/api/social', async (req, res) => {
    try {
        const db = await readDB();
        res.json((db.settings?.social || []).filter(s => s.active));
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/social', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        const newSocial = { id: Date.now(), ...req.body, active: true };
        if (!db.settings.social) db.settings.social = [];
        db.settings.social.push(newSocial);
        await writeDB(db);
        res.json(newSocial);
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.delete('/api/social/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        db.settings.social = (db.settings.social || []).filter(s => s.id !== parseInt(req.params.id));
        await writeDB(db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.get('/api/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        res.json({
            activeCollections: (db.collections || []).filter(c => c.status === 'active').length,
            totalRaised: (db.collections || []).reduce((sum, c) => sum + (c.current || 0), 0),
            pendingDonations: (db.donations || []).filter(d => d.status === 'pending').length,
            totalReports: (db.reports || []).length,
            totalNews: (db.news || []).length,
            totalVolunteers: (db.volunteers || []).length,
            totalPartners: (db.partners || []).length
        });
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.get('/api/activity', requireAuth, requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        res.json((db.activity || []).slice(-50).reverse());
    } catch (err) {
        res.status(500).json({ error: 'Помилка сервера' });
    }
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
async function startServer() {
    await ensureDirectories();
    await initDB();
    app.listen(PORT, () => {
        console.log(`✅ Сервер запущено на порту ${PORT}`);
        console.log(`📁 DATA_DIR: ${DATA_DIR}`);
        console.log(`📁 UPLOADS_DIR: ${UPLOADS_DIR}`);
        console.log(`🌐 Головна сторінка: http://localhost:${PORT}`);
    });
}

startServer().catch(err => {
    console.error('Помилка запуску сервера:', err);
    process.exit(1);
});

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
const volunteersDir = path.join(uploadsDir, 'volunteers');
const partnersDir = path.join(uploadsDir, 'partners');

fs.ensureDirSync(photosDir);
fs.ensureDirSync(videosDir);
fs.ensureDirSync(newsDir);
fs.ensureDirSync(volunteersDir);
fs.ensureDirSync(partnersDir);

// Налаштування multer
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

const volunteerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, volunteersDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'volunteer-' + uniqueSuffix + ext);
    }
});

const partnerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, partnersDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'partner-' + uniqueSuffix + ext);
    }
});

const uploadPhoto = multer({ 
    storage: photoStorage,
    limits: { fileSize: 10 * 1024 * 1024, files: 50 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Тільки зображення дозволені'));
        }
    }
});

const uploadNews = multer({ 
    storage: newsStorage,
    limits: { fileSize: 50 * 1024 * 1024, files: 50 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Тільки зображення та відео дозволені'));
        }
    }
});

const uploadVolunteer = multer({ 
    storage: volunteerStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Тільки зображення дозволені'));
        }
    }
});

const uploadPartner = multer({ 
    storage: partnerStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Тільки зображення дозволені'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: ['http://localhost:' + PORT, 'http://localhost:3000'],
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
                siteName: 'Волонтерський штаб 4.5.0',
                logo: null,
                primaryColor: '#0066cc',
                secondaryColor: '#ffffff',
                contacts: {
                    phone: '+380 (99) 123-45-67',
                    email: 'info@volunteer450.org',
                    address: 'м. Київ, Україна'
                },
                social: []
            },
            collections: [],
            donations: [],
            reports: [],
            news: [
                {
                    id: 1,
                    title: 'Ласкаво просимо до Волонтерського штабу 4.5.0!',
                    content: 'Ми раді вітати вас на нашому сайті. Тут ви можете дізнатися про актуальні збори, новини та звіти нашої діяльності. Разом до перемоги!',
                    important: true,
                    media: [],
                    date: new Date().toISOString().split('T')[0]
                }
            ],
            volunteers: [
                {
                    id: 1,
                    name: 'Олена Петренко',
                    role: 'Координатор штабу',
                    description: 'Координатор волонтерського штабу, відповідає за логістику та розподіл допомоги.',
                    photo: null,
                    createdAt: new Date().toISOString()
                }
            ],
            partners: [
                {
                    id: 1,
                    name: 'Благодійний фонд "Разом"',
                    logo: null,
                    website: 'https://example.com',
                    description: 'Надійний партнер, який допомагає з логістикою',
                    order: 1,
                    isActive: true,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 2,
                    name: 'Медичний центр "Здоров\'я"',
                    logo: null,
                    website: 'https://example.com',
                    description: 'Забезпечує медикаментами та аптечками',
                    order: 2,
                    isActive: true,
                    createdAt: new Date().toISOString()
                }
            ],
            helpPage: {
                title: 'Як отримати допомогу',
                content: 'Якщо ви військовослужбовець або волонтер, який потребує допомоги, звертайтеся до нас за наступними контактами:\n\n📞 Телефон: +380 (99) 123-45-67\n📧 Email: help@volunteer450.org\n\nПроцедура отримання допомоги:\n1. Заповніть заявку через форму на сайті\n2. Очікуйте дзвінка від нашого координатора\n3. Отримайте допомогу (спорядження, медикаменти, транспорт)',
                image: null,
                instructions: [
                    'Заповніть онлайн-форму заявки',
                    'Наш координатор зв\'яжеться з вами протягом 24 годин',
                    'Підтвердьте потребу та узгодьте деталі',
                    'Отримайте допомогу особисто або через представника'
                ],
                contacts: {
                    phone: '+380 (99) 123-45-67',
                    email: 'help@volunteer450.org',
                    telegram: '@volunteer450_help'
                }
            },
            about: {
                content: 'Ми - волонтерський штаб 4.5.0, який допомагає військовим з 2022 року. Наша мета - забезпечити наших захисників усім необхідним для виконання бойових завдань.\n\nКожна гривня, яку ви жертвуєте, йде на потреби військових. Ми публікуємо детальні звіти про всі витрати. Ми працюємо цілодобово, щоб наблизити перемогу. Долучайтеся до нашої команди!'
            },
            activity: []
        };
        
        await fs.writeJson(DB_PATH, defaultDB, { spaces: 2 });
        console.log('✅ Базу даних створено');
    }
}

initDB();

async function readDB() {
    return await fs.readJson(DB_PATH);
}

async function writeDB(data) {
    await fs.writeJson(DB_PATH, data, { spaces: 2 });
}

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

app.post('/api/collections/:id/photos', requireAuth, requireAdmin, uploadPhoto.array('photos', 50), async (req, res) => {
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

app.get('/api/reports/:id', async (req, res) => {
    const db = await readDB();
    const report = db.reports.find(r => r.id === parseInt(req.params.id));
    if (report) {
        res.json(report);
    } else {
        res.status(404).json({ error: 'Звіт не знайдено' });
    }
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

app.put('/api/reports/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const index = db.reports.findIndex(r => r.id === parseInt(req.params.id));
    
    if (index !== -1) {
        db.reports[index] = { ...db.reports[index], ...req.body };
        
        db.activity.push({
            id: Date.now(),
            type: 'report_updated',
            user: req.session.username,
            timestamp: new Date().toISOString(),
            details: `Оновлено звіт: ${db.reports[index].title}`
        });
        
        await writeDB(db);
        res.json(db.reports[index]);
    } else {
        res.status(404).json({ error: 'Звіт не знайдено' });
    }
});

app.post('/api/reports/:id/media', requireAuth, requireAdmin, uploadNews.array('media', 50), async (req, res) => {
    const db = await readDB();
    const reportIndex = db.reports.findIndex(r => r.id === parseInt(req.params.id));
    
    if (reportIndex !== -1) {
        const files = req.files.map(file => ({
            type: file.mimetype.startsWith('image/') ? 'photo' : 'video',
            url: '/uploads/news/' + file.filename,
            caption: ''
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

app.get('/api/news/:id', async (req, res) => {
    const db = await readDB();
    const news = db.news.find(n => n.id === parseInt(req.params.id));
    if (news) {
        res.json(news);
    } else {
        res.status(404).json({ error: 'Новину не знайдено' });
    }
});

app.post('/api/news', requireAuth, requireAdmin, uploadNews.array('media', 50), async (req, res) => {
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
        important: req.body.important === 'true' || req.body.important === true,
        media: files,
        date: req.body.date || new Date().toISOString().split('T')[0]
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

app.put('/api/news/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const index = db.news.findIndex(n => n.id === parseInt(req.params.id));
    
    if (index !== -1) {
        db.news[index] = { ...db.news[index], ...req.body };
        
        db.activity.push({
            id: Date.now(),
            type: 'news_updated',
            user: req.session.username,
            timestamp: new Date().toISOString(),
            details: `Оновлено новину: ${db.news[index].title}`
        });
        
        await writeDB(db);
        res.json(db.news[index]);
    } else {
        res.status(404).json({ error: 'Новину не знайдено' });
    }
});

app.post('/api/news/:id/media', requireAuth, requireAdmin, uploadNews.array('media', 50), async (req, res) => {
    const db = await readDB();
    const newsIndex = db.news.findIndex(n => n.id === parseInt(req.params.id));
    
    if (newsIndex !== -1) {
        const files = req.files.map(file => ({
            type: file.mimetype.startsWith('image/') ? 'photo' : 'video',
            url: '/uploads/news/' + file.filename,
            caption: ''
        }));
        
        db.news[newsIndex].media = [...(db.news[newsIndex].media || []), ...files];
        await writeDB(db);
        res.json({ success: true, files });
    } else {
        res.status(404).json({ error: 'Новину не знайдено' });
    }
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

// ==================== Волонтери ====================
app.get('/api/volunteers', async (req, res) => {
    const db = await readDB();
    if (!db.volunteers) {
        db.volunteers = [];
        await writeDB(db);
    }
    res.json(db.volunteers);
});

app.get('/api/volunteers/:id', async (req, res) => {
    const db = await readDB();
    const volunteer = db.volunteers?.find(v => v.id === parseInt(req.params.id));
    if (volunteer) {
        res.json(volunteer);
    } else {
        res.status(404).json({ error: 'Волонтера не знайдено' });
    }
});

app.post('/api/volunteers', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    
    if (!db.volunteers) {
        db.volunteers = [];
    }
    
    const newVolunteer = {
        id: Date.now(),
        name: req.body.name,
        role: req.body.role || 'Волонтер',
        description: req.body.description || '',
        photo: null,
        createdAt: new Date().toISOString()
    };
    
    db.volunteers.push(newVolunteer);
    
    db.activity.push({
        id: Date.now(),
        type: 'volunteer_added',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Додано волонтера: ${newVolunteer.name}`
    });
    
    await writeDB(db);
    res.json(newVolunteer);
});

app.put('/api/volunteers/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const index = db.volunteers?.findIndex(v => v.id === parseInt(req.params.id));
    
    if (index !== -1 && index !== undefined) {
        db.volunteers[index] = { 
            ...db.volunteers[index], 
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        
        db.activity.push({
            id: Date.now(),
            type: 'volunteer_updated',
            user: req.session.username,
            timestamp: new Date().toISOString(),
            details: `Оновлено волонтера: ${db.volunteers[index].name}`
        });
        
        await writeDB(db);
        res.json(db.volunteers[index]);
    } else {
        res.status(404).json({ error: 'Волонтера не знайдено' });
    }
});

app.post('/api/volunteers/:id/photo', requireAuth, requireAdmin, uploadVolunteer.single('photo'), async (req, res) => {
    const db = await readDB();
    const index = db.volunteers?.findIndex(v => v.id === parseInt(req.params.id));
    
    if (index !== -1 && index !== undefined && req.file) {
        if (db.volunteers[index].photo) {
            const oldPhotoPath = path.join(__dirname, db.volunteers[index].photo);
            if (await fs.pathExists(oldPhotoPath)) {
                await fs.remove(oldPhotoPath);
            }
        }
        
        const photoPath = '/uploads/volunteers/' + req.file.filename;
        db.volunteers[index].photo = photoPath;
        
        await writeDB(db);
        res.json({ success: true, photo: photoPath });
    } else {
        res.status(404).json({ error: 'Волонтера не знайдено або фото не завантажено' });
    }
});

app.delete('/api/volunteers/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const volunteer = db.volunteers?.find(v => v.id === parseInt(req.params.id));
    
    if (volunteer && volunteer.photo) {
        const photoPath = path.join(__dirname, volunteer.photo);
        if (await fs.pathExists(photoPath)) {
            await fs.remove(photoPath);
        }
    }
    
    db.volunteers = db.volunteers?.filter(v => v.id !== parseInt(req.params.id)) || [];
    
    db.activity.push({
        id: Date.now(),
        type: 'volunteer_deleted',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Видалено волонтера: ${volunteer ? volunteer.name : 'невідомий'}`
    });
    
    await writeDB(db);
    res.json({ success: true });
});

// ==================== Партнери ====================
app.get('/api/partners', async (req, res) => {
    const db = await readDB();
    if (!db.partners) {
        db.partners = [];
        await writeDB(db);
    }
    // Сортуємо за order
    const sorted = [...db.partners].sort((a, b) => (a.order || 999) - (b.order || 999));
    res.json(sorted.filter(p => p.isActive !== false));
});

app.get('/api/partners/all', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    if (!db.partners) {
        db.partners = [];
        await writeDB(db);
    }
    res.json(db.partners);
});

app.get('/api/partners/:id', async (req, res) => {
    const db = await readDB();
    const partner = db.partners?.find(p => p.id === parseInt(req.params.id));
    if (partner) {
        res.json(partner);
    } else {
        res.status(404).json({ error: 'Партнера не знайдено' });
    }
});

app.post('/api/partners', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    
    if (!db.partners) {
        db.partners = [];
    }
    
    const newPartner = {
        id: Date.now(),
        name: req.body.name,
        description: req.body.description || '',
        website: req.body.website || '',
        logo: null,
        isActive: req.body.isActive !== false,
        order: db.partners.length + 1,
        createdAt: new Date().toISOString()
    };
    
    db.partners.push(newPartner);
    
    db.activity.push({
        id: Date.now(),
        type: 'partner_added',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Додано партнера: ${newPartner.name}`
    });
    
    await writeDB(db);
    res.json(newPartner);
});

app.put('/api/partners/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const index = db.partners?.findIndex(p => p.id === parseInt(req.params.id));
    
    if (index !== -1 && index !== undefined) {
        db.partners[index] = { 
            ...db.partners[index], 
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        
        db.activity.push({
            id: Date.now(),
            type: 'partner_updated',
            user: req.session.username,
            timestamp: new Date().toISOString(),
            details: `Оновлено партнера: ${db.partners[index].name}`
        });
        
        await writeDB(db);
        res.json(db.partners[index]);
    } else {
        res.status(404).json({ error: 'Партнера не знайдено' });
    }
});

app.post('/api/partners/:id/logo', requireAuth, requireAdmin, uploadPartner.single('logo'), async (req, res) => {
    const db = await readDB();
    const index = db.partners?.findIndex(p => p.id === parseInt(req.params.id));
    
    if (index !== -1 && index !== undefined && req.file) {
        if (db.partners[index].logo) {
            const oldLogoPath = path.join(__dirname, db.partners[index].logo);
            if (await fs.pathExists(oldLogoPath)) {
                await fs.remove(oldLogoPath);
            }
        }
        
        const logoPath = '/uploads/partners/' + req.file.filename;
        db.partners[index].logo = logoPath;
        
        await writeDB(db);
        res.json({ success: true, logo: logoPath });
    } else {
        res.status(404).json({ error: 'Партнера не знайдено або лого не завантажено' });
    }
});

app.delete('/api/partners/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const partner = db.partners?.find(p => p.id === parseInt(req.params.id));
    
    if (partner && partner.logo) {
        const logoPath = path.join(__dirname, partner.logo);
        if (await fs.pathExists(logoPath)) {
            await fs.remove(logoPath);
        }
    }
    
    db.partners = db.partners?.filter(p => p.id !== parseInt(req.params.id)) || [];
    
    db.activity.push({
        id: Date.now(),
        type: 'partner_deleted',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Видалено партнера: ${partner ? partner.name : 'невідомий'}`
    });
    
    await writeDB(db);
    res.json({ success: true });
});

// ==================== Сторінка "Як отримати допомогу" ====================
app.get('/api/help-page', async (req, res) => {
    const db = await readDB();
    if (!db.helpPage) {
        db.helpPage = {
            title: 'Як отримати допомогу',
            content: 'Якщо ви військовослужбовець або волонтер, який потребує допомоги, звертайтеся до нас.',
            image: null,
            instructions: [
                'Заповніть онлайн-форму заявки',
                'Наш координатор зв\'яжеться з вами',
                'Підтвердьте потребу',
                'Отримайте допомогу'
            ],
            contacts: {
                phone: '+380 (99) 123-45-67',
                email: 'help@volunteer450.org',
                telegram: '@volunteer450_help'
            }
        };
        await writeDB(db);
    }
    res.json(db.helpPage);
});

app.put('/api/help-page', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    db.helpPage = { ...db.helpPage, ...req.body };
    
    db.activity.push({
        id: Date.now(),
        type: 'help_page_updated',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: 'Оновлено сторінку "Як отримати допомогу"'
    });
    
    await writeDB(db);
    res.json(db.helpPage);
});

app.post('/api/help-page/image', requireAuth, requireAdmin, uploadPhoto.single('image'), async (req, res) => {
    const db = await readDB();
    
    if (req.file) {
        if (db.helpPage.image) {
            const oldImagePath = path.join(__dirname, db.helpPage.image);
            if (await fs.pathExists(oldImagePath)) {
                await fs.remove(oldImagePath);
            }
        }
        
        const imagePath = '/uploads/photos/' + req.file.filename;
        db.helpPage.image = imagePath;
        
        await writeDB(db);
        res.json({ success: true, image: imagePath });
    } else {
        res.status(400).json({ error: 'Файл не завантажено' });
    }
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

// ==================== Соціальні мережі ====================
app.get('/api/social', async (req, res) => {
    const db = await readDB();
    res.json(db.settings.social.filter(s => s.active));
});

app.post('/api/social', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const newSocial = {
        id: Date.now(),
        ...req.body,
        active: true
    };
    
    db.settings.social.push(newSocial);
    
    db.activity.push({
        id: Date.now(),
        type: 'social_added',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Додано соціальну мережу: ${newSocial.platform}`
    });
    
    await writeDB(db);
    res.json(newSocial);
});

app.delete('/api/social/:id', requireAuth, requireAdmin, async (req, res) => {
    const db = await readDB();
    const social = db.settings.social.find(s => s.id === parseInt(req.params.id));
    db.settings.social = db.settings.social.filter(s => s.id !== parseInt(req.params.id));
    
    db.activity.push({
        id: Date.now(),
        type: 'social_deleted',
        user: req.session.username,
        timestamp: new Date().toISOString(),
        details: `Видалено соціальну мережу: ${social ? social.platform : 'невідома'}`
    });
    
    await writeDB(db);
    res.json({ success: true });
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
        totalVolunteers: db.volunteers?.length || 0,
        totalPartners: db.partners?.filter(p => p.isActive !== false).length || 0,
        totalDonors: [...new Set(db.donations.map(d => d.name))].length,
        totalSocial: db.settings.social.filter(s => s.active).length,
        totalMedia: db.collections.reduce((sum, c) => sum + (c.media?.length || 0), 0) +
                   db.reports.reduce((sum, r) => sum + (r.media?.length || 0), 0) +
                   db.news.reduce((sum, n) => sum + (n.media?.length || 0), 0)
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
    ║   Волонтерський штаб 4.5.0               ║
    ║                                          ║
    ║   Головна сторінка: http://localhost:${PORT}  ║
    ║   Адмін-логін: http://localhost:${PORT}/admin-login ║
    ║                                          ║
    ║   Логін: admin                           ║
    ║   Пароль: admin                          ║
    ╚══════════════════════════════════════════╝
    `);
});

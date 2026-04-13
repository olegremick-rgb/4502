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

// ==================== НАЛАШТУВАННЯ ШЛЯХІВ ====================
// ВСІ ДАНІ В ОДНІЙ ПАПЦІ
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Створення всіх необхідних папок
const photosDir = path.join(UPLOADS_DIR, 'photos');
const videosDir = path.join(UPLOADS_DIR, 'videos');
const newsDir = path.join(UPLOADS_DIR, 'news');
const volunteersDir = path.join(UPLOADS_DIR, 'volunteers');
const partnersDir = path.join(UPLOADS_DIR, 'partners');
const backupsDir = path.join(DATA_DIR, 'backups');

// Створюємо всі папки рекурсивно
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(UPLOADS_DIR);
fs.ensureDirSync(photosDir);
fs.ensureDirSync(videosDir);
fs.ensureDirSync(newsDir);
fs.ensureDirSync(volunteersDir);
fs.ensureDirSync(partnersDir);
fs.ensureDirSync(backupsDir);

console.log('=' .repeat(50));
console.log('📁 ГОЛОВНА ПАПКА ДАНИХ:', DATA_DIR);
console.log('📁 ПАПКА ЗАВАНТАЖЕНЬ:', UPLOADS_DIR);
console.log('=' .repeat(50));

// ==================== НАЛАШТУВАННЯ MULTER ====================
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
    origin: ['http://localhost:' + PORT, process.env.FRONTEND_URL],
    credentials: true
}));

app.use('/uploads', express.static(UPLOADS_DIR));

// Налаштування сесій
app.use(session({
    secret: process.env.SESSION_SECRET || 'volunteer-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ==================== БАЗА ДАНИХ ====================
const DB_PATH = path.join(DATA_DIR, 'database.json');

// Функція для бекапу
async function backupDatabase() {
    if (await fs.pathExists(DB_PATH)) {
        const backupPath = path.join(backupsDir, `database_backup_${Date.now()}.json`);
        await fs.copy(DB_PATH, backupPath);
        console.log('📦 Створено бекап бази даних');
        
        // Видаляємо старі бекапи (залишаємо тільки 5 останніх)
        const backups = await fs.readdir(backupsDir);
        if (backups.length > 5) {
            const oldBackups = backups.sort().slice(0, backups.length - 5);
            for (const old of oldBackups) {
                await fs.remove(path.join(backupsDir, old));
            }
        }
    }
}

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
                },
                {
                    id: 2,
                    name: 'Іван Коваленко',
                    role: 'Водій-волонтер',
                    description: 'Доставляє допомогу військовим на передову. За плечима понад 50 виїздів.',
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
        console.log('✅ Базу даних створено в:', DB_PATH);
    } else {
        console.log('📂 Базу даних завантажено з:', DB_PATH);
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

// ==================== ВСІ API ROUTES (ті самі, що були раніше) ====================
// ... (всі ваші API маршрути залишаються без змін)
// Для стислості я не повторюю їх тут, але вони мають бути такими ж як у попередній версії

// ==================== АУТЕНТИФІКАЦІЯ ====================
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

// ==================== СТАТИСТИКА ====================
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

// ==================== ЗАПУСК СЕРВЕРА ====================
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════╗
    ║                                                      ║
    ║      ВОЛОНТЕРСЬКИЙ ШТАБ 4.5.0                        ║
    ║                                                      ║
    ║   🌐 Головна сторінка: http://localhost:${PORT}         ║
    ║   🔐 Адмін-логін: http://localhost:${PORT}/admin-login  ║
    ║                                                      ║
    ║   👤 Логін: admin                                    ║
    ║   🔑 Пароль: admin                                   ║
    ║                                                      ║
    ║   📁 ВСІ ДАНІ ЗБЕРІГАЮТЬСЯ В:                         ║
    ║      ${DATA_DIR}                                       ║
    ║                                                      ║
    ╚══════════════════════════════════════════════════════╝
    `);
});

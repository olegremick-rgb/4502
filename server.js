const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 3000;

// Налаштування multer для завантаження файлів
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, 'logo-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'volunteer-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 години
}));

// База даних (файлове сховище)
const DB_PATH = path.join(__dirname, 'database.json');

// Ініціалізація бази даних
function initDB() {
    if (!fs.existsSync(DB_PATH)) {
        const defaultDB = {
            users: [
                {
                    id: 1,
                    username: 'admin',
                    password: '$2a$10$rJqZx9k5Zk5Zk5Zk5Zk5Zu', // "admin" буде захешовано при першому запуску
                    role: 'superadmin',
                    createdAt: new Date().toISOString()
                }
            ],
            settings: {
                siteName: 'Волонтерська організація 4.5.0',
                logo: '/uploads/default-logo.svg',
                primaryColor: '#4f46e5',
                contacts: {
                    phone: '+380 (99) 123-45-67',
                    email: 'info@volunteer450.org',
                    address: 'м. Київ, Україна'
                },
                social: {
                    facebook: '#',
                    instagram: '#',
                    telegram: '#',
                    youtube: '#'
                }
            },
            collections: [
                {
                    id: 1,
                    name: 'Збір на тепловізори',
                    description: 'Збір коштів на тепловізори для розвідників 95-ї бригади',
                    target: 50000,
                    current: 15750,
                    requisites: '4149 4999 9999 9999',
                    image: '/uploads/collection1.jpg',
                    createdAt: '2024-01-10',
                    status: 'active'
                },
                {
                    id: 2,
                    name: 'Збір на автівку',
                    description: 'Збір на пікап для 93-ї бригади "Холодний Яр"',
                    target: 120000,
                    current: 45000,
                    requisites: '5168 7575 1010 2020',
                    image: '/uploads/collection2.jpg',
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
                    content: 'Придбано 3 тепловізори на суму 45000 грн для розвідників',
                    amount: 45000,
                    date: '2024-01-15',
                    images: ['/uploads/report1.jpg']
                },
                {
                    id: 2,
                    title: 'Передано автівку',
                    content: 'Передано пікап на передову для 93-ї бригади',
                    amount: 120000,
                    date: '2024-01-20',
                    images: []
                }
            ],
            about: {
                content: 'Ми - волонтерська організація 4.5.0, яка допомагає військовим з 2022 року. Наша мета - забезпечити наших захисників усім необхідним для виконання бойових завдань.\n\nКожна гривня, яку ви жертвуєте, йде на потреби військових. Ми публікуємо детальні звіти про всі витрати.',
                stats: {
                    totalRaised: 1500000,
                    successfulCollections: 45,
                    helpedSoldiers: 1200
                }
            },
            activity: []
        };
        
        // Хешування пароля
        const bcrypt = require('bcryptjs');
        const salt = bcrypt.genSaltSync(10);
        defaultDB.users[0].password = bcrypt.hashSync('admin', salt);
        
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2));
    }
}

initDB();

// Допоміжна функція для читання БД
function readDB() {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

// Допоміжна функція для запису БД
function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
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
    const db = readDB();
    const user = db.users.find(u => u.id === req.session.userId);
    if (user && user.role === 'superadmin') {
        next();
    } else {
        res.status(403).json({ error: 'Доступ заборонено' });
    }
}

// ==================== API Routes ====================

// Аутентифікація
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    
    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        
        // Логування активності
        db.activity.push({
            id: Date.now(),
            type: 'login',
            user: username,
            timestamp: new Date().toISOString()
        });
        writeDB(db);
        
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

app.post('/api/logout', (req, res) => {
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

// Збори
app.get('/api/collections', (req, res) => {
    const db = readDB();
    res.json(db.collections);
});

app.get('/api/collections/:id', (req, res) => {
    const db = readDB();
    const collection = db.collections.find(c => c.id === parseInt(req.params.id));
    if (collection) {
        res.json(collection);
    } else {
        res.status(404).json({ error: 'Збір не знайдено' });
    }
});

app.post('/api/collections', requireAuth, requireAdmin, (req, res) => {
    const db = readDB();
    const newCollection = {
        id: Date.now(),
        ...req.body,
        current: 0,
        createdAt: new Date().toISOString().split('T')[0],
        status: 'active'
    };
    
    db.collections.push(newCollection);
    
    // Логування
    db.activity.push({
        id: Date.now(),
        type: 'collection_added',
        collection: newCollection.name,
        user: req.session.username,
        timestamp: new Date().toISOString()
    });
    
    writeDB(db);
    res.json(newCollection);
});

app.put('/api/collections/:id', requireAuth, requireAdmin, (req, res) => {
    const db = readDB();
    const index = db.collections.findIndex(c => c.id === parseInt(req.params.id));
    
    if (index !== -1) {
        db.collections[index] = { ...db.collections[index], ...req.body };
        writeDB(db);
        res.json(db.collections[index]);
    } else {
        res.status(404).json({ error: 'Збір не знайдено' });
    }
});

app.delete('/api/collections/:id', requireAuth, requireAdmin, (req, res) => {
    const db = readDB();
    db.collections = db.collections.filter(c => c.id !== parseInt(req.params.id));
    writeDB(db);
    res.json({ success: true });
});

// Донати
app.get('/api/donations', (req, res) => {
    const db = readDB();
    const { status } = req.query;
    
    let donations = db.donations;
    if (status) {
        donations = donations.filter(d => d.status === status);
    }
    
    // Додаємо інформацію про збір
    donations = donations.map(d => ({
        ...d,
        collection: db.collections.find(c => c.id === d.collectionId)
    }));
    
    res.json(donations);
});

app.post('/api/donations', (req, res) => {
    const db = readDB();
    const newDonation = {
        id: Date.now(),
        ...req.body,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    db.donations.push(newDonation);
    writeDB(db);
    res.json(newDonation);
});

app.put('/api/donations/:id/confirm', requireAuth, requireAdmin, (req, res) => {
    const db = readDB();
    const donationIndex = db.donations.findIndex(d => d.id === parseInt(req.params.id));
    
    if (donationIndex !== -1) {
        db.donations[donationIndex].status = 'confirmed';
        
        // Оновлюємо суму в зборі
        const donation = db.donations[donationIndex];
        const collectionIndex = db.collections.findIndex(c => c.id === donation.collectionId);
        
        if (collectionIndex !== -1) {
            db.collections[collectionIndex].current += donation.amount;
        }
        
        writeDB(db);
        res.json(db.donations[donationIndex]);
    } else {
        res.status(404).json({ error: 'Донат не знайдено' });
    }
});

app.delete('/api/donations/:id', requireAuth, requireAdmin, (req, res) => {
    const db = readDB();
    db.donations = db.donations.filter(d => d.id !== parseInt(req.params.id));
    writeDB(db);
    res.json({ success: true });
});

// Звіти
app.get('/api/reports', (req, res) => {
    const db = readDB();
    res.json(db.reports);
});

app.post('/api/reports', requireAuth, requireAdmin, (req, res) => {
    const db = readDB();
    const newReport = {
        id: Date.now(),
        ...req.body,
        date: new Date().toISOString().split('T')[0]
    };
    
    db.reports.push(newReport);
    writeDB(db);
    res.json(newReport);
});

app.delete('/api/reports/:id', requireAuth, requireAdmin, (req, res) => {
    const db = readDB();
    db.reports = db.reports.filter(r => r.id !== parseInt(req.params.id));
    writeDB(db);
    res.json({ success: true });
});

// Про нас
app.get('/api/about', (req, res) => {
    const db = readDB();
    res.json(db.about);
});

app.put('/api/about', requireAuth, requireAdmin, (req, res) => {
    const db = readDB();
    db.about = { ...db.about, ...req.body };
    writeDB(db);
    res.json(db.about);
});

// Налаштування
app.get('/api/settings', (req, res) => {
    const db = readDB();
    res.json(db.settings);
});

app.put('/api/settings', requireAuth, requireAdmin, (req, res) => {
    const db = readDB();
    db.settings = { ...db.settings, ...req.body };
    writeDB(db);
    res.json(db.settings);
});

app.post('/api/settings/logo', requireAuth, requireAdmin, upload.single('logo'), (req, res) => {
    if (req.file) {
        const db = readDB();
        const logoPath = '/uploads/' + req.file.filename;
        db.settings.logo = logoPath;
        writeDB(db);
        res.json({ logo: logoPath });
    } else {
        res.status(400).json({ error: 'Файл не завантажено' });
    }
});

app.post('/api/settings/credentials', requireAuth, requireAdmin, (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === req.session.userId);
    
    if (userIndex !== -1) {
        if (username) db.users[userIndex].username = username;
        if (password) {
            const salt = bcrypt.genSaltSync(10);
            db.users[userIndex].password = bcrypt.hashSync(password, salt);
        }
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Користувача не знайдено' });
    }
});

// Активність
app.get('/api/activity', requireAuth, requireAdmin, (req, res) => {
    const db = readDB();
    res.json(db.activity.slice(-50).reverse()); // Останні 50 подій
});

// Статистика для дашборду
app.get('/api/stats', requireAuth, requireAdmin, (req, res) => {
    const db = readDB();
    
    const stats = {
        activeCollections: db.collections.filter(c => c.status === 'active').length,
        totalRaised: db.collections.reduce((sum, c) => sum + c.current, 0),
        pendingDonations: db.donations.filter(d => d.status === 'pending').length,
        totalReports: db.reports.length,
        totalDonors: [...new Set(db.donations.map(d => d.name))].length,
        averageDonation: db.donations.length ? 
            (db.donations.reduce((sum, d) => sum + d.amount, 0) / db.donations.length).toFixed(0) : 0
    };
    
    res.json(stats);
});

// ==================== HTML сторінки ====================

// Головна сторінка
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Адмін-панель
app.get('/admin', (req, res) => {
    if (req.session.userId) {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        res.redirect('/admin-login');
    }
});

// Сторінка логіну для адміна
app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущено на порті ${PORT}`);
    console.log(`Головна сторінка: http://localhost:${PORT}`);
    console.log(`Адмін-панель: http://localhost:${PORT}/admin`);
    console.log(`Логін: admin, Пароль: admin`);
});
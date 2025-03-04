const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2");
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Создание подключения к базе данных
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '2886730069',
    database: 'onyx_energo'
});

// Подключение к базе данных
connection.connect((err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных: ' + err.stack);
        return;
    }
    console.log('Подключено к базе данных onyx_energo.');
});

// Функция для аутентификации токена
const authenticateToken = (req, res, next) => {
    const token = req.header("Authorization")?.split(" ")[1];

    if (!token) {
        return res.status(403).json({ error: "Нет токена" });
    }

    jwt.verify(token, 'secret_key', (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: "Неверный токен" });
        }
        req.user = decoded;  // Декодированный токен добавляется в req.user
        next();
    });
};

// Проверка прав администратора
const verifyAdmin = (req, res, next) => {
    if (req.user.isAdmin !== 1) {
        return res.status(403).json({ error: "Нет прав администратора" });
    }
    next();
};

// Маршрут для регистрации
app.post("/register", (req, res) => {
    const { name, email, password } = req.body;

    console.log("Registration request:", { name, email }); // Логируем полученные данные

    const checkQuery = 'SELECT * FROM users WHERE email = ?';
    connection.query(checkQuery, [email], (err, result) => {
        if (err) {
            console.error('Ошибка выполнения запроса: ', err);
            return res.status(500).json({ error: 'Ошибка выполнения запроса' });
        }

        if (result.length > 0) {
            console.log('Пользователь с таким email уже существует');
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                console.error('Ошибка хэширования пароля: ', err);
                return res.status(500).json({ error: 'Ошибка хэширования пароля' });
            }

            const query = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
            connection.query(query, [name, email, hashedPassword], (err, result) => {
                if (err) {
                    console.error('Ошибка регистрации пользователя: ', err);
                    return res.status(500).json({ error: 'Ошибка регистрации пользователя' });
                }
                console.log('Пользователь зарегистрирован успешно');
                res.status(201).json({ message: 'Пользователь зарегистрирован успешно' });
            });
        });
    });
});


// Маршрут для входа
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    const query = 'SELECT * FROM users WHERE email = ?';
    connection.query(query, [email], (err, result) => {
        if (err) {
            console.error('Ошибка выполнения запроса при входе: ', err);
            return res.status(500).json({ error: 'Ошибка входа' });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        bcrypt.compare(password, result[0].password, (err, isMatch) => {
            if (err || !isMatch) {
                return res.status(401).json({ error: 'Неверный пароль' });
            }

            const token = jwt.sign(
                { id: result[0].id, email: result[0].email, isAdmin: result[0].isAdmin }, // Добавляем isAdmin в токен
                'secret_key',
                { expiresIn: '1h' }
            );
            res.status(200).json({ token });
        });
    });
});

// Маршрут для получения данных о текущем пользователе
app.get('/account', authenticateToken, (req, res) => {
    const userId = req.user.id;

    const query = 'SELECT * FROM users WHERE id = ?';
    connection.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Ошибка выполнения запроса:', err);
            return res.status(500).json({ error: 'Ошибка получения данных пользователя' });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        res.json(result[0]);
    });
});

// Пример использования функции проверки прав администратора
app.get("/admin/users", authenticateToken, verifyAdmin, (req, res) => {
    const query = 'SELECT * FROM users';
    connection.query(query, (err, result) => {
        if (err) {
            console.error('Ошибка получения пользователей: ', err);
            return res.status(500).json({ error: 'Ошибка получения пользователей' });
        }
        res.status(200).json(result);
    });
});

// Удаление пользователя
app.delete("/admin/users/:id", authenticateToken, verifyAdmin, (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM users WHERE id = ?';
    connection.query(query, [id], (err, result) => {
        if (err) {
            console.error('Ошибка удаления пользователя: ', err);
            return res.status(500).json({ error: 'Ошибка удаления пользователя' });
        }
        res.status(200).json({ success: true });
    });
});

// Запуск сервера
app.listen(5000, () => {
    console.log("Сервер запущен на порту 5000");
});

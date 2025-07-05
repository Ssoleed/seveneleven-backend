const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3'); // ✅ Use better-sqlite3

const app = express();
const PORT = process.env.PORT || 3001;

// SQLite DB Setup
const db = new Database('./database/bookings.db');

db.prepare(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    date TEXT,
    startTime TEXT,
    endTime TEXT
  )
`).run();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
  secret: 'my_secret_key',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});
app.get('/services.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/services.html'));
});
app.get('/booking', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/booking.html'));
});
app.get('/confirm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/confirm.html'));
});

// Booking POST route
app.post('/booking', (req, res) => {
  const { name, phone, date, startTime, endTime } = req.body;
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);

  // Validation
  if (
    startTime.split(':')[1] !== '00' ||
    endTime.split(':')[1] !== '00' ||
    startHour < 8 || endHour > 21 || startHour >= endHour
  ) {
    return res.status(400).send('Please select valid time slots between 08:00 and 22:00, on the hour.');
  }

  const rows = db.prepare(`SELECT * FROM bookings WHERE date = ?`).all(date);

  const isOverlap = rows.some(booking => {
    const bookedStart = parseInt(booking.startTime.split(':')[0]);
    const bookedEnd = parseInt(booking.endTime.split(':')[0]);
    return (startHour < bookedEnd && endHour > bookedStart);
  });

  if (isOverlap) {
    return res.status(400).send('This time slot is already booked. Please choose another.');
  }

  db.prepare(`
    INSERT INTO bookings (name, phone, date, startTime, endTime)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, phone, date, startTime, endTime);

  res.redirect('https://my7eleven.netlify.app/confirm.html');
});

// Admin login
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === '12345') {
    req.session.loggedIn = true;
    res.redirect('/admin');
  } else {
    res.render('login', { error: 'Invalid credentials' });
  }
});

// Admin view
app.get('/admin', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/login');
  const bookings = db.prepare('SELECT * FROM bookings').all();
  res.render('admin', { bookings });
});

// Delete booking
app.post('/delete-booking/:id', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/login');
  db.prepare(`DELETE FROM bookings WHERE id = ?`).run(req.params.id);
  res.redirect('/admin');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// API for availability
app.get('/api/booked-times', (req, res) => {
  const { date } = req.query;
  const rows = db.prepare(`SELECT startTime, endTime FROM bookings WHERE date = ?`).all(date);

  const slots = rows.map(row => ({
    start: parseInt(row.startTime.split(':')[0]),
    end: parseInt(row.endTime.split(':')[0])
  }));

  res.json(slots);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

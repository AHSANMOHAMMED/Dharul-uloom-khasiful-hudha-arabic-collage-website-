# Dharul Uloom Kashiful Hudha Arabic College - Development Guide

## Quick Start

### Prerequisites
- Node.js 18 or higher
- MongoDB 6 or higher
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/AHSANMOHAMMED/Dharul-uloom-khasiful-hudha-arabic-collage-website-.git
cd Dharul-uloom-khasiful-hudha-arabic-collage-website-
```

2. **Install dependencies**

Frontend:
```bash
npm install
```

Backend:
```bash
cd backend
npm install
```

3. **Setup environment variables**

Create a `.env` file in the `backend` directory:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and configure:
```env
MONGO_URI=mongodb://localhost:27017/kashiful-hudha
PORT=5000
JWT_SECRET=your_secret_key_here
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FRONTEND_URL=http://localhost:3000
```

4. **Start MongoDB**

Make sure MongoDB is running on your system:
```bash
# On Ubuntu/Debian
sudo systemctl start mongodb

# On macOS with Homebrew
brew services start mongodb-community
```

5. **Seed the database**

```bash
cd backend
npm run seed
```

6. **Run the application**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Project Structure

```
├── src/                      # Frontend React application
│   ├── components/          # Reusable components
│   │   ├── Navbar.jsx
│   │   └── Footer.jsx
│   ├── pages/              # Page components
│   │   ├── Home.jsx
│   │   ├── About.jsx
│   │   ├── Courses.jsx
│   │   ├── Admissions.jsx
│   │   ├── Faculty.jsx
│   │   ├── Gallery.jsx
│   │   ├── News.jsx
│   │   └── Contact.jsx
│   ├── utils/              # Utility functions
│   ├── i18n.js             # Internationalization config
│   ├── App.jsx             # Main app component
│   ├── main.jsx            # Entry point
│   └── index.css           # Global styles
│
├── backend/                 # Backend Node.js/Express application
│   ├── models/             # Mongoose models
│   │   ├── User.js
│   │   ├── News.js
│   │   ├── Faculty.js
│   │   └── Contact.js
│   ├── routes/             # API routes
│   │   ├── news.js
│   │   ├── faculty.js
│   │   └── contact.js
│   ├── config/             # Configuration files
│   │   └── db.js
│   ├── seed.js             # Database seeding script
│   └── server.js           # Main server file
│
├── public/                  # Static assets
│   ├── assets/
│   └── images/
│
└── docs/                    # Documentation
```

## Available Scripts

### Frontend

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Backend

```bash
npm start            # Start production server
npm run dev          # Start development server with nodemon
npm run seed         # Seed database with sample data
```

## API Endpoints

### News
- `GET /api/news` - Get all news items
- `GET /api/news/:id` - Get single news item
- `POST /api/news` - Create news item (admin)

### Faculty
- `GET /api/faculty` - Get all faculty members
- `GET /api/faculty/:id` - Get single faculty member
- `POST /api/faculty` - Create faculty member (admin)

### Contact
- `POST /api/contact` - Submit contact form
- `GET /api/contact` - Get all contacts (admin)

## Features

### Bilingual Support
The application supports both English and Arabic with complete RTL (Right-to-Left) support for Arabic text. Use the language toggle in the navigation bar to switch between languages.

### Responsive Design
The website is fully responsive and optimized for:
- Mobile devices (320px+)
- Tablets (768px+)
- Desktops (1024px+)

### SEO Optimized
- Semantic HTML
- Meta tags for social sharing
- Proper heading hierarchy
- Alt text for images

## Deployment

### Frontend (Vercel)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
npm run build
vercel --prod
```

### Backend (Render/Heroku)

1. Create a new web service on Render or Heroku

2. Connect your GitHub repository

3. Set environment variables in the dashboard

4. Deploy

### Database (MongoDB Atlas)

1. Create a free cluster on MongoDB Atlas
2. Get connection string
3. Update `MONGO_URI` in environment variables

## Environment Variables

### Frontend
No environment variables needed for frontend (uses proxy in development)

### Backend
- `MONGO_URI` - MongoDB connection string
- `PORT` - Server port (default: 5000)
- `JWT_SECRET` - Secret key for JWT tokens
- `EMAIL_HOST` - SMTP host for emails
- `EMAIL_PORT` - SMTP port
- `EMAIL_USER` - Email address for sending emails
- `EMAIL_PASS` - Email password/app password
- `FRONTEND_URL` - Frontend URL for CORS

## Troubleshooting

### MongoDB Connection Error
```
Error: MongoDB connection failed
```
**Solution**: Make sure MongoDB is running and the connection string is correct.

### Port Already in Use
```
Error: Port 3000/5000 is already in use
```
**Solution**: Kill the process using the port or use a different port.

### Build Errors
```
Error: Cannot find module
```
**Solution**: Delete `node_modules` and reinstall dependencies.

## Contributing

This is a private project for Dharul Uloom Kashiful Hudha Arabic College. For inquiries or issues, please contact the college administration.

## Support

For technical support or questions:
- Phone: 032-5612355, 070-5668463, 071-5576060
- Facebook: https://www.facebook.com/100088419063008

## License

Copyright © 2024 Dharul Uloom Kashiful Hudha Arabic College. All rights reserved.

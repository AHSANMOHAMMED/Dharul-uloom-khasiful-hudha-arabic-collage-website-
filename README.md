# Dharul Uloom Kashiful Hudha Arabic College

## About
**Dharul Uloom Kashiful Hudha Arabic College** is a preliminary Arabic educational institution focused on Islamic and Arabic studies, located in Mudalippalli, Kalpitiya, Puttalam District, Sri Lanka.

### Key Information
- **Established**: 2004
- **Registered**: February 12, 2008 (Ministry of Religious Affairs)
- **Registration No**: MRCA/13/1/PAS/187
- **Location**: 5P2C+VMC, Mudalippalli, Kalpitiya, Puttalam, Sri Lanka

### Contact
- **Official Phone**: 032-5612355
- **Mobile**: 070-5668463, 071-5576060
- **Facebook**: [Dharul Uloom Kashiful Hudha](https://www.facebook.com/100088419063008)

### Mission
Nurturing faith and knowledge through quality Islamic education, serving as a foundational school for young students in the coastal community of Kalpitiya.

## Project Structure

```
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── pages/             # Page components
│   └── utils/             # Utility functions
├── public/                # Static assets
│   ├── assets/            # General assets
│   └── images/            # Images
├── backend/               # Backend API
│   ├── routes/            # API routes
│   ├── models/            # Database models
│   ├── config/            # Configuration files
│   └── server.js          # Main server file
└── docs/                  # Documentation

```

## Technology Stack

### Frontend
- **Framework**: React.js with Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **Internationalization**: react-i18next (English/Arabic)
- **Forms**: React Hook Form
- **Animations**: Framer Motion
- **SEO**: React Helmet

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Email**: Nodemailer
- **Security**: Helmet, CORS, Rate Limiting

## Getting Started

### Prerequisites
- Node.js 18+ 
- MongoDB 6+
- npm or yarn

### Installation

#### Frontend
```bash
npm install
npm run dev
```

#### Backend
```bash
cd backend
npm install
npm run dev
```

### Environment Variables

Create a `.env` file in the backend directory:

```env
MONGO_URI=mongodb://localhost:27017/kashiful-hudha
PORT=5000
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:3000

# Email (Nodemailer). For Gmail App Passwords use port 465 with EMAIL_SECURE=true.
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your_email
EMAIL_PASS=your_app_password
```

## Features

### Implemented
- Bilingual support (English/Arabic) with RTL
- Responsive design
- User authentication (JWT) with admin/student/parent roles
- Contact form with email notifications
- News and events management
- Faculty profiles
- Course listings
- Online admissions with validation
- 7-year curriculum overview (Classes 1–7)
- Islamic library with search, category filtering, and pagination
- Admin dashboard with analytics (admission stats, content overview)
- Gallery
- Google Maps & WhatsApp integration
- 404 / not-found page
- CI: lint, build, frontend (Vitest) and backend (Jest) test suites

### Planned
- Online payment system
- Learning Management System (LMS)
- Mobile app (PWA)

## Development Phases

1. ✅ **Phase 1**: Project Setup and Planning
2. ✅ **Phase 2**: Design and UI/UX
3. ✅ **Phase 3**: Frontend Development
4. ✅ **Phase 4**: Backend Development and Database
5. ✅ **Phase 5**: Integration, Features, and Testing
6. ✅ **Phase 6**: Deployment and Maintenance

## Deployment

### Frontend
Deploy to Vercel:
```bash
npm run build
vercel --prod
```

### Backend
Deploy to Render or Heroku with MongoDB Atlas connection.

## Contributing
This is a private project for Dharul Uloom Kashiful Hudha Arabic College. For inquiries, please contact the college administration.

## License
Copyright © 2024 Dharul Uloom Kashiful Hudha Arabic College. All rights reserved.

## Acknowledgments
- Ministry of Buddhasasana, Religious & Cultural Affairs, Sri Lanka
- All Ceylon Jamiyyathul Ulama
- The Kalpitiya community

---

**Built with dedication for Islamic education in Sri Lanka** 🕌📚

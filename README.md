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

### Backend (data & auth)
- **Platform**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Legacy**: Express + MongoDB in `backend/` (reference/compatibility service; use `npm run dev:legacy` only if you still need the older API)

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project ([supabase.com](https://supabase.com))
- npm or yarn

### Installation

```bash
cp .env.example .env
# Set VITE_SUPABASE_URL (https://YOUR_REF.supabase.co) and VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

Apply migrations: see [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md).

Legacy Mongo API (optional):

```bash
npm run dev:legacy
```

### Runtime Model

- The **frontend** is the primary app surface.
- **Auth and data access** are expected to come from Supabase.
- The `backend/` folder remains available for legacy routes, but it is not the main path for the current SPA.
- Most production issues will come from **Supabase schema, RLS, and edge functions**, not from React routing.

### Environment Variables

Copy `.env.example` to `.env`. Required for the SPA:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

If you run the legacy backend, also configure `backend/.env` with:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-secret
FRONTEND_URL=http://localhost:5173
```

## Features

### Implemented
- Bilingual support (English/Arabic) with RTL
- Supabase auth with role dashboards (student, parent, tutor, treasurer, principal, librarian, admin)
- Admin CMS for news, faculty, curriculum, gallery, and courses
- Online admissions with validation
- Digital library with Arabic search, bookmarks, in-book search
- PayHere online fee payments (student/parent)
- LMS: materials, assignments, submissions
- PWA: install prompt, offline shell, service worker
- 7-year curriculum, gallery, faculty, news from Supabase
- Google Maps & WhatsApp integration
- CI: lint, build, Vitest

### Optional / external setup
- PayHere merchant account (sandbox available)
- Shamela bulk import (`npm run import:shamela`)
- Legacy Express/Mongo backend for reference only

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

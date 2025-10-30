# Testing Guide

## Prerequisites for Local Testing

### Required Software
- Node.js 18+
- MongoDB 6+ (for backend testing)
- Modern web browser (Chrome, Firefox, Safari)

## Frontend Testing

### Manual Testing

1. **Start Development Server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

2. **Test Navigation**
   - Click all menu items
   - Verify pages load correctly
   - Test mobile menu (resize browser)

3. **Test Language Toggle**
   - Click language button
   - Verify text changes to Arabic
   - Verify RTL layout works
   - Switch back to English

4. **Test Pages**

   **Home Page**
   - Hero section displays correctly
   - Statistics display
   - Call-to-action buttons work
   - WhatsApp link works

   **About Page**
   - History section displays
   - Mission and vision display
   - Key information displays

   **Courses Page**
   - All 5 courses display
   - Course details visible
   - Additional info section shows

   **Admissions Page**
   - Form fields display
   - Form validation works
   - Submit shows success message
   - Required fields validated

   **Faculty Page**
   - Faculty cards display
   - Names in both languages
   - Qualifications show

   **Gallery Page**
   - Images display
   - Facebook link works

   **News Page**
   - News items display
   - Dates formatted correctly
   - Category badges show

   **Contact Page**
   - Contact information displays
   - Google Maps loads
   - WhatsApp button works
   - Contact form works
   - Form validation works

5. **Test Responsive Design**
   - Test on mobile (320px)
   - Test on tablet (768px)
   - Test on desktop (1024px+)

### Build Testing

```bash
npm run build
npm run preview
```

Verify production build works correctly.

### Lint Testing

```bash
npm run lint
```

Fix any linting errors.

## Backend Testing

### Without MongoDB (Quick Test)

If MongoDB is not installed, you can still test the basic server:

1. Comment out MongoDB connection in `backend/server.js`:
   ```javascript
   // connectDB();
   ```

2. Start server:
   ```bash
   cd backend
   npm start
   ```

3. Test root endpoint:
   ```bash
   curl http://localhost:5000
   ```

   Should return:
   ```json
   {
     "message": "Dharul Uloom Kashiful Hudha Arabic College API",
     "version": "1.0.0",
     "endpoints": {...}
   }
   ```

### With MongoDB (Full Test)

1. **Install MongoDB**
   
   Ubuntu/Debian:
   ```bash
   sudo apt-get install mongodb
   sudo systemctl start mongodb
   ```

   macOS:
   ```bash
   brew install mongodb-community
   brew services start mongodb-community
   ```

2. **Verify MongoDB Running**
   ```bash
   mongosh
   ```

3. **Seed Database**
   ```bash
   cd backend
   npm run seed
   ```

4. **Start Backend**
   ```bash
   npm run dev
   ```

5. **Test Endpoints**

   **News API**
   ```bash
   # Get all news
   curl http://localhost:5000/api/news
   
   # Should return array of news items
   ```

   **Faculty API**
   ```bash
   # Get all faculty
   curl http://localhost:5000/api/faculty
   
   # Should return array of faculty members
   ```

   **Contact API**
   ```bash
   # Submit contact form
   curl -X POST http://localhost:5000/api/contact \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test User",
       "email": "test@example.com",
       "message": "Test message"
     }'
   
   # Should return success response
   ```

## Integration Testing

### Full Stack Test

1. Start backend (Terminal 1):
   ```bash
   cd backend
   npm run dev
   ```

2. Start frontend (Terminal 2):
   ```bash
   npm run dev
   ```

3. **Test News Page**
   - Open http://localhost:3000/news
   - Should display news from database
   - Verify 3 news items appear

4. **Test Faculty Page**
   - Open http://localhost:3000/faculty
   - Should display 5 faculty members
   - Verify names and qualifications

5. **Test Contact Form**
   - Open http://localhost:3000/contact
   - Fill out form
   - Submit
   - Check backend logs for email attempt
   - Verify success message appears

## Browser Compatibility Testing

Test in:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

## Performance Testing

### Lighthouse Audit

1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Run audit
4. Target scores:
   - Performance: 90+
   - Accessibility: 90+
   - Best Practices: 90+
   - SEO: 90+

### Bundle Size

```bash
npm run build
```

Check `dist/` folder size. Should be under 1 MB total.

## Accessibility Testing

1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Verify focus indicators visible
   - Test form submission with Enter key

2. **Screen Reader**
   - Enable screen reader (VoiceOver on Mac, NVDA on Windows)
   - Navigate through pages
   - Verify content is announced correctly

3. **Color Contrast**
   - Verify text is readable
   - Check Islamic green (#0F5132) against white
   - Check gold (#FFD700) against green

## Security Testing

1. **XSS Prevention**
   - Try submitting `<script>alert('xss')</script>` in forms
   - Should be sanitized

2. **CORS**
   - Try API calls from different origin
   - Should be blocked

3. **Rate Limiting**
   - Make 100+ API calls rapidly
   - Should be rate limited

## Common Issues

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### MongoDB Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution**: Start MongoDB service

### Dependencies Not Found

```bash
# Delete and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build Errors

```bash
# Clean build
rm -rf dist
npm run build
```

## Test Checklist

### Before Deployment

- [ ] All pages load without errors
- [ ] Language toggle works
- [ ] Navigation works on mobile
- [ ] Forms validate correctly
- [ ] Forms submit successfully
- [ ] API endpoints respond
- [ ] Database operations work
- [ ] Responsive design works
- [ ] WhatsApp link works
- [ ] Facebook link works
- [ ] Google Maps loads
- [ ] No console errors
- [ ] Build succeeds
- [ ] Linter passes
- [ ] Images load correctly
- [ ] Colors display correctly
- [ ] Fonts load correctly
- [ ] RTL layout works for Arabic

### After Deployment

- [ ] Production site loads
- [ ] SSL certificate active
- [ ] All pages accessible
- [ ] API calls work
- [ ] Forms submit to production backend
- [ ] Email notifications work
- [ ] Database operations work
- [ ] Analytics tracking
- [ ] Performance acceptable
- [ ] Mobile responsive

## Automated Testing (Future)

### Unit Tests (To be implemented)

```bash
npm test
```

Example test files to create:
- `src/components/__tests__/Navbar.test.jsx`
- `src/pages/__tests__/Home.test.jsx`
- `backend/routes/__tests__/news.test.js`

### E2E Tests (To be implemented)

Using Cypress:
```bash
npm run test:e2e
```

Example test scenarios:
- User can navigate to all pages
- User can toggle language
- User can submit contact form
- User can submit admission form
- Faculty page loads data from API
- News page loads data from API

## Reporting Issues

If you find bugs:
1. Check console for errors
2. Check network tab in DevTools
3. Document steps to reproduce
4. Take screenshots
5. Report to development team

## Support

For testing support:
- Development Guide: docs/DEVELOPMENT.md
- Deployment Guide: docs/DEPLOYMENT.md
- GitHub Issues: [repository]/issues

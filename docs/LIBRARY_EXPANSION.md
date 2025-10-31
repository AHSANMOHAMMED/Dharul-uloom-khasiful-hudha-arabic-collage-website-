# Library Expansion Guide
## Comprehensive Documentation for Adding Books to Dharul Uloom Kashiful Hudha Library

This guide provides three approaches to expand the Islamic library system with authenticated, curriculum-relevant books.

---

## Table of Contents
1. [Option 1: Manual Curation](#option-1-manual-curation)
2. [Option 2: Public Domain Sources](#option-2-public-domain-sources)
3. [Option 3: Institutional Partnership](#option-3-institutional-partnership)
4. [Admin Book Management](#admin-book-management)
5. [Bulk Import Procedures](#bulk-import-procedures)
6. [Legal & Copyright Considerations](#legal--copyright-considerations)

---

## Option 1: Manual Curation

### Overview
Manually select and add specific books relevant to the 7-year curriculum. This ensures quality control and legal compliance.

### Step-by-Step Process

#### 1. Book Selection
**Criteria for Selection:**
- Relevance to curriculum (Classes 1-7)
- Appropriate for age group (5-12 years)
- Authentic Islamic scholarship
- Available in Arabic, Urdu, or English
- Public domain or properly licensed

**Recommended Books by Category:**

**Tafsir (Quranic Commentary):**
- Tafsir al-Jalalayn (Jalaluddin al-Mahalli & Jalaluddin al-Suyuti)
- Tafsir Ibn Kathir (Ismail ibn Kathir)
- Tafsir al-Qurtubi (Al-Qurtubi)
- Safwat al-Tafsir (Muhammad Ali al-Sabuni)
- Tafsir al-Baghawi (Al-Baghawi)

**Hadith:**
- Sahih al-Bukhari (Muhammad al-Bukhari)
- Sahih Muslim (Muslim ibn al-Hajjaj)
- Riyad as-Salihin (Imam Nawawi)
- Al-Muwatta (Imam Malik)
- 40 Hadith Nawawi (Imam Nawawi)

**Fiqh (Islamic Jurisprudence):**
- Al-Hidaya (Al-Marghinani) - Hanafi
- Mukhtasar al-Quduri (Al-Quduri) - Hanafi
- Nur al-Idah (Al-Shurunbulali) - Hanafi
- Bidayat al-Mujtahid (Ibn Rushd)
- Minhaj al-Talibin (Imam Nawawi) - Shafi'i

**Aqidah (Islamic Creed):**
- Kitab al-Tawhid (Muhammad ibn Abd al-Wahhab)
- Aqeedah al-Tahawiyyah (Al-Tahawi)
- Al-Fiqh al-Akbar (Imam Abu Hanifa)
- Sharh al-Aqeedah al-Tahawiyyah (Ibn Abi al-Izz)

**Sira (Prophetic Biography):**
- Ar-Raheeq al-Makhtum (Safi-ur-Rahman Mubarakpuri)
- Sirat Ibn Hisham (Ibn Hisham)
- Sirat Ibn Ishaq (Ibn Ishaq)
- Al-Shifa (Qadi Iyad)

**Arabic Grammar:**
- Al-Ajurrumiyyah (Ibn Ajurrum)
- Qanoon-e-Sarf (Various authors)
- Nahw al-Wadih (Ali al-Jarim)
- Sharh Ibn Aqil (Ibn Aqil)

#### 2. Source Identification

**Where to Find Books:**

**A. Internet Archive (archive.org)**
- URL: https://archive.org/details/islamicbookslibrary
- 41+ million items, many Islamic texts
- Public domain books freely downloadable
- Search: "Islamic books PDF" or specific titles

**B. Shamela.ws**
- URL: https://shamela.ws/
- 8,000+ Arabic Islamic texts
- Categorized by subject
- Free download with registration

**C. Open Library (openlibrary.org)**
- URL: https://openlibrary.org/
- Metadata and cover images
- Some full-text books
- API available for bulk data

**D. Darussalam Publishers**
- URL: https://darussalampublishers.com/
- Authentic Urdu/English translations
- Purchase or contact for educational licensing
- High-quality publications

**E. Maktabah Shamila (Al-Maktabah Al-Shamilah)**
- Desktop software with 7,000+ books
- Free download: http://shamela.ws/
- Export books as PDF

#### 3. Book Download & Verification

**Download Checklist:**
- [ ] Verify book is public domain or licensed
- [ ] Download in PDF format (preferred)
- [ ] Check PDF quality (readable, complete)
- [ ] Verify author and publication details
- [ ] Ensure language matches curriculum needs
- [ ] Scan for any copyright notices

**File Naming Convention:**
```
[Category]_[Author_LastName]_[Book_Title]_[Language]_[Year].pdf

Examples:
Tafsir_Jalalayn_Tafsir_al_Jalalayn_Arabic_1465.pdf
Hadith_Bukhari_Sahih_al_Bukhari_Arabic_846.pdf
Fiqh_Marghinani_Al_Hidaya_Urdu_1197.pdf
```

#### 4. Metadata Collection

**Required Fields:**
```json
{
  "title": "Tafsir al-Jalalayn",
  "author": "Jalaluddin al-Mahalli & Jalaluddin al-Suyuti",
  "category": "Tafsir",
  "description": {
    "en": "A concise classical tafsir of the Quran...",
    "ar": "تفسير مختصر للقرآن الكريم..."
  },
  "year": 1465,
  "language": ["Arabic", "Urdu"],
  "publisher": "Dar al-Kutub al-Ilmiyyah",
  "isbn": "978-2-7451-1234-5",
  "pages": 500,
  "assignedToClasses": [6, 7],
  "pdfUrl": "/pdfs/tafsir_jalalayn.pdf",
  "coverUrl": "/covers/tafsir_jalalayn.jpg"
}
```

#### 5. Adding to Database

**Using Admin Dashboard:**
1. Login as admin: `/login`
2. Navigate to: `/admin/library`
3. Click "Add New Book"
4. Fill in all metadata fields
5. Upload PDF and cover image
6. Assign to relevant classes
7. Click "Save Book"

**Using Import Script:**
```bash
cd backend
node scripts/importBooks.js books.json
```

### Quality Control Checklist

Before adding each book:
- [ ] Verified authenticity of scholarship
- [ ] Checked copyright status
- [ ] Confirmed age-appropriateness
- [ ] Ensured curriculum alignment
- [ ] Validated PDF quality
- [ ] Completed all metadata
- [ ] Assigned to correct classes
- [ ] Tested PDF link works
- [ ] Cover image displays properly
- [ ] Bilingual descriptions added

---

## Option 2: Public Domain Sources

### Bulk Download from Shamela.ws

**Setup:**
1. Create account at https://shamela.ws/
2. Download Maktabah Shamela software
3. Install on Windows/Mac

**Bulk Export:**
1. Open Maktabah Shamela
2. Select category (e.g., "Tafsir")
3. Select multiple books
4. Export as PDF
5. Save to organized folders

**Automated Script (Advanced):**
```python
# Example: Bulk download script for Internet Archive
# Requires: internetarchive Python package

from internetarchive import get_item

islamic_books = [
    'sahih-al-bukhari',
    'sahih-muslim',
    'tafsir-ibn-kathir',
    # Add more identifiers
]

for book_id in islamic_books:
    item = get_item(book_id)
    for file in item.files:
        if file['name'].endswith('.pdf'):
            file.download()
```

### Recommended Collections

**Internet Archive Collections:**
- Islamic Books Library: https://archive.org/details/islamicbookslibrary
- Arabic Manuscripts: https://archive.org/details/arabic-manuscripts
- Islamic Studies: https://archive.org/details/islamic-studies

**Categories to Prioritize:**
1. Tafsir (20+ books)
2. Hadith (25+ books)
3. Fiqh (20+ books)
4. Aqidah (15+ books)
5. Sira (15+ books)
6. Arabic Grammar (15+ books)

---

## Option 3: Institutional Partnership

### Partnering with Noor-Book.com

#### Step 1: Initial Contact

**Email Template:**

```
Subject: Educational Partnership Request - Dharul Uloom Kashiful Hudha Arabic College

Dear Noor-Book Team,

I am writing on behalf of Dharul Uloom Kashiful Hudha Arabic College, a preliminary Arabic educational institution in Kalpitiya, Sri Lanka (Reg. No. MRCA/13/1/PAS/187).

We are developing a comprehensive digital library system for our 7-year Islamic curriculum, serving 100+ students aged 5-12. We are interested in exploring an institutional partnership with Noor-Book.com to provide our students with access to authenticated Islamic texts.

**About Our Institution:**
- Established: 2004 (Registered: 2008)
- Location: Mudalippalli, Kalpitiya, Puttalam District, Sri Lanka
- Focus: Quran memorization, Arabic grammar, Islamic studies
- Curriculum: Based on Dars-e-Nizami and Sri Lankan standards

**Our Needs:**
- Access to 100-200 Islamic books across categories: Tafsir, Hadith, Fiqh, Aqidah, Sira, Arabic Grammar
- Suitable for preliminary level (ages 5-12)
- Arabic, Urdu, and English language texts
- Digital format (PDF) for online library system

**Partnership Possibilities:**
1. Institutional subscription or licensing
2. API access for our library platform
3. Bulk book purchase at educational rate
4. Content sharing agreement

We would appreciate the opportunity to discuss how we can collaborate to benefit our students' Islamic education.

Contact:
Name: [Your Name]
Position: [Your Position]
Phone: 032-5612355 / 070-5668463
Email: admin@kashifulhudha.lk

Jazakallah Khair,
[Your Name]
Dharul Uloom Kashiful Hudha Arabic College
```

#### Step 2: Negotiation Points

**What to Ask For:**
- Educational institution discount (30-50%)
- Multi-user access license
- API integration capabilities
- Bulk download permissions
- Perpetual license vs. subscription

**What to Offer:**
- Credit/attribution on website
- Case study for their marketing
- Testimonial from educators
- Long-term partnership commitment

#### Step 3: Technical Integration

Once partnership is established:

**API Integration (if available):**
```javascript
// Example API integration
const getNoorBooks = async (category) => {
  const response = await fetch(`https://api.noor-book.com/books?category=${category}`, {
    headers: {
      'Authorization': `Bearer ${NOOR_API_KEY}`,
      'X-Institution': 'Kashiful-Hudha'
    }
  });
  return response.json();
};
```

**Bulk Import:**
1. Request CSV/JSON export of licensed books
2. Map their fields to your schema
3. Run import script
4. Verify all books display correctly

---

## Admin Book Management

### Using the Admin Dashboard

#### Accessing Book Management

1. **Login as Admin:**
   - URL: `https://yoursite.com/login`
   - Email: `admin@kashifulhudha.lk`
   - Password: `admin123` (change after first login!)

2. **Navigate to Library:**
   - Click "Admin Dashboard" in navbar
   - Select "Library Management" from sidebar
   - Or direct URL: `https://yoursite.com/admin/library`

#### Adding a Single Book

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Title | Text | Yes | Full book title |
| Title (Arabic) | Text | No | Arabic title |
| Author | Text | Yes | Author name |
| Category | Dropdown | Yes | Tafsir, Hadith, Fiqh, etc. |
| Description (EN) | Textarea | Yes | English description |
| Description (AR) | Textarea | No | Arabic description |
| Year | Number | Yes | Publication year |
| Languages | Multi-select | Yes | Arabic, Urdu, English |
| Publisher | Text | No | Publisher name |
| ISBN | Text | No | ISBN number |
| Pages | Number | No | Total pages |
| Assigned Classes | Multi-select | Yes | Classes 1-7 |
| PDF File | File Upload | Yes | Max 50MB |
| Cover Image | File Upload | No | Max 5MB, JPG/PNG |

**Steps:**
1. Click "Add New Book" button
2. Fill in all required fields
3. Upload PDF and cover image
4. Select assigned classes
5. Click "Save Book"
6. Verify book appears in library

#### Editing Existing Books

1. Find book in admin library list
2. Click "Edit" button
3. Modify fields
4. Click "Update Book"

#### Deleting Books

1. Find book in admin library list
2. Click "Delete" button
3. Confirm deletion (cannot be undone!)

#### Bulk Actions

- **Select Multiple:** Check boxes next to books
- **Assign to Class:** Bulk assign to curriculum
- **Change Category:** Bulk category update
- **Export:** Download selected as CSV

---

## Bulk Import Procedures

### CSV Import Format

**Template File: `books_import_template.csv`**

```csv
title,author,category,description_en,description_ar,year,languages,publisher,isbn,pages,assignedClasses,pdfUrl,coverUrl
"Tafsir al-Jalalayn","Jalaluddin al-Mahalli","Tafsir","A concise classical tafsir...","تفسير مختصر...",1465,"Arabic,Urdu","Dar al-Kutub","978-2-7451-1234-5",500,"6,7","/pdfs/tafsir_jalalayn.pdf","/covers/tafsir_jalalayn.jpg"
"Sahih al-Bukhari","Muhammad al-Bukhari","Hadith","The most authentic hadith collection...","أصح كتب الحديث...",846,"Arabic","Dar al-Salam","978-9960-899-63-1",2000,"5,6,7","/pdfs/sahih_bukhari.pdf","/covers/sahih_bukhari.jpg"
```

### JSON Import Format

**Template File: `books_import.json`**

```json
[
  {
    "title": "Tafsir al-Jalalayn",
    "author": "Jalaluddin al-Mahalli & Jalaluddin al-Suyuti",
    "category": "Tafsir",
    "description": {
      "en": "A concise classical tafsir of the Quran by two Jalals...",
      "ar": "تفسير مختصر للقرآن الكريم من قبل الجلالين..."
    },
    "year": 1465,
    "language": ["Arabic", "Urdu"],
    "publisher": "Dar al-Kutub al-Ilmiyyah",
    "isbn": "978-2-7451-1234-5",
    "pages": 500,
    "assignedToClasses": [6, 7],
    "pdfUrl": "/pdfs/tafsir_jalalayn.pdf",
    "coverUrl": "/covers/tafsir_jalalayn.jpg"
  }
]
```

### Import Script Usage

**Command Line:**
```bash
# CSV Import
cd backend
node scripts/importBooksCSV.js books_import.csv

# JSON Import
node scripts/importBooksJSON.js books_import.json

# With validation
node scripts/importBooksJSON.js books_import.json --validate

# Dry run (test without importing)
node scripts/importBooksJSON.js books_import.json --dry-run
```

**Output:**
```
✓ Validating 50 books...
✓ All books valid
✓ Importing books to database...
✓ Imported: Tafsir al-Jalalayn (ID: 507f1f77bcf86cd799439011)
✓ Imported: Sahih al-Bukhari (ID: 507f1f77bcf86cd799439012)
...
✓ Successfully imported 50 books
✗ Failed: 2 books (see errors.log)

Summary:
- Total: 50 books
- Success: 48 books
- Failed: 2 books
- Duration: 12.3 seconds
```

---

## Legal & Copyright Considerations

### Understanding Copyright

**Public Domain Books:**
- Published before 1928 (in most countries)
- Author died 70+ years ago
- Explicitly released to public domain
- Government-published works (varies by country)

**Licensed Books:**
- Creative Commons licenses (check specific terms)
- Educational use licenses
- Open access publications
- Institutionally licensed content

### Safe Practices

**DO:**
- ✅ Use books from Internet Archive marked "Public Domain"
- ✅ Download from Shamela.ws (explicitly allows educational use)
- ✅ Purchase books for institutional use
- ✅ Contact publishers for educational licensing
- ✅ Keep records of all permissions
- ✅ Attribute authors and publishers properly

**DON'T:**
- ❌ Mass download from commercial sites without permission
- ❌ Scrape/crawl websites that prohibit it
- ❌ Share copyrighted books publicly
- ❌ Bypass paywalls or DRM
- ❌ Claim others' work as your own

### Sri Lankan Copyright Law

**Copyright Act No. 52 of 1979 (amended 2003):**
- Copyright lasts 70 years after author's death
- Educational use exemption for "criticism, review, or news reporting"
- Libraries can make copies for preservation
- Fair use for education limited to small excerpts

**Best Practice:**
- Obtain explicit permission for full books
- Use public domain sources when possible
- Keep documentation of all permissions

### Record Keeping

**Maintain a spreadsheet:**

| Book Title | Author | Source | License | Permission Date | Contact | Notes |
|------------|--------|--------|---------|-----------------|---------|-------|
| Tafsir al-Jalalayn | Al-Mahalli | Internet Archive | Public Domain | N/A | N/A | Pre-1928 |
| Modern Tafsir | John Doe | Publisher X | Educational License | 2024-01-15 | john@publisher.com | Expires 2026 |

---

## Sample Book List (50+ Books Ready to Add)

### Tafsir (10 books)
1. Tafsir al-Jalalayn - Jalaluddin al-Mahalli & al-Suyuti (1465)
2. Tafsir Ibn Kathir - Ismail ibn Kathir (1373)
3. Tafsir al-Qurtubi - Al-Qurtubi (1273)
4. Tafsir al-Tabari - Muhammad ibn Jarir al-Tabari (923)
5. Tafsir al-Baghawi - Al-Baghawi (1122)
6. Safwat al-Tafsir - Muhammad Ali al-Sabuni (1981)
7. Tafsir al-Nasafi - Al-Nasafi (1310)
8. Tafsir al-Khazin - Ala al-Din al-Khazin (1341)
9. Tafsir al-Razi - Fakhr al-Din al-Razi (1210)
10. Tafsir al-Zamakhshari - Al-Zamakhshari (1144)

### Hadith (10 books)
1. Sahih al-Bukhari - Muhammad al-Bukhari (846)
2. Sahih Muslim - Muslim ibn al-Hajjaj (875)
3. Sunan Abi Dawud - Abu Dawud (889)
4. Sunan al-Tirmidhi - Al-Tirmidhi (892)
5. Sunan al-Nasai - Al-Nasai (915)
6. Sunan Ibn Majah - Ibn Majah (887)
7. Al-Muwatta - Imam Malik (795)
8. Riyad as-Salihin - Imam Nawawi (1270)
9. 40 Hadith Nawawi - Imam Nawawi (1270)
10. Bulugh al-Maram - Ibn Hajar (1449)

### Fiqh (10 books)
1. Al-Hidaya (4 volumes) - Al-Marghinani (1197)
2. Mukhtasar al-Quduri - Al-Quduri (1037)
3. Nur al-Idah - Al-Shurunbulali (1619)
4. Bidayat al-Mujtahid - Ibn Rushd (1198)
5. Al-Mughni - Ibn Qudamah (1223)
6. Minhaj al-Talibin - Imam Nawawi (1277)
7. Umdat al-Salik - Ibn Naqib (1368)
8. Al-Ashbah wa al-Nazair - Al-Suyuti (1505)
9. Sharh al-Muhalla - Ibn Hazm (1064)
10. Fatawa Alamgiri - Various (1672)

### Aqidah (8 books)
1. Kitab al-Tawhid - Muhammad ibn Abd al-Wahhab (1780)
2. Aqeedah al-Tahawiyyah - Al-Tahawi (933)
3. Al-Fiqh al-Akbar - Imam Abu Hanifa (767)
4. Sharh al-Aqeedah al-Tahawiyyah - Ibn Abi al-Izz (1390)
5. Al-Aqida al-Wasitiyyah - Ibn Taymiyyah (1328)
6. Kitab al-Iman - Ibn Taymiyyah (1328)
7. Usul al-Din - Al-Ghazali (1111)
8. Al-Aqida al-Nasafiyyah - Al-Nasafi (1142)

### Sira (7 books)
1. Ar-Raheeq al-Makhtum - Safi-ur-Rahman Mubarakpuri (1976)
2. Sirat Ibn Hisham - Ibn Hisham (833)
3. Sirat Ibn Ishaq - Ibn Ishaq (761)
4. Al-Shifa - Qadi Iyad (1149)
5. Zad al-Maad - Ibn Qayyim (1350)
6. Hayatus Sahabah - Muhammad Yusuf Kandhlawi (1964)
7. Al-Bidaya wa al-Nihaya - Ibn Kathir (1373)

### Arabic Grammar (8 books)
1. Al-Ajurrumiyyah - Ibn Ajurrum (1323)
2. Qanoon-e-Sarf - Various authors
3. Nahw al-Wadih - Ali al-Jarim & Mustafa Amin (1940)
4. Sharh Ibn Aqil - Ibn Aqil (1367)
5. Qatr al-Nada - Ibn Hisham (1360)
6. Alfiyyah Ibn Malik - Ibn Malik (1274)
7. Hidayat al-Nahw - Various authors
8. Nuzhat al-Taraf - Al-Maydani (1124)

---

## Support & Resources

### Contact

For assistance with library expansion:
- **Email:** admin@kashifulhudha.lk
- **Phone:** 032-5612355 / 070-5668463
- **Location:** Mudalippalli, Kalpitiya, Puttalam District, Sri Lanka

### Technical Support

For technical issues with the library system:
- **GitHub Issues:** [Repository URL]
- **Documentation:** `/docs/`
- **Admin Guide:** `/docs/ADMIN_GUIDE.md`

### Useful Links

- **Internet Archive Islamic Books:** https://archive.org/details/islamicbookslibrary
- **Shamela.ws:** https://shamela.ws/
- **Open Library:** https://openlibrary.org/
- **Darussalam Publishers:** https://darussalampublishers.com/
- **Noor-Book:** https://www.noor-book.com/

---

## Appendix

### A. Import Script Code

See `backend/scripts/importBooksJSON.js` for full implementation.

### B. Book Metadata Schema

See `backend/models/Book.js` for complete schema definition.

### C. Category List

Full list of supported categories in library system.

### D. Language Codes

ISO 639-1 codes used in the system: `ar` (Arabic), `ur` (Urdu), `en` (English)

---

**Last Updated:** October 31, 2024  
**Version:** 1.0  
**Maintainer:** Dharul Uloom Kashiful Hudha IT Department

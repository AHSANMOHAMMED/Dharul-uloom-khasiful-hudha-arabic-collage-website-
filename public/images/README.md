# Image Directory Structure

This directory contains all images for the Dharul Uloom Kashiful Hudha Arabic College website.

## Directory Structure

```
images/
├── hero/           # Homepage hero/banner images
├── gallery/        # Gallery page images
│   ├── events/     # Event photos
│   └── facilities/ # Building and classroom photos
├── faculty/        # Teacher profile photos
└── events/         # News and event images
```

## How to Add Images from Facebook

### Step 1: Download Images from Facebook
1. Visit: https://web.facebook.com/profile.php?id=100088419063008
2. Go to the "Photos" section
3. Download relevant images:
   - Building/campus photos → `hero/` folder
   - Event photos → `gallery/events/` folder
   - Classroom/facility photos → `gallery/facilities/` folder
   - Faculty photos → `faculty/` folder

### Step 2: Image Naming Convention
Use descriptive, lowercase names with hyphens:

**Hero Images (Homepage):**
- `main-building-front.jpg`
- `campus-entrance.jpg`
- `mosque-exterior.jpg`

**Gallery Events:**
- `quran-competition-2024.jpg`
- `graduation-ceremony-2024.jpg`
- `eid-celebration-2024.jpg`
- `hafiz-celebration-109th.jpg`
- `admissions-day-2025.jpg`

**Gallery Facilities:**
- `classroom-1.jpg`
- `classroom-2.jpg`
- `library-interior.jpg`
- `prayer-hall.jpg`
- `campus-courtyard.jpg`

**Faculty Photos:**
- `principal-alimuddin.jpg`
- `teacher-arabic.jpg`
- `teacher-quran.jpg`
- `teacher-hadith.jpg`
- `teacher-fiqh.jpg`

### Step 3: Image Optimization
Before uploading, optimize images for web:
- **Format**: Use JPG for photos, PNG for graphics
- **Size**: Maximum 1920px width for hero, 800px for gallery
- **Quality**: 80-85% compression
- **Tools**: 
  - Online: TinyPNG.com, Squoosh.app
  - Desktop: ImageMagick, GIMP

### Step 4: Place Images
1. Copy images to appropriate folders
2. Refresh the website - images will automatically appear
3. No code changes needed!

## Supported Formats
- JPG/JPEG (recommended for photos)
- PNG (for graphics with transparency)
- WebP (modern format, best compression)

## Image Requirements
- **Hero Images**: 1920x1080px or similar landscape ratio
- **Gallery Images**: 800x600px minimum
- **Faculty Photos**: 400x400px square or portrait
- **File Size**: Keep under 500KB per image

## Example Setup

After downloading from Facebook, your structure should look like:

```
public/images/
├── hero/
│   ├── main-building-front.jpg
│   ├── campus-entrance.jpg
│   └── mosque-exterior.jpg
├── gallery/
│   ├── events/
│   │   ├── quran-competition-2024.jpg
│   │   ├── graduation-ceremony-2024.jpg
│   │   └── hafiz-celebration-109th.jpg
│   └── facilities/
│       ├── classroom-1.jpg
│       ├── library-interior.jpg
│       └── prayer-hall.jpg
├── faculty/
│   ├── principal-alimuddin.jpg
│   └── teacher-arabic.jpg
└── events/
    └── admissions-2025.jpg
```

## Notes
- The website will gracefully show placeholders if images are missing
- Add alt text in the image filename (automatic from name)
- Copyright: Ensure you have permission to use Facebook photos
- Bilingual: Image names don't need Arabic - titles come from translations

## Contact for Help
If you need assistance with image setup:
- Email: admin@kashifulhudha.lk
- Phone: 032-5612355

# Public images — Kashiful Hudha

## Layout

```
images/
├── logo.png              # Official circular emblem (nav, footer)
├── logo.svg              # Fallback vector mark
├── icon.svg              # Favicon / PWA
└── campus/               # Drop more campus & event photos here
    ├── building.jpg      # Main white college building (home hero)
    ├── gate.jpg          # Entrance gate
    └── emblem.png        # Emblem crop for gallery
```

## Adding photos from Facebook

1. Download photos from [the college Facebook page](https://www.facebook.com/100088419063008).
2. Put them in `public/images/campus/` with short lowercase names, e.g. `event-graduation-2025.jpg`.
3. Optionally add them in Admin → Content CMS → Gallery (preferred for captions EN/AR), or extend the fallback list in `src/pages/Gallery.jsx`.

## Tips

- Prefer JPG for photos; PNG for the logo.
- Hero / wide photos: ~1920px wide, under ~500KB if possible.
- Gallery: ~1200px wide is enough.

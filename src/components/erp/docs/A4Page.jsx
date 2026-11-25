import { forwardRef } from 'react';

const PAGE_DIMS = {
  A3: { w: 297, h: 420 },
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
};

/**
 * A print-proportional page (A4 / A5 / A3, Portrait / Landscape) with optional letterhead background.
 */
const A4Page = forwardRef(function A4Page({ letterhead, bgUrl, paperSize = 'A4', orientation = null, children, className = '' }, ref) {
  const dim = PAGE_DIMS[paperSize] || PAGE_DIMS.A4;
  const landscape = (orientation || letterhead?.orientation) === 'landscape';
  const W = landscape ? dim.h : dim.w;
  const H = landscape ? dim.w : dim.h;
  const pct = (mm, fallback) => `${(((mm ?? fallback) / W) * 100).toFixed(3)}%`;
  return (
    <div
      ref={ref}
      className={`relative mx-auto bg-white shadow-manuscript-md border border-sand-border ${className}`}
      style={{
        width: '100%',
        maxWidth: `${W}mm`,
        aspectRatio: `${W} / ${H}`,
        minHeight: 'fit-content',
        backgroundImage: bgUrl ? `url("${bgUrl}")` : undefined,
        backgroundSize: '100% auto',
        backgroundRepeat: 'repeat-y',
        paddingTop: pct(letterhead?.margin_top_mm, 20),
        paddingBottom: pct(letterhead?.margin_bottom_mm, 20),
        paddingLeft: pct(letterhead?.margin_left_mm, 20),
        paddingRight: pct(letterhead?.margin_right_mm, 20),
      }}
    >
      {children}
    </div>
  );
});

export default A4Page;

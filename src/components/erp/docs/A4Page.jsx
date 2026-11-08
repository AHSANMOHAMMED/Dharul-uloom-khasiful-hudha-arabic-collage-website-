import { forwardRef } from 'react';

/**
 * An A4 sheet with the letterhead as its background. Margins are given in mm
 * and converted to % of the page width so the writable area lines up with the
 * printed letterhead at any screen width.
 */
const A4Page = forwardRef(function A4Page({ letterhead, bgUrl, children, className = '' }, ref) {
  const landscape = letterhead?.orientation === 'landscape';
  const W = landscape ? 297 : 210;
  const H = landscape ? 210 : 297;
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

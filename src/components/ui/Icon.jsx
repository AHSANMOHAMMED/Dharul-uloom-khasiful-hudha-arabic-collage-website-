/**
 * Universal SVG Icon component.
 *
 * Resolves icon identifiers (Material Symbols names or standard icon names)
 * into high-fidelity, crisp SVG vectors.
 *
 * Features:
 * - 0% external font dependency (immune to font blocking, ad blockers, network latency)
 * - Scalable with CSS font-size (em units) or Tailwind width/height classes
 * - Clean geometric fallback (never outputs raw ligature text strings)
 */
export default function Icon({ name, className = '', size, ...props }) {
  const iconKey = (name || '').trim().toLowerCase();

  const getGlyph = () => {
    switch (iconKey) {
      // Dashboards & Navigation
      case 'dashboard':
      case 'space_dashboard':
        return (
          <>
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </>
        );

      case 'school':
      case 'tutors':
        return (
          <>
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </>
        );

      case 'calendar_month':
      case 'calendar':
      case 'today':
      case 'event':
      case 'edit_calendar':
        return (
          <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <circle cx="8" cy="14" r="1" fill="currentColor" />
            <circle cx="12" cy="14" r="1" fill="currentColor" />
            <circle cx="16" cy="14" r="1" fill="currentColor" />
            <circle cx="8" cy="18" r="1" fill="currentColor" />
            <circle cx="12" cy="18" r="1" fill="currentColor" />
          </>
        );

      case 'event_available':
        return (
          <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <path d="m9 16 2 2 4-4" />
          </>
        );

      case 'event_busy':
        return (
          <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <path d="m15 13-6 6m0-6 6 6" />
          </>
        );

      case 'groups':
      case 'diversity_3':
      case 'group':
        return (
          <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </>
        );

      case 'badge':
      case 'person':
      case 'person_book':
      case 'assignment_ind':
        return (
          <>
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <circle cx="12" cy="9" r="2.5" />
            <path d="M8 16a4 4 0 0 1 8 0" />
            <path d="M9 3v-1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
          </>
        );

      case 'payments':
      case 'credit_card':
      case 'point_of_sale':
      case 'request_quote':
      case 'money_off':
      case 'account_balance_wallet':
      case 'account_balance':
        return (
          <>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
            <circle cx="7" cy="15" r="1.5" fill="currentColor" />
            <line x1="13" y1="15" x2="18" y2="15" />
          </>
        );

      case 'receipt_long':
      case 'receipt':
      case 'description':
      case 'summarize':
        return (
          <>
            <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" />
            <line x1="8" y1="7" x2="16" y2="7" />
            <line x1="8" y1="11" x2="16" y2="11" />
            <line x1="8" y1="15" x2="13" y2="15" />
          </>
        );

      case 'volunteer_activism':
      case 'welfare':
      case 'health_and_safety':
      case 'self_improvement':
      case 'heart':
        return (
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        );

      case 'filter_alt':
      case 'filter':
      case 'tune':
        return <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />;

      case 'apartment':
      case 'corporate_fare':
      case 'hostel':
        return (
          <>
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <path d="M9 22v-4h6v4" />
            <line x1="8" y1="6" x2="8.01" y2="6" />
            <line x1="12" y1="6" x2="12.01" y2="6" />
            <line x1="16" y1="6" x2="16.01" y2="6" />
            <line x1="8" y1="10" x2="8.01" y2="10" />
            <line x1="12" y1="10" x2="12.01" y2="10" />
            <line x1="16" y1="10" x2="16.01" y2="10" />
            <line x1="8" y1="14" x2="8.01" y2="14" />
            <line x1="12" y1="14" x2="12.01" y2="14" />
            <line x1="16" y1="14" x2="16.01" y2="14" />
          </>
        );

      case 'workspace_premium':
      case 'verified':
      case 'grade':
        return (
          <>
            <circle cx="12" cy="8" r="6" />
            <path d="m15.48 12.89 1.52 8.53a.5.5 0 0 1-.72.52L12 19.7l-4.28 2.24a.5.5 0 0 1-.72-.52l1.52-8.53" />
          </>
        );

      case 'analytics':
      case 'insights':
        return (
          <>
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </>
        );

      case 'hub':
        return (
          <>
            <circle cx="12" cy="12" r="3" />
            <circle cx="5" cy="6" r="2" />
            <circle cx="19" cy="6" r="2" />
            <circle cx="5" cy="18" r="2" />
            <circle cx="19" cy="18" r="2" />
            <path d="m6.5 7.5 3.5 3M17.5 7.5 14 10.5M6.5 16.5 10 13.5M17.5 16.5 14 13.5" />
          </>
        );

      case 'policy':
      case 'shield':
      case 'shield_person':
      case 'shield_lock':
      case 'verified_user':
      case 'encrypted':
        return (
          <>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </>
        );

      case 'gavel':
      case 'discipline':
        return (
          <>
            <path d="m14 13-7.5 7.5a2.12 2.12 0 1 1-3-3L11 10" />
            <path d="m16 16 6-6M8 8l6-6M9 7l8 8" />
          </>
        );

      case 'folder':
        return (
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
        );

      case 'quiz':
      case 'fact_check':
      case 'assignment':
        return (
          <>
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </>
        );

      case 'mail':
      case 'invitations':
        return (
          <>
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </>
        );

      case 'how_to_reg':
      case 'person_add':
      case 'link':
        return (
          <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </>
        );

      case 'view_kanban':
      case 'tasks':
        return (
          <>
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M8 7v7M12 7v4M16 7v9" />
          </>
        );

      case 'upload_file':
      case 'note_add':
      case 'post_add':
      case 'imports':
        return (
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </>
        );

      case 'explore':
      case 'crm':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </>
        );

      case 'auto_stories':
      case 'menu_book':
      case 'local_library':
      case 'library':
      case 'library_add':
        return (
          <>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </>
        );

      case 'chat':
      case 'forum':
      case 'help_center':
      case 'messages':
        return (
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        );

      case 'send':
        return (
          <>
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </>
        );

      case 'done':
        return <polyline points="20 6 9 17 4 12" />;

      case 'done_all':
        return (
          <>
            <polyline points="18 6 7 17 2 12" />
            <polyline points="22 10 13.5 18.5 11 16" />
          </>
        );

      case 'logout':
        return (
          <>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </>
        );

      case 'menu':
        return (
          <>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </>
        );

      case 'close':
        return (
          <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </>
        );

      case 'search':
        return (
          <>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </>
        );

      case 'search_off':
        return (
          <>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="4" y1="4" x2="20" y2="20" />
          </>
        );

      case 'check_circle':
      case 'check':
        return (
          <>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </>
        );

      case 'warning':
        return (
          <>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </>
        );

      case 'error':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </>
        );

      case 'info':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </>
        );

      case 'arrow_back':
        return (
          <>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </>
        );

      case 'arrow_forward':
        return (
          <>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </>
        );

      case 'chevron_right':
        return <polyline points="9 18 15 12 9 6" />;

      case 'chevron_left':
        return <polyline points="15 18 9 12 15 6" />;

      case 'chevron_down':
      case 'expand_more':
        return <polyline points="6 9 12 15 18 9" />;

      case 'open_in_new':
        return (
          <>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </>
        );

      case 'download':
        return (
          <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </>
        );

      case 'print':
        return (
          <>
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </>
        );

      case 'translate':
        return (
          <>
            <path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1" />
            <path d="m22 22-5-10-5 10M14 18h6" />
          </>
        );

      case 'public':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </>
        );

      case 'campaign':
      case 'broadcast':
        return (
          <>
            <path d="m3 11 18-5v12L3 13v-2z" />
            <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
          </>
        );

      case 'settings':
        return (
          <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </>
        );

      case 'smartphone':
        return (
          <>
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </>
        );

      case 'add':
        return (
          <>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </>
        );

      case 'undo':
        return (
          <>
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </>
        );

      case 'inbox':
        return (
          <>
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </>
        );

      case 'notifications':
      case 'notifications_active':
      case 'bell':
        return (
          <>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </>
        );

      case 'auto_awesome':
      case 'sparkles':
        return (
          <>
            <path d="m12 3 1.91 5.09L19 10l-5.09 1.91L12 17l-1.91-5.09L5 10l5.09-1.91L12 3z" />
            <path d="m19 17 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
          </>
        );

      case 'delete':
      case 'trash':
        return (
          <>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </>
        );

      case 'schedule':
      case 'time':
      case 'clock':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </>
        );

      case 'lock':
        return (
          <>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </>
        );

      case 'refresh':
        return (
          <>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </>
        );

      case 'hourglass_top':
      case 'hourglass_empty':
      case 'hourglass':
        return (
          <>
            <path d="M5 22h14" />
            <path d="M5 2h14" />
            <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
            <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
          </>
        );

      case 'waving_hand':
        return (
          <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        );

      case 'admin_panel_settings':
        return (
          <>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <circle cx="12" cy="11" r="2.5" />
            <path d="M9 17a3 3 0 0 1 6 0" />
          </>
        );

      case 'family_restroom':
        return (
          <>
            <circle cx="8" cy="6" r="2.5" />
            <path d="M4 20v-5a3 3 0 0 1 6 0v5" />
            <circle cx="16" cy="7" r="2" />
            <path d="M13 20v-4a2.5 2.5 0 0 1 5 0v4" />
          </>
        );

      case 'pending_actions':
        return (
          <>
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 14" />
          </>
        );

      case 'swap_horiz':
        return (
          <>
            <polyline points="8 4 4 8 8 12" />
            <line x1="4" y1="8" x2="16" y2="8" />
            <polyline points="16 20 20 16 16 12" />
            <line x1="20" y1="16" x2="8" y2="16" />
          </>
        );

      case 'pin':
      case 'push_pin':
        return (
          <>
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-2l-2-3V5a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7l-2 3v2z" />
          </>
        );

      case 'history_edu':
      case 'manuscript':
        return (
          <>
            <path d="M19 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h12V3z" />
            <line x1="7" y1="7" x2="15" y2="7" />
            <line x1="7" y1="11" x2="15" y2="11" />
            <line x1="7" y1="15" x2="12" y2="15" />
          </>
        );

      case 'picture_as_pdf':
      case 'pdf':
        return (
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="13" y2="17" />
          </>
        );

      case 'visibility':
      case 'eye':
      case 'view':
        return (
          <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </>
        );

      case 'visibility_off':
      case 'eye_off':
        return (
          <>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </>
        );

      case 'table_view':
      case 'grid':
      case 'spreadsheet':
        return (
          <>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M3 15h18M9 9v12M15 9v12" />
          </>
        );

      case 'share':
        return (
          <>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </>
        );

      case 'photo_library':
      case 'gallery':
        return (
          <>
            <rect x="3" y="3" width="14" height="14" rx="2" />
            <circle cx="7.5" cy="7.5" r="1.5" />
            <path d="m17 13-4-4-6 6" />
            <path d="M21 7v12a2 2 0 0 1-2 2H7" />
          </>
        );

      case 'person_search':
        return (
          <>
            <circle cx="10" cy="7" r="4" />
            <path d="M4 21v-2a4 4 0 0 1 4-4h4" />
            <circle cx="18" cy="16" r="3" />
            <line x1="20.5" y1="18.5" x2="22" y2="20" />
          </>
        );

      case 'mark_email_read':
        return (
          <>
            <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            <path d="m16 19 2 2 4-4" />
          </>
        );

      case 'lock_reset':
      case 'reset_password':
        return (
          <>
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <rect x="9" y="11" width="6" height="5" rx="1" />
            <path d="M10 11V9a2 2 0 1 1 4 0v2" />
          </>
        );

      case 'key':
        return (
          <>
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="m12 11 8-8" />
            <path d="m17 5 3 3" />
            <path d="m15 7 2 2" />
          </>
        );

      case 'help_outline':
      case 'help':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </>
        );

      case 'flag':
        return (
          <>
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </>
        );

      case 'cancel':
      case 'dismiss':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </>
        );

      case 'article':
        return (
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </>
        );

      case 'zoom_in':
        return (
          <>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </>
        );

      // Clean default geometric glyph: crisp bullet circle (NEVER text)
      case 'circle':
      default:
        return <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />;
    }
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width={size || '1em'}
      height={size || '1em'}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`inline-block shrink-0 align-middle ${className}`}
      {...props}
    >
      {getGlyph()}
    </svg>
  );
}

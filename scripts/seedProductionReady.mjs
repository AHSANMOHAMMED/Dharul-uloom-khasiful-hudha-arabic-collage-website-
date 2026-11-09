#!/usr/bin/env node
/**
 * Production-ready demo seed (service-role only — no DIRECT_URL required).
 *
 * Creates / updates all duty-role demo accounts, fixes super_admin,
 * and seeds academic / fee / attendance / LMS / hostel / announcement rows
 * so every portal and ERP module has something real to show.
 *
 *   node scripts/seedProductionReady.mjs
 *
 * Requires SUPABASE_URL (or VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL / VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const DEMO_USERS = [
  {
    email: 'student.demo@kashiful-hudha.test',
    password: 'DemoStudent@2026',
    fullName: 'Ahmad Abdullah (Demo)',
    accountType: 'student',
    role: 'user',
    indexNumber: 'KASHIF-2026-001',
    classNumber: 5,
    phone: '0700000001',
  },
  {
    email: 'parent.demo@kashiful-hudha.test',
    password: 'DemoParent@2026',
    fullName: 'Parent Demo Account',
    accountType: 'parent',
    role: 'user',
    phone: '0700000002',
  },
  {
    email: 'tutor.demo@kashiful-hudha.test',
    password: 'DemoTutor@2026',
    fullName: 'Ustadh Demo Tutor',
    accountType: 'tutor',
    role: 'user',
    phone: '0700000003',
  },
  {
    email: 'principal.demo@kashiful-hudha.test',
    password: 'DemoPrincipal@2026',
    fullName: 'Dr. Sheikh Abdullah (Principal Demo)',
    accountType: 'tutor',
    role: 'user',
    duty: 'principal',
    phone: '0700000004',
  },
  {
    email: 'vp.demo@kashiful-hudha.test',
    password: 'DemoVP@2026',
    fullName: 'Ustadh Yusuf (Vice Principal Demo)',
    accountType: 'tutor',
    role: 'user',
    duty: 'vice_principal',
    phone: '0700000005',
  },
  {
    email: 'treasurer.demo@kashiful-hudha.test',
    password: 'DemoTreasurer@2026',
    fullName: 'Mawlana Rauf (Treasurer Demo)',
    accountType: 'tutor',
    role: 'user',
    duty: 'treasurer',
    phone: '0700000006',
  },
  {
    email: 'accountant.demo@kashiful-hudha.test',
    password: 'DemoAccountant@2026',
    fullName: 'Sister Fatima (Accountant Demo)',
    accountType: 'staff',
    role: 'user',
    duty: 'accountant',
    phone: '0700000007',
  },
  {
    email: 'hr.demo@kashiful-hudha.test',
    password: 'DemoHR@2026',
    fullName: 'Ustadh Imran (HR Manager Demo)',
    accountType: 'staff',
    role: 'user',
    duty: 'hr_manager',
    phone: '0700000008',
  },
  {
    email: 'admissions.demo@kashiful-hudha.test',
    password: 'DemoAdmissions@2026',
    fullName: 'Sister Amina (Admissions Demo)',
    accountType: 'staff',
    role: 'user',
    duty: 'admissions_officer',
    phone: '0700000009',
  },
  {
    email: 'warden.demo@kashiful-hudha.test',
    password: 'DemoWarden@2026',
    fullName: 'Ustadh Bilal (Warden Demo)',
    accountType: 'staff',
    role: 'user',
    duty: 'warden',
    phone: '0700000010',
  },
  {
    email: 'counselor.demo@kashiful-hudha.test',
    password: 'DemoCounselor@2026',
    fullName: 'Sister Maryam (Counselor Demo)',
    accountType: 'staff',
    role: 'user',
    duty: 'counselor',
    phone: '0700000011',
  },
  {
    email: 'exam.demo@kashiful-hudha.test',
    password: 'DemoExam@2026',
    fullName: 'Ustadh Hassan (Exam Officer Demo)',
    accountType: 'tutor',
    role: 'user',
    duty: 'exam_officer',
    phone: '0700000012',
  },
  {
    email: 'librarian.demo@kashiful-hudha.test',
    password: 'DemoLibrarian@2026',
    fullName: 'Ustadh Farooq (Librarian Demo)',
    accountType: 'tutor',
    role: 'librarian',
    phone: '0700000013',
  },
  {
    email: 'admin.demo@kashiful-hudha.test',
    password: 'DemoAdmin@2026',
    fullName: 'Chief Administrator (Demo)',
    accountType: 'guest',
    role: 'admin',
    phone: '0700000014',
  },
  {
    email: 'superadmin.demo@kashiful-hudha.test',
    password: 'DemoSuperAdmin@2026',
    fullName: 'Global Super Admin (Demo)',
    accountType: 'guest',
    role: 'super_admin',
    phone: '0700000015',
  },
];

async function unwrap(label, { data, error }) {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function findAuthUserId(email) {
  // Paginate lightly — demo orgs are small.
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function upsertAuthUser(user) {
  const existingId = await findAuthUserId(user.email);
  const meta = {
    full_name: user.fullName,
    account_type: user.accountType,
    index_number: user.indexNumber || null,
    phone: user.phone || null,
  };
  if (existingId) {
    await unwrap(
      `update ${user.email}`,
      await sb.auth.admin.updateUserById(existingId, {
        password: user.password,
        email_confirm: true,
        user_metadata: meta,
      })
    );
    return existingId;
  }
  const created = await unwrap(
    `create ${user.email}`,
    await sb.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: meta,
    })
  );
  return created.user.id;
}

async function syncProfile(userId, user, orgId) {
  const patch = {
    id: userId,
    email: user.email,
    full_name: user.fullName,
    role: user.role || 'user',
    account_type: user.accountType,
    is_approved: true,
    index_number: user.indexNumber || null,
    class_number: user.classNumber || null,
    phone: user.phone || null,
    assigned_tutor_role: user.duty || 'none',
    extra_roles: [],
    org_id: orgId,
  };
  // Prefer update (trigger-safe for service role); insert if missing.
  const { data: existing } = await sb.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (existing) {
    await unwrap(`profile ${user.email}`, await sb.from('profiles').update(patch).eq('id', userId));
  } else {
    await unwrap(`profile insert ${user.email}`, await sb.from('profiles').insert(patch));
  }
  if (user.indexNumber) {
    await sb
      .from('valid_index_numbers')
      .upsert(
        {
          index_number: user.indexNumber,
          is_registered: true,
          student_name: user.fullName,
          class_number: user.classNumber || null,
          org_id: orgId,
        },
        { onConflict: 'index_number' }
      );
  }
}

async function ensureOrg() {
  const { data: orgs } = await sb.from('organizations').select('id, slug').limit(5);
  if (orgs?.length) return orgs[0].id;
  const created = await unwrap(
    'create org',
    await sb
      .from('organizations')
      .insert({
        slug: 'kashiful-hudha',
        name_en: 'Dharul Uloom Kashiful Hudha Arabic College',
        name_ar: 'دار العلوم كاشف الهدى',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
        country: 'LK',
        status: 'active',
      })
      .select('id')
      .single()
  );
  return created.id;
}

async function seedAcademic(orgId, ids) {
  // Academic year
  let { data: year } = await sb.from('academic_years').select('*').eq('org_id', orgId).eq('is_current', true).maybeSingle();
  if (!year) {
    year = await unwrap(
      'academic_year',
      await sb
        .from('academic_years')
        .insert({
          org_id: orgId,
          name: '2026/1447',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          is_current: true,
          status: 'active',
        })
        .select('*')
        .single()
    );
  }

  const subjectDefs = [
    { code: 'ARB101', name_en: 'Arabic Grammar', name_ar: 'النحو', category: 'language' },
    { code: 'QUR101', name_en: 'Quran Recitation', name_ar: 'التجويد', category: 'quran' },
    { code: 'FIQ101', name_en: 'Fiqh', name_ar: 'الفقه', category: 'fiqh' },
    { code: 'HAD101', name_en: 'Hadith', name_ar: 'الحديث', category: 'hadith' },
  ];
  const subjects = [];
  for (const def of subjectDefs) {
    const { data: existing } = await sb.from('subjects').select('*').eq('org_id', orgId).eq('code', def.code).maybeSingle();
    if (existing) subjects.push(existing);
    else {
      subjects.push(
        await unwrap(
          `subject ${def.code}`,
          await sb.from('subjects').insert({ org_id: orgId, ...def, is_active: true }).select('*').single()
        )
      );
    }
  }

  for (const subject of subjects) {
    const { data: link } = await sb
      .from('class_subjects')
      .select('id,tutor_id')
      .eq('org_id', orgId)
      .eq('class_number', 5)
      .eq('subject_id', subject.id)
      .maybeSingle();
    if (!link) {
      await unwrap(
        `class_subject ${subject.code}`,
        await sb.from('class_subjects').insert({
          org_id: orgId,
          class_number: 5,
          subject_id: subject.id,
          tutor_id: ids.tutor || ids.exam || null,
          academic_year_id: year.id,
          weekly_periods: 4,
        })
      );
    } else if (ids.tutor && link.tutor_id !== ids.tutor) {
      await sb.from('class_subjects').update({ tutor_id: ids.tutor }).eq('id', link.id);
    }
  }

  // Timetable for class 5
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  for (let i = 0; i < subjects.length; i += 1) {
    const day = days[i % days.length];
    const subject = subjects[i];
    const { data: row } = await sb
      .from('class_schedules')
      .select('id,tutor_id')
      .eq('org_id', orgId)
      .eq('class_number', 5)
      .eq('day_of_week', day)
      .eq('subject', subject.name_en)
      .maybeSingle();
    if (!row) {
      await unwrap(
        `schedule ${subject.code}`,
        await sb.from('class_schedules').insert({
          org_id: orgId,
          tutor_id: ids.tutor,
          class_number: 5,
          subject: subject.name_en,
          subject_id: subject.id,
          day_of_week: day,
          start_time: '08:00',
          end_time: '09:00',
          room: 'Hall A',
          academic_year: 2026,
        })
      );
    } else if (ids.tutor && row.tutor_id !== ids.tutor) {
      await sb.from('class_schedules').update({ tutor_id: ids.tutor }).eq('id', row.id);
    }
  }

  return { year, subjects };
}

async function seedStudentRecord(orgId, studentId, parentId) {
  await unwrap(
    'student_details',
    await sb.from('student_details').upsert(
      {
        profile_id: studentId,
        org_id: orgId,
        admission_no: 'ADM-2026-001',
        admission_date: '2026-01-15',
        date_of_birth: '2012-05-10',
        gender: 'male',
        nationality: 'Sri Lankan',
        address: 'Mudalippalli',
        city: 'Kalpitiya',
        guardian_name: 'Parent Demo Account',
        guardian_relationship: 'father',
        guardian_phone: '0700000002',
        status: 'active',
      },
      { onConflict: 'profile_id' }
    )
  );

  if (parentId) {
    await unwrap(
      'parent_children',
      await sb.from('parent_children').upsert(
        { parent_id: parentId, child_id: studentId, org_id: orgId },
        { onConflict: 'parent_id,child_id' }
      )
    );
  }
}

async function seedFees(orgId, studentId, categories) {
  const tuition = categories.find((c) => /tuition|fee|school/i.test(c.name_en || c.code || '')) || categories[0];
  if (tuition) {
    const { data: structure } = await sb
      .from('fee_structures')
      .select('id')
      .eq('org_id', orgId)
      .eq('class_number', 5)
      .eq('fee_category_id', tuition.id)
      .maybeSingle();
    if (!structure) {
      await unwrap(
        'fee_structure',
        await sb.from('fee_structures').insert({
          org_id: orgId,
          class_number: 5,
          fee_category_id: tuition.id,
          amount: 5000,
          frequency: 'monthly',
          due_day: 10,
          is_active: true,
        })
      );
    }
  }

  const months = ['2026-06', '2026-07', '2026-08'];
  for (const month of months) {
    const { data: existing } = await sb
      .from('student_fees')
      .select('id')
      .eq('student_id', studentId)
      .eq('month', month)
      .maybeSingle();
    if (!existing) {
      await unwrap(
        `fee ${month}`,
        await sb.from('student_fees').insert({
          org_id: orgId,
          student_id: studentId,
          month,
          total_due: 5000,
          paid_amount: 0,
          status: 'unpaid',
          due_date: `${month}-10`,
          currency: 'LKR',
        })
      );
    }
  }
}

async function seedAttendanceAndResults(orgId, ids, subjects, year) {
  const studentId = ids.student;
  const tutorId = ids.tutor || ids.exam;
  if (!studentId) return;

  // Last 10 school days attendance
  for (let i = 1; i <= 10; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (d.getDay() === 5 || d.getDay() === 6) continue; // Fri/Sat off-ish
    const date = d.toISOString().slice(0, 10);
    const status = i === 3 ? 'late' : i === 7 ? 'absent' : 'present';
    const { data: row } = await sb
      .from('attendance')
      .select('id')
      .eq('student_id', studentId)
      .eq('date', date)
      .maybeSingle();
    if (!row) {
      await sb.from('attendance').insert({
        org_id: orgId,
        student_id: studentId,
        date,
        status,
        marked_by: tutorId || null,
      });
    }
  }

  let { data: exam } = await sb
    .from('exams')
    .select('*')
    .eq('org_id', orgId)
    .eq('name', 'Mid-Year Assessment 2026')
    .maybeSingle();
  if (!exam) {
    exam = await unwrap(
      'exam',
      await sb
        .from('exams')
        .insert({
          org_id: orgId,
          academic_year_id: year.id,
          name: 'Mid-Year Assessment 2026',
          exam_type: 'midterm',
          class_number: 5,
          start_date: '2026-06-01',
          end_date: '2026-06-10',
          status: 'published',
          published_at: new Date().toISOString(),
          created_by: ids.exam || ids.principal || tutorId,
        })
        .select('*')
        .single()
    );
  } else if (!exam.published_at) {
    await sb
      .from('exams')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', exam.id);
  }

  for (const subject of subjects) {
    const { data: linked } = await sb
      .from('exam_subjects')
      .select('id')
      .eq('exam_id', exam.id)
      .eq('subject_id', subject.id)
      .maybeSingle();
    if (!linked) {
      await sb.from('exam_subjects').insert({
        org_id: orgId,
        exam_id: exam.id,
        subject_id: subject.id,
        max_marks: 100,
        pass_marks: 40,
      });
    }

    const marks = 70 + (subject.code.charCodeAt(0) % 20);
    const { data: existing } = await sb
      .from('student_results')
      .select('id')
      .eq('student_id', studentId)
      .eq('exam_id', exam.id)
      .eq('subject_id', subject.id)
      .maybeSingle();
    if (!existing) {
      await sb.from('student_results').insert({
        org_id: orgId,
        student_id: studentId,
        exam_id: exam.id,
        exam_name: exam.name,
        subject_id: subject.id,
        subject: subject.name_en,
        marks_obtained: marks,
        max_marks: 100,
        grade: marks >= 80 ? 'A' : marks >= 70 ? 'B' : 'C',
        entered_by: ids.exam || tutorId,
      });
    }
  }
}

async function seedLms(orgId, ids) {
  if (!ids.tutor) return;
  const { data: assignment } = await sb
    .from('lms_assignments')
    .select('id')
    .eq('org_id', orgId)
    .eq('title', 'Nahw worksheet 1')
    .maybeSingle();
  if (!assignment) {
    await sb.from('lms_assignments').insert({
      org_id: orgId,
      tutor_id: ids.tutor,
      class_number: 5,
      subject: 'Arabic Grammar',
      title: 'Nahw worksheet 1',
      description: 'Complete exercises 1–10 from the class notes.',
      due_date: new Date(Date.now() + 7 * 864e5).toISOString(),
    });
  }
  const { data: material } = await sb
    .from('lms_materials')
    .select('id')
    .eq('org_id', orgId)
    .eq('title', 'Fiqh reading list')
    .maybeSingle();
  if (!material) {
    await sb.from('lms_materials').insert({
      org_id: orgId,
      tutor_id: ids.tutor,
      class_number: 5,
      subject: 'Fiqh',
      title: 'Fiqh reading list',
      description: 'Core chapters for this term.',
      link_url: 'https://kashifulhudha.lk/library',
    });
  }
}

async function seedCampus(orgId, ids) {
  let { data: hostel } = await sb.from('hostels').select('*').eq('org_id', orgId).maybeSingle();
  if (!hostel) {
    hostel = await unwrap(
      'hostel',
      await sb
        .from('hostels')
        .insert({
          org_id: orgId,
          name: 'Main Boys Hostel',
          gender: 'male',
          warden_id: ids.warden || null,
          address: 'Mudalippalli, Kalpitiya',
          is_active: true,
        })
        .select('*')
        .single()
    );
  }
  let { data: room } = await sb.from('hostel_rooms').select('*').eq('hostel_id', hostel.id).eq('room_no', 'B-12').maybeSingle();
  if (!room) {
    room = await unwrap(
      'hostel_room',
      await sb
        .from('hostel_rooms')
        .insert({ org_id: orgId, hostel_id: hostel.id, room_no: 'B-12', capacity: 4, monthly_fee: 1500, is_active: true })
        .select('*')
        .single()
    );
  }
  if (ids.student) {
    const { data: alloc } = await sb
      .from('hostel_allocations')
      .select('id')
      .eq('student_id', ids.student)
      .maybeSingle();
    if (!alloc) {
      await sb.from('hostel_allocations').insert({
        org_id: orgId,
        student_id: ids.student,
        room_id: room.id,
        start_date: '2026-01-15',
        status: 'active',
      });
    }
  }

  // Announcement
  const author = ids.principal || ids.admin || ids.tutor;
  if (author) {
    const { data: ann } = await sb
      .from('announcements')
      .select('id')
      .eq('org_id', orgId)
      .eq('title', 'Welcome to the 2026 academic term')
      .maybeSingle();
    if (!ann) {
      await sb.from('announcements').insert({
        org_id: orgId,
        author_id: author,
        title: 'Welcome to the 2026 academic term',
        body: 'Classes begin next week. Parents may review fees and results in the portal and mobile app.',
        target_roles: [],
        is_pinned: true,
      });
    }
  }

  // Staff leave types
  for (const lt of [
    { code: 'ANNUAL', name: 'Annual leave', days_per_year: 14, is_paid: true },
    { code: 'SICK', name: 'Sick leave', days_per_year: 7, is_paid: true },
  ]) {
    const { data: row } = await sb.from('staff_leave_types').select('id').eq('org_id', orgId).eq('code', lt.code).maybeSingle();
    if (!row) {
      await sb.from('staff_leave_types').insert({ org_id: orgId, ...lt, is_active: true });
    }
  }
}

async function main() {
  console.log('Seeding production-ready demo data…');
  const orgId = await ensureOrg();
  console.log('Org:', orgId);

  const ids = {};
  for (const user of DEMO_USERS) {
    const id = await upsertAuthUser(user);
    await syncProfile(id, user, orgId);
    const key =
      user.duty ||
      (user.role === 'super_admin'
        ? 'superadmin'
        : user.role === 'admin'
          ? 'admin'
          : user.role === 'librarian'
            ? 'librarian'
            : user.accountType);
    ids[key] = id;
    if (user.accountType === 'tutor' && !user.duty) ids.tutor = id;
    if (user.accountType === 'student') ids.student = id;
    if (user.accountType === 'parent') ids.parent = id;
    console.log(`✅ ${String(key).padEnd(18)} ${user.email}`);
  }

  const { data: categories } = await sb.from('fee_categories').select('*').eq('org_id', orgId);
  const { year, subjects } = await seedAcademic(orgId, ids);
  await seedStudentRecord(orgId, ids.student, ids.parent);
  await seedFees(orgId, ids.student, categories || []);
  await seedAttendanceAndResults(orgId, ids, subjects, year);
  await seedLms(orgId, ids);
  await seedCampus(orgId, ids);

  console.log('\nDemo credentials:');
  for (const u of DEMO_USERS) {
    console.log(`  ${u.email} / ${u.password}`);
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { describe, expect, it } from 'vitest'
import { getCaps, homeRouteFor, staffRoles, announcementVisible } from '../../mobile/lib/roles.js'

describe('mobile role capabilities', () => {
  it('maps accountant and treasury roles consistently', () => {
    const profile = {
      role: 'staff',
      account_type: 'staff',
      is_approved: true,
      assigned_tutor_role: 'none',
      extra_roles: ['accountant', 'treasurer'],
    }
    const caps = getCaps(profile)
    expect(caps.isFinanceStaff).toBe(true)
    expect(caps.isFinanceViewer).toBe(true)
    expect(caps.isAccountant).toBe(true)
  })

  it('routes approved employee roles to staff and unapproved users to pending', () => {
    expect(homeRouteFor({ role: 'staff', account_type: 'staff', is_approved: true })).toBe('/staff')
    expect(homeRouteFor({ role: 'staff', account_type: 'staff', is_approved: false })).toBe('/pending')
  })

  it('de-duplicates and merges assigned, extra, and active duty roles', () => {
    expect(staffRoles({
      assigned_tutor_role: 'warden',
      extra_roles: ['warden', 'counselor'],
    }, ['treasurer', 'counselor'])).toEqual(['warden', 'counselor', 'treasurer'])

    const caps = getCaps({
      role: 'user',
      account_type: 'tutor',
      is_approved: true,
      assigned_tutor_role: 'none',
      extra_roles: [],
    }, ['treasurer'])
    expect(caps.isFinanceStaff).toBe(true)
    expect(caps.isFinanceViewer).toBe(true)
  })

  it('filters announcements by account and staff audience', () => {
    const profile = { role: 'staff', account_type: 'staff', is_approved: true, extra_roles: ['hr_manager'] }
    expect(announcementVisible({ target_roles: ['staff'] }, profile)).toBe(true)
    expect(announcementVisible({ target_roles: ['hr_manager'] }, profile)).toBe(true)
    expect(announcementVisible({ target_roles: ['student'] }, profile)).toBe(false)
  })
})

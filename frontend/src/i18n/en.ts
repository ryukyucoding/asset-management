import type { MessageSchema } from './index'

const en: MessageSchema = {
  common: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search',
    loading: 'Loading...',
    noData: 'No data',
    success: 'Success',
    error: 'Error',
  },
  nav: {
    assets: 'Assets',
    applications: 'Applications',
    notifications: 'Notifications',
    logout: 'Logout',
    admin: 'Admin',
  },
  auth: {
    login: 'Login',
    logout: 'Logout',
    logoutSuccess: 'Logged out',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    name: 'Name',
    department: 'Department',
    loginTitle: 'Asset Management System',
    loginSubtitle: 'Sign in to your account',
    loginBtn: 'Sign In',
    emailPlaceholder: 'Enter your email',
    passwordPlaceholder: 'Enter your password',
  },
  asset: {
    name: 'Asset Name',
    serialNo: 'Serial No.',
    category: 'Category',
    location: 'Location',
    status: 'Status',
    description: 'Description',
    statusMap: {
      AVAILABLE: 'Available',
      BORROWED: 'Borrowed',
      CLAIMED: 'Claimed',
      RETIRED: 'Retired',
    },
  },
  application: {
    type: 'Application Type',
    status: 'Status',
    returnDate: 'Expected Return Date',
    reason: 'Reason',
    typeMap: {
      BORROW: 'Borrow',
      CLAIM: 'Claim',
    },
    statusMap: {
      PENDING: 'Pending',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      RETURNED: 'Returned',
      CANCELLED: 'Cancelled',
    },
  },
}

export default en

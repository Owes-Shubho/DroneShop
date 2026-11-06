// Roles are fixed in code; each grants a set of permissions. `admin` can do everything.
export const PERMISSIONS = {
  dashboard: 'View the sales overview',
  reports: 'Run and export sales, product, customer, inventory, coupon and return reports',
  products: 'Manage products, categories, images and reviews',
  inventory: 'Adjust stock, view the stock log and manage suppliers',
  orders: 'View and process orders, shipments and returns',
  coupons: 'Manage coupons',
  'users.view': 'View customers and staff',
  'users.manage': 'Create, edit, suspend and delete users',
  roles: 'Change user roles',
};

export const ROLES = {
  customer: { label: 'Customer', description: 'Shops on the storefront. No dashboard access.', permissions: [] },
  support: {
    label: 'Support',
    description: 'Handles orders, shipments and returns, and can look up customers.',
    permissions: ['orders', 'users.view'],
  },
  manager: {
    label: 'Manager',
    description: 'Runs the catalogue, orders and coupons and sees the sales overview. Cannot manage users.',
    permissions: ['dashboard', 'reports', 'products', 'inventory', 'orders', 'coupons', 'users.view'],
  },
  admin: { label: 'Admin', description: 'Full access, including users and roles.', permissions: Object.keys(PERMISSIONS) },
};

export const ROLE_NAMES = Object.keys(ROLES);

// `isAdmin` is the original admin flag and stays authoritative for admins, so older accounts keep working.
export const roleOf = (u) => (u?.isAdmin ? 'admin' : ROLES[u?.role] ? u.role : 'customer');
export const permissionsOf = (u) => ROLES[roleOf(u)].permissions;
export const can = (u, permission) => permissionsOf(u).includes(permission);

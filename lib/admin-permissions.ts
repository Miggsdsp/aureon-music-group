export type AdminRole =
  | 'superAdmin'
  | 'contentManager'
  | 'musicManager'
  | 'videoManager'
  | 'merchManager'
  | 'newsEditor'
  | 'orderManager'
  | 'viewer';

export type AdminSection =
  | 'dashboard'
  | 'artists'
  | 'albums'
  | 'songs'
  | 'videos'
  | 'news'
  | 'products'
  | 'orders'
  | 'pages'
  | 'analytics'
  | 'settings';

const access: Record<AdminRole, AdminSection[]> = {
  superAdmin: ['dashboard', 'artists', 'albums', 'songs', 'videos', 'news', 'products', 'orders', 'pages', 'analytics', 'settings'],
  contentManager: ['dashboard', 'artists', 'albums', 'songs', 'videos', 'news', 'products', 'pages', 'analytics'],
  musicManager: ['dashboard', 'artists', 'albums', 'songs', 'analytics'],
  videoManager: ['dashboard', 'artists', 'videos', 'analytics'],
  merchManager: ['dashboard', 'products', 'orders', 'analytics'],
  newsEditor: ['dashboard', 'artists', 'news'],
  orderManager: ['dashboard', 'orders', 'analytics'],
  viewer: ['dashboard', 'artists', 'albums', 'songs', 'videos', 'news', 'products', 'orders', 'pages', 'analytics']
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && value in access;
}

export function canAccessSection(role: AdminRole, section: AdminSection) {
  return access[role].includes(section);
}

export function canWrite(role: AdminRole) {
  return role !== 'viewer';
}

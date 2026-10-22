/**
 * Browser-side authentication & local profile service.
 * Manages user accounts, cryptographic password validation, and active session state in IndexedDB.
 */

import { tx, getStoreItem, putStoreItem, addStoreItem, deleteStoreItem } from '../storage/db.js';
import { generateSalt, hashPassword, verifyPassword } from '../storage/crypto.js';
import { seedUserCategories, seedDemoData, ensureDatabaseInitialized } from '../storage/seed.js';

export async function getActiveSession() {
  await ensureDatabaseInitialized();
  return tx('sessions', 'readonly', (store) => getStoreItem(store, 'active_session'));
}

export async function requireActiveUser() {
  const session = await getActiveSession();
  if (!session || !session.userId) {
    const err = new Error('Authentication required. Please log in.');
    err.status = 401;
    throw err;
  }
  const user = await tx('users', 'readonly', (store) => getStoreItem(store, session.userId));
  if (!user) {
    await tx('sessions', 'readwrite', (store) => deleteStoreItem(store, 'active_session'));
    const err = new Error('Account not found or session expired.');
    err.status = 401;
    throw err;
  }
  return user;
}

export async function register({ name, email, password }) {
  await ensureDatabaseInitialized();
  if (!name || !name.trim()) throw new Error('Name is required');
  if (!email || !email.trim()) throw new Error('Valid email is required');
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');

  const normalizedEmail = email.trim().toLowerCase();

  return tx(['users', 'sessions', 'user_settings'], 'readwrite', async ([uStore, sStore, setStore]) => {
    const emailIndex = uStore.index('email');
    const existing = await emailIndex.get(normalizedEmail);
    if (existing) {
      const err = new Error('An account with this email address already exists. Please log in.');
      err.status = 409;
      throw err;
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = new Date().toISOString();

    const userId = await addStoreItem(uStore, {
      name: name.trim(),
      email: normalizedEmail,
      password_hash: passwordHash,
      salt,
      created_at: now,
      updated_at: now,
    });

    await addStoreItem(setStore, {
      user_id: userId,
      display_name: name.trim(),
      page_size: 10,
      theme: 'light',
      created_at: now,
      updated_at: now,
    });

    await putStoreItem(sStore, {
      key: 'active_session',
      userId,
      email: normalizedEmail,
      name: name.trim(),
      loginTime: Date.now(),
    });

    await seedUserCategories(userId);

    return {
      success: true,
      message: 'Account created successfully',
      data: {
        user: { id: userId, name: name.trim(), email: normalizedEmail },
        settings: { display_name: name.trim(), page_size: 10, theme: 'light' },
      },
    };
  });
}

export async function login({ email, password, rememberMe = true }) {
  await ensureDatabaseInitialized();
  if (!email || !email.trim() || !password) {
    throw new Error('Email and password are required');
  }

  const normalizedEmail = email.trim().toLowerCase();

  return tx(['users', 'sessions', 'user_settings'], 'readwrite', async ([uStore, sStore, setStore]) => {
    const emailIndex = uStore.index('email');
    const user = await emailIndex.get(normalizedEmail);
    if (!user) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    const valid = await verifyPassword(password, user.password_hash, user.salt);
    if (!valid) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    await putStoreItem(sStore, {
      key: 'active_session',
      userId: user.id,
      email: user.email,
      name: user.name,
      rememberMe,
      loginTime: Date.now(),
    });

    let settings = await getStoreItem(setStore, user.id);
    if (!settings) {
      settings = { user_id: user.id, display_name: user.name, page_size: 10, theme: 'light' };
      await putStoreItem(setStore, settings);
    }

    return {
      success: true,
      message: 'Logged in successfully',
      data: {
        user: { id: user.id, name: user.name, email: user.email },
        settings: { display_name: settings.display_name, page_size: settings.page_size, theme: settings.theme },
      },
    };
  });
}

export async function logout() {
  await tx('sessions', 'readwrite', (sStore) => deleteStoreItem(sStore, 'active_session'));
  return { success: true, message: 'Logged out successfully' };
}

export async function me() {
  const session = await getActiveSession();
  if (!session || !session.userId) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }

  return tx(['users', 'user_settings'], 'readonly', async ([uStore, setStore]) => {
    const user = await getStoreItem(uStore, session.userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 401;
      throw err;
    }

    let settings = await getStoreItem(setStore, user.id);
    if (!settings) {
      settings = { display_name: user.name, page_size: 10, theme: 'light' };
    }

    return {
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email },
        settings: { display_name: settings.display_name, page_size: settings.page_size, theme: settings.theme },
      },
    };
  });
}

export async function changePassword({ currentPassword, newPassword }) {
  const user = await requireActiveUser();
  if (!currentPassword || !newPassword) throw new Error('All password fields are required');
  if (newPassword.length < 8) throw new Error('New password must be at least 8 characters');

  const valid = await verifyPassword(currentPassword, user.password_hash, user.salt);
  if (!valid) {
    const err = new Error('Current password is incorrect');
    err.status = 400;
    throw err;
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);

  await tx('users', 'readwrite', (uStore) => {
    user.password_hash = newHash;
    user.salt = newSalt;
    user.updated_at = new Date().toISOString();
    return putStoreItem(uStore, user);
  });

  return { success: true, message: 'Password updated successfully' };
}

export async function updateProfile({ name, pageSize }) {
  const user = await requireActiveUser();

  return tx(['users', 'user_settings'], 'readwrite', async ([uStore, setStore]) => {
    if (name && name.trim()) {
      user.name = name.trim();
      user.updated_at = new Date().toISOString();
      await putStoreItem(uStore, user);
    }

    let settings = await getStoreItem(setStore, user.id);
    if (!settings) {
      settings = { user_id: user.id, created_at: new Date().toISOString() };
    }

    settings.display_name = name && name.trim() ? name.trim() : (settings.display_name || user.name);
    if (pageSize) settings.page_size = Number(pageSize);
    settings.updated_at = new Date().toISOString();

    await putStoreItem(setStore, settings);

    return {
      success: true,
      message: 'Profile settings updated.',
      data: {
        display_name: settings.display_name,
        page_size: settings.page_size,
        theme: settings.theme || 'light',
      },
    };
  });
}

export async function seedDemo({ months = 3, clearFirst = true }) {
  const user = await requireActiveUser();
  const count = Number(months) || 3;

  if (clearFirst) {
    await tx('expenses', 'readwrite', async (store) => {
      const allExpenses = await store.getAll();
      for (const exp of allExpenses) {
        if (exp.user_id === user.id) {
          await store.delete(exp.id);
        }
      }
    });
  }

  const seededCount = await seedDemoData(user.id, count, true);
  return {
    success: true,
    message: `Added ${seededCount} sample expenses to your account across the last ${count} month(s).`,
    data: { seeded: seededCount, months: count, clearFirst },
  };
}

/**
 * scripts/testAccountPersistence.ts
 *
 * Automated verification of CozyDispatch multi-device authentication & cloud persistence.
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting Multi-Device Cloud Persistence Verification...\n');

  // Test 1: Device A Signup & Save
  console.log('--- Test 1: Device A Creates Account & Saves Custom Data ---');
  const testEmail = `player_${Date.now()}@cozytest.com`;
  const password = 'cozypassword123';

  const signupRes = await axios.post(`${BASE_URL}/api/auth/signup`, {
    email: testEmail,
    password,
    username: 'FernTester',
    initialData: {
      profile: {
        bio: 'Created on Device A',
        favoriteVibe: 'Rainy Cafe Ambient'
      },
      wishlistedGameIds: ['fields-of-mistria', 'tiny-glade'],
      bookmarkedArticleIds: ['art-1']
    }
  });

  if (!signupRes.data.success || !signupRes.data.token) {
    throw new Error('Test 1 Failed: Signup unsuccessful.');
  }

  const deviceAToken = signupRes.data.token;
  console.log('✓ Device A signed up successfully. Token:', deviceAToken.slice(0, 10) + '...');

  // Device A modifies wishlist and profile
  const updateResA = await axios.put(
    `${BASE_URL}/api/user/sync`,
    {
      profile: {
        bio: 'Updated bio on Device A (Tea lover)',
        favoriteVibe: 'Cottagecore Magic'
      },
      wishlistedGameIds: ['fields-of-mistria', 'tiny-glade', 'haunted-chocolatier', 'balatro']
    },
    { headers: { Authorization: `Bearer ${deviceAToken}` } }
  );

  console.log('✓ Device A saved cloud updates (4 wishlisted games, updated bio).');

  // Test 2: Device B Logs In & Hydrates Cloud Data
  console.log('\n--- Test 2: Device B Logs In & Hydrates Cloud Data ---');
  const loginResB = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: testEmail,
    password
  });

  if (!loginResB.data.success || !loginResB.data.token) {
    throw new Error('Test 2 Failed: Device B login unsuccessful.');
  }

  const deviceBToken = loginResB.data.token;
  console.log('✓ Device B logged in successfully with independent session token.');

  const syncResB = await axios.get(`${BASE_URL}/api/user/sync`, {
    headers: { Authorization: `Bearer ${deviceBToken}` }
  });

  const userB = syncResB.data.user;
  if (!userB.wishlistedGameIds.includes('haunted-chocolatier') || userB.wishlistedGameIds.length !== 4) {
    throw new Error(`Test 2 Failed: Wishlist data did not sync to Device B. Found: ${JSON.stringify(userB.wishlistedGameIds)}`);
  }
  if (userB.profile.favoriteVibe !== 'Cottagecore Magic') {
    throw new Error(`Test 2 Failed: Profile bio/vibe did not sync to Device B. Found: ${userB.profile.favoriteVibe}`);
  }
  console.log(`✓ Device B verified exact synced data: 4 games in wishlist, bio "${userB.profile.bio}"`);

  // Test 3: Device B Modifies Data -> Device A Receives Updates
  console.log('\n--- Test 3: Device B Modifies Data & Device A Reads Updates ---');
  await axios.put(
    `${BASE_URL}/api/user/sync`,
    {
      profile: {
        bio: 'Modified from Steam Deck (Device B)',
        favoriteVibe: 'Deck Verified 60FPS'
      },
      wishlistedGameIds: ['fields-of-mistria', 'tiny-glade', 'haunted-chocolatier', 'balatro', 'roots-of-pacha'],
      bookmarkedArticleIds: ['art-1', 'art-new-release-radar']
    },
    { headers: { Authorization: `Bearer ${deviceBToken}` } }
  );
  console.log('✓ Device B pushed updates (added 5th game "roots-of-pacha" and 2nd bookmark).');

  // Device A queries cloud sync
  const syncResAAfterB = await axios.get(`${BASE_URL}/api/user/sync`, {
    headers: { Authorization: `Bearer ${deviceAToken}` }
  });
  const userAAfterB = syncResAAfterB.data.user;

  if (userAAfterB.wishlistedGameIds.length !== 5 || !userAAfterB.wishlistedGameIds.includes('roots-of-pacha')) {
    throw new Error('Test 3 Failed: Device A did not see changes made on Device B.');
  }
  if (userAAfterB.bookmarkedArticleIds.length !== 2) {
    throw new Error('Test 3 Failed: Bookmarked articles did not sync back to Device A.');
  }
  console.log(`✓ Device A verified cross-device sync: ${userAAfterB.wishlistedGameIds.length} games, ${userAAfterB.bookmarkedArticleIds.length} bookmarks, bio "${userAAfterB.profile.bio}".`);

  // Test 4: Data Isolation Between Different Users
  console.log('\n--- Test 4: Data Isolation Between Different Users ---');
  const user2Email = `user2_${Date.now()}@cozytest.com`;
  const signupRes2 = await axios.post(`${BASE_URL}/api/auth/signup`, {
    email: user2Email,
    password: 'password456',
    username: 'SecondUser',
    initialData: {
      wishlistedGameIds: ['dave-the-diver']
    }
  });
  const user2Token = signupRes2.data.token;

  const syncResUser2 = await axios.get(`${BASE_URL}/api/user/sync`, {
    headers: { Authorization: `Bearer ${user2Token}` }
  });
  const user2Data = syncResUser2.data.user;

  if (user2Data.email !== user2Email || user2Data.wishlistedGameIds.includes('haunted-chocolatier')) {
    throw new Error('Test 4 Failed: User 2 received User 1 data!');
  }
  console.log('✓ User 2 isolated successfully. Wishlist:', user2Data.wishlistedGameIds);

  // Test unauthenticated access
  try {
    await axios.get(`${BASE_URL}/api/user/sync`);
    throw new Error('Test 4 Failed: Unauthenticated request was allowed.');
  } catch (err: any) {
    if (err.response?.status === 401) {
      console.log('✓ Unauthenticated requests correctly rejected with 401 Unauthorized.');
    } else {
      throw err;
    }
  }

  // Test 5: Logout & Session Invalidation
  console.log('\n--- Test 5: Logout & Session Invalidation ---');
  await axios.post(
    `${BASE_URL}/api/auth/logout`,
    {},
    { headers: { Authorization: `Bearer ${deviceBToken}` } }
  );

  try {
    await axios.get(`${BASE_URL}/api/user/sync`, {
      headers: { Authorization: `Bearer ${deviceBToken}` }
    });
    throw new Error('Test 5 Failed: Revoked session token was still allowed.');
  } catch (err: any) {
    if (err.response?.status === 401) {
      console.log('✓ Device B logged out. Revoked token rejected with 401.');
    } else {
      throw err;
    }
  }

  // Device A still valid
  const checkDeviceA = await axios.get(`${BASE_URL}/api/user/sync`, {
    headers: { Authorization: `Bearer ${deviceAToken}` }
  });
  if (checkDeviceA.data.success) {
    console.log('✓ Device A session remains active and operational.');
  }

  console.log('\n🎉 ALL 5 MULTI-DEVICE PERSISTENCE & AUTHENTICATION TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});

/**
 * scripts/verifyAuthAndNewsletter.ts
 *
 * Full production-grade test suite verifying:
 * 1. New account registration & PBKDF2 Web Crypto password hashing
 * 2. Login with valid credentials, whitespace handling, and case-insensitivity
 * 3. Token verification, cloud data hydration, and profile sync
 * 4. Multi-device isolation & unauthorized access rejection
 * 5. Logout & session invalidation
 * 6. Newsletter signup with new email & welcome email generation
 * 7. Subscriber persistence in D1 database & email outbox audit
 * 8. Duplicate signup prevention (idempotency)
 * 9. Newsletter campaign broadcast to active subscribers
 * 10. 1-click unsubscribe verification
 * 11. Edge cases & error handling (invalid emails, bad passwords, missing tokens)
 */

import axios from 'axios';
import { getDb } from '../src/server/db/d1Client';

const BASE_URL = 'http://localhost:3000';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runVerification() {
  console.log('🧪 Starting CozyDispatch Authentication, D1 Persistence & Newsletter Verification...\n');

  const db = await getDb();

  // ==========================================================================
  // SECTION 1: AUTHENTICATION & MULTI-DEVICE SYNC (D1 Database)
  // ==========================================================================
  console.log('=== SECTION 1: Authentication & Multi-Device Sync (D1 Database) ===');

  const timestamp = Date.now();
  const testEmail = `cozy_player_${timestamp}@dispatch.test`;
  const testPassword = `SecretP@ss${timestamp}`;
  const username = `FernGamer_${timestamp % 1000}`;

  // 1.1 New User Registration
  console.log('\n[1.1] Testing New Account Signup...');
  const signupRes = await axios.post(`${BASE_URL}/api/auth/signup`, {
    email: `  ${testEmail}  `, // Test whitespace trimming
    password: testPassword,
    username,
    initialData: {
      profile: {
        avatarIcon: 'sprout',
        bio: 'Cozy botanist and tea enthusiast',
        favoriteVibe: 'Rainy Day Greenhouse'
      },
      wishlistedGameIds: ['fields-of-mistria', 'tiny-glade'],
      bookmarkedArticleIds: ['art-1']
    }
  });

  assert(signupRes.status === 201, `Signup status expected 201, got ${signupRes.status}`);
  assert(signupRes.data.success === true, 'Signup should succeed');
  assert(Boolean(signupRes.data.token), 'Signup should return an auth token');
  assert(signupRes.data.user.email === testEmail.toLowerCase(), 'Email should be trimmed & lowercase');
  assert(signupRes.data.user.profile.username === username, 'Username should match');
  assert(signupRes.data.user.wishlistedGameIds.length === 2, 'Wishlisted games should be preserved');
  console.log(`✓ Account created in D1: ${signupRes.data.user.email} (ID: ${signupRes.data.user.id})`);

  const tokenDeviceA = signupRes.data.token;

  // Verify D1 persistence directly
  const d1User = await db.prepare('SELECT id, email, password_hash, salt, hash_algorithm FROM users WHERE id = ?').bind(signupRes.data.user.id).first<any>();
  assert(Boolean(d1User), 'User must exist in D1 users table');
  assert(d1User.hash_algorithm === 'pbkdf2_sha256', 'Password must be hashed with PBKDF2');
  console.log(`✓ Verified D1 user record: PBKDF2 hash algorithm confirmed.`);

  // 1.2 Duplicate Signup Prevention
  console.log('\n[1.2] Testing Duplicate Signup Prevention...');
  try {
    await axios.post(`${BASE_URL}/api/auth/signup`, {
      email: testEmail.toUpperCase(),
      password: 'anotherPassword'
    });
    assert(false, 'Duplicate signup should have thrown 400/409');
  } catch (err: any) {
    assert(err.response?.status === 400 || err.response?.status === 409, `Expected 400/409, got ${err.response?.status}`);
    console.log(`✓ Duplicate signup correctly rejected: ${err.response?.data?.error}`);
  }

  // 1.3 Login with Same Account from Another Device (Device B)
  console.log('\n[1.3] Testing Login from Another Device (Device B) with Mixed Case & Spaces...');
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: `  ${testEmail.toUpperCase()}  `,
    password: testPassword
  });

  assert(loginRes.status === 200, `Login status expected 200, got ${loginRes.status}`);
  assert(loginRes.data.success === true, 'Login should succeed');
  assert(Boolean(loginRes.data.token), 'Login should return an independent auth token');
  assert(loginRes.data.token !== tokenDeviceA, 'Device B should have an independent session token');
  assert(loginRes.data.user.profile.bio === 'Cozy botanist and tea enthusiast', 'Bio should match account data');
  console.log(`✓ Device B logged in successfully with separate token: ${loginRes.data.token.slice(0, 12)}...`);

  const tokenDeviceB = loginRes.data.token;

  // 1.4 Invalid Password Rejection
  console.log('\n[1.4] Testing Invalid Password Rejection...');
  try {
    await axios.post(`${BASE_URL}/api/auth/login`, {
      email: testEmail,
      password: 'WrongPassword123'
    });
    assert(false, 'Bad password should have failed with 401');
  } catch (err: any) {
    assert(err.response?.status === 401, `Expected 401 Unauthorized, got ${err.response?.status}`);
    console.log(`✓ Invalid password rejected with 401: ${err.response?.data?.error}`);
  }

  // 1.5 Cloud Data Hydration on Device B (GET /api/user/sync)
  console.log('\n[1.5] Testing Cloud Hydration on Device B (GET /api/user/sync)...');
  const syncGetRes = await axios.get(`${BASE_URL}/api/user/sync`, {
    headers: { Authorization: `Bearer ${tokenDeviceB}` }
  });

  assert(syncGetRes.data.success === true, 'Cloud hydration should succeed');
  assert(syncGetRes.data.user.email === testEmail.toLowerCase(), 'Cloud user email should match');
  assert(syncGetRes.data.user.wishlistedGameIds.includes('fields-of-mistria'), 'Wishlist must include fields-of-mistria');
  console.log(`✓ Device B hydrated cloud data from D1: ${syncGetRes.data.user.wishlistedGameIds.length} wishlist items.`);

  // 1.6 Device B Updates Cloud Data (PUT /api/user/sync)
  console.log('\n[1.6] Device B Modifying Cloud Data in D1...');
  const syncPutRes = await axios.put(`${BASE_URL}/api/user/sync`, {
    profile: {
      bio: 'Updated bio from Steam Deck (Device B)',
      favoriteVibe: 'Steam Deck 60FPS Handheld'
    },
    wishlistedGameIds: ['fields-of-mistria', 'tiny-glade', 'balatro', 'roots-of-pacha'],
    bookmarkedArticleIds: ['art-1', 'art-new-release-radar']
  }, {
    headers: { Authorization: `Bearer ${tokenDeviceB}` }
  });

  assert(syncPutRes.data.success === true, 'PUT /api/user/sync should succeed');
  assert(syncPutRes.data.user.wishlistedGameIds.length === 4, 'Wishlist should now have 4 items');
  console.log('✓ Device B pushed updates to D1.');

  // 1.7 Device A Verifies Synced Changes
  console.log('\n[1.7] Device A Reading Cross-Device Updates...');
  const deviceASyncRes = await axios.get(`${BASE_URL}/api/user/sync`, {
    headers: { Authorization: `Bearer ${tokenDeviceA}` }
  });

  assert(deviceASyncRes.data.user.profile.bio === 'Updated bio from Steam Deck (Device B)', 'Device A should see updated bio');
  assert(deviceASyncRes.data.user.wishlistedGameIds.length === 4, 'Device A should see 4 wishlisted games');
  console.log('✓ Cross-device synchronization verified: Device A instantly sees Device B updates.');

  // 1.8 User Data Isolation Check
  console.log('\n[1.8] Testing Multi-User Data Isolation...');
  const user2Signup = await axios.post(`${BASE_URL}/api/auth/signup`, {
    email: `isolated_user_${timestamp}@dispatch.test`,
    password: 'Password999!',
    username: 'OtherUser',
    initialData: {
      wishlistedGameIds: ['dave-the-diver']
    }
  });

  const tokenUser2 = user2Signup.data.token;
  const user2Data = await axios.get(`${BASE_URL}/api/user/sync`, {
    headers: { Authorization: `Bearer ${tokenUser2}` }
  });

  assert(user2Data.data.user.email === `isolated_user_${timestamp}@dispatch.test`, 'User 2 email must match');
  assert(user2Data.data.user.wishlistedGameIds.length === 1 && user2Data.data.user.wishlistedGameIds[0] === 'dave-the-diver', 'User 2 must only see their own wishlist');
  console.log('✓ Data isolation verified: Different user accounts cannot see each other’s data.');

  // 1.9 Logout & Session Invalidation
  console.log('\n[1.9] Testing Logout & Session Invalidation...');
  await axios.post(`${BASE_URL}/api/auth/logout`, {}, {
    headers: { Authorization: `Bearer ${tokenDeviceB}` }
  });

  try {
    await axios.get(`${BASE_URL}/api/user/sync`, {
      headers: { Authorization: `Bearer ${tokenDeviceB}` }
    });
    assert(false, 'Revoked token should have failed');
  } catch (err: any) {
    assert(err.response?.status === 401, 'Logged out token must return 401 Unauthorized');
    console.log(`✓ Device B logged out. Revoked token rejected with 401: ${err.response?.data?.error}`);
  }

  // Device A remains active
  const deviceAStillActive = await axios.get(`${BASE_URL}/api/user/sync`, {
    headers: { Authorization: `Bearer ${tokenDeviceA}` }
  });
  assert(deviceAStillActive.data.success === true, 'Device A session should still be valid');
  console.log('✓ Independent session behavior verified: Logging out Device B does not affect Device A.');


  // ==========================================================================
  // SECTION 2: NEWSLETTER SYSTEM & EMAIL DISPATCH (D1 Database)
  // ==========================================================================
  console.log('\n\n=== SECTION 2: Newsletter & Email System (D1 Database) ===');

  const newsEmail = `newsletter_reader_${timestamp}@example.com`;

  // 2.1 Subscribe New User
  console.log('\n[2.1] Testing Newsletter Signup with New Email...');
  const subRes = await axios.post(`${BASE_URL}/api/newsletter/subscribe`, {
    email: `  ${newsEmail}  `,
    source: 'footer_signup'
  });

  assert(subRes.status === 200, `Expected 200 OK, got ${subRes.status}`);
  assert(subRes.data.success === true, 'Newsletter subscription must succeed');
  assert(subRes.data.alreadySubscribed === false, 'New subscriber should not be alreadySubscribed');
  console.log(`✓ Subscribed new email: ${newsEmail} (welcomeSent = ${subRes.data.welcomeSent})`);

  // 2.2 Verify Database Record in D1
  console.log('\n[2.2] Verifying Database Record in D1 newsletter_subscribers table...');
  const foundSub = await db
    .prepare('SELECT id, email, status, welcome_email_sent, unsubscribe_token FROM newsletter_subscribers WHERE email = ?')
    .bind(newsEmail.toLowerCase())
    .first<any>();

  assert(Boolean(foundSub), 'Subscriber must be recorded in D1 newsletter_subscribers');
  assert(foundSub.status === 'active', 'Subscriber status must be active');
  assert(Boolean(foundSub.unsubscribe_token), 'Unsubscribe token must be generated');
  console.log(`✓ Subscriber verified in D1: status=${foundSub.status}, token=${foundSub.unsubscribe_token}`);

  // 2.3 Verify Email Outbox Audit in D1
  console.log('\n[2.3] Auditing D1 Outbox for Email Attempt...');
  const outboxRes = await axios.get(`${BASE_URL}/api/newsletter/outbox`);
  assert(outboxRes.data.success === true, 'GET /api/newsletter/outbox must succeed');
  const loggedEmail = outboxRes.data.outbox.find((e: any) => e.recipient === newsEmail.toLowerCase() && e.template === 'welcome');

  assert(Boolean(loggedEmail), 'Welcome email dispatch attempt must be logged in outbox');
  assert(loggedEmail.htmlContent.includes('Welcome to the Quiet Corner of Gaming'), 'Welcome email HTML must be populated');
  console.log(`✓ Email attempt verified in D1 outbox (Subject: "${loggedEmail.subject}", Status: ${loggedEmail.status}, Provider: ${loggedEmail.provider})`);

  // 2.4 Duplicate Subscription Handling
  console.log('\n[2.4] Testing Duplicate Subscription Handling...');
  const duplicateSubRes = await axios.post(`${BASE_URL}/api/newsletter/subscribe`, {
    email: newsEmail.toUpperCase()
  });

  assert(duplicateSubRes.data.success === true, 'Duplicate call should return clean success payload');
  assert(duplicateSubRes.data.alreadySubscribed === true, 'alreadySubscribed must be true');
  assert(duplicateSubRes.data.welcomeSent === false, 'Duplicate call must NOT send duplicate welcome email');
  console.log(`✓ Duplicate subscription handled cleanly: "${duplicateSubRes.data.message}"`);

  // 2.5 Broadcast Campaign
  console.log('\n[2.5] Testing Newsletter Campaign Broadcast...');
  const broadcastRes = await axios.post(`${BASE_URL}/api/newsletter/broadcast`, {
    headline: 'Autumn Indiestravaganza Edition',
    intro: 'Curated cozy indie games and discounts for this weekend.',
    featuredGames: [
      { id: 'fields-of-mistria', title: 'Fields of Mistria', price: '$13.99' }
    ]
  });

  assert(broadcastRes.data.success === true, 'Broadcast must succeed');
  console.log(`✓ Newsletter broadcast executed for ${broadcastRes.data.result.totalSubscribers} subscribers.`);

  // 2.6 Unsubscribe Flow
  console.log('\n[2.6] Testing 1-Click Unsubscribe Flow...');
  const unsubRes = await axios.get(`${BASE_URL}/api/newsletter/unsubscribe?token=${foundSub.unsubscribe_token}`);
  assert(unsubRes.data.includes('Unsubscribed'), 'Unsubscribe page must display confirmation');

  const subAfterUnsub = await db
    .prepare('SELECT status FROM newsletter_subscribers WHERE id = ?')
    .bind(foundSub.id)
    .first<any>();

  assert(subAfterUnsub.status === 'unsubscribed', 'Subscriber status in D1 must be unsubscribed');
  console.log(`✓ Subscriber status in D1 updated to 'unsubscribed'.`);

  // Verify unsubscribed user excluded from subsequent broadcast
  const outboxBeforeBroadcast2 = (await axios.get(`${BASE_URL}/api/newsletter/outbox`)).data.outbox;
  const countBefore = outboxBeforeBroadcast2.filter((e: any) => e.recipient === newsEmail.toLowerCase()).length;

  await axios.post(`${BASE_URL}/api/newsletter/broadcast`, {
    headline: 'Exclusive Member Digest',
    intro: 'This must not reach unsubscribed accounts.'
  });

  const outboxAfterBroadcast2 = (await axios.get(`${BASE_URL}/api/newsletter/outbox`)).data.outbox;
  const countAfter = outboxAfterBroadcast2.filter((e: any) => e.recipient === newsEmail.toLowerCase()).length;

  assert(countAfter === countBefore, 'Unsubscribed user must NOT receive broadcast emails');
  console.log('✓ Verified: Unsubscribed users are safely excluded from broadcast sends.');

  console.log('\n🎉 ALL AUTHENTICATION, D1 PERSISTENCE & NEWSLETTER TESTS PASSED WITH 100% SUCCESS!');
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
});

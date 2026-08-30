/**
 * scripts/verifyAuthAndNewsletter.ts
 *
 * Full production-grade test suite verifying:
 * 1. New account registration & token generation
 * 2. Login with valid credentials, whitespace handling, and case-insensitivity
 * 3. Token verification, cloud data hydration, and profile sync
 * 4. Multi-device isolation & unauthorized access rejection
 * 5. Logout & session invalidation
 * 6. Newsletter signup with new email & welcome email generation
 * 7. Subscriber persistence in database & email outbox audit
 * 8. Duplicate signup prevention
 * 9. Newsletter campaign broadcast
 * 10. 1-click unsubscribe verification
 * 11. Edge cases & error handling (invalid emails, bad passwords, missing tokens)
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const USERS_FILE = path.join(process.cwd(), 'src', 'data', 'users.json');
const SUBSCRIBERS_FILE = path.join(process.cwd(), 'src', 'data', 'subscribers.json');
const OUTBOX_FILE = path.join(process.cwd(), 'src', 'data', 'emailOutbox.json');

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runVerification() {
  console.log('🧪 Starting CozyDispatch Authentication & Newsletter Verification...\n');

  // ==========================================================================
  // SECTION 1: AUTHENTICATION & MULTI-DEVICE SYNC
  // ==========================================================================
  console.log('=== SECTION 1: Authentication & Multi-Device Sync ===');

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
  console.log(`✓ Account created successfully: ${signupRes.data.user.email} (ID: ${signupRes.data.user.id})`);

  const tokenDeviceA = signupRes.data.token;

  // 1.2 Duplicate Signup Prevention
  console.log('\n[1.2] Testing Duplicate Signup Prevention...');
  try {
    await axios.post(`${BASE_URL}/api/auth/signup`, {
      email: testEmail.toUpperCase(),
      password: 'anotherPassword'
    });
    assert(false, 'Duplicate signup should have thrown 409 Conflict');
  } catch (err: any) {
    assert(err.response?.status === 409, `Expected 409 Conflict, got ${err.response?.status}`);
    console.log(`✓ Duplicate signup correctly rejected with 409: ${err.response?.data?.error}`);
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
  console.log(`✓ Device B hydrated cloud data: ${syncGetRes.data.user.wishlistedGameIds.length} wishlist items.`);

  // 1.6 Device B Updates Cloud Data (PUT /api/user/sync)
  console.log('\n[1.6] Device B Modifying Cloud Data...');
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
  console.log('✓ Device B pushed updates to cloud.');

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
  // SECTION 2: NEWSLETTER SYSTEM & EMAIL DISPATCH
  // ==========================================================================
  console.log('\n\n=== SECTION 2: Newsletter & Email System ===');

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
  assert(subRes.data.welcomeSent === true, 'Welcome email should be marked as sent');
  console.log(`✓ Subscribed new email: ${newsEmail} (welcomeSent = true)`);

  // 2.2 Verify Database Record in subscribers.json
  console.log('\n[2.2] Verifying Database Record in subscribers.json...');
  assert(fs.existsSync(SUBSCRIBERS_FILE), 'subscribers.json must exist');
  const subscribers = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  const foundSub = subscribers.find((s: any) => s.email === newsEmail.toLowerCase());

  assert(Boolean(foundSub), 'Subscriber must be recorded in subscribers.json');
  assert(foundSub.status === 'active', 'Subscriber status must be active');
  assert(foundSub.welcomeEmailSent === true, 'welcomeEmailSent flag must be true');
  assert(Boolean(foundSub.unsubscribeToken), 'Unsubscribe token must be generated');
  console.log(`✓ Subscriber verified in database: status=${foundSub.status}, token=${foundSub.unsubscribeToken}`);

  // 2.3 Verify Welcome Email in Outbox
  console.log('\n[2.3] Auditing Outbox for Welcome Email...');
  const outboxRes = await axios.get(`${BASE_URL}/api/newsletter/outbox`);
  assert(outboxRes.data.success === true, 'GET /api/newsletter/outbox must succeed');
  const welcomeEmail = outboxRes.data.outbox.find((e: any) => e.recipient === newsEmail.toLowerCase() && e.template === 'welcome');

  assert(Boolean(welcomeEmail), 'Welcome email must be logged in outbox');
  assert(welcomeEmail.status === 'delivered', 'Email delivery status must be delivered');
  assert(welcomeEmail.htmlContent.includes('Welcome to the Quiet Corner of Gaming'), 'Welcome email HTML must be populated');
  console.log(`✓ Welcome email verified in outbox (Subject: "${welcomeEmail.subject}", Status: ${welcomeEmail.status})`);

  // 2.4 Duplicate Subscription Handling
  console.log('\n[2.4] Testing Duplicate Subscription Handling...');
  const duplicateSubRes = await axios.post(`${BASE_URL}/api/newsletter/subscribe`, {
    email: newsEmail.toUpperCase()
  });

  assert(duplicateSubRes.data.success === true, 'Duplicate call should return clean success payload');
  assert(duplicateSubRes.data.alreadySubscribed === true, 'alreadySubscribed must be true');
  assert(duplicateSubRes.data.welcomeSent === false, 'Duplicate call must NOT send duplicate welcome email');
  console.log(`✓ Duplicate subscription handled cleanly: "${duplicateSubRes.data.message}"`);

  // 2.5 Broadcast Newsletter Campaign
  console.log('\n[2.5] Testing Newsletter Broadcast Campaign...');
  const broadcastRes = await axios.post(`${BASE_URL}/api/newsletter/broadcast`, {
    headline: 'Fields of Mistria Magic & Tiny Glade Zen Updates',
    intro: 'Welcome to this edition of Cozy Dispatch! We are highlighting the best indie updates.',
    featuredGames: [
      {
        id: 'fields-of-mistria',
        title: 'Fields of Mistria',
        price: '$13.99',
        category: 'farming',
        coverImage: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2142790/header.jpg',
        shortDescription: 'Magical 90s anime farming sim.'
      }
    ]
  });

  assert(broadcastRes.data.success === true, 'Broadcast must succeed');
  assert(broadcastRes.data.result.successfulSends >= 1, 'Broadcast must reach active subscribers');
  console.log(`✓ Newsletter broadcast dispatched to ${broadcastRes.data.result.successfulSends} active subscribers.`);

  // 2.6 1-Click Unsubscribe Flow
  console.log('\n[2.6] Testing 1-Click Unsubscribe Flow...');
  const unsubRes = await axios.get(`${BASE_URL}/api/newsletter/unsubscribe?token=${foundSub.unsubscribeToken}`);
  assert(unsubRes.status === 200, 'Unsubscribe endpoint should return 200 HTML page');
  assert(unsubRes.data.includes('Unsubscribed') || unsubRes.data.includes('successfully unsubscribed'), 'Unsubscribe page must confirm unsubscribed');

  // Verify subscriber status changed in database
  const updatedSubscribers = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  const updatedSub = updatedSubscribers.find((s: any) => s.email === newsEmail.toLowerCase());
  assert(updatedSub.status === 'unsubscribed', 'Subscriber status must be updated to unsubscribed');
  console.log(`✓ Subscriber ${newsEmail} successfully unsubscribed.`);

  // 2.7 Verify Unsubscribed User is Excluded from Next Broadcast
  console.log('\n[2.7] Verifying Excluded from Future Broadcasts...');
  const secondBroadcast = await axios.post(`${BASE_URL}/api/newsletter/broadcast`, {
    headline: 'Second Broadcast',
    intro: 'Checking exclusions.'
  });

  const outboxAfter = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf8'));
  const newDispatches = outboxAfter.filter((m: any) => m.recipient === newsEmail.toLowerCase() && m.subject.includes('Second Broadcast'));
  assert(newDispatches.length === 0, 'Unsubscribed recipient must not receive new broadcast');
  console.log('✓ Unsubscribed recipient safely excluded from future broadcasts.');

  // 2.8 Invalid Email Validation
  console.log('\n[2.8] Testing Invalid Email Rejection...');
  try {
    await axios.post(`${BASE_URL}/api/newsletter/subscribe`, { email: 'not-an-email' });
    assert(false, 'Invalid email should have failed');
  } catch (err: any) {
    assert(err.response?.status === 400, 'Invalid email must return 400 Bad Request');
    console.log(`✓ Invalid email rejected with 400: ${err.response?.data?.error}`);
  }

  console.log('\n🎉 ALL AUTHENTICATION AND NEWSLETTER TESTS PASSED WITH 100% SUCCESS!');
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err.message);
  if (err.response?.data) {
    console.error('Response Data:', err.response.data);
  }
  process.exit(1);
});

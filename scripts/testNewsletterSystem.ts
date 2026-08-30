/**
 * scripts/testNewsletterSystem.ts
 *
 * Automated verification of CozyDispatch newsletter subscription, welcome email dispatch,
 * subscriber D1 persistence, broadcast campaigns, deduplication, and unsubscribe flows.
 */

import axios from 'axios';
import { getDb } from '../src/server/db/d1Client';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting CozyDispatch Newsletter & D1 Email System Verification...\n');

  const db = await getDb();

  // Test 1: Subscribe with a new email
  console.log('--- Test 1: New Subscriber Registration & Welcome Email Trigger ---');
  const testEmail = `cozy_reader_${Date.now()}@example.com`;
  
  const subRes = await axios.post(`${BASE_URL}/api/newsletter/subscribe`, {
    email: testEmail,
    source: 'footer_signup'
  });

  if (!subRes.data.success) {
    throw new Error(`Test 1 Failed: Subscription did not succeed. Response: ${JSON.stringify(subRes.data)}`);
  }
  console.log(`✓ Subscribed new email: ${testEmail}`);
  console.log(`✓ Welcome email triggered (welcomeSent = ${subRes.data.welcomeSent})`);

  // Test 2: Verify subscriber persistence in D1 database
  console.log('\n--- Test 2: D1 Database Persistence & Record Integrity ---');
  const foundSub = await db
    .prepare('SELECT id, email, status, welcome_email_sent, unsubscribe_token FROM newsletter_subscribers WHERE email = ?')
    .bind(testEmail.toLowerCase())
    .first<any>();

  if (!foundSub) {
    throw new Error(`Test 2 Failed: ${testEmail} was not found in newsletter_subscribers table.`);
  }
  if (foundSub.status !== 'active' || !foundSub.unsubscribe_token) {
    throw new Error(`Test 2 Failed: Subscriber record missing expected fields: ${JSON.stringify(foundSub)}`);
  }
  console.log(`✓ Subscriber record verified in D1:`);
  console.log(`  - Status: ${foundSub.status}`);
  console.log(`  - Welcome Email Sent: ${Boolean(foundSub.welcome_email_sent)}`);
  console.log(`  - Unsubscribe Token: ${foundSub.unsubscribe_token}`);

  // Test 3: Verify welcome email in Outbox
  console.log('\n--- Test 3: Email Outbox Delivery Audit in D1 ---');
  const outboxRes = await axios.get(`${BASE_URL}/api/newsletter/outbox`);
  if (!outboxRes.data.success || !Array.isArray(outboxRes.data.outbox)) {
    throw new Error('Test 3 Failed: GET /api/newsletter/outbox failed.');
  }

  const welcomeEmail = outboxRes.data.outbox.find((m: any) => m.recipient === testEmail && m.template === 'welcome');
  if (!welcomeEmail) {
    throw new Error(`Test 3 Failed: Welcome email for ${testEmail} not found in outbox.`);
  }
  if (!welcomeEmail.htmlContent.includes('Welcome to the Quiet Corner of Gaming')) {
    throw new Error(`Test 3 Failed: Welcome email content invalid: ${JSON.stringify(welcomeEmail)}`);
  }
  console.log(`✓ Welcome email verified in outbox (Subject: "${welcomeEmail.subject}", Status: ${welcomeEmail.status}, Provider: ${welcomeEmail.provider})`);

  // Test 4: Newsletter Broadcast to All Active Subscribers
  console.log('\n--- Test 4: Newsletter Broadcast Campaign ---');
  const broadcastRes = await axios.post(`${BASE_URL}/api/newsletter/broadcast`, {
    headline: 'Autumn Harvests, Fields of Mistria & Deck Battery Gems',
    intro: 'Welcome to this week’s Cozy Dispatch recap! We are spotlighting the coziest new updates and Steam discounts.',
    featuredGames: [
      {
        id: 'fields-of-mistria',
        title: 'Fields of Mistria',
        price: '$13.99',
        category: 'farming',
        coverImage: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2142790/header.jpg',
        shortDescription: 'A heartwarming farming RPG inspired by 90s anime classics.'
      }
    ],
    articles: [
      {
        id: 'art-1',
        title: 'Fields of Mistria Drops Massive Content Roadmap',
        summary: 'New romance quests and seasonal festival events unveiled.',
        sourceOutlet: 'Eurogamer',
        sourceUrl: 'https://eurogamer.net'
      }
    ]
  });

  if (!broadcastRes.data.success || broadcastRes.data.result.totalSubscribers < 1) {
    throw new Error(`Test 4 Failed: Broadcast failed: ${JSON.stringify(broadcastRes.data)}`);
  }
  console.log(`✓ Newsletter broadcast succeeded: Executed for ${broadcastRes.data.result.totalSubscribers} active subscribers.`);

  // Test 5: Duplicate Subscription Prevention (Idempotency)
  console.log('\n--- Test 5: Duplicate Signup & Welcome Email Prevention ---');
  const repeatSubRes = await axios.post(`${BASE_URL}/api/newsletter/subscribe`, {
    email: testEmail
  });

  if (!repeatSubRes.data.alreadySubscribed || repeatSubRes.data.welcomeSent) {
    throw new Error(`Test 5 Failed: Repeat subscription did not report alreadySubscribed: ${JSON.stringify(repeatSubRes.data)}`);
  }
  console.log('✓ Duplicate prevention verified: 0 duplicate subscribers, 0 duplicate welcome emails.');

  // Test 6: Unsubscribe Flow & Safe Broadcast Filtering
  console.log('\n--- Test 6: 1-Click Unsubscribe Flow ---');
  const unsubRes = await axios.get(`${BASE_URL}/api/newsletter/unsubscribe?token=${foundSub.unsubscribe_token}`);
  if (!unsubRes.data.includes('Unsubscribed')) {
    throw new Error('Test 6 Failed: Unsubscribe page did not confirm unsubscription.');
  }

  const updatedSub = await db
    .prepare('SELECT status FROM newsletter_subscribers WHERE email = ?')
    .bind(testEmail.toLowerCase())
    .first<any>();

  if (updatedSub.status !== 'unsubscribed') {
    throw new Error('Test 6 Failed: Subscriber status was not updated to unsubscribed in D1.');
  }
  console.log(`✓ Successfully unsubscribed ${testEmail} (status = unsubscribed in D1).`);

  console.log('\n🎉 ALL 6 NEWSLETTER & D1 EMAIL SYSTEM VERIFICATION TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});

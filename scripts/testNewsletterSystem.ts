/**
 * scripts/testNewsletterSystem.ts
 *
 * Automated verification of CozyDispatch newsletter subscription, welcome email dispatch,
 * subscriber persistence, broadcast campaigns, deduplication, and unsubscribe flows.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const SUBSCRIBERS_FILE = path.join(process.cwd(), 'src', 'data', 'subscribers.json');
const OUTBOX_FILE = path.join(process.cwd(), 'src', 'data', 'emailOutbox.json');

async function runTests() {
  console.log('🧪 Starting CozyDispatch Newsletter & Email System Verification...\n');

  // Test 1: Subscribe with a new email
  console.log('--- Test 1: New Subscriber Registration & Welcome Email Trigger ---');
  const testEmail = `cozy_reader_${Date.now()}@example.com`;
  
  const subRes = await axios.post(`${BASE_URL}/api/newsletter/subscribe`, {
    email: testEmail,
    source: 'footer_signup'
  });

  if (!subRes.data.success || !subRes.data.welcomeSent) {
    throw new Error(`Test 1 Failed: Subscription did not succeed or welcome email was not sent. Response: ${JSON.stringify(subRes.data)}`);
  }
  console.log(`✓ Subscribed new email: ${testEmail}`);
  console.log(`✓ Welcome email triggered and sent: welcomeSent = ${subRes.data.welcomeSent}`);

  // Test 2: Verify subscriber persistence in database
  console.log('\n--- Test 2: Database Persistence & Record Integrity ---');
  if (!fs.existsSync(SUBSCRIBERS_FILE)) {
    throw new Error('Test 2 Failed: subscribers.json does not exist.');
  }
  const subscribers = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  const foundSub = subscribers.find((s: any) => s.email === testEmail);

  if (!foundSub) {
    throw new Error(`Test 2 Failed: ${testEmail} was not found in subscribers.json.`);
  }
  if (foundSub.status !== 'active' || !foundSub.welcomeEmailSent || !foundSub.unsubscribeToken) {
    throw new Error(`Test 2 Failed: Subscriber record missing expected fields: ${JSON.stringify(foundSub)}`);
  }
  console.log(`✓ Subscriber record verified in database:`);
  console.log(`  - Status: ${foundSub.status}`);
  console.log(`  - Welcome Email Sent: ${foundSub.welcomeEmailSent} (${foundSub.welcomeEmailSentAt})`);
  console.log(`  - Unsubscribe Token: ${foundSub.unsubscribeToken}`);

  // Test 3: Verify welcome email in Outbox
  console.log('\n--- Test 3: Email Outbox Delivery Audit ---');
  const outboxRes = await axios.get(`${BASE_URL}/api/newsletter/outbox`);
  if (!outboxRes.data.success || !Array.isArray(outboxRes.data.outbox)) {
    throw new Error('Test 3 Failed: GET /api/newsletter/outbox failed.');
  }

  const welcomeEmail = outboxRes.data.outbox.find((m: any) => m.recipient === testEmail && m.template === 'welcome');
  if (!welcomeEmail) {
    throw new Error(`Test 3 Failed: Welcome email for ${testEmail} not found in outbox.`);
  }
  if (!welcomeEmail.htmlContent.includes('Welcome to the Quiet Corner of Gaming') || welcomeEmail.status !== 'delivered') {
    throw new Error(`Test 3 Failed: Welcome email content or status invalid: ${JSON.stringify(welcomeEmail)}`);
  }
  console.log(`✓ Welcome email verified in outbox (Subject: "${welcomeEmail.subject}", Status: ${welcomeEmail.status})`);

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

  if (!broadcastRes.data.success || broadcastRes.data.result.successfulSends < 1) {
    throw new Error(`Test 4 Failed: Broadcast failed or sent to 0 recipients: ${JSON.stringify(broadcastRes.data)}`);
  }
  console.log(`✓ Newsletter broadcast succeeded: Sent to ${broadcastRes.data.result.successfulSends} active subscribers.`);

  // Check outbox for this recipient's newsletter
  const outboxAfter = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf8'));
  const receivedNewsletter = outboxAfter.find((m: any) => m.recipient === testEmail && m.template === 'newsletter');
  if (!receivedNewsletter) {
    throw new Error(`Test 4 Failed: ${testEmail} did not receive the broadcast newsletter.`);
  }
  console.log(`✓ Confirmed subscriber received newsletter: "${receivedNewsletter.subject}"`);

  // Test 5: Duplicate Subscription Prevention (Idempotency)
  console.log('\n--- Test 5: Duplicate Signup & Welcome Email Prevention ---');
  const outboxCountBefore = outboxAfter.filter((m: any) => m.recipient === testEmail && m.template === 'welcome').length;
  const subsCountBefore = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8')).length;

  const repeatSubRes = await axios.post(`${BASE_URL}/api/newsletter/subscribe`, {
    email: testEmail
  });

  if (!repeatSubRes.data.alreadySubscribed || repeatSubRes.data.welcomeSent) {
    throw new Error(`Test 5 Failed: Repeat subscription did not report alreadySubscribed or sent duplicate welcome: ${JSON.stringify(repeatSubRes.data)}`);
  }

  const subsCountAfter = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8')).length;
  const outboxCountAfter = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf8')).filter((m: any) => m.recipient === testEmail && m.template === 'welcome').length;

  if (subsCountAfter !== subsCountBefore) {
    throw new Error(`Test 5 Failed: Duplicate subscriber record was created (${subsCountBefore} -> ${subsCountAfter}).`);
  }
  if (outboxCountAfter !== outboxCountBefore) {
    throw new Error(`Test 5 Failed: Duplicate welcome email was sent.`);
  }
  console.log('✓ Duplicate prevention verified: 0 duplicate subscribers, 0 duplicate welcome emails.');

  // Test 6: Unsubscribe Flow & Safe Broadcast Filtering
  console.log('\n--- Test 6: 1-Click Unsubscribe Flow ---');
  const unsubRes = await axios.get(`${BASE_URL}/api/newsletter/unsubscribe?token=${foundSub.unsubscribeToken}`);
  if (!unsubRes.data.includes('Unsubscribed')) {
    throw new Error('Test 6 Failed: Unsubscribe page did not confirm unsubscription.');
  }

  const subsAfterUnsub = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  const updatedSub = subsAfterUnsub.find((s: any) => s.email === testEmail);
  if (updatedSub.status !== 'unsubscribed') {
    throw new Error('Test 6 Failed: Subscriber status was not updated to unsubscribed.');
  }
  console.log(`✓ Successfully unsubscribed ${testEmail} (status = unsubscribed).`);

  // Run broadcast again and verify unsubscribed user is NOT sent an email
  const outboxCountPreSecondBroadcast = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf8')).filter((m: any) => m.recipient === testEmail).length;
  await axios.post(`${BASE_URL}/api/newsletter/broadcast`, {
    headline: 'Second Edition for Active Subscribers Only',
    intro: 'This should not reach unsubscribed accounts.'
  });
  const outboxCountPostSecondBroadcast = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf8')).filter((m: any) => m.recipient === testEmail).length;

  if (outboxCountPostSecondBroadcast !== outboxCountPreSecondBroadcast) {
    throw new Error('Test 6 Failed: Unsubscribed user still received broadcast email!');
  }
  console.log('✓ Verified: Unsubscribed users are safely excluded from future broadcasts.');

  console.log('\n🎉 ALL 6 NEWSLETTER & EMAIL SYSTEM VERIFICATION TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});

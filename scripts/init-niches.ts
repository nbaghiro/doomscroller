#!/usr/bin/env tsx

/**
 * Script to initialize sample content niches in Firestore
 * Usage: tsx scripts/init-niches.ts
 */

import { DatabaseService } from '../src/lib/database.js';
import { ContentNiche } from '../src/types/index.js';
import { Logger } from '../src/lib/logger.js';

const logger = new Logger('InitNiches');

const sampleNiches: ContentNiche[] = [
  {
    id: 'motivational',
    name: 'Motivational Content',
    description: 'Inspirational and motivational short videos for success-driven audience',
    keywords: ['motivation', 'success', 'inspiration', 'goals', 'mindset', 'achievement'],
    promptTemplate: 'Create inspiring motivational content that empowers viewers',
    targetAudience: 'Young professionals, entrepreneurs, students',
    postingSchedule: {
      timesPerDay: 3,
      preferredTimes: ['09:00', '14:00', '18:00'],
      timezone: 'America/New_York',
    },
    socialAccounts: {
      youtube: {
        channelId: 'REPLACE_WITH_YOUR_CHANNEL_ID',
        refreshToken: 'REPLACE_WITH_YOUR_REFRESH_TOKEN',
      },
      instagram: {
        accountId: 'REPLACE_WITH_YOUR_ACCOUNT_ID',
        accessToken: 'REPLACE_WITH_YOUR_ACCESS_TOKEN',
      },
      tiktok: {
        username: 'REPLACE_WITH_YOUR_USERNAME',
      },
    },
  },
  {
    id: 'educational-tech',
    name: 'Tech & Innovation',
    description: 'Educational content about technology, AI, and innovation',
    keywords: ['technology', 'AI', 'innovation', 'gadgets', 'future', 'science'],
    promptTemplate: 'Create educational content explaining tech concepts in simple terms',
    targetAudience: 'Tech enthusiasts, students, curious minds',
    postingSchedule: {
      timesPerDay: 2,
      preferredTimes: ['10:00', '16:00'],
      timezone: 'America/New_York',
    },
    socialAccounts: {
      youtube: {
        channelId: 'REPLACE_WITH_YOUR_CHANNEL_ID',
        refreshToken: 'REPLACE_WITH_YOUR_REFRESH_TOKEN',
      },
      instagram: {
        accountId: 'REPLACE_WITH_YOUR_ACCOUNT_ID',
        accessToken: 'REPLACE_WITH_YOUR_ACCESS_TOKEN',
      },
    },
  },
  {
    id: 'entertainment-fun',
    name: 'Entertainment & Fun',
    description: 'Light-hearted, fun, and entertaining short videos',
    keywords: ['entertainment', 'fun', 'comedy', 'viral', 'trending', 'challenge'],
    promptTemplate: 'Create entertaining and engaging viral-worthy content',
    targetAudience: 'General audience, young adults',
    postingSchedule: {
      timesPerDay: 3,
      preferredTimes: ['12:00', '17:00', '20:00'],
      timezone: 'America/New_York',
    },
    socialAccounts: {
      youtube: {
        channelId: 'REPLACE_WITH_YOUR_CHANNEL_ID',
        refreshToken: 'REPLACE_WITH_YOUR_REFRESH_TOKEN',
      },
      instagram: {
        accountId: 'REPLACE_WITH_YOUR_ACCOUNT_ID',
        accessToken: 'REPLACE_WITH_YOUR_ACCESS_TOKEN',
      },
      tiktok: {
        username: 'REPLACE_WITH_YOUR_USERNAME',
      },
    },
  },
];

async function initializeNiches() {
  try {
    logger.info('Initializing content niches...');

    const db = new DatabaseService();

    for (const niche of sampleNiches) {
      logger.info(`Creating niche: ${niche.name}`);
      await db.saveContentNiche(niche);
      logger.info(`✓ Niche created: ${niche.id}`);
    }

    logger.info('All niches initialized successfully!');
    logger.info('\nIMPORTANT: Remember to update the social account credentials in Firestore!');
    logger.info('Replace the placeholder values with your actual:');
    logger.info('  - YouTube channel IDs and refresh tokens');
    logger.info('  - Instagram account IDs and access tokens');
    logger.info('  - TikTok usernames and access tokens (when available)');
  } catch (error) {
    logger.error('Error initializing niches', error);
    throw error;
  }
}

// Run the script
initializeNiches()
  .then(() => {
    console.log('\n✓ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Failed:', error);
    process.exit(1);
  });

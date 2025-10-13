/// <reference types="vitest" />

import { describe, expect, it } from 'vitest';
import { getConfidenceTier, getConfidenceBadgeData } from '../confidenceBadges';

describe('confidenceBadges utilities', () => {
  describe('getConfidenceTier', () => {
    it('returns green tier for confidence ≥0.75', () => {
      expect(getConfidenceTier(0.75)).toBe('green');
      expect(getConfidenceTier(0.8)).toBe('green');
      expect(getConfidenceTier(0.9)).toBe('green');
      expect(getConfidenceTier(1.0)).toBe('green');
    });

    it('returns amber tier for confidence 0.4–0.74', () => {
      expect(getConfidenceTier(0.4)).toBe('amber');
      expect(getConfidenceTier(0.5)).toBe('amber');
      expect(getConfidenceTier(0.6)).toBe('amber');
      expect(getConfidenceTier(0.74)).toBe('amber');
    });

    it('returns red tier for confidence <0.4', () => {
      expect(getConfidenceTier(0.0)).toBe('red');
      expect(getConfidenceTier(0.1)).toBe('red');
      expect(getConfidenceTier(0.3)).toBe('red');
      expect(getConfidenceTier(0.39)).toBe('red');
    });

    it('handles edge cases correctly', () => {
      expect(getConfidenceTier(0.749)).toBe('amber');
      expect(getConfidenceTier(0.399)).toBe('red');
    });
  });

  describe('getConfidenceBadgeData', () => {
    describe('tier mapping', () => {
      it('returns correct data for green tier', () => {
        const data = getConfidenceBadgeData(0.85);

        expect(data.tier).toBe('green');
        expect(data.label).toBe('High confidence');
        expect(data.color).toBe('text-emerald-300');
        expect(data.bgColor).toBe('bg-emerald-500/20');
        expect(data.tooltipText).toContain('High confidence');
        expect(data.tooltipText).toContain('85%');
      });

      it('returns correct data for amber tier', () => {
        const data = getConfidenceBadgeData(0.6);

        expect(data.tier).toBe('amber');
        expect(data.label).toBe('Medium confidence');
        expect(data.color).toBe('text-amber-300');
        expect(data.bgColor).toBe('bg-amber-500/20');
        expect(data.tooltipText).toContain('Medium confidence');
        expect(data.tooltipText).toContain('60%');
      });

      it('returns correct data for red tier', () => {
        const data = getConfidenceBadgeData(0.3);

        expect(data.tier).toBe('red');
        expect(data.label).toBe('Low confidence');
        expect(data.color).toBe('text-red-300');
        expect(data.bgColor).toBe('bg-red-500/20');
        expect(data.tooltipText).toContain('Low confidence');
        expect(data.tooltipText).toContain('30%');
      });
    });

    describe('regeneration history', () => {
      it('includes regeneration count in tooltip when provided', () => {
        const data = getConfidenceBadgeData(0.8, 1);

        expect(data.tooltipText).toContain('Regenerated 1 time');
      });

      it('handles plural regeneration count correctly', () => {
        const data = getConfidenceBadgeData(0.8, 3);

        expect(data.tooltipText).toContain('Regenerated 3 times');
      });

      it('does not include regeneration text when count is 0', () => {
        const data = getConfidenceBadgeData(0.8, 0);

        expect(data.tooltipText).not.toContain('Regenerated');
      });

      it('does not include regeneration text when count is undefined', () => {
        const data = getConfidenceBadgeData(0.8);

        expect(data.tooltipText).not.toContain('Regenerated');
      });
    });

    describe('timestamp formatting', () => {
      it('includes "just now" for very recent timestamps', () => {
        const now = new Date();
        const data = getConfidenceBadgeData(0.8, 1, now);

        expect(data.tooltipText).toContain('just now');
      });

      it('includes minutes ago for timestamps within an hour', () => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const data = getConfidenceBadgeData(0.8, 1, fiveMinutesAgo);

        expect(data.tooltipText).toContain('5 minute');
        expect(data.tooltipText).toContain('ago');
      });

      it('includes hours ago for timestamps within a day', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const data = getConfidenceBadgeData(0.8, 1, twoHoursAgo);

        expect(data.tooltipText).toContain('2 hour');
        expect(data.tooltipText).toContain('ago');
      });

      it('includes days ago for older timestamps', () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        const data = getConfidenceBadgeData(0.8, 1, threeDaysAgo);

        expect(data.tooltipText).toContain('3 day');
        expect(data.tooltipText).toContain('ago');
      });

      it('handles singular time units correctly', () => {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        const data = getConfidenceBadgeData(0.8, 1, oneMinuteAgo);

        expect(data.tooltipText).toContain('1 minute ago');
        expect(data.tooltipText).not.toContain('minutes');
      });
    });

    describe('comprehensive tooltip', () => {
      it('combines confidence, regeneration count, and timestamp in tooltip', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const data = getConfidenceBadgeData(0.85, 2, twoHoursAgo);

        expect(data.tooltipText).toContain('85%');
        expect(data.tooltipText).toContain('Regenerated 2 times');
        expect(data.tooltipText).toContain('2 hour');
        expect(data.tooltipText).toContain('ago');
      });
    });
  });
});

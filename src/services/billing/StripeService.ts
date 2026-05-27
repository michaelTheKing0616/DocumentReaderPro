import { Linking } from 'react-native';
import { logger } from '../logger/Logger';
import { getSupabaseClient } from '../storage/supabase/SupabaseClient';

export type PremiumFeature =
  | 'cloud_sync'
  | 'pdf_tools'
  | 'parent_dashboard'
  | 'advanced_analytics'
  | 'export_integrations'
  | 'realtime_collab'
  | 'truescan_batch';

export interface SubscriptionStatus {
  isPremium: boolean;
  planId?: string;
  expiresAt?: string;
  customerId?: string;
}

interface ProfileSubscription {
  isPremium?: boolean;
  planId?: string | null;
  expiresAt?: string | null;
  customerId?: string | null;
}

const PREMIUM_FEATURES: PremiumFeature[] = [
  'cloud_sync',
  'pdf_tools',
  'parent_dashboard',
  'advanced_analytics',
  'export_integrations',
  'realtime_collab',
  'truescan_batch',
];

const FEATURE_LABELS: Record<PremiumFeature, string> = {
  cloud_sync: 'Cloud Sync',
  pdf_tools: 'PDF Merge/Split/Compress',
  parent_dashboard: 'Parent Dashboard',
  advanced_analytics: 'Advanced Analytics',
  export_integrations: 'Evernote & Goodreads Export',
  realtime_collab: 'Realtime Collaboration',
  truescan_batch: 'TrueScan Batch Processing',
};

class StripeService {
  private status: SubscriptionStatus = { isPremium: false };

  isConfigured(): boolean {
    return Boolean(
      process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
        process.env.EXPO_PUBLIC_SUPABASE_URL
    );
  }

  /** Load subscription from Supabase profile preferences (written by stripe-webhook). */
  async refreshSubscription(userId: string): Promise<SubscriptionStatus> {
    const mockPremium = process.env.EXPO_PUBLIC_MOCK_PREMIUM === 'true';
    if (mockPremium) {
      this.status = { isPremium: true, planId: 'mock_premium' };
      return this.status;
    }

    if (!userId || userId === 'local') {
      return this.status;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.status;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        logger.warn('Stripe subscription profile read failed', { message: error.message });
        return this.status;
      }

      const prefs = (data?.preferences ?? {}) as { subscription?: ProfileSubscription };
      const sub = prefs.subscription;
      if (sub) {
        const expiresAt = sub.expiresAt ?? undefined;
        const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
        this.status = {
          isPremium: Boolean(sub.isPremium) && !isExpired,
          planId: sub.planId ?? undefined,
          expiresAt,
          customerId: sub.customerId ?? undefined,
        };
        logger.info('Subscription loaded from profile', {
          isPremium: this.status.isPremium,
          planId: this.status.planId,
        });
      }
    } catch (error) {
      logger.warn('Stripe subscription refresh failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return this.status;
  }

  getSubscriptionStatus(): SubscriptionStatus {
    return { ...this.status };
  }

  setSubscriptionStatus(status: SubscriptionStatus): void {
    this.status = status;
  }

  hasPremium(): boolean {
    return this.status.isPremium;
  }

  canAccess(feature: PremiumFeature): boolean {
    if (!PREMIUM_FEATURES.includes(feature)) {
      return true;
    }
    return this.hasPremium();
  }

  getFeatureLabel(feature: PremiumFeature): string {
    return FEATURE_LABELS[feature];
  }

  /** Open Stripe Checkout via Supabase edge function. */
  async startCheckout(userId: string, priceId?: string, email?: string): Promise<{ url: string } | null> {
    const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      logger.warn('Stripe publishable key not configured');
      return null;
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const pid = priceId ?? process.env.EXPO_PUBLIC_STRIPE_PRICE_ID ?? 'price_premium';

    if (!supabaseUrl) {
      logger.warn('Supabase URL required for Stripe checkout');
      return null;
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return null;
      }

      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { userId, email, priceId: pid },
      });

      if (error || !data?.url) {
        logger.warn('Stripe checkout failed', {
          message: error?.message ?? 'No checkout URL returned',
        });
        return null;
      }

      return { url: data.url as string };
    } catch (error) {
      logger.warn('Stripe checkout invoke failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /** Opens checkout in the system browser. */
  async openCheckout(userId: string, email?: string): Promise<boolean> {
    const session = await this.startCheckout(userId, undefined, email);
    if (!session?.url) {
      return false;
    }
    await Linking.openURL(session.url);
    return true;
  }

  /** Billing portal via edge function when customerId is known. */
  async openBillingPortal(customerId: string): Promise<string | null> {
    const supabase = getSupabaseClient();
    if (!supabase || !customerId) {
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('stripe-portal', {
        body: { customerId },
      });
      if (error || !data?.url) {
        logger.warn('Billing portal unavailable', { message: error?.message });
        return null;
      }
      return data.url as string;
    } catch (error) {
      logger.warn('Billing portal invoke failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

export default new StripeService();

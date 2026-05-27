import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function upsertSubscription(
  userId: string,
  isPremium: boolean,
  planId?: string,
  customerId?: string,
  expiresAt?: string
): Promise<void> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle();

  const prefs = (existing?.preferences as Record<string, unknown>) ?? {};
  const { error: metaError } = await supabase
    .from('profiles')
    .update({
      preferences: {
        ...prefs,
        subscription: {
          isPremium,
          planId: planId ?? null,
          customerId: customerId ?? null,
          expiresAt: expiresAt ?? null,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (metaError) {
    console.error('Failed to update profile subscription', metaError.message);
  }
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature || !webhookSecret) {
    return new Response('Webhook not configured', { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid signature';
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId ?? session.client_reference_id;
        if (userId) {
          await upsertSubscription(
            userId,
            true,
            session.subscription as string | undefined,
            session.customer as string | undefined
          );
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (userId) {
          const active = subscription.status === 'active' || subscription.status === 'trialing';
          await upsertSubscription(
            userId,
            active,
            subscription.id,
            subscription.customer as string,
            new Date(subscription.current_period_end * 1000).toISOString()
          );
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (userId) {
          await upsertSubscription(userId, false, subscription.id);
        }
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handler failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});

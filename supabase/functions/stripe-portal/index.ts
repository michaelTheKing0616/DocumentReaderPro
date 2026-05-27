import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { customerId, returnUrl } = (await req.json()) as {
      customerId?: string;
      returnUrl?: string;
    };

    if (!customerId) {
      return new Response(JSON.stringify({ error: 'customerId required' }), { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl ?? 'https://readassist.app/settings',
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Portal session failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});

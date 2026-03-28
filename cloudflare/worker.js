export default {
  async fetch(req, env) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items" }), { status: 400, headers });
    }

    const params = new URLSearchParams({
      "payment_method_types[]": "card",
      "mode": "payment",
      "success_url": "https://uberniche.co.uk/thanks",
      "cancel_url": "https://uberniche.co.uk",
      "shipping_address_collection[allowed_countries][]": "GB",
    });
    items.forEach(({ priceId, quantity }, i) => {
      params.set(`line_items[${i}][price]`, priceId);
      params.set(`line_items[${i}][quantity]`, String(quantity ?? 1));
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const session = await stripeRes.json();

    if (!session.url) {
      return new Response(JSON.stringify({ error: "No session URL", detail: session }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ url: session.url }), { headers });
  }
};
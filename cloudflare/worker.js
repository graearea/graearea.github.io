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

    const { priceId } = await req.json();

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "payment_method_types[]": "card",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "mode": "payment",
        "success_url": "https://uberniche.co.uk/thanks",
        "cancel_url": "https://uberniche.co.uk",
        "shipping_address_collection[allowed_countries][]": "GB",
      }),
    });

    const session = await stripeRes.json();

    if (!session.url) {
      return new Response(JSON.stringify({ error: "No session URL", detail: session }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ url: session.url }), { headers });
  }
};
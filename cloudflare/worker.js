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

    const EUROPE = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","NO","CH","IS","LI"];
    const country = req.cf?.country ?? "GB";
    const isUK = country === "GB";
    const isEurope = EUROPE.includes(country);
    const [shippingName, shippingPence] = isUK ? ["UK Shipping", 400] : isEurope ? ["Europe Shipping", 1200] : ["International Shipping", 1500];

    const params = new URLSearchParams({
      "payment_method_types[]": "card",
      "mode": "payment",
      "success_url": "https://uberniche.co.uk/thanks",
      "cancel_url": "https://uberniche.co.uk",
      ...["GB","US","CA","AU","NZ","AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","NO","CH","IS","LI"]
        .reduce((acc, c, i) => ({ ...acc, [`shipping_address_collection[allowed_countries][${i}]`]: c }), {}),
      "shipping_options[0][shipping_rate_data][type]": "fixed_amount",
      "shipping_options[0][shipping_rate_data][display_name]": shippingName,
      "shipping_options[0][shipping_rate_data][fixed_amount][amount]": String(shippingPence),
      "shipping_options[0][shipping_rate_data][fixed_amount][currency]": "gbp",
    });
    const labelMeta = {};
    items.forEach(({ priceId, quantity, label }, i) => {
      params.set(`line_items[${i}][price]`, priceId);
      params.set(`line_items[${i}][quantity]`, String(quantity ?? 1));
      if (label) labelMeta[priceId] = label;
    });
    if (Object.keys(labelMeta).length > 0) {
      params.set("metadata[item_labels]", JSON.stringify(labelMeta));
    }

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

    const isUSCA = ["US", "CA"].includes(country);
    const warning = isUSCA
      ? "Heads up: US and Canadian orders will incur customs/import duties on arrival. I'll contact you after you order to arrange payment of these separately before I ship."
      : null;

    return new Response(JSON.stringify({ url: session.url, warning }), { headers });
  }
};
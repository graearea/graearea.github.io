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
      "shipping_address_collection[allowed_countries][0]": "GB",
      "shipping_address_collection[allowed_countries][1]": "US",
      "shipping_address_collection[allowed_countries][2]": "CA",
      "shipping_address_collection[allowed_countries][3]": "AU",
      "shipping_address_collection[allowed_countries][4]": "NZ",
      "shipping_address_collection[allowed_countries][5]": "AT",
      "shipping_address_collection[allowed_countries][6]": "BE",
      "shipping_address_collection[allowed_countries][7]": "FR",
      "shipping_address_collection[allowed_countries][8]": "DE",
      "shipping_address_collection[allowed_countries][9]": "IE",
      "shipping_address_collection[allowed_countries][10]": "IT",
      "shipping_address_collection[allowed_countries][11]": "NL",
      "shipping_address_collection[allowed_countries][12]": "NO",
      "shipping_address_collection[allowed_countries][13]": "ES",
      "shipping_address_collection[allowed_countries][14]": "SE",
      "shipping_address_collection[allowed_countries][15]": "CH",
      "shipping_address_collection[allowed_countries][16]": "PL",
      "shipping_options[0][shipping_rate_data][type]": "fixed_amount",
      "shipping_options[0][shipping_rate_data][display_name]": shippingName,
      "shipping_options[0][shipping_rate_data][fixed_amount][amount]": String(shippingPence),
      "shipping_options[0][shipping_rate_data][fixed_amount][currency]": "gbp",
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

    const isUSCA = ["US", "CA"].includes(country);
    const warning = isUSCA
      ? "Heads up: US and Canadian orders will incur customs/import duties on arrival. I'll contact you after you order to arrange payment of these separately before I ship."
      : null;

    return new Response(JSON.stringify({ url: session.url, warning }), { headers });
  }
};
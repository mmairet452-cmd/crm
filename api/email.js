export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientId     = process.env.M365_CLIENT_ID;
  const tenantId     = process.env.M365_TENANT_ID;
  const clientSecret = process.env.M365_CLIENT_SECRET;

  if (!clientId || !tenantId || !clientSecret) {
    return res.status(500).json({ error: 'M365 environment variables not configured in Vercel' });
  }

  const { fromEmail, toEmail, toName, subject, body, saveToSent } = req.body;

  try {
    // Step 1: Get access token
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default'
        })
      }
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(401).json({ error: 'Token failed: ' + (tokenData.error_description || tokenData.error) });
    }

    // Step 2: Send email via Graph
    const mailRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + tokenData.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'Text', content: body },
            toRecipients: [{ emailAddress: { address: toEmail, name: toName || toEmail } }],
            from: { emailAddress: { address: fromEmail } }
          },
          saveToSentItems: saveToSent !== false
        })
      }
    );

    if (mailRes.ok || mailRes.status === 202) {
      return res.status(200).json({ success: true });
    }

    const errData = await mailRes.json();
    return res.status(mailRes.status).json({ error: errData.error?.message || 'Send failed' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

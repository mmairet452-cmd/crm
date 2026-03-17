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
    return res.status(500).json({ error: 'M365 environment variables not configured' });
  }

  const { fromEmail, folder, top } = req.body;
  const folderMap = {
    inbox: 'inbox',
    sentitems: 'sentItems'
  };
  const graphFolder = folderMap[folder] || 'inbox';
  const limit = top || 25;

  try {
    // Get token
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

    // Fetch emails
    const mailRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${fromEmail}/mailFolders/${graphFolder}/messages?$top=${limit}&$orderby=receivedDateTime desc&$select=subject,from,toRecipients,receivedDateTime,sentDateTime,bodyPreview,body,isRead`,
      {
        headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
      }
    );

    if (!mailRes.ok) {
      const err = await mailRes.json();
      return res.status(mailRes.status).json({ error: err.error?.message || 'Failed to fetch emails' });
    }

    const data = await mailRes.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

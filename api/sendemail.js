export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resendKey = process.env.RESEND_KEY;
  if (!resendKey) return res.status(500).json({ error: 'RESEND_KEY not configured' });

  const { fromEmail, fromName, toEmail, toName, subject, body } = req.body;

  // Map sender to display name
  const displayName = fromEmail.includes('rfrank') ? 'Richard J. Frank' : 'Sarah Chen';
  const replyTo = fromEmail; // replies go back to rfrank@ or sarah@

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + resendKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${displayName} <outreach@eigenvalueconsulting.com>`,
        to: [`${toName || toEmail} <${toEmail}>`],
        reply_to: replyTo,
        subject: subject,
        text: body,
      })
    });

    const data = await r.json();
    
    if (!r.ok) {
      return res.status(r.status).json({ error: data.message || data.name || 'Send failed' });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

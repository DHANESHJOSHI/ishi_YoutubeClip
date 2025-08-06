export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const debug = {
        hasGoogleServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT,
        environmentVariables: {
          GOOGLE_SERVICE_ACCOUNT_SET: !!process.env.GOOGLE_SERVICE_ACCOUNT,
          SHEET_ID_SET: !!process.env.SHEET_ID,
          YT_API_KEY_SET: !!process.env.YT_API_KEY,
          MONGODB_URI_SET: !!process.env.MONGODB_URI
        }
      };

      if (process.env.GOOGLE_SERVICE_ACCOUNT) {
        try {
          const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
          debug.serviceAccountInfo = {
            type: credentials.type,
            project_id: credentials.project_id,
            client_email: credentials.client_email,
            client_id: credentials.client_id,
            hasPrivateKey: !!credentials.private_key,
            privateKeyStartsWith: credentials.private_key ? credentials.private_key.substring(0, 30) + '...' : null,
            auth_uri: credentials.auth_uri,
            token_uri: credentials.token_uri,
            fieldCount: Object.keys(credentials).length
          };

          // Validate JSON structure
          const requiredFields = [
            'type', 'project_id', 'private_key_id', 'private_key', 
            'client_email', 'client_id', 'auth_uri', 'token_uri'
          ];
          
          debug.validation = {
            hasAllRequiredFields: requiredFields.every(field => credentials[field]),
            missingFields: requiredFields.filter(field => !credentials[field]),
            extraFields: Object.keys(credentials).filter(field => !requiredFields.includes(field))
          };

        } catch (parseError) {
          debug.parseError = {
            message: parseError.message,
            jsonLength: process.env.GOOGLE_SERVICE_ACCOUNT.length,
            startsWithBrace: process.env.GOOGLE_SERVICE_ACCOUNT.trim().startsWith('{'),
            endsWithBrace: process.env.GOOGLE_SERVICE_ACCOUNT.trim().endsWith('}')
          };
        }
      }

      return res.json(debug);

    } catch (err) {
      return res.status(500).json({
        error: "Debug failed",
        details: err.message
      });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

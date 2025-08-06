import { google } from "googleapis";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { sheetId } = req.body;

      if (!sheetId) {
        return res.status(400).json({ message: "Sheet ID is required" });
      }

      // Check Google Service Account
      if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
        return res.status(500).json({ message: "GOOGLE_SERVICE_ACCOUNT environment variable not set" });
      }

      let credentials;
      try {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
        console.log("📋 Service Account Info:", {
          type: credentials.type,
          project_id: credentials.project_id,
          client_email: credentials.client_email,
          hasPrivateKey: !!credentials.private_key
        });
      } catch (parseError) {
        console.error("❌ GOOGLE_SERVICE_ACCOUNT JSON Parse Error:", parseError);
        return res.status(500).json({ 
          message: "Invalid GOOGLE_SERVICE_ACCOUNT JSON format",
          error: parseError.message
        });
      }

      // Validate required fields
      const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
      const missingFields = requiredFields.filter(field => !credentials[field]);
      
      if (missingFields.length > 0) {
        return res.status(500).json({ 
          message: "Missing required fields in GOOGLE_SERVICE_ACCOUNT",
          missingFields,
          foundFields: Object.keys(credentials)
        });
      }
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
      });

      const sheets = google.sheets({ version: "v4", auth });

      console.log(`🔧 Setting up Google Sheet: ${sheetId}`);

      // Step 1: Clear existing content
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: "Sheet1!A:Z"
      });

      // Step 2: Add headers
      const headers = [
        "Timestamp",
        "Video ID", 
        "Moderator",
        "Command",
        "Channel",
        "YouTube URL",
        "Processed At"
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "Sheet1!A1:G1",
        valueInputOption: "RAW",
        requestBody: {
          values: [headers]
        }
      });

      // Step 3: Format headers
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            // Make header row bold
            {
              repeatCell: {
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 7
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true,
                      fontSize: 12
                    },
                    backgroundColor: {
                      red: 0.2,
                      green: 0.4, 
                      blue: 0.8
                    },
                    horizontalAlignment: "CENTER"
                  }
                },
                fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)"
              }
            },
            // Set column widths
            {
              updateDimensionProperties: {
                range: {
                  sheetId: 0,
                  dimension: "COLUMNS",
                  startIndex: 0,
                  endIndex: 1
                },
                properties: {
                  pixelSize: 200
                },
                fields: "pixelSize"
              }
            },
            {
              updateDimensionProperties: {
                range: {
                  sheetId: 0,
                  dimension: "COLUMNS", 
                  startIndex: 1,
                  endIndex: 2
                },
                properties: {
                  pixelSize: 150
                },
                fields: "pixelSize"
              }
            },
            {
              updateDimensionProperties: {
                range: {
                  sheetId: 0,
                  dimension: "COLUMNS",
                  startIndex: 2,
                  endIndex: 4
                },
                properties: {
                  pixelSize: 120
                },
                fields: "pixelSize"
              }
            },
            // Freeze header row
            {
              updateSheetProperties: {
                properties: {
                  sheetId: 0,
                  gridProperties: {
                    frozenRowCount: 1
                  }
                },
                fields: "gridProperties.frozenRowCount"
              }
            }
          ]
        }
      });

      // Step 4: Add sample data
      const sampleData = [
        [
          new Date().toLocaleDateString('en-IN'),
          "SAMPLE123",
          "TechWithJoshi", 
          "!clip",
          "TechWithJoshi",
          "https://www.youtube.com/watch?v=SAMPLE123&t=30s",
          new Date().toLocaleString('en-IN')
        ]
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Sheet1!A:G",
        valueInputOption: "RAW",
        requestBody: {
          values: sampleData
        }
      });

      console.log("✅ Google Sheet setup completed successfully");

      return res.json({
        success: true,
        message: "Google Sheet setup completed successfully",
        sheetId,
        headers,
        sampleDataAdded: true,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
      });

    } catch (err) {
      console.error("Sheet setup error:", err);
      return res.status(500).json({
        error: "Failed to setup Google Sheet",
        details: err.message
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const dotenv = require("dotenv");
dotenv.config();
const fs = require("fs");
const { google } = require("googleapis");
const express = require("express");
const multer = require("multer");
const cors = require("cors");

const stream = require("stream");

const app = express();
app.use(express.json()); // Parse JSON request bodies
app.use(cors());

const upload = multer();

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Load credentials if available
try {
  const creds = fs.readFileSync("creds.json");
  oauth2Client.setCredentials(JSON.parse(creds));
} catch (error) {
  console.log("No creds found");
}

const drive = google.drive({ version: "v3", auth: oauth2Client });

// Route to create a folder in Google Drive
app.get("/create-folder/:foldername", async (req, res) => {
  const folderName = req.params.foldername;

  try {
    const fileMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };

    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: "id",
    });

    res.status(200).json({
      folderId: folder.data.id,
      message: "Folder created successfully",
    });
  } catch (error) {
    console.error("Error creating folder:", error);
    res.status(500).json({ message: error });
  }
});

app.post(
  "/upload-file/:foldername",
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const folderName = req.params.foldername;
    const fileContent = req.file.buffer;
    const fileName = req.file.originalname;

    try {
      const searchResponse = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, name)",
      });

      const folder = searchResponse.data.files[0];
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }

      const folderId = folder.id;

      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      // Convert buffer to stream
      const media = {
        mimeType: req.file.mimetype,
        body: stream.Readable.from(fileContent),
      };

      const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id, webViewLink",
      });

      res.status(200).json({
        fileId: file.data.id,
        fileLink: file.data.webViewLink,
        message: "File uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading file:", error.message);
      res.status(500).json({ error: "Failed to upload file" });
    }
  }
);

// Listen on the specified port
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

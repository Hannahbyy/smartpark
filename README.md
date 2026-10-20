# SmartPark MCKL

SmartPark MCKL is a parking-management dashboard for viewing parking-space status and managing video sources and parking calibration.

## Features

- Parking-space status dashboard
- Admin panel for managing video sources
- Upload and use your own parking video
- Calibration tools for parking spaces
- Plate registry and plate-read views

## Requirements

- [Node.js](https://nodejs.org/) and npm
- [FFmpeg](https://ffmpeg.org/) installed and available on your `PATH` if you want to extract calibration frames from a video

## Run locally

1. Clone the repository and enter the project folder:

   ```bash
   git clone https://github.com/Hannahbyy/smartpark.git
   cd smartpark
   ```

2. Install the Node.js dependencies:

   ```bash
   npm install
   ```

3. Create a local `.env` file by copying `.env.example`.

   **Windows PowerShell:**

   ```powershell
   Copy-Item .env.example .env
   ```

   **macOS/Linux:**

   ```bash
   cp .env.example .env
   ```

4. Open `.env` and set `ADMIN_PASSWORD` to a unique password of at least 12 characters. Keep `.env` private and do not commit it.

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Add your own video

Video files are excluded from this repository, so a fresh clone will not include a demo video.

1. Start the app and open the Admin panel.
2. Use the video upload control to upload a video from your computer.
3. Select the uploaded video as the active source.

Uploaded files are stored locally in the `uploads` folder. The folder is created automatically if it does not exist, and its contents are not committed to Git.

To extract a calibration frame, install FFmpeg and make sure the `ffmpeg` command is available in your terminal.

## Build

To create a production build:

```bash
npm run build
```

## Privacy and configuration

- Do not commit `.env`, passwords, API keys, or other secrets.
- Image and video files are excluded by `.gitignore`; add your own media locally as needed.
- The `static` and `uploads` folders are kept in the repository with placeholder files, but their contents are ignored.

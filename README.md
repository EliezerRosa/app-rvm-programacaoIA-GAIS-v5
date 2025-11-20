# Run and deploy your AI Studio app

![GHBanner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

This contains everything you need to run your app locally.

View your app in AI Studio: <https://ai.studio/apps/drive/11l9oAhdWDXN-ZOPUznLwqPZpMTUp2m4j>

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key (for local development only). For CI/CD use repository secrets (`Settings > Secrets and variables > Actions`).
3. Run the app:
   `npm run dev`

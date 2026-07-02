# Zen Flow: AI-Powered Task & Workflow Planner

Zen Flow is a peak-performance scheduler and visual agenda manager designed to help you organize thoughts, instantiate step-by-step interactive AI blueprints, and maintain healthy routines.

---

## 🚀 How to Run the App (From Scratch)

Follow these steps to launch the application locally on your system:

### 1. Prerequisites
Ensure you have **Node.js** (v18 or higher recommended) and **npm** installed. You can check your version by running:
```bash
node -v
npm -v
```

### 2. Install Dependencies
Navigate to the project root directory and install the required packages:
```bash
npm install
```

### 3. Configure the API Key
Copy or create the `.env` configuration file in the project root:
* Make sure a file named `.env` exists in the root folder.
* Open the `.env` file and insert your API key credentials:
  ```env
  GEMINI_API_KEY="your-api-key-here"
  GOOGLE_API_KEY="your-api-key-here"
  ```
  *(See the **API Key Guide** below for instructions on obtaining and replacing keys)*

### 4. Start the Application
Run the local development server:
```bash
npm run dev
```
Once started, open your browser and navigate to the local runtime URL:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 API Key Guide (Switching AI Accounts)

The application utilizes Google Gemini AI to structure scheduling outputs and compile focus step-by-step guides.

### Where is the key stored?
The active credentials are loaded from the **`.env`** file located in the root of the project workspace.

### How to switch keys or change accounts:
1. Open the **`.env`** file in your text editor.
2. Replace the values for both `GEMINI_API_KEY` and `GOOGLE_API_KEY` with your new credentials:
   ```env
   GEMINI_API_KEY="AIzaSyYourNewKeyHere..."
   GOOGLE_API_KEY="AIzaSyYourNewKeyHere..."
   ```
3. **Save** the file.
4. **Restart the server:** In your terminal, stop the running server (`Ctrl + C`) and run the start command again:
   ```bash
   npm run dev
   ```

### Verifying connection status:
Look at the **AI Quota** pill at the bottom-right of your application board.
* **Green pulse:** Your credentials are valid and detected successfully.
* **Red indicator:** The application is missing the API keys. Check your `.env` configuration values.
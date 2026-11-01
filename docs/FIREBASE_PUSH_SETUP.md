# Firebase Cloud Messaging (FCM) Production Push Setup Guide

This guide describes how to generate, encode, and configure the Firebase Admin Service Account credentials for the backend server (`service-provider-marketplace.onrender.com`), verify initialization, test notification flows, and rotate keys safely.

---

## 1. Obtain Firebase Admin Service Account Key

Both mobile applications (**Customer App** and **Provider App**) share the single Firebase project:
* **Firebase Project ID:** `service-provider-marketplace`
* **Firebase Project Number:** `894601382298`

### Steps in Firebase Console:
1. Open the direct Firebase Service Accounts console:
   [https://console.firebase.google.com/project/service-provider-marketplace/settings/serviceaccounts/adminsdk](https://console.firebase.google.com/project/service-provider-marketplace/settings/serviceaccounts/adminsdk)
   *(Or navigate to **Project settings (⚙️)** > **Service accounts** tab > **Firebase Admin SDK**).*
2. Ensure **Node.js** option is selected.
3. Click the **Generate new private key** button.
4. Confirm the prompt by clicking **Generate key**.
5. A `.json` credential file will download to your local machine (e.g. `service-provider-marketplace-firebase-adminsdk-xxxxx.json` in your `Downloads` directory).

> [!CAUTION]
> Treat this `.json` file as a production secret. Never commit it to Git, never upload it to a public repository, and never paste its raw content in public chat or ticket threads.

---

## 2. Convert Key to Base64 on Windows PowerShell (Without Printing Private Key)

To prevent newline truncation or escaping errors when adding credentials to cloud hosting dashboards (like Render), encode the JSON file as a UTF-8 Base64 string directly into your clipboard:

Open Windows PowerShell and run:

```powershell
$targetFile = Get-ChildItem -Path "$env:USERPROFILE\Downloads\*adminsdk*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $targetFile) {
    Write-Error "No Firebase Admin SDK JSON file found in Downloads folder."
} else {
    $rawContent = Get-Content -Path $targetFile.FullName -Raw
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($rawContent)
    $base64 = [Convert]::ToBase64String($bytes)
    [System.Windows.Forms.Clipboard]::SetText($base64) 2>$null
    if (-not $?) {
        # Fallback to Set-Clipboard
        Set-Clipboard -Value $base64
    }
    Write-Host "[SUCCESS] Base64 string safely copied to clipboard from: $($targetFile.Name)" -ForegroundColor Green
}
```

This command directly transfers the Base64 value into your clipboard without printing the secret key to the console screen.

---

## 3. Configure Render Environment Variable

1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Select your backend Web Service (`service-provider-marketplace`).
3. Click on **Environment** in the left navigation menu.
4. Add or update the environment variable:
   * **Key:** `FIREBASE_SERVICE_ACCOUNT`
   * **Value:** Paste (`Ctrl + V`) the Base64 string copied in Step 2.
5. Click **Save Changes**.
6. Render will automatically trigger a new deployment with the updated environment variable.

---

## 4. Verify Initialization via Sanitized Logs

Once the deployment completes on Render, inspect the **Logs** tab in Render Dashboard:

### Expected Success Output:
```text
[Firebase] Firebase Admin SDK successfully initialized.
```

### Standby (Unconfigured / Placeholder) Output:
If the variable is missing or contains placeholder text, the backend safely remains in standby mode without crashing:
```text
[Firebase] Placeholder credentials detected in FIREBASE_SERVICE_ACCOUNT. Push notifications are in standby mode.
```
or
```text
[Firebase] Service account credentials not provided. Push notifications are in standby mode.
```

> [!NOTE]
> The backend initialization code in `backend/src/config/firebase.js` is programmed to never print the private key, client email, or token contents to standard output or error logs.

---

## 5. End-to-End Verification Test Workflow

### Test 1: Customer Creates Booking -> Provider Receives Push
1. Log in to the **Provider App** on an Android device or emulator with a registered provider account.
2. Ensure notifications permission was accepted. The app registers its native FCM token with `POST /api/notifications/token`.
3. Put the Provider App in the background or stay on the Dashboard.
4. From the **Customer App**, select a service and create a new booking for that provider.
5. **Expected Outcome:**
   * Backend logs `[BOOKING_NOTIFICATION] Dispatched push and in-app notification(s)`.
   * Provider receives a push banner with title: `New Booking Request`.
   * In-app notification bell badge increments.
   * Tapping the notification opens the booking detail screen.

### Test 2: Provider Accepts Booking -> Customer Receives Push
1. In the **Provider App**, tap **Accept** on the booking request.
2. The booking status updates to `accepted` in MongoDB.
3. **Expected Outcome:**
   * Backend logs `[BOOKING_ACCEPTED]`.
   * Customer device receives push banner with title: `Booking Confirmed`.
   * Customer in-app notification badge increments.
   * Tapping the notification displays the confirmed booking details.

---

## 6. Key Revocation and Rotation Procedure

If a service account private key is ever exposed or compromised:

1. Go to the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials?project=service-provider-marketplace).
2. Locate the service account under **Service Accounts** (`firebase-adminsdk-...`).
3. Click on the service account and switch to the **Keys** tab.
4. Click **Add Key** > **Create new key** > **JSON** to generate the new credential.
5. Follow Step 2 & 3 above to update `FIREBASE_SERVICE_ACCOUNT` on Render.
6. Return to Google Cloud Console and click the trash can icon (Delete) on the old/compromised key to immediately invalidate it.

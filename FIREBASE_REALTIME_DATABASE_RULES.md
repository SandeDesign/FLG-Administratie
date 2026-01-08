# Firebase Realtime Database Security Rules

## Required Configuration

The Bank Statement Import feature uses Firebase Realtime Database to store import history. You need to configure security rules in your Firebase Console.

### How to Configure

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **alloon**
3. Navigate to **Realtime Database** in the left sidebar
4. Click on the **Rules** tab
5. Replace the existing rules with the rules below
6. Click **Publish**

### Security Rules

```json
{
  "rules": {
    "companies": {
      "$companyId": {
        ".read": "auth != null",
        ".write": "auth != null",

        "bankImports": {
          "$importId": {
            ".read": "auth != null",
            ".write": "auth != null",
            ".validate": "newData.hasChildren(['companyId', 'companyName', 'importedBy', 'importedByName', 'totalLines', 'format', 'matchedCount', 'unmatchedCount', 'matchedTransactions', 'unmatchedTransactions', 'importedAt'])"
          }
        }
      }
    }
  }
}
```

### Rule Explanation

- **Authentication Required**: All read/write operations require the user to be authenticated
- **Company Isolation**: Data is organized by company ID
- **Validation**: Ensures all required fields are present when creating imports
- **Access Control**: Only authenticated users can read/write bank import data

### Data Structure

Bank imports are stored at:
```
/companies/{companyId}/bankImports/{importId}
```

Each import contains:
- `companyId`: Company identifier
- `companyName`: Company name
- `importedBy`: User ID who imported
- `importedByName`: User name who imported
- `totalLines`: Total number of transactions
- `format`: CSV or MT940
- `matchedCount`: Number of matched transactions
- `unmatchedCount`: Number of unmatched transactions
- `matchedTransactions`: Array of matched transaction objects
- `unmatchedTransactions`: Array of unmatched transaction objects
- `importedAt`: Timestamp (milliseconds)
- `rawData`: Optional raw file content (truncated to 10,000 chars)

### Testing the Rules

After publishing, test by:
1. Logging in as an admin user
2. Navigate to Bank Statement Import page
3. Import a sample bank statement
4. Verify the import appears in history

### Troubleshooting

**Permission Denied Error:**
- Verify you published the rules in Firebase Console
- Confirm the Realtime Database is created (not just Firestore)
- Check that your user is authenticated
- Wait a few minutes for rule changes to propagate

**Database Not Found:**
- Go to Firebase Console → Realtime Database
- If it says "Create Database", click it
- Choose your region (europe-west1 recommended for EU)
- Start in "locked mode" then apply the rules above

### Enhanced Security (Optional)

For production, you can add role-based access:

```json
{
  "rules": {
    "companies": {
      "$companyId": {
        "bankImports": {
          ".read": "auth != null && (
            root.child('users').child(auth.uid).child('role').val() == 'admin' ||
            root.child('users').child(auth.uid).child('role').val() == 'manager'
          )",
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() == 'admin'",

          "$importId": {
            ".validate": "newData.hasChildren(['companyId', 'companyName', 'importedBy', 'importedByName', 'totalLines', 'format', 'matchedCount', 'unmatchedCount', 'matchedTransactions', 'unmatchedTransactions', 'importedAt'])"
          }
        }
      }
    }
  }
}
```

This restricts:
- Read access: Admin and Manager roles only
- Write access: Admin role only

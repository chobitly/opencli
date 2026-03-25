# Agent Development & Environment Guide

## 🚀 Getting Started (Source Code Mode)

If you are developing or running `opencli` from source, follow these environment requirements to avoid syntax errors like `SyntaxError: Unexpected token '??='`.

### 1. Node.js Version Requirements

- **Minimum Version**: Node.js **20.0.0** or higher.
- **Recommended**: Node.js **24.x** (latest LTS/Current).

### 2. Version Management (NVM)

If you have multiple Node versions, use NVM to switch before building:

```powershell
nvm use 24
```

### 3. Installation & Local Linking

After switching to the correct Node version, run these commands in the root directory:

```powershell
# 1. Install dependencies
npm install

# 2. Build the project (TypeScript to JavaScript)
npm run build

# 3. Link globally
npm link

# 4. Verify installation
opencli list
```

## 🛠️ Troubleshooting

### SyntaxError: Unexpected token '??='
- **Cause**: This error occurs when the Node.js version is too low (e.g., v14.x or v16.x). The `??=` operator (logical nullish assignment) was introduced in Node.js 15.x.
- **Fix**: Upgrade to Node.js 20 or higher using `nvm`.

### NVM Permission Errors
- **Cause**: `nvm use` may fail if the terminal is not run as Administrator on Windows.
- **Fix**: Open PowerShell as **Administrator** and run `nvm use <version>`.


---

### 最后，**重要**的一点：User更喜欢用中文，所以请尽量用中文回答问题。

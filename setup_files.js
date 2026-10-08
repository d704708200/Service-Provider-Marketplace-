const fs = require('fs');
const path = require('path');

const write = (file, content) => {
  fs.writeFileSync(path.join(__dirname, file), content.trim() + '\n', 'utf8');
};

// Root package.json
write('package.json', `
{
  "name": "service-provider-marketplace",
  "version": "1.0.0",
  "description": "Service Provider Marketplace",
  "scripts": {
    "backend": "cd backend && npm start",
    "customer": "cd customer-app && npm start",
    "provider": "cd provider-app && npm start",
    "admin": "cd admin-panel && npm run dev",
    "install:all": "npm install && cd backend && npm install && cd ../customer-app && npm install && cd ../provider-app && npm install && cd ../admin-panel && npm install"
  }
}
`);

// Root README
write('README.md', `# Service Provider Marketplace\n\nPhase 1 Setup.`);

// Root .gitignore
write('.gitignore', `
node_modules/
.env
.DS_Store
dist/
build/
.expo/
`);

// Backend package.json
write('backend/package.json', `
{
  "name": "backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cloudinary": "^2.0.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.2.0",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.3.0",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
`);

// Backend .env.example
write('backend/.env.example', `
PORT=5000
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CUSTOMER_APP_URL=
PROVIDER_APP_URL=
ADMIN_PANEL_URL=
NODE_ENV=development
`);

// Backend server.js
write('backend/server.js', `
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Service Provider Marketplace API is running'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
`);

// Admin Panel package.json
write('admin-panel/package.json', `
{
  "name": "admin-panel",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.8",
    "lucide-react": "^0.371.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "vite": "^5.2.0"
  }
}
`);

write('admin-panel/.env.example', `
VITE_API_URL=http://localhost:5000/api
`);

write('admin-panel/vite.config.js', `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`);

write('admin-panel/tailwind.config.js', `
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`);

write('admin-panel/postcss.config.js', `
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`);

write('admin-panel/index.html', `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Admin Panel</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`);

write('admin-panel/src/main.jsx', `
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`);

write('admin-panel/src/index.css', `
@tailwind base;
@tailwind components;
@tailwind utilities;
`);

write('admin-panel/src/App.jsx', `
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div className="p-4"><h1 className="text-2xl font-bold">Admin Panel</h1></div>} />
      </Routes>
    </Router>
  );
}
export default App;
`);

const expoAppJson = (name) => {
  return '{' +
    '  "expo": {' +
    '    "name": "' + name + '",' +
    '    "slug": "' + name + '",' +
    '    "version": "1.0.0",' +
    '    "orientation": "portrait",' +
    '    "icon": "./assets/icon.png",' +
    '    "userInterfaceStyle": "light",' +
    '    "splash": {' +
    '      "image": "./assets/splash.png",' +
    '      "resizeMode": "contain",' +
    '      "backgroundColor": "#ffffff"' +
    '    },' +
    '    "assetBundlePatterns": [' +
    '      "**/*"' +
    '    ],' +
    '    "ios": {' +
    '      "supportsTablet": true' +
    '    },' +
    '    "android": {' +
    '      "adaptiveIcon": {' +
    '        "foregroundImage": "./assets/adaptive-icon.png",' +
    '        "backgroundColor": "#ffffff"' +
    '      }' +
    '    },' +
    '    "web": {' +
    '      "favicon": "./assets/favicon.png"' +
    '    }' +
    '  }' +
    '}';
};

const expoPackageJson = (name) => {
  return '{' +
    '  "name": "' + name + '",' +
    '  "version": "1.0.0",' +
    '  "main": "node_modules/expo/AppEntry.js",' +
    '  "scripts": {' +
    '    "start": "expo start",' +
    '    "android": "expo start --android",' +
    '    "ios": "expo start --ios",' +
    '    "web": "expo start --web"' +
    '  },' +
    '  "dependencies": {' +
    '    "@react-native-async-storage/async-storage": "1.23.1",' +
    '    "@react-navigation/bottom-tabs": "^6.5.20",' +
    '    "@react-navigation/native": "^6.1.17",' +
    '    "@react-navigation/native-stack": "^6.9.26",' +
    '    "axios": "^1.6.8",' +
    '    "expo": "~51.0.8",' +
    '    "expo-image-picker": "~15.0.5",' +
    '    "expo-notifications": "~0.28.1",' +
    '    "expo-status-bar": "~1.12.1",' +
    '    "react": "18.2.0",' +
    '    "react-native": "0.74.1",' +
    '    "react-native-safe-area-context": "4.10.1",' +
    '    "react-native-screens": "3.31.1"' +
    '  },' +
    '  "devDependencies": {' +
    '    "@babel/core": "^7.20.0"' +
    '  },' +
    '  "private": true' +
    '}';
};

const expoAppJs = `
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

const Stack = createNativeStackNavigator();

function HomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Home Screen</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
`;

// Customer App
write('customer-app/package.json', expoPackageJson('customer-app'));
write('customer-app/app.json', expoAppJson('customer-app'));
write('customer-app/App.js', expoAppJs);
write('customer-app/.env.example', 'EXPO_PUBLIC_API_URL=http://localhost:5000/api');

// Provider App
write('provider-app/package.json', expoPackageJson('provider-app'));
write('provider-app/app.json', expoAppJson('provider-app'));
write('provider-app/App.js', expoAppJs);
write('provider-app/.env.example', 'EXPO_PUBLIC_API_URL=http://localhost:5000/api');

// Dummy assets for Expo apps so they don't crash without images
const createDummyAssets = (appFolder) => {
  write(appFolder + '/assets/icon.png', '');
  write(appFolder + '/assets/splash.png', '');
  write(appFolder + '/assets/adaptive-icon.png', '');
  write(appFolder + '/assets/favicon.png', '');
};

createDummyAssets('customer-app');
createDummyAssets('provider-app');

console.log('Files generated successfully.');

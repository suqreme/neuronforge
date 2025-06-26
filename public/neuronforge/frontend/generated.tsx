```javascript
// App.js
import React from 'react';
import ProfileCard from './components/ProfileCard';

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <ProfileCard />
    </div>
  );
}

export default App;

// components/ProfileCard.js
import React from 'react';

const ProfileCard = () => {
  return (
    <div className="bg-white shadow-lg rounded-lg p-6 max-w-sm w-full">
      <div className="flex flex-col items-center">
        <img
          className="w-32 h-32 rounded-full border-4 border-indigo-500"
          src="https://via.placeholder.com/150"
          alt="Profile"
        />
        <h2 className="mt-4 text-xl font-semibold text-gray-800">John Doe</h2>
        <p className="text-indigo-500">Frontend Developer</p>
        <div className="mt-4 text-gray-600">
          <p>Email: johndoe@example.com</p>
          <p>Phone: (123) 456-7890</p>
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;

// index.css
@tailwind base;
@tailwind components;
@tailwind utilities;

// index.js
import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// tailwind.config.js
module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
  },
  variants: {
    extend: {},
  },
  plugins: [],
};

// package.json (dependencies section)
"dependencies": {
  "react": "^17.0.2",
  "react-dom": "^17.0.2",
  "react-scripts": "4.0.3",
  "tailwindcss": "^2.2.19"
}
```
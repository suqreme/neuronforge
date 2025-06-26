Certainly! Below is a simple implementation of a Node.js server using Express to serve a static React application. This example assumes that your React app has been built and the static files are located in a `build` directory. The server will also include a basic route to handle contact form submissions, which you can later expand to send emails using an API service like SendGrid or Nodemailer.

```javascript
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'build')));

// API route to handle contact form submissions
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;

  // Here you can add functionality to send the email using an API service
  // For now, we'll just log the contact form data to the console
  console.log(`Contact form submitted: Name - ${name}, Email - ${email}, Message - ${message}`);

  // Send a response back to the client
  res.status(200).json({ message: 'Contact form submitted successfully!' });
});

// Catch-all handler to serve the React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
```

### Instructions:

1. **Build your React app**: Ensure your React app is built using `npm run build` or `yarn build`. This will create a `build` directory containing the static files.

2. **Directory Structure**: Place this `server.js` file in the root of your project, alongside the `build` directory.

3. **Install Dependencies**: Run `npm install express body-parser` to install the necessary packages.

4. **Run the Server**: Start the server using `node server.js`. Your React app should now be served at `http://localhost:3000`.

5. **Expand Functionality**: To handle contact form submissions, you can integrate an email service like SendGrid or Nodemailer in the `/api/contact` route.

This setup provides a basic structure to serve a static React app and handle form submissions. You can expand upon this by integrating additional features as needed.
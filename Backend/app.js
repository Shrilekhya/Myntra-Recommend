require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 4000;

app.use(cors());

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO setup
const server = require('http').createServer(app);
const io = require('socket.io')(server);

// Serve index.html on root GET request
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/social', (req, res) => {
    res.render('social');
});

// Handle POST request for recommendation
app.post('/recommend', async (req, res) => {
    try {
        // Input data for recommendation
        const input_product = req.body;
        
        console.log('Input data:', input_product);

        // Paths to Python and script
        const pythonPath = process.env.PYTHON;
        const scriptPath = process.env.SCRIPT_PATH;

        // Check if environment variables are loaded
        if (!pythonPath || !scriptPath) {
            console.error('Environment variables PYTHON and SCRIPT_PATH must be set');
            return res.status(500).send('Server configuration error');
        }

        // Spawn a new Python process
        const pyScript = spawn(pythonPath, [scriptPath, JSON.stringify(input_product)]);

        // Collect data chunks from Python script stdout
        let dataChunks = [];
        let errorOccurred = false;
        let errorMessage = '';
        
        pyScript.stdout.on('data', function(data) {
            dataChunks.push(data);
        });

        // Handle stderr data
        pyScript.stderr.on('data', function(data) {
            errorOccurred = true;
            errorMessage += data.toString();
            console.error('Error from Python script:', data.toString());
        });

        // Handle Python script exit
        pyScript.on('exit', function(code) {
            console.log('Python script exited with code', code);
            if (code === 0 && !errorOccurred) {
                // Concatenate all data chunks and parse JSON
                let results = Buffer.concat(dataChunks).toString('utf-8');
                try {
                    let recommended_products = JSON.parse(results);
                    console.log('Recommended products:', recommended_products);
                    res.render('recommendation', { products: recommended_products });
                } catch (error) {
                    console.error('Error parsing JSON from Python script:', error);
                    if (!res.headersSent) {
                        res.status(500).send('Error parsing JSON from Python script');
                    }
                }
            } else {
                if (!res.headersSent) {
                    res.status(500).send(`Python script exited with non-zero code or error occurred: ${errorMessage}`);
                }
            }
        });
    } catch (error) {
        console.error('Error in /recommend POST endpoint:', error);
        if (!res.headersSent) {
            res.status(500).send('Server error');
        }
    }
});

// Handle POST request for chat messages
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        // Emit message to all connected clients
        io.emit('chat message', message);
        
        res.sendStatus(200);
    } catch (error) {
        console.error('Error handling chat message:', error);
        res.status(500).send('Server error');
    }
});

// Handle Socket.IO connections
io.on('connection', (socket) => {
    console.log('A user connected');
    
    // Handle incoming chat messages
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start server
server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

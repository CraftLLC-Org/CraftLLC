import { neon } from '@neondatabase/serverless';
import * as bcrypt from 'bcryptjs';
import * as jwt from '@tsndr/cloudflare-worker-jwt'; // Додано для роботи з JWT

let isDbSetup = false;

// Utility function to validate username
function isValidUsername(username) {
    return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

// Utility function to validate name/surname
function isValidName(name) {
    return /^[а-яА-ЯёЁіІїЇєЄa-zA-Z]+$/.test(name);
}

// Function to set up the database table if it doesn't exist
async function setupDatabase(db) {
    if (isDbSetup) {
        return;
    }
    // Changed: Removed the session_token column as we are moving to stateless JWTs
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            surname VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
    try {
        await db(createTableQuery);
        isDbSetup = true;
        console.log("Database table 'users' is ready.");
    } catch (error) {
        console.error("Failed to set up database:", error);
        throw error; // Re-throw the error to halt execution if the DB setup fails
    }
}

// Middleware for authentication with JWT
async function isAuthenticated(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authenticated: false, response: new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid token" }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
    }
    
    const token = authHeader.split(' ')[1];
    try {
        const isTokenValid = await jwt.verify(token, env.JWT_SECRET);
        if (!isTokenValid) {
            return { authenticated: false, response: new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
        }
        const { payload } = jwt.decode(token);
        return { authenticated: true, payload };
    } catch (error) {
        console.error("Token verification failed:", error);
        return { authenticated: false, response: new Response(JSON.stringify({ error: "Unauthorized: Token verification failed" }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const db = neon(env.DATABASE_URL);

        // CORS headers for all responses
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        // Handle OPTIONS pre-flight request
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers });
        }

        try {
            await setupDatabase(db);
        } catch (error) {
            return new Response('Database setup failed', { status: 500, headers });
        }

        // API routes
        if (path.startsWith('/api/')) {
            const apiPath = path.substring(5); // remove '/api/'
            switch (apiPath) {
                case 'register':
                    return handleRegistration(request, db, headers);
                case 'login':
                    return handleLogin(request, db, env, headers);
                
                // Protected routes that require authentication
                case 'user':
                    return handleGetUser(request, db, env, headers);
                case 'profile/update':
                    return handleProfileUpdate(request, db, env, headers);
                case 'account/delete':
                    return handleDeleteAccount(request, db, env, headers);
                case 'logout':
                    return new Response(JSON.stringify({ message: "Logout successful" }), { status: 200, headers });
                default:
                    return new Response('Not Found', { status: 404, headers });
            }
        }

        // Serve static assets for all other paths
        return env.ASSETS.fetch(request);
    },
};

// Handlers for API routes
async function handleRegistration(request, db, headers) {
    try {
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
        }
        const { username, name, surname, email, password } = await request.json();

        // Basic validation
        if (!username || !name || !surname || !email || !password) {
            return new Response(JSON.stringify({ error: 'All fields are required' }), { status: 400, headers });
        }
        if (!isValidUsername(username)) {
            return new Response(JSON.stringify({ error: 'Username must contain only A-Z, 0-9, _, - and be 3-20 characters long' }), { status: 400, headers });
        }
        if (!isValidName(name) || !isValidName(surname)) {
            return new Response(JSON.stringify({ error: 'Name and Surname must contain only letters' }), { status: 400, headers });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();

        const insertQuery = `INSERT INTO users (id, username, name, surname, email, password_hash) VALUES ($1, $2, $3, $4, $5, $6)`;
        await db(insertQuery, [userId, username, name, surname, email, hashedPassword]);

        return new Response(JSON.stringify({ message: 'User registered successfully' }), { status: 201, headers });
    } catch (error) {
        console.error('Registration error:', error);
        return new Response(JSON.stringify({ error: 'Failed to register user' }), { status: 500, headers });
    }
}

async function handleLogin(request, db, env, headers) {
    try {
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
        }
        const { username, password } = await request.json();
        const userQuery = `SELECT id, password_hash FROM users WHERE username = $1`;
        const user = await db(userQuery, [username]);

        if (!user || user.length === 0) {
            return new Response(JSON.stringify({ error: 'Invalid username or password' }), { status: 401, headers });
        }

        const isValid = await bcrypt.compare(password, user[0].password_hash);
        if (!isValid) {
            return new Response(JSON.stringify({ error: 'Invalid username or password' }), { status: 401, headers });
        }

        // Changed: Removed session_token database update. Now, we create a JWT.
        const token = await jwt.sign({ sub: user[0].id, exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) }, env.JWT_SECRET);

        // Changed: Return JWT in JSON body instead of a cookie.
        return new Response(JSON.stringify({ message: 'Login successful', token }), { status: 200, headers });
    } catch (error) {
        console.error('Login error:', error);
        return new Response(JSON.stringify({ error: 'Failed to log in' }), { status: 500, headers });
    }
}

async function handleGetUser(request, db, env, headers) {
    const authResult = await isAuthenticated(request, env);
    if (!authResult.authenticated) {
        return authResult.response;
    }
    
    // Changed: Get user ID from the JWT payload
    const userId = authResult.payload.sub;

    const userQuery = `SELECT id, username, name, surname, email FROM users WHERE id = $1`;
    const user = await db(userQuery, [userId]);

    if (!user || user.length === 0) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers });
    }
    return new Response(JSON.stringify(user[0]), { status: 200, headers });
}

async function handleProfileUpdate(request, db, env, headers) {
    if (request.method !== 'PUT') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
    }
    
    const authResult = await isAuthenticated(request, env);
    if (!authResult.authenticated) {
        return authResult.response;
    }
    const userId = authResult.payload.sub;
    
    const { username, name, surname, email, new_password } = await request.json();

    // Build the query dynamically
    let updates = [];
    let params = [];
    let paramIndex = 1;

    if (username) {
        if (!isValidUsername(username)) {
            return new Response(JSON.stringify({ error: 'Invalid username' }), { status: 400, headers });
        }
        updates.push(`username = $${paramIndex++}`);
        params.push(username);
    }
    if (name) {
        if (!isValidName(name)) {
            return new Response(JSON.stringify({ error: 'Invalid name' }), { status: 400, headers });
        }
        updates.push(`name = $${paramIndex++}`);
        params.push(name);
    }
    if (surname) {
        if (!isValidName(surname)) {
            return new Response(JSON.stringify({ error: 'Invalid surname' }), { status: 400, headers });
        }
        updates.push(`surname = $${paramIndex++}`);
        params.push(surname);
    }
    if (email) {
        updates.push(`email = $${paramIndex++}`);
        params.push(email);
    }
    if (new_password) {
        // Changed: Hashing password with bcrypt
        const newHashedPassword = await bcrypt.hash(new_password, 10);
        updates.push(`password_hash = $${paramIndex++}`);
        params.push(newHashedPassword);
    }

    if (updates.length > 0) {
        const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        params.push(userId);
        await db(updateQuery, params);
    }

    return new Response(JSON.stringify({ message: 'Profile updated successfully' }), { status: 200, headers });
}

async function handleDeleteAccount(request, db, env, headers) {
    if (request.method !== 'DELETE') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
    }
    
    const authResult = await isAuthenticated(request, env);
    if (!authResult.authenticated) {
        return authResult.response;
    }
    const userId = authResult.payload.sub;
    
    const deleteQuery = `DELETE FROM users WHERE id = $1`;
    await db(deleteQuery, [userId]);

    // Changed: No need to clear a session cookie.
    return new Response(JSON.stringify({ message: 'Account deleted successfully' }), { status: 200, headers });
}
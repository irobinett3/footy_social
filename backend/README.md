# FootySocial Backend API

A FastAPI backend with JWT authentication for the FootySocial platform.

## Features

- **User Authentication**: JWT-based authentication with secure password hashing
- **User Management**: Registration, login, profile updates, and account deletion
- **Database**: SQLAlchemy ORM with PostgreSQL support
- **API Documentation**: Automatic OpenAPI/Swagger documentation
- **CORS Support**: Configured for React frontend integration

## Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Environment Configuration**:
   Create a `.env` file with:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/footysocial
   SECRET_KEY=your-secret-key-here
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   ENVIRONMENT=development
   ```

3. **Database Setup**:
   - For PostgreSQL: Create a database named `footysocial`
   - For SQLite (development): The database will be created automatically

4. **Run the server**:
   ```bash
   python main.py
   ```
   Or with uvicorn:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login with username/password (form data)
- `POST /auth/login-json` - Login with JSON payload
- `GET /auth/me` - Get current user info

### Users
- `GET /users/me` - Get current user profile
- `PUT /users/me` - Update user profile
- `DELETE /users/me` - Delete user account

### General
- `GET /` - API welcome message
- `GET /health` - Health check

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Authentication Flow

1. **Register**: `POST /auth/register` with user details
2. **Login**: `POST /auth/login` to get access token
3. **Use Token**: Include `Authorization: Bearer <token>` in protected requests

## Security Features

- Password hashing with bcrypt
- JWT tokens with configurable expiration
- CORS protection
- Input validation with Pydantic
- SQL injection protection with SQLAlchemy ORM

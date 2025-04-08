# InvestGrow

<div align="center">
  


**Grow your wealth with smart investments and multi-level referrals**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-v16+-green.svg)](https://nodejs.org/)
[![PostgreSQL Version](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)

</div>

## 📋 Overview

**InvestGrow** is a full-stack investment and referral reward platform that empowers users to invest predefined amounts, earn consistent monthly returns, and grow their passive income through a 10-level referral commission system. The platform automates ROI distribution, manages multi-level referral tracking, and offers a secure dashboard for users to monitor investments, commissions, and their referral network.

## ✨ Features

### Investment Management
- **Fixed Investment Plans**: Users can invest in slabs like ₹1,000, ₹2,000, ₹5,000, ₹10,000, ₹25,000, ₹50,000, and ₹1,00,000
- **Monthly ROI**: Investors earn 5% monthly ROI for 40 months (200% total return - 100% principal + 100% profit)
- **Automated ROI Distribution**: Monthly ROI payouts handled via backend scheduler

### Referral System
- **10-Level Deep Referral Rewards**: Earn commissions from referrals up to 10 levels deep:
  - Level 1: 10%
  - Level 2: 8%
  - Level 3: 6%
  - Level 4: 4%
  - Levels 5-10: 2% each
- **Unique Referral Codes**: Each user gets a personalized referral code for sharing
- **Auto-Linking**: Referral relationships are automatically established on registration
- **Referral Tree Visualization**: Interactive view of your complete downline with earnings and levels

### User Experience
- **Intuitive Dashboard**: Overview of active investments, ROI history, referral income, and KYC status
- **Referral Performance**: Track referral metrics and commission earnings
- **Transaction History**: Detailed logs of all investments, earnings, and withdrawals
- **Profile Management**: Update personal information and contact details

### Security & Compliance
- **JWT Authentication**: Secure token-based authentication system
- **Password Security**: Bcrypt hashing for secure password storage
- **KYC Integration**: Upload and verify identity documents for compliance
- **Bank Account Verification**: Link and verify bank details for withdrawals
- **Role-Based Access**: Different permission levels for users and administrators

### Admin Features
- **User Management**: View, edit, and manage user accounts
- **Investment Approval**: Review and approve investment transactions
- **KYC Verification**: Process and approve user identity documents
- **Withdrawal Management**: Process and track user withdrawal requests
- **System Monitoring**: Dashboard with key metrics and system health

## 🛠 Tech Stack

### Frontend
- **React.js** with **Vite**: For fast, modern, and modular UI development
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Redux**: State management for complex application data flow
- **Axios**: Handles HTTP requests to the backend API
- **Chart.js**: Visualizes financial data and referral networks
- **React Router**: Client-side routing for SPA experience

### Backend
- **Node.js** with **Express.js**: RESTful API server
- **JWT**: Secure token-based user authentication
- **Bcrypt.js**: Password hashing and security
- **node-cron**: Scheduled tasks for ROI distribution
- **Multer**: File uploads for KYC documents
- **Joi**: Request validation and data sanitization
- **Winston**: Logging service for operations and errors

### Database
- **PostgreSQL**: Relational database for data integrity and complex queries
- **Custom SQL Functions & Triggers**:
  - Automatic referral code generation
  - Referral relationship management
  - Investment status tracking
  - Commission calculations
- **Row-Level Security (RLS)**: Ensures data privacy and access control
- **Database Tables**:
  - `users`: User accounts and profile information
  - `investments`: User investment records
  - `referrals`: Tracks referral relationships
  - `transactions`: All financial transactions
  - `commission_structure`: Configurable commission rates
  - `kyc_documents`: Identity verification documents
  - `bank_details`: User payment information
  - `admin_logs`: System administration activity

## 📁 Project Structure

```
investgrow/
├── client/                 # Frontend
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── assets/         # Images, fonts, etc.
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom React hooks
│   │   ├── layouts/        # Page layouts
│   │   ├── pages/          # Application pages
│   │   ├── services/       # API services
│   │   ├── store/          # Redux store
│   │   ├── utils/          # Helper functions
│   │   ├── App.jsx         # Root component
│   │   └── main.jsx        # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/                 # Backend
│   ├── config/             # Configuration files
│   ├── controllers/        # Request handlers
│   ├── middlewares/        # Express middlewares
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── utils/              # Helper utilities
│   ├── validators/         # Input validation
│   ├── app.js              # Express app setup
│   ├── server.js           # Server entry point
│   └── package.json
│
├── database/               # Database scripts
│   ├── schema/             # Table definitions
│   ├── functions/          # PostgreSQL functions
│   ├── triggers/           # Database triggers
│   ├── seeds/              # Initial data
│   └── migrations/         # Version control for DB
│
├── docs/                   # Documentation
│   ├── api/                # API documentation
│   └── guides/             # User guides
│
├── scripts/                # Utility scripts
├── .env.example            # Environment variables template
├── .gitignore
├── docker-compose.yml      # Docker configuration
├── package.json            # Root package.json
└── README.md               # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or later)
- PostgreSQL (v14 or later)
- Git

### Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/deeptimaan-k/investgrow.git
cd investgrow
```

#### 2. Backend Setup
```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

Edit the `.env` file with your configuration:
```
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRY=24h

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=investgrow

# Optional services
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

#### 3. Database Setup
```bash
# Create PostgreSQL database
createdb investgrow

# Run database migrations
cd database
psql -U your_db_user -d investgrow -f schema/init.sql
psql -U your_db_user -d investgrow -f functions/referral_functions.sql
psql -U your_db_user -d investgrow -f triggers/investment_triggers.sql
```

#### 4. Start the Backend Server
```bash
cd ../server
npm run dev
```

#### 5. Frontend Setup
```bash
# Navigate to client directory
cd ../client

# Install dependencies
npm install

# Start development server
npm run dev
```

### Running with Docker (Alternative)
```bash
# Build and start containers
docker-compose up -d

# Stop containers
docker-compose down
```

## 📊 API Documentation

API documentation is available at `/api/docs` when the server is running. The documentation includes:

- Authentication endpoints
- User management
- Investment operations
- Referral system
- Transaction history
- Admin functions

## 📝 Development Guidelines

### Coding Standards
- Use ESLint for code quality
- Follow Airbnb JavaScript Style Guide
- Write unit tests for critical functions
- Document API endpoints using JSDoc

### Git Workflow
- `main`: Production-ready code
- `develop`: Integration branch
- Feature branches: `feature/feature-name`
- Bug fixes: `fix/bug-description`
- Create pull requests for code reviews

## 🔄 Future Enhancements

- **Mobile Application**: React Native app for iOS and Android
- **Payment Gateway Integration**: Razorpay/UPI for seamless transactions
- **Advanced Analytics**: Deeper insights into investment performance
- **Email Notifications**: Automated alerts for ROI payouts and referral updates
- **Exportable Reports**: PDF/CSV exports for tax and accounting purposes
- **Two-Factor Authentication**: Enhanced security for user accounts
- **Blockchain Integration**: Optional cryptocurrency investments

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Deeptimaan K.**
- GitHub: [@deeptimaan-k](https://github.com/deeptimaan-k)
- LinkedIn: [Deeptimaan K](https://linkedin.com/in/deeptimaan-k)

## 📧 Contact

For questions or support, please email: support@investgrow.com

---

<div align="center">
  
© 2025 InvestGrow. All Rights Reserved.

</div>

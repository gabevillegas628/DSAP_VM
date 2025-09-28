
# DNA Analysis Program (DSAP)

A comprehensive web-based platform for managing DNA analysis workflows, student assignments, and clone tracking in educational and research environments. Built for the Waksman Student Scholars Program and similar bioinformatics education initiatives.

## Overview

The DNA Sequence Analysis Platform (DSAP) provides a complete educational ecosystem for DNA analysis, featuring advanced student assignment management, clone status tracking, review workflows, BLAST integration, messaging systems, and comprehensive progress monitoring. The system supports multiple user roles and facilitates both individual and collaborative learning experiences.

## Features

### Core Functionality
- **Advanced Clone Management**: Track DNA clones through comprehensive analysis stages with detailed status monitoring
- **Student Assignment System**: Automated assignment distribution with progress tracking and deadline management
- **Integrated Review Workflow**: Multi-stage review system with detailed feedback and correction cycles
- **BLAST Integration**: Built-in NCBI BLAST functionality with result caching and comparison tools
- **Real-time Messaging**: Instructor-student communication system with discussion threads
- **Practice Clone System**: Self-paced learning with practice sequences and immediate feedback

### User Roles & Permissions
- **Students**: Access assigned clones, practice sequences, submit analyses, participate in discussions, view detailed feedback
- **Instructors/Staff**: Review student work, provide structured feedback, manage assignments, moderate discussions
- **Directors**: Full system administration, program configuration, user management, data analytics, bulk operations

### Advanced Features
- **Question Management System**: Customizable analysis questions with conditional logic and grouping
- **Demographics Collection**: Optional student demographic data gathering with privacy controls
- **Common Feedback Templates**: Reusable feedback system for efficient grading
- **Email Notification System**: Automated alerts for workflow updates and deadlines
- **Data Export/Import**: Comprehensive backup and migration tools with relationship preservation
- **Profile Management**: User profiles with profile pictures and contact information
- **Progress Analytics**: Detailed progress tracking and completion statistics
- **Help Documentation**: Integrated help system with topic-based assistance

### Technical Features
- **File Upload Management**: Support for various DNA analysis file formats (.ab1, .seq, etc.)
- **Secure Authentication**: JWT-based authentication with password reset functionality
- **Mobile Responsive Design**: Full mobile compatibility with optimized interfaces
- **Real-time Updates**: Live status updates and notifications
- **Bulk Operations**: Mass assignment, import/export, and data management tools

## Technology Stack

### Backend
- **Node.js** (v16+) with Express.js framework
- **Prisma** ORM for database management and migrations
- **PostgreSQL** for data persistence
- **JWT** authentication with bcrypt password hashing
- **SendGrid** for email functionality (replacing Nodemailer)
- **Multer** for file upload handling
- **CORS** for cross-origin resource sharing

### Frontend
- **React** (v18) with modern hooks and functional components
- **Tailwind CSS** for responsive styling and design system
- **Lucide React** for consistent iconography
- **Context API** for global state management
- **React Router** for navigation
- **Axios** for API communication

### Development Tools
- **ngrok** for development tunneling and external access
- **Nodemon** for hot reloading during development
- **Custom startup scripts** for automated development environment setup
- **Prisma Studio** for database management
- **ESLint** and **Prettier** for code formatting

### External Services
- **NCBI BLAST API** for sequence analysis
- **SendGrid** for transactional email delivery
- **PostgreSQL** (Railway/Heroku compatible)

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager
- PostgreSQL database
- SendGrid account (for email functionality)
- ngrok account (for development)

### Environment Variables
Create a `.env` file in the `server` directory:

```env
DATABASE_URL="postgresql://username:password@host:port/database"
JWT_SECRET="your-secure-jwt-secret-key"
SENDGRID_API_KEY="your-sendgrid-api-key"
EMAIL_USER="noreply@yourdomain.com"
FRONTEND_URL="http://localhost:3000"
PORT=5000
NODE_ENV="development"
```

### Setup

1. **Clone and Install**
   ```bash
   git clone [your-repo-url]
   cd dna-analysis-program
   
   # Backend dependencies
   cd server
   npm install
   
   # Frontend dependencies
   cd ../client
   npm install
   ```

2. **Database Setup**
   ```bash
   cd server
   npx prisma generate
   npx prisma db push
   # Optional: seed with sample data
   npx prisma db seed
   ```

3. **Development Start**
   ```bash
   # Automated startup (recommended)
   node startup2.js
   
   # Or manual startup
   cd server && npm run dev
   cd client && npm start
   ```

## Development

### Quick Start with Automated Script
The project includes a comprehensive startup script that handles ngrok tunneling, configuration updates, and server startup:

```bash
node startup2.js [options]
```

**Available Options:**
- `--help` - Show detailed help information
- `--check` - Run prerequisite validation
- `--tunnels-only` - Start only ngrok tunnels
- `--kill-ports` - Terminate processes on ports 3000/5000

### Project Structure
```
dna-analysis-program/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # React components (organized by feature)
│   │   ├── context/        # Context providers for state management
│   │   ├── services/       # API services and utilities
│   │   ├── utils/          # Helper functions and constants
│   │   └── config.js       # Frontend configuration
│   └── package.json
├── server/                 # Node.js backend API
│   ├── index.js            # Main server file with all routes
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema definition
│   │   └── migrations/     # Database migration files
│   ├── uploads/            # File upload storage
│   └── package.json
├── startup2.js             # Development automation script
└── README.md
```

## Configuration

### Program Settings (Director Panel)
- **Project Information**: Headers, principal investigator, contact details
- **Scientific Configuration**: Organism details, cloning vectors, restriction enzymes
- **Email Templates**: Customizable notification messages
- **Demographics**: Optional student data collection settings
- **Analysis Questions**: Custom question sets with conditional logic
- **Help Topics**: Integrated help documentation management

### Clone Status Workflow
The system tracks clones through a comprehensive status pipeline:
- **Unassigned** → **Being worked on by student** → **Completed, waiting review**
- **Needs reanalysis** ↔ **Needs corrections** ↔ **Corrected, waiting review**
- **Reviewed and correct** → **Reviewed by teacher** → **To be submitted to NCBI** → **Submitted to NCBI**
- **Unreadable** (terminal status for unusable sequences)

## API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - New user registration
- `POST /api/auth/forgot-password` - Password reset initiation
- `POST /api/auth/reset-password` - Password reset completion

### Core Data Endpoints
- `GET/POST/PUT /api/clones/*` - Clone management operations
- `GET/POST/PUT /api/users/*` - User account management
- `GET/POST /api/program-settings` - System configuration
- `GET/POST/DELETE /api/analysis-questions` - Question management

### Advanced Features
- `GET/POST /api/messages/*` - Messaging system
- `GET/POST /api/discussions/*` - Discussion management
- `GET /api/blast/*` - BLAST integration endpoints
- `GET/POST /api/practice-clones/*` - Practice sequence management

## Usage Guide

### For Students
1. **Getting Started**: Register and await approval from instructors
2. **Clone Assignment**: Access assigned clones from dashboard
3. **Analysis Workflow**: Complete step-by-step analysis questions
4. **BLAST Integration**: Use built-in BLAST tools for sequence comparison
5. **Progress Tracking**: Monitor completion status and view feedback
6. **Communication**: Use messaging system for instructor support
7. **Practice Mode**: Use practice clones for skill development

### For Instructors/Staff
1. **Student Management**: Approve registrations and manage student accounts
2. **Assignment Distribution**: Assign clones and monitor progress
3. **Review Process**: Evaluate student submissions with structured feedback
4. **Communication**: Respond to student questions and provide guidance
5. **Progress Monitoring**: Track class-wide completion and performance metrics

### For Directors
1. **System Configuration**: Set up program parameters and institutional settings
2. **User Administration**: Manage all user accounts and permissions
3. **Content Management**: Configure analysis questions and help documentation
4. **Data Management**: Export/import data for backup and analysis
5. **Analytics**: Monitor system usage and educational outcomes

## Deployment

### Production Considerations
- Configure production database with connection pooling
- Set up SSL certificates for HTTPS
- Configure SendGrid for reliable email delivery
- Implement proper logging and monitoring
- Set up automated backups
- Configure environment-specific variables

### Supported Platforms
- **Railway** (recommended for PostgreSQL and deployment)
- **Heroku** with PostgreSQL add-on
- **Docker** containers for containerized deployment
- **Traditional VPS** with manual configuration

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Follow coding standards (ESLint/Prettier)
4. Write tests for new functionality
5. Update documentation as needed
6. Submit a pull request with detailed description

## Support & Documentation

- **Built-in Help System**: Access help documentation within the application
- **System Administrator**: Contact your program director for account issues
- **Technical Issues**: Check startup script troubleshooting (`node startup2.js --help`)
- **Feature Requests**: Submit through your institutional administrator

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author & Acknowledgments

**Author**: Gabriel Villegas
**Development**: Built with assistance from Claude (Anthropic)

Special thanks to the Waksman Student Scholars Program for inspiration and educational framework.

## Version History

- **v0.9β** - Current beta release with full feature set
- **v2.0** - Enhanced relationship management and smart importing
- **v1.x** - Initial stable releases with core functionality

---

*The DNA Sequence Analysis Platform is designed to enhance bioinformatics education through comprehensive workflow management, real-time collaboration, and integrated analysis tools. Built with modern web technologies to provide a seamless learning experience for students and efficient management tools for educators.*
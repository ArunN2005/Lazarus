# Lazarus - Requirements Document

## 1. Executive Summary

Lazarus is an AI-powered platform that resurrects dead or legacy codebases into modern, runnable applications. This document outlines the functional and non-functional requirements for the system designed for the Bharat AWS Hackathon (AI for Learning & Developer Productivity track).

## 2. Functional Requirements

### 2.1 Core Pipeline Requirements

#### FR-1: Repository Ingestion
- **FR-1.1**: System SHALL accept GitHub repository URLs as input
- **FR-1.2**: System SHALL support public and private repositories (with authentication)
- **FR-1.3**: System SHALL clone repositories up to 500MB in size
- **FR-1.4**: System SHALL validate repository accessibility before processing
- **FR-1.5**: System SHALL support repositories in JavaScript/TypeScript, Python, and Java

#### FR-2: Technology Stack Detection (Phase 1 - Scan)
- **FR-2.1**: System SHALL detect framework type (React, Vue, Angular, Express, Django, Flask, Spring Boot)
- **FR-2.2**: System SHALL identify framework version from package.json, requirements.txt, or pom.xml
- **FR-2.3**: System SHALL detect runtime version (Node.js, Python, Java)
- **FR-2.4**: System SHALL identify build tools (webpack, vite, maven, gradle)
- **FR-2.5**: System SHALL catalog all dependencies with versions

#### FR-3: Codebase Analysis (Phase 2)
- **FR-3.1**: System SHALL parse Abstract Syntax Trees (AST) for all source files
- **FR-3.2**: System SHALL map dependency relationships between modules
- **FR-3.3**: System SHALL extract API routes and endpoints
- **FR-3.4**: System SHALL identify database models and schemas
- **FR-3.5**: System SHALL detect deprecated API usage patterns
- **FR-3.6**: System SHALL analyze component architecture
- **FR-3.7**: System SHALL process analysis tasks in parallel using 4 Lambda functions

#### FR-4: Environment Detection (Phase 2.5)
- **FR-4.1**: System SHALL identify all environment variables from .env files, config files, and code
- **FR-4.2**: System SHALL classify variables as: SECRET, CONFIG, or OPTIONAL
- **FR-4.3**: System SHALL generate secure placeholder values for secrets
- **FR-4.4**: System SHALL provide sensible defaults for optional configuration
- **FR-4.5**: System SHALL cache environment detection results in ElastiCache

#### FR-5: Migration Planning (Phase 3)
- **FR-5.1**: System SHALL generate file-by-file migration strategy
- **FR-5.2**: System SHALL provide reasoning for each proposed change
- **FR-5.3**: System SHALL identify breaking changes and required refactors
- **FR-5.4**: System SHALL estimate migration complexity score (1-10)
- **FR-5.5**: System SHALL store migration plan in DynamoDB
- **FR-5.6**: System SHALL use Claude Sonnet for planning decisions

#### FR-6: Code Generation (Phase 4)
- **FR-6.1**: System SHALL generate modernized code for all source files
- **FR-6.2**: System SHALL preserve business logic while updating syntax
- **FR-6.3**: System SHALL update deprecated APIs to modern equivalents
- **FR-6.4**: System SHALL generate modern dependency configurations
- **FR-6.5**: System SHALL process files in parallel batches of 10
- **FR-6.6**: System SHALL use prompt caching to reduce costs by 90%
- **FR-6.7**: System SHALL maintain code style consistency
- **FR-6.8**: System SHALL preserve comments and documentation

#### FR-7: Build and Deployment (Phase 5)
- **FR-7.1**: System SHALL generate appropriate Dockerfile for the application
- **FR-7.2**: System SHALL build Docker image using CodeBuild
- **FR-7.3**: System SHALL push image to Amazon ECR
- **FR-7.4**: System SHALL deploy to AWS App Runner with auto-scaling
- **FR-7.5**: System SHALL configure environment variables in Secrets Manager
- **FR-7.6**: System SHALL generate unique subdomain for each resurrected app
- **FR-7.7**: System SHALL provide live URL within 5 minutes of completion

#### FR-8: Validation (Phase 6)
- **FR-8.1**: System SHALL perform HTTP health checks on deployed application
- **FR-8.2**: System SHALL scan CloudWatch logs for errors
- **FR-8.3**: System SHALL trace requests using X-Ray
- **FR-8.4**: System SHALL verify all API endpoints respond correctly
- **FR-8.5**: System SHALL mark resurrection as SUCCESS or FAILED

#### FR-9: Self-Healing (Phase 7)
- **FR-9.1**: System SHALL automatically detect deployment failures
- **FR-9.2**: System SHALL read error logs and stack traces
- **FR-9.3**: System SHALL use Claude Sonnet to diagnose issues
- **FR-9.4**: System SHALL generate code patches to fix errors
- **FR-9.5**: System SHALL retry deployment up to 5 times
- **FR-9.6**: System SHALL send SNS notification after final failure
- **FR-9.7**: System SHALL learn from successful fixes for future resurrections

### 2.2 Learning Features Requirements

#### FR-10: Diff View
- **FR-10.1**: System SHALL generate side-by-side diff for every modified file
- **FR-10.2**: System SHALL highlight syntax changes with color coding
- **FR-10.3**: System SHALL provide AI-generated explanations for each change
- **FR-10.4**: System SHALL show before/after pattern mappings (e.g., class → hooks)
- **FR-10.5**: System SHALL allow filtering diffs by file type or change category
- **FR-10.6**: System SHALL support exporting diffs as PDF or markdown

#### FR-11: AI Code Editor
- **FR-11.1**: System SHALL provide Monaco Editor (VS Code) in browser
- **FR-11.2**: System SHALL support syntax highlighting for all detected languages
- **FR-11.3**: System SHALL allow users to select code and ask questions
- **FR-11.4**: System SHALL provide contextual AI explanations using Claude
- **FR-11.5**: System SHALL show file tree navigation
- **FR-11.6**: System SHALL support search across all files
- **FR-11.7**: System SHALL allow inline code editing and re-deployment

#### FR-12: Visual AI Design Mode
- **FR-12.1**: System SHALL display live preview of resurrected application in iframe
- **FR-12.2**: System SHALL allow click-to-select any visual element
- **FR-12.3**: System SHALL accept natural language design change requests
- **FR-12.4**: System SHALL use Titan Image Generator for image creation/editing
- **FR-12.5**: System SHALL use Claude for CSS and component code changes
- **FR-12.6**: System SHALL show real-time preview of changes
- **FR-12.7**: System SHALL display corresponding code changes alongside visual changes
- **FR-12.8**: System SHALL support undo/redo for design changes
- **FR-12.9**: System SHALL allow saving design changes back to codebase

### 2.3 Repository Management Requirements

#### FR-13: Pull Request Generation
- **FR-13.1**: System SHALL detect if user owns the input repository
- **FR-13.2**: System SHALL generate pull request with all modernized code
- **FR-13.3**: System SHALL include detailed PR description with change summary
- **FR-13.4**: System SHALL use GitHub MCP server for PR creation
- **FR-13.5**: System SHALL handle authentication via GitHub OAuth
- **FR-13.6**: System SHALL support branch selection for PR target

#### FR-14: Project Management
- **FR-14.1**: System SHALL maintain history of all user resurrections
- **FR-14.2**: System SHALL allow users to re-run resurrection with different settings
- **FR-14.3**: System SHALL support project deletion
- **FR-14.4**: System SHALL allow downloading modernized code as ZIP
- **FR-14.5**: System SHALL track resurrection status in real-time
- **FR-14.6**: System SHALL provide cost breakdown per resurrection

### 2.4 MCP Server Hub Requirements

#### FR-15: MCP Integration
- **FR-15.1**: System SHALL run MCP servers on ECS Fargate
- **FR-15.2**: System SHALL integrate GitHub MCP for repository operations
- **FR-15.3**: System SHALL integrate NPM/PyPI MCP for package registry lookups
- **FR-15.4**: System SHALL integrate Web Search MCP for migration guide discovery
- **FR-15.5**: System SHALL integrate Docker MCP for container operations
- **FR-15.6**: System SHALL integrate CloudWatch MCP for log analysis
- **FR-15.7**: System SHALL route MCP requests through API Gateway

### 2.5 User Management Requirements

#### FR-16: Authentication and Authorization
- **FR-16.1**: System SHALL support email/password authentication via Cognito
- **FR-16.2**: System SHALL support GitHub OAuth login
- **FR-16.3**: System SHALL support Google OAuth login
- **FR-16.4**: System SHALL enforce user quotas (5 free resurrections, then paid)
- **FR-16.5**: System SHALL maintain user profiles with preferences

#### FR-17: Dashboard
- **FR-17.1**: System SHALL display all user projects with status
- **FR-17.2**: System SHALL show resurrection progress with percentage
- **FR-17.3**: System SHALL provide quick access to live URLs
- **FR-17.4**: System SHALL display cost and time metrics per project
- **FR-17.5**: System SHALL show recent activity feed


## 3. Non-Functional Requirements

### 3.1 Performance Requirements

#### NFR-1: Response Time
- **NFR-1.1**: Repository scanning SHALL complete within 30 seconds
- **NFR-1.2**: Analysis phase SHALL complete within 2 minutes
- **NFR-1.3**: Complete resurrection SHALL finish within 10 minutes for typical projects
- **NFR-1.4**: API response time SHALL be under 200ms for 95th percentile
- **NFR-1.5**: Diff view SHALL load within 2 seconds

#### NFR-2: Throughput
- **NFR-2.1**: System SHALL support 100 concurrent resurrections
- **NFR-2.2**: System SHALL handle 1000 API requests per second
- **NFR-2.3**: System SHALL process 50 parallel code generation batches

#### NFR-3: Scalability
- **NFR-3.1**: System SHALL auto-scale Lambda functions based on demand
- **NFR-3.2**: System SHALL scale App Runner instances from 1 to 25
- **NFR-3.3**: System SHALL handle 10,000 registered users
- **NFR-3.4**: System SHALL support 1TB of stored repositories

### 3.2 Reliability Requirements

#### NFR-4: Availability
- **NFR-4.1**: System SHALL maintain 99.5% uptime
- **NFR-4.2**: Resurrected applications SHALL maintain 99% uptime
- **NFR-4.3**: System SHALL implement health checks every 30 seconds

#### NFR-5: Fault Tolerance
- **NFR-5.1**: System SHALL retry failed Lambda invocations up to 3 times
- **NFR-5.2**: System SHALL gracefully handle Bedrock API throttling
- **NFR-5.3**: System SHALL recover from partial pipeline failures
- **NFR-5.4**: System SHALL maintain state consistency in DynamoDB

#### NFR-6: Data Durability
- **NFR-6.1**: S3 data SHALL have 99.999999999% durability
- **NFR-6.2**: DynamoDB SHALL use point-in-time recovery
- **NFR-6.3**: System SHALL backup critical data daily

### 3.3 Security Requirements

#### NFR-7: Authentication and Authorization
- **NFR-7.1**: System SHALL enforce MFA for admin accounts
- **NFR-7.2**: System SHALL use JWT tokens with 1-hour expiration
- **NFR-7.3**: System SHALL implement role-based access control (RBAC)
- **NFR-7.4**: System SHALL encrypt tokens in transit and at rest

#### NFR-8: Data Protection
- **NFR-8.1**: System SHALL encrypt all S3 data using AES-256
- **NFR-8.2**: System SHALL encrypt DynamoDB tables at rest
- **NFR-8.3**: System SHALL store secrets in AWS Secrets Manager
- **NFR-8.4**: System SHALL rotate secrets every 90 days
- **NFR-8.5**: System SHALL sanitize user input to prevent injection attacks

#### NFR-9: Network Security
- **NFR-9.1**: System SHALL use HTTPS for all communications
- **NFR-9.2**: System SHALL implement WAF rules to block common attacks
- **NFR-9.3**: System SHALL use VPC for internal service communication
- **NFR-9.4**: System SHALL implement rate limiting (100 requests/minute per user)
- **NFR-9.5**: System SHALL log all security events to CloudWatch

#### NFR-10: Compliance
- **NFR-10.1**: System SHALL comply with GDPR for user data
- **NFR-10.2**: System SHALL allow users to delete all their data
- **NFR-10.3**: System SHALL maintain audit logs for 1 year

### 3.4 Cost Requirements

#### NFR-11: Cost Efficiency
- **NFR-11.1**: Average resurrection cost SHALL be under $2.50
- **NFR-11.2**: System SHALL use prompt caching to reduce Bedrock costs by 90%
- **NFR-11.3**: System SHALL use spot instances where possible
- **NFR-11.4**: System SHALL implement S3 lifecycle policies to archive old data
- **NFR-11.5**: System SHALL monitor and alert on cost anomalies

### 3.5 Usability Requirements

#### NFR-12: User Experience
- **NFR-12.1**: System SHALL provide intuitive UI requiring no training
- **NFR-12.2**: System SHALL display clear error messages with remediation steps
- **NFR-12.3**: System SHALL provide real-time progress updates
- **NFR-12.4**: System SHALL support mobile responsive design
- **NFR-12.5**: System SHALL meet WCAG 2.1 Level AA accessibility standards

#### NFR-13: Documentation
- **NFR-13.1**: System SHALL provide comprehensive user documentation
- **NFR-13.2**: System SHALL include video tutorials for key features
- **NFR-13.3**: System SHALL provide API documentation with examples
- **NFR-13.4**: System SHALL include troubleshooting guides

### 3.6 Maintainability Requirements

#### NFR-14: Code Quality
- **NFR-14.1**: System SHALL maintain 80% code coverage
- **NFR-14.2**: System SHALL follow AWS Well-Architected Framework
- **NFR-14.3**: System SHALL use Infrastructure as Code (CloudFormation/CDK)
- **NFR-14.4**: System SHALL implement comprehensive logging

#### NFR-15: Monitoring and Observability
- **NFR-15.1**: System SHALL track all key metrics in CloudWatch
- **NFR-15.2**: System SHALL implement distributed tracing with X-Ray
- **NFR-15.3**: System SHALL alert on anomalies within 5 minutes
- **NFR-15.4**: System SHALL provide dashboards for system health

## 4. User Stories

### 4.1 CS Student Persona

**User Story 1**: As a CS student, I want to resurrect a 3-year-old React tutorial project so I can learn modern React patterns without getting stuck on installation errors.

**Acceptance Criteria**:
- Student can paste GitHub URL and get working app in under 10 minutes
- Diff view shows class components converted to hooks with explanations
- Student can ask questions about any code change in the AI editor

**User Story 2**: As a CS student, I want to see side-by-side comparisons of old vs new code so I understand why patterns changed.

**Acceptance Criteria**:
- Every modified file shows before/after diff
- AI explanations describe the reasoning for each change
- Changes are categorized (syntax, API, architecture)

### 4.2 Junior Developer Persona

**User Story 3**: As a junior developer, I want to experiment with Visual AI Design mode so I can learn how design changes map to code.

**Acceptance Criteria**:
- Can click any element in live preview
- Can describe changes in plain English
- See both visual result and code changes simultaneously
- Changes are reversible with undo

**User Story 4**: As a junior developer, I want to ask questions about unfamiliar code patterns so I can understand the codebase faster.

**Acceptance Criteria**:
- Can select any code snippet in Monaco Editor
- Can ask "What does this do?" or "Why was this changed?"
- Get contextual AI explanations within 3 seconds

### 4.3 Senior Developer Persona

**User Story 5**: As a senior developer, I want to modernize my 2-year-old portfolio project so it doesn't look outdated to recruiters.

**Acceptance Criteria**:
- Can resurrect project in under 10 minutes
- Can create PR back to original repo with one click
- Get detailed migration report showing all changes
- Cost is under $2.50

**User Story 6**: As a senior developer, I want the system to self-heal deployment failures so I don't have to debug infrastructure issues.

**Acceptance Criteria**:
- System automatically detects failures
- AI diagnoses and patches code errors
- Retries deployment up to 5 times
- Notifies me only if all retries fail

### 4.4 Freelancer Persona

**User Story 7**: As a freelancer, I want to update old client projects without spending days rewriting code so I can maintain relationships cost-effectively.

**Acceptance Criteria**:
- Can resurrect client project with minimal manual intervention
- Get cost estimate before starting
- Download modernized code as ZIP
- Generate professional change report for client

### 4.5 Educator Persona

**User Story 8**: As an educator, I want to convert outdated teaching examples to modern frameworks so my students learn current best practices.

**Acceptance Criteria**:
- Can batch process multiple example projects
- Get consistent modern patterns across all examples
- Export diffs as teaching materials
- Students can access live deployed versions

### 4.6 Open Source Maintainer Persona

**User Story 9**: As an open source maintainer, I want to revive abandoned but valuable projects so the community can benefit from them again.

**Acceptance Criteria**:
- Can resurrect projects with complex dependencies
- Get detailed migration plan before execution
- Can review and modify generated code
- Can contribute back via PR

## 5. Acceptance Criteria for Key Features

### 5.1 End-to-End Resurrection

**Given** a user provides a GitHub URL to a 2-year-old React project  
**When** the resurrection pipeline completes  
**Then**:
- All 7 phases complete successfully
- Live URL is accessible and functional
- All deprecated APIs are updated
- Dependencies are modernized
- Application passes health checks
- Total time is under 10 minutes
- Cost is under $2.50

### 5.2 Diff View Learning

**Given** a resurrection has completed  
**When** user opens the diff view  
**Then**:
- Every modified file shows side-by-side comparison
- Syntax highlighting is correct for both versions
- AI explanations appear for each significant change
- User can filter by change type (API, syntax, architecture)
- User can export diffs as markdown or PDF

### 5.3 Visual AI Design Mode

**Given** a resurrected app is running  
**When** user clicks an element and requests "Make this button blue with rounded corners"  
**Then**:
- Element is highlighted in preview
- AI generates appropriate CSS changes
- Preview updates in real-time
- Code editor shows the modified CSS
- User can undo the change
- User can save changes back to codebase

### 5.4 Self-Healing

**Given** a deployment fails with a runtime error  
**When** the validation phase detects the failure  
**Then**:
- Self-healing phase activates automatically
- AI reads CloudWatch logs and identifies error
- AI generates code patch
- System redeploys with patched code
- Process repeats up to 5 times if needed
- User receives notification only if all retries fail

### 5.5 Pull Request Generation

**Given** user owns the input repository  
**When** user clicks "Create PR"  
**Then**:
- System authenticates via GitHub OAuth
- PR is created with all modernized code
- PR description includes detailed change summary
- PR includes link to live deployed version
- PR includes cost and time metrics

## 6. Constraints

### 6.1 Technical Constraints
- **C-1**: System must use only AWS services (hackathon requirement)
- **C-2**: Must use Amazon Bedrock for all AI operations
- **C-3**: Repository size limited to 500MB due to Lambda constraints
- **C-4**: Maximum resurrection time of 15 minutes (Step Functions timeout)
- **C-5**: Bedrock API rate limits: 400 requests/minute for Claude Sonnet

### 6.2 Business Constraints
- **C-6**: Free tier limited to 5 resurrections per user
- **C-7**: Must maintain cost under $2.50 per resurrection
- **C-8**: Must comply with GitHub API rate limits
- **C-9**: Must respect repository licenses and attribution

### 6.3 Scope Constraints
- **C-10**: Initial release supports JavaScript/TypeScript, Python, Java only
- **C-11**: Visual AI Design mode limited to web applications
- **C-12**: Self-healing limited to 5 retry attempts
- **C-13**: MCP servers limited to 5 concurrent connections per user

## 7. Assumptions

### 7.1 Technical Assumptions
- **A-1**: Input repositories follow standard project structures
- **A-2**: Repositories contain valid package manager files (package.json, requirements.txt, pom.xml)
- **A-3**: AWS services maintain advertised SLAs
- **A-4**: Bedrock models maintain current capabilities
- **A-5**: GitHub API remains stable and accessible

### 7.2 User Assumptions
- **A-6**: Users have basic understanding of Git and GitHub
- **A-7**: Users can provide necessary authentication for private repos
- **A-8**: Users understand that AI-generated code may require review
- **A-9**: Users have modern web browsers (Chrome, Firefox, Safari, Edge)

### 7.3 Business Assumptions
- **A-10**: Demand exists for automated code modernization
- **A-11**: Developers value learning from real codebases
- **A-12**: Cost savings justify subscription pricing after free tier
- **A-13**: Educational institutions will adopt for teaching

## 8. Dependencies

### 8.1 External Dependencies
- **D-1**: GitHub API availability and rate limits
- **D-2**: Amazon Bedrock model availability
- **D-3**: NPM/PyPI/Maven registry availability
- **D-4**: Docker Hub for base images

### 8.2 Internal Dependencies
- **D-5**: Phase 2 depends on Phase 1 completion
- **D-6**: Phase 3 depends on Phase 2 completion
- **D-7**: Phase 4 depends on Phase 3 approval
- **D-8**: Phase 6 depends on Phase 5 deployment
- **D-9**: Visual AI Design mode depends on successful deployment

## 9. Success Metrics

### 9.1 Technical Metrics
- **M-1**: 90% resurrection success rate
- **M-2**: Average resurrection time under 8 minutes
- **M-3**: 95% of resurrected apps pass health checks
- **M-4**: Self-healing success rate above 70%
- **M-5**: API response time p95 under 200ms

### 9.2 User Engagement Metrics
- **M-6**: 80% of users complete their first resurrection
- **M-7**: Average 3 resurrections per active user per month
- **M-8**: 60% of users interact with diff view
- **M-9**: 40% of users try Visual AI Design mode
- **M-10**: 25% of users create PRs back to their repos

### 9.3 Learning Metrics
- **M-11**: Users spend average 15 minutes exploring diffs
- **M-12**: Average 10 AI code questions per resurrection
- **M-13**: 70% of users report learning new patterns
- **M-14**: 50% of users resurrect multiple projects for learning

### 9.4 Business Metrics
- **M-15**: Average cost per resurrection under $2.00
- **M-16**: 20% conversion from free to paid tier
- **M-17**: 90% user satisfaction score
- **M-18**: 50% month-over-month user growth

---

**Document Version**: 1.0  
**Last Updated**: February 15, 2026  
**Status**: Draft for Hackathon Submission

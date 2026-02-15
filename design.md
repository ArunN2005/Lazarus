# Lazarus - Design Document

## 1. Executive Summary

This document describes the technical design of Lazarus, an AI-powered platform that resurrects dead or legacy codebases into modern, runnable applications. The system leverages AWS serverless architecture and Amazon Bedrock AI models to automate the entire modernization pipeline while providing rich learning experiences through interactive diff views, AI code explanations, and visual design tools.

## 2. System Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
│              (Next.js on AWS Amplify + CloudFront)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │Dashboard │  │Diff View │  │AI Editor │  │Visual AI │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTPS/WSS
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    API Gateway Layer                             │
│         ┌──────────────────┐    ┌──────────────────┐           │
│         │   REST API       │    │   WebSocket API  │           │
│         │  (Synchronous)   │    │   (Real-time)    │           │
│         └──────────────────┘    └──────────────────┘           │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼────────┐ ┌───▼────────┐ ┌───▼──────────┐
│  Authentication │ │   Pipeline  │ │  MCP Server  │
│    (Cognito)    │ │Orchestration│ │     Hub      │
│                 │ │(Step Funcs) │ │(ECS Fargate) │
└─────────────────┘ └───┬────────┘ └──────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
│   Phase 1-3  │ │  Phase 4-5  │ │ Phase 6-7  │
│ Scan/Analyze │ │Generate/    │ │Validate/   │
│    /Plan     │ │  Deploy     │ │Self-Heal   │
│  (Lambda)    │ │(Lambda+     │ │ (Lambda)   │
│              │ │CodeBuild)   │ │            │
└───────┬──────┘ └──────┬──────┘ └─────┬──────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
┌───────────────────────▼───────────────────────┐
│              Data & Storage Layer              │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │  S3  │  │ DDB  │  │ ECR  │  │Cache │     │
│  └──────┘  └──────┘  └──────┘  └──────┘     │
└────────────────────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────┐
│              AI/ML Layer                       │
│         Amazon Bedrock                         │
│  ┌──────────────┐  ┌──────────────┐          │
│  │Claude Sonnet │  │Claude Haiku  │          │
│  │(Planning,    │  │(Lightweight  │          │
│  │ Generation,  │  │ Tasks)       │          │
│  │ Self-Heal)   │  └──────────────┘          │
│  └──────────────┘  ┌──────────────┐          │
│                    │Titan Image   │          │
│                    │Generator G1  │          │
│                    └──────────────┘          │
└────────────────────────────────────────────────┘
```

### 2.2 Architecture Principles

1. **Serverless-First**: Minimize operational overhead using Lambda, Step Functions, and managed services
2. **Event-Driven**: Asynchronous processing with SNS/SQS for decoupling
3. **Cost-Optimized**: Prompt caching, spot instances, and pay-per-use pricing
4. **Scalable**: Auto-scaling at every layer from API Gateway to App Runner
5. **Observable**: Comprehensive logging, metrics, and tracing with CloudWatch and X-Ray
6. **Secure**: Defense in depth with WAF, VPC, encryption, and least-privilege IAM

## 3. Component Design

### 3.1 Frontend Architecture (Next.js on Amplify)

#### 3.1.1 Component Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── dashboard/
│   │   ├── page.tsx              # Project list
│   │   └── [projectId]/
│   │       ├── page.tsx          # Project detail
│   │       ├── diff/             # Diff viewer
│   │       ├── editor/           # AI code editor
│   │       └── design/           # Visual AI design
│   └── api/
│       └── webhooks/             # GitHub webhooks
├── components/
│   ├── resurrection/
│   │   ├── ProgressTracker.tsx   # Real-time progress
│   │   ├── PhaseIndicator.tsx    # 7-phase visualization
│   │   └── StatusBadge.tsx
│   ├── diff/
│   │   ├── DiffViewer.tsx        # Side-by-side diff
│   │   ├── DiffExplanation.tsx   # AI explanations
│   │   └── DiffFilter.tsx
│   ├── editor/
│   │   ├── MonacoEditor.tsx      # Code editor wrapper
│   │   ├── AIAssistant.tsx       # Q&A interface
│   │   └── FileTree.tsx
│   └── design/
│       ├── LivePreview.tsx       # iframe preview
│       ├── ElementSelector.tsx   # Click-to-select
│       ├── DesignPrompt.tsx      # Natural language input
│       └── ChangePreview.tsx     # Before/after
├── lib/
│   ├── api/
│   │   ├── client.ts             # API client
│   │   ├── websocket.ts          # WebSocket manager
│   │   └── auth.ts               # Cognito integration
│   ├── hooks/
│   │   ├── useResurrection.ts
│   │   ├── useDiff.ts
│   │   └── useDesignMode.ts
│   └── utils/
│       ├── diff-parser.ts
│       └── syntax-highlighter.ts
└── types/
    ├── resurrection.ts
    ├── diff.ts
    └── api.ts
```

#### 3.1.2 State Management

Using React Context + SWR for server state:

```typescript
// Resurrection context for real-time updates
interface ResurrectionContext {
  projectId: string;
  status: ResurrectionStatus;
  currentPhase: Phase;
  progress: number;
  logs: LogEntry[];
  error?: Error;
}

// WebSocket connection for live updates
const useResurrectionUpdates = (projectId: string) => {
  const [state, setState] = useState<ResurrectionContext>();
  
  useEffect(() => {
    const ws = new WebSocket(`wss://api.lazarus.dev/ws`);
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setState(prev => ({ ...prev, ...update }));
    };
    return () => ws.close();
  }, [projectId]);
  
  return state;
};
```

### 3.2 API Gateway Design

#### 3.2.1 REST API Endpoints

```
POST   /api/v1/resurrections              # Start resurrection
GET    /api/v1/resurrections/:id          # Get status
GET    /api/v1/resurrections/:id/diff     # Get diff data
GET    /api/v1/resurrections/:id/files    # List files
GET    /api/v1/resurrections/:id/files/*  # Get file content
POST   /api/v1/resurrections/:id/pr       # Create PR
POST   /api/v1/resurrections/:id/design   # Apply design change
DELETE /api/v1/resurrections/:id          # Delete project

POST   /api/v1/ai/explain                 # Explain code
POST   /api/v1/ai/design                  # Generate design change

GET    /api/v1/users/me                   # Get user profile
GET    /api/v1/users/me/projects          # List user projects
PATCH  /api/v1/users/me                   # Update profile
```

#### 3.2.2 WebSocket API

```
# Client → Server
{
  "action": "subscribe",
  "projectId": "proj_123"
}

# Server → Client (Progress updates)
{
  "type": "progress",
  "projectId": "proj_123",
  "phase": "GENERATE",
  "progress": 45,
  "message": "Generating modern code for 23/50 files"
}

# Server → Client (Phase completion)
{
  "type": "phase_complete",
  "projectId": "proj_123",
  "phase": "SCAN",
  "result": { ... }
}

# Server → Client (Error)
{
  "type": "error",
  "projectId": "proj_123",
  "phase": "BUILD",
  "error": "Docker build failed",
  "retrying": true
}
```

#### 3.2.3 API Gateway Configuration

```yaml
# API Gateway with Lambda integration
Resources:
  RestApi:
    Type: AWS::ApiGateway::RestApi
    Properties:
      Name: LazarusAPI
      EndpointConfiguration:
        Types:
          - REGIONAL
      
  # Cognito authorizer
  Authorizer:
    Type: AWS::ApiGateway::Authorizer
    Properties:
      Type: COGNITO_USER_POOLS
      IdentitySource: method.request.header.Authorization
      ProviderARNs:
        - !GetAtt UserPool.Arn
  
  # Rate limiting
  UsagePlan:
    Type: AWS::ApiGateway::UsagePlan
    Properties:
      Throttle:
        RateLimit: 100
        BurstLimit: 200
      Quota:
        Limit: 10000
        Period: DAY
```

### 3.3 Pipeline Orchestration (Step Functions)

#### 3.3.1 State Machine Definition

```json
{
  "Comment": "Lazarus Resurrection Pipeline",
  "StartAt": "Phase1_Scan",
  "States": {
    "Phase1_Scan": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:xxx:function:ScanFunction",
      "TimeoutSeconds": 60,
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "IntervalSeconds": 2,
          "MaxAttempts": 3,
          "BackoffRate": 2.0
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "ResultPath": "$.error",
          "Next": "NotifyFailure"
        }
      ],
      "Next": "Phase2_Analyze"
    },
    
    "Phase2_Analyze": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "AnalyzeAST",
          "States": {
            "AnalyzeAST": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:xxx:function:AnalyzeAST",
              "End": true
            }
          }
        },
        {
          "StartAt": "AnalyzeDependencies",
          "States": {
            "AnalyzeDependencies": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:xxx:function:AnalyzeDeps",
              "End": true
            }
          }
        },
        {
          "StartAt": "AnalyzeRoutes",
          "States": {
            "AnalyzeRoutes": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:xxx:function:AnalyzeRoutes",
              "End": true
            }
          }
        },
        {
          "StartAt": "AnalyzeModels",
          "States": {
            "AnalyzeModels": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:xxx:function:AnalyzeModels",
              "End": true
            }
          }
        }
      ],
      "Next": "Phase2_5_EnvDetection"
    },
    
    "Phase2_5_EnvDetection": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:xxx:function:DetectEnv",
      "Next": "Phase3_Plan"
    },
    
    "Phase3_Plan": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:xxx:function:PlanMigration",
      "TimeoutSeconds": 300,
      "Next": "Phase4_Generate"
    },
    
    "Phase4_Generate": {
      "Type": "Map",
      "ItemsPath": "$.fileBatches",
      "MaxConcurrency": 10,
      "Iterator": {
        "StartAt": "GenerateBatch",
        "States": {
          "GenerateBatch": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:xxx:function:GenerateCode",
            "End": true
          }
        }
      },
      "Next": "Phase5_Build"
    },
    
    "Phase5_Build": {
      "Type": "Task",
      "Resource": "arn:aws:states:::codebuild:startBuild.sync",
      "Parameters": {
        "ProjectName": "LazarusBuilder",
        "SourceVersion.$": "$.commitId"
      },
      "Next": "Phase5_Deploy"
    },
    
    "Phase5_Deploy": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:xxx:function:DeployToAppRunner",
      "Next": "Phase6_Validate"
    },
    
    "Phase6_Validate": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:xxx:function:ValidateDeployment",
      "Next": "CheckValidation"
    },
    
    "CheckValidation": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.validation.success",
          "BooleanEquals": true,
          "Next": "Success"
        },
        {
          "Variable": "$.validation.success",
          "BooleanEquals": false,
          "Next": "Phase7_SelfHeal"
        }
      ]
    },
    
    "Phase7_SelfHeal": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:xxx:function:SelfHeal",
      "Next": "CheckHealAttempts"
    },
    
    "CheckHealAttempts": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.healAttempts",
          "NumericLessThan": 5,
          "Next": "Phase5_Build"
        },
        {
          "Variable": "$.healAttempts",
          "NumericGreaterThanEquals": 5,
          "Next": "NotifyFailure"
        }
      ]
    },
    
    "Success": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:xxx:function:NotifySuccess",
      "End": true
    },
    
    "NotifyFailure": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:xxx:function:NotifyFailure",
      "End": true
    }
  }
}
```


### 3.4 Phase 1: Scan Component

#### 3.4.1 Scan Lambda Function

```typescript
// lambda/scan/index.ts
import { S3, DynamoDB } from 'aws-sdk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ScanInput {
  projectId: string;
  repoUrl: string;
  branch?: string;
  auth?: {
    token: string;
  };
}

interface ScanOutput {
  projectId: string;
  framework: string;
  frameworkVersion: string;
  runtime: string;
  runtimeVersion: string;
  buildTool: string;
  dependencies: Record<string, string>;
  fileCount: number;
  totalSize: number;
}

export const handler = async (event: ScanInput): Promise<ScanOutput> => {
  const { projectId, repoUrl, branch = 'main', auth } = event;
  
  // Clone repository
  const cloneDir = `/tmp/${projectId}`;
  const cloneCmd = auth 
    ? `git clone -b ${branch} https://${auth.token}@${repoUrl.replace('https://', '')} ${cloneDir}`
    : `git clone -b ${branch} ${repoUrl} ${cloneDir}`;
  
  execSync(cloneCmd);
  
  // Detect tech stack
  const techStack = detectTechStack(cloneDir);
  
  // Upload to S3
  await uploadToS3(projectId, cloneDir);
  
  // Store metadata in DynamoDB
  await storeScanResults(projectId, techStack);
  
  return {
    projectId,
    ...techStack
  };
};

function detectTechStack(dir: string): Omit<ScanOutput, 'projectId'> {
  let framework = 'unknown';
  let frameworkVersion = 'unknown';
  let runtime = 'unknown';
  let runtimeVersion = 'unknown';
  let buildTool = 'unknown';
  let dependencies: Record<string, string> = {};
  
  // Check for Node.js project
  const packageJsonPath = path.join(dir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    runtime = 'node';
    dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // Detect framework
    if (dependencies['react']) {
      framework = 'react';
      frameworkVersion = dependencies['react'];
    } else if (dependencies['vue']) {
      framework = 'vue';
      frameworkVersion = dependencies['vue'];
    } else if (dependencies['@angular/core']) {
      framework = 'angular';
      frameworkVersion = dependencies['@angular/core'];
    } else if (dependencies['express']) {
      framework = 'express';
      frameworkVersion = dependencies['express'];
    }
    
    // Detect build tool
    if (dependencies['webpack']) buildTool = 'webpack';
    else if (dependencies['vite']) buildTool = 'vite';
    else if (dependencies['parcel']) buildTool = 'parcel';
    
    // Detect Node version
    if (packageJson.engines?.node) {
      runtimeVersion = packageJson.engines.node;
    }
  }
  
  // Check for Python project
  const requirementsPath = path.join(dir, 'requirements.txt');
  if (fs.existsSync(requirementsPath)) {
    runtime = 'python';
    const requirements = fs.readFileSync(requirementsPath, 'utf-8');
    requirements.split('\n').forEach(line => {
      const match = line.match(/^([^=<>]+)[=<>]+(.+)$/);
      if (match) {
        dependencies[match[1].trim()] = match[2].trim();
        if (match[1].trim() === 'django') {
          framework = 'django';
          frameworkVersion = match[2].trim();
        } else if (match[1].trim() === 'flask') {
          framework = 'flask';
          frameworkVersion = match[2].trim();
        }
      }
    });
  }
  
  // Calculate file stats
  const fileCount = countFiles(dir);
  const totalSize = calculateSize(dir);
  
  return {
    framework,
    frameworkVersion,
    runtime,
    runtimeVersion,
    buildTool,
    dependencies,
    fileCount,
    totalSize
  };
}

function countFiles(dir: string): number {
  let count = 0;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (file === 'node_modules' || file === '.git') return;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      count += countFiles(filePath);
    } else {
      count++;
    }
  });
  return count;
}

function calculateSize(dir: string): number {
  let size = 0;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (file === 'node_modules' || file === '.git') return;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      size += calculateSize(filePath);
    } else {
      size += stat.size;
    }
  });
  return size;
}
```

### 3.5 Phase 2: Analyze Component

#### 3.5.1 AST Analysis Lambda

```typescript
// lambda/analyze/ast.ts
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as fs from 'fs';
import * as path from 'path';

interface ASTAnalysisResult {
  components: ComponentInfo[];
  functions: FunctionInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  deprecatedAPIs: DeprecatedAPI[];
}

interface ComponentInfo {
  name: string;
  type: 'class' | 'function';
  file: string;
  props: string[];
  state: string[];
  lifecycle: string[];
}

export const handler = async (event: { projectId: string; files: string[] }) => {
  const { projectId, files } = event;
  
  const results: ASTAnalysisResult = {
    components: [],
    functions: [],
    imports: [],
    exports: [],
    deprecatedAPIs: []
  };
  
  for (const file of files) {
    if (!file.match(/\.(js|jsx|ts|tsx)$/)) continue;
    
    const code = await downloadFile(projectId, file);
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
    
    traverse(ast, {
      // Detect React class components
      ClassDeclaration(path) {
        const superClass = path.node.superClass;
        if (superClass && 
            superClass.type === 'MemberExpression' &&
            superClass.object.name === 'React' &&
            superClass.property.name === 'Component') {
          
          const component: ComponentInfo = {
            name: path.node.id.name,
            type: 'class',
            file,
            props: [],
            state: [],
            lifecycle: []
          };
          
          // Extract lifecycle methods
          path.node.body.body.forEach(method => {
            if (method.type === 'ClassMethod') {
              const methodName = method.key.name;
              if (['componentDidMount', 'componentDidUpdate', 'componentWillUnmount'].includes(methodName)) {
                component.lifecycle.push(methodName);
                results.deprecatedAPIs.push({
                  type: 'lifecycle',
                  name: methodName,
                  file,
                  line: method.loc.start.line,
                  suggestion: mapLifecycleToHook(methodName)
                });
              }
            }
          });
          
          results.components.push(component);
        }
      },
      
      // Detect function components
      FunctionDeclaration(path) {
        const returnStatement = path.node.body.body.find(
          stmt => stmt.type === 'ReturnStatement'
        );
        if (returnStatement && isJSXElement(returnStatement.argument)) {
          results.components.push({
            name: path.node.id.name,
            type: 'function',
            file,
            props: path.node.params.map(p => p.name),
            state: [],
            lifecycle: []
          });
        }
      },
      
      // Detect deprecated APIs
      CallExpression(path) {
        const callee = path.node.callee;
        if (callee.type === 'MemberExpression') {
          const objName = callee.object.name;
          const propName = callee.property.name;
          
          // Check for deprecated React APIs
          if (objName === 'React' && ['createClass', 'PropTypes'].includes(propName)) {
            results.deprecatedAPIs.push({
              type: 'api',
              name: `React.${propName}`,
              file,
              line: path.node.loc.start.line,
              suggestion: getModernAlternative(`React.${propName}`)
            });
          }
        }
      }
    });
  }
  
  return results;
};

function mapLifecycleToHook(lifecycle: string): string {
  const mapping = {
    'componentDidMount': 'useEffect(() => { ... }, [])',
    'componentDidUpdate': 'useEffect(() => { ... }, [dependencies])',
    'componentWillUnmount': 'useEffect(() => { return () => { ... } }, [])'
  };
  return mapping[lifecycle] || 'unknown';
}
```

### 3.6 Phase 3: Plan Component

#### 3.6.1 Migration Planning with Claude Sonnet

```typescript
// lambda/plan/index.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

interface MigrationPlan {
  files: FileMigrationPlan[];
  complexity: number;
  estimatedTime: number;
  breakingChanges: string[];
}

interface FileMigrationPlan {
  path: string;
  changes: Change[];
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

interface Change {
  type: 'syntax' | 'api' | 'architecture' | 'dependency';
  description: string;
  before: string;
  after: string;
  reasoning: string;
}

export const handler = async (event: {
  projectId: string;
  scanResult: any;
  analysisResult: any;
}) => {
  const { projectId, scanResult, analysisResult } = event;
  
  const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
  
  // Build context for Claude
  const context = buildMigrationContext(scanResult, analysisResult);
  
  const prompt = `You are an expert software engineer specializing in code modernization.

Given this legacy codebase:
- Framework: ${scanResult.framework} ${scanResult.frameworkVersion}
- Runtime: ${scanResult.runtime} ${scanResult.runtimeVersion}
- Dependencies: ${JSON.stringify(scanResult.dependencies, null, 2)}

Analysis results:
${JSON.stringify(analysisResult, null, 2)}

Create a detailed file-by-file migration plan to modernize this codebase to the latest stable versions.

For each file that needs changes:
1. List specific changes required
2. Explain the reasoning for each change
3. Identify any breaking changes
4. Suggest the migration priority

Respond in JSON format matching this schema:
{
  "files": [
    {
      "path": "src/Component.jsx",
      "changes": [
        {
          "type": "architecture",
          "description": "Convert class component to function component",
          "before": "class Component extends React.Component",
          "after": "function Component(props)",
          "reasoning": "Function components with hooks are the modern React pattern"
        }
      ],
      "reasoning": "This component uses deprecated lifecycle methods",
      "priority": "high"
    }
  ],
  "complexity": 7,
  "estimatedTime": 8,
  "breakingChanges": ["Props interface changed", "State management refactored"]
}`;

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      system: 'You are a code modernization expert. Always respond with valid JSON.',
      temperature: 0.3
    })
  });
  
  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const plan: MigrationPlan = JSON.parse(responseBody.content[0].text);
  
  // Store plan in DynamoDB
  await storeMigrationPlan(projectId, plan);
  
  return plan;
};
```

### 3.7 Phase 4: Generate Component

#### 3.7.1 Code Generation with Prompt Caching

```typescript
// lambda/generate/index.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

export const handler = async (event: {
  projectId: string;
  fileBatch: string[];
  migrationPlan: MigrationPlan;
  scanResult: any;
}) => {
  const { projectId, fileBatch, migrationPlan, scanResult } = event;
  
  const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
  const s3 = new S3Client({ region: 'us-east-1' });
  
  // Build cached context (reused across all batches)
  const cachedContext = buildCachedContext(scanResult, migrationPlan);
  
  const results = [];
  
  for (const filePath of fileBatch) {
    const originalCode = await downloadFile(projectId, filePath);
    const filePlan = migrationPlan.files.find(f => f.path === filePath);
    
    if (!filePlan) {
      // No changes needed, copy as-is
      await uploadFile(projectId, `modernized/${filePath}`, originalCode);
      continue;
    }
    
    const prompt = `Modernize this file according to the migration plan.

File: ${filePath}

Original code:
\`\`\`
${originalCode}
\`\`\`

Required changes:
${JSON.stringify(filePlan.changes, null, 2)}

Generate the modernized code. Preserve all business logic, comments, and functionality.
Only update syntax, APIs, and patterns as specified. Respond with ONLY the code, no explanations.`;

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: cachedContext,
                cache_control: { type: 'ephemeral' }  // Cache this context
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ],
        system: 'You are an expert code modernization assistant.',
        temperature: 0.2
      })
    });
    
    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const modernizedCode = responseBody.content[0].text;
    
    // Upload modernized code
    await uploadFile(projectId, `modernized/${filePath}`, modernizedCode);
    
    // Store diff
    await storeDiff(projectId, filePath, originalCode, modernizedCode, filePlan);
    
    results.push({
      file: filePath,
      success: true,
      cacheHit: responseBody.usage?.cache_read_input_tokens > 0
    });
  }
  
  return results;
};

function buildCachedContext(scanResult: any, migrationPlan: MigrationPlan): string {
  return `Project Context (cached):
- Framework: ${scanResult.framework} ${scanResult.frameworkVersion}
- Target: Latest stable version
- Runtime: ${scanResult.runtime}
- Build tool: ${scanResult.buildTool}

Migration strategy:
${JSON.stringify(migrationPlan, null, 2)}

General modernization rules:
1. Convert class components to function components with hooks
2. Replace lifecycle methods with useEffect
3. Update deprecated APIs to modern equivalents
4. Use modern ES6+ syntax
5. Preserve all business logic and functionality
6. Maintain code style and formatting
7. Keep all comments and documentation`;
}
```

### 3.8 Phase 5: Build & Deploy Component

#### 3.8.1 CodeBuild Configuration

```yaml
# buildspec.yml
version: 0.2

phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
      - COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)
      - IMAGE_TAG=${COMMIT_HASH:=latest}
  
  build:
    commands:
      - echo Build started on `date`
      - echo Building the Docker image...
      - docker build -t $IMAGE_REPO_NAME:$IMAGE_TAG .
      - docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $ECR_REGISTRY/$IMAGE_REPO_NAME:$IMAGE_TAG
  
  post_build:
    commands:
      - echo Build completed on `date`
      - echo Pushing the Docker image...
      - docker push $ECR_REGISTRY/$IMAGE_REPO_NAME:$IMAGE_TAG
      - echo Writing image definitions file...
      - printf '[{"name":"%s","imageUri":"%s"}]' $IMAGE_REPO_NAME $ECR_REGISTRY/$IMAGE_REPO_NAME:$IMAGE_TAG > imagedefinitions.json

artifacts:
  files:
    - imagedefinitions.json
```

#### 3.8.2 Dockerfile Generation

```typescript
// lambda/deploy/generate-dockerfile.ts
export function generateDockerfile(scanResult: any): string {
  const { framework, runtime, runtimeVersion } = scanResult;
  
  if (runtime === 'node') {
    return generateNodeDockerfile(framework, runtimeVersion);
  } else if (runtime === 'python') {
    return generatePythonDockerfile(framework, runtimeVersion);
  }
  
  throw new Error(`Unsupported runtime: ${runtime}`);
}

function generateNodeDockerfile(framework: string, version: string): string {
  const nodeVersion = version || '20';
  
  return `FROM node:${nodeVersion}-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production image
FROM node:${nodeVersion}-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \\
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "dist/index.js"]
`;
}

function generatePythonDockerfile(framework: string, version: string): string {
  const pythonVersion = version || '3.11';
  
  return `FROM python:${pythonVersion}-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \\
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Start application
${framework === 'django' 
  ? 'CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app.wsgi:application"]'
  : 'CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]'
}
`;
}
```

#### 3.8.3 App Runner Deployment

```typescript
// lambda/deploy/app-runner.ts
import { AppRunnerClient, CreateServiceCommand, UpdateServiceCommand } from '@aws-sdk/client-apprunner';

export const handler = async (event: {
  projectId: string;
  imageUri: string;
  envVars: Record<string, string>;
}) => {
  const { projectId, imageUri, envVars } = event;
  
  const appRunner = new AppRunnerClient({ region: 'us-east-1' });
  
  const serviceName = `lazarus-${projectId}`;
  
  try {
    // Try to update existing service
    const updateCommand = new UpdateServiceCommand({
      ServiceArn: await getServiceArn(serviceName),
      SourceConfiguration: {
        ImageRepository: {
          ImageIdentifier: imageUri,
          ImageRepositoryType: 'ECR',
          ImageConfiguration: {
            Port: '3000',
            RuntimeEnvironmentVariables: envVars
          }
        },
        AutoDeploymentsEnabled: false
      }
    });
    
    const response = await appRunner.send(updateCommand);
    return {
      serviceUrl: response.Service.ServiceUrl,
      serviceArn: response.Service.ServiceArn
    };
    
  } catch (error) {
    // Service doesn't exist, create new one
    const createCommand = new CreateServiceCommand({
      ServiceName: serviceName,
      SourceConfiguration: {
        ImageRepository: {
          ImageIdentifier: imageUri,
          ImageRepositoryType: 'ECR',
          ImageConfiguration: {
            Port: '3000',
            RuntimeEnvironmentVariables: envVars
          }
        },
        AutoDeploymentsEnabled: false,
        AuthenticationConfiguration: {
          AccessRoleArn: process.env.APP_RUNNER_ROLE_ARN
        }
      },
      InstanceConfiguration: {
        Cpu: '1 vCPU',
        Memory: '2 GB'
      },
      HealthCheckConfiguration: {
        Protocol: 'HTTP',
        Path: '/health',
        Interval: 10,
        Timeout: 5,
        HealthyThreshold: 1,
        UnhealthyThreshold: 5
      },
      AutoScalingConfigurationArn: process.env.AUTO_SCALING_CONFIG_ARN
    });
    
    const response = await appRunner.send(createCommand);
    return {
      serviceUrl: response.Service.ServiceUrl,
      serviceArn: response.Service.ServiceArn
    };
  }
};
```


### 3.9 Phase 6: Validation Component

```typescript
// lambda/validate/index.ts
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import axios from 'axios';

interface ValidationResult {
  success: boolean;
  healthCheck: boolean;
  errorCount: number;
  errors: string[];
  responseTime: number;
}

export const handler = async (event: {
  projectId: string;
  serviceUrl: string;
  logGroupName: string;
}): Promise<ValidationResult> => {
  const { serviceUrl, logGroupName } = event;
  
  const result: ValidationResult = {
    success: false,
    healthCheck: false,
    errorCount: 0,
    errors: [],
    responseTime: 0
  };
  
  // 1. Health check
  try {
    const start = Date.now();
    const response = await axios.get(`https://${serviceUrl}/health`, {
      timeout: 5000
    });
    result.responseTime = Date.now() - start;
    result.healthCheck = response.status === 200;
  } catch (error) {
    result.errors.push(`Health check failed: ${error.message}`);
  }
  
  // 2. Scan CloudWatch logs for errors
  const logs = new CloudWatchLogsClient({ region: 'us-east-1' });
  const logCommand = new FilterLogEventsCommand({
    logGroupName,
    filterPattern: 'ERROR',
    startTime: Date.now() - 5 * 60 * 1000, // Last 5 minutes
    limit: 100
  });
  
  const logResponse = await logs.send(logCommand);
  result.errorCount = logResponse.events?.length || 0;
  result.errors.push(...(logResponse.events?.map(e => e.message) || []));
  
  // 3. Overall success
  result.success = result.healthCheck && result.errorCount === 0;
  
  return result;
};
```

### 3.10 Phase 7: Self-Healing Component

```typescript
// lambda/self-heal/index.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export const handler = async (event: {
  projectId: string;
  validationResult: ValidationResult;
  currentCode: string;
  healAttempts: number;
}) => {
  const { projectId, validationResult, currentCode, healAttempts } = event;
  
  const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
  
  const prompt = `You are debugging a deployed application that failed validation.

Errors encountered:
${validationResult.errors.join('\n')}

Current code:
\`\`\`
${currentCode}
\`\`\`

Diagnose the issue and provide a code patch to fix it.
Respond in JSON format:
{
  "diagnosis": "Brief explanation of the issue",
  "fix": "Code patch to apply",
  "filePath": "Path to file that needs patching"
}`;

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    })
  });
  
  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const patch = JSON.parse(responseBody.content[0].text);
  
  // Apply patch
  await applyPatch(projectId, patch);
  
  return {
    projectId,
    patch,
    healAttempts: healAttempts + 1
  };
};
```


## 4. Database Schema Design

### 4.1 DynamoDB Tables

#### 4.1.1 Projects Table

```typescript
// Table: lazarus-projects
{
  PK: "USER#<userId>",           // Partition key
  SK: "PROJECT#<projectId>",     // Sort key
  
  // Project metadata
  projectId: string,
  userId: string,
  repoUrl: string,
  branch: string,
  createdAt: string,
  updatedAt: string,
  
  // Status
  status: 'PENDING' | 'SCANNING' | 'ANALYZING' | 'PLANNING' | 
          'GENERATING' | 'BUILDING' | 'DEPLOYING' | 'VALIDATING' | 
          'HEALING' | 'SUCCESS' | 'FAILED',
  currentPhase: number,
  progress: number,
  
  // Results
  liveUrl?: string,
  serviceArn?: string,
  
  // Tech stack
  framework: string,
  frameworkVersion: string,
  runtime: string,
  
  // Metrics
  fileCount: number,
  totalSize: number,
  cost: number,
  duration: number,
  
  // GSI keys
  GSI1PK: "STATUS#<status>",
  GSI1SK: "CREATED#<timestamp>"
}

// GSI: StatusIndex
// PK: GSI1PK, SK: GSI1SK
// Use case: Query all projects by status
```

#### 4.1.2 Migration Plans Table

```typescript
// Table: lazarus-migration-plans
{
  PK: "PROJECT#<projectId>",     // Partition key
  SK: "PLAN#v1",                 // Sort key (versioned)
  
  projectId: string,
  version: number,
  createdAt: string,
  
  // Plan details
  complexity: number,
  estimatedTime: number,
  breakingChanges: string[],
  
  // File-level plans
  files: [
    {
      path: string,
      changes: Change[],
      reasoning: string,
      priority: 'high' | 'medium' | 'low'
    }
  ]
}
```

#### 4.1.3 Diffs Table

```typescript
// Table: lazarus-diffs
{
  PK: "PROJECT#<projectId>",     // Partition key
  SK: "FILE#<filePath>",         // Sort key
  
  projectId: string,
  filePath: string,
  
  // Code
  originalCode: string,          // Stored in S3, reference here
  modernizedCode: string,        // Stored in S3, reference here
  originalS3Key: string,
  modernizedS3Key: string,
  
  // Diff metadata
  changes: Change[],
  reasoning: string,
  linesAdded: number,
  linesRemoved: number,
  
  // AI explanations
  explanations: [
    {
      changeType: string,
      explanation: string,
      before: string,
      after: string
    }
  ]
}
```

#### 4.1.4 Users Table

```typescript
// Table: lazarus-users
{
  PK: "USER#<userId>",           // Partition key
  SK: "PROFILE",                 // Sort key
  
  userId: string,
  email: string,
  name: string,
  createdAt: string,
  
  // Subscription
  tier: 'free' | 'pro' | 'enterprise',
  resurrectionsUsed: number,
  resurrectionsLimit: number,
  
  // OAuth
  githubToken?: string,
  googleToken?: string,
  
  // Preferences
  preferences: {
    defaultBranch: string,
    autoCreatePR: boolean,
    notifications: boolean
  }
}
```

### 4.2 S3 Bucket Structure

```
lazarus-projects/
├── <projectId>/
│   ├── original/
│   │   ├── src/
│   │   ├── package.json
│   │   └── ...
│   ├── modernized/
│   │   ├── src/
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── ...
│   ├── diffs/
│   │   ├── src/Component.jsx.diff
│   │   └── ...
│   └── metadata/
│       ├── scan-result.json
│       ├── analysis-result.json
│       └── migration-plan.json
```

### 4.3 ElastiCache Schema

```typescript
// Redis keys for caching

// Environment detection cache
`env:${projectId}` → {
  variables: Record<string, EnvVar>,
  ttl: 3600
}

// Bedrock prompt cache references
`prompt-cache:${projectId}:context` → {
  cacheId: string,
  expiresAt: number
}

// User session cache
`session:${userId}` → {
  token: string,
  expiresAt: number
}
```


## 5. AI/ML Integration Design

### 5.1 Amazon Bedrock Model Usage

#### 5.1.1 Claude Sonnet (Primary Model)

**Use Cases:**
- Phase 3: Migration planning (complex reasoning)
- Phase 4: Code generation (high-quality output)
- Phase 7: Self-healing (error diagnosis)
- AI Code Editor: Contextual explanations
- Visual AI Design: Code modifications

**Configuration:**
```typescript
{
  modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  temperature: 0.2,  // Low for consistency
  max_tokens: 4096,
  top_p: 0.9
}
```

**Cost Optimization:**
- Prompt caching for repeated context (90% cost reduction)
- Batch processing for code generation
- Context window management (200K tokens)

#### 5.1.2 Claude Haiku (Lightweight Model)

**Use Cases:**
- Phase 2.5: Environment variable detection
- Quick code explanations
- Syntax validation
- Simple transformations

**Configuration:**
```typescript
{
  modelId: 'anthropic.claude-3-5-haiku-20241022-v1:0',
  temperature: 0.1,
  max_tokens: 1024
}
```

#### 5.1.3 Titan Image Generator G1 v2

**Use Cases:**
- Visual AI Design: Image creation
- Visual AI Design: Image editing
- Asset generation

**Configuration:**
```typescript
{
  modelId: 'amazon.titan-image-generator-v2:0',
  taskType: 'TEXT_IMAGE' | 'IMAGE_VARIATION',
  imageGenerationConfig: {
    numberOfImages: 1,
    quality: 'premium',
    height: 1024,
    width: 1024,
    cfgScale: 8.0
  }
}
```

### 5.2 Prompt Engineering Strategies

#### 5.2.1 Migration Planning Prompt Template

```typescript
const MIGRATION_PLANNING_PROMPT = `You are an expert software engineer specializing in code modernization.

<context>
Framework: {{framework}} {{frameworkVersion}}
Target: Latest stable version
Runtime: {{runtime}} {{runtimeVersion}}
Dependencies: {{dependencies}}
</context>

<analysis>
{{analysisResults}}
</analysis>

<task>
Create a detailed file-by-file migration plan. For each file:
1. Identify specific changes needed
2. Explain reasoning for each change
3. Flag breaking changes
4. Assign priority (high/medium/low)
</task>

<constraints>
- Preserve all business logic
- Maintain backward compatibility where possible
- Follow framework best practices
- Minimize breaking changes
</constraints>

<output_format>
Respond with valid JSON matching this schema:
{
  "files": [
    {
      "path": "string",
      "changes": [
        {
          "type": "syntax|api|architecture|dependency",
          "description": "string",
          "before": "string",
          "after": "string",
          "reasoning": "string"
        }
      ],
      "reasoning": "string",
      "priority": "high|medium|low"
    }
  ],
  "complexity": 1-10,
  "estimatedTime": minutes,
  "breakingChanges": ["string"]
}
</output_format>`;
```

#### 5.2.2 Code Generation Prompt Template

```typescript
const CODE_GENERATION_PROMPT = `<cached_context>
{{migrationContext}}
</cached_context>

<file>
Path: {{filePath}}

Original code:
\`\`\`{{language}}
{{originalCode}}
\`\`\`
</file>

<changes_required>
{{fileChanges}}
</changes_required>

<instructions>
Generate the modernized version of this file:
1. Apply all specified changes
2. Preserve business logic exactly
3. Maintain code style and formatting
4. Keep all comments and documentation
5. Use modern best practices
6. Ensure code is production-ready
</instructions>

<output>
Respond with ONLY the modernized code, no explanations or markdown.
</output>`;
```

#### 5.2.3 Self-Healing Prompt Template

```typescript
const SELF_HEALING_PROMPT = `You are debugging a deployed application.

<error_logs>
{{errorLogs}}
</error_logs>

<current_code>
{{relevantCode}}
</current_code>

<deployment_info>
Runtime: {{runtime}}
Framework: {{framework}}
Environment: {{environment}}
</deployment_info>

<task>
1. Diagnose the root cause
2. Provide a minimal code patch
3. Explain the fix
</task>

<output_format>
{
  "diagnosis": "Brief explanation of the issue",
  "rootCause": "Specific cause",
  "fix": "Code patch to apply",
  "filePath": "Path to file needing patch",
  "confidence": 0.0-1.0
}
</output_format>`;
```

### 5.3 Prompt Caching Strategy

```typescript
// Cache structure for cost optimization
interface CachedPromptContext {
  projectId: string;
  cacheKey: string;
  context: {
    framework: string;
    migrationPlan: MigrationPlan;
    generalRules: string;
  };
  expiresAt: number;
}

// Cache the common context across all file generations
async function generateCodeWithCache(
  projectId: string,
  filePath: string,
  originalCode: string
) {
  const cachedContext = await getCachedContext(projectId);
  
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: cachedContext,
          cache_control: { type: 'ephemeral' }  // Cache for 5 minutes
        },
        {
          type: 'text',
          text: buildFileSpecificPrompt(filePath, originalCode)
        }
      ]
    }
  ];
  
  // First call: Full cost
  // Subsequent calls: 90% cheaper (cache hit)
  return invokeBedrock(messages);
}
```


## 6. Security Design

### 6.1 Authentication Flow

```
┌─────────┐                                    ┌─────────┐
│ Browser │                                    │ Cognito │
└────┬────┘                                    └────┬────┘
     │                                              │
     │ 1. Login request                             │
     ├─────────────────────────────────────────────>│
     │                                              │
     │ 2. JWT tokens (ID, Access, Refresh)          │
     │<─────────────────────────────────────────────┤
     │                                              │
     │ 3. API request + ID token                    │
     ├──────────────────────────>┌──────────────┐  │
     │                            │ API Gateway  │  │
     │                            └──────┬───────┘  │
     │                                   │          │
     │                            4. Validate token │
     │                                   ├──────────>│
     │                                   │          │
     │                            5. Token valid    │
     │                                   │<─────────┤
     │                                   │          │
     │                            6. Invoke Lambda  │
     │                                   ├────────> │
     │                                   │          │
     │ 7. Response                       │          │
     │<──────────────────────────────────┤          │
```

### 6.2 IAM Roles and Policies

#### 6.2.1 Lambda Execution Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::lazarus-projects/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/lazarus-projects",
        "arn:aws:dynamodb:*:*:table/lazarus-projects/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
        "arn:aws:bedrock:*::foundation-model/amazon.titan-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:lazarus/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

#### 6.2.2 App Runner Instance Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:lazarus/apps/*"
    }
  ]
}
```

### 6.3 Data Encryption

#### 6.3.1 Encryption at Rest

- **S3**: AES-256 encryption with AWS managed keys (SSE-S3)
- **DynamoDB**: Encryption using AWS owned keys
- **Secrets Manager**: Automatic encryption with KMS
- **ECR**: Encryption at rest enabled

#### 6.3.2 Encryption in Transit

- **API Gateway**: TLS 1.2+ only
- **CloudFront**: TLS 1.2+ with custom SSL certificate
- **Internal**: VPC endpoints for AWS service communication

### 6.4 Secrets Management

```typescript
// Secrets Manager structure
{
  // User GitHub tokens
  "lazarus/users/<userId>/github": {
    "token": "ghp_...",
    "expiresAt": "2026-03-15T00:00:00Z"
  },
  
  // Resurrected app environment variables
  "lazarus/apps/<projectId>/env": {
    "DATABASE_URL": "postgres://...",
    "API_KEY": "...",
    "JWT_SECRET": "..."
  },
  
  // System secrets
  "lazarus/system/github-app": {
    "appId": "123456",
    "privateKey": "-----BEGIN RSA PRIVATE KEY-----...",
    "webhookSecret": "..."
  }
}
```

### 6.5 WAF Rules

```yaml
WebACL:
  Rules:
    - Name: RateLimitRule
      Priority: 1
      Statement:
        RateBasedStatement:
          Limit: 2000
          AggregateKeyType: IP
      Action:
        Block: {}
    
    - Name: GeoBlockRule
      Priority: 2
      Statement:
        GeoMatchStatement:
          CountryCodes: [CN, RU, KP]  # Example
      Action:
        Block: {}
    
    - Name: SQLInjectionRule
      Priority: 3
      Statement:
        ManagedRuleGroupStatement:
          VendorName: AWS
          Name: AWSManagedRulesSQLiRuleSet
      Action:
        Block: {}
    
    - Name: XSSRule
      Priority: 4
      Statement:
        ManagedRuleGroupStatement:
          VendorName: AWS
          Name: AWSManagedRulesKnownBadInputsRuleSet
      Action:
        Block: {}
```

### 6.6 Input Validation

```typescript
// API Gateway request validation
const resurrectionRequestSchema = {
  type: 'object',
  required: ['repoUrl'],
  properties: {
    repoUrl: {
      type: 'string',
      pattern: '^https://github\\.com/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$',
      maxLength: 200
    },
    branch: {
      type: 'string',
      pattern: '^[a-zA-Z0-9/_-]+$',
      maxLength: 100
    }
  }
};

// Lambda input sanitization
function sanitizeInput(input: any): any {
  // Remove potential code injection
  const sanitized = JSON.parse(JSON.stringify(input));
  
  // Validate GitHub URL
  if (sanitized.repoUrl) {
    const url = new URL(sanitized.repoUrl);
    if (url.hostname !== 'github.com') {
      throw new Error('Invalid repository URL');
    }
  }
  
  // Sanitize file paths
  if (sanitized.filePath) {
    sanitized.filePath = sanitized.filePath.replace(/\.\./g, '');
  }
  
  return sanitized;
}
```


## 7. Visual AI Design Mode Architecture

### 7.1 Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Visual AI Design Mode UI                    │
│  ┌──────────────────┐  ┌──────────────────────────┐    │
│  │  Live Preview    │  │  Code Editor             │    │
│  │  (iframe)        │  │  (Monaco)                │    │
│  │                  │  │                          │    │
│  │  ┌────────────┐  │  │  ┌────────────────────┐ │    │
│  │  │ Click to   │  │  │  │ Highlighted change │ │    │
│  │  │ select     │  │  │  │ in code            │ │    │
│  │  └────────────┘  │  │  └────────────────────┘ │    │
│  └──────────────────┘  └──────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Design Prompt Input                              │  │
│  │  "Make this button blue with rounded corners"    │  │
│  │  [Apply Change]                                   │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────┘
                         │
                         │ WebSocket
                         │
┌────────────────────────▼─────────────────────────────────┐
│              Design Mode Backend                          │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Element Selector                                │    │
│  │  - Parse DOM from iframe                         │    │
│  │  - Extract element properties                    │    │
│  │  - Identify associated code                      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Change Classifier                               │    │
│  │  - Analyze prompt                                │    │
│  │  - Determine change type (image/css/component)   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐   │
│  │ Image AI     │  │ CSS AI       │  │ Component   │   │
│  │ (Titan)      │  │ (Claude)     │  │ AI (Claude) │   │
│  └──────────────┘  └──────────────┘  └─────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Code Patcher                                    │    │
│  │  - Apply changes to codebase                     │    │
│  │  - Trigger hot reload                            │    │
│  └─────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

### 7.2 Element Selection Flow

```typescript
// Frontend: Element selector
class ElementSelector {
  private iframe: HTMLIFrameElement;
  private selectedElement: HTMLElement | null = null;
  
  enable() {
    const iframeDoc = this.iframe.contentDocument;
    iframeDoc.addEventListener('click', this.handleClick);
    iframeDoc.addEventListener('mouseover', this.handleHover);
  }
  
  private handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const element = e.target as HTMLElement;
    this.selectedElement = element;
    
    // Extract element info
    const elementInfo = {
      tagName: element.tagName,
      className: element.className,
      id: element.id,
      styles: window.getComputedStyle(element),
      innerHTML: element.innerHTML,
      xpath: this.getXPath(element),
      boundingBox: element.getBoundingClientRect()
    };
    
    // Highlight element
    this.highlightElement(element);
    
    // Send to backend
    this.onElementSelected(elementInfo);
  };
  
  private getXPath(element: HTMLElement): string {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    
    const parts: string[] = [];
    let current: HTMLElement | null = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = current.previousSibling;
      
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && 
            sibling.nodeName === current.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      
      const tagName = current.nodeName.toLowerCase();
      const part = index > 0 ? `${tagName}[${index + 1}]` : tagName;
      parts.unshift(part);
      
      current = current.parentElement;
    }
    
    return '/' + parts.join('/');
  }
}
```

### 7.3 Change Classification

```typescript
// Backend: Classify design change request
async function classifyDesignChange(
  prompt: string,
  elementInfo: ElementInfo
): Promise<ChangeType> {
  const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
  
  const classificationPrompt = `Analyze this design change request:

Prompt: "${prompt}"

Element: ${elementInfo.tagName}.${elementInfo.className}
Current styles: ${JSON.stringify(elementInfo.styles)}

Classify the change type:
- "image": If creating/editing an image
- "css": If modifying styles (colors, layout, spacing, etc.)
- "component": If changing structure or content

Respond with JSON:
{
  "type": "image" | "css" | "component",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 256,
      messages: [{ role: 'user', content: classificationPrompt }]
    })
  }));
  
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return JSON.parse(result.content[0].text);
}
```

### 7.4 Image Generation with Titan

```typescript
// Generate/edit image using Titan
async function generateImage(
  prompt: string,
  existingImage?: Buffer
): Promise<Buffer> {
  const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
  
  const body: any = {
    taskType: existingImage ? 'IMAGE_VARIATION' : 'TEXT_IMAGE',
    textToImageParams: {
      text: prompt
    },
    imageGenerationConfig: {
      numberOfImages: 1,
      quality: 'premium',
      height: 1024,
      width: 1024,
      cfgScale: 8.0,
      seed: Math.floor(Math.random() * 1000000)
    }
  };
  
  if (existingImage) {
    body.imageVariationParams = {
      images: [existingImage.toString('base64')],
      text: prompt
    };
  }
  
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: 'amazon.titan-image-generator-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(body)
  }));
  
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const imageBase64 = responseBody.images[0];
  
  return Buffer.from(imageBase64, 'base64');
}
```

### 7.5 CSS Generation with Claude

```typescript
// Generate CSS changes
async function generateCSSChanges(
  prompt: string,
  elementInfo: ElementInfo,
  currentCSS: string
): Promise<CSSChanges> {
  const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
  
  const cssPrompt = `Generate CSS changes for this design request:

Request: "${prompt}"

Element: ${elementInfo.tagName}.${elementInfo.className}

Current CSS:
\`\`\`css
${currentCSS}
\`\`\`

Generate the updated CSS. Respond with JSON:
{
  "css": "updated CSS code",
  "changes": [
    {
      "property": "property name",
      "oldValue": "old value",
      "newValue": "new value",
      "reasoning": "why this change"
    }
  ]
}`;

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      messages: [{ role: 'user', content: cssPrompt }],
      temperature: 0.2
    })
  }));
  
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return JSON.parse(result.content[0].text);
}
```

### 7.6 Hot Reload Implementation

```typescript
// WebSocket-based hot reload
class HotReloadManager {
  private ws: WebSocket;
  
  async applyChange(change: DesignChange) {
    // 1. Update code in S3
    await this.updateCode(change);
    
    // 2. Notify iframe to reload
    this.ws.send(JSON.stringify({
      type: 'hot-reload',
      change: {
        type: change.type,
        file: change.file,
        content: change.content
      }
    }));
  }
  
  // In iframe
  setupHotReload() {
    const ws = new WebSocket('wss://api.lazarus.dev/hot-reload');
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'hot-reload') {
        if (message.change.type === 'css') {
          this.reloadCSS(message.change.content);
        } else if (message.change.type === 'image') {
          this.reloadImage(message.change.file);
        } else {
          // Full reload for component changes
          window.location.reload();
        }
      }
    };
  }
  
  private reloadCSS(newCSS: string) {
    const styleElement = document.createElement('style');
    styleElement.textContent = newCSS;
    document.head.appendChild(styleElement);
  }
}
```


## 8. MCP Server Hub Design

### 8.1 MCP Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  MCP Server Hub                          │
│              (ECS Fargate Cluster)                       │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   GitHub     │  │   NPM/PyPI   │  │  Web Search  │ │
│  │   MCP        │  │   MCP        │  │  MCP         │ │
│  │              │  │              │  │              │ │
│  │ Port: 3001   │  │ Port: 3002   │  │ Port: 3003   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │   Docker     │  │  CloudWatch  │                    │
│  │   MCP        │  │  MCP         │                    │
│  │              │  │              │                    │
│  │ Port: 3004   │  │ Port: 3005   │                    │
│  └──────────────┘  └──────────────┘                    │
└────────────────────────┬─────────────────────────────────┘
                         │
                         │ Internal ALB
                         │
┌────────────────────────▼─────────────────────────────────┐
│                  API Gateway                              │
│              /mcp/{server}/{tool}                         │
└───────────────────────────────────────────────────────────┘
```

### 8.2 MCP Server Implementations

#### 8.2.1 GitHub MCP Server

```typescript
// mcp-servers/github/index.ts
import { MCPServer } from '@modelcontextprotocol/sdk';
import { Octokit } from '@octokit/rest';

const server = new MCPServer({
  name: 'github-mcp',
  version: '1.0.0'
});

// Tool: Clone repository
server.tool('clone_repo', {
  description: 'Clone a GitHub repository',
  parameters: {
    type: 'object',
    properties: {
      owner: { type: 'string' },
      repo: { type: 'string' },
      branch: { type: 'string', default: 'main' }
    },
    required: ['owner', 'repo']
  }
}, async (params) => {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  
  // Get repository content
  const { data } = await octokit.repos.getContent({
    owner: params.owner,
    repo: params.repo,
    path: '',
    ref: params.branch
  });
  
  return {
    success: true,
    files: data
  };
});

// Tool: Create pull request
server.tool('create_pr', {
  description: 'Create a pull request',
  parameters: {
    type: 'object',
    properties: {
      owner: { type: 'string' },
      repo: { type: 'string' },
      title: { type: 'string' },
      body: { type: 'string' },
      head: { type: 'string' },
      base: { type: 'string', default: 'main' }
    },
    required: ['owner', 'repo', 'title', 'head']
  }
}, async (params) => {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  
  const { data } = await octokit.pulls.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body,
    head: params.head,
    base: params.base
  });
  
  return {
    success: true,
    prUrl: data.html_url,
    prNumber: data.number
  };
});

server.listen(3001);
```

#### 8.2.2 NPM/PyPI MCP Server

```typescript
// mcp-servers/registry/index.ts
import { MCPServer } from '@modelcontextprotocol/sdk';
import axios from 'axios';

const server = new MCPServer({
  name: 'registry-mcp',
  version: '1.0.0'
});

// Tool: Get latest package version
server.tool('get_latest_version', {
  description: 'Get the latest version of a package',
  parameters: {
    type: 'object',
    properties: {
      package: { type: 'string' },
      registry: { type: 'string', enum: ['npm', 'pypi'] }
    },
    required: ['package', 'registry']
  }
}, async (params) => {
  if (params.registry === 'npm') {
    const { data } = await axios.get(
      `https://registry.npmjs.org/${params.package}/latest`
    );
    return {
      package: params.package,
      version: data.version,
      dependencies: data.dependencies
    };
  } else {
    const { data } = await axios.get(
      `https://pypi.org/pypi/${params.package}/json`
    );
    return {
      package: params.package,
      version: data.info.version,
      dependencies: data.info.requires_dist
    };
  }
});

// Tool: Check compatibility
server.tool('check_compatibility', {
  description: 'Check if package versions are compatible',
  parameters: {
    type: 'object',
    properties: {
      packages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' }
          }
        }
      },
      registry: { type: 'string', enum: ['npm', 'pypi'] }
    },
    required: ['packages', 'registry']
  }
}, async (params) => {
  // Check peer dependencies and version conflicts
  const conflicts = [];
  
  for (const pkg of params.packages) {
    const metadata = await getPackageMetadata(pkg.name, params.registry);
    const peerDeps = metadata.peerDependencies || {};
    
    for (const [peer, versionRange] of Object.entries(peerDeps)) {
      const installedPkg = params.packages.find(p => p.name === peer);
      if (installedPkg && !satisfiesVersion(installedPkg.version, versionRange)) {
        conflicts.push({
          package: pkg.name,
          requires: `${peer}@${versionRange}`,
          installed: `${peer}@${installedPkg.version}`
        });
      }
    }
  }
  
  return {
    compatible: conflicts.length === 0,
    conflicts
  };
});

server.listen(3002);
```

#### 8.2.3 CloudWatch MCP Server

```typescript
// mcp-servers/cloudwatch/index.ts
import { MCPServer } from '@modelcontextprotocol/sdk';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const server = new MCPServer({
  name: 'cloudwatch-mcp',
  version: '1.0.0'
});

// Tool: Query logs
server.tool('query_logs', {
  description: 'Query CloudWatch logs',
  parameters: {
    type: 'object',
    properties: {
      logGroupName: { type: 'string' },
      filterPattern: { type: 'string' },
      startTime: { type: 'number' },
      endTime: { type: 'number' },
      limit: { type: 'number', default: 100 }
    },
    required: ['logGroupName']
  }
}, async (params) => {
  const client = new CloudWatchLogsClient({ region: 'us-east-1' });
  
  const command = new FilterLogEventsCommand({
    logGroupName: params.logGroupName,
    filterPattern: params.filterPattern,
    startTime: params.startTime,
    endTime: params.endTime,
    limit: params.limit
  });
  
  const response = await client.send(command);
  
  return {
    events: response.events?.map(e => ({
      timestamp: e.timestamp,
      message: e.message
    })) || []
  };
});

// Tool: Analyze errors
server.tool('analyze_errors', {
  description: 'Analyze error patterns in logs',
  parameters: {
    type: 'object',
    properties: {
      logGroupName: { type: 'string' },
      timeRange: { type: 'number', default: 3600 }
    },
    required: ['logGroupName']
  }
}, async (params) => {
  const client = new CloudWatchLogsClient({ region: 'us-east-1' });
  
  const endTime = Date.now();
  const startTime = endTime - (params.timeRange * 1000);
  
  const command = new FilterLogEventsCommand({
    logGroupName: params.logGroupName,
    filterPattern: 'ERROR',
    startTime,
    endTime,
    limit: 1000
  });
  
  const response = await client.send(command);
  
  // Group errors by type
  const errorGroups = new Map<string, number>();
  
  response.events?.forEach(event => {
    const errorType = extractErrorType(event.message);
    errorGroups.set(errorType, (errorGroups.get(errorType) || 0) + 1);
  });
  
  return {
    totalErrors: response.events?.length || 0,
    errorTypes: Array.from(errorGroups.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: (count / (response.events?.length || 1)) * 100
    }))
  };
});

server.listen(3005);
```

### 8.3 MCP Gateway Lambda

```typescript
// lambda/mcp-gateway/index.ts
export const handler = async (event: APIGatewayProxyEvent) => {
  const { server, tool } = event.pathParameters;
  const body = JSON.parse(event.body);
  
  // Route to appropriate MCP server
  const mcpUrl = getMCPServerUrl(server);
  
  const response = await axios.post(`${mcpUrl}/tools/${tool}`, body, {
    headers: {
      'Authorization': `Bearer ${process.env.MCP_API_KEY}`
    }
  });
  
  return {
    statusCode: 200,
    body: JSON.stringify(response.data)
  };
};

function getMCPServerUrl(server: string): string {
  const urls = {
    'github': process.env.GITHUB_MCP_URL,
    'registry': process.env.REGISTRY_MCP_URL,
    'websearch': process.env.WEBSEARCH_MCP_URL,
    'docker': process.env.DOCKER_MCP_URL,
    'cloudwatch': process.env.CLOUDWATCH_MCP_URL
  };
  
  return urls[server] || '';
}
```


## 9. Monitoring and Observability

### 9.1 CloudWatch Metrics

#### 9.1.1 Custom Metrics

```typescript
// Publish custom metrics
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

async function publishMetrics(projectId: string, phase: string, metrics: any) {
  const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });
  
  await cloudwatch.send(new PutMetricDataCommand({
    Namespace: 'Lazarus/Resurrection',
    MetricData: [
      {
        MetricName: 'PhaseDuration',
        Value: metrics.duration,
        Unit: 'Seconds',
        Dimensions: [
          { Name: 'Phase', Value: phase },
          { Name: 'ProjectId', Value: projectId }
        ]
      },
      {
        MetricName: 'BedrockTokens',
        Value: metrics.tokens,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Model', Value: metrics.model },
          { Name: 'Phase', Value: phase }
        ]
      },
      {
        MetricName: 'Cost',
        Value: metrics.cost,
        Unit: 'None',
        Dimensions: [
          { Name: 'Phase', Value: phase }
        ]
      }
    ]
  }));
}
```

#### 9.1.2 Key Metrics to Track

```yaml
Resurrection Metrics:
  - ResurrectionStarted (Count)
  - ResurrectionCompleted (Count)
  - ResurrectionFailed (Count)
  - ResurrectionDuration (Seconds)
  - PhaseSuccess (Count per phase)
  - PhaseDuration (Seconds per phase)

AI Metrics:
  - BedrockInvocations (Count)
  - BedrockTokensUsed (Count)
  - BedrockCacheHits (Count)
  - BedrockLatency (Milliseconds)
  - BedrockErrors (Count)

Cost Metrics:
  - TotalCostPerResurrection (USD)
  - BedrockCost (USD)
  - ComputeCost (USD)
  - StorageCost (USD)

User Metrics:
  - ActiveUsers (Count)
  - NewSignups (Count)
  - DiffViewOpens (Count)
  - DesignModeUsage (Count)
  - PRsCreated (Count)
```

### 9.2 X-Ray Tracing

```typescript
// Enable X-Ray tracing
import AWSXRay from 'aws-xray-sdk-core';
import AWS from 'aws-sdk';

// Wrap AWS SDK
const XAWS = AWSXRay.captureAWS(AWS);

// Trace custom segments
export const handler = async (event: any) => {
  const segment = AWSXRay.getSegment();
  
  // Phase 1: Scan
  const scanSubsegment = segment.addNewSubsegment('Phase1_Scan');
  try {
    await scanRepository(event.repoUrl);
    scanSubsegment.close();
  } catch (error) {
    scanSubsegment.addError(error);
    scanSubsegment.close();
    throw error;
  }
  
  // Phase 2: Analyze
  const analyzeSubsegment = segment.addNewSubsegment('Phase2_Analyze');
  try {
    await analyzeCode(event.projectId);
    analyzeSubsegment.close();
  } catch (error) {
    analyzeSubsegment.addError(error);
    analyzeSubsegment.close();
    throw error;
  }
};
```

### 9.3 CloudWatch Dashboards

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "title": "Resurrection Success Rate",
        "metrics": [
          ["Lazarus/Resurrection", "ResurrectionCompleted"],
          [".", "ResurrectionFailed"]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1"
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Average Resurrection Duration",
        "metrics": [
          ["Lazarus/Resurrection", "ResurrectionDuration", { "stat": "Average" }]
        ],
        "period": 300,
        "region": "us-east-1",
        "yAxis": {
          "left": {
            "label": "Seconds"
          }
        }
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Bedrock Token Usage",
        "metrics": [
          ["Lazarus/Resurrection", "BedrockTokens", { "stat": "Sum" }]
        ],
        "period": 3600,
        "region": "us-east-1"
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Cost per Resurrection",
        "metrics": [
          ["Lazarus/Resurrection", "Cost", { "stat": "Average" }]
        ],
        "period": 3600,
        "region": "us-east-1",
        "yAxis": {
          "left": {
            "label": "USD"
          }
        }
      }
    }
  ]
}
```

### 9.4 Alarms

```yaml
Alarms:
  HighFailureRate:
    MetricName: ResurrectionFailed
    Threshold: 10
    Period: 300
    EvaluationPeriods: 2
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref SNSAlertTopic
  
  HighLatency:
    MetricName: ResurrectionDuration
    Statistic: Average
    Threshold: 900  # 15 minutes
    Period: 300
    EvaluationPeriods: 2
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref SNSAlertTopic
  
  HighCost:
    MetricName: Cost
    Statistic: Average
    Threshold: 5.0  # $5 per resurrection
    Period: 3600
    EvaluationPeriods: 1
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref SNSAlertTopic
  
  BedrockThrottling:
    MetricName: BedrockErrors
    Threshold: 5
    Period: 60
    EvaluationPeriods: 1
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref SNSAlertTopic
```

## 10. Deployment Architecture

### 10.1 Infrastructure as Code (CDK)

```typescript
// lib/lazarus-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';

export class LazarusStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // S3 Bucket
    const projectsBucket = new s3.Bucket(this, 'ProjectsBucket', {
      bucketName: 'lazarus-projects',
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [
        {
          id: 'ArchiveOldProjects',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90)
            }
          ]
        }
      ]
    });
    
    // DynamoDB Tables
    const projectsTable = new dynamodb.Table(this, 'ProjectsTable', {
      tableName: 'lazarus-projects',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED
    });
    
    projectsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING }
    });
    
    // Lambda Functions
    const scanFunction = new lambda.Function(this, 'ScanFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/scan'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      environment: {
        PROJECTS_BUCKET: projectsBucket.bucketName,
        PROJECTS_TABLE: projectsTable.tableName
      },
      tracing: lambda.Tracing.ACTIVE
    });
    
    projectsBucket.grantReadWrite(scanFunction);
    projectsTable.grantReadWriteData(scanFunction);
    
    // Step Functions State Machine
    const stateMachine = new stepfunctions.StateMachine(this, 'ResurrectionPipeline', {
      definitionBody: stepfunctions.DefinitionBody.fromFile('statemachine/resurrection.json'),
      timeout: cdk.Duration.minutes(15)
    });
    
    // API Gateway
    const api = new apigateway.RestApi(this, 'LazarusAPI', {
      restApiName: 'Lazarus API',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO
      }
    });
    
    // Outputs
    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: api.url
    });
  }
}
```

### 10.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy Lazarus

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy CDK stack
        run: |
          npm run cdk deploy -- --require-approval never
      
      - name: Deploy frontend
        run: |
          cd frontend
          npm run build
          aws s3 sync dist/ s3://lazarus-frontend
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_ID }} --paths "/*"
```

## 11. Cost Analysis

### 11.1 Cost Breakdown per Resurrection

```
Average Resurrection Cost: $1.85

Breakdown:
├── Bedrock (Claude Sonnet)
│   ├── Planning: $0.15 (5K input + 2K output tokens)
│   ├── Code Generation: $1.20 (50 files × $0.024 per file with caching)
│   └── Self-Healing: $0.10 (if needed, 20% of cases)
│
├── Bedrock (Claude Haiku)
│   └── Env Detection: $0.02 (2K tokens)
│
├── Lambda
│   ├── Scan: $0.01 (30s × 1024MB)
│   ├── Analyze: $0.04 (4 parallel × 60s × 1024MB)
│   ├── Generate: $0.08 (10 batches × 30s × 1024MB)
│   └── Validate/Heal: $0.02
│
├── CodeBuild
│   └── Docker Build: $0.10 (5 min × $0.005/min)
│
├── App Runner
│   └── Deployment: $0.05 (initial deployment)
│
├── S3
│   └── Storage: $0.01 (100MB × $0.023/GB)
│
├── DynamoDB
│   └── Writes: $0.02 (100 writes)
│
└── Data Transfer
    └── ECR/S3: $0.05

Total: $1.85
```

### 11.2 Monthly Cost Projections

```
Scenario: 1000 resurrections/month

Infrastructure Costs:
├── API Gateway: $35 (1M requests)
├── CloudFront: $50 (100GB transfer)
├── Cognito: $25 (5000 MAU)
├── ElastiCache: $50 (cache.t3.micro)
├── ECS Fargate (MCP): $100 (5 tasks × 0.25 vCPU)
├── App Runner (apps): $200 (average 20 running apps)
└── Monitoring: $30 (CloudWatch, X-Ray)

Total Infrastructure: $490/month

Per-Resurrection Costs:
└── 1000 × $1.85 = $1,850/month

Total Monthly Cost: $2,340
Revenue (at $5/resurrection): $5,000
Gross Margin: 53%
```

---

**Document Version**: 1.0  
**Last Updated**: February 15, 2026  
**Status**: Draft for Hackathon Submission
